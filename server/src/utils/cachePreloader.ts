/**
 * Response Cache Preloader
 * 
 * This utility ensures the response cache is preloaded with common phrases
 * to minimize latency for the first interactions in a conversation.
 */

import { logger } from '../index';
import responseCache from './responseCache';
import { getSDKService } from '../services/elevenlabsSDKService';
import { voiceSettings, commonPhrases, cacheSettings } from '../config/latencyOptimization';
import Configuration from '../models/Configuration';

/**
 * Preload common phrases for a specific voice ID
 */
export const preloadVoice = async (voiceId: string): Promise<void> => {
  try {
    const sdkService = getSDKService();
    if (!sdkService) {
      logger.warn('ElevenLabs SDK service not initialized, skipping preload');
      return;
    }

    logger.info(`Preloading common phrases for voice ID: ${voiceId}`);
    
    // Preload acknowledgments with ultra-low latency settings
    const ackPromises = commonPhrases.acknowledgments.map(async (phrase) => {
      try {
        const cacheKey = `${voiceId}_${phrase}`;
        
        // Skip if already cached
        if (responseCache.has(cacheKey)) {
          return;
        }
        
        const buffer = await sdkService.generateSpeech(phrase, voiceId, {
          optimizeLatency: true,
          stability: voiceSettings.ultraLow.stability,
          similarityBoost: voiceSettings.ultraLow.similarityBoost,
          style: voiceSettings.ultraLow.style,
          modelId: voiceSettings.ultraLow.model
        });
        
        responseCache.set(cacheKey, buffer);
        responseCache.addPriorityItem(cacheKey); // Never evict acknowledgments
        logger.debug(`Preloaded acknowledgment: "${phrase}" for voice ${voiceId}`);
      } catch (error) {
        logger.error(`Failed to preload acknowledgment: ${phrase}`, error);
      }
    });
    
    // Preload thinking phrases with ultra-low latency settings
    const thinkingPromises = commonPhrases.thinking.map(async (phrase) => {
      try {
        const cacheKey = `${voiceId}_${phrase}`;
        
        // Skip if already cached
        if (responseCache.has(cacheKey)) {
          return;
        }
        
        const buffer = await sdkService.generateSpeech(phrase, voiceId, {
          optimizeLatency: true,
          stability: voiceSettings.ultraLow.stability,
          similarityBoost: voiceSettings.ultraLow.similarityBoost,
          style: voiceSettings.ultraLow.style,
          modelId: voiceSettings.ultraLow.model
        });
        
        responseCache.set(cacheKey, buffer);
        responseCache.addPriorityItem(cacheKey); // Never evict thinking sounds
        logger.debug(`Preloaded thinking phrase: "${phrase}" for voice ${voiceId}`);
      } catch (error) {
        logger.error(`Failed to preload thinking phrase: ${phrase}`, error);
      }
    });
    
    // Preload greetings with low latency settings
    const greetingPromises = commonPhrases.greetings.map(async (phrase) => {
      try {
        const cacheKey = `${voiceId}_${phrase}`;
        
        // Skip if already cached
        if (responseCache.has(cacheKey)) {
          return;
        }
        
        const buffer = await sdkService.generateSpeech(phrase, voiceId, {
          optimizeLatency: true,
          stability: voiceSettings.low.stability,
          similarityBoost: voiceSettings.low.similarityBoost,
          style: voiceSettings.low.style,
          modelId: voiceSettings.low.model
        });
        
        responseCache.set(cacheKey, buffer);
        logger.debug(`Preloaded greeting: "${phrase}" for voice ${voiceId}`);
      } catch (error) {
        logger.error(`Failed to preload greeting: ${phrase}`, error);
      }
    });
    
    // Preload transitions with low latency settings
    const transitionPromises = commonPhrases.transitions.map(async (phrase) => {
      try {
        const cacheKey = `${voiceId}_${phrase}`;
        
        // Skip if already cached
        if (responseCache.has(cacheKey)) {
          return;
        }
        
        const buffer = await sdkService.generateSpeech(phrase, voiceId, {
          optimizeLatency: true,
          stability: voiceSettings.low.stability,
          similarityBoost: voiceSettings.low.similarityBoost,
          style: voiceSettings.low.style,
          modelId: voiceSettings.low.model
        });
        
        responseCache.set(cacheKey, buffer);
        logger.debug(`Preloaded transition: "${phrase}" for voice ${voiceId}`);
      } catch (error) {
        logger.error(`Failed to preload transition: ${phrase}`, error);
      }
    });
    
    // Wait for all preloading to complete
    await Promise.all([
      ...ackPromises,
      ...thinkingPromises,
      ...greetingPromises,
      ...transitionPromises
    ]);
    
    logger.info(`Completed preloading phrases for voice ID: ${voiceId}`);
  } catch (error) {
    logger.error(`Error preloading cache for voice ${voiceId}:`, error);
  }
};

/**
 * Preload all available voices
 */
export const preloadAllVoices = async (): Promise<{ voiceCount: number, phrasesLoaded: number }> => {
  try {
    // Get configuration
    const config = await Configuration.findOne();
    if (!config || !config.elevenLabsConfig.isEnabled) {
      logger.warn('ElevenLabs not configured, skipping preload');
      return { voiceCount: 0, phrasesLoaded: 0 };
    }

    const voices = config.elevenLabsConfig.availableVoices;
    if (!voices || voices.length === 0) {
      logger.warn('No voices found for preloading');
      return { voiceCount: 0, phrasesLoaded: 0 };
    }

    logger.info(`Starting preload for ${voices.length} voices`);

    // Define concurrency limits
    const concurrency = cacheSettings.preload.concurrency || 3;
    const totalPhrases = 
      commonPhrases.acknowledgments.length + 
      commonPhrases.thinking.length + 
      commonPhrases.greetings.length + 
      commonPhrases.transitions.length;

    // Use a queue to process voices with limited concurrency
    const queue = voices.map(voice => voice.voiceId);
    let completed = 0;
    let phrasesLoaded = 0;
    
    // Process queue with limited concurrency
    const promises = [];
    for (let i = 0; i < Math.min(concurrency, queue.length); i++) {
      const processNext = async () => {
        while (queue.length > 0) {
          const voiceId = queue.shift();
          if (!voiceId) continue;
          
          try {
            await preloadVoice(voiceId);
            completed++;
            phrasesLoaded += totalPhrases;
            logger.info(`Preloaded voice ${completed}/${voices.length}: ${voiceId}`);
          } catch (error) {
            logger.error(`Error preloading voice ${voiceId}:`, error);
          }
        }
      };
      
      promises.push(processNext());
    }
    
    // Wait for all processes to complete
    await Promise.all(promises);
    
    logger.info(`Completed preloading ${completed}/${voices.length} voices with ${phrasesLoaded} total phrases`);
    return { voiceCount: completed, phrasesLoaded };
  } catch (error) {
    logger.error(`Error preloading all voices:`, error);
    throw error;
  }
};

// Function to check and preload if needed
export const initializeCache = async (): Promise<void> => {
  try {
    if (cacheSettings.preload.enabled) {
      await preloadAllVoices();
    } else {
      logger.info('Cache preloading is disabled in settings');
    }
  } catch (error) {
    logger.error('Error initializing cache:', error);
  }
};

export default {
  preloadVoice,
  preloadAllVoices,
  initializeCache
};
