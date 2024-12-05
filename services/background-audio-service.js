const EventEmitter = require('events');
const { Buffer } = require('node:buffer');
const fs = require('fs');
const path = require('path');

class BackgroundAudioService extends EventEmitter {
  constructor(streamService) {
    super();
    this.streamService = streamService;
    this.isPlaying = false;
    this.audioBuffer = null;
    this.currentPosition = 0;
    this.chunkSize = 640; // Standard size for 8kHz ulaw audio chunks
    this.volume = 0.05; // Reduce default volume to 5%
    this.loadAudioFile();
  }

  loadAudioFile() {
    try {
      const audioPath = path.join(__dirname, '../assets/background-music.raw');
      this.audioBuffer = fs.readFileSync(audioPath);
      console.log('Background music loaded successfully');
    } catch (error) {
      console.error('Error loading background music:', error);
    }
  }

  start() {
    if (!this.audioBuffer) {
      console.error('No audio buffer available');
      return;
    }
    this.isPlaying = true;
    this.streamAudio();
    console.log('Background music started');
  }

  stop() {
    this.isPlaying = false;
    console.log('Background music stopped');
  }

  streamAudio() {
    if (!this.isPlaying || !this.audioBuffer) return;

    const chunk = this.audioBuffer.slice(
      this.currentPosition,
      this.currentPosition + this.chunkSize
    );

    if (chunk.length > 0) {
      // Update position and loop if necessary
      this.currentPosition += this.chunkSize;
      if (this.currentPosition >= this.audioBuffer.length) {
        this.currentPosition = 0; // Loop the audio
        console.log('Background music looping');
      }
      
      if (this.streamService) {
        // Apply volume adjustment and convert to signed values
        const adjustedChunk = Buffer.alloc(chunk.length);
        for (let i = 0; i < chunk.length; i++) {
          // Convert μ-law to signed integer and apply volume
          const signed = (chunk[i] - 128) * this.volume;
          // Convert back to μ-law range (0-255)
          adjustedChunk[i] = Math.floor(signed + 128);
        }
        
        // Use a different stream ID for background music (1 instead of 0)
        this.streamService.buffer(1, adjustedChunk.toString('base64'));
      }
      
      // Increase interval to reduce audio density
      setTimeout(() => this.streamAudio(), 40); // Changed from 20ms to 40ms
    }
  }

  setVolume(volume) {
    // Volume should be between 0 and 1
    this.volume = Math.max(0, Math.min(1, volume));
    console.log(`Background music volume set to ${this.volume * 100}%`);
  }
}

module.exports = { BackgroundAudioService }; 