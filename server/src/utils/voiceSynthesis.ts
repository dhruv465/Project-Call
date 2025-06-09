import { EnhancedVoiceAIService } from '../services/enhancedVoiceAIService';
import Configuration from '../models/Configuration';
import Campaign from '../models/Campaign';
import logger from './logger';
import { getErrorMessage } from './logger';
import fs from 'fs';
import path from 'path';

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
    fallbackBehavior?: 'silent' | 'empty-audio' | 'tts';
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
      logger.warn('Empty text provided to synthesizeVoiceResponse');
      twiml.play('');
      return false;
    }

    // Log the request for debugging
    logger.info(`Synthesizing voice response: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`);
    
    // Check if we should use a fallback audio file
    const shouldUseFallback = await checkShouldUseFallback(text);
    if (shouldUseFallback) {
      logger.info('Using pre-generated fallback audio for common phrase');
      twiml.play(shouldUseFallback);
      return true;
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
      
      // Check ElevenLabs status - if failed, use fallback immediately
      if (config.elevenLabsConfig.status === 'failed') {
        const lastVerifiedTime = config.elevenLabsConfig.lastVerified;
        const now = new Date();
        
        // If last verification was within the last hour, use fallback
        if (lastVerifiedTime && (now.getTime() - lastVerifiedTime.getTime() < 3600000)) {
          logger.warn('ElevenLabs verification recently failed, using fallback');
          twiml.play('');
          return false;
        }
      }
      
      // Initialize voice service with configuration values
      const voiceAI = new EnhancedVoiceAIService(
        config.elevenLabsConfig.apiKey
      );
      
      try {
        // Resolve voice ID - try campaign-specific voice first if campaignId is provided
        let finalVoiceId = config.voiceAIConfig?.conversationalAI?.defaultVoiceId || '21m00Tcm4TlvDq8ikWAM';
        
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
        const speechResponse = await voiceAI.synthesizeVoice({
          text,
          personalityId: finalVoiceId,
          language: language === 'en' ? 'English' : 'Hindi'
        });
        
        // Check if the file exists and is not empty
        if (fs.existsSync(speechResponse) && fs.statSync(speechResponse).size > 0) {
          logger.debug(`Successfully synthesized speech: ${speechResponse}`);
          
          // Convert file to base64 for TwiML
          const audioBuffer = fs.readFileSync(speechResponse);
          const audioBase64 = audioBuffer.toString('base64');
          const audioDataUrl = `data:audio/mpeg;base64,${audioBase64}`;
          
          twiml.play(audioDataUrl);
          return true;
        } else {
          throw new Error('Synthesized file is empty or does not exist');
        }
      } catch (serviceError) {
        logger.error(`Voice synthesis service error: ${getErrorMessage(serviceError)}`);
        
        // Mark as failed in the database if this was an API error
        if (serviceError.message.includes('API') || serviceError.message.includes('400')) {
          await Configuration.findOneAndUpdate(
            {}, 
            { 
              'elevenLabsConfig.lastVerified': new Date(),
              'elevenLabsConfig.status': 'failed'
            }
          );
        }
        
        throw serviceError; // Re-throw to be caught by outer catch
      }
    } else {
      // Use provided API keys
      const voiceAI = new EnhancedVoiceAIService(elevenLabsApiKey);
      
      // Resolve voice ID
      const finalVoiceId = requestedVoiceId ? 
        await EnhancedVoiceAIService.getValidVoiceId(requestedVoiceId) : 
        '21m00Tcm4TlvDq8ikWAM'; // Default to Rachel
      
      // Synthesize speech
      const filePath = await voiceAI.synthesizeVoice({
        text,
        personalityId: finalVoiceId,
        language: language === 'en' ? 'English' : 'Hindi'
      });
      
      // Check if the file exists and is not empty
      if (fs.existsSync(filePath) && fs.statSync(filePath).size > 0) {
        // Convert file to base64 for TwiML
        const audioBuffer = fs.readFileSync(filePath);
        const audioBase64 = audioBuffer.toString('base64');
        const audioDataUrl = `data:audio/mpeg;base64,${audioBase64}`;
        
        twiml.play(audioDataUrl);
        return true;
      } else {
        throw new Error('Synthesized file is empty or does not exist');
      }
    }
  } catch (error) {
    logger.error(`Error in voice synthesis: ${getErrorMessage(error)}`);
    
    // Use fallback behavior
    if (fallbackBehavior === 'silent') {
      // Don't add anything to the TwiML
    } else if (fallbackBehavior === 'tts') {
      // Use Twilio's built-in TTS as a last resort
      twiml.say({ voice: 'alice' }, text);
    } else {
      // Default to empty audio
      twiml.play('');
    }
    
    return false;
  }
}

/**
 * Check if we should use a pre-generated fallback audio for common phrases
 * @param text The text to check
 * @returns Path to fallback audio if available, false otherwise
 */
async function checkShouldUseFallback(text: string): Promise<string | false> {
  const normalizedText = text.trim().toLowerCase();
  
  // Map of common phrases to fallback audio files
  // These would typically be pre-generated and stored in a static directory
  const commonPhrases: Record<string, string> = {
    'hello': '/tmp/fallback_hello.mp3',
    'goodbye': '/tmp/fallback_goodbye.mp3',
    'thank you': '/tmp/fallback_thank_you.mp3',
    'i\'m sorry, but there was a technical issue': '/tmp/fallback_error.mp3',
    'please try again later': '/tmp/fallback_try_again.mp3'
  };
  
  // Check for exact matches
  if (commonPhrases[normalizedText]) {
    // Verify file exists
    if (fs.existsSync(commonPhrases[normalizedText])) {
      return commonPhrases[normalizedText];
    }
  }
  
  // Check for phrases contained in the text
  for (const [phrase, audioPath] of Object.entries(commonPhrases)) {
    if (normalizedText.includes(phrase) && fs.existsSync(audioPath)) {
      return audioPath;
    }
  }
  
  return false;
}
