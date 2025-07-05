// Export all services from a central file for easier imports
import ConversationEngineService from './conversationEngineService';
import { EnhancedVoiceAIService } from './enhancedVoiceAIService';
import { LLMService } from './llm/service';
import SpeechAnalysisService from './speechAnalysisService';
import VoiceAIService from './voiceAIService';
import { AdvancedTelephonyService } from './advancedTelephonyService';
import { advancedTelephonyService } from './advancedTelephonyService';
import { AdvancedConversationEngine } from './advancedConversationEngine';
import { AdvancedCampaignService, advancedCampaignService } from './advancedCampaignService';
import { conversationStateMachine } from './conversationStateMachine';
import { logger } from '../index';

// Import webhook handlers individually for proper re-export
import {
  handleTwilioVoiceWebhook,
  handleTwilioStatusWebhook,
  handleTwilioGatherWebhook,
  handleTwilioStreamWebhook,
  updateCallWithOutcome
} from './webhookHandlers';

import Configuration from '../models/Configuration';

// Create instances for services that need to be shared
// These services will load configuration from database on initialization
let elevenLabsApiKey = '';
let openAIApiKey = '';
let anthropicApiKey = '';
let googleSpeechKey = '';
let deepgramApiKey = '';

// Initialize API keys from database configuration
const initializeFromDatabase = async () => {
  try {
    // Check if mongoose is connected
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
      console.warn('MongoDB not connected yet. Skipping API key initialization.');
      return;
    }

    console.log('Loading API configuration from database...');
    const config = await Configuration.findOne();
    if (config) {
      elevenLabsApiKey = config.elevenLabsConfig?.apiKey || '';
      
      const openAIProvider = config.llmConfig?.providers?.find((p: any) => p.name === 'openai');
      openAIApiKey = openAIProvider?.apiKey || '';
      
      const anthropicProvider = config.llmConfig?.providers?.find((p: any) => p.name === 'anthropic');
      anthropicApiKey = anthropicProvider?.apiKey || '';
      
      const googleProvider = config.llmConfig?.providers?.find((p: any) => p.name === 'google');
      googleSpeechKey = googleProvider?.apiKey || '';
      
      // Get deepgram API key
      const deepgramProvider = config.llmConfig?.providers?.find((p: any) => p.name === 'deepgram');
      deepgramApiKey = deepgramProvider?.apiKey || '';

      // Log API key status (showing length for security, not actual keys)
      console.log('API keys loaded from database:', {
        elevenLabsApiKey: elevenLabsApiKey ? `SET (${elevenLabsApiKey.length} chars)` : 'NOT SET',
        openAIApiKey: openAIApiKey ? `SET (${openAIApiKey.length} chars)` : 'NOT SET',
        anthropicApiKey: anthropicApiKey ? `SET (${anthropicApiKey.length} chars)` : 'NOT SET',
        googleSpeechKey: googleSpeechKey ? `SET (${googleSpeechKey.length} chars)` : 'NOT SET'
      });
    } else {
      console.warn('No configuration document found in database');
    }
  } catch (error) {
    console.warn('Failed to load configuration from database, using empty keys:', error);
  }
};

// Initialize services with database configuration or empty keys
const getInitializedKeys = async () => {
  await initializeFromDatabase();
  return {
    elevenLabsApiKey,
    openAIApiKey,
    anthropicApiKey,
    googleSpeechKey
  };
};

// Use lazy initialization pattern to avoid creating services with empty API keys
let _conversationEngine: ConversationEngineService | null = null;
let _voiceAIService: EnhancedVoiceAIService | null = null;
let _llmService: LLMService | null = null;
let _advancedConversationEngine: AdvancedConversationEngine | null = null;

// Flag to track if services have been properly initialized with database configuration
let servicesInitialized = false;

// Getter functions that ensure services are initialized before returning
export const getConversationEngine = (): ConversationEngineService => {
  if (!_conversationEngine) {
    console.warn('ConversationEngine accessed before initialization, creating with empty keys');
    // Create with empty services
    const voiceAI = new EnhancedVoiceAIService('');
    const speechAnalysis = new SpeechAnalysisService('', '', '');
    const llmService = new LLMService({
      providers: [
        { name: 'openai', apiKey: '', isEnabled: true }
      ]
    });
    _conversationEngine = new ConversationEngineService(voiceAI, speechAnalysis, llmService);
  }
  return _conversationEngine;
};

export const getVoiceAIService = (): EnhancedVoiceAIService => {
  if (!_voiceAIService) {
    console.warn('VoiceAIService accessed before initialization, creating with empty key');
    _voiceAIService = new EnhancedVoiceAIService('');
  }
  return _voiceAIService;
};

