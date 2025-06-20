import mongoose from 'mongoose';
import logger from '../utils/logger';

// Import Configuration model
const Configuration = mongoose.model('Configuration');

/**
 * Service for managing system configuration
 * Provides caching and centralized access to configuration settings
 */
export class ConfigurationService {
  private cache: any = null;
  private lastCacheTime: number = 0;
  private readonly cacheTTL: number = 60000; // 1 minute cache TTL

  constructor() {}

  /**
   * Get the current system configuration
   * Uses caching to reduce database queries
   * @returns Configuration object
   */
  public async getConfiguration(): Promise<any> {
    const now = Date.now();
    
    // Return cached configuration if it's still valid
    if (this.cache && now - this.lastCacheTime < this.cacheTTL) {
      return this.cache;
    }
    
    try {
      // Fetch fresh configuration from database
      const config = await Configuration.findOne().lean();
      
      // Update cache
      this.cache = config;
      this.lastCacheTime = now;
      
      return config;
    } catch (error) {
      logger.error(`Error fetching configuration: ${error.message}`);
      
      // Return cached configuration even if expired, or null if none exists
      return this.cache;
    }
  }

  /**
   * Get a specific configuration section
   * @param section Configuration section name
   * @returns Configuration section object
   */
  public async getConfigurationSection<T>(section: string): Promise<T | null> {
    const config = await this.getConfiguration();
    return config?.[section] || null;
  }

  /**
   * Update configuration
   * @param updates Configuration updates
   * @returns Updated configuration
   */
  public async updateConfiguration(updates: any): Promise<any> {
    try {
      // Get existing configuration or create a new one
      let config = await Configuration.findOne();
      
      if (!config) {
        config = new Configuration();
      }
      
      // Apply updates
      Object.keys(updates).forEach(key => {
        config[key] = {
          ...config[key],
          ...updates[key]
        };
      });
      
      // Save updates
      const updatedConfig = await config.save();
      
      // Update cache
      this.cache = updatedConfig.toObject();
      this.lastCacheTime = Date.now();
      
      return updatedConfig;
    } catch (error) {
      logger.error(`Error updating configuration: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check if a specific feature is enabled
   * @param feature Feature name
   * @returns Boolean indicating if feature is enabled
   */
  public async isFeatureEnabled(feature: string): Promise<boolean> {
    const config = await this.getConfiguration();
    
    // Check for feature in different configuration sections
    const featureMap: Record<string, string> = {
      'deepgram': 'deepgramConfig.isEnabled',
      'elevenlabs': 'elevenLabsConfig.isEnabled',
      'realtime-api': 'llmConfig.providers.0.useRealtimeAPI',
      'voice-streaming': 'voiceAIConfig.streamingEnabled',
      'audio-recording': 'complianceSettings.recordCalls'
    };
    
    const path = featureMap[feature] || `generalSettings.features.${feature}`;
    return this.getNestedProperty(config, path) === true;
  }

  /**
   * Get a nested property from an object using a dot-notation path
   * @param obj Object to get property from
   * @param path Property path (e.g., 'user.address.city')
   * @returns Property value or undefined
   */
  private getNestedProperty(obj: any, path: string): any {
    return path.split('.').reduce((prev, curr) => {
      return prev && prev[curr] !== undefined ? prev[curr] : undefined;
    }, obj);
  }

  /**
   * Clear the configuration cache
   */
  public clearCache(): void {
    this.cache = null;
    this.lastCacheTime = 0;
  }
}

// Export a singleton instance
export const configurationService = new ConfigurationService();
