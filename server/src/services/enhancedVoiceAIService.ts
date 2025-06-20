// Enhanced Voice AI Service - API-only, no local training or emotion detection
import axios from 'axios';
import logger from '../utils/logger';
import { getErrorMessage } from '../utils/logger';
import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { 
  ElevenLabsConversationalService, 
  ConversationEvent,
  initializeConversationalService
} from './elevenLabsConversationalService';
import {
  ElevenLabsSDKService,
  ConversationEvent as SDKConversationEvent,
  initializeSDKService
} from './elevenlabsSDKService';
import { LLMService } from './llm/service';
import { LLMConfig, LLMProvider, LLMMessage } from './llm/types';
import { getPreferredVoiceId } from '../utils/voiceUtils';

export interface VoicePersonality {
  id: string;
  name: string;
  description: string;
  voiceId: string;
  personality: string;
  style: string;
  settings: {
    stability: number;
    similarityBoost: number;
    style: number;
    useSpeakerBoost: boolean;
  };
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  [key: string]: any; // Allow additional properties for backward compatibility
}

type Language = 'English' | 'Hindi';

export class EnhancedVoiceAIService {
  private elevenLabsApiKey: string;
  private conversationalService: ElevenLabsConversationalService | null = null;
  private sdkService: ElevenLabsSDKService | null = null;
  private llmService: LLMService | null = null;

  constructor(elevenLabsApiKey: string) {
    console.log('EnhancedVoiceAIService constructor called with:', {
      hasApiKey: !!elevenLabsApiKey,
      apiKeyLength: elevenLabsApiKey?.length || 0
    });
    
    this.elevenLabsApiKey = elevenLabsApiKey;
    
    // Initialize services
    console.log('Initializing conversational service...');
    this.initializeConversationalService();
    
    console.log('Initializing SDK service...');
    this.initializeSDKService();
    
    // Initialize LLM service asynchronously - it will fetch from the database
    console.log('Starting LLM service initialization...');
    this.initializeLLMService().catch(error => {
      console.error(`Failed to initialize LLM Service: ${getErrorMessage(error)}`);
      logger.error(`Failed to initialize LLM Service: ${getErrorMessage(error)}`);
    });
    
    console.log('EnhancedVoiceAIService initialization completed');
  }
  
  /**
   * Initialize the ElevenLabs Conversational Service
   */
  private initializeConversationalService(): void {
    try {
      // Initialize without OpenAI dependency - LLM service will handle AI responses
      this.conversationalService = initializeConversationalService(
        this.elevenLabsApiKey,
        '' // Empty OpenAI key since we'll use LLM service
      );
      logger.info('ElevenLabs Conversational AI Service initialized');
    } catch (error) {
      logger.error(`Failed to initialize ElevenLabs Conversational Service: ${getErrorMessage(error)}`);
      this.conversationalService = null;
    }
  }

  /**
   * Initialize the ElevenLabs SDK Service
   */
  private initializeSDKService(): void {
    try {
      console.log('EnhancedVoiceAIService.initializeSDKService called with API key:', {
        hasApiKey: !!this.elevenLabsApiKey,
        apiKeyLength: this.elevenLabsApiKey?.length || 0
      });
      
      if (!this.elevenLabsApiKey) {
        throw new Error('ElevenLabs API key is missing');
      }
      
      // Initialize without OpenAI dependency - LLM service will handle AI responses
      console.log('Calling initializeSDKService from enhancedVoiceAIService...');
      this.sdkService = initializeSDKService(
        this.elevenLabsApiKey,
        '' // Empty OpenAI key since we'll use LLM service
      );
      
      if (this.sdkService) {
        console.log('ElevenLabs SDK Service initialized successfully in EnhancedVoiceAIService');
        logger.info('ElevenLabs SDK Service initialized successfully');
      } else {
        throw new Error('SDK service initialization returned null');
      }
    } catch (error) {
      console.error(`Failed to initialize ElevenLabs SDK Service in EnhancedVoiceAIService: ${getErrorMessage(error)}`);
      logger.error(`Failed to initialize ElevenLabs SDK Service: ${getErrorMessage(error)}`);
      this.sdkService = null;
    }
  }

  /**
   * Initialize the LLM Service
   */
  private async initializeLLMService(): Promise<void> {
    try {
      // Get LLM configuration from database instead of hardcoding
      const configuration = await mongoose.model('Configuration').findOne();
      if (!configuration || !configuration.llmConfig) {
        logger.warn('LLM configuration not found in database');
        return;
      }
      
      // Extract provider configurations from database
      const providers = configuration.llmConfig.providers.map(provider => ({
        name: provider.name as LLMProvider,
        apiKey: provider.apiKey,
        isEnabled: provider.isEnabled !== false,
        defaultModel: provider.defaultModel,
        baseUrl: provider.baseUrl
      })).filter(provider => provider.isEnabled && provider.apiKey);
      
      if (providers.length === 0) {
        logger.warn('No enabled LLM providers found in configuration');
        return;
      }
      
      // Configure LLM service with providers from database
      const llmConfig: LLMConfig = {
        providers,
        defaultProvider: configuration.llmConfig.defaultProvider as LLMProvider || providers[0].name
      };
      
      this.llmService = new LLMService(llmConfig);
      logger.info(`LLM Service initialized with ${providers.length} providers from database`);
    } catch (error) {
      logger.error(`Failed to initialize LLM Service: ${getErrorMessage(error)}`);
      this.llmService = null;
    }
  }

