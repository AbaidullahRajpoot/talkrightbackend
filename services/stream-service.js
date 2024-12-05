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
    this.musicVolume = 0.1; // 10% volume for background music
    this.loadBackgroundMusic();
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

  mixAudioWithBackground(audioBuffer) {
    if (!this.backgroundMusic) return audioBuffer;

    const mixed = Buffer.alloc(audioBuffer.length);
    const decodedAudio = Buffer.from(audioBuffer, 'base64');

    for (let i = 0; i < decodedAudio.length; i++) {
      // Get background music sample
      const musicIndex = (this.musicPosition + i) % this.backgroundMusic.length;
      const musicSample = this.backgroundMusic[musicIndex] * this.musicVolume;
      
      // Mix with main audio
      mixed[i] = Math.min(255, Math.max(0, decodedAudio[i] + musicSample));
    }

    // Update music position
    this.musicPosition = (this.musicPosition + decodedAudio.length) % this.backgroundMusic.length;

    return mixed.toString('base64');
  }

  setStreamSid (streamSid) {
    this.streamSid = streamSid;
  }

  buffer(index, audio) {
    this.sendAudio(audio);
  }

  sendAudio (audio) {
    const mixedAudio = this.mixAudioWithBackground(audio);
    
    this.ws.send(
      JSON.stringify({
        streamSid: this.streamSid,
        event: 'media',
        media: {
          payload: mixedAudio,
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

module.exports = {StreamService};