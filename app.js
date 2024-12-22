require('dotenv').config();
require('colors');

const express = require('express');
const ExpressWs = require('express-ws');
const cors = require("cors");
const moment = require('moment');

const { GptService } = require('./services/gpt-service');
const { StreamService } = require('./services/stream-service');
const { TranscriptionService } = require('./services/transcription-service');
const { TextToSpeechService } = require('./services/tts-service');
const { recordingService } = require('./services/recording-service');
const ConnectionDb = require('./db/connectDb');
const router = require('./routes/routes');
const callController = require('./controller/callController');


const VoiceResponse = require('twilio').twiml.VoiceResponse;

const app = express();
ExpressWs(app);

// Middleware
app.use(cors({
  origin: '*',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;

//=============================== Database Connection ===============================

const DATABASE_URL = "mongodb://root:root@ac-ibpk7ae-shard-00-00.hxmancm.mongodb.net:27017,ac-ibpk7ae-shard-00-01.hxmancm.mongodb.net:27017,ac-ibpk7ae-shard-00-02.hxmancm.mongodb.net:27017/?replicaSet=atlas-5rq8tg-shard-0&ssl=true&authSource=admin";

ConnectionDb(DATABASE_URL, (err, db) => {
  if (err) {
    console.error('Failed to connect to database:'.red, err);
    process.exit(1);
  } else {
    console.log('Connected to database:'.green, DATABASE_URL);
  }
});

console.log('Current time:', moment().format('YYYY-MM-DD HH:mm:ss'));


//===============================End Database Connection ============================

//=====================================Routes========================================

app.use('/api', router);

//=====================================End Routes====================================


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
        const phoneNumber = msg.start.from || '0501575591';

        streamService.setStreamSid(streamSid);
        gptService.setCallSid(callSid);
        gptService.setCallerPhoneNumber(phoneNumber);

        // Set RECORDING_ENABLED='true' in .env to record calls
        recordingService(ttsService, callSid).then(() => {
          console.log(`Twilio -> Starting Media Stream for ${streamSid}`.underline.red);
          isSpeaking = true;
          transcriptionService.pause();
          transcriptionService.start();  // Start the transcription service
          ttsService.generate({ partialResponseIndex: null, partialResponse: `Hi there! I'm Eva from Zuleikha Hospital. How can I help you today?` }, 1);
        }).catch(err => console.error('Error in recordingService:', err));

        callController.trackCallStart(callSid, phoneNumber);
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
        callController.trackCallEnd(callSid);
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
  } catch (err) {
    console.log(err);
  }
});

app.listen(PORT);
console.log(`Server running on port ${PORT}`);