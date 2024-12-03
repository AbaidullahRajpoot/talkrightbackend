const { Buffer } = require('node:buffer');
const fs = require('fs');
const path = require('path');

class AudioMixerService {
  constructor() {
    // Read and cache the background music file
    const bgMusicPath = path.join(__dirname, './background.mp3');
    this.backgroundMusic = fs.readFileSync(bgMusicPath);
  }

  mixAudioWithBackground(speechAudio) {
    // For now, we'll just concatenate the audio
    // In a production environment, you'd want to properly mix the audio streams
    return Buffer.concat([this.backgroundMusic, Buffer.from(speechAudio, 'base64')]);
  }
}

module.exports = { AudioMixerService }; 