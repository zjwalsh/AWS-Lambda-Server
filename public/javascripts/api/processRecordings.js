const axios = require("axios");
const { getWXAccessToken } = require('./wxccTokenService.js')
const { getRecordsByTaskId, updateAgentFields, updateAgentWithCaseUUID } = require('../db/agentsDb.js')
const { getCAAccessToken } = require('./caTokenService.js')
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
var logger = require('../../../log.js');
var curModual = " - processRecordings.js - "

const { convertWavFileToMp3, isNativeConversionAvailable } = require('./simpleAudioConverter.js');

/**
 * Main entry point called by the webhook handler when capture:available fires.
 * Gets all pause/resume records for the call, gets all recordings from Webex,
 * matches them by timestamp, then processes each matched pair.
 */
const proccessRecording = async (payload) => {
  const taskId = payload.data.taskId;

  try {
    logger.debug(curModual + 'Processing capture for taskId - ' + taskId);

    // Get all pause/resume records for this call that have form metadata
    const allRecords = await getRecordsByTaskId(taskId);
    if (!allRecords || allRecords.length === 0) {
      logger.info(curModual + 'No records found for taskId ' + taskId);
      return;
    }

    const validRecords = allRecords.filter(r => r.caseNumber);
    if (validRecords.length === 0) {
      logger.warn(curModual + 'Records exist but none have form metadata (caseNumber) for taskId ' + taskId, {
        recordCount: allRecords.length,
        pairIndexes: allRecords.map(r => r.pairIndex)
      });
      return;
    }

    logger.info(curModual + `Found ${validRecords.length} valid record(s) for taskId ${taskId}`);

    // Get all recordings from Webex captures API
    const recordings = await getCapture(payload);
    if (!recordings || recordings.length === 0) {
      logger.error(curModual + 'No recordings returned from captures API for taskId ' + taskId);
      await updateAgentFields(taskId, { status: 3, statusMessage: 'No recordings available from Webex' });
      return;
    }

    logger.info(curModual + `Found ${recordings.length} recording(s) for taskId ${taskId}`, {
      recordings: recordings.map(r => ({
        id: r.id,
        segment: r.segment,
        startTime: r.attributes?.startTime,
        fileName: r.attributes?.fileName
      }))
    });

    // Match recordings to pause/resume records by timestamp
    const pairs = matchRecordingsToRecords(recordings, validRecords);

    if (pairs.length === 0) {
      logger.error(curModual + 'Could not match any recordings to records for taskId ' + taskId);
      await updateAgentFields(taskId, { status: 3, statusMessage: 'Could not match recordings to pause/resume pairs' });
      return;
    }

    logger.info(curModual + `Processing ${pairs.length} matched pair(s) for taskId ${taskId}`);

    // Process each matched pair
    for (const { recording, record } of pairs) {
      await processOnePair(recording, record, taskId);
    }

  } catch (error) {
    logger.error(curModual + 'proccessRecording failed for taskId ' + taskId, { error: error.message });
  }
};

/**
 * Match recordings to pause/resume records using pauseSentAtMs as the anchor.
 * For each record (sorted by pauseSentAtMs), find the first unused recording
 * whose startTime falls on or after that pause timestamp.
 * This handles holds/transfers that create extra segments.
 */
function matchRecordingsToRecords(recordings, records) {
  const sortedRecordings = [...recordings].sort((a, b) =>
    new Date(a.attributes.startTime).getTime() - new Date(b.attributes.startTime).getTime()
  );

  const sortedRecords = [...records].sort((a, b) => a.pauseSentAtMs - b.pauseSentAtMs);

  const usedIndexes = new Set();
  const pairs = [];

  for (const record of sortedRecords) {
    const matchIndex = sortedRecordings.findIndex((r, i) =>
      !usedIndexes.has(i) &&
      new Date(r.attributes.startTime).getTime() >= record.pauseSentAtMs
    );

    if (matchIndex !== -1) {
      usedIndexes.add(matchIndex);
      pairs.push({ recording: sortedRecordings[matchIndex], record });
      logger.info(curModual + `Matched recording to record`, {
        pairIndex: record.pairIndex,
        recordId: record.recordId,
        pauseSentAtMs: record.pauseSentAtMs,
        recordingStartTime: sortedRecordings[matchIndex].attributes.startTime,
        fileName: sortedRecordings[matchIndex].attributes.fileName
      });
    } else {
      logger.warn(curModual + `No matching recording found for pairIndex=${record.pairIndex}`, {
        pauseSentAtMs: record.pauseSentAtMs,
        availableStartTimes: sortedRecordings
          .filter((_, i) => !usedIndexes.has(i))
          .map(r => r.attributes.startTime)
      });
    }
  }

  return pairs;
}

