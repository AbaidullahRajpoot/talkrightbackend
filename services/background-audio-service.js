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
      // Load background audio file (should be in ulaw_8000 format)
      const audioPath = path.join(__dirname, '../assets/background.raw');
      this.backgroundAudio = fs.readFileSync(audioPath);
    } catch (err) {
      console.error('Error loading background audio:', err);
      this.backgroundAudio = Buffer.alloc(8000); // 1 second of silence
    }
  }

  // Get the next chunk of background audio and mix it with call audio
  mixWithCallAudio(callAudio, chunkSize = 160) {
    if (!this.backgroundAudio) return callAudio;

    const mixed = Buffer.alloc(chunkSize);
    
    for (let i = 0; i < chunkSize; i++) {
      // Loop back to start if we reach the end of background audio
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

  // Original method kept for compatibility
  getBackgroundAudio() {
    return this.backgroundAudio;
  }
}

module.exports = { BackgroundAudioService }; 