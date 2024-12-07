require('dotenv').config();
require('colors');

const express = require('express');
const ExpressWs = require('express-ws');

const { GptService } = require('./services/gpt-service');
const { StreamService } = require('./services/stream-service');
const { TranscriptionService } = require('./services/transcription-service');
const { TextToSpeechService } = require('./services/tts-service');
const { recordingService } = require('./services/recording-service');
const { BackgroundAudioService } = require('./services/background-audio-service');

const VoiceResponse = require('twilio').twiml.VoiceResponse;

const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const { Readable } = require('stream');


const app = express();
ExpressWs(app);

const PORT = process.env.PORT || 5000;


app.post('/incoming', (req, res) => {
  try {
    const response = new VoiceResponse();
    const connect = response.connect();
    connect.stream({ url: `wss://${process.env.SERVER}/connection` });

    res.type('text/xml');
    res.end(response.toString());

    console.log('response',response);
    
  } catch (err) {
    console.log(err);
  }
});

app.ws('/connection', (ws) => {
  try {
    ws.on('error', console.error);
    let streamSid;
    let callSid;

    const gptService = new GptService();
    const streamService = new StreamService(ws);
    const transcriptionService = new TranscriptionService();
    const ttsService = new TextToSpeechService({});
    const backgroundAudioService = new BackgroundAudioService(streamService);

    let marks = [];
    let interactionCount = 0;
    let isSpeaking = false;
    let isBackgroundMusicOnly = true;

    transcriptionService.on('error', (error) => {
      console.error('Critical transcription service error:', error);
      // Handle the error appropriately (e.g., end the call, notify the user)
    });

    ws.on('message', function message(data) {
      const msg = JSON.parse(data);
      if (msg.event === 'start') {
        streamSid = msg.start.streamSid;
        callSid = msg.start.callSid;

        streamService.setStreamSid(streamSid);
        gptService.setCallSid(callSid);
        // gptService.setCallerPhoneNumber(msg.start.from);
        gptService.setCallerPhoneNumber('0501575591');

        // Set RECORDING_ENABLED='true' in .env to record calls
        recordingService(ttsService, callSid).then(() => {
          console.log(`Twilio -> Starting Media Stream for ${streamSid}`.underline.red);
          isSpeaking = true;
          isBackgroundMusicOnly = false;
          transcriptionService.pause();
          transcriptionService.start();  // Start the transcription service
          ttsService.generate({ partialResponseIndex: null, partialResponse: `Hi there! I'm Eva from Zuleikha Hospital. How can I help you today?` }, 1);
        }).catch(err => console.error('Error in recordingService:', err));
      } else if (msg.event === 'media') {
        if (!isSpeaking && !isBackgroundMusicOnly) {
          transcriptionService.send(msg.media.payload);
        }
      } else if (msg.event === 'mark') {
        const label = msg.mark.name;
        console.log(`Twilio -> Audio completed mark (${msg.sequenceNumber}): ${label}`.red);
        marks = marks.filter(m => m !== msg.mark.name);
        if (marks.length === 0) {
          isSpeaking = false;
          isBackgroundMusicOnly = true;
          transcriptionService.resume();
        }
      } else if (msg.event === 'stop') {
        console.log(`Twilio -> Media stream ${streamSid} ended.`.underline.red);
        transcriptionService.stop();  // Stop the transcription service
        // backgroundAudioService.stop(); // Stop the background music
      }
    });

    transcriptionService.on('transcription', async (text) => {
      if (!text) { return; }
      console.log(`Interaction ${interactionCount} – STT -> GPT: ${text}`.yellow);
      gptService.completion(text, interactionCount);
      interactionCount += 1;
    }); 

    gptService.on('gptreply', async (gptReply, icount) => {
      console.log(`Interaction ${icount}: GPT -> TTS: ${gptReply.partialResponse}`.green);
      isSpeaking = true;
      transcriptionService.pause();
      ttsService.generate(gptReply, icount);
    });

    ttsService.on('speech', async (responseIndex, audio, label, icount) => {
      try {
        console.log(`Interaction ${icount}: TTS -> TWILIO: ${label}`.blue);
        
        // Convert base64 to buffer
        const audioBuffer = Buffer.from(audio, 'base64');
        
        // Create readable streams from buffers
        const speechStream = new Readable();
        speechStream.push(audioBuffer);
        speechStream.push(null);

        const backgroundStream = fs.createReadStream('./public/background.mp3');

        // Mix audio with background music using stream
        await new Promise((resolve, reject) => {
          const command = ffmpeg()
            .input(speechStream)
            .input(backgroundStream)
            .complexFilter([
              '[0:a]volume=1[a0]',     // Speech volume
              '[1:a]volume=0.3[a1]',   // Background music volume
              '[a0][a1]amix=inputs=2:duration=first[out]'
            ], ['out'])
            .toFormat('mp3')
            .on('error', (err) => {
              console.error('FFmpeg error:', err);
              reject(err);
            });

          // Capture output directly as buffer
          const chunks = [];
          command.pipe()
            .on('data', chunk => chunks.push(chunk))
            .on('end', () => {
              const mixedBuffer = Buffer.concat(chunks);
              const mixedBase64 = mixedBuffer.toString('base64');
              streamService.buffer(responseIndex, mixedBase64);
              resolve();
            });
        });

      } catch (error) {
        console.error('Error mixing audio:', error);
        // Fallback to sending original audio if mixing fails
        streamService.buffer(responseIndex, audio);
      }
    }); 

    streamService.on('audiosent', (markLabel) => {
      marks.push(markLabel);
    });

    // Start background music with low volume
    // backgroundAudioService.setVolume(0.01); // Set volume to 15%
    // backgroundAudioService.start();
  } catch (err) {
    console.log(err);
  }
});

app.listen(PORT);
console.log(`Server running on port ${PORT}`);