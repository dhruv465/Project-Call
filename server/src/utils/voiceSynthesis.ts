import { EnhancedVoiceAIService } from '../services/enhancedVoiceAIService';
import Configuration from '../models/Configuration';
import Campaign from '../models/Campaign';
import logger from './logger';
import { getErrorMessage } from './logger';
import fs from 'fs';
import path from 'path';
import { getPreferredVoiceId } from './voiceUtils';
import cloudinaryService from './cloudinaryService';

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
    llmApiKey?: string; // Changed from openAIApiKey to be more generic
    campaignId?: string;
    fallbackBehavior?: 'silent' | 'empty-audio' | 'tts';
  }
): Promise<boolean> {
  const {
    voiceId: requestedVoiceId,
    language = 'en',
    elevenLabsApiKey,
    llmApiKey, // Use the more generic llmApiKey
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
    if (!elevenLabsApiKey || !llmApiKey) {
      const config = await Configuration.findOne();
      
      // Exit early if ElevenLabs is not configured
      if (!config?.elevenLabsConfig?.isEnabled || !config?.elevenLabsConfig?.apiKey) {
        logger.debug('ElevenLabs not configured, using empty audio fallback');
        twiml.play('');
        return false;
      }
      
      // Find the default LLM provider
      const defaultProviderName = config.llmConfig.defaultProvider;
      const defaultProvider = config.llmConfig.providers.find(p => p.name === defaultProviderName);
      
      if (!defaultProvider?.isEnabled || !defaultProvider?.apiKey) {
        logger.debug(`Default LLM provider ${defaultProviderName} not configured, using empty audio fallback`);
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
        // Use the preferred voice ID from configuration instead of hardcoded value
        let finalVoiceId = await getPreferredVoiceId();
        
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
          
          // Instead of embedding as base64, upload to Cloudinary
          if (cloudinaryService.isCloudinaryConfigured()) {
            try {
              // Upload the file to Cloudinary
              const cloudinaryUrl = await cloudinaryService.uploadAudioFile(speechResponse);
              
              // Use the Cloudinary URL in TwiML
              twiml.play(cloudinaryUrl);
              logger.info(`Using Cloudinary URL for audio: ${cloudinaryUrl}`);
              return true;
            } catch (cloudinaryError) {
              logger.error(`Cloudinary upload failed, falling back to base64: ${getErrorMessage(cloudinaryError)}`);
              // Fall back to base64 if Cloudinary fails
              const audioBuffer = fs.readFileSync(speechResponse);
              const audioBase64 = audioBuffer.toString('base64');
              const audioDataUrl = `data:audio/mpeg;base64,${audioBase64}`;
              
              twiml.play(audioDataUrl);
              return true;
            }
          } else {
            // If Cloudinary is not configured, use base64 encoding
            logger.warn('Cloudinary not configured, using base64 audio encoding (may exceed TwiML size limits)');
            const audioBuffer = fs.readFileSync(speechResponse);
            const audioBase64 = audioBuffer.toString('base64');
            const audioDataUrl = `data:audio/mpeg;base64,${audioBase64}`;
            
            twiml.play(audioDataUrl);
            return true;
          }
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
        await getPreferredVoiceId('pFZP5JQG7iQjIQuC4Bku'); // Use preferred voice from config
      
      // Synthesize speech
      const filePath = await voiceAI.synthesizeVoice({
        text,
        personalityId: finalVoiceId,
        language: language === 'en' ? 'English' : 'Hindi'
      });
      
      // Check if the file exists and is not empty
      if (fs.existsSync(filePath) && fs.statSync(filePath).size > 0) {
        // Instead of embedding as base64, upload to Cloudinary
        if (cloudinaryService.isCloudinaryConfigured()) {
          try {
            // Upload the file to Cloudinary
            const cloudinaryUrl = await cloudinaryService.uploadAudioFile(filePath);
            
            // Use the Cloudinary URL in TwiML
            twiml.play(cloudinaryUrl);
            logger.info(`Using Cloudinary URL for audio: ${cloudinaryUrl}`);
            return true;
          } catch (cloudinaryError) {
            logger.error(`Cloudinary upload failed, falling back to base64: ${getErrorMessage(cloudinaryError)}`);
            // Fall back to base64 if Cloudinary fails
            const audioBuffer = fs.readFileSync(filePath);
            const audioBase64 = audioBuffer.toString('base64');
            const audioDataUrl = `data:audio/mpeg;base64,${audioBase64}`;
            
            twiml.play(audioDataUrl);
            return true;
          }
        } else {
          // If Cloudinary is not configured, use base64 encoding
          logger.warn('Cloudinary not configured, using base64 audio encoding (may exceed TwiML size limits)');
          const audioBuffer = fs.readFileSync(filePath);
          const audioBase64 = audioBuffer.toString('base64');
          const audioDataUrl = `data:audio/mpeg;base64,${audioBase64}`;
          
          twiml.play(audioDataUrl);
          return true;
        }
      } else {
        throw new Error('Synthesized file is empty or does not exist');
      }
    }
  } catch (error) {
    logger.error(`Error in voice synthesis: ${getErrorMessage(error)}`, {
      errorDetails: error instanceof Error ? error.stack : 'Unknown error',
      params: {
        textLength: text?.length || 0,
        requestedVoiceId,
        language,
        campaignId: campaignId || 'none'
      }
    });
    
    // Use fallback behavior
    if (fallbackBehavior === 'silent') {
      // Don't add anything to the TwiML
      logger.info('Using silent fallback for voice synthesis');
    } else if (fallbackBehavior === 'tts') {
      // Use Twilio's built-in TTS as a last resort
      logger.info(`Using Twilio TTS fallback for voice synthesis: "${text.substring(0, 30)}${text.length > 30 ? '...' : ''}"`);
      twiml.say({ voice: 'alice', language: language === 'hi' ? 'hi-IN' : 'en-US' }, text);
    } else {
      // Default to empty audio
      logger.info('Using empty audio fallback for voice synthesis');
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
