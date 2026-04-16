/**
 * Audio converter using ffmpeg Lambda layer.
 * Handles Webex's 8kHz 8-bit µ-law (ulaw) WAV → MP3.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const logger = require('../../../log.js');

const FFMPEG_PATH = process.env.FFMPEG_PATH || '/opt/bin/ffmpeg';

/**
 * Convert a WAV file to MP3 using ffmpeg.
 * Works with any WAV encoding including 8-bit µ-law from Webex.
 *
 * @param {string} inputPath  - Source WAV file path
 * @param {string} outputPath - Destination MP3 file path
 * @param {Object} options    - { targetSampleRate, targetChannels }
 */
async function convertWavFileToMp3(inputPath, outputPath, options = {}) {
    const {
        targetSampleRate = 8000,
        targetChannels = 1
    } = options;

    logger.info('Converting WAV to MP3 via ffmpeg', { inputPath, outputPath, targetSampleRate, targetChannels });

    if (!fs.existsSync(inputPath)) {
        throw new Error(`Input file not found: ${inputPath}`);
    }

    // -y        overwrite output without prompting
    // -i        input file
    // -ac       output channels (1 = mono)
    // -ar       output sample rate
    // -b:a 32k  bitrate suitable for voice
    // -loglevel error  suppress ffmpeg banner noise in logs
    const cmd = `"${FFMPEG_PATH}" -y -i "${inputPath}" -ac ${targetChannels} -ar ${targetSampleRate} -b:a 32k -loglevel error "${outputPath}"`;

    try {
        execSync(cmd, { stdio: 'pipe' });
    } catch (err) {
        const stderr = err.stderr ? err.stderr.toString() : err.message;
        logger.error('ffmpeg conversion failed', { cmd, stderr });
        throw new Error(`ffmpeg conversion failed: ${stderr}`);
    }

    if (!fs.existsSync(outputPath)) {
        throw new Error('ffmpeg ran but output file was not created');
    }

    const size = fs.statSync(outputPath).size;
    if (size === 0) {
        throw new Error('ffmpeg produced an empty output file');
    }

    logger.info('MP3 conversion complete', { outputPath, size });
}

function isNativeConversionAvailable() {
    try {
        execSync(`"${FFMPEG_PATH}" -version`, { stdio: 'pipe' });
        return true;
    } catch {
        logger.warn('ffmpeg not found at ' + FFMPEG_PATH);
        return false;
    }
}

module.exports = { convertWavFileToMp3, isNativeConversionAvailable };
