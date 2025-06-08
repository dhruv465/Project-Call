import mongoose from 'mongoose';
import logger from './logger';
import { IConfiguration } from '../models/Configuration';

/**
 * Ensures basic configuration structure exists without hardcoded voices.
 * Users should configure voices through the ElevenLabs API integration.
 */
export async function ensureDefaultConfiguration() {
  try {
    const Configuration = mongoose.model<IConfiguration>('Configuration');
    const config = await Configuration.findOne();

    if (!config) {
      logger.warn('No configuration found. Creating new basic configuration structure.');
      const newConfig = new Configuration({
        elevenLabsConfig: {
          apiKey: '',          // Empty - user needs to provide API key
          availableVoices: [], // Empty - will be populated when user configures ElevenLabs API
          isEnabled: false,    // Disabled until user provides API key
          voiceSpeed: 1.0,
          voiceStability: 0.8,
          voiceClarity: 0.9
        }
      });
      await newConfig.save();
      logger.info('Created new configuration structure. Users need to configure ElevenLabs API key and voices.');
      return;
    }

    // Ensure the configuration has the necessary structure
    if (!config.elevenLabsConfig) {
      config.elevenLabsConfig = {
        apiKey: '',          // Empty - user needs to provide API key
        availableVoices: [],
        isEnabled: false,
        voiceSpeed: 1.0,
        voiceStability: 0.8,
        voiceClarity: 0.9
      };
      await config.save();
      logger.info('Updated configuration with ElevenLabs structure');
    } else {
      logger.info('Configuration structure already exists');
    }
  } catch (error) {
    logger.error('Error ensuring basic configuration:', error);
    throw error;
  }
}

// Keep the old function name for backwards compatibility, but mark it as deprecated
/**
 * @deprecated Use ensureDefaultConfiguration instead. This function no longer adds hardcoded voices.
 */
export async function ensureDefaultVoices() {
  logger.warn('ensureDefaultVoices is deprecated. Use ensureDefaultConfiguration instead.');
  return ensureDefaultConfiguration();
}
