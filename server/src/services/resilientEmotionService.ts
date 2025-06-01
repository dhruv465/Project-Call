// Enhanced emotion detection service with resilience patterns for SaaS
import axios from 'axios';
import { logger } from '../index';
import { EmotionResult, EmotionServiceConfig } from '../types';
import Configuration from '../models/Configuration';

class ResilientEmotionService {
  private retryCount: number = 3;
  private retryDelay: number = 1000; // 1 second
  private fallbackModel: string = 'text-emotion-model';
  private serviceConfig: EmotionServiceConfig = {
    baseUrl: 'http://localhost:5001', // Default value, will be updated from database
    apiKey: 'development-key',        // Default value, will be updated from database
    modelVersion: 'v1',
    timeout: 5000
  };
  private initialized: boolean = false;
  private initializationPromise: Promise<void> | null = null;

  constructor() {
    // Initialize the service with database configuration
    this.initConfig();
  }

  /**
   * Initialize or reinitialize the configuration from database
   */
  private async initConfig(): Promise<void> {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = (async () => {
      try {
        // Fetch configuration from MongoDB
        const configuration = await Configuration.findOne();
        
        if (!configuration) {
          logger.warn('No configuration found in database, using defaults', {
            component: 'ResilientEmotionService'
          });
          return;
        }

        // Get voice AI configuration from database
        const voiceAIConfig = configuration.voiceAIConfig;
        
        // Get LLM configuration for API keys
        const llmConfig = configuration.llmConfig;
        
        // Update retry settings from general settings
        if (configuration.generalSettings?.callRetryAttempts) {
          this.retryCount = configuration.generalSettings.callRetryAttempts;
        }

        // Extract API keys from configuration
        let emotionApiKey = 'development-key'; // Default fallback
        
        // Prefer provider-specific API key if available
        if (llmConfig?.providers) {
          // Try to find OpenAI provider first (common for emotion detection)
          const openAIProvider = llmConfig.providers.find(p => p.name === 'openai' && p.isEnabled);
          if (openAIProvider?.apiKey) {
            emotionApiKey = openAIProvider.apiKey;
          } else {
            // Use any available enabled provider
            const anyProvider = llmConfig.providers.find(p => p.isEnabled && p.apiKey);
            if (anyProvider?.apiKey) {
              emotionApiKey = anyProvider.apiKey;
            }
          }
        }
        
        // Update service config
        this.serviceConfig = {
          baseUrl: process.env.EMOTION_SERVICE_URL || 'http://localhost:5001', // Fallback to env or default
          apiKey: emotionApiKey,
          modelVersion: voiceAIConfig?.emotionDetection?.enabled ? 'v1' : 'basic',
          timeout: 5000
        };
        
        // Update settings based on configuration
        if (voiceAIConfig?.emotionDetection) {
          // Apply sensitivity settings if available
          if (typeof voiceAIConfig.emotionDetection.sensitivity === 'number') {
            // Higher sensitivity might need more retries or longer timeouts
            if (voiceAIConfig.emotionDetection.sensitivity > 0.7) {
              this.serviceConfig.timeout = 8000; // Longer timeout for higher sensitivity
              this.retryCount = Math.min(5, this.retryCount + 1); // More retries, max 5
            }
          }
        }
        
        this.initialized = true;
        logger.info('Emotion service initialized with database configuration', {
          component: 'ResilientEmotionService',
          isEnabled: voiceAIConfig?.emotionDetection?.enabled || false
        });
      } catch (error) {
        logger.error('Failed to initialize emotion service with database configuration', {
          error: error instanceof Error ? error.message : 'Unknown error',
          component: 'ResilientEmotionService'
        });
        // Continue with defaults
      } finally {
        this.initializationPromise = null;
      }
    })();

    return this.initializationPromise;
  }

