/**
 * LLM Test Controller
 * 
 * This controller handles testing LLM models with the unified LLM Service SDK.
 */
import { Request, Response } from 'express';
import Configuration from '../models/Configuration';
import { logger, getErrorMessage } from '../index';
import LLMService, { LLMConfig, LLMProvider, LLMChatRequest } from '../services/llm';

interface TestLLMParams {
  provider: string;
  model?: string;
  prompt: string;
  temperature?: number;
  apiKey?: string;
}

/**
 * Test LLM configuration with a sample prompt
 * @route POST /api/configuration/test-llm-chat
 * @access Private
 */
export const testLLMChat = async (req: Request, res: Response) => {
  try {
    const { provider, model, prompt, temperature = 0.7, apiKey } = req.body as TestLLMParams;

    if (!provider) {
      return res.status(400).json({ 
        success: false, 
        message: 'Provider is required' 
      });
    }

    if (!prompt) {
      return res.status(400).json({
        success: false,
        message: 'Test prompt is required'
      });
    }

    // Normalize provider name
    const providerName = provider.toLowerCase() as LLMProvider;
    // Map 'gemini' to 'google' for configuration lookup
    const configProviderName = providerName === 'gemini' ? 'google' : providerName;
    
    // If API key is provided directly, create a one-time service
    // Otherwise, get the configuration from the database
    let llmService: LLMService;
    let modelToUse = model;
    
    if (apiKey) {
      // One-time service with just this provider
      const config: LLMConfig = {
        providers: [{
          name: configProviderName as LLMProvider,
          apiKey: apiKey,
          defaultModel: model,
          isEnabled: true
        }],
        defaultProvider: configProviderName as LLMProvider
      };
      
      llmService = new LLMService(config);
    } else {
      // Get the configuration from the database
      const config = await Configuration.findOne();
      
      if (!config) {
        return res.status(404).json({ 
          success: false, 
          message: 'Configuration not found' 
        });
      }
      
      // Find the provider configuration
      const providerConfig = config.llmConfig.providers.find(
        p => p.name.toLowerCase() === configProviderName
      );

      if (!providerConfig) {
        return res.status(404).json({
          success: false,
          message: `Provider ${configProviderName} not found in configuration`
        });
      }

      if (!providerConfig.apiKey) {
        return res.status(400).json({
          success: false,
          message: `No API key configured for ${configProviderName}`
        });
      }
      
      // Use the model from the request or the default model from the provider config
      if (!modelToUse) {
        if (providerConfig.availableModels && providerConfig.availableModels.length > 0) {
          modelToUse = providerConfig.availableModels[0];
        } else {
          modelToUse = config.llmConfig.defaultModel;
        }
      }
      
      // Convert database config to LLM service config
      const llmConfig: LLMConfig = {
        providers: config.llmConfig.providers.map(p => ({
          name: p.name.toLowerCase() as LLMProvider,
          apiKey: p.apiKey,
          // Use the first available model as default if defaultModel doesn't exist
          defaultModel: p.availableModels && p.availableModels.length > 0 ? p.availableModels[0] : undefined,
          isEnabled: p.isEnabled
        })),
        defaultProvider: config.llmConfig.defaultProvider as LLMProvider,
        defaultModel: config.llmConfig.defaultModel
      };
      
      llmService = new LLMService(llmConfig);
    }

    if (!modelToUse) {
      return res.status(400).json({
        success: false,
        message: `No model specified for ${provider}`
      });
    }

    let response;
    let isSuccessful = false;
    
    try {
      // Create a chat request
      const chatRequest: LLMChatRequest = {
        provider: providerName as LLMProvider,
        model: modelToUse,
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: prompt }
        ],
        options: {
          temperature: temperature,
          maxTokens: 150
        }
      };
      
      // Use the LLM service to make the request
      response = await llmService.chat(chatRequest);
      isSuccessful = true;
      
      // Update status in database if not using a direct API key
      if (!apiKey) {
        const configuration = await Configuration.findOne();
        if (configuration) {
          const providerIndex = configuration.llmConfig.providers.findIndex(
            p => p.name.toLowerCase() === configProviderName
          );
          
          if (providerIndex !== -1) {
            configuration.llmConfig.providers[providerIndex].status = 'verified';
            configuration.llmConfig.providers[providerIndex].lastVerified = new Date();
            await configuration.save();
            logger.info(`${provider} status updated to verified`);
          }
        }
      }
    } catch (error) {
      logger.error(`Error testing ${provider} model:`, error);
      response = {
        error: getErrorMessage(error)
      };
      
      // Update status in database if not using a direct API key
      if (!apiKey) {
        const configuration = await Configuration.findOne();
        if (configuration) {
          const providerIndex = configuration.llmConfig.providers.findIndex(
            p => p.name.toLowerCase() === configProviderName
          );
          
          if (providerIndex !== -1) {
            configuration.llmConfig.providers[providerIndex].status = 'failed';
            await configuration.save();
            logger.info(`${provider} status updated to failed`);
          }
        }
      }
    }

    return res.status(200).json({
      success: isSuccessful,
      message: isSuccessful ? 'Model test successful' : 'Model test failed',
      response: response
    });
  } catch (error) {
    logger.error('Error in testLLMChat:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: getErrorMessage(error)
    });
  }
};

