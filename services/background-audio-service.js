const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

class BackgroundAudioService extends EventEmitter {
  constructor(ws) {
    super();
    this.ws = ws;
    this.isPlaying = false;
    this.audioPath = path.join(__dirname, '../assets/background-music.raw'); // Raw audio file
    this.streamInterval = null;
    this.chunkSize = 640; // Standard chunk size for 20ms of 16-bit PCM audio at 16kHz
  }

  start() {
    if (this.isPlaying) return;
    this.isPlaying = true;
    
    try {
      const audioBuffer = fs.readFileSync(this.audioPath);
      let offset = 0;

      this.streamInterval = setInterval(() => {
        if (!this.isPlaying) return;

        // Get the next chunk of audio
        const chunk = audioBuffer.slice(offset, offset + this.chunkSize);
        offset += this.chunkSize;

        // Reset offset if we've reached the end of the file
        if (offset >= audioBuffer.length) {
          offset = 0;
        }

        // Send the chunk to Twilio
        if (chunk.length > 0) {
          this.ws.send(JSON.stringify({
            event: 'media',
            media: {
              payload: chunk.toString('base64')
            }
          }));
        }
      }, 20); // Send every 20ms to match audio chunk timing
    } catch (error) {
      console.error('Error starting background audio:', error);
    }
  }

  stop() {
    this.isPlaying = false;
    if (this.streamInterval) {
      clearInterval(this.streamInterval);
      this.streamInterval = null;
    }
  }
}

module.exports = { BackgroundAudioService }; 