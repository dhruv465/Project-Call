import mongoose from 'mongoose';
import logger from './logger';
import { IConfiguration } from '../models/Configuration';

const defaultVoices = [
  {
    voiceId: 'EXAVITQu4vr4xnSDxMaL',
    name: 'Rachel (Professional)',
    previewUrl: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/rachel/sample.mp3'
  },
  {
    voiceId: '21m00Tcm4TlvDq8ikWAM',
    name: 'Jessica (Friendly)',
    previewUrl: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/jessica/sample.mp3'
  },
  {
    voiceId: 'VR6AewLTigWG4xSOukaG',
    name: 'Alex (Empathetic)',
    previewUrl: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/alex/sample.mp3'
  }
];

export async function ensureDefaultVoices() {
  try {
    const Configuration = mongoose.model<IConfiguration>('Configuration');
    const config = await Configuration.findOne();

    if (!config) {
      logger.warn('No configuration found. Creating new configuration with default voices.');
      const newConfig = new Configuration({
        elevenLabsConfig: {
          availableVoices: defaultVoices,
          isEnabled: true,
          voiceSpeed: 1.0,
          voiceStability: 0.8,
          voiceClarity: 0.9
        }
      });
      await newConfig.save();
      logger.info('Created new configuration with default voices');
      return;
    }

    // Check if we need to add any missing default voices
    const existingVoiceIds = new Set(config.elevenLabsConfig.availableVoices.map(v => v.voiceId));
    const missingVoices = defaultVoices.filter(v => !existingVoiceIds.has(v.voiceId));

    if (missingVoices.length > 0) {
      config.elevenLabsConfig.availableVoices.push(...missingVoices);
      await config.save();
      logger.info(`Added ${missingVoices.length} missing default voices to configuration`);
    } else {
      logger.info('Default voices already present in configuration');
    }
  } catch (error) {
    logger.error('Error ensuring default voices:', error);
    throw error;
  }
}
