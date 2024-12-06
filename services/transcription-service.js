const { createClient, LiveTranscriptionEvents } = require('@deepgram/sdk');
const { Buffer } = require('node:buffer');
const EventEmitter = require('events');

class TranscriptionService extends EventEmitter {
  constructor() {
    super();
    this.isPaused = false;
    this.finalResult = '';
    this.isConnected = false;
    this.dgConnection = null;
    this.pendingAudio = [];
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.connectionTimeout = null;
    this.isActive = false;
    this.lastTranscriptTime = Date.now();
    this.lastAudioTime = Date.now();
    this.silenceTimeout = null;
    // Balanced silence duration threshold
    this.silenceDuration = 1200;
    // Balanced audio silence threshold
    this.audioSilenceThreshold = 800;
    this.isProcessing = false;
    this.endSentencePunctuation = ['.', '!', '?'];
    this.interimResult = '';
    this.speechStartTime = null;
    this.consecutiveSilentFrames = 0;
    // Balanced silent frames
    this.maxSilentFrames = 2;
    // Balanced minimum speech duration
    this.minSpeechDuration = 450;
    this.incompleteBuffer = '';
    this.isSpeaking = false;
  }

  start() {
    this.isActive = true;
    this.connect();
  }

  stop() {
    this.isActive = false;
    this.disconnect();
  }

  connect() {
    if (this.isConnected || !this.isActive) return;

    clearTimeout(this.connectionTimeout);

    const deepgram = createClient(process.env.DEEPGRAM_API_KEY);
    this.dgConnection = deepgram.listen.live({
      encoding: 'mulaw',
      sample_rate: '8000',
      model: 'nova-2-phonecall',
      punctuate: true,
      interim_results: true,
      // Balanced endpointing
      endpointing: 400,
      // Balanced utterance end time
      utterance_end_ms: 1250
    });

    this.setupEventListeners();

    this.connectionTimeout = setTimeout(() => {
      if (!this.isConnected) {
        console.log('Connection attempt timed out, retrying...'.yellow);
        this.reconnect();
      }
    }, 5000);
  }

  disconnect() {
    clearTimeout(this.connectionTimeout);
    clearTimeout(this.silenceTimeout);
    if (this.dgConnection) {
      this.dgConnection.finish();
      this.dgConnection = null;
    }
    this.isConnected = false;
    this.pendingAudio = [];
    this.reconnectAttempts = 0;
    this.resetSpeechTracking();
  }

  resetSpeechTracking() {
    this.speechStartTime = null;
    this.consecutiveSilentFrames = 0;
    this.finalResult = '';
    this.interimResult = '';
    this.lastTranscriptTime = Date.now();
    this.lastAudioTime = Date.now();
    this.incompleteBuffer = '';
    this.isSpeaking = false;
  }

  setupEventListeners() {
    this.dgConnection.on(LiveTranscriptionEvents.Open, () => {
      console.log('STT -> Deepgram connection opened'.green);
      this.isConnected = true;
      this.reconnectAttempts = 0;
      clearTimeout(this.connectionTimeout);
    });

    this.dgConnection.on(LiveTranscriptionEvents.Transcript, this.handleTranscript.bind(this));

    this.dgConnection.on(LiveTranscriptionEvents.Error, (error) => {
      console.error('STT -> deepgram error');
      console.error(error);
      this.reconnect();
    });

    this.dgConnection.on(LiveTranscriptionEvents.Close, () => {
      console.log('STT -> Deepgram connection closed'.yellow);
      this.isConnected = false;
      if (this.isActive) {
        this.reconnect();
      }
    });
  }

