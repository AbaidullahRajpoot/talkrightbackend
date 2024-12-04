const EventEmitter = require('events');
const { Buffer } = require('node:buffer');
const fs = require('fs');
const path = require('path');

class BackgroundAudioService extends EventEmitter {
  constructor() {
    super();
    this.isPlaying = false;
    this.audioBuffer = null;
    this.currentPosition = 0;
    this.chunkSize = 640; // Standard size for 8kHz ulaw audio chunks
    this.loadAudioFile();
  }

  loadAudioFile() {
    try {
      // Load your background music file (should be in ulaw 8kHz format)
      const audioPath = path.join(__dirname, '../assets/background-music.raw');
      this.audioBuffer = fs.readFileSync(audioPath);
    } catch (error) {
      console.error('Error loading background music:', error);
    }
  }

  start() {
    if (!this.audioBuffer) return;
    this.isPlaying = true;
    this.streamAudio();
  }

  stop() {
    this.isPlaying = false;
    this.currentPosition = 0;
  }

  streamAudio() {
    if (!this.isPlaying || !this.audioBuffer) return;

    const chunk = this.audioBuffer.slice(
      this.currentPosition,
      this.currentPosition + this.chunkSize
    );

    if (chunk.length > 0) {
      this.currentPosition += this.chunkSize;
      if (this.currentPosition >= this.audioBuffer.length) {
        this.currentPosition = 0; // Loop the audio
      }
      
      this.emit('audio', chunk.toString('base64'));
      
      // Schedule next chunk (20ms for 8kHz audio)
      setTimeout(() => this.streamAudio(), 20);
    }
  }

  setVolume(volume) {
    // Implement volume control if needed
    // This would require manipulating the audio buffer values
  }
}

module.exports = { BackgroundAudioService }; 