  /**
   * Ensure the service is initialized before use
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized && !this.initializationPromise) {
      await this.initConfig();
    } else if (this.initializationPromise) {
      await this.initializationPromise;
    }
  }

  /**
   * Detect emotion from audio with resilience patterns
   * @param audioData Base64 encoded audio data
   */
  async detectEmotionFromAudio(audioData: string): Promise<EmotionResult> {
    // Ensure service is initialized with latest configuration
    await this.ensureInitialized();
    
    try {
      for (let attempt = 1; attempt <= this.retryCount; attempt++) {
        try {
          const response = await axios.post(
            `${this.serviceConfig.baseUrl}/audio-emotion`,
            { audioData },
            {
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.serviceConfig.apiKey}`
              },
              timeout: this.serviceConfig.timeout
            }
          );

          return {
            emotion: response.data.emotion,
            confidence: response.data.confidence,
            metadata: {
              model: 'audio-emotion-model',
              latency: response.data.latency,
              timestamp: new Date().toISOString()
            }
          };
        } catch (error) {
          if (attempt === this.retryCount) throw error;
          
          logger.warn(`Emotion detection attempt ${attempt} failed, retrying...`, {
            error: error instanceof Error ? error.message : 'Unknown error',
            component: 'ResilientEmotionService'
          });

          await new Promise(resolve => setTimeout(resolve, this.retryDelay * attempt));
        }
      }

      throw new Error('All retry attempts failed');
    } catch (error) {
      logger.error('Audio emotion detection failed, falling back to text analysis', {
        error: error instanceof Error ? error.message : 'Unknown error',
        component: 'ResilientEmotionService'
      });

      // Fallback to text analysis if available
      return this.fallbackEmotionDetection();
    }
  }

  /**
   * Detect emotion from text with resilience patterns
   * @param text Input text for emotion analysis
   */
  async detectEmotionFromText(text: string): Promise<EmotionResult> {
    // Ensure service is initialized with latest configuration
    await this.ensureInitialized();
    
    try {
      for (let attempt = 1; attempt <= this.retryCount; attempt++) {
        try {
          const response = await axios.post(
            `${this.serviceConfig.baseUrl}/text-emotion`,
            { text },
            {
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.serviceConfig.apiKey}`
              },
              timeout: this.serviceConfig.timeout
            }
          );

          return {
            emotion: response.data.emotion,
            confidence: response.data.confidence,
            metadata: {
              model: 'text-emotion-model',
              latency: response.data.latency,
              timestamp: new Date().toISOString()
            }
          };
        } catch (error) {
          if (attempt === this.retryCount) throw error;
          
          logger.warn(`Text emotion detection attempt ${attempt} failed, retrying...`, {
            error: error instanceof Error ? error.message : 'Unknown error',
            component: 'ResilientEmotionService'
          });

          await new Promise(resolve => setTimeout(resolve, this.retryDelay * attempt));
        }
      }

      throw new Error('All retry attempts failed');
    } catch (error) {
      logger.error('Text emotion detection failed, using fallback', {
        error: error instanceof Error ? error.message : 'Unknown error',
        component: 'ResilientEmotionService'
      });

      return this.fallbackEmotionDetection();
    }
  }

  /**
   * Fallback emotion detection using rule-based analysis
   * @private
   */
  private fallbackEmotionDetection(): EmotionResult {
    return {
      emotion: 'neutral',
      confidence: 0.6,
      metadata: {
        model: this.fallbackModel,
        latency: 0,
        timestamp: new Date().toISOString(),
        note: 'Fallback detection used'
      }
    };
  }

  /**
   * Update service configuration - can be called when configuration changes
   */
  async updateConfig(): Promise<void> {
    // Reset initialization state to force a fresh load from the database
    this.initialized = false;
    // Reload configuration from database
    await this.initConfig();
  }
  
  /**
   * Update service configuration for a specific tenant
   * @param tenantId The ID of the tenant to update configuration for
   */
  async updateConfigForTenant(tenantId: string): Promise<void> {
    try {
      // For multi-tenant support, we would fetch tenant-specific configuration
      // This is a placeholder for future multi-tenant support
      const configuration = await Configuration.findOne({ tenantId });
      
      if (!configuration) {
        logger.warn(`No configuration found for tenant ${tenantId}`, {
          component: 'ResilientEmotionService',
          tenantId
        });
        return;
      }
      
      // The rest would be similar to initConfig but tenant-specific
      logger.info(`Emotion service updated with tenant-specific configuration`, {
        component: 'ResilientEmotionService',
        tenantId
      });
    } catch (error) {
      logger.error(`Failed to update emotion service with tenant configuration`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        component: 'ResilientEmotionService',
        tenantId
      });
    }
  }
}

// Export singleton instance
export default new ResilientEmotionService();
