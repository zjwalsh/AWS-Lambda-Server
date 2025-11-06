const axios = require("axios");
const { getWXAccessToken } = require('./wxccTokenService.js')
const {getMetadata} =  require('../db/agentsDb.js')

const { getCAToken } = require('./caTokenService.js')
const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const FormData = require('form-data');
var logger=require('../../../log.js');
var curModual = " - processRecordings.js - "

//download file from Webex
const proccessRecording = async (payload) => {

  logger.debug('  - get Capture WAV...');
  let [wavUrl,fileName] = await getCapture(payload)

  if (wavUrl === undefined || wavURL === null)  {
    return 
  }

  const wavPath = path.join(__dirname, '../../../recordingWav/' + fileName)
  logger.info('Downloading WAV', { fileName, destination: wavPath });
  await downloadFile(wavUrl, wavPath);

      // Verify file exists after download
  if (fs.existsSync(wavPath)) {
      const stats = fs.statSync(wavPath);
      logger.info('WAV file downloaded successfully', {
        path: wavPath,
        size: stats.size,
        exists: true
      });
  } else {
      logger.error('WAV file does not exist after download!', { path: wavPath });
      throw new Error('Downloaded file not found');
  }

  const mp3Path = path.join(__dirname, '../../../recordingMP3/' + fileName )
  logger.debug('  - Converting to MP3...');
  await convertWavToMp3(wavPath, mp3Path);

  logger.debug('  - Get metaData from Db for taskId - ' + payload.data.taskId + '...');
  let metaData = await getDbMetadata(payload.data.taskId)

  logger.debug('  - Get case UUID from CalSaws for taskId - ' + metaData.dataValues.caseNumber + '...');
  let caseUUID = await await getCaseUUID(metaData.dataValues.caseNumber)

  logger.debug('  - Uploading MP3...');
  await uploadFile(mp3Path, metaData, caseUUID);
  logger.debug('  - Done!');

  fs.unlinkSync(wavPath);
  fs.unlinkSync(mp3Path);

}

// Get captures information from Webex.
async function getCapture(payload) {
  logger.info(curModual + "Get Capture for taskId - " + payload.data.taskId);


  const accessToken = await getWXAccessToken();
  //first get file location from WXCC captures API
  let data = {
    query: {
      orgId: WXCLIENT_ORGID,
      urlExpiration: 300,
      taskIds: [
        payload.data.taskId
      ],
      includeSegments: true
    }
  };
  let config = {
    method: 'post',
    maxBodyLength: Infinity,
    url: payload.data.filePath,
    headers: {
      'Authorization': 'Bearer ' + accessToken.access_token,
      'Content-Type': 'application/json'
    },
    data: data
  };

  try {
    logger.debug(curModual + "Get - Recording info for TaskId - " + payload.taskId + " - Request- " + JSON.stringify(config));
    const axiosResponseOrData = await axios.request(config)
    // Parse JSON if it's a string
    // Parse if string
    jsonResponse = axiosResponseOrData.data ? axiosResponseOrData.data : axiosResponseOrData;

    logger.info('Processing recordings', {
      type: typeof jsonResponse,
      keys: jsonResponse ? Object.keys(jsonResponse) : 'null/undefined',
      hasData: !!jsonResponse.data,
      hasMeta: !!jsonResponse.meta
    });

    // Parse if string
    const parsedData = typeof jsonResponse === 'string' ? JSON.parse(jsonResponse) : jsonResponse;

    if (!parsedData || !parsedData.data || !Array.isArray(parsedData.data)) {
      logger.error('Invalid structure', {
        hasParsedData: !!parsedData,
        hasData: !!parsedData?.data,
        isDataArray: Array.isArray(parsedData?.data),
        parsedDataKeys: parsedData ? Object.keys(parsedData) : 'null'
      });
      throw new Error('Invalid JSON response structure');
    }

    const recordings = parsedData.data[0].recording;

    if (!recordings || !Array.isArray(recordings)) {
      logger.error('Recordings not found or not an array');
      throw new Error('Invalid recording structure');
    }

    logger.info('Found recordings', {
      totalCount: recordings.length,
      recordings: recordings.map(r => ({
        id: r.id,
        segment: r.segment,
        fileName: r.attributes?.fileName
      }))
    });
  await axios.request(config)
  .then((response) => {
    console.log(JSON.stringify(response.data));
  })
  .catch((error) => {
    console.log(error);
  });
    const segmentRecordings = recordings.filter(rec => rec.segment === true);

    logger.info('Filtered segment recordings', {
      totalRecordings: recordings.length,
      segmentRecordings: segmentRecordings.length
    });

    // Verify there are exactly 3 segment recordings
    if (segmentRecordings.length !== 3) {
      logger.error('Invalid number of segment recordings', {
        expected: 3,
        actual: segmentRecordings.length
      });
      throw new Error(`Expected 3 segment recordings, but found ${segmentRecordings.length}`);
    }

    // Process only the SECOND recording (index 1)
    const recording = segmentRecordings[1];
    const wavUrl = recording.attributes.filePath;
    const fileName = recording.attributes.fileName;
    const wavPath = `./temp_${fileName}`;
    const mp3Path = wavPath.replace('.wav', '.mp3');

    logger.info('Processing second recording', {
      id: recording.id,
      fileName: fileName,
      startTime: recording.attributes.startTime,
      stopTime: recording.attributes.stopTime
    });
    return [wavUrl,fileName];
    
  } catch (error) {
    logger.error('Error processing recording', {
      fileName: fileName,
      error: error.message,
      stack: error.stack
    });

    // Cleanup on error
    if (fs.existsSync(wavPath)) fs.unlinkSync(wavPath);
    if (fs.existsSync(mp3Path)) fs.unlinkSync(mp3Path);

    throw error;
  }
}


