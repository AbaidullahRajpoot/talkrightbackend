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
    this.volume = 0.1; // Default volume (30%)
    this.loadAudioFile();
  }

  loadAudioFile() {
    try {
      // Load your background music file (should be in ulaw 8kHz format)
      const audioPath = path.join(__dirname, '../assets/background-music.raw');
      this.audioBuffer = fs.readFileSync(audioPath);
      console.log('Background music loaded successfully');
    } catch (error) {
      console.error('Error loading background music:', error);
    }
  }

  start() {
    if (!this.audioBuffer) return;
    this.isPlaying = true;
    this.streamAudio();
    console.log('Background music started');
  }

  stop() {
    this.isPlaying = false;
    this.currentPosition = 0;
    console.log('Background music stopped');
  }

  setVolume(volume) {
    // Volume should be between 0 and 1
    this.volume = Math.max(0, Math.min(1, volume));
    console.log(`Background music volume set to ${this.volume * 100}%`);
  }

  adjustAudioVolume(buffer) {
    // Create a new buffer for the volume-adjusted audio
    const adjustedBuffer = Buffer.alloc(buffer.length);
    
    for (let i = 0; i < buffer.length; i++) {
      // Apply volume adjustment to each sample
      adjustedBuffer[i] = Math.floor(buffer[i] * this.volume);
    }
    
    return adjustedBuffer;
  }

  streamAudio() {
    if (!this.isPlaying || !this.audioBuffer) return;

    const chunk = this.audioBuffer.slice(
      this.currentPosition,
      this.currentPosition + this.chunkSize
    );

    if (chunk.length > 0) {
      // Adjust volume of the chunk
      const adjustedChunk = this.adjustAudioVolume(chunk);
      
      // Update position and loop if necessary
      this.currentPosition += this.chunkSize;
      if (this.currentPosition >= this.audioBuffer.length) {
        this.currentPosition = 0; // Loop the audio
      }
      
      // Emit the audio chunk
      this.emit('audio', adjustedChunk.toString('base64'));
      
      // Schedule next chunk (20ms for 8kHz audio)
      setTimeout(() => this.streamAudio(), 20);
    }
  }
}

module.exports = { BackgroundAudioService }; 