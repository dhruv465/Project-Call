/**
 * Speech-to-Text Worker Thread
 * 
 * Handles audio transcription and speech analysis in a separate thread
 * to avoid blocking the main event loop.
 */

const { parentPort, workerData } = require('worker_threads');
const fs = require('fs');
const path = require('path');
const { Deepgram } = require('@deepgram/sdk');
const { v4: uuidv4 } = require('uuid');
const os = require('os');

// Load environment variables
const deepgramApiKey = process.env.DEEPGRAM_API_KEY;

// Initialize Deepgram client
const deepgram = new Deepgram(deepgramApiKey);

// Buffer to store audio chunks for each active session
const sessionBuffers = new Map();

// Transcription options for each active session
const sessionOptions = new Map();

// Keep track of active transcription streams
const activeStreams = new Map();

// Store timestamps for performance monitoring
const metrics = {
  total: 0,
  successful: 0,
  failed: 0,
  avgProcessingTime: 0,
  processingTimes: []
};

// Listen for messages from the main thread
parentPort.on('message', async (message) => {
  try {
    // Initialization message
    if (message.action === 'initStream') {
      initializeSession(message);
    }
    // Process audio chunk
    else if (message.action === 'processAudio') {
      await processAudioChunk(message);
    }
    // Control message
    else if (message.action === 'control') {
      handleControlMessage(message);
    }
    // End stream
    else if (message.action === 'endStream') {
      endSession(message.sessionId);
    }
    // Transcribe file
    else if (message.action === 'transcribe') {
      await transcribeFile(message);
    }
    // Detect language
    else if (message.action === 'detectLanguage') {
      await detectLanguage(message);
    }
    // Unknown action
    else {
      parentPort.postMessage({
        error: `Unknown action: ${message.action}`,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    parentPort.postMessage({
      error: error.message || 'Unknown error in worker',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Initialize a new streaming session
 */
function initializeSession(message) {
  const { sessionId, language, samplingRate, callId } = message;
  
  // Create buffer for this session
  sessionBuffers.set(sessionId, []);
  
  // Store options for this session
  sessionOptions.set(sessionId, {
    language: language || 'en',
    samplingRate: samplingRate || 16000,
    callId
  });
  
  // Notify that session was initialized
  parentPort.postMessage({
    sessionId,
    type: 'initialized',
    timestamp: new Date().toISOString()
  });
}

/**
 * Process an audio chunk for real-time transcription
 */
async function processAudioChunk(message) {
  const { sessionId, audioChunk } = message;
  
  // Check if session exists
  if (!sessionBuffers.has(sessionId)) {
    throw new Error(`Session ${sessionId} not found`);
  }
  
  // Get session options
  const options = sessionOptions.get(sessionId);
  
  // Append to buffer
  const sessionBuffer = sessionBuffers.get(sessionId);
  sessionBuffer.push(audioChunk);
  
  // If we have enough data, process it
  if (Buffer.concat(sessionBuffer).length > 4096) {
    try {
      // Get the complete audio buffer
      const completeBuffer = Buffer.concat(sessionBuffer);
      
      // Clear buffer for next chunk (keep a small overlap)
      const overlap = Buffer.alloc(1024);
      completeBuffer.copy(overlap, 0, completeBuffer.length - 1024);
      sessionBuffers.set(sessionId, [overlap]);
      
      // If we don't have an active stream for this session, create one
      if (!activeStreams.has(sessionId)) {
        createStreamingConnection(sessionId, options);
      }
      
      // Get the live stream
      const liveStream = activeStreams.get(sessionId);
      
      // Send the audio chunk to Deepgram
      liveStream.send(completeBuffer);
    } catch (error) {
      parentPort.postMessage({
        sessionId,
        type: 'error',
        error: error.message || 'Error processing audio chunk',
        timestamp: new Date().toISOString()
      });
    }
  }
}

/**
 * Create a new streaming connection to Deepgram
 */
function createStreamingConnection(sessionId, options) {
  try {
    // Create live transcription options
    const deepgramOptions = {
      punctuate: true,
      diarize: true,
      smart_format: true,
      model: 'nova-2',
      language: options.language,
      interim_results: true,
      utterance_end_ms: 1000,
      vad_events: true,
      encoding: 'linear16',
      sample_rate: options.samplingRate,
      channels: 1
    };
    
    // Create Deepgram live transcription connection
    const liveTranscription = deepgram.transcription.live(deepgramOptions);
    
    // Store the connection
    activeStreams.set(sessionId, liveTranscription);
    
    // Set up event handlers
    liveTranscription.addListener('open', () => {
      parentPort.postMessage({
        sessionId,
        type: 'streamConnected',
        timestamp: new Date().toISOString()
      });
    });
    
    liveTranscription.addListener('error', (error) => {
      parentPort.postMessage({
        sessionId,
        type: 'error',
        error: error.message || 'Deepgram connection error',
        timestamp: new Date().toISOString()
      });
    });
    
    liveTranscription.addListener('close', () => {
      activeStreams.delete(sessionId);
      parentPort.postMessage({
        sessionId,
        type: 'streamClosed',
        timestamp: new Date().toISOString()
      });
    });
    
    liveTranscription.addListener('transcriptReceived', (transcription) => {
      // Process the transcription
      processTranscription(sessionId, transcription, options);
    });
    
  } catch (error) {
    parentPort.postMessage({
      sessionId,
      type: 'error',
      error: error.message || 'Error creating streaming connection',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Process a transcription result from Deepgram
 */
function processTranscription(sessionId, transcription, options) {
  try {
    // Parse the transcription
    const data = JSON.parse(transcription);
    
    // Skip if no alternatives
    if (!data.channel || !data.channel.alternatives || data.channel.alternatives.length === 0) {
      return;
    }
    
    // Get the transcript
    const transcript = data.channel.alternatives[0].transcript;
    
    // Skip empty transcripts
    if (!transcript || transcript.trim() === '') {
      // Send VAD events even if no transcript
      if (data.vad_events) {
        parentPort.postMessage({
          sessionId,
          type: 'vad',
          vad: data.vad_events,
          timestamp: new Date().toISOString()
        });
      }
      return;
    }
    
    // Determine if this is a final result
    const isFinal = !data.is_interim;
    
    // Get confidence score
    const confidence = data.channel.alternatives[0].confidence;
    
    // Check for emotion detection in metadata
    let emotion = 'neutral';
    let sentiment = 0;
    if (data.metadata && data.metadata.sentiment) {
      sentiment = data.metadata.sentiment.overall;
      
      // Convert sentiment score to emotion
      if (sentiment > 0.3) emotion = 'positive';
      else if (sentiment < -0.3) emotion = 'negative';
    }
    
    // Get words with timing information
    const words = data.channel.alternatives[0].words || [];
    
    // Get speaker information if available
    let speaker = null;
    if (data.channel.alternatives[0].speaker) {
      speaker = data.channel.alternatives[0].speaker;
    }
    
    // Send the processed transcription
    parentPort.postMessage({
      sessionId,
      type: 'transcription',
      transcript,
      isFinal,
      confidence,
      emotion,
      sentiment,
      words,
      speaker,
      callId: options.callId,
      language: options.language,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    parentPort.postMessage({
      sessionId,
      type: 'error',
      error: error.message || 'Error processing transcription',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Handle control messages from the client
 */
function handleControlMessage(message) {
  const { sessionId, control } = message;
  
  // Check if session exists
  if (!sessionBuffers.has(sessionId)) {
    throw new Error(`Session ${sessionId} not found`);
  }
  
  // Process different control types
  switch (control.type) {
    case 'setLanguage':
      // Update language for this session
      if (control.language) {
        const options = sessionOptions.get(sessionId);
        options.language = control.language;
        sessionOptions.set(sessionId, options);
        
        // Close and recreate the streaming connection
        if (activeStreams.has(sessionId)) {
          const stream = activeStreams.get(sessionId);
          stream.close();
          activeStreams.delete(sessionId);
        }
        
        parentPort.postMessage({
          sessionId,
          type: 'languageChanged',
          language: control.language,
          timestamp: new Date().toISOString()
        });
      }
      break;
      
    case 'restart':
      // Close and reset session
      if (activeStreams.has(sessionId)) {
        const stream = activeStreams.get(sessionId);
        stream.close();
        activeStreams.delete(sessionId);
      }
      
      // Clear buffer
      sessionBuffers.set(sessionId, []);
      
      parentPort.postMessage({
        sessionId,
        type: 'restarted',
        timestamp: new Date().toISOString()
      });
      break;
      
    default:
      // Unknown control type
      parentPort.postMessage({
        sessionId,
        type: 'error',
        error: `Unknown control type: ${control.type}`,
        timestamp: new Date().toISOString()
      });
  }
}

/**
 * End a streaming session
 */
function endSession(sessionId) {
  // Close stream if active
  if (activeStreams.has(sessionId)) {
    const stream = activeStreams.get(sessionId);
    stream.close();
    activeStreams.delete(sessionId);
  }
  
  // Clear buffer
  sessionBuffers.delete(sessionId);
  
  // Clear options
  sessionOptions.delete(sessionId);
  
  // Notify that session was ended
  parentPort.postMessage({
    sessionId,
    type: 'sessionEnded',
    timestamp: new Date().toISOString()
  });
}

/**
 * Transcribe an audio file
 */
async function transcribeFile(message) {
  const { jobId, filePath, options } = message;
  const startTime = Date.now();
  
  try {
    metrics.total++;
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File ${filePath} not found`);
    }
    
    // Create read stream
    const audioSource = {
      stream: fs.createReadStream(filePath),
      mimetype: 'audio/wav'
    };
    
    // Create Deepgram options
    const deepgramOptions = {
      punctuate: true,
      diarize: true,
      smart_format: true,
      model: options.model || 'general',
      language: options.language || 'en',
      detect_language: true,
      utterance_split: true,
      tag: jobId
    };
    
    if (options.enhanced) {
      deepgramOptions.model = 'nova-2';
    }
    
    // Transcribe audio
    const response = await deepgram.transcription.preRecorded(audioSource, deepgramOptions);
    
    // Calculate processing time
    const processingTime = Date.now() - startTime;
    
    // Update metrics
    metrics.successful++;
    metrics.processingTimes.push(processingTime);
    
    // Calculate average processing time (last 50 requests)
    if (metrics.processingTimes.length > 50) {
      metrics.processingTimes.shift();
    }
    metrics.avgProcessingTime = metrics.processingTimes.reduce((a, b) => a + b, 0) / metrics.processingTimes.length;
    
    // Emit completion event
    parentPort.emit(`job:${jobId}:complete`, {
      jobId,
      transcript: response.results.channels[0].alternatives[0].transcript,
      confidence: response.results.channels[0].alternatives[0].confidence,
      words: response.results.channels[0].alternatives[0].words,
      utterances: response.results.utterances,
      detectedLanguage: response.results.channels[0].detected_language,
      metadata: response.metadata,
      processingTime
    });
    
    // Send result back
    parentPort.postMessage({
      jobId,
      type: 'transcriptionComplete',
      transcript: response.results.channels[0].alternatives[0].transcript,
      confidence: response.results.channels[0].alternatives[0].confidence,
      words: response.results.channels[0].alternatives[0].words,
      utterances: response.results.utterances,
      detectedLanguage: response.results.channels[0].detected_language,
      metadata: response.metadata,
      processingTime,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    // Update metrics
    metrics.failed++;
    
    // Emit error event
    parentPort.emit(`job:${jobId}:error`, {
      message: error.message || 'Transcription failed'
    });
    
    // Send error back
    parentPort.postMessage({
      jobId,
      type: 'error',
      error: error.message || 'Transcription failed',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Detect language in an audio file
 */
async function detectLanguage(message) {
  const { jobId, filePath } = message;
  const startTime = Date.now();
  
  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new Error(`File ${filePath} not found`);
    }
    
    // Create read stream
    const audioSource = {
      stream: fs.createReadStream(filePath),
      mimetype: 'audio/wav'
    };
    
    // Create Deepgram options with minimal processing
    const deepgramOptions = {
      punctuate: false,
      diarize: false,
      smart_format: false,
      detect_language: true,
      model: 'nova-2',
      tag: jobId
    };
    
    // Transcribe a short segment for language detection
    const response = await deepgram.transcription.preRecorded(audioSource, deepgramOptions);
    
    // Calculate processing time
    const processingTime = Date.now() - startTime;
    
    // Extract detected language and confidence
    const detectedLanguage = response.results.channels[0].detected_language;
    const alternatives = response.results.channels[0].alternatives;
    
    // Get top languages with confidence scores
    const languages = [];
    
    if (detectedLanguage) {
      languages.push({
        language: detectedLanguage,
        code: detectedLanguage,
        confidence: 0.8 // Default confidence if not provided
      });
    }
    
    // Add more languages from metadata if available
    if (response.metadata && response.metadata.detected_languages) {
      response.metadata.detected_languages.forEach(lang => {
        if (lang.language !== detectedLanguage) {
          languages.push({
            language: lang.language,
            code: lang.language,
            confidence: lang.confidence || 0.5
          });
        }
      });
    }
    
    // Emit completion event
    parentPort.emit(`job:${jobId}:complete`, {
      jobId,
      primaryLanguage: detectedLanguage,
      languages,
      transcript: alternatives[0].transcript,
      processingTime
    });
    
    // Send result back
    parentPort.postMessage({
      jobId,
      type: 'languageDetectionComplete',
      primaryLanguage: detectedLanguage,
      languages,
      transcript: alternatives[0].transcript,
      processingTime,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    // Emit error event
    parentPort.emit(`job:${jobId}:error`, {
      message: error.message || 'Language detection failed'
    });
    
    // Send error back
    parentPort.postMessage({
      jobId,
      type: 'error',
      error: error.message || 'Language detection failed',
      timestamp: new Date().toISOString()
    });
  }
}

// Log worker startup
parentPort.postMessage({
  type: 'workerStarted',
  processorInfo: {
    hostname: os.hostname(),
    cpus: os.cpus().length,
    totalMemory: os.totalmem(),
    freeMemory: os.freemem(),
    platform: os.platform(),
    uptime: os.uptime()
  },
  timestamp: new Date().toISOString()
});
