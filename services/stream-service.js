const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');
const uuid = require('uuid');

class StreamService extends EventEmitter {
  constructor(websocket) {
    super();
    this.ws = websocket;
    this.expectedAudioIndex = 0;
    this.audioBuffer = {};
    this.streamSid = '';
    this.backgroundMusic = null;
    this.musicPosition = 0;
    this.loadBackgroundMusic();
    this.startBackgroundMusic();
  }

  loadBackgroundMusic() {
    try {
      const musicPath = path.join(__dirname, '../assets/background-music.raw');
      this.backgroundMusic = fs.readFileSync(musicPath);
      console.log('Background music loaded successfully');
    } catch (error) {
      console.error('Error loading background music:', error);
    }
  }

  startBackgroundMusic() {
    if (!this.backgroundMusic) return;
    
    // Send a small chunk of background music every 20ms
    setInterval(() => {
      const chunkSize = 160; // Small chunk size for smooth playback
      const chunk = Buffer.alloc(chunkSize);
      
      // Copy music data to chunk with low volume (10%)
      for (let i = 0; i < chunkSize; i++) {
        const musicIndex = (this.musicPosition + i) % this.backgroundMusic.length;
        chunk[i] = this.backgroundMusic[musicIndex] * 0.1; // 10% volume
      }
      
      this.musicPosition = (this.musicPosition + chunkSize) % this.backgroundMusic.length;
      
      // Send background music chunk
      this.ws.send(JSON.stringify({
        streamSid: this.streamSid,
        event: 'media',
        media: {
          payload: chunk.toString('base64'),
        },
      }));
    }, 20); // 20ms interval for smooth playback
  }

  setStreamSid(streamSid) {
    this.streamSid = streamSid;
  }

  buffer(index, audio) {
    this.sendAudio(audio);
  }

  sendAudio(audio) {
    this.ws.send(
      JSON.stringify({
        streamSid: this.streamSid,
        event: 'media',
        media: {
          payload: audio,
        },
      })
    );

    const markLabel = uuid.v4();
    this.ws.send(
      JSON.stringify({
        streamSid: this.streamSid,
        event: 'mark',
        mark: {
          name: markLabel
        }
      })
    );
    this.emit('audiosent', markLabel);
  }
}

module.exports = { StreamService };