  reconnect() {
    if (!this.isActive) return;

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect to Deepgram (Attempt ${this.reconnectAttempts})`.yellow);
      setTimeout(() => this.connect(), 1000 * this.reconnectAttempts);
    } else {
      console.error('Max reconnection attempts reached. Please check your connection.'.red);
      this.emit('error', new Error('Failed to connect to Deepgram after multiple attempts'));
    }
  }

  handleTranscript(transcriptionEvent) {
    if (this.isPaused || this.isProcessing) return;

    const currentTime = Date.now();
    this.lastTranscriptTime = currentTime;
    clearTimeout(this.silenceTimeout);

    const alternatives = transcriptionEvent.channel?.alternatives;
    let text = alternatives ? alternatives[0]?.transcript : '';
    
    if (text.trim()) {
      if (!this.speechStartTime) {
        this.speechStartTime = currentTime;
        this.isSpeaking = true;
      }
      this.consecutiveSilentFrames = 0;
    }

    if (transcriptionEvent.is_final) {
      this.handleFinalTranscript(text);
    } else {
      this.handleInterimTranscript(text);
    }
    
    this.scheduleSilenceCheck();
  }

  handleFinalTranscript(text) {
    text = text.trim();
    if (text) {
      const fullText = this.incompleteBuffer + ' ' + text;
      this.incompleteBuffer = '';
      
      if (this.isCompleteSentence(fullText)) {
        this.finalResult = fullText;
        this.interimResult = '';
        this.processFinalSpeech();
      } else {
        this.incompleteBuffer = fullText;
      }
    }
  }

  handleInterimTranscript(text) {
    text = text.trim();
    if (text) {
      this.interimResult = text;
      this.consecutiveSilentFrames = 0;
    } else {
      this.consecutiveSilentFrames++;
      if (this.consecutiveSilentFrames >= this.maxSilentFrames && 
          this.speechStartTime && 
          (Date.now() - this.speechStartTime >= this.minSpeechDuration)) {
        const fullText = (this.incompleteBuffer + ' ' + this.interimResult).trim();
        if (fullText) {
          this.finalResult = fullText;
          this.processFinalSpeech();
        }
      }
    }
  }

  isCompleteSentence(text) {
    const trimmedText = text.trim();
    return this.endSentencePunctuation.some(punct => trimmedText.endsWith(punct));
  }

  scheduleSilenceCheck() {
    clearTimeout(this.silenceTimeout);
    this.silenceTimeout = setTimeout(() => {
      const currentTime = Date.now();
      const transcriptSilence = currentTime - this.lastTranscriptTime >= this.silenceDuration;
      const audioSilence = currentTime - this.lastAudioTime >= this.audioSilenceThreshold;

      if (transcriptSilence && audioSilence && this.isSpeaking) {
        const fullText = (this.incompleteBuffer + ' ' + this.interimResult).trim();
        if (fullText && this.speechStartTime && 
            (currentTime - this.speechStartTime >= this.minSpeechDuration)) {
          this.finalResult = fullText;
          this.processFinalSpeech();
        }
      }
    }, this.silenceDuration);
  }

  processFinalSpeech() {
    if (this.isProcessing) return;

    this.isProcessing = true;
    clearTimeout(this.silenceTimeout);

    let finalText = this.finalResult.trim();
    if (finalText.length > 0) {
      console.log(`Processing final speech: ${finalText}`.yellow);
      this.emit('transcription', finalText);
      this.resetSpeechTracking();
    }

    this.isProcessing = false;
    this.isSpeaking = false;
  }

  pause() {
    this.isPaused = true;
    clearTimeout(this.silenceTimeout);
  }

  resume() {
    this.isPaused = false;
    this.isProcessing = false;
    this.resetSpeechTracking();
  }

  send(payload) {
    if (!this.isActive || this.isPaused || this.isProcessing) return;

    this.lastAudioTime = Date.now();

    if (!this.isConnected) {
      this.pendingAudio.push(payload);
      if (!this.dgConnection) {
        this.connect();
      }
    } else {
      try {
        this.dgConnection.send(Buffer.from(payload, 'base64'));
      } catch (error) {
        console.error('Error sending audio to Deepgram:', error);
        this.pendingAudio.push(payload);
        this.reconnect();
      }
    }
  }
}

module.exports = { TranscriptionService };