const EventEmitter = require('events');
const uuid = require('uuid');
const { BackgroundAudioService } = require('./background-audio-service');

class StreamService extends EventEmitter {
  constructor(websocket) {
    super();
    this.ws = websocket;
    this.expectedAudioIndex = 0;
    this.audioBuffer = {};
    this.streamSid = '';
    this.backgroundAudio = new BackgroundAudioService();
    this.setupBackgroundAudio();
  }

  setupBackgroundAudio() {
    this.backgroundAudio.on('audio', (audioChunk) => {
      if (this.streamSid) {
        this.ws.send(
          JSON.stringify({
            streamSid: this.streamSid,
            event: 'media',
            media: {
              payload: audioChunk,
            },
          })
        );
      }
    });
  }

  setStreamSid(streamSid) {
    this.streamSid = streamSid;
    this.backgroundAudio.start();
  }

  buffer(index, audio) {
    this.sendAudio(audio);
  }

  sendAudio(audio) {
    this.backgroundAudio.stop();

    console.log('Sending audio to Twilio:', audio);

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

    setTimeout(() => {
      this.backgroundAudio.start();
    }, 1000);
    
    this.emit('audiosent', markLabel);
  }
}

module.exports = { StreamService };