/**
 * Process one matched recording + record pair:
 * download WAV, convert to MP3, get case UUID, upload to CalSAWS, update DB.
 */
async function processOnePair(recording, record, taskId) {
  const { recordId, caseNumber, pairIndex } = record;
  const wavUrl = recording.attributes.filePath;
  const fileName = recording.attributes.fileName;
  const wavPath = path.join('/tmp', fileName);
  const mp3Path = wavPath.replace('.wav', '.mp3');

  logger.info(curModual + `Processing pair pairIndex=${pairIndex} recordId=${recordId}`, {
    fileName, caseNumber, wavUrl
  });

  try {
    // Download WAV
    await downloadFile(wavUrl, wavPath);

    const stats = fs.statSync(wavPath);
    if (stats.size === 0) throw new Error('Downloaded file is empty (0 bytes)');

    // Validate WAV header
    const fileBuffer = fs.readFileSync(wavPath);
    const header = fileBuffer.toString('ascii', 0, 4);
    const format = fileBuffer.toString('ascii', 8, 12);
    if (header !== 'RIFF' || format !== 'WAVE') {
      throw new Error(`Invalid WAV file format: expected RIFF/WAVE, got ${header}/${format}`);
    }

    logger.info(curModual + 'WAV downloaded and validated', { wavPath, size: stats.size });

    // Convert to MP3
    await convertWavToMp3(wavPath, mp3Path);

    // Get case UUID from CalSAWS
    logger.debug(curModual + 'Getting case UUID for caseNumber - ' + caseNumber);
    const caseUUID = await getCaseUUID(caseNumber, taskId);
    if (!caseUUID) {
      await updateAgentFields(taskId, { status: 3, statusMessage: 'No Case UUID Found' });
      return;
    }

    await updateAgentWithCaseUUID(taskId, caseUUID);

    // Upload MP3 to CalSAWS
    logger.debug(curModual + 'Uploading MP3 to CalSAWS');
    const documentumId = await uploadFile(mp3Path, caseNumber, caseUUID, taskId);

    // Update DB record with result
    await updateAgentFields(taskId, { documentumid: documentumId, caseUUID, status: 'processed' });
    logger.info(curModual + `Successfully processed pairIndex=${pairIndex}`, { documentumId: documentumId.id });

  } catch (error) {
    logger.error(curModual + `Failed processing pairIndex=${pairIndex}`, { error: error.message, taskId, recordId });
    await updateAgentFields(taskId, { status: 3, statusMessage: error.message });
  } finally {
    if (fs.existsSync(wavPath)) fs.unlinkSync(wavPath);
    if (fs.existsSync(mp3Path)) fs.unlinkSync(mp3Path);
  }
}

/**
 * Fetch all recordings for the taskId from the Webex captures API.
 * Returns the recordings array, or null on failure.
 */
async function getCapture(payload) {
  const taskId = payload.data.taskId;
  logger.info(curModual + 'Getting captures for taskId - ' + taskId);

  const accessToken = await getWXAccessToken();
  const data = {
    query: {
      orgId: WXCLIENT_ORGID,
      urlExpiration: 300,
      taskIds: [taskId],
      includeSegments: true
    }
  };
  const config = {
    method: 'post',
    maxBodyLength: Infinity,
    url: payload.data.filePath,
    headers: {
      'Authorization': 'Bearer ' + accessToken.access_token,
      'Content-Type': 'application/json'
    },
    data
  };

  try {
    logger.debug(curModual + 'Captures API request - ' + JSON.stringify(config));
    const response = await axios.request(config);
    const parsedData = response.data;

    if (!parsedData || !parsedData.data || !Array.isArray(parsedData.data)) {
      logger.error(curModual + 'Invalid captures API response structure', { parsedData });
      return null;
    }

    const recordings = parsedData.data[0]?.recording;
    if (!recordings || !Array.isArray(recordings)) {
      logger.error(curModual + 'Recordings not found or not an array in captures response');
      return null;
    }

    return recordings;

  } catch (error) {
    logger.error(curModual + 'Captures API request failed', { error: error.message, taskId });
    return null;
  }
}

