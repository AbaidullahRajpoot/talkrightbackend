const fs = require('fs');
const path = require('path');

class BackgroundAudioService {
  constructor() {
    this.backgroundAudio = null;
    this.loadBackgroundAudio();
  }

  loadBackgroundAudio() {
    try {
      // Load background audio file (8000 Hz mono µ-law WAV format)
      const audioPath = path.join(__dirname, '../assets/output.wav');
      this.backgroundAudio = fs.readFileSync(audioPath);
    } catch (err) {
      console.error('Error loading background audio:', err);
      // Create 1 second of silence in 8000 Hz µ-law format
      this.backgroundAudio = Buffer.alloc(8000);
    }
  }

  getBackgroundAudio() {
    return this.backgroundAudio;
  }
}

module.exports = { BackgroundAudioService }; 