const fs = require('fs');
const path = require('path');

class BackgroundAudioService {
  constructor() {
    this.backgroundAudio = null;
    this.currentPosition = 0;
    this.loadBackgroundAudio();
  }

  loadBackgroundAudio() {
    try {
      const audioPath = path.join(__dirname, '../assets/background.raw');
      if (fs.existsSync(audioPath)) {
        this.backgroundAudio = fs.readFileSync(audioPath);
        console.log('Background audio loaded successfully');
      } else {
        console.log('No background audio file found, using silence');
        this.backgroundAudio = Buffer.alloc(8000); // 1 second of silence
      }
    } catch (err) {
      console.error('Error loading background audio:', err);
      this.backgroundAudio = Buffer.alloc(8000); // 1 second of silence
    }
  }

  mixWithCallAudio(callAudio, chunkSize = 160) {
    if (!this.backgroundAudio) return callAudio;

    const mixed = Buffer.alloc(chunkSize);
    
    for (let i = 0; i < chunkSize; i++) {
      if (this.currentPosition >= this.backgroundAudio.length) {
        this.currentPosition = 0;
      }
      
      // Mix background audio at 30% volume with call audio
      const backgroundSample = this.backgroundAudio[this.currentPosition] * 0.3;
      const callSample = callAudio[i];
      mixed[i] = Math.min(255, Math.max(0, Math.floor(backgroundSample + callSample)));
      
      this.currentPosition++;
    }

    return mixed;
  }
}

module.exports = { BackgroundAudioService }; 