/**
 * Low-Latency Stream Controller
 * 
 * Optimized controller for human-like conversational AI interactions with:
 * 1. Parallel processing of AI responses and voice synthesis
 * 2. Real-time audio streaming with minimal latency
 * 3. Human-like audio cues and thinking sounds
 * 4. Response caching for common phrases
 */

import { Request, Response } from 'express';
import WebSocket from 'ws';
import { logger } from '../index';
import Call from '../models/Call';
import Configuration from '../models/Configuration';
import { conversationEngine } from '../services/index';
import { getSDKService } from '../services/elevenlabsSDKService';
import { 
  initializeParallelProcessingService, 
  getParallelProcessingService,
  ProcessingEvent
} from '../services/parallelProcessingService';
import { LLMService } from '../services/llm/service';
import responseCache from '../utils/responseCache';
import { v4 as uuidv4 } from 'uuid';

// Common phrases for pre-caching to eliminate first-response latency
const COMMON_PHRASES = {
  GREETINGS: [
    "Hello, how are you today?",
    "Hi there! How can I help you?",
    "Good morning! How may I assist you?",
    "Thanks for calling. How can I help you today?",
    "Welcome! What can I do for you?"
  ],
  ACKNOWLEDGMENTS: [
    "I understand.",
    "Got it.",
    "I see.",
    "Thanks for sharing that.",
    "I'm listening.",
    "Please go on.",
    "That makes sense."
  ],
  THINKING: [
    "Hmm, let me think about that.",
    "I'm considering your question.",
    "Let me process that for a moment.",
    "That's an interesting point."
  ]
};

/**
 * Initialize and pre-cache common responses for fast first interactions
 */
export const initializeResponseCache = async (): Promise<void> => {
  try {
    // Get configuration
    const config = await Configuration.findOne();
    if (!config || !config.elevenLabsConfig.isEnabled) {
      logger.warn('ElevenLabs not configured, skipping response cache initialization');
      return;
    }
    
    // Get default voice ID
    const defaultVoiceId = config.elevenLabsConfig.availableVoices[0]?.voiceId;
    if (!defaultVoiceId) {
      logger.warn('No default voice available for pre-caching');
      return;
    }
    
    // Get ElevenLabs SDK service
    const sdkService = getSDKService();
    if (!sdkService) {
      logger.warn('ElevenLabs SDK service not initialized, skipping pre-caching');
      return;
    }
    
    logger.info('Initializing response cache for common phrases with optimized latency settings');
    
    // Use the cache preloader utility from utils/cachePreloader
    const { preloadVoice } = require('../utils/cachePreloader');
    
    // Preload for the default voice
    await preloadVoice(defaultVoiceId);
    
    // Preload for any other active voices
    for (const voice of config.elevenLabsConfig.availableVoices) {
      if (voice.voiceId !== defaultVoiceId) {
        await preloadVoice(voice.voiceId);
      }
    }
    
    logger.info(`Response cache initialization complete. Cache size: ${responseCache.size()} items`);
  } catch (error) {
    logger.error(`Error initializing response cache: ${error.message}`);
  }
};

/**
 * Low-latency WebSocket handler for voice streaming
 * Uses parallel processing and human-like audio cues to reduce perceived latency
 */