  /**
   * Get current ElevenLabs API key
   */
  public getElevenLabsApiKey(): string {
    return this.elevenLabsApiKey;
  }

  /**
   * Get enhanced voice personalities from configuration
   */
  static async getEnhancedVoicePersonalities(): Promise<VoicePersonality[]> {
    try {
      const configuration = await mongoose.model('Configuration').findOne();
      if (!configuration || !configuration.elevenLabsConfig) {
        throw new Error('ElevenLabs configuration not found');
      }

      const availableVoices = configuration.elevenLabsConfig.availableVoices || [];
      if (availableVoices.length === 0) {
        throw new Error('No voices configured in ElevenLabs. Please configure voices in the system settings.');
      }

      return availableVoices.map((voice) => {
        const personalityType = this.inferPersonalityFromVoiceName(voice.name);
        
        return {
          id: voice.voiceId,
          name: voice.name,
          description: voice.description || `AI voice with ${personalityType} characteristics`,
          voiceId: voice.voiceId,
          personality: personalityType,
          style: this.getStyleForPersonality(personalityType),
          settings: {
            stability: 0.8,
            similarityBoost: 0.8,
            style: 0.3,
            useSpeakerBoost: true
          }
        };
      });
    } catch (error) {
      logger.error('Error fetching voice personalities:', error);
      throw new Error('Failed to fetch voice personalities from configuration');
    }
  }

  private static inferPersonalityFromVoiceName(voiceName: string): string {
    const name = voiceName.toLowerCase();
    if (name.includes('professional') || name.includes('business')) return 'professional';
    if (name.includes('friendly') || name.includes('warm')) return 'friendly';
    if (name.includes('energetic') || name.includes('dynamic')) return 'energetic';
    if (name.includes('calm') || name.includes('soothing')) return 'calm';
    return 'professional';
  }

  private static getStyleForPersonality(personality: string): string {
    switch (personality) {
      case 'professional': return 'Clear and authoritative';
      case 'friendly': return 'Warm and approachable';
      case 'energetic': return 'Dynamic and enthusiastic';
      case 'calm': return 'Soothing and reassuring';
      default: return 'Professional and clear';
    }
  }

  /**
   * Get valid voice ID from system configuration
   */
  static async getValidVoiceId(campaignVoiceId: string): Promise<string> {
    try {
      logger.info(`🎯 Voice Selection Debug - Requested voice ID: "${campaignVoiceId}"`);
      
      const configuration = await mongoose.model('Configuration').findOne();
      if (!configuration || !configuration.elevenLabsConfig) {
        logger.error('❌ Voice Selection Error: ElevenLabs configuration not found');
        throw new Error('ElevenLabs configuration not found');
      }

      const availableVoices = configuration.elevenLabsConfig.availableVoices || [];
      logger.info(`📋 Available voices in configuration: ${availableVoices.length} voices`, {
        voices: availableVoices.map(v => ({ id: v.voiceId, name: v.name }))
      });
      
      if (availableVoices.length === 0) {
        logger.error('❌ Voice Selection Error: No voices configured in ElevenLabs');
        throw new Error('No voices configured in ElevenLabs. Please configure voices in the system settings.');
      }

      const matchingVoice = availableVoices.find(voice => voice.voiceId === campaignVoiceId);
      if (matchingVoice) {
        logger.info(`✅ Voice Selection Success: Found exact match - ${matchingVoice.name} (${matchingVoice.voiceId})`);
        return matchingVoice.voiceId;
      }
      
      if (campaignVoiceId === "default-voice-id" || !campaignVoiceId) {
        // Use the preferred voice ID from configuration
        const preferredVoiceId = await getPreferredVoiceId();
        
        // Check if the preferred voice exists in available voices
        const preferredVoice = availableVoices.find(voice => voice.voiceId === preferredVoiceId);
        
        if (preferredVoice) {
          logger.warn(`⚠️ Voice Selection Fallback: Using preferred voice - ${preferredVoice.name} (${preferredVoice.voiceId})`);
          return preferredVoice.voiceId;
        }
        
        // Fallback to first available voice if preferred voice not found
        const fallbackVoice = availableVoices[0];
        logger.warn(`⚠️ Voice Selection Fallback: Preferred voice not found, using first available - ${fallbackVoice.name} (${fallbackVoice.voiceId})`);
        return fallbackVoice.voiceId;
      }
      
      // If the requested voice is not found and not a default request, try to use preferred voice
      const preferredVoiceId = await getPreferredVoiceId();
      const preferredVoice = availableVoices.find(voice => voice.voiceId === preferredVoiceId);
      
      if (preferredVoice) {
        logger.warn(`⚠️ Voice Selection Fallback: Voice ID "${campaignVoiceId}" not found, using preferred voice - ${preferredVoice.name} (${preferredVoice.voiceId})`);
        return preferredVoice.voiceId;
      }
      
      // Last resort: use first available voice
      const fallbackVoice = availableVoices[0];
      logger.warn(`⚠️ Voice Selection Fallback: Voice ID "${campaignVoiceId}" not found, using first available - ${fallbackVoice.name} (${fallbackVoice.voiceId})`);
      return fallbackVoice.voiceId;
    } catch (error) {
      logger.error(`❌ Critical Voice Selection Error: ${getErrorMessage(error)}`);
      throw new Error('No voices available in configuration. Please configure voices in the system settings.');
    }
  }

