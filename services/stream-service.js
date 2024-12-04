const EventEmitter = require('events');
const uuid = require('uuid');
const { Buffer } = require('node:buffer');

class StreamService extends EventEmitter {
  constructor(websocket) {
    super();
    this.ws = websocket;
    this.expectedAudioIndex = 0;
    this.audioBuffer = {};
    this.streamSid = '';
  }

  setStreamSid (streamSid) {
    this.streamSid = streamSid;
  }

  buffer(index, audio) {
    try {
      const audioBuffer = Buffer.from(audio, 'base64');
      
      // Apply volume adjustments
      if (index === 'background') {
        // Background music at 20% volume
        for (let i = 0; i < audioBuffer.length; i++) {
          audioBuffer[i] = Math.floor(audioBuffer[i] * 0.20);
        }
      } else {
        // Speech at 80% volume
        for (let i = 0; i < audioBuffer.length; i++) {
          audioBuffer[i] = Math.floor(audioBuffer[i] * 0.80);
        }
      }

      // Convert back to base64
      audio = audioBuffer.toString('base64');

      // Send the audio
      this.sendAudio(audio);
      
      // Only emit mark for speech audio
      if (index !== 'background') {
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
    } catch (err) {
      console.error('Error processing audio buffer:', err);
    }
  }

  sendAudio (audio) {
    this.ws.send(
      JSON.stringify({
        streamSid: this.streamSid,
        event: 'media',
        media: {
          payload: audio,
        },
      })
    );
  }
}

module.exports = {StreamService};