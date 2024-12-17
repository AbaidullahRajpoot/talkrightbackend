require('dotenv').config();
require('colors');

const express = require('express');
const ExpressWs = require('express-ws');
const cors = require("cors");
const fs = require('fs');
const WebSocket = require('ws');

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

//===============================End Database Connection ============================

//=====================================Routes========================================

app.use('/api', router);

//=====================================End Routes====================================


app.post('/incoming', (req, res) => {
  try {
    const response = new VoiceResponse();
    const connect = response.connect();
    
    // Add two streams - one for AI conversation and one for background music
    connect.stream({ 
      url: `wss://${process.env.SERVER}/connection`,
      name: 'main'
    });
    connect.stream({ 
      url: `wss://${process.env.SERVER}/connection`,
      name: 'music'
    });

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
    let isBackgroundMusic = false;

    const gptService = new GptService();
    const streamService = new StreamService(ws);
    const transcriptionService = new TranscriptionService();
    const ttsService = new TextToSpeechService({});

    ws.on('message', function message(data) {
      const msg = JSON.parse(data);
      if (msg.event === 'start') {
        streamSid = msg.start.streamSid;
        callSid = msg.start.callSid;
        
        console.log('WebSocket connection started:', {
          streamSid,
          callSid,
          name: msg.start.name,
          customParameters: msg.start.customParameters
        });

        streamService.setStreamSid(streamSid);
        
        // Check if this is a music stream
        if (msg.start.name === 'music') {  
          console.log('Initializing music stream...');
          isBackgroundMusic = true;
          
          // Start playing background music
          const playBackgroundMusic = async () => {
            try {
              console.log('Starting background music playback...');
              let musicBuffer;
              try {
                musicBuffer = fs.readFileSync('./assets/background.mp3');
                console.log('Music file loaded successfully, size:', musicBuffer.length);
              } catch (err) {
                console.error('Error loading music file:', err);
                return;
              }
              
              // Convert the music buffer to base64
              const base64Audio = musicBuffer.toString('base64');
              
              // Send the audio with explicit media format
              const mediaPayload = {
                streamSid: streamSid,
                event: 'media',
                media: {
                  payload: base64Audio,
                  track: 'inbound_track',
                  chunk: 1,
                  timestamp: Date.now()
                }
              };
              
              console.log('Sending first music buffer...');
              ws.send(JSON.stringify(mediaPayload));
              
              // Set up continuous loop
              const playLoop = () => {
                if (isBackgroundMusic) {
                  console.log('Playing music loop');
                  ws.send(JSON.stringify(mediaPayload));
                  setTimeout(playLoop, 10000);
                }
              };

              playLoop();
            } catch (err) {
              console.error('Background music error:', err);
            }
          };

          playBackgroundMusic();
        }

        // Regular AI conversation setup
        gptService.setCallSid(callSid);
        gptService.setCallerPhoneNumber(msg.start.from || '0501575591');

        recordingService(ttsService, callSid).then(() => {
          console.log(`Twilio -> Starting Media Stream for ${streamSid}`.underline.red);
          isSpeaking = true;
          transcriptionService.pause();
          transcriptionService.start();
          
          ttsService.generate({ 
            partialResponseIndex: null, 
            partialResponse: `Hi there! I'm Eva from Zuleikha Hospital. How can I help you today?` 
          }, 1);
        }).catch(err => console.error('Error in recordingService:', err));

        callController.trackCallStart(callSid, msg.start.from || '0501575591');
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