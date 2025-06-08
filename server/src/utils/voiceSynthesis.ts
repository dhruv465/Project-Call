import { EnhancedVoiceAIService } from '../services/enhancedVoiceAIService';
import Configuration from '../models/Configuration';
import Campaign from '../models/Campaign';
import logger from './logger';
import { getErrorMessage } from './logger';

/**
 * Utility to synthesize voice using ElevenLabs with proper fallback handling
 * @param twiml Twilio TwiML response object to add the synthesized speech to
 * @param text Text to synthesize
 * @param options Additional options for voice synthesis
 * @returns Promise resolving to true if ElevenLabs was used, false if fallback was used
 */
export async function synthesizeVoiceResponse(
  twiml: any,
  text: string,
  options: {
    voiceId?: string;
    language?: string;
    elevenLabsApiKey?: string;
    openAIApiKey?: string;
    campaignId?: string;
    fallbackBehavior?: 'silent' | 'empty-audio';
  }
): Promise<boolean> {
  const {
    voiceId: requestedVoiceId,
    language = 'en',
    elevenLabsApiKey,
    openAIApiKey,
    campaignId,
    fallbackBehavior = 'empty-audio'
  } = options;

  try {
    // Skip if text is empty
    if (!text || text.trim() === '') {
      twiml.play('');
      return false;
    }

    // Get configuration for ElevenLabs if not provided
    if (!elevenLabsApiKey || !openAIApiKey) {
      const config = await Configuration.findOne();
      
      // Exit early if ElevenLabs is not configured
      if (!config?.elevenLabsConfig?.isEnabled || !config?.elevenLabsConfig?.apiKey) {
        logger.debug('ElevenLabs not configured, using empty audio fallback');
        twiml.play('');
        return false;
      }
      
      // Find OpenAI provider
      const openAIProvider = config.llmConfig.providers.find(p => p.name === 'openai');
      if (!openAIProvider?.isEnabled || !openAIProvider?.apiKey) {
        logger.debug('OpenAI provider not configured, using empty audio fallback');
        twiml.play('');
        return false;
      }
      
      // Initialize voice service with configuration values
      const voiceAI = new EnhancedVoiceAIService(
        config.elevenLabsConfig.apiKey,
        openAIProvider.apiKey
      );
      
      // Resolve voice ID - try campaign-specific voice first if campaignId is provided
      let finalVoiceId = config.voiceAIConfig?.conversationalAI?.defaultVoiceId || 'XvRdSQXvmv5jHPGBw0XU';
      
      if (campaignId) {
        try {
          const campaign = await Campaign.findById(campaignId);
          if (campaign?.voiceConfiguration?.voiceId) {
            const campaignVoiceId = campaign.voiceConfiguration.voiceId;
            finalVoiceId = await EnhancedVoiceAIService.getValidVoiceId(campaignVoiceId);
            logger.debug(`Using campaign voice ID for synthesis: ${finalVoiceId}`);
          }
        } catch (error) {
          logger.error(`Error fetching campaign voice: ${getErrorMessage(error)}`);
        }
      } else if (requestedVoiceId) {
        // If a specific voice ID was requested, try to use it
        finalVoiceId = await EnhancedVoiceAIService.getValidVoiceId(requestedVoiceId);
        logger.debug(`Using requested voice ID for synthesis: ${finalVoiceId}`);
      }
      
      // Synthesize speech
      const speechResponse = await voiceAI.synthesizeAdaptiveVoice({
        text,
        personalityId: finalVoiceId,
        language
      });
      
      // Add synthesized audio to TwiML if successful
      if (speechResponse.audioContent) {
        const audioBase64 = speechResponse.audioContent.toString('base64');
        const audioDataUrl = `data:audio/mpeg;base64,${audioBase64}`;
        twiml.play(audioDataUrl);
        return true;
      }
    } else {
      // Use provided API keys
      const voiceAI = new EnhancedVoiceAIService(elevenLabsApiKey, openAIApiKey);
      
      // Resolve voice ID
      const finalVoiceId = requestedVoiceId ? 
        await EnhancedVoiceAIService.getValidVoiceId(requestedVoiceId) : 
        'XvRdSQXvmv5jHPGBw0XU';
      
      // Synthesize speech
      const speechResponse = await voiceAI.synthesizeAdaptiveVoice({
        text,
        personalityId: finalVoiceId,
        language
      });
      
      // Add synthesized audio to TwiML if successful
      if (speechResponse.audioContent) {
        const audioBase64 = speechResponse.audioContent.toString('base64');
        const audioDataUrl = `data:audio/mpeg;base64,${audioBase64}`;
        twiml.play(audioDataUrl);
        return true;
      }
    }
    
    // If we reach here, synthesis failed or returned no audio
    logger.debug('Voice synthesis failed or returned no audio, using empty audio fallback');
    twiml.play('');
    return false;
  } catch (error) {
    logger.error(`Error in voice synthesis: ${getErrorMessage(error)}`);
    
    // Use fallback behavior
    if (fallbackBehavior === 'silent') {
      // Don't add anything to the TwiML
    } else {
      // Default to empty audio to avoid Polly
      twiml.play('');
    }
    
    return false;
  }
}
