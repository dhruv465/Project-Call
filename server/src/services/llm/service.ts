/**
 * LLM Service - Main orchestration service
 * 
 * This service manages all LLM provider clients and provides a unified interface
 * for making LLM requests with fallback capabilities.
 */
import {
  LLMConfig,
  LLMProvider,
  LLMProviderConfig,
  LLMChatRequest,
  LLMCompletionRequest,
  LLMResponse,
  LLMStreamChunk,
  LLMMessage,
  LLMError,
  ModelInfo
} from './types';
import { ILLMProviderClient } from './base';
import { OpenAIClient } from './openai';
import { AnthropicClient } from './anthropic';
import { GoogleClient } from './google';
import { logger } from '../../index';

export class LLMService {
  private providers: Map<LLMProvider, ILLMProviderClient> = new Map();
  private config: LLMConfig;
  
  constructor(config: LLMConfig) {
    this.config = config;
    this.initializeProviders();
  }
  
  /**
   * Initialize provider clients based on configuration
   */
  private initializeProviders(): void {
    for (const providerConfig of this.config.providers) {
      if (!providerConfig.isEnabled || !providerConfig.apiKey) {
        continue;
      }
      
      try {
        const client = this.createProviderClient(providerConfig);
        if (client) {
          this.providers.set(providerConfig.name, client);
          logger.info(`Initialized LLM provider: ${providerConfig.name}`);
        }
      } catch (error) {
        logger.error(`Failed to initialize LLM provider ${providerConfig.name}:`, error);
      }
    }
  }
  
  /**
   * Create a provider client based on provider type
   */
  private createProviderClient(config: LLMProviderConfig): ILLMProviderClient | null {
    const { name, apiKey, baseUrl, defaultModel, organization } = config;
    
    switch (name) {
      case 'openai':
        return new OpenAIClient(apiKey, { baseUrl, defaultModel, organization });
        
      case 'anthropic':
        return new AnthropicClient(apiKey, { baseUrl, defaultModel });
        
      case 'google':
      case 'gemini':
        return new GoogleClient(apiKey, { defaultModel });
        
      default:
        logger.warn(`Unsupported LLM provider: ${name}`);
        return null;
    }
  }
  
  /**
   * Get the default provider client
   */
  getDefaultProvider(): ILLMProviderClient {
    const defaultProviderName = this.config.defaultProvider || 
      (this.providers.size > 0 ? this.providers.keys().next().value : null);
    
    if (!defaultProviderName) {
      throw new Error('No LLM providers configured');
    }
    
    const provider = this.providers.get(defaultProviderName);
    if (!provider) {
      throw new Error(`Default provider ${defaultProviderName} not found or not initialized`);
    }
    
    return provider;
  }
  
  /**
   * Get a specific provider client by name
   */
  getProvider(name: LLMProvider): ILLMProviderClient {
    // Map 'gemini' to 'google' for provider lookup
    const providerName = name === 'gemini' ? 'google' : name;
    
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new Error(`Provider ${name} not found or not initialized`);
    }
    
