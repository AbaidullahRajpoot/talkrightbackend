const fs = require('fs');
const path = require('path');

class BackgroundAudioService {
  constructor() {
    this.backgroundAudio = null;
    this.currentPosition = 0;
    this.loadBackgroundAudio();
    console.log('Background audio size:', this.backgroundAudio?.length || 0, 'bytes');
  }

  loadBackgroundAudio() {
    try {
      const audioPath = path.join(__dirname, '../assets/background.wav');
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
      
      // Convert mu-law values to linear PCM
      const backgroundMulaw = this.backgroundAudio[this.currentPosition];
      const callMulaw = callAudio[i];
      
      // Mu-law to linear conversion (approximate)
      const backgroundLinear = (backgroundMulaw - 128) / 128;
      const callLinear = (callMulaw - 128) / 128;
      
      // Mix the audio (background at 30% volume)
      const mixedLinear = (backgroundLinear * 0.3) + callLinear;
      
      // Convert back to mu-law range (0-255)
      mixed[i] = Math.min(255, Math.max(0, Math.floor((mixedLinear * 128) + 128)));
      
      this.currentPosition++;
    }

    return mixed;
  }
}

module.exports = { BackgroundAudioService }; 