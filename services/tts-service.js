const EventEmitter = require('events');
const { Buffer } = require('node:buffer');
const fetch = require('node-fetch');
const fs = require('fs').promises;
const path = require('path');

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
      console.log('loading background audio');
      const audioPath = path.join(__dirname, '../assets/background.mp3');
      this.backgroundAudio = await fs.readFile(audioPath);
    } catch (err) {
      console.error('Error loading background audio:', err);
    }
  }

  mixAudio(speechBuffer) {
    console.log('mixing audio');
    const speech = Buffer.isBuffer(speechBuffer) ? speechBuffer : Buffer.from(speechBuffer, 'base64');
    const background = this.backgroundAudio;

    const mixedBuffer = Buffer.alloc(speech.length);

    for (let i = 0; i < speech.length; i++) {
      const speechSample = speech[i] * 0.98;
      const backgroundSample = background[i % background.length] * 0.02;
      mixedBuffer[i] = Math.min(255, Math.max(0, speechSample + backgroundSample));
    }

    return mixedBuffer.toString('base64');
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

      let finalAudio;
      if (this.backgroundAudio) {
        finalAudio = this.mixAudio(speechAudio, this.backgroundAudio);
      } else {
        finalAudio = speechAudio.toString('base64');
      }

      this.emit('speech', 0, finalAudio, partialResponse, interactionCount);
    } catch (err) {
      console.error('Error occurred in TextToSpeech service');
      console.error(err);
    }
  }
}

module.exports = { TextToSpeechService };