    return provider;
  }
  
  /**
   * List all available providers
   */
  listProviders(): LLMProvider[] {
    return Array.from(this.providers.keys());
  }
  
  /**
   * Test connection to a specific provider
   */
  async testProvider(name: LLMProvider): Promise<boolean> {
    try {
      const provider = this.getProvider(name);
      return await provider.testConnection();
    } catch (error) {
      logger.error(`Failed to test provider ${name}:`, error);
      return false;
    }
  }

  /**
   * Get all available models from all providers
   */
  async getAllAvailableModels(): Promise<{ [provider: string]: ModelInfo[] }> {
    const allModels: { [provider: string]: ModelInfo[] } = {};
    
    for (const [providerName, provider] of this.providers) {
      try {
        const models = await provider.getAvailableModels();
        allModels[providerName] = models;
      } catch (error) {
        logger.error(`Failed to get models from provider ${providerName}:`, error);
        allModels[providerName] = [];
      }
    }
    
    return allModels;
  }

  /**
   * Get available models from a specific provider
   */
  async getProviderModels(name: LLMProvider): Promise<ModelInfo[]> {
    try {
      const provider = this.getProvider(name);
      return await provider.getAvailableModels();
    } catch (error) {
      logger.error(`Failed to get models from provider ${name}:`, error);
      return [];
    }
  }
  
  /**
   * Generate a completion with fallback capabilities
   */
  async completion(request: LLMCompletionRequest): Promise<LLMResponse> {
    const providerName = request.provider;
    const fallbackProviders = this.config.fallbackProviders || [];
    
    // Try the requested provider first
    try {
      const provider = this.getProvider(providerName);
      return await provider.completion({
        model: request.model,
        prompt: request.prompt,
        options: request.options,
        responseFormat: request.responseFormat
      });
    } catch (error) {
      logger.warn(`Provider ${providerName} failed, trying fallbacks:`, error);
      
      // If the error is not retryable or there are no fallbacks, rethrow
      if (!(error as LLMError).retryable || fallbackProviders.length === 0) {
        throw error;
      }
      
      // Try fallback providers in order
      for (const fallbackName of fallbackProviders) {
        try {
          const fallbackProvider = this.getProvider(fallbackName);
          logger.info(`Trying fallback provider: ${fallbackName}`);
          
          return await fallbackProvider.completion({
            model: request.model,
            prompt: request.prompt,
            options: request.options,
            responseFormat: request.responseFormat
          });
        } catch (fallbackError) {
          logger.warn(`Fallback provider ${fallbackName} failed:`, fallbackError);
          // Continue to the next fallback
        }
      }
      
      // If all fallbacks failed, throw the original error
      throw error;
    }
  }
  
  /**
   * Generate a chat completion with fallback capabilities
   */
  async chat(request: LLMChatRequest): Promise<LLMResponse> {
    const providerName = request.provider;
    const fallbackProviders = this.config.fallbackProviders || [];
    
    // Try the requested provider first
    try {
      const provider = this.getProvider(providerName);
      return await provider.chat({
        model: request.model,
        messages: request.messages,
        options: request.options,
        responseFormat: request.responseFormat
      });
    } catch (error) {
      logger.warn(`Provider ${providerName} failed, trying fallbacks:`, error);
      
      // If the error is not retryable or there are no fallbacks, rethrow
      if (!(error as LLMError).retryable || fallbackProviders.length === 0) {
        throw error;
      }
      
      // Try fallback providers in order
      for (const fallbackName of fallbackProviders) {
        try {
          const fallbackProvider = this.getProvider(fallbackName);
          logger.info(`Trying fallback provider: ${fallbackName}`);
          
          return await fallbackProvider.chat({
            model: request.model,
            messages: request.messages,
            options: request.options,
            responseFormat: request.responseFormat
          });
        } catch (fallbackError) {
          logger.warn(`Fallback provider ${fallbackName} failed:`, fallbackError);
          // Continue to the next fallback
        }
      }
      
      // If all fallbacks failed, throw the original error
      throw error;
    }
  }
  
  /**
   * Stream a chat completion with fallback capabilities
   */
  async streamChat(
    request: LLMChatRequest,
    onChunk: (chunk: LLMStreamChunk) => void
  ): Promise<void> {
    const providerName = request.provider;
    const fallbackProviders = this.config.fallbackProviders || [];
    
    // Try the requested provider first
    try {
      const provider = this.getProvider(providerName);
      await provider.streamChat({
        model: request.model,
        messages: request.messages,
        options: request.options,
        responseFormat: request.responseFormat
      }, onChunk);
      return;
    } catch (error) {
      logger.warn(`Provider ${providerName} failed for streaming, trying fallbacks:`, error);
      
      // If the error is not retryable or there are no fallbacks, rethrow
      if (!(error as LLMError).retryable || fallbackProviders.length === 0) {
        throw error;
      }
      
      // Try fallback providers in order
      for (const fallbackName of fallbackProviders) {
        try {
          const fallbackProvider = this.getProvider(fallbackName);
          logger.info(`Trying fallback provider for streaming: ${fallbackName}`);
          
          await fallbackProvider.streamChat({
            model: request.model,
            messages: request.messages,
            options: request.options,
            responseFormat: request.responseFormat
          }, onChunk);
          return;
        } catch (fallbackError) {
          logger.warn(`Fallback provider ${fallbackName} failed for streaming:`, fallbackError);
          // Continue to the next fallback
        }
      }
      
      // If all fallbacks failed, throw the original error
      throw error;
    }
  }
  
  /**
   * Update the service configuration
   */
  updateConfig(newConfig: LLMConfig): void {
    this.config = newConfig;
    
    // Clear existing providers
    this.providers.clear();
    
    // Reinitialize with new config
    this.initializeProviders();
  }
  
  /**
   * Get available models for a provider
   */
  async getModels(providerName: LLMProvider): Promise<string[]> {
    try {
      const provider = this.getProvider(providerName);
      return await provider.listModels();
    } catch (error) {
      logger.error(`Failed to get models for provider ${providerName}:`, error);
      return [];
    }
  }
}
