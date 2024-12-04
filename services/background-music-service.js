const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');

class BackgroundMusicService extends EventEmitter {
  constructor() {
    super();
    this.backgroundAudio = null;
    this.isPlaying = false;
    this.maxDuration = 3600000; // 1 hour maximum
    this.startTime = null;
  }

  async loadBackgroundAudio() {
    try {
      const audioPath = path.join(__dirname, '../audio/ambient-noise.mp3');
      this.backgroundAudio = await fs.readFile(audioPath);
      console.log('Background audio loaded successfully');
    } catch (err) {
      console.error('Error loading background audio:', err);
    }
  }

  async start() {
    if (!this.backgroundAudio) {
      await this.loadBackgroundAudio();
    }

    if (this.isPlaying || !this.backgroundAudio) return;
    
    this.isPlaying = true;
    this.startLoop();
  }

  stop() {
    this.isPlaying = false;
  }

  startLoop() {
    if (!this.isPlaying) return;
    
    if (!this.startTime) {
      this.startTime = Date.now();
    } else if (Date.now() - this.startTime > this.maxDuration) {
      this.stop();
      return;
    }

    const audio = Buffer.from(this.backgroundAudio).toString('base64');
    this.emit('audio', audio);

    const duration = (this.backgroundAudio.length / 8000) * 1000;
    setTimeout(() => this.startLoop(), duration - 50);
  }

  cleanup() {
    this.stop();
    this.backgroundAudio = null;
    this.removeAllListeners();
  }
}

module.exports = BackgroundMusicService; 