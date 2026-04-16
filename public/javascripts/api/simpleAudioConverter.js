/**
 * Simple Native Audio Converter
 * Basic audio conversion without external dependencies
 */

const fs = require('fs');
const logger = require('../../../log.js');

/**
 * Convert WAV to a simpler format for web playback
 * Since pure JavaScript MP3 encoding is complex, we'll provide a fallback
 * @param {Buffer} wavBuffer - Input WAV buffer
 * @param {Object} options - Conversion options
 * @returns {Promise<Buffer>} - Converted audio buffer
 */
async function convertWavToMp3Native(wavBuffer, options = {}) {
    try {
        logger.info('Starting simplified native audio conversion...');

        // For now, we'll just validate and potentially resample the WAV
        // This is a fallback when FFmpeg is not available
        const wavData = parseSimpleWav(wavBuffer);

        logger.info(`Native conversion: ${wavBuffer.length} bytes WAV processed`, {
            sampleRate: wavData.sampleRate,
            channels: wavData.channels,
            duration: wavData.duration
        });

        // In a real scenario, you might:
        // 1. Return the WAV as-is for browsers that support it
        // 2. Apply basic audio processing (volume, filtering)
        // 3. Convert to a simpler format like OGG

        // For this demo, we'll return a processed version of the WAV
        // that's optimized for web playback
        return createOptimizedWav(wavData, options);

    } catch (error) {
        logger.error('Native audio conversion failed', { error: error.message });
        throw new Error(`Native audio conversion failed: ${error.message}`);
    }
}

/**
 * Parse WAV file to extract basic information
 * @param {Buffer} wavBuffer - WAV file buffer
 * @returns {Object} - WAV data information
 */
function parseSimpleWav(wavBuffer) {
    try {
        // Basic WAV validation
        if (wavBuffer.length < 44) {
            throw new Error('WAV file too small');
        }

        // Check RIFF header
        if (wavBuffer.toString('ascii', 0, 4) !== 'RIFF') {
            throw new Error('Not a valid WAV file - missing RIFF header');
        }

        if (wavBuffer.toString('ascii', 8, 12) !== 'WAVE') {
            throw new Error('Not a valid WAV file - missing WAVE format');
        }

        // Parse format chunk (assuming standard layout)
        const channels = wavBuffer.readUInt16LE(22);
        const sampleRate = wavBuffer.readUInt32LE(24);
        const bitsPerSample = wavBuffer.readUInt16LE(34);

        // Find data chunk - scan entire file with better error handling
        let dataOffset = 36;
        let dataSize = 0;
        let foundFmt = false;

        // Start after RIFF/WAVE header (12 bytes)
        let searchOffset = 12;
        
        logger.debug('Scanning WAV chunks', { fileSize: wavBuffer.length });

        // Look for fmt and data chunks
        while (searchOffset < wavBuffer.length - 8) {
            const chunkId = wavBuffer.toString('ascii', searchOffset, searchOffset + 4);
            const chunkSize = wavBuffer.readUInt32LE(searchOffset + 4);

            logger.debug('Found chunk', { 
                chunkId, 
                chunkSize, 
                offset: searchOffset,
                chunkIdHex: wavBuffer.slice(searchOffset, searchOffset + 4).toString('hex')
            });

            if (chunkId === 'fmt ') {
                foundFmt = true;
            }

            if (chunkId === 'data') {
                dataSize = chunkSize;
                dataOffset = searchOffset + 8;
                logger.info('Found data chunk', { dataSize, dataOffset });
                break;
            }

            // Move to next chunk - handle padding for odd-sized chunks
            const paddedSize = chunkSize + (chunkSize % 2);
            searchOffset += 8 + paddedSize;

            // Safety check to prevent infinite loops
            if (searchOffset >= wavBuffer.length || chunkSize === 0 || chunkSize > wavBuffer.length) {
                logger.warn('Stopping chunk scan', { searchOffset, chunkSize, bufferLength: wavBuffer.length });
                break;
            }
        }

        if (!foundFmt) {
            logger.warn('No fmt chunk found, using default values');
        }

        if (dataSize === 0) {
            // Last resort: assume everything after byte 44 is data
            logger.warn('No data chunk found, using entire file as audio data');
            dataOffset = 44;
            dataSize = wavBuffer.length - 44;
            
            if (dataSize <= 0) {
                throw new Error('No data chunk found in WAV file and file too small');
            }
        }

        const duration = dataSize / (sampleRate * channels * (bitsPerSample / 8));

        return {
            channels,
            sampleRate,
            bitsPerSample,
            dataOffset,
            dataSize,
            duration,
            rawData: wavBuffer.slice(dataOffset, dataOffset + dataSize)
        };

    } catch (error) {
        throw new Error(`WAV parsing failed: ${error.message}`);
    }
}