async function downloadFile(url, outputPath) {
logger.info('Starting download', { url, outputPath });
  
  try {
    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'stream',
      timeout: 30000, // 30 second timeout
      maxRedirects: 5
    });
    
    logger.info('Download response received', {
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers['content-type'],
      contentLength: response.headers['content-length']
    });
    
    const writer = fs.createWriteStream(outputPath);
    
    // Track progress
    let downloadedBytes = 0;
    response.data.on('data', (chunk) => {
      downloadedBytes += chunk.length;
    });
    
    response.data.pipe(writer);
    
    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        logger.info('Download completed', { 
          outputPath,
          downloadedBytes,
          fileExists: fs.existsSync(outputPath),
          fileSize: fs.existsSync(outputPath) ? fs.statSync(outputPath).size : 0
        });
        resolve();
      });
      
      writer.on('error', (err) => {
        logger.error('Writer error', { 
          error: err.message,
          outputPath 
        });
        reject(err);
      });
      
      response.data.on('error', (err) => {
        logger.error('Stream error', { 
          error: err.message,
          url 
        });
        reject(err);
      });
    });
    
  } catch (error) {
    logger.error('Download failed', {
      error: error.message,
      code: error.code,
      response: error.response?.status,
      url: url
    });
    throw error;
  }
}

async function convertWavToMp3(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .toFormat('mp3')
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .save(outputPath);
  });
}

async function getDbMetadata(taskId) {
  let MetaData = getMetadata(taskId);
  return MetaData;

}

async function getCaseUUID(caseNumber) {

  const accessToken = await getCAToken();
  //first get file location from WXCC captures API
  const config = {
    method: 'post',
    maxBodyLength: Infinity,
    url: 'https://capi.calsaws.net/imaging-service/inbound/case',
    headers: { 
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Authorization': "Bearer " + accessToken.dataValues.access_token
    },
    data: {
      caseUID: "",
      caseNumber: caseNumber,
      countyCode: "19",
      userName: "CalSAWSServiceAcct"
    }
  };
  
  try {
    logger.info('Getting case UUID', { caseNumber});
    logger.debug('Request config', { 
      url: config.url,
      headers: config.headers,
      data: config.data // Log the object, not stringified
    });
    // Use retry logic - retry up to 3 times with exponential backoff
    const response = await axios(config);
    
    logger.info('Case UUID retrieved successfully', {
      caseNumber: caseNumber,
      caseUID: response.data?.caseUID
    });
    
    return response.data?.caseUID;
    
  } catch (error) {
    logger.error('Failed to get case UUID after retries', {
      caseNumber: caseNumber,
      error: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      responseData: error.response?.data
    });
    
    // Handle specific error codes
    if (error.response?.status === 503) {
      throw new Error('CalSAWS service is temporarily unavailable. Please try again later.');
    } else if (error.response?.status === 401 || error.response?.status === 403) {
      throw new Error('Authentication failed. Please check your API credentials.');
    } else if (error.response?.status >= 400 && error.response?.status < 500) {
      throw new Error(`Invalid request: ${error.response?.data?.message || error.message}`);
    }
    
    throw error;
  }

}

async function uploadFile(filePath, caseNumber, caseUUID) {
  const FormData = require('form-data');
  const form = new FormData();
  
  const accessToken = await getCAToken();
  
  // Build the info JSON structure
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
        {
          name: "E-Application Number",
          value: caseNumber
        },
        {
          name: "County Code",
          value: "19"
        },
        {
          name: "Document Type",
          value: "Authorized Rep and Release of Info"
        },
        {
          name: "Capture Information",
          value: "Telephonic Signature"
        },
        {
          name: "Time Sensitive",
          value: "false"
        }
      ]
    }
  };
  
  // Append info as JSON string
  form.append('info', JSON.stringify(infoData));
  
  // Append the file
  form.append('file', fs.createReadStream(filePath));
  
  const config = {
    method: 'post',
    maxBodyLength: Infinity,
    url: 'https://capi.calsaws.net/image/store', // Replace with actual host
    headers: {
      'Authorization': "Bearer " + accessToken.dataValues.access_token,
      ...form.getHeaders()
    },
    data: form
  };
  
  try {
    logger.info('Uploading file to CalSAWS', {
      filePath: filePath,
      caseNumber: caseNumber,
      countyCode: "19",
      url: config.url
    });
    
    const response = await axios.request(config);
    
    logger.info('File uploaded successfully', {
      status: response.status,
      data: response.data
    });
    
    return response.data;
    
  } catch (error) {
    logger.error('File upload failed', {
      error: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      responseData: error.response?.data
    });
    
    throw error;
  }
}

module.exports = { proccessRecording };