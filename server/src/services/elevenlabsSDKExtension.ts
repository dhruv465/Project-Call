/**
 * Extension for ElevenLabsSDKService to add streaming speech generation
 * This extension adds the streamSpeechGeneration method to the ElevenLabsSDKService class
 * It's implemented as a separate file to avoid modifying the original service directly
 */

import { ElevenLabsSDKService } from './elevenlabsSDKService';
import { logger, getErrorMessage } from '../index';
import responseCache from '../utils/responseCache';

/**
 * Extend the ElevenLabsSDKService prototype with the streamSpeechGeneration method
 */
ElevenLabsSDKService.prototype.streamSpeechGeneration = async function(
  text: string,
  voiceId: string,
  onAudioChunk: (chunk: Buffer) => void,
  options?: {
    optimizeLatency?: boolean;
    stability?: number;
    similarityBoost?: number;
    style?: number;
  }
): Promise<void> {
  try {
    // Check cache first for common phrases
    const cacheKey = `${voiceId}_${text}`;
    if (responseCache.has(cacheKey)) {
      const cachedAudio = responseCache.get(cacheKey);
      if (cachedAudio) {
        logger.debug(`Using cached audio for text: "${text.substring(0, 20)}..."`);
        onAudioChunk(cachedAudio);
        return;
      }
    }
    
    // Use optimized settings for latency by default
    const streamOptions = {
      latencyOptimization: options?.optimizeLatency !== false ? 3 : 0, // Maximum optimization
      voiceSettings: {
        stability: options?.stability || 0.5, // Lower stability for faster generation
        similarityBoost: options?.similarityBoost || 0.75,
        style: options?.style || 0.0,
        speakerBoost: true
      }
    };
    
    // Generate a temporary conversation ID for this one-time streaming
    const tempConversationId = `temp_${Date.now()}`;
    
    // Use the streamSpeech method to stream the speech
    await this.streamSpeech(
      tempConversationId,
      text,
      voiceId,
      onAudioChunk,
      streamOptions
    );
    
    // Cache the response if it's short (less than 100 chars)
    if (text.length < 100) {
      try {
        // Generate the complete audio in the background for caching
        this.generateSpeech(text, voiceId, { optimizeLatency: true })
          .then(buffer => {
            responseCache.set(cacheKey, buffer);
            logger.debug(`Cached response for future use: "${text.substring(0, 20)}..."`);
          })
          .catch(err => {
            logger.debug(`Failed to cache response: ${getErrorMessage(err)}`);
          });
      } catch (cacheError) {
        // Ignore cache errors - caching is optional
        logger.debug(`Error in background caching: ${getErrorMessage(cacheError)}`);
      }
    }
  } catch (error) {
    logger.error(`Error streaming speech generation: ${getErrorMessage(error)}`);
    throw new Error(`Failed to stream speech: ${getErrorMessage(error)}`);
  }
};

// Export the modified service to ensure TypeScript picks up the change
export {};
