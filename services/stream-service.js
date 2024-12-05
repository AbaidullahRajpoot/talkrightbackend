const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');
const uuid = require('uuid');

class StreamService extends EventEmitter {
  constructor(websocket) {
    super();
    this.ws = websocket;
    this.streamSid = '';
    this.backgroundMusic = null;
    this.musicPosition = 0;
    this.isPlaying = false;
    this.loadBackgroundMusic();
  }

  loadBackgroundMusic() {
    try {
      const musicPath = path.join(__dirname, '../assets/background-music.raw');
      this.backgroundMusic = fs.readFileSync(musicPath);
      console.log('Background music loaded successfully');
      this.playBackgroundMusic();
    } catch (error) {
      console.error('Error loading background music:', error);
    }
  }

  playBackgroundMusic() {
    if (!this.backgroundMusic || this.isPlaying) return;
    
    this.isPlaying = true;
    const chunkSize = 640; // Standard size for 8kHz audio chunks
    const volume = 0.05; // 5% volume - adjust this value between 0 and 1

    const playNextChunk = () => {
      if (!this.isPlaying) return;

      // Get next chunk of music
      const chunk = Buffer.alloc(chunkSize);
      for (let i = 0; i < chunkSize; i++) {
        const musicIndex = (this.musicPosition + i) % this.backgroundMusic.length;
        chunk[i] = Math.floor(this.backgroundMusic[musicIndex] * volume);
      }
      
      this.musicPosition = (this.musicPosition + chunkSize) % this.backgroundMusic.length;

      // Send the chunk
      if (this.streamSid) {
        this.ws.send(JSON.stringify({
          streamSid: this.streamSid,
          event: 'media',
          media: {
            payload: chunk.toString('base64'),
          },
        }));
      }

      // Schedule next chunk (20ms for 8kHz audio)
      setTimeout(playNextChunk, 20);
    };

    playNextChunk();
  }

  stopBackgroundMusic() {
    this.isPlaying = false;
  }

  setStreamSid(streamSid) {
    this.streamSid = streamSid;
    if (this.streamSid && !this.isPlaying) {
      this.playBackgroundMusic();
    }
  }
}

module.exports = { StreamService };