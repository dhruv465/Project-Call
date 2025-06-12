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
            logger.error(`Cloudinary upload failed: ${getErrorMessage(cloudinaryError)}`);
            
            // Check file size before falling back to base64
            const audioBuffer = fs.readFileSync(speechResponse);
            if (audioBuffer.length > 48 * 1024) { // 48KB is 75% of 64KB limit
              logger.error(`Audio file too large for base64 fallback: ${audioBuffer.length} bytes`);
              // Use TTS as a safer fallback for large files
              twiml.say({ voice: 'alice', language: language === 'hi' ? 'hi-IN' : 'en-US' }, text);
              return false;
            }
            
            // Only use base64 for small files as a last resort
            logger.warn(`Using base64 fallback for small audio file: ${audioBuffer.length} bytes`);
            const audioBase64 = audioBuffer.toString('base64');
            const audioDataUrl = `data:audio/mpeg;base64,${audioBase64}`;
            
            twiml.play(audioDataUrl);
            return true;
          }
        } else {
          // If Cloudinary is not configured, check audio size before using base64
          logger.warn('Cloudinary not configured, checking audio size before proceeding');
          const audioBuffer = fs.readFileSync(speechResponse);
          
          // Check file size - if over 48KB (75% of 64KB limit), use a fallback message
          if (audioBuffer.length > 48 * 1024) {
            logger.error(`Audio file too large for base64 encoding: ${audioBuffer.length} bytes`);
            
            // Use Twilio's TTS as a safe fallback for large files
            const fallbackText = "I apologize, but I'm having trouble with my voice right now. Please try again later.";
            twiml.say({ voice: 'alice', language: language === 'hi' ? 'hi-IN' : 'en-US' }, fallbackText);
            return false;
          } else {
            // Only use base64 for very small audio files
            logger.info(`Audio file small enough for base64 encoding: ${audioBuffer.length} bytes`);
            const audioBase64 = audioBuffer.toString('base64');
            const audioDataUrl = `data:audio/mpeg;base64,${audioBase64}`;
            
            twiml.play(audioDataUrl);
            return true;
          }
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

/**
 * Process audio buffer for TwiML responses
 * Ensures audio is properly handled either via Cloudinary or as base64
 * Takes size into account to prevent exceeding TwiML 64KB size limit
 * 
 * This function solves a critical issue where large audio files are base64-encoded
 * directly in TwiML responses, which can cause Twilio to reject the response if
 * it exceeds the 64KB limit. This commonly happens when ElevenLabs returns large audio
 * files or when the system falls back to alternative synthesis methods.
 * 
 * The function works by:
 * 1. Always trying to upload audio to Cloudinary first (best option)
 * 2. Only using base64 encoding for small files (<48KB) that won't risk exceeding the limit
 * 3. Falling back to TTS for large files when Cloudinary is unavailable
 * 
 * TWILIO LIMITS:
 * - Maximum TwiML response size: 64KB (65,536 bytes)
 * - Safe limit for base64 audio: 48KB (75% of max to allow for TwiML structure)
 * - Base64 encoding increases size by ~33%, so a 48KB audio file becomes ~64KB when encoded
 * 
 * This ensures we never exceed Twilio's TwiML size limit while still providing
 * high-quality voice synthesis when possible.
 */
export async function processAudioForTwiML(
  audioBuffer: Buffer,
  fallbackText: string,
  language: string = 'en'
): Promise<{
  method: 'cloudinary' | 'base64' | 'tts';
  url: string;
  size: number;
}> {
  let tempFilePath: string | null = null;
  
  try {
    // Get size of the audio buffer
    const audioSize = audioBuffer.length;
    const audioSizeKB = Math.round(audioSize / 1024 * 100) / 100;
    logger.info(`Processing audio for TwiML, size: ${audioSize} bytes (${audioSizeKB}KB)`);
    
    // Calculate the approximate base64 size
    const base64Size = Math.ceil(audioSize * 1.37); // Base64 encoding increases size by ~37%
    const base64SizeKB = Math.round(base64Size / 1024 * 100) / 100;
    
    if (base64Size > 60000) { // Close to 64KB limit for TwiML
      logger.warn(`⚠️ Audio would be ${base64SizeKB}KB when base64 encoded - too large for TwiML (limit: 64KB)`);
    }
    
    // Check if Cloudinary is configured
    if (cloudinaryService.isCloudinaryConfigured()) {
      try {
        // Create a temporary file to upload to Cloudinary
        tempFilePath = require('path').join(
          require('os').tmpdir(), 
          `twiml-audio-${Date.now()}.mp3`
        );
        
        // Write buffer to temp file
        require('fs').writeFileSync(tempFilePath, audioBuffer);
        
        // Upload to Cloudinary with auto-cleanup
        const cloudinaryUrl = await cloudinaryService.uploadAudioFile(tempFilePath, 'voice-recordings', true);
        tempFilePath = null; // Set to null since the file has been cleaned up by the upload function
        
        // Return Cloudinary URL
        return {
          method: 'cloudinary',
          url: cloudinaryUrl,
          size: audioSize
        };
      } catch (cloudinaryError) {
        logger.error(`Failed to upload to Cloudinary: ${getErrorMessage(cloudinaryError)}`);
        
        // Check if file is too large for base64
        if (audioSize > 48 * 1024) { // 48KB is 75% of Twilio's 64KB limit
          logger.warn(`Audio too large (${audioSize} bytes) for base64 fallback, using TTS`);
          return {
            method: 'tts',
            url: '', // Empty URL signals TTS should be used
            size: audioSize
          };
        }
        
        // Small enough for base64
        const audioBase64 = audioBuffer.toString('base64');
        return {
          method: 'base64',
          url: `data:audio/mpeg;base64,${audioBase64}`,
          size: audioSize
        };
      }
    } else {
      // Cloudinary not configured
      logger.warn('Cloudinary not configured for audio processing');
      
      // Check if file is too large for base64
      if (audioSize > 48 * 1024) {
        logger.warn(`Audio too large (${audioSize} bytes) for base64 encoding without Cloudinary, using TTS`);
        return {
          method: 'tts',
          url: '', // Empty URL signals TTS should be used
          size: audioSize
        };
      }
      
      // Small enough for base64
      const audioBase64 = audioBuffer.toString('base64');
      return {
        method: 'base64',
        url: `data:audio/mpeg;base64,${audioBase64}`,
        size: audioSize
      };
    }
  } catch (error) {
    logger.error(`Error in processAudioForTwiML: ${getErrorMessage(error)}`);
    return {
      method: 'tts',
      url: '',
      size: 0
    };
  } finally {
    // Ensure temp file is cleaned up if it exists and wasn't already handled
    if (tempFilePath) {
      try {
        if (require('fs').existsSync(tempFilePath)) {
          require('fs').unlinkSync(tempFilePath);
          logger.debug(`Cleaned up temporary file ${tempFilePath} in processAudioForTwiML finally block`);
        }
      } catch (cleanupError) {
        logger.warn(`Failed to clean up temp file ${tempFilePath} in finally block: ${getErrorMessage(cleanupError)}`);
      }
    }
  }
}
