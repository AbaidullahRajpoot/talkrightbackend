const EventEmitter = require('events');
const { Buffer } = require('node:buffer');
const fetch = require('node-fetch');
const fs = require('fs').promises;
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const { Readable } = require('stream');

class TextToSpeechService extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.config.voiceId ||= process.env.VOICE_ID;
    this.nextExpectedIndex = 0;
    this.speechBuffer = {};
    this.backgroundAudio = null;
    this.loadBackgroundAudio();
  }

  async loadBackgroundAudio() {
    try {
      console.log('Loading background audio...');
      const audioPath = path.join(__dirname, '../assets/background.mp3');
      const mp3Buffer = await fs.readFile(audioPath);
      
      this.backgroundAudio = await this.convertAudioFormat(mp3Buffer);
      console.log('Background audio loaded and converted successfully:', this.backgroundAudio.length, 'bytes');
    } catch (err) {
      console.error('Error loading background audio:', err);
    }
  }

  convertAudioFormat(inputBuffer) {
    return new Promise((resolve, reject) => {
      const inputStream = new Readable();
      inputStream.push(inputBuffer);
      inputStream.push(null);

      let outputBuffer = [];

      ffmpeg(inputStream)
        .toFormat('wav')
        .audioChannels(1)
        .audioFrequency(8000)
        .audioCodec('pcm_mulaw')
        .on('error', (err) => {
          console.error('FFmpeg error:', err);
          reject(err);
        })
        .on('end', () => {
          resolve(Buffer.concat(outputBuffer));
        })
        .pipe()
        .on('data', (chunk) => {
          outputBuffer.push(chunk);
        });
    });
  }

  async generate(gptReply, interactionCount) {
    const { partialResponse } = gptReply;

    if (!partialResponse) { return; }

    try {
      const outputFormat = 'ulaw_8000';
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${this.config.voiceId}/stream?output_format=${outputFormat}`,
        {
          method: 'POST',
          headers: {
            'xi-api-key': process.env.XI_API_KEY,
            'Content-Type': 'application/json',
            accept: 'audio/wav',
          },
          body: JSON.stringify({
            text: partialResponse,
            model_id: "eleven_turbo_v2_5",
            voice_settings: {
              stability: 0.75,
              similarity_boost: 1.0
            }
          }),
        }
      );

      const audioArrayBuffer = await response.arrayBuffer();
      const speechAudio = Buffer.from(audioArrayBuffer);
      
      if (this.backgroundAudio) {
        const backgroundAudioBase64 = Buffer.from(this.backgroundAudio).toString('base64');
        this.emit('background', backgroundAudioBase64, 0.3);
      }
      
      this.emit('speech', 0, speechAudio.toString('base64'), partialResponse, interactionCount);
    } catch (err) {
      console.error('Error occurred in TextToSpeech service');
      console.error(err);
    }
  }

  startBackgroundLoop() {
    // This method can be removed if you want background audio only during speech
    // Or keep it if you want continuous background music
  }
}

module.exports = { TextToSpeechService };
