require('dotenv').config();
require('colors');

const express = require('express');
const ExpressWs = require('express-ws');
const { Readable } = require('stream');
const path = require('path');

const { GptService } = require('./services/gpt-service');
const { StreamService } = require('./services/stream-service');
const { TranscriptionService } = require('./services/transcription-service');
const { TextToSpeechService } = require('./services/tts-service');
const { recordingService } = require('./services/recording-service');
const { BackgroundAudioService } = require('./services/background-audio-service');

const VoiceResponse = require('twilio').twiml.VoiceResponse;

const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');

const musicStream = path.join(__dirname, './assets/background.mp3');

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

    console.log('response', response);

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

    ttsService.on('speech', async (responseIndex, audioBase64, label, icount) => {
      try {
        console.log(`Interaction ${icount}: TTS -> TWILIO: ${label}`.blue);
        
        // Create temporary files with absolute paths
        const timestamp = Date.now();
        const speechFile = `/tmp/speech_${timestamp}.raw`;
        const outputFile = `/tmp/output_${timestamp}.raw`;
        const audioBuffer = Buffer.from(audioBase64, 'base64');
        
        // Write the audio file
        try {
          fs.writeFileSync(speechFile, audioBuffer);
          console.log('Successfully wrote speech file:', speechFile);
        } catch (err) {
          console.error('Error writing speech file:', err);
          throw err;
        }
        
        // Debug logging
        console.log('Audio buffer size:', audioBuffer.length);
        console.log('Speech file exists:', fs.existsSync(speechFile));
        console.log('Speech file size:', fs.statSync(speechFile).size);
        console.log('Music file exists:', fs.existsSync(musicStream));

        const mixed = await new Promise((resolve, reject) => {
          let command = ffmpeg()
            .input(speechFile)
            .inputFormat('s16le')
            .inputOptions([
              '-ar', '24000',
              '-ac', '1'
            ])
            .input(musicStream)
            .complexFilter([
              {
                filter: 'volume',
                options: { volume: 1 },
                inputs: '0:a',
                outputs: 'speech'
              },
              {
                filter: 'volume',
                options: { volume: 0.3 },
                inputs: '1:a',
                outputs: 'music'
              },
              {
                filter: 'amix',
                options: { inputs: 2 },
                inputs: ['speech', 'music'],
                outputs: 'output'
              }
            ])
            .outputOptions([
              '-map', '[output]',
              '-f', 's16le',
              '-ar', '24000',
              '-ac', '1'
            ])
            .on('start', (commandLine) => {
              console.log('FFmpeg command:', commandLine);
            })
            .on('stderr', (stderrLine) => {
              console.log('FFmpeg stderr:', stderrLine);
            })
            .on('error', (err, stdout, stderr) => {
              console.error('FFmpeg error:', err);
              console.error('FFmpeg stderr:', stderr);
              reject(err);
            })
            .on('end', () => {
              try {
                // Read the output file
                const outputBuffer = fs.readFileSync(outputFile);
                resolve(outputBuffer.toString('base64'));
              } catch (err) {
                reject(err);
              } finally {
                // Clean up files
                try {
                  fs.unlinkSync(speechFile);
                  fs.unlinkSync(outputFile);
                } catch (cleanupErr) {
                  console.error('Cleanup error:', cleanupErr);
                }
              }
            })
            .save(outputFile);
        });

        streamService.buffer(responseIndex, mixed);
      } catch (error) {
        console.error('Error details:', error);
        // Fallback: Send the original audio without mixing
        console.log('Falling back to original audio');
        streamService.buffer(responseIndex, audioBase64);
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