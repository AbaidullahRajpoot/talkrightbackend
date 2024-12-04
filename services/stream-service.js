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
    if (index === 'background') {
      // Set background volume to 50% to be less intrusive
      const audioBuffer = Buffer.from(audio, 'base64');
      for (let i = 0; i < audioBuffer.length; i++) {
        audioBuffer[i] = Math.floor(audioBuffer[i] * 0.100); // 10% volume for background
      }
      audio = audioBuffer.toString('base64');
    } else {
      // For AI speech, keep it at 50% volume
      const audioBuffer = Buffer.from(audio, 'base64');
      for (let i = 0; i < audioBuffer.length; i++) {
        audioBuffer[i] = Math.floor(audioBuffer[i] * 0.0); // 90% volume for speech
      }
      audio = audioBuffer.toString('base64');
    }

    this.sendAudio(audio);
    
    // Only emit mark for speech audio, not background
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