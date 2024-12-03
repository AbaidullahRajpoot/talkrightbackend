const EventEmitter = require('events');
const { Buffer } = require('node:buffer');
const fetch = require('node-fetch');
const { AudioMixerService } = require('./audio-mixer-service');

class TextToSpeechService extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.config.voiceId ||= process.env.VOICE_ID;
    this.nextExpectedIndex = 0;
    this.speechBuffer = {};
    this.audioMixer = new AudioMixerService();
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
       // Mix the speech with background music
       const mixedAudio = this.audioMixer.mixAudioWithBackground(speechAudio);
       this.emit('speech', 0, mixedAudio.toString('base64'), partialResponse, interactionCount);
      // this.emit('speech', 0, Buffer.from(audioArrayBuffer).toString('base64'), partialResponse, interactionCount);
    } catch (err) {
      console.error('Error occurred in TextToSpeech service');
      console.error(err);
    }
  }
}

module.exports = { TextToSpeechService };
