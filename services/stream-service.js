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
    this.backgroundAudioTimeout = null;
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
    if (this.backgroundAudioTimeout) {
      clearTimeout(this.backgroundAudioTimeout);
      this.backgroundAudioTimeout = null;
    }

    setTimeout(() => {
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

      this.backgroundAudioTimeout = setTimeout(() => {
        this.backgroundAudio = new BackgroundAudioService();
        this.setupBackgroundAudio();
        this.backgroundAudio.start();
      }, 2000);
      
      this.emit('audiosent', markLabel);
    }, 100);
  }
}

module.exports = { StreamService };