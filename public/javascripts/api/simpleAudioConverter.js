/**
 * Audio converter - pure JavaScript, no native binaries required.
 * Handles Webex's 8kHz 8-bit µ-law (ulaw) WAV → MP3 using lamejs.
 */

const fs = require('fs');
const lamejs = require('lamejs');
const logger = require('../../../log.js');

// ITU-T G.711 µ-law decode: 8-bit ulaw sample → 16-bit linear PCM
function ulawToLinear(ulawByte) {
    ulawByte = ~ulawByte & 0xFF;
    const sign     = ulawByte & 0x80;
    const exponent = (ulawByte >> 4) & 0x07;
    const mantissa = ulawByte & 0x0F;
    let sample = ((mantissa << 3) + 132) << exponent;
    sample -= 132;
    return sign ? -sample : sample;
}

/**
 * Parse WAV header and return audio metadata + raw sample data.
 */
function parseWav(buffer) {
    if (buffer.toString('ascii', 0, 4) !== 'RIFF' ||
        buffer.toString('ascii', 8, 12) !== 'WAVE') {
        throw new Error('Not a valid WAV file');
    }

    let offset = 12;
    let audioFormat, channels, sampleRate, bitsPerSample;
    let dataOffset, dataSize;

    while (offset < buffer.length - 8) {
        const chunkId   = buffer.toString('ascii', offset, offset + 4);
        const chunkSize = buffer.readUInt32LE(offset + 4);

        if (chunkId === 'fmt ') {
            audioFormat  = buffer.readUInt16LE(offset + 8);  // 1=PCM, 7=ulaw
            channels     = buffer.readUInt16LE(offset + 10);
            sampleRate   = buffer.readUInt32LE(offset + 12);
            bitsPerSample = buffer.readUInt16LE(offset + 22);
        } else if (chunkId === 'data') {
            dataOffset = offset + 8;
            dataSize   = chunkSize;
            break;
        }

        offset += 8 + chunkSize + (chunkSize % 2); // pad odd-size chunks
    }

    if (!dataOffset) throw new Error('No data chunk found in WAV file');

    logger.info('WAV parsed', { audioFormat, channels, sampleRate, bitsPerSample, dataSize });

    return {
        audioFormat,   // 1 = PCM, 7 = µ-law
        channels,
        sampleRate,
        bitsPerSample,
        data: buffer.slice(dataOffset, dataOffset + dataSize)
    };
}

/**
 * Convert WAV file (PCM or µ-law) to MP3.
 *
 * @param {string} inputPath
 * @param {string} outputPath
 * @param {Object} options - { targetSampleRate, targetChannels }
 */
async function convertWavFileToMp3(inputPath, outputPath, options = {}) {
    const { targetSampleRate = 8000, targetChannels = 1 } = options;

    logger.info('Converting WAV to MP3', { inputPath, outputPath });

    const wavBuffer = fs.readFileSync(inputPath);
    const wav = parseWav(wavBuffer);

    // Decode samples to 16-bit PCM Int16Array
    let pcmSamples;

    if (wav.audioFormat === 7) {
        // µ-law encoded — decode each byte to 16-bit linear PCM
        logger.info('Decoding µ-law (ulaw) audio');
        pcmSamples = new Int16Array(wav.data.length);
        for (let i = 0; i < wav.data.length; i++) {
            pcmSamples[i] = ulawToLinear(wav.data[i]);
        }
    } else if (wav.audioFormat === 1 && wav.bitsPerSample === 16) {
        // Standard 16-bit PCM
        pcmSamples = new Int16Array(wav.data.buffer, wav.data.byteOffset, wav.data.length / 2);
    } else if (wav.audioFormat === 1 && wav.bitsPerSample === 8) {
        // 8-bit unsigned PCM — convert to 16-bit signed
        pcmSamples = new Int16Array(wav.data.length);
        for (let i = 0; i < wav.data.length; i++) {
            pcmSamples[i] = (wav.data[i] - 128) * 256;
        }
    } else {
        throw new Error(`Unsupported WAV format: audioFormat=${wav.audioFormat} bitsPerSample=${wav.bitsPerSample}`);
    }

    // Encode to MP3 using lamejs
    const mp3encoder = new lamejs.Mp3Encoder(targetChannels, targetSampleRate, 32);
    const mp3chunks  = [];
    const frameSize  = 1152; // lamejs frame size

    for (let i = 0; i < pcmSamples.length; i += frameSize) {
        const frame  = pcmSamples.subarray(i, i + frameSize);
        const encoded = mp3encoder.encodeBuffer(frame);
        if (encoded.length > 0) mp3chunks.push(Buffer.from(encoded));
    }

    const flushed = mp3encoder.flush();
    if (flushed.length > 0) mp3chunks.push(Buffer.from(flushed));

    const mp3Buffer = Buffer.concat(mp3chunks);

    if (mp3Buffer.length === 0) throw new Error('MP3 encoder produced empty output');

    fs.writeFileSync(outputPath, mp3Buffer);
    logger.info('MP3 conversion complete', { outputPath, size: mp3Buffer.length });
}

function isNativeConversionAvailable() {
    return true; // Pure JS — always available
}

module.exports = { convertWavFileToMp3, isNativeConversionAvailable };