export const getLLMService = (): LLMService => {
  if (!_llmService) {
    console.warn('LLMService accessed before initialization, creating with empty config');
    _llmService = new LLMService({
      providers: [],
      fallbackProviders: [],
      timeoutMs: 30000
    });
    // Make the LLM service available globally
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).llmService = _llmService;
  }
  return _llmService;
};

export const getAdvancedConversationEngine = (): AdvancedConversationEngine => {
  if (!_advancedConversationEngine) {
    console.warn('AdvancedConversationEngine accessed before initialization, creating with lazy services');
    _advancedConversationEngine = new AdvancedConversationEngine(getLLMService(), getVoiceAIService());
  }
  return _advancedConversationEngine;
};

// Legacy exports for backward compatibility (use getters internally)
export const conversationEngine = new Proxy({} as ConversationEngineService, {
  get: (target, prop) => getConversationEngine()[prop as keyof ConversationEngineService],
  set: (target, prop, value) => {
    (getConversationEngine() as any)[prop] = value;
    return true;
  }
});

export const voiceAIService = new Proxy({} as EnhancedVoiceAIService, {
  get: (target, prop) => getVoiceAIService()[prop as keyof EnhancedVoiceAIService],
  set: (target, prop, value) => {
    (getVoiceAIService() as any)[prop] = value;
    return true;
  }
});

export const llmService = new Proxy({} as LLMService, {
  get: (target, prop) => getLLMService()[prop as keyof LLMService],
  set: (target, prop, value) => {
    (getLLMService() as any)[prop] = value;
    return true;
  }
});

export const advancedConversationEngine = new Proxy({} as AdvancedConversationEngine, {
  get: (target, prop) => getAdvancedConversationEngine()[prop as keyof AdvancedConversationEngine],
  set: (target, prop, value) => {
    (getAdvancedConversationEngine() as any)[prop] = value;
    return true;
  }
});

// Export the conversation state machine
export { conversationStateMachine };

// Export webhook handlers individually - THIS IS THE KEY CHANGE
export {
  handleTwilioVoiceWebhook,
  handleTwilioStatusWebhook,
  handleTwilioGatherWebhook,
  handleTwilioStreamWebhook,
  updateCallWithOutcome
};

// Also export as namespace for backward compatibility if needed
export * as webhookHandlers from './webhookHandlers';

// Export analytics services
export { callAnalyticsService } from './callAnalyticsService';
export { callMonitoring } from '../monitoring/callMonitoring';

// Export individual services
export {
  ConversationEngineService,
  EnhancedVoiceAIService,
  LLMService,
  SpeechAnalysisService,
  VoiceAIService,
  AdvancedTelephonyService,
  AdvancedConversationEngine,
  AdvancedCampaignService
};

// Export service instances
export {
  advancedTelephonyService,
  advancedCampaignService
};

