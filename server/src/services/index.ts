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
export const voiceAIService = new EnhancedVoiceAIService('', '');
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