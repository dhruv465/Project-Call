/**
 * ElevenLabs SDK Service
 * Implements the ElevenLabs Conversational AI functionality using the official SDK
 * Handles interactive conversations with the ability to stop audio when user interrupts
 * and adapt voice tone according to conversation context.
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';
import { getErrorMessage } from '../utils/logger';
import ElevenLabs from 'elevenlabs-node';
import WebSocket from 'ws';

// Types
type Language = 'English' | 'Hindi';

export interface ConversationOptions {
  voiceId: string;
  stability?: number;
  similarityBoost?: number;
  style?: number;
  useSSML?: boolean;
  modelId?: string;
}

export interface ConversationState {
  id: string;
  createdAt: Date;
  lastActivity: Date;
  active: boolean;
  messages: ConversationMessage[];
  isGenerating: boolean;
}

export interface ConversationMessage {
  id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: Date;
  interrupted?: boolean;
}

export interface StreamOptions {
  latencyOptimization?: boolean;
  voiceSettings?: {
    stability?: number;
    similarityBoost?: number;
    style?: number;
    speakerBoost?: boolean;
  };
  model?: string;
}

// Events that can be emitted by the service
export enum ConversationEvent {
  MESSAGE_START = 'message-start',
  MESSAGE_STREAM = 'message-stream',
  MESSAGE_COMPLETE = 'message-complete',
  USER_INTERRUPT = 'user-interrupt',
  ERROR = 'error',
  CONNECTION_STATUS = 'connection-status'
}

/**
 * Handles conversational AI interactions with ElevenLabs API using the official SDK
 * Implements WebSocket streaming for real-time responses
 * Supports interruption and dynamic voice adaptation
 */
export class ElevenLabsSDKService extends EventEmitter {
  private apiKey: string;
  private wsUrl: string = 'wss://api.elevenlabs.io/v1/conversation';
  private conversations: Map<string, ConversationState> = new Map();
  private activeConnections: Map<string, WebSocket> = new Map();
  private openAIApiKey: string;
  private elevenlabs: ElevenLabs;