/**
 * Get available models from all providers
 * @route GET /api/configuration/llm-models
 * @access Private
 */
export const getAllLLMModels = async (req: Request, res: Response) => {
  try {
    const configuration = await Configuration.findOne();
    if (!configuration) {
      return res.status(404).json({
        success: false,
        message: 'Configuration not found'
      });
    }

    // Transform configuration to match LLMConfig interface
    const llmConfig: LLMConfig = {
      providers: configuration.llmConfig.providers.map(p => ({
        name: p.name as LLMProvider,
        apiKey: p.apiKey,
        isEnabled: p.isEnabled,
        models: p.availableModels
      })),
      defaultProvider: configuration.llmConfig.defaultProvider as LLMProvider,
      defaultModel: configuration.llmConfig.defaultModel
    };

    // Create LLM service with transformed configuration
    const llmService = new LLMService(llmConfig);
    
    // Get all available models from all configured providers
    const allModels = await llmService.getAllAvailableModels();
    
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    return res.status(200).json({
      success: true,
      models: allModels,
      providers: llmService.listProviders()
    });
  } catch (error) {
    logger.error('Error getting all LLM models:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: getErrorMessage(error)
    });
  }
};

/**
 * Get available models from a specific provider
 * @route GET /api/configuration/llm-models/:provider
 * @access Private
 */
export const getProviderLLMModels = async (req: Request, res: Response) => {
  try {
    const { provider } = req.params;
    
    if (!provider) {
      return res.status(400).json({
        success: false,
        message: 'Provider parameter is required'
      });
    }

    const configuration = await Configuration.findOne();
    if (!configuration) {
      return res.status(404).json({
        success: false,
        message: 'Configuration not found'
      });
    }

    // Normalize provider name
    const providerName = provider.toLowerCase() as LLMProvider;
    const configProviderName = providerName === 'gemini' ? 'google' : providerName;
    
    // Find the provider in configuration
    const providerConfig = configuration.llmConfig.providers.find(
      p => p.name.toLowerCase() === configProviderName
    );

    if (!providerConfig) {
      return res.status(404).json({
        success: false,
        message: `Provider ${provider} not found in configuration`
      });
    }

    if (!providerConfig.apiKey) {
      return res.status(400).json({
        success: false,
        message: `No API key configured for ${provider}`
      });
    }

    // Transform configuration to match LLMConfig interface
    const llmConfig: LLMConfig = {
      providers: [{
        name: configProviderName as LLMProvider,
        apiKey: providerConfig.apiKey,
        isEnabled: true,
        models: providerConfig.availableModels
      }],
      defaultProvider: configProviderName as LLMProvider
    };
    
    // Create LLM service with transformed configuration
    const llmService = new LLMService(llmConfig);
    
    // Get models from the specific provider
    const models = await llmService.getProviderModels(configProviderName);
    
    return res.status(200).json({
      success: true,
      provider: configProviderName,
      models: models
    });
  } catch (error) {
    logger.error(`Error getting models for provider ${req.params.provider}:`, error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      error: getErrorMessage(error)
    });
  }
};

/**
 * Dynamically fetch models from a provider using an API key
 * @route POST /api/configuration/llm-models/dynamic
 * @access Private
 */
export const getDynamicProviderModels = async (req: Request, res: Response) => {
  try {
    const { provider, apiKey } = req.body;
    
    if (!provider) {
      return res.status(400).json({
        success: false,
        message: 'Provider is required'
      });
    }

    if (!apiKey) {
      return res.status(400).json({
        success: false,
        message: 'API key is required'
      });
    }

    // Normalize provider name
    const providerName = provider.toLowerCase() as LLMProvider;
    const configProviderName = providerName === 'gemini' ? 'google' : providerName;
    
    // Create a temporary LLM service configuration with just this provider
    const llmConfig: LLMConfig = {
      providers: [{
        name: configProviderName as LLMProvider,
        apiKey: apiKey,
        isEnabled: true
      }],
      defaultProvider: configProviderName as LLMProvider
    };
    
    // Create LLM service with the temporary configuration
    const llmService = new LLMService(llmConfig);
    
    // Get models from the specific provider
    const models = await llmService.getProviderModels(configProviderName);
    
    return res.status(200).json({
      success: true,
      provider: configProviderName,
      models: models
    });
  } catch (error) {
    logger.error(`Error dynamically fetching models for provider ${req.body.provider}:`, error);
    
    // Provide more specific error messages based on the error type
    let errorMessage = 'Failed to fetch models';
    const errorString = getErrorMessage(error);
    
    if (errorString.includes('401') || errorString.includes('403') || errorString.includes('Unauthorized')) {
      errorMessage = 'Invalid API key';
    } else if (errorString.includes('network') || errorString.includes('timeout')) {
      errorMessage = 'Network error - please check your connection';
    }
    
    return res.status(400).json({
      success: false,
      message: errorMessage,
      error: errorString
    });
  }
};