async function downloadFile(url, outputPath) {
  logger.info('Starting download', { url, outputPath });

  try {
    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'stream',
      timeout: 30000,
      maxRedirects: 5
    });

    const writer = fs.createWriteStream(outputPath);
    let downloadedBytes = 0;
    response.data.on('data', (chunk) => { downloadedBytes += chunk.length; });
    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
      let streamEnded = false;
      let writerFinished = false;

      const tryResolve = () => {
        if (streamEnded && writerFinished) {
          setTimeout(() => resolve(), 100);
        }
      };

      response.data.on('end', () => { streamEnded = true; tryResolve(); });
      writer.on('finish', () => { writerFinished = true; writer.end(); tryResolve(); });
      writer.on('error', (err) => { writer.destroy(); reject(err); });
      response.data.on('error', (err) => { writer.destroy(); reject(err); });
    });

    if (!fs.existsSync(outputPath)) throw new Error('File does not exist after download stream completed');
    const stats = fs.statSync(outputPath);
    if (stats.size === 0) throw new Error('Downloaded file is empty (0 bytes)');

    const expectedSize = parseInt(response.headers['content-length'] || '0');
    if (expectedSize > 0 && stats.size < expectedSize) {
      throw new Error(`Downloaded file incomplete: ${stats.size} bytes received, expected ${expectedSize} bytes`);
    }

    logger.info('Download complete', { outputPath, size: stats.size });

  } catch (error) {
    logger.error('Download failed', { error: error.message, url });
    throw error;
  }
}

async function convertWavToMp3(inputPath, outputPath) {
  logger.info('Converting WAV to MP3', { inputPath, outputPath });

  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input file does not exist: ${inputPath}`);
  }

  if (!isNativeConversionAvailable()) {
    throw new Error('Native converter not available - cannot create required MP3 file');
  }

  await convertWavFileToMp3(inputPath, outputPath, {
    targetSampleRate: 22050,
    targetChannels: 1,
    normalize: true
  });

  if (!fs.existsSync(outputPath)) throw new Error('Conversion completed but output file does not exist');
  const stats = fs.statSync(outputPath);
  if (stats.size === 0) throw new Error('Conversion created empty output file');

  logger.info('MP3 conversion complete', { outputPath, size: stats.size });
}

async function getCaseUUID(caseNumber, taskId) {
  const accessToken = await getCAAccessToken();

  const config = {
    method: 'post',
    maxBodyLength: Infinity,
    url: CACASEURL,
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + accessToken.access_token
    },
    data: {
      caseUID: "",
      caseNumber: caseNumber,
      countyCode: "19",
      userName: "CalSAWSServiceAcct"
    }
  };

  try {
    logger.info('Getting case UUID', { caseNumber });
    const response = await axios(config);
    logger.info('Case UUID retrieved', { caseNumber, caseUID: response.data?.caseUID });
    return response.data?.caseUID;

  } catch (error) {
    logger.error('Failed to get case UUID', {
      caseNumber,
      error: error.message,
      status: error.response?.status,
      responseData: error.response?.data
    });
    if (taskId) await updateAgentFields(taskId, { status: 3, statusMessage: `Failed to get case UUID: ${error.message}` });
    throw error;
  }
}

async function uploadFile(filePath, caseNumber, caseUUID, taskId) {
  const form = new FormData();
  const accessToken = await getCAAccessToken();

  const infoData = {
    keys: {
      drawer: "External Staging",
      field1: caseUUID,
      field2: null,
      field3: "E-APP",
      field4: null,
      field5: "TELE_SIG_DEC",
      documentType: "Telephonic Signature Declaration",
      notes: null,
      customKeys: [
        { name: "E-Application Number", value: caseNumber },
        { name: "County Code", value: "19" },
        { name: "Document Type", value: "Authorized Rep and Release of Info" },
        { name: "Capture Information", value: "Telephonic Signature" },
        { name: "Time Sensitive", value: "false" }
      ]
    }
  };

  form.append('info', JSON.stringify(infoData));
  form.append('file', fs.createReadStream(filePath));

  const config = {
    method: 'post',
    maxBodyLength: Infinity,
    url: CASTOREURL,
    headers: {
      'Authorization': 'Bearer ' + accessToken.access_token,
      ...form.getHeaders()
    },
    data: form
  };

  try {
    logger.info('Uploading file to CalSAWS', { filePath, caseNumber });
    const response = await axios.request(config);
    logger.info('File uploaded successfully', { status: response.status, data: response.data });
    return response.data;

  } catch (error) {
    logger.error('File upload failed', {
      error: error.message,
      status: error.response?.status,
      responseData: error.response?.data
    });
    if (taskId) await updateAgentFields(taskId, { status: 3, statusMessage: `File upload failed: ${error.message}` });
    throw error;
  }
}

module.exports = { proccessRecording };