  /**
   * Get available voice personalities
   */
  async getAvailablePersonalities(): Promise<any> {
    try {
      const personalities = await EnhancedVoiceAIService.getEnhancedVoicePersonalities();
      return {
        personalities,
        count: personalities.length,
        source: 'configuration'
      };
    } catch (error) {
      logger.error(`Error getting available personalities: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  /**
   * Synthesize voice with basic configuration
   */
  async synthesizeAdaptiveVoice(params: {
    text: string;
    personalityId: string;
    language?: string;
  }): Promise<any> {
    try {
      const { text, personalityId, language = 'en' } = params;
      
      logger.info(`Attempting to synthesize with personality ID: ${personalityId}`);
      
      const config = await mongoose.model('Configuration').findOne();
      if (!config || !config.elevenLabsConfig) {
        throw new Error('ElevenLabs configuration not found');
      }
      
      let personality;
      
      try {
        const personalities = await EnhancedVoiceAIService.getEnhancedVoicePersonalities();
        personality = personalities.find(p => p.id === personalityId || p.voiceId === personalityId);
      } catch (personalityError) {
        logger.warn(`Error getting enhanced personalities: ${getErrorMessage(personalityError)}`);
      }
      
      if (!personality) {
        const availableVoice = config.elevenLabsConfig.availableVoices.find(
          v => v.voiceId === personalityId
        );
        
        if (availableVoice) {
          personality = {
            id: availableVoice.voiceId,
            voiceId: availableVoice.voiceId,
            name: availableVoice.name,
            settings: {
              stability: 0.8,
              similarityBoost: 0.8,
              style: 0.3,
              useSpeakerBoost: true
            }
          };
          logger.info(`Created minimal personality from available voice: ${availableVoice.name}`);
        } else {
          const fallbackVoice = config.elevenLabsConfig.availableVoices[0];
          if (fallbackVoice) {
            personality = {
              id: fallbackVoice.voiceId,
              voiceId: fallbackVoice.voiceId,
              name: fallbackVoice.name,
              settings: {
                stability: 0.8,
                similarityBoost: 0.8,
                style: 0.3,
                useSpeakerBoost: true
              }
            };
            logger.warn(`Using fallback voice: ${fallbackVoice.name} instead of ${personalityId}`);
          } else {
            throw new Error(`No voices available in configuration`);
          }
        }
      }

      const voiceLanguage = language === 'hi' ? 'Hindi' : 'English';
      
      const voiceSettings = {
        stability: personality.settings.stability,
        similarity_boost: personality.settings.similarityBoost,
        style: personality.settings.style,
        use_speaker_boost: personality.settings.useSpeakerBoost
      };

      const response = await axios.post(
        `https://api.elevenlabs.io/v1/text-to-speech/${personality.voiceId}`,
        {
          text,
          voice_settings: voiceSettings,
          model_id: config.elevenLabsConfig.defaultModelId || 'eleven_multilingual_v2'
        },
        {
          headers: {
            'Accept': 'audio/mpeg',
            'xi-api-key': this.elevenLabsApiKey,
            'Content-Type': 'application/json'
          },
          responseType: 'arraybuffer'
        }
      );

      const audioBuffer = Buffer.from(response.data);
      logger.info(`Voice synthesis successful for voice ${personality.name}`, {
        textLength: text.length,
        audioSize: audioBuffer.length,
        language: voiceLanguage
      });

      return {
        audioContent: audioBuffer,
        metadata: {
          personality: personality.name,
          language: voiceLanguage,
          duration: Math.ceil(text.length / 15),
          voiceId: personality.voiceId
        }
      };
    } catch (error) {
      logger.error(`Error synthesizing voice: ${getErrorMessage(error)}`);
      throw new Error(`Voice synthesis failed: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Create a conversational AI interaction 
   */
  public async createRealisticConversation(
    text: string,
    voiceId: string,
    options: {
      conversationId?: string;
      previousMessages?: { role: string; content: string }[];
      language?: 'English' | 'Hindi';
      interruptible?: boolean;
      contextAwareness?: boolean;
      modelId?: string;
      onAudioChunk?: (chunk: Buffer) => void;
      onInterruption?: () => void;
      onCompletion?: (response: any) => void;
    }
  ): Promise<{
    conversationId: string;
    status: string;
    sessionInfo: any;
  }> {
    const conversationId = options.conversationId || `conv_${uuidv4()}`;
    const startTime = Date.now();
    
    logger.info(`Creating conversation ${conversationId} with voice ${voiceId}`);

    try {
      if (!this.sdkService) {
        throw new Error('SDK Service not available - check ElevenLabs API configuration');
      }

      const conversationContext = options.previousMessages || [];
      if (conversationContext.length === 0) {
        conversationContext.push({
          role: 'system',
          content: 'You are a helpful, friendly assistant. Keep your responses conversational and natural.'
        });
      }
      
      conversationContext.push({
        role: 'user',
        content: text
      });
      
      let responseText = text;
      if (options.contextAwareness !== false) {
        try {
          responseText = await this.sdkService.generateConversationResponse(
            conversationContext,
            {
              model: 'claude-3-haiku-20240307',
              temperature: 0.7,
              maxTokens: 150
            }
          );
        } catch (error) {
          logger.warn(`Context-aware response generation failed: ${getErrorMessage(error)}`);
          // NO FALLBACKS - throw error to force proper configuration
          throw new Error(`Context-aware response generation failed: ${getErrorMessage(error)}. Please ensure your system is properly configured.`);
        }
      }

      if (options.interruptible) {
        // For interruptible conversations, use streaming
        try {
          const streamingResponse = await this.sdkService.synthesizeAdaptiveVoice({
            text: responseText,
            personalityId: voiceId,
            language: options.language === 'Hindi' ? 'hi' : 'en'
          });
          
          if (options.onAudioChunk && streamingResponse.audioContent) {
            options.onAudioChunk(streamingResponse.audioContent);
          }
          
          return {
            conversationId,
            status: 'streaming',
            sessionInfo: {
              voiceId,
              interruptible: true,
              responseLength: responseText.length,
              contextSize: conversationContext.length,
              synthesisMethod: 'elevenlabs-sdk-streaming'
            }
          };
        } catch (error) {
          logger.error(`Interruptible conversation failed: ${getErrorMessage(error)}`);
          throw error;
        }
      } else {
        try {
          const adaptiveResponse = await this.sdkService.synthesizeAdaptiveVoice({
            text: responseText,
            personalityId: voiceId,
            language: options.language === 'Hindi' ? 'hi' : 'en'
          });
          
          if (options.onAudioChunk && adaptiveResponse.audioContent) {
            options.onAudioChunk(adaptiveResponse.audioContent);
          }
          
          if (options.onCompletion) {
            options.onCompletion({
              completed: true,
              interrupted: false,
              conversationId,
              metadata: adaptiveResponse.metadata
            });
          }
          
          return {
            conversationId,
            status: 'completed',
            sessionInfo: {
              voiceId,
              interruptible: false,
              audioMetadata: adaptiveResponse.metadata,
              synthesisMethod: 'elevenlabs-sdk-synthesis'
            }
          };
        } catch (error) {
          logger.error(`Error in synthesis: ${getErrorMessage(error)}`);
          
          try {
            const fallbackResponse = await this.synthesizeAdaptiveVoice({
              text: responseText,
              personalityId: voiceId,
              language: options.language === 'Hindi' ? 'hi' : 'en'
            });
            
            if (options.onAudioChunk && fallbackResponse.audioContent) {
              options.onAudioChunk(fallbackResponse.audioContent);
            }
            
            if (options.onCompletion) {
              const processingTime = Date.now() - startTime;
              options.onCompletion({
                completed: true,
                interrupted: false,
                conversationId,
                metadata: fallbackResponse.metadata,
                processingTime,
                usedFallback: true
              });
            }
            
            return {
              conversationId,
              status: 'completed',
              sessionInfo: {
                voiceId,
                interruptible: false,
                audioMetadata: fallbackResponse.metadata,
                synthesisMethod: 'fallback-synthesis',
                error: `Primary synthesis failed: ${getErrorMessage(error)}`
              }
            };
          } catch (fallbackError) {
            logger.error(`Both primary and fallback synthesis failed: ${getErrorMessage(fallbackError)}`);
            
            if (options.onCompletion) {
              options.onCompletion({
                completed: false,
                error: `Multiple synthesis methods failed: ${getErrorMessage(error)}`,
                conversationId
              });
            }
            
            throw new Error(`All synthesis methods failed: ${getErrorMessage(fallbackError)}`);
          }
        }
      }
    } catch (error) {
      const errorTime = Date.now() - startTime;
      logger.error(`Conversation creation failed after ${errorTime}ms: ${getErrorMessage(error)}`);
      
      if (options.onCompletion) {
        options.onCompletion({
          completed: false,
          error: getErrorMessage(error),
          conversationId
        });
      }
      
      return {
        conversationId,
        status: 'error',
        sessionInfo: {
          error: 'Voice services unavailable',
          errorDetails: getErrorMessage(error),
          processingTime: errorTime
        }
      };
    }
  }

  /**
   * Generate AI response based on user input and conversation context
   */
  async generateResponse(params: {
    userInput: string;
    conversationLog: any[];
    leadId: string;
    campaignId: string;
    callContext: {
      complianceComplete: boolean;
      disclosureComplete: boolean;
      currentPhase: string;
      language: string;
    };
  }): Promise<{
    text: string;
    intent: string;
  }> {
    try {
      const { userInput, conversationLog, leadId, campaignId, callContext } = params;
      
      // Convert conversation log to a clear format with roles and content
      let formattedConversationLog = '';
      if (conversationLog && conversationLog.length > 0) {
        formattedConversationLog = conversationLog.map(log => {
          const role = log.role || (log.isUser ? 'User' : 'Assistant');
          const content = log.message || log.text || '';
          return `${role}: ${content}`;
        }).join('\n');
      } else {
        formattedConversationLog = "No prior conversation";
      }
      
      // Prepare a clear system prompt that emphasizes proper JSON formatting
      const systemPrompt = `You are a professional AI assistant handling a phone call.
      
YOUR RESPONSE MUST BE VALID JSON IN THIS FORMAT ONLY:
{"text": "your response text here", "intent": "intent_type_here"}

Example valid response: {"text": "I understand your concern. How can I help?", "intent": "acknowledge_concern"}

DO NOT include anything outside the JSON. No explanations, no markdown, just the JSON object.`;

      // Prepare a clear user prompt with all necessary context
      const userPrompt = `User input: "${userInput}"
      
Previous conversation:
${formattedConversationLog}

Current call details:
- Lead ID: ${leadId || 'Not provided'}
- Campaign ID: ${campaignId || 'Not provided'}
- Current phase: ${callContext.currentPhase || 'Unknown'}
- Language: ${callContext.language || 'English'}
- Compliance complete: ${callContext.complianceComplete ? 'Yes' : 'No'}
- Disclosure complete: ${callContext.disclosureComplete ? 'Yes' : 'No'}

Generate a helpful, concise response. Remember to return ONLY valid JSON.`;

      // Check if LLM service is available
      if (!this.llmService) {
        logger.warn('LLM Service not initialized, attempting to initialize now');
        await this.initializeLLMService();
        
        if (!this.llmService) {
          // NO FALLBACKS - throw error to force proper configuration
          throw new Error('Failed to initialize LLM Service - no LLM providers configured in database. Please configure at least one LLM provider.');
        }
      }

      // Get the default provider configured in the database
      const providers = this.llmService.listProviders();
      if (providers.length === 0) {
        throw new Error('No LLM providers available');
      }

      // Use the first available provider (which should be the default one from database)
      const llmResponse = await this.llmService.chat({
        provider: providers[0],
        model: '', // Empty string will use the default model from the provider config
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        options: {
          temperature: 0.7,
          maxTokens: 200
        }
      });

      // Log the raw LLM response
      logger.info(`Raw LLM response content: ${llmResponse.content}`);

      // Parse the JSON response
      let result;
      try {
        // Clean the response before parsing (remove any non-JSON parts)
        let cleanedResponse = llmResponse.content.trim();
        
        // If response starts with backticks (like ```json), extract just the JSON part
        if (cleanedResponse.startsWith('```')) {
          const jsonStartIndex = cleanedResponse.indexOf('{');
          const jsonEndIndex = cleanedResponse.lastIndexOf('}');
          if (jsonStartIndex !== -1 && jsonEndIndex !== -1) {
            cleanedResponse = cleanedResponse.substring(jsonStartIndex, jsonEndIndex + 1);
          }
        }
        
        // Try to parse the cleaned response
        result = JSON.parse(cleanedResponse);
        
        // Validate the expected fields are present
        if (!result.text || !result.intent) {
          throw new Error('Missing required fields in JSON response');
        }
      } catch (parseError) {
        logger.error(`Error parsing LLM JSON response: ${getErrorMessage(parseError)}`);
        logger.error(`Raw LLM response that failed to parse: ${llmResponse.content}`);
        
        // It seems the LLM is sometimes returning a plain string.
        const responseText = llmResponse.content.trim();
        
        // Check for specific error cases
        if (responseText.startsWith('Please provide') || 
            responseText.includes('need more context') ||
            responseText.includes('I need the')) {
          logger.warn('LLM returned a context request, using system configuration instead');
          // NO FALLBACKS - throw error to force proper configuration
          throw new Error('LLM requires more context. Please ensure your campaign script and system configuration provide sufficient context.');
        }
        
        // If it seems like a reasonable response, use it directly
        if (responseText.length > 0 && !responseText.startsWith('{')) {
          logger.warn('LLM response was a plain string, accepting as valid response');
          return {
            text: responseText,
            intent: "direct_response"
          };
        }
        
        // NO FALLBACKS - throw error to force proper configuration
        throw new Error(`LLM returned invalid JSON response format. Please check your system configuration and LLM provider settings.`);
      }
      
      return {
        text: result.text,
        intent: result.intent
      };
    } catch (error) {
      logger.error('Error generating AI response:', error);
      // NO FALLBACKS - throw error to force proper configuration
      throw new Error(`Failed to generate AI response: ${getErrorMessage(error)}. Please ensure your LLM providers and system configuration are properly set up.`);
    }
  }

  /**
   * Get or create a voice personality by ID
   */
  async getPersonality(personalityId: string): Promise<VoicePersonality> {
    try {
      // For now, return a default personality since we removed the personality storage
      return {
        id: personalityId || uuidv4(),
        name: 'Professional Agent',
        description: 'A professional and friendly customer service agent',
        voiceId: 'default',
        personality: 'professional',
        style: 'conversational',
        settings: {
          stability: 0.75,
          similarityBoost: 0.75,
          style: 0.0,
          useSpeakerBoost: true
        }
      };
    } catch (error) {
      logger.error('Error getting personality:', error);
      throw error;
    }
  }

  /**
   * Synthesize voice from text using ElevenLabs
   */
  async synthesizeVoice(params: {
    text: string;
    personalityId?: string;
    language?: 'English' | 'Hindi';
  }): Promise<string> {
    try {
      if (!this.conversationalService) {
        throw new Error('Conversational service not initialized');
      }

      // Check for empty text
      if (!params.text || params.text.trim() === '') {
        logger.warn('Empty text provided to synthesizeVoice, using fallback text');
        params.text = 'I apologize, but there was an issue with the message.';
      }

      // Get and validate voice ID
      const voiceId = await EnhancedVoiceAIService.getValidVoiceId(params.personalityId || 'default');
      
      logger.info(`Synthesizing voice for ID: ${voiceId}, text length: ${params.text.length} chars`);

      // Set stability based on language (Hindi needs higher stability)
      const stability = params.language === 'Hindi' ? 0.85 : 0.75;
      
      const audioBuffer = await this.conversationalService.generateSpeech(
        params.text,
        voiceId,
        {
          stability,
          similarityBoost: 0.75,
          style: 0.0
        }
      );

      // Import cloudinaryService
      const cloudinaryService = await import('../utils/cloudinaryService').then(m => m.default);
      
      // If Cloudinary is configured, upload directly and return URL
      if (cloudinaryService.isCloudinaryConfigured()) {
        try {
          const cloudinaryUrl = await cloudinaryService.uploadAudioBuffer(audioBuffer);
          logger.info(`Voice synthesis uploaded to Cloudinary: ${cloudinaryUrl}`);
          
          // Store a local copy as well for backup
          const filename = `synthesis_${Date.now()}_${Math.floor(Math.random() * 1000)}.mp3`;
          const outputPath = `/tmp/${filename}`;
          require('fs').writeFileSync(outputPath, audioBuffer);
          
          // Return the Cloudinary URL if the service is expecting a URL
          if (process.env.VOICE_SYNTHESIS_RETURN_URL === 'true') {
            return cloudinaryUrl;
          }
          
          // Otherwise return the local file path for compatibility with existing code
          return outputPath;
        } catch (cloudinaryError) {
          logger.error(`Cloudinary upload failed, falling back to local file: ${cloudinaryError}`);
          // Fall back to local file if Cloudinary fails
        }
      }
      
      // Save audio to a file and return the path (fallback method)
      const filename = `synthesis_${Date.now()}_${Math.floor(Math.random() * 1000)}.mp3`;
      const outputPath = `/tmp/${filename}`;
      
      require('fs').writeFileSync(outputPath, audioBuffer);
      logger.info(`Voice synthesis complete, saved to ${outputPath}, size: ${audioBuffer.length} bytes`);
      
      return outputPath;
    } catch (error) {
      logger.error('Error synthesizing voice:', error);
      
      // Try to generate a fallback audio if possible
      try {
        if (this.conversationalService) {
          // Use the preferred voice ID and simple error message
          let fallbackVoiceId = 'pFZP5JQG7iQjIQuC4Bku'; // Default fallback voice ID
          try {
            fallbackVoiceId = await getPreferredVoiceId('pFZP5JQG7iQjIQuC4Bku'); // User's preferred voice
          } catch (voiceError) {
            logger.error(`Error getting preferred voice ID, using hardcoded fallback: ${getErrorMessage(voiceError)}`);
          }
          
          const fallbackText = 'I apologize, but there was a technical issue. Please try again later.';
          
          logger.info(`Attempting to generate fallback audio with voice ID: ${fallbackVoiceId}`);
          
          const fallbackBuffer = await this.conversationalService.generateSpeech(
            fallbackText,
            fallbackVoiceId,
            {
              stability: 0.9, // High stability for reliability
              similarityBoost: 0.75,
              style: 0.0
            }
          );
          
          // Import cloudinaryService
          const cloudinaryService = await import('../utils/cloudinaryService').then(m => m.default);
          
          // If Cloudinary is configured, upload directly
          if (cloudinaryService.isCloudinaryConfigured()) {
            try {
              const cloudinaryUrl = await cloudinaryService.uploadAudioBuffer(fallbackBuffer, 'fallbacks');
              logger.info(`Fallback audio uploaded to Cloudinary: ${cloudinaryUrl}`);
              
              // Store a local copy as well for backup
              const filename = `fallback_${Date.now()}_${Math.floor(Math.random() * 1000)}.mp3`;
              const outputPath = `/tmp/${filename}`;
              require('fs').writeFileSync(outputPath, fallbackBuffer);
              
              // Return the Cloudinary URL if the service is expecting a URL
              if (process.env.VOICE_SYNTHESIS_RETURN_URL === 'true') {
                return cloudinaryUrl;
              }
              
              // Otherwise return the local file path for compatibility with existing code
              return outputPath;
            } catch (cloudinaryError) {
              logger.error(`Cloudinary upload failed for fallback audio, using local file: ${cloudinaryError}`);
              // Fall back to local file if Cloudinary fails
            }
          }
          
          const filename = `fallback_${Date.now()}_${Math.floor(Math.random() * 1000)}.mp3`;
          const outputPath = `/tmp/${filename}`;
          
          require('fs').writeFileSync(outputPath, fallbackBuffer);
          logger.info(`Fallback audio generated successfully, saved to ${outputPath}`);
          
          return outputPath;
        }
      } catch (fallbackError) {
        logger.error('Failed to generate fallback audio:', fallbackError);
      }
      
      throw new Error(`Voice synthesis failed: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Health check for the service
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Check if ElevenLabs API key is available
      if (!this.elevenLabsApiKey) {
        return false;
      }
      
      // Check if LLM service is initialized
      if (!this.llmService) {
        await this.initializeLLMService();
      }
      
      // Basic connectivity test - just return true for now
      // In production, you might want to make actual API calls to test connectivity
      return true;
    } catch (error) {
      logger.error('Health check failed:', error);
      return false;
    }
  }

  /**
   * Synthesize adaptive voice with automatic Cloudinary upload for TwiML
   * This is a higher-level wrapper around synthesizeAdaptiveVoice that handles
   * the audio output for TwiML responses properly, ensuring large files are uploaded to Cloudinary
   */
  async synthesizeAdaptiveVoiceForTwiML(params: {
    text: string;
    personalityId: string;
    language?: string;
    twiml?: any;
    fallbackText?: string;
  }): Promise<{
    success: boolean;
    method?: 'cloudinary' | 'base64' | 'tts';
    size?: number;
  }> {
    try {
      const { text, personalityId, language = 'en', twiml, fallbackText = text } = params;
      
      // Log the request to help with debugging
      logger.info(`TwiML synthesis request for voice ID: ${personalityId}, text length: ${text.length}`);
      
      // Safety check for empty or invalid text
      if (!text || text.trim() === '') {
        logger.warn('Empty text provided to synthesizeAdaptiveVoiceForTwiML');
        
        // If twiml is provided, add fallback
        if (twiml) {
          twiml.say({ 
            voice: 'alice', 
            language: language === 'hi' ? 'hi-IN' : 'en-US' 
          }, fallbackText || "I'm sorry, there was an issue with my response.");
        }
        
        return { success: false };
      }
      
      // Synthesize the voice
      const speechResponse = await this.synthesizeAdaptiveVoice({
        text, 
        personalityId,
        language
      });
      
      // If no audio content, return failure
      if (!speechResponse || !speechResponse.audioContent) {
        logger.warn('No audio content returned from synthesizeAdaptiveVoice');
        
        // If twiml is provided, add fallback
        if (twiml) {
          twiml.say({ 
            voice: 'alice', 
            language: language === 'hi' ? 'hi-IN' : 'en-US' 
          }, fallbackText || "I'm sorry, there was an issue generating the audio response.");
        }
        
        return { success: false };
      }
      
      // Get utility functions
      const fs = require('fs');
      const path = require('path');
      const os = require('os');
      const cloudinaryService = require('../utils/cloudinaryService').default;
      const { processAudioForTwiML, prepareUrlForTwilioPlay } = require('../utils/voiceSynthesis');
      
      // Process the audio for TwiML
      const audioResult = await processAudioForTwiML(
        speechResponse.audioContent,
        fallbackText,
        language
      );
      
      // If twiml is provided, add the audio
      if (twiml) {
        if (audioResult.method === 'tts') {
          // Check if this is a chunked audio request
          if (audioResult.url && audioResult.url.startsWith('USE_CHUNKED_AUDIO:')) {
            // Extract the text and split it into manageable chunks
            const fullText = audioResult.url.substring('USE_CHUNKED_AUDIO:'.length);
            
            // Split text into chunks of roughly 500 characters each on sentence boundaries
            const chunks = this.splitTextIntoChunks(fullText);
            logger.info(`Split text into ${chunks.length} chunks for TTS to avoid TwiML size limits`);
            
            // Add each chunk as a separate say command
            for (const chunk of chunks) {
              if (chunk.trim()) { // Only add non-empty chunks
                twiml.say({ 
                  voice: 'alice', 
                  language: language === 'hi' ? 'hi-IN' : 'en-US' 
                }, chunk);
              }
            }
          } else {
            // Regular TTS fallback with the provided text
            const textToSpeak = audioResult.url || fallbackText || "I'm sorry, there was an issue with my response.";
            twiml.say({ 
              voice: 'alice', 
              language: language === 'hi' ? 'hi-IN' : 'en-US' 
            }, textToSpeak);
          }
        } else if (audioResult.url && audioResult.url.trim() !== '') {
          // Use Cloudinary URL or small base64 data only if URL is not empty
          twiml.play(prepareUrlForTwilioPlay(audioResult.url));
        } else {
          // Safeguard against empty URL - fall back to TTS
          logger.warn('Empty URL detected in audioResult, using TTS fallback');
          twiml.say({ 
            voice: 'alice', 
            language: language === 'hi' ? 'hi-IN' : 'en-US' 
          }, fallbackText || "I'm sorry, there was an issue with my response.");
        }
      }
      
      return { 
        success: true,
        method: audioResult.method,
        size: audioResult.size
      };
    } catch (error) {
      logger.error(`Error in synthesizeAdaptiveVoiceForTwiML: ${getErrorMessage(error)}`);
      
      // If twiml is provided, add fallback
      if (params.twiml) {
        params.twiml.say({ 
          voice: 'alice', 
          language: params.language === 'hi' ? 'hi-IN' : 'en-US' 
        }, params.fallbackText || params.text);
      }
      
      return { success: false };
    }
  }

  /**
   * Split a large text into smaller chunks to avoid TwiML size limits
   * This tries to split on sentence boundaries to maintain natural speech
   * @param text Full text to split
   * @param maxChunkLength Maximum length of each chunk (default: 500 characters)
   * @returns Array of text chunks
   */
  private splitTextIntoChunks(text: string, maxChunkLength: number = 250): string[] {
    if (!text) return [];
    
    // If text is already small enough, return it as a single chunk
    if (text.length <= maxChunkLength) {
      return [text];
    }

    const chunks: string[] = [];
    let currentPosition = 0;

    while (currentPosition < text.length) {
      // Determine end of current chunk (max length or earlier)
      let chunkEnd = Math.min(currentPosition + maxChunkLength, text.length);
      
      // Try to find a sentence end (., !, ?) followed by a space or end of text
      if (chunkEnd < text.length) {
        // Search backward from max chunk length for a good break point
        const sentenceEndMatch = text.substring(currentPosition, chunkEnd).match(/[.!?]\s+(?=[A-Z])/g);
        
        if (sentenceEndMatch && sentenceEndMatch.length > 0) {
          // Find the last sentence end within this chunk
          const lastIndex = text.substring(currentPosition, chunkEnd).lastIndexOf(sentenceEndMatch[sentenceEndMatch.length - 1]);
          if (lastIndex > 0) {
            // +2 to include the period and space
            chunkEnd = currentPosition + lastIndex + 2;
          }
        } else {
          // No sentence end found, try to break at a comma or space
          const commaIndex = text.substring(currentPosition, chunkEnd).lastIndexOf(', ');
          if (commaIndex > 0) {
            chunkEnd = currentPosition + commaIndex + 2; // Include the comma and space
          } else {
            // Last resort: break at the last space
            const spaceIndex = text.substring(currentPosition, chunkEnd).lastIndexOf(' ');
            if (spaceIndex > 0) {
              chunkEnd = currentPosition + spaceIndex + 1; // Include the space
            }
            // If no space found, we'll just break at maxChunkLength
          }
        }
      }
      
      // Add the chunk to our results
      chunks.push(text.substring(currentPosition, chunkEnd).trim());
      
      // Move to next position
      currentPosition = chunkEnd;
    }
    
    return chunks;
  }
}

// Export class only - instances are created with proper parameters elsewhere