/**
 * Create an optimized WAV file for web playback
 * @param {Object} wavData - Parsed WAV data
 * @param {Object} options - Optimization options
 * @returns {Buffer} - Optimized WAV buffer
 */
function createOptimizedWav(wavData, options = {}) {
    try {
        const {
            targetSampleRate = 22050,
            targetChannels = 1,
            normalize = true
        } = options;

        // For simplicity, if the WAV is already in a good format, return it optimized
        let audioData = wavData.rawData;
        let { channels, sampleRate, bitsPerSample } = wavData;

        // Basic normalization if requested
        if (normalize && bitsPerSample === 16) {
            audioData = normalizeAudio16Bit(audioData);
        }

        // Create new WAV header with potentially different settings
        const bytesPerSample = Math.ceil(bitsPerSample / 8);
        const byteRate = sampleRate * channels * bytesPerSample;
        const blockAlign = channels * bytesPerSample;

        const header = Buffer.alloc(44);

        // RIFF header
        header.write('RIFF', 0);
        header.writeUInt32LE(36 + audioData.length, 4);
        header.write('WAVE', 8);

        // fmt chunk
        header.write('fmt ', 12);
        header.writeUInt32LE(16, 16); // PCM format chunk size
        header.writeUInt16LE(1, 20);  // Audio format (PCM)
        header.writeUInt16LE(channels, 22);
        header.writeUInt32LE(sampleRate, 24);
        header.writeUInt32LE(byteRate, 28);
        header.writeUInt16LE(blockAlign, 32);
        header.writeUInt16LE(bitsPerSample, 34);

        // data chunk
        header.write('data', 36);
        header.writeUInt32LE(audioData.length, 40);

        return Buffer.concat([header, audioData]);

    } catch (error) {
        throw new Error(`WAV optimization failed: ${error.message}`);
    }
}

/**
 * Normalize 16-bit audio data
 * @param {Buffer} audioData - Raw audio data
 * @returns {Buffer} - Normalized audio data
 */
function normalizeAudio16Bit(audioData) {
    try {
        const samples = new Int16Array(audioData.buffer, audioData.byteOffset, audioData.length / 2);

        // Find peak
        let peak = 0;
        for (let i = 0; i < samples.length; i++) {
            const abs = Math.abs(samples[i]);
            if (abs > peak) peak = abs;
        }

        if (peak === 0) return audioData; // Silent audio

        // Normalize to 90% of max to avoid clipping
        const normalizeRatio = (32767 * 0.9) / peak;

        if (normalizeRatio < 1.1) return audioData; // Already loud enough

        // Apply normalization
        const normalized = new Int16Array(samples.length);
        for (let i = 0; i < samples.length; i++) {
            normalized[i] = Math.round(samples[i] * normalizeRatio);
        }

        return Buffer.from(normalized.buffer);

    } catch (error) {
        logger.warn('Audio normalization failed, returning original', { error: error.message });
        return audioData;
    }
}

/**
 * Convert WAV file to optimized format
 * @param {string} inputPath - Input WAV file path
 * @param {string} outputPath - Output file path
 * @param {Object} options - Conversion options
 * @returns {Promise<void>}
 */
async function convertWavFileToMp3(inputPath, outputPath, options = {}) {
    try {
        logger.info(`Converting WAV file: ${inputPath} -> ${outputPath}`);

        const wavBuffer = fs.readFileSync(inputPath);
        const convertedBuffer = await convertWavToMp3Native(wavBuffer, options);

        fs.writeFileSync(outputPath, convertedBuffer);

        logger.info('Native file conversion completed successfully');

    } catch (error) {
        logger.error('File conversion failed', { error: error.message, inputPath, outputPath });
        throw error;
    }
}

/**
 * Check if native conversion is available
 * @returns {boolean}
 */
function isNativeConversionAvailable() {
    return true; // Always available since it's pure JavaScript
}

module.exports = {
    convertWavToMp3Native,
    convertWavFileToMp3,
    parseSimpleWav,
    isNativeConversionAvailable
};