export const handleLowLatencyVoiceStream = async (ws: WebSocket, req: Request): Promise<void> => {
  // Add proper WebSocket ready state check and error handling
  if (ws.readyState !== WebSocket.OPEN) {
    logger.warn('WebSocket connection not in OPEN state during initialization');
    return;
  }

  // Send immediate acknowledgment to complete handshake
  try {
    ws.send(JSON.stringify({ 
      event: 'connected', 
      message: 'WebSocket connection established',
      timestamp: new Date().toISOString()
    }));
  } catch (error) {
    logger.error('Failed to send initial WebSocket message:', error);
    return;
  }

  // Extract query parameters
  const url = new URL(req.url, `http://${req.headers.host}`);
  const callId = url.searchParams.get('callId');
  const conversationId = url.searchParams.get('conversationId');
  
  // Enhanced logging for debugging
  logger.info(`WebSocket connection attempt for low-latency stream`, {
    url: req.url,
    fullUrl: url.toString(),
    searchParams: Array.from(url.searchParams.entries()),
    callId,
    conversationId,
    headers: {
      host: req.headers.host,
      origin: req.headers.origin,
      userAgent: req.headers['user-agent']
    }
  });
  
  if (!callId || !conversationId) {
    logger.error('Missing callId or conversationId in voice stream', {
      url: req.url,
      callId,
      conversationId,
      searchParams: Array.from(url.searchParams.entries())
    });
    ws.close(1008, 'Missing required parameters');
    return;
  }
  
  let call;
  let session;
  let config;
  let sdkService;
  let processingService;
  
  try {
    logger.info(`Low-latency voice stream started for call ${callId}, conversation ${conversationId}`);
    
    // Load all required resources in parallel for faster initialization
    const [callResult, configResult] = await Promise.all([
      Call.findById(callId),
      Configuration.findOne(),
      // Also initialize the conversation session in parallel
      (async () => {
        const session = conversationEngine.getSession(conversationId);
        if (!session) {
          // If no session exists, create one
          await conversationEngine.startConversation(
            callId, 
            call?.leadId.toString() || 'unknown', 
            call?.campaignId.toString() || 'unknown'
          );
        }
        return conversationEngine.getSession(conversationId);
      })()
    ]);
    
    call = callResult;
    config = configResult;
    session = conversationEngine.getSession(conversationId);
    
    if (!call) {
      logger.error(`No call found with ID ${callId} for streaming`);
      ws.close(1008, 'Call not found');
      return;
    }
    
    if (!config || !config.elevenLabsConfig.isEnabled) {
      logger.error('ElevenLabs not configured for streaming');
      ws.close(1008, 'Voice synthesis not configured');
      return;
    }
    
    if (!session) {
      logger.error(`Failed to create or retrieve session for conversation ${conversationId}`);
      ws.close(1008, 'Session initialization failed');
      return;
    }
    
    // Get ElevenLabs SDK service (singleton)
    sdkService = getSDKService();
    if (!sdkService) {
      // Initialize the SDK service if not already
      const openAIProvider = config.llmConfig.providers.find(p => p.name === 'openai');
      if (!openAIProvider || !openAIProvider.isEnabled) {
        logger.error('OpenAI LLM not configured for streaming');
        ws.close(1008, 'LLM not configured');
        return;
      }
      
      // Initialize the SDK service
      sdkService = require('../services/elevenlabsSDKService').initializeSDKService(
        config.elevenLabsConfig.apiKey,
        openAIProvider.apiKey
      );
      
      if (!sdkService) {
        logger.error('Failed to initialize ElevenLabs SDK service');
        ws.close(1008, 'Voice synthesis failed to initialize');
        return;
      }
    }      // Get or initialize parallel processing service
      processingService = getParallelProcessingService();
      if (!processingService) {
        // Create LLM service for parallel processing
        const llmConfig = {
          providers: config.llmConfig.providers,
          defaultProvider: config.llmConfig.defaultProvider
        };
        
        const llmService = new LLMService(llmConfig);
        
        // Store the LLM service in the config for shared access
        if (!config.llmConfig.llmService) {
          config.llmConfig.llmService = llmService;
        }
        
        // Initialize the parallel processing service
        processingService = initializeParallelProcessingService(sdkService, llmService);
    }
    
    // Set up event handlers for processing service
    processingService.on(ProcessingEvent.PROCESSING_START, (data) => {
      logger.debug(`Processing started for conversation ${conversationId}`);
    });
    
    processingService.on(ProcessingEvent.ERROR, (data) => {
      logger.error(`Processing error for conversation ${conversationId}: ${data.error}`);
    });
    
    // Generate initial greeting if this is the first interaction
    if (session.conversationHistory.length === 0) {
      try {
        // Generate opening message in parallel with voice synthesis setup
        const openingMessagePromise = conversationEngine.generateOpeningMessage(
          conversationId,
          "Customer", // Default name
          call.campaignId.toString()
        );
        
        // Get personality ID for voice synthesis
        const personalityId = session.currentPersonality.id || 
                              session.currentPersonality.voiceId || 
                              config.elevenLabsConfig.availableVoices[0].voiceId;
        
        // Log which personality we're using
        logger.info(`Using personality ID ${personalityId} for call ${callId}`);
        
        // Wait for opening message
        const openingMessage = await openingMessagePromise;
        
        // Define callback to send audio chunks
        const streamCallback = (chunk: Buffer) => {
          ws.send(chunk);
        };
        
        // Process the opening message with parallel processing and optimized latency
        await processingService.processInputParallel(
          conversationId,
          openingMessage,
          personalityId,
          [], // Empty conversation history for opening
          {
            streamCallback,
            campaignId: call.campaignId.toString(),
            useThinkingSounds: false, // No thinking sounds for greeting
            streamPartialResponses: false, // No partial responses for greeting
            optimizationProfile: 'low' // Use low latency profile for greetings
          }
        );
      } catch (error) {
        logger.error(`Error generating opening message for call ${callId}:`, error);
        
        // Fallback to simple greeting from cache
        try {
          const fallbackGreeting = "";
          const fallbackVoice = config.elevenLabsConfig.availableVoices[0].voiceId;
          
          // Try cache first
          const cacheKey = `${fallbackVoice}_${fallbackGreeting}`;
          if (responseCache.has(cacheKey)) {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(responseCache.get(cacheKey));
            }
          } else {
            // Generate simple greeting with optimized latency
            const buffer = await sdkService.generateOptimizedSpeech(
              fallbackGreeting,
              fallbackVoice,
              { 
                optimizationProfile: 'ultraLow',
                cacheAsPriority: true  // Cache this for future use
              }
            );
            
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(buffer);
            }
          }
        } catch (fallbackError) {
          logger.error(`Fallback greeting failed for call ${callId}:`, fallbackError);
          ws.close(1011, 'Voice synthesis failed');
          return;
        }
      }
    }
    
    // Set up accumulated buffer for incoming audio
    let audioBuffer: Buffer[] = [];
    
    // Handle incoming audio data
    ws.on('message', async (data: WebSocket.Data) => {
      try {
        // Check WebSocket state before processing
        if (ws.readyState !== WebSocket.OPEN) {
          logger.warn(`WebSocket not open, skipping message processing for call ${callId}`);
          return;
        }

        // Process as binary data
        if (data instanceof Buffer) {
          // Accumulate audio data
          audioBuffer.push(data);
          
          // If we have enough data, process it
          if (Buffer.concat(audioBuffer).length > 4096) {
            const completeAudio = Buffer.concat(audioBuffer);
            audioBuffer = []; // Reset buffer
            
            // Process the audio with speech recognition using Deepgram if available
            let transcribedText;
            
            // Get the speech analysis service from the conversation engine
            const speechAnalysisService = conversationEngine.getSpeechAnalysisService();
            
            try {
              // Try to transcribe using Deepgram
              if (config.deepgramConfig?.isEnabled && speechAnalysisService) {
                logger.info(`Using Deepgram for speech recognition in call ${callId}`);
                transcribedText = await speechAnalysisService.transcribeAudio(completeAudio);
              } else {
                // Fallback to existing method
                logger.warn(`Deepgram not configured, using fallback for call ${callId}`);
                transcribedText = data?.toString() || (() => { 
                  throw new Error('Speech recognition not properly configured - no audio data received'); 
                })();
              }
            } catch (transcriptionError) {
              logger.error(`Error in speech transcription for call ${callId}: ${transcriptionError.message}`);
              // Fallback to existing method
              transcribedText = data?.toString() || "Sorry, I couldn't hear you clearly.";
            }
            
            // Process the user input with parallel processing for minimal latency
            const personalityId = session.currentPersonality.id || 
                                  session.currentPersonality.voiceId || 
                                  config.elevenLabsConfig.availableVoices[0].voiceId;
            
            // Define callback to send audio chunks
            const streamCallback = (chunk: Buffer) => {
              try {
                if (ws.readyState === WebSocket.OPEN) {
                  ws.send(chunk);
                } else {
                  logger.warn(`Cannot send audio chunk, WebSocket not open for call ${callId}`);
                }
              } catch (sendError) {
                logger.error(`Error sending audio chunk for call ${callId}:`, sendError);
              }
            };
            
            // Process user input with optimized parallel processing
            await processingService.processInputParallel(
              conversationId,
              transcribedText,
              personalityId,
              session.conversationHistory,
              {
                streamCallback,
                leadId: call.leadId.toString(),
                campaignId: call.campaignId.toString(),
                language: session.language || 'English',
                useThinkingSounds: true,
                streamPartialResponses: true,
                optimizationProfile: 'balanced'  // Use balanced profile for normal conversation
              }
            );
          }
        }
      } catch (error) {
        logger.error(`Error processing voice stream data for call ${callId}:`, error);
      }
    });
    
    // Handle WebSocket closure
    ws.on('close', async (code: number, reason: string) => {
      logger.info(`Voice stream closed for call ${callId}: ${code} ${reason}`);
      
      try {
        // Clean up resources as needed
        audioBuffer = []; // Clear buffer
      } catch (error) {
        logger.error(`Error handling stream close for call ${callId}:`, error);
      }
    });
    
    // Handle errors
    ws.on('error', (error: Error) => {
      logger.error(`WebSocket error for call ${callId}:`, error);
      ws.close(1011, 'Internal server error');
    });
    
  } catch (error) {
    logger.error(`Error in low-latency voice stream for call ${callId}:`, error);
    ws.close(1011, 'Internal server error');
  }
};