// Export initialization function for post-database services
export const initializeServicesAfterDB = async () => {
  try {
    console.log('Starting services initialization after database connection...');
    
    // Re-initialize services that depend on database configuration
    await initializeFromDatabase();
    
    console.log('About to initialize services with keys:', {
      hasElevenLabsKey: !!elevenLabsApiKey,
      hasOpenAIKey: !!openAIApiKey,
      elevenLabsKeyLength: elevenLabsApiKey?.length || 0,
      openAIKeyLength: openAIApiKey?.length || 0
    });
    
    // Initialize services with proper API keys from database
    if (elevenLabsApiKey || openAIApiKey || anthropicApiKey || googleSpeechKey) {
      console.log('Initializing services with API keys from database...');
      
      // Initialize VoiceAI service with ElevenLabs API key
      if (elevenLabsApiKey) {
        _voiceAIService = new EnhancedVoiceAIService(elevenLabsApiKey);
        console.log('VoiceAI service initialized with API key');
      } else {
        _voiceAIService = new EnhancedVoiceAIService('');
      }
      
      // Initialize speech analysis service
      const speechAnalysis = new SpeechAnalysisService(
        openAIApiKey || '', 
        googleSpeechKey || '', 
        deepgramApiKey || ''
      );
      
      // Initialize LLM service
      const llmService = new LLMService({
        providers: [
          { name: 'openai', apiKey: openAIApiKey || '', isEnabled: !!openAIApiKey },
          { name: 'anthropic', apiKey: anthropicApiKey || '', isEnabled: !!anthropicApiKey }
        ]
      });
      
      // Initialize ConversationEngine with all services
      _conversationEngine = new ConversationEngineService(
        _voiceAIService,
        speechAnalysis,
        llmService
      );
      
      // Initialize LLM service with proper configuration
      await reinitializeGlobalLLMService();
      
      // Initialize advanced conversation engine with initialized services
      _advancedConversationEngine = new AdvancedConversationEngine(getLLMService(), getVoiceAIService());
      
      servicesInitialized = true;
      console.log('Core services initialized with database configuration');
    } else {
      console.warn('No API keys found in database, services will remain with empty configuration');
    }

    // Import and call reinitializeLLMServiceWithDbConfig to ensure campaign service LLM is properly initialized
    const { reinitializeLLMServiceWithDbConfig } = await import('./advancedCampaignService');
    await reinitializeLLMServiceWithDbConfig();
    
    // Initialize ElevenLabs services if API keys are available
    if (elevenLabsApiKey && openAIApiKey) {
      try {
        console.log('Initializing ElevenLabs services with API keys from database...');
        
        // Re-initialize the ElevenLabs Conversational Service with the database API keys
        const { initializeConversationalService } = await import('./elevenLabsConversationalService');
        initializeConversationalService(elevenLabsApiKey, openAIApiKey);
        console.log('ElevenLabs Conversational Service initialized');
        
        // Re-initialize the ElevenLabs SDK Service with the database API keys
        const { initializeSDKService } = await import('./elevenlabsSDKService');
        const sdkService = initializeSDKService(elevenLabsApiKey, openAIApiKey);
        console.log('ElevenLabs SDK Service initialized:', !!sdkService);
        
        // Load the SDK extension with streaming methods
        await import('./elevenlabsSDKExtension');
        
        // Initialize optimized stream controllers
        const { initialize: initializeOptimizedController } = await import('../controllers/optimizedStreamController');
        await initializeOptimizedController();
        
        // Initialize low-latency stream controller
        const { initialize: initializeLowLatencyController } = await import('../controllers/lowLatencyStreamController');
        await initializeLowLatencyController();
        
        // Initialize parallel processing service if SDK service is available
        if (sdkService) {
          const { initializeParallelProcessingService } = await import('./parallelProcessingService');
          initializeParallelProcessingService(sdkService, getLLMService());
          logger.info('Parallel processing service initialized for low-latency responses');
        }
        
        console.log('Voice AI services initialized with database configuration');
        logger.info('Voice AI services initialized with database configuration');
      } catch (voiceAIError) {
        console.error('Failed to initialize Voice AI services:', voiceAIError);
        logger.error('Failed to initialize Voice AI services:', voiceAIError);
      }
    } else {
      console.warn('Skipping voice services initialization - missing API keys:', {
        hasElevenLabsKey: !!elevenLabsApiKey,
        hasOpenAIKey: !!openAIApiKey
      });
    }
    
    // Update global conversation engine if it exists
    if (global.conversationEngine && typeof global.conversationEngine.updateApiKeys === 'function') {
      try {
        global.conversationEngine.updateApiKeys(elevenLabsApiKey, openAIApiKey, anthropicApiKey, googleSpeechKey);
        logger.info('Global conversation engine updated with database configuration');
      } catch (error) {
        logger.error('Failed to update global conversation engine API keys:', error);
      }
    }
    
    // Update telephony service configuration
    try {
      await advancedTelephonyService.updateConfiguration();
      logger.info('Advanced telephony service configuration updated from database');
    } catch (error) {
      logger.error('Failed to update telephony service configuration:', error);
    }
    
    console.log('All services re-initialized with database configuration');
  } catch (error) {
    console.error('Error re-initializing services after database connection:', error);
  }
};

// Function to reinitialize global LLM service with database configuration
export const reinitializeGlobalLLMService = async () => {
  try {
    const config = await Configuration.findOne();
    if (config && config.llmConfig?.providers) {
      // Transform database configuration to LLM service configuration
      const llmConfig = {
        providers: config.llmConfig.providers.map(p => ({
          name: p.name.toLowerCase() as any,
          apiKey: p.apiKey,
          isEnabled: p.isEnabled,
          models: p.availableModels || [],
          defaultModel: p.availableModels && p.availableModels.length > 0 ? p.availableModels[0] : undefined,
          useRealtimeAPI: p.useRealtimeAPI || false // Ensure this is included in the LLM service config
        })),
        defaultProvider: (config.llmConfig.defaultProvider?.toLowerCase() || 'openai') as any,
        defaultModel: config.llmConfig.defaultModel || 'gpt-4',
        timeoutMs: 30000,
        retryConfig: {
          maxRetries: 2,
          initialDelayMs: 1000,
          maxDelayMs: 5000
        }
      };
      
      // Create or update the LLM service with proper configuration
      if (!_llmService) {
        _llmService = new LLMService(llmConfig);
      } else {
        // Update the existing service configuration
        _llmService.updateConfig(llmConfig);
      }
      
      // Make the LLM service available globally
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (global as any).llmService = _llmService;
      
      // Store the llmService instance in the configuration for shared access across controllers
      // This is stored as a property but not persisted to the database
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (config as any).llmConfig.llmService = _llmService;
      
      logger.info('Global LLM service reinitialized with database configuration and stored for shared access');
    } else {
      logger.warn('No LLM configuration found in database for global service');
    }
  } catch (error) {
    logger.error('Failed to reinitialize global LLM service:', error);
  }
};