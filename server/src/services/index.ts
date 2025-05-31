// Export all services from a central file for easier imports
import { ConversationEngineService } from './conversationEngineService';
import EnhancedVoiceAIService from './enhancedVoiceAIService';
import LLMService from './llmService';
import SpeechAnalysisService from './speechAnalysisService';
import VoiceAIService from './voiceAIService';
import { AdvancedTelephonyService, advancedTelephonyService } from './advancedTelephonyService';
import { AdvancedConversationEngine } from './advancedConversationEngine';
import { AdvancedCampaignService, advancedCampaignService } from './advancedCampaignService';

// Create instances for services that need to be shared
const elevenLabsApiKey = process.env.ELEVEN_LABS_API_KEY || '';
const openAIApiKey = process.env.OPENAI_API_KEY || '';
const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
const googleSpeechKey = process.env.GOOGLE_SPEECH_KEY;

export const conversationEngine = new ConversationEngineService(
  elevenLabsApiKey,
  openAIApiKey,
  anthropicApiKey,
  googleSpeechKey
);

// Create service instances for controllers
export const voiceAIService = new EnhancedVoiceAIService(elevenLabsApiKey, openAIApiKey);
export const llmService = new LLMService(openAIApiKey, anthropicApiKey);

// Create advanced service instances
export const advancedConversationEngine = new AdvancedConversationEngine(llmService, voiceAIService);

export const emotionDetectionService = {
  analyzeAudioEmotion: async (audioData: any) => {
    // For audio emotion detection, we would need audio processing
    // For now, we'll use text-based emotion detection as a fallback
    const textApproximation = 'Audio speech analysis';
    return await voiceAIService.detectEmotionWithCulturalContext(textApproximation);
  },
  analyzeTextEmotion: async (text: string, language: string = 'en') => {
    const lang = language === 'hi' ? 'Hindi' : 'English';
    return await voiceAIService.detectEmotionWithCulturalContext(text, lang as 'English' | 'Hindi');
  },
  getMetrics: async (params: { timeRange: string; personalityId: string }) => {
    // Mock metrics for demonstration
    return {
      emotionAccuracy: 0.92,
      detectionCount: 1247,
      averageConfidence: 0.85,
      emotionDistribution: {
        interested: 35,
        neutral: 28,
        frustrated: 15,
        excited: 12,
        confused: 10
      },
      culturalAdaptations: 156,
      timeRange: params.timeRange,
      personalityId: params.personalityId,
      trends: {
        accuracyTrend: '+2.3%',
        volumeTrend: '+15.7%',
        confidenceTrend: '+1.8%'
      }
    };
  }
};

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
