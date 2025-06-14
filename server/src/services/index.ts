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

// Initialize API keys from database configuration
const initializeFromDatabase = async () => {
  try {
    // Check if mongoose is connected
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
      console.warn('MongoDB not connected yet. Skipping API key initialization.');
      return;
    }

    const config = await Configuration.findOne();
    if (config) {
      elevenLabsApiKey = config.elevenLabsConfig?.apiKey || '';
      
      const openAIProvider = config.llmConfig?.providers?.find((p: any) => p.name === 'openai');
      openAIApiKey = openAIProvider?.apiKey || '';
      
      const anthropicProvider = config.llmConfig?.providers?.find((p: any) => p.name === 'anthropic');
      anthropicApiKey = anthropicProvider?.apiKey || '';
      
      const googleProvider = config.llmConfig?.providers?.find((p: any) => p.name === 'google');
      googleSpeechKey = googleProvider?.apiKey || '';
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

// Initialize with empty keys for now - services will reload from database as needed
export const conversationEngine = new ConversationEngineService('', '', '', '');

// Create service instances for controllers
export const voiceAIService = new EnhancedVoiceAIService('');
export const llmService = new LLMService({
  providers: [],
  fallbackProviders: [],
  timeoutMs: 30000
});

// Create advanced service instances
export const advancedConversationEngine = new AdvancedConversationEngine(llmService, voiceAIService);

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
    // Re-initialize services that depend on database configuration
    await initializeFromDatabase();
    
    // Import and call reinitializeLLMServiceWithDbConfig to ensure LLM service is properly initialized
    const { reinitializeLLMServiceWithDbConfig } = await import('./advancedCampaignService');
    await reinitializeLLMServiceWithDbConfig();
    
    // Also reinitialize the global LLM service instance
    await reinitializeGlobalLLMService();
    
    // Note: AdvancedCampaignService will self-initialize when methods are called
    // due to the ensureLLMServiceInitialized pattern implemented
    
    // Reinitialize voice services with new instances that have the latest API keys
    if (elevenLabsApiKey && openAIApiKey) {
      try {
        // Re-initialize the ElevenLabs Conversational Service with the database API keys
        const { initializeConversationalService } = await import('./elevenLabsConversationalService');
        initializeConversationalService(elevenLabsApiKey, openAIApiKey);
        
        // Re-initialize the ElevenLabs SDK Service with the database API keys
        const { initializeSDKService } = await import('./elevenlabsSDKService');
        const sdkService = initializeSDKService(elevenLabsApiKey, openAIApiKey);
        
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
          initializeParallelProcessingService(sdkService, llmService);
          logger.info('Parallel processing service initialized for low-latency responses');
        }
        
        // For EnhancedVoiceAIService, since there's no updateApiKeys method,
        // we'll create a new instance with the new keys
        const newVoiceAIService = new EnhancedVoiceAIService(elevenLabsApiKey);
        
        // Replace the global reference if it exists
        if (global.voiceAIService) {
          global.voiceAIService = newVoiceAIService;
        }
        
        // Update the exported instance
        exports.voiceAIService = newVoiceAIService;
        
        logger.info('Voice AI services re-initialized with database configuration');
      } catch (voiceAIError) {
        logger.error('Failed to reinitialize Voice AI services:', voiceAIError);
      }
    }
    
    // Reinitialize conversation engine with new API keys
    if (global.conversationEngine && typeof global.conversationEngine.updateApiKeys === 'function') {
      try {
        global.conversationEngine.updateApiKeys(elevenLabsApiKey, openAIApiKey, anthropicApiKey, googleSpeechKey);
        logger.info('Conversation engine re-initialized with database configuration');
      } catch (error) {
        logger.error('Failed to update conversation engine API keys:', error);
      }
    }
    
    // Update telephony service configuration
    try {
      await advancedTelephonyService.updateConfiguration();
      logger.info('Advanced telephony service configuration updated from database');
    } catch (error) {
      logger.error('Failed to update telephony service configuration:', error);
    }
    
    console.log('Services re-initialized with database configuration');
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
          defaultModel: p.availableModels && p.availableModels.length > 0 ? p.availableModels[0] : undefined
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
      
      // Update the global LLM service configuration
      llmService.updateConfig(llmConfig);
      
      logger.info('Global LLM service reinitialized with database configuration');
    } else {
      logger.warn('No LLM configuration found in database for global service');
    }
  } catch (error) {
    logger.error('Failed to reinitialize global LLM service:', error);
  }
};