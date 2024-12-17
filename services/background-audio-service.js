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
    this.chunkSize = 640; // 8kHz ulaw audio chunks
    this.volume = 0.02; // 2% default volume
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
    if (!this.audioBuffer) return;
    this.isPlaying = true;
    this.streamAudio();
  }

  stop() {
    this.isPlaying = false;
  }

  setVolume(volume) {
    // Volume between 0 and 1
    this.volume = Math.max(0, Math.min(1, volume));
  }

  adjustVolumeForSpeech(isSpeaking) {
    // Lower volume during speech
    this.setVolume(isSpeaking ? 0.01 : 0.03);
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
      
      if (this.streamService) {
        const adjustedChunk = Buffer.alloc(chunk.length);
        for (let i = 0; i < chunk.length; i++) {
          adjustedChunk[i] = Math.floor(chunk[i] * this.volume);
        }
        this.streamService.buffer(null, adjustedChunk.toString('base64'));
      }
      
      setTimeout(() => this.streamAudio(), 20);
    }
  }
}

module.exports = { BackgroundAudioService }; 