/**
 * Trigger cache preloading on demand - can be called via API endpoint
 */
export const triggerCachePreload = async (req: Request, res: Response): Promise<void> => {
  try {
    // Get configuration
    const config = await Configuration.findOne();
    if (!config || !config.elevenLabsConfig.isEnabled) {
      logger.warn('ElevenLabs not configured, skipping cache preload');
      res.status(400).json({ success: false, message: 'ElevenLabs not configured' });
      return;
    }
    
    // Use the cache preloader utility
    const { preloadVoice, preloadAllVoices } = require('../utils/cachePreloader');
    
    // Start preloading in the background
    preloadAllVoices().then(result => {
      logger.info(`Cache preloading completed: ${result.voiceCount} voices, ${result.phrasesLoaded} phrases`);
    }).catch(error => {
      logger.error(`Cache preloading failed: ${error.message}`);
    });
    
    // Return success immediately since preloading runs in background
    res.status(200).json({ 
      success: true, 
      message: 'Cache preloading started in background',
      voiceCount: config.elevenLabsConfig.availableVoices.length
    });
  } catch (error) {
    logger.error(`Error triggering cache preload: ${error.message}`);
    res.status(500).json({ success: false, message: `Error: ${error.message}` });
  }
};

/**
 * Initialize the module
 * Pre-caches responses and sets up any needed resources
 */
export const initialize = async (): Promise<void> => {
  try {
    await initializeResponseCache();
    logger.info('Low-latency streaming controller initialized with response caching');
  } catch (error) {
    logger.error('Failed to initialize low-latency streaming controller', error);
  }
};

// Export controller functions
export default {
  handleLowLatencyVoiceStream,
  initialize
};
