/**
 * Native JavaScript Audio Converter (FFmpeg Alternative)
 * Uses pure JavaScript libraries for audio conversion in Lambda
 */

const fs = require('fs');
const path = require('path');
const logger = require('../../../log.js');

// Safe import of lamejs
let lamejs = null;
try {
    lamejs = require('lamejs');
} catch (error) {
    logger.warn('lamejs not available - native conversion disabled');
}

/**
 * Convert WAV buffer to MP3 using pure JavaScript
 * @param {Buffer} wavBuffer - Input WAV file buffer
 * @param {Object} options - Conversion options
 * @returns {Promise<Buffer>} - MP3 buffer
 */
async function convertWavToMp3Native(wavBuffer, options = {}) {
    try {
        // Check if lamejs is available
        if (!lamejs) {
            throw new Error('lamejs library not available');
        }

        logger.info('Starting native JavaScript WAV to MP3 conversion...');

        const {
            sampleRate = 44100,
            channels = 1,
            bitRate = 128
        } = options;

        // Parse WAV header to get audio data
        const wavData = parseWavBuffer(wavBuffer);

        // Use detected or provided parameters
        const finalChannels = wavData.channels || channels;
        const finalSampleRate = wavData.sampleRate || sampleRate;

        // Initialize LAME MP3 encoder
        const mp3encoder = new lamejs.Mp3Encoder(finalChannels, finalSampleRate, bitRate);

        // Convert PCM data to MP3
        const mp3Data = [];
        const samples = new Int16Array(wavData.audioData.buffer, wavData.audioData.byteOffset, wavData.audioData.length / 2);

        // Process in chunks for better performance
        const chunkSize = 1152; // Standard MP3 frame size
        for (let i = 0; i < samples.length; i += chunkSize) {
            const chunk = samples.slice(i, i + chunkSize);
            let mp3buf;

            if (wavData.channels === 1) {
                // Mono
                mp3buf = mp3encoder.encodeBuffer(chunk);
            } else {
                // Stereo - separate left and right channels
                const left = new Int16Array(chunk.length / 2);
                const right = new Int16Array(chunk.length / 2);

                for (let j = 0; j < chunk.length; j += 2) {
                    left[j / 2] = chunk[j];
                    right[j / 2] = chunk[j + 1];
                }

                mp3buf = mp3encoder.encodeBuffer(left, right);
            }

            if (mp3buf.length > 0) {
                mp3Data.push(mp3buf);
            }
        }

        // Finish encoding
        const finalMp3buf = mp3encoder.flush();
        if (finalMp3buf.length > 0) {
            mp3Data.push(finalMp3buf);
        }

        // Combine all MP3 chunks
        const totalLength = mp3Data.reduce((sum, chunk) => sum + chunk.length, 0);
        const result = new Uint8Array(totalLength);
        let offset = 0;

        for (const chunk of mp3Data) {
            result.set(chunk, offset);
            offset += chunk.length;
        }

        logger.info(`Native conversion completed: ${wavBuffer.length} bytes WAV -> ${result.length} bytes MP3`);
        return Buffer.from(result);

    } catch (error) {
        logger.error('Native WAV to MP3 conversion failed', { error: error.message });
        throw new Error(`Native audio conversion failed: ${error.message}`);
    }
}

/**
 * Parse WAV file buffer to extract audio data and metadata
 * @param {Buffer} wavBuffer - WAV file buffer
 * @returns {Object} - Parsed WAV data
 */
function parseWavBuffer(wavBuffer) {
    try {
        // Verify WAV header
        if (wavBuffer.toString('ascii', 0, 4) !== 'RIFF') {
            throw new Error('Invalid WAV file: missing RIFF header');
        }

        if (wavBuffer.toString('ascii', 8, 12) !== 'WAVE') {
            throw new Error('Invalid WAV file: missing WAVE format');
        }

        // Find fmt chunk
        let offset = 12;
        let fmtChunk = null;
        let dataChunk = null;

        while (offset < wavBuffer.length) {
            const chunkId = wavBuffer.toString('ascii', offset, offset + 4);
            const chunkSize = wavBuffer.readUInt32LE(offset + 4);

            if (chunkId === 'fmt ') {
                fmtChunk = {
                    audioFormat: wavBuffer.readUInt16LE(offset + 8),
                    channels: wavBuffer.readUInt16LE(offset + 10),
                    sampleRate: wavBuffer.readUInt32LE(offset + 12),
                    byteRate: wavBuffer.readUInt32LE(offset + 16),
                    blockAlign: wavBuffer.readUInt16LE(offset + 20),
                    bitsPerSample: wavBuffer.readUInt16LE(offset + 22)
                };
            } else if (chunkId === 'data') {
                dataChunk = {
                    offset: offset + 8,
                    size: chunkSize
                };
                break; // Found data chunk, we're done
            }

            offset += 8 + chunkSize;
        }

        if (!fmtChunk || !dataChunk) {
            throw new Error('Invalid WAV file: missing fmt or data chunk');
        }

        // Extract audio data
        const audioData = wavBuffer.subarray(dataChunk.offset, dataChunk.offset + dataChunk.size);

        logger.debug('Parsed WAV file', {
            channels: fmtChunk.channels,
            sampleRate: fmtChunk.sampleRate,
            bitsPerSample: fmtChunk.bitsPerSample,
            audioDataSize: audioData.length
        });

        return {
            channels: fmtChunk.channels,
            sampleRate: fmtChunk.sampleRate,
            bitsPerSample: fmtChunk.bitsPerSample,
            audioData: audioData
        };

    } catch (error) {
        logger.error('Failed to parse WAV buffer', { error: error.message });
        throw error;
    }
}

/**
 * Convert WAV file to MP3 file using native JavaScript
 * @param {string} inputPath - Path to input WAV file
 * @param {string} outputPath - Path to output MP3 file
 * @param {Object} options - Conversion options
 * @returns {Promise<void>}
 */
async function convertWavFileToMp3(inputPath, outputPath, options = {}) {
    try {
        logger.info(`Converting WAV file to MP3: ${inputPath} -> ${outputPath}`);

        // Read WAV file
        const wavBuffer = fs.readFileSync(inputPath);

        // Convert to MP3
        const mp3Buffer = await convertWavToMp3Native(wavBuffer, options);

        // Write MP3 file
        fs.writeFileSync(outputPath, mp3Buffer);

        logger.info(`Native conversion completed successfully`);

    } catch (error) {
        logger.error('File conversion failed', { error: error.message, inputPath, outputPath });
        throw error;
    }
}

/**
 * Check if native audio conversion is available
 * @returns {boolean}
 */
function isNativeConversionAvailable() {
    return lamejs !== null;
}

module.exports = {
    convertWavToMp3Native,
    convertWavFileToMp3,
    parseWavBuffer,
    isNativeConversionAvailable
};