  /**
   * Create a new ElevenLabs SDK Service
   */
  constructor(apiKey: string, openAIApiKey: string) {
    super();
    
    if (!apiKey || apiKey.trim() === '') {
      throw new Error('ElevenLabs API key is required for SDK initialization');
    }
    
    this.apiKey = apiKey;
    this.openAIApiKey = openAIApiKey;
    
    try {
      // Initialize the ElevenLabs SDK
      this.elevenlabs = new ElevenLabs({
        apiKey: this.apiKey
      });
      
      logger.info('ElevenLabs SDK Service initialized with API key', {
        keyLength: this.apiKey.length,
        keyPrefix: this.apiKey.substring(0, 3) + '...'
      });
    } catch (error) {
      logger.error(`Failed to initialize ElevenLabs SDK: ${getErrorMessage(error)}`);
      throw new Error(`ElevenLabs SDK initialization failed: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Update API keys for the service
   * @param apiKey ElevenLabs API key
   * @param openAIApiKey OpenAI API key
   */
  public updateApiKeys(apiKey: string, openAIApiKey: string): void {
    this.apiKey = apiKey;
    this.openAIApiKey = openAIApiKey;
    
    // Re-initialize the SDK with the new API key
    this.elevenlabs = new ElevenLabs({
      apiKey: this.apiKey
    });
    
    logger.info('ElevenLabs SDK Service API keys updated');
  }

  /**
   * Create a new conversation
   * @returns Conversation ID
   */
  public createConversation(): string {
    const conversationId = uuidv4();
    
    this.conversations.set(conversationId, {
      id: conversationId,
      createdAt: new Date(),
      lastActivity: new Date(),
      active: true,
      messages: [],
      isGenerating: false
    });
    
    logger.info(`Created new conversation: ${conversationId}`);
    return conversationId;
  }

  /**
   * Add a message to the conversation
   * @param conversationId Conversation ID
   * @param role Role of the message sender
   * @param content Message content
   * @returns The message that was added
   */
  public addMessage(
    conversationId: string, 
    role: 'system' | 'user' | 'assistant', 
    content: string
  ): ConversationMessage | null {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      logger.error(`Conversation ${conversationId} not found`);
      return null;
    }

    const message: ConversationMessage = {
      id: uuidv4(),
      role,
      content,
      timestamp: new Date()
    };

    conversation.messages.push(message);
    conversation.lastActivity = new Date();
    
    logger.info(`Added ${role} message to conversation ${conversationId}`);
    return message;
  }

  /**
   * Generate speech from text using ElevenLabs SDK
   * @param text Text to synthesize
   * @param voiceId Voice ID to use
   * @param options Options for speech synthesis
   * @returns Audio buffer
   */
  public async generateSpeech(
    text: string,
    voiceId: string,
    options?: {
      stability?: number;
      similarityBoost?: number;
      style?: number;
      modelId?: string;
    }
  ): Promise<Buffer> {
    try {
      const voiceSettings = {
        stability: options?.stability || 0.75,
        similarity_boost: options?.similarityBoost || 0.75,
        style: options?.style || 0.0,
        use_speaker_boost: true
      };

      const modelId = options?.modelId || 'eleven_multilingual_v2';
      
      // Use the SDK to generate speech
      const audioBuffer = await this.elevenlabs.textToSpeech({
        text,
        voice_id: voiceId,
        model_id: modelId,
        voice_settings: voiceSettings,
        output_format: 'mp3_44100_128' // Explicitly request MP3 format at high quality
      });

      return Buffer.from(audioBuffer);
    } catch (error) {
      logger.error(`Error generating speech: ${getErrorMessage(error)}`);
      throw new Error(`Speech generation failed: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Stream speech with the ability to interrupt using ElevenLabs SDK
   * @param conversationId Conversation ID
   * @param text Text to synthesize
   * @param voiceId Voice ID to use
   * @param onAudioChunk Callback for audio chunks
   * @param options Stream options
   */
  public async streamSpeech(
    conversationId: string,
    text: string,
    voiceId: string,
    onAudioChunk: (chunk: Buffer) => void,
    options?: StreamOptions
  ): Promise<void> {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    // Create WebSocket connection (ElevenLabs SDK doesn't fully support streaming with interruption yet)
    const ws = new WebSocket(this.wsUrl);
    let interrupted = false;

    // Store connection for potential interruption
    this.activeConnections.set(conversationId, ws);

    // Handle WebSocket connection
    ws.on('open', () => {
      logger.info(`WebSocket connection opened for conversation ${conversationId}`);
      
      // Send initialization message
      ws.send(JSON.stringify({
        text,
        voice_id: voiceId,
        xi_api_key: this.apiKey,
        model_id: options?.model || 'eleven_multilingual_v2',
        voice_settings: {
          stability: options?.voiceSettings?.stability || 0.75,
          similarity_boost: options?.voiceSettings?.similarityBoost || 0.75,
          style: options?.voiceSettings?.style || 0.0,
          use_speaker_boost: options?.voiceSettings?.speakerBoost || true
        },
        optimize_streaming_latency: options?.latencyOptimization || 0
      }));

      // Emit connection status
      this.emit(ConversationEvent.CONNECTION_STATUS, { 
        conversationId, 
        status: 'connected' 
      });
    });

    // Handle incoming audio data
    ws.on('message', (data) => {
      if (Buffer.isBuffer(data)) {
        onAudioChunk(data);
        this.emit(ConversationEvent.MESSAGE_STREAM, { 
          conversationId, 
          chunk: data 
        });
      } else {
        try {
          const jsonData = JSON.parse(data.toString());
          
          if (jsonData.type === 'message') {
            logger.info(`Message from ElevenLabs: ${jsonData.message}`);
          } else if (jsonData.type === 'audio_started') {
            this.emit(ConversationEvent.MESSAGE_START, { 
              conversationId 
            });
          } else if (jsonData.type === 'audio_completed') {
            this.emit(ConversationEvent.MESSAGE_COMPLETE, { 
              conversationId,
              interrupted: false
            });
          }
        } catch (e) {
          logger.warn(`Non-JSON message received: ${data}`);
        }
      }
    });

    // Handle errors
    ws.on('error', (error) => {
      logger.error(`WebSocket error for conversation ${conversationId}: ${getErrorMessage(error)}`);
      this.emit(ConversationEvent.ERROR, { 
        conversationId, 
        error: getErrorMessage(error) 
      });
    });

    // Handle WebSocket closure
    ws.on('close', (code, reason) => {
      logger.info(`WebSocket closed for conversation ${conversationId}: ${code} ${reason}`);
      this.activeConnections.delete(conversationId);
      
      // Emit completion event if not already emitted due to interruption
      if (interrupted) {
        this.emit(ConversationEvent.MESSAGE_COMPLETE, { 
          conversationId,
          interrupted: true
        });
      }
    });

    return new Promise((resolve, reject) => {
      // Handle WebSocket events to resolve/reject the promise
      ws.on('close', () => resolve());
      ws.on('error', (error) => reject(error));
    });
  }

  /**
   * Interrupt the currently streaming message
   * @param conversationId Conversation ID
   * @returns True if successfully interrupted
   */
  public interruptStream(conversationId: string): boolean {
    const ws = this.activeConnections.get(conversationId);
    if (!ws) {
      logger.warn(`No active connection found for conversation ${conversationId}`);
      return false;
    }

    try {
      // Send interruption signal
      ws.send(JSON.stringify({ interrupt: true }));
      
      // Mark the conversation as interrupted
      const conversation = this.conversations.get(conversationId);
      if (conversation && conversation.messages.length > 0) {
        const lastMessage = conversation.messages[conversation.messages.length - 1];
        if (lastMessage.role === 'assistant') {
          lastMessage.interrupted = true;
        }
      }

      // Emit interruption event
      this.emit(ConversationEvent.USER_INTERRUPT, { conversationId });
      logger.info(`Interrupted stream for conversation ${conversationId}`);
      
      return true;
    } catch (error) {
      logger.error(`Error interrupting stream for conversation ${conversationId}: ${getErrorMessage(error)}`);
      return false;
    }
  }

  /**
   * Close the conversation
   * @param conversationId Conversation ID
   */
  public closeConversation(conversationId: string): void {
    // Interrupt any active stream
    this.interruptStream(conversationId);
    
    // Update conversation state
    const conversation = this.conversations.get(conversationId);
    if (conversation) {
      conversation.active = false;
      logger.info(`Closed conversation ${conversationId}`);
    } else {
      logger.warn(`Attempted to close non-existent conversation ${conversationId}`);
    }
  }

  /**
   * Use ElevenLabs' Conversational AI API to generate a response
   * @param messages Previous conversation messages
   * @param options Conversation options
   * @returns Generated response text
   */
  public async generateConversationResponse(
    messages: { role: string; content: string }[],
    options?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<string> {
    try {
      // Using the SDK's conversational capability
      const response = await this.elevenlabs.generateConversationResponse({
        messages,
        model: options?.model || 'claude-3-haiku-20240307',
        temperature: options?.temperature || 0.7,
        max_tokens: options?.maxTokens || 150
      });
      
      return response;
    } catch (error) {
      logger.error(`Error generating conversation response: ${getErrorMessage(error)}`);
      throw new Error(`Conversation response generation failed: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Synthesize adaptive voice with personality adaptation using ElevenLabs SDK
   * @param params Parameters for adaptive voice synthesis
   * @returns Audio content and metadata
   */
  public async synthesizeAdaptiveVoice(params: {
    text: string;
    personalityId: string;
    language?: string;
  }): Promise<any> {
    try {
      const { text, personalityId, language = 'en' } = params;
      
      // Validate inputs
      if (!text || text.trim() === '') {
        throw new Error('Text for synthesis cannot be empty');
      }
      
      if (!personalityId || personalityId.trim() === '') {
        throw new Error('Voice ID (personalityId) cannot be empty');
      }
      
      // Log synthesis attempt
      logger.info(`Attempting to synthesize voice with ElevenLabs SDK: ${text.substring(0, 30)}...`, {
        voiceId: personalityId,
        language,
        textLength: text.length
      });
      
      // Use standard voice settings
      const voiceSettings = {
        stability: 0.8,
        similarity_boost: 0.75,
        style: 0.3,
        use_speaker_boost: true
      };

      // Choose appropriate model based on language
      const modelId = language === 'hi' ? 'eleven_multilingual_v2' : 'eleven_monolingual_v1';

      // Generate the speech using the SDK with timeout handling
      const synthesisPromise = this.elevenlabs.textToSpeech({
        text,
        voice_id: personalityId,
        model_id: modelId,
        voice_settings: voiceSettings
      });
      
      // Add a timeout to prevent hanging on API issues
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Voice synthesis timed out after 15 seconds')), 15000);
      });
      
      // Race the promises
      const audioBuffer = await Promise.race([synthesisPromise, timeoutPromise]);

      // Log successful synthesis
      logger.info(`Successfully synthesized voice with ElevenLabs SDK for ${text.length} characters`);

      // Return audio content and metadata
      return {
        audioContent: audioBuffer,
        metadata: {
          voiceId: personalityId,
          language,
          duration: Math.ceil(text.length / 15), // Rough estimate
          synthesisService: 'elevenlabs-sdk',
          size: audioBuffer.length // Include size for TwiML decisions
        }
      };
    } catch (error) {
      logger.error(`Error synthesizing adaptive voice: ${getErrorMessage(error)}`, {
        error: error instanceof Error ? error.stack : 'Unknown error',
        params: {
          textLength: params.text?.length || 0,
          voiceId: params.personalityId,
          language: params.language
        }
      });
      
      // Check if this is the "unusual activity" error from ElevenLabs
      // This can be in the error message, or in the error.response.data.detail.status field
      const errorMsg = error.message || '';
      const responseData = error.response?.data || {};
      const detailStatus = responseData.detail?.status || '';
      
      const isUnusualActivity = 
        errorMsg.includes('detected_unusual_activity') || 
        errorMsg.includes('unusual activity') ||
        detailStatus === 'detected_unusual_activity';
      
      if (isUnusualActivity) {
        logger.error('ElevenLabs API unusual activity detected. This is likely due to quota or free tier limitations.', {
          errorMessage: errorMsg,
          statusCode: error.response?.status,
          detailStatus: detailStatus
        });
        
        // Try to update configuration status in database
        try {
          const Configuration = require('../models/Configuration').default;
          await Configuration.findOneAndUpdate(
            {}, 
            { 
              'elevenLabsConfig.status': 'failed',
              'elevenLabsConfig.lastVerified': new Date(),
              'elevenLabsConfig.lastError': 'Unusual activity detected. Free tier usage disabled.',
              'elevenLabsConfig.unusualActivityDetected': true,
              'elevenLabsConfig.quotaInfo': {
                tier: 'free',
                status: 'restricted'
              }
            }
          );
          
          // Import the verification utility
          const { verifyAndUpdateElevenLabsApiStatus } = require('../utils/elevenLabsVerification');
          
          // Trigger a verification to update quota info
          await verifyAndUpdateElevenLabsApiStatus(this.apiKey).catch(e => {
            logger.error(`Failed to verify ElevenLabs API after unusual activity: ${getErrorMessage(e)}`);
          });
          
          logger.info('Updated configuration with ElevenLabs unusual activity status');
        } catch (dbError) {
          logger.error(`Failed to update ElevenLabs status in database: ${getErrorMessage(dbError)}`);
        }
        
        throw new Error('ElevenLabs API reported unusual activity detected. Please check your account status and limits or upgrade to a paid plan.');
      }
      
      throw new Error(`Voice synthesis failed: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Begin an interactive conversation with streaming response
   * @param conversationId Conversation ID
   * @param text User input text
   * @param voiceId Voice ID to use
   * @param options Stream options
   * @param onAudioChunk Callback for audio chunks
   */
  public async startInteractiveConversation(
    conversationId: string,
    text: string,
    voiceId: string,
    options?: StreamOptions,
    onAudioChunk?: (chunk: Buffer) => void
  ): Promise<void> {
    try {
      // Create conversation if it doesn't exist
      if (!this.conversations.has(conversationId)) {
        this.createConversation();
      }

      const conversation = this.conversations.get(conversationId)!;
      
      // Add user message
      this.addMessage(conversationId, 'user', text);
      
      // Mark conversation as generating
      conversation.isGenerating = true;

      // Start streaming and return the promise
      return this.streamSpeech(
        conversationId,
        text,
        voiceId,
        onAudioChunk || (() => {}),
        options
      ).finally(() => {
        conversation.isGenerating = false;
      });
    } catch (error) {
      logger.error(`Error starting interactive conversation: ${getErrorMessage(error)}`);
      throw new Error(`Failed to start conversation: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Get available voices using the SDK
   * @returns List of available voices
   */
  public async getVoices(): Promise<any> {
    try {
      const voices = await this.elevenlabs.getVoices();
      return voices;
    } catch (error) {
      logger.error(`Error getting voices: ${getErrorMessage(error)}`);
      throw new Error(`Failed to get voices: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Get the current state of a conversation
   * @param conversationId Conversation ID
   * @returns Conversation state or null if not found
   */
  public getConversationState(conversationId: string): ConversationState | null {
    return this.conversations.get(conversationId) || null;
  }

  /**
   * Get all active conversations
   * @returns Array of active conversation states
   */
  public getActiveConversations(): ConversationState[] {
    return Array.from(this.conversations.values())
      .filter(conv => conv.active);
  }
}

// Singleton instance
let sdkService: ElevenLabsSDKService | null = null;

/**
 * Initialize the ElevenLabs SDK Service
 * @param apiKey ElevenLabs API key
 * @param openAIApiKey OpenAI API key for conversation enhancement
 * @returns Service instance
 */
export function initializeSDKService(
  apiKey: string,
  openAIApiKey: string
): ElevenLabsSDKService | null {
  try {
    if (!apiKey || apiKey.trim() === '') {
      logger.error('Cannot initialize SDK Service: ElevenLabs API key is missing or empty');
      return null;
    }
    
    if (!sdkService) {
      sdkService = new ElevenLabsSDKService(apiKey, openAIApiKey);
      logger.info('ElevenLabs SDK Service initialized successfully with new instance');
    } else {
      // Update API keys if service already exists
      sdkService.updateApiKeys(apiKey, openAIApiKey);
      logger.info('ElevenLabs SDK Service updated with new API keys');
    }
    
    // Do a quick validation of the API key by attempting to get voices
    // This is wrapped in a Promise.race to timeout if it takes too long
    const timeoutPromise = new Promise<void>((_, reject) => {
      setTimeout(() => reject(new Error('API validation timed out')), 5000);
    });
    
    // Attempt to validate the API in the background without blocking
    Promise.race([
      (async () => {
        try {
          await sdkService.getVoices();
          logger.info('ElevenLabs API key validated successfully');
        } catch (error) {
          logger.error(`ElevenLabs API key validation failed: ${getErrorMessage(error)}`);
          // Don't set to null here, as it might just be a temporary network issue
        }
      })(),
      timeoutPromise
    ]).catch(error => {
      logger.warn(`API validation check: ${getErrorMessage(error)}`);
    });
    
    return sdkService;
  } catch (error) {
    logger.error(`Failed to initialize ElevenLabs SDK Service: ${getErrorMessage(error)}`);
    return null;
  }
}

/**
 * Get the ElevenLabs SDK Service instance
 * @returns Service instance or null if not initialized
 */
export function getSDKService(): ElevenLabsSDKService | null {
  return sdkService;
}

// Export default interface for singleton pattern
export default {
  initialize: initializeSDKService,
  getService: getSDKService
};
