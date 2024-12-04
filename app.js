require('dotenv').config();
require('colors');

const express = require('express');
const ExpressWs = require('express-ws');

const { GptService } = require('./services/gpt-service');
const { StreamService } = require('./services/stream-service');
const { TranscriptionService } = require('./services/transcription-service');
const { TextToSpeechService } = require('./services/tts-service');
const { recordingService } = require('./services/recording-service');
const BackgroundMusicService = require('./services/background-music-service');

const VoiceResponse = require('twilio').twiml.VoiceResponse;

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
  let backgroundMusicService;
  let gptService;
  
  try {
    console.log('Client connected');
    
    const streamService = new StreamService(ws);
    const transcriptionService = new TranscriptionService();
    const ttsService = new TextToSpeechService({ voiceId: process.env.VOICE_ID });
    backgroundMusicService = new BackgroundMusicService();
    gptService = new GptService();
    
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

    ttsService.on('speech', (responseIndex, audio, label, icount) => {
      console.log(`Interaction ${icount}: TTS -> TWILIO: ${label}`.blue);
      streamService.buffer(responseIndex, audio);
    });

    streamService.on('audiosent', (markLabel) => {
      marks.push(markLabel);
    });

    // Start background music with proper error handling
    backgroundMusicService.start().catch(err => {
      console.error('Failed to start background music:', err);
    });

    // Handle background audio stream
    backgroundMusicService.on('audio', (audio) => {
      if (streamService) {
        streamService.buffer('background', audio);
      }
    });

    // Cleanup handlers
    ws.on('close', () => {
      console.log('Client disconnected, cleaning up services');
      if (backgroundMusicService) {
        backgroundMusicService.cleanup();
      }
      if (transcriptionService) {
        transcriptionService.stop();
      }
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      if (backgroundMusicService) {
        backgroundMusicService.cleanup();
      }
    });

  } catch (err) {
    console.error('Error in WebSocket connection:', err);
    if (backgroundMusicService) {
      backgroundMusicService.cleanup();
    }
  }
});

app.listen(PORT);
console.log(`Server running on port ${PORT}`);