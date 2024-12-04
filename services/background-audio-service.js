const fs = require('fs');
const path = require('path');

class BackgroundAudioService {
  constructor() {
    this.backgroundAudio = null;
    this.loadBackgroundAudio();
  }

  loadBackgroundAudio() {
    try {
      // Load background audio file (should be in ulaw_8000 format)
      const audioPath = path.join(__dirname, '../assets/output.wav');
      this.backgroundAudio = fs.readFileSync(audioPath);
    } catch (err) {
      console.error('Error loading background audio:', err);
      this.backgroundAudio = Buffer.alloc(8000); // 1 second of silence
    }
  }

  getBackgroundAudio() {
    return this.backgroundAudio;
  }
}

module.exports = { BackgroundAudioService }; 