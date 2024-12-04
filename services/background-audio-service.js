const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

class BackgroundAudioService extends EventEmitter {
  constructor(ws) {
    super();
    this.ws = ws;
    this.isPlaying = false;
    this.audioPath = path.join(__dirname, '../assets/background-music.mp3'); // Adjust path as needed
    this.streamInterval = null;
  }

  start() {
    if (this.isPlaying) return;
    this.isPlaying = true;
    
    try {
      const audioBuffer = fs.readFileSync(this.audioPath);
      
      // Stream audio in chunks
      this.streamInterval = setInterval(() => {
        if (this.isPlaying) {
          // Send audio chunks to Twilio's Media API
          // You'll need to implement the actual streaming logic based on your audio format
          this.ws.send(JSON.stringify({
            event: 'media',
            streamSid: this.streamSid,
            media: {
              payload: audioBuffer.toString('base64')
            }
          }));
        }
      }, 100); // Adjust interval as needed
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