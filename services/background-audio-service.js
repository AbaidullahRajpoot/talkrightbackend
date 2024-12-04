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
    this.chunkSize = 640;
    this.loadAudioFile();
    this.hasError = false;
  }

  loadAudioFile() {
    try {
      const audioPath = path.join(__dirname, '../assets/background-music.raw');
      this.audioBuffer = fs.readFileSync(audioPath);
      this.hasError = false;
      this.emit('audioLoaded');
    } catch (error) {
      console.error('Error loading background music:', error);
      this.hasError = true;
      this.emit('error', 'Failed to load audio file');
    }
  }

  start() {
    if (!this.audioBuffer) {
      this.emit('error', 'No audio buffer available');
      return;
    }
    this.isPlaying = true;
    this.streamAudio();
    this.emit('started');
  }

  stop() {
    this.isPlaying = false;
    this.currentPosition = 0;
  }

  streamAudio() {
    if (!this.isPlaying || !this.audioBuffer) {
      this.emit('stopped');
      return;
    }

    const chunk = this.audioBuffer.slice(
      this.currentPosition,
      this.currentPosition + this.chunkSize
    );

    if (chunk.length > 0) {
      this.currentPosition += this.chunkSize;
      if (this.currentPosition >= this.audioBuffer.length) {
        this.currentPosition = 0;
        this.emit('looped');
      }
      
      this.emit('audio', chunk.toString('base64'));
      
      setTimeout(() => this.streamAudio(), 20);
    } else {
      this.emit('error', 'Invalid audio chunk');
    }
  }

  setVolume(volume) {
    // Implement volume control if needed
    // This would require manipulating the audio buffer values
  }
}

module.exports = { BackgroundAudioService }; 