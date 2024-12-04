const EventEmitter = require('events');
const uuid = require('uuid');

class StreamService extends EventEmitter {
  constructor(websocket) {
    super();
    this.ws = websocket;
    this.expectedAudioIndex = 0;
    this.audioBuffer = {};
    this.streamSid = '';
    this.backgroundAudioEnabled = true;
    this.backgroundAudioVolume = 0.2; // 20% volume for background
  }

  setStreamSid(streamSid) {
    this.streamSid = streamSid;
  }

  // Mix main audio with background audio
  mixAudio(mainAudioBuffer, backgroundAudioBuffer) {
    const mainAudio = Buffer.from(mainAudioBuffer, 'base64');
    const backgroundAudio = Buffer.from(backgroundAudioBuffer, 'base64');
    
    const mixed = Buffer.alloc(mainAudio.length);
    
    for (let i = 0; i < mainAudio.length; i++) {
      // Mix audio with background at reduced volume
      mixed[i] = Math.min(255, Math.max(0,
        mainAudio[i] * (1 - this.backgroundAudioVolume) +
        (backgroundAudio[i % backgroundAudio.length] * this.backgroundAudioVolume)
      ));
    }
    
    return mixed.toString('base64');
  }

  buffer(index, audio) {
    if (this.backgroundAudioEnabled) {
      // Mix with background audio before sending
      const mixedAudio = this.mixAudio(audio, this.getBackgroundAudio());
      this.sendAudio(mixedAudio);
    } else {
      this.sendAudio(audio);
    }
  }

  getBackgroundAudio() {
    // Return a buffer of background audio
    // This should be replaced with actual background audio data
    return Buffer.from('YOUR_BACKGROUND_AUDIO_BUFFER').toString('base64');
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

module.exports = {StreamService};