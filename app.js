require('dotenv').config();
const path = require('path');
require('colors');
const fs = require('fs');

const express = require('express');
const ExpressWs = require('express-ws');

const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
ffmpeg.setFfmpegPath(ffmpegPath);

const { GptService } = require('./services/gpt-service');
const { StreamService } = require('./services/stream-service');
const { TranscriptionService } = require('./services/transcription-service');
const { TextToSpeechService } = require('./services/tts-service');
const { recordingService } = require('./services/recording-service');


const VoiceResponse = require('twilio').twiml.VoiceResponse;

const app = express();
ExpressWs(app);

const PORT = process.env.PORT || 3000;

const musicStream = path.join(__dirname, '../assets/background.mp3');


app.post('/incoming', (req, res) => {
  try {
    const response = new VoiceResponse();
    const connect = response.connect();
    connect.stream({ url: `wss://${process.env.SERVER}/connection` });

    res.type('text/xml');
    res.end(response.toString());
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

    let marks = [];
    let interactionCount = 0;
    let isSpeaking = false;

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
          transcriptionService.pause();
          transcriptionService.start();  // Start the transcription service
          ttsService.generate({ partialResponseIndex: null, partialResponse: `Hi there! I'm Eva from Zuleikha Hospital. How can I help you today?` }, 1);
        }).catch(err => console.error('Error in recordingService:', err));
      } else if (msg.event === 'media') {
        if (!isSpeaking) {
          transcriptionService.send(msg.media.payload);
        }
      } else if (msg.event === 'mark') {
        const label = msg.mark.name;
        console.log(`Twilio -> Audio completed mark (${msg.sequenceNumber}): ${label}`.red);
        marks = marks.filter(m => m !== msg.mark.name);
        if (marks.length === 0) {
          isSpeaking = false;
          transcriptionService.resume();
        }
      } else if (msg.event === 'stop') {
        console.log(`Twilio -> Media stream ${streamSid} ended.`.underline.red);
        transcriptionService.stop();  // Stop the transcription service
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

    ttsService.on('speech', async (responseIndex, audioBase64, text, icount) => {
      console.log(`Interaction ${icount}: TTS -> TWILIO: ${text}`.blue);
      
      try {
        // Convert base64 to buffer
        const audioBuffer = Buffer.from(audioBase64, 'base64');

        // Create a temporary file for the speech audio
        fs.writeFileSync('speech.mp3', audioBuffer);

        // Mix audio with background music
        const mixed = await new Promise((resolve, reject) => {
          const command = ffmpeg()
            .input('speech.mp3')
            .input(musicStream)
            .complexFilter([
              '[0:a]volume=0.4[a0]',
              '[1:a]volume=1.2[a1]',
              '[a0][a1]amix=inputs=2:duration=first[out]'
            ], ['out'])
            .on('start', (commandLine) => {
              console.log('FFmpeg command:', commandLine);
            })
            .on('end', () => {
              // Read the output file and convert to base64
              const mixedBuffer = fs.readFileSync('output.mp3');
              const mixedBase64 = mixedBuffer.toString('base64');
              // Clean up temporary files
              fs.unlinkSync('speech.mp3');
              fs.unlinkSync('output.mp3');
              resolve(mixedBase64);
            })
            .on('error', (err) => {
              console.error('FFmpeg error:', err);
              // Clean up temporary file if it exists
              if (fs.existsSync('speech.mp3')) {
                fs.unlinkSync('speech.mp3');
              }
              reject(err);
            })
            .save('output.mp3');
        });

        // Send the mixed audio to Twilio
        streamService.buffer(responseIndex, mixed);
      } catch (error) {
        console.error('Error mixing audio:', error);
        // Fallback to sending original audio if mixing fails
        streamService.buffer(responseIndex, audioBase64);
      }
    });

    streamService.on('audiosent', (markLabel) => {
      marks.push(markLabel);
    });
  } catch (err) {
    console.log(err);
  }
});

app.listen(PORT);
console.log(`Server running on port ${PORT}`);