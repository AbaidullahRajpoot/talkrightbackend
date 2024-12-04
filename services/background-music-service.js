const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');

class BackgroundMusicService extends EventEmitter {
  constructor() {
    super();
    this.backgroundAudio = null;
    this.isPlaying = false;
    this.nextLoopTimeout = null;
    this.retryCount = 0;
    this.maxRetries = 3;
  }

  async loadBackgroundAudio() {
    try {
      const audioPath = path.join(__dirname, '../assets/background.mp3');
      this.backgroundAudio = await fs.readFile(audioPath);
      console.log('Background audio loaded successfully');
      this.retryCount = 0;
    } catch (err) {
      console.error('Error loading background audio:', err);
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        console.log(`Retrying load (${this.retryCount}/${this.maxRetries})...`);
        setTimeout(() => this.loadBackgroundAudio(), 1000);
      }
    }
  }

  async start() {
    if (!this.backgroundAudio) {
      await this.loadBackgroundAudio();
    }

    if (this.isPlaying || !this.backgroundAudio) return;
    
    console.log('Starting background music loop');
    this.isPlaying = true;
    this.startLoop();
  }

  stop() {
    console.log('Stopping background music');
    this.isPlaying = false;
    if (this.nextLoopTimeout) {
      clearTimeout(this.nextLoopTimeout);
      this.nextLoopTimeout = null;
    }
  }

  startLoop() {
    if (!this.isPlaying || !this.backgroundAudio) return;

    try {
      const audio = Buffer.from(this.backgroundAudio).toString('base64');
      this.emit('audio', audio);

      // Calculate duration based on buffer length (8kHz sample rate)
      const duration = Math.floor((this.backgroundAudio.length / 8000) * 1000);
      
      // Schedule next loop slightly before the current one ends
      this.nextLoopTimeout = setTimeout(() => {
        this.startLoop();
      }, Math.max(duration - 50, 0));
    } catch (err) {
      console.error('Error in background music loop:', err);
      this.stop();
    }
  }

  cleanup() {
    this.stop();
    this.backgroundAudio = null;
    this.removeAllListeners();
  }
}

module.exports = BackgroundMusicService; 