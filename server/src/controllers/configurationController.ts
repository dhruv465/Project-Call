import { Request, Response } from 'express';
import Configuration from '../models/Configuration';
import { logger, getErrorMessage } from '../index';
import axios from 'axios';
import twilio from 'twilio';
import { 
  validateElevenLabsKey, 
  validateVoiceParameters, 
  validateLLMParameters,
  validateGeneralSettings,
  logValidationError
} from '../utils/configValidation';
import {
  handleApiKeyUpdate,
  isMaskedApiKey,
  createMaskedApiKey,
  handleObjectUpdate,
  maskSensitiveValues
} from '../utils/configHelpers';
import {
  IConfiguration,
  UpdatedConfig,
  BaseLLMProvider,
  UpdateLLMProvider,
  LLMConfig,
  ElevenLabsConfig,
  TwilioConfig,
  WebhookConfig,
  GeneralSettings,
  ComplianceSettings
} from '../types/configuration';

// All interfaces moved to /types/configuration.ts

// Helper function to handle unknown errors
const handleError = (error: unknown): string => {
  return getErrorMessage(error);
};

/**
 * Update all services with new API keys from configuration
 * @param configuration The updated configuration object
 */
const updateServicesWithNewConfig = async (configuration: any): Promise<void> => {
  try {
    const { initializeSpeechService } = require('../services/realSpeechService');
    
    // Get API keys from configuration
    let elevenLabsKey = '';
    let openAIKey = '';
    let anthropicKey = '';
    
    // Update ElevenLabs API key
    if (configuration.elevenLabsConfig?.apiKey) {
      elevenLabsKey = configuration.elevenLabsConfig.apiKey;
      // Reinitialize speech service with new key
      initializeSpeechService(
        elevenLabsKey, 
        require('path').join(__dirname, '../../uploads/audio')
      );
      logger.info('Speech service updated with new API key');
    }
    
    // Get LLM provider keys
    if (configuration.llmConfig?.providers) {
      const openAIProvider = configuration.llmConfig.providers.find((p: any) => p.name === 'openai');
      if (openAIProvider?.apiKey) {
        openAIKey = openAIProvider.apiKey;
      }
      
      const anthropicProvider = configuration.llmConfig.providers.find((p: any) => p.name === 'anthropic');
      if (anthropicProvider?.apiKey) {
        anthropicKey = anthropicProvider.apiKey;
      }
    }
    
    // Update global services via constructor if available, or try to update API keys
    if (global.conversationEngine && typeof global.conversationEngine.updateApiKeys === 'function') {
      global.conversationEngine.updateApiKeys(elevenLabsKey, openAIKey, anthropicKey);
      logger.info('Conversation engine updated with new API keys');
    }
    
    if (global.campaignService && typeof global.campaignService.updateApiKeys === 'function') {
      global.campaignService.updateApiKeys(elevenLabsKey, openAIKey, anthropicKey);
      logger.info('Campaign service updated with new API keys');
    }
    
    // Update the emotion service with new configuration
    try {
      const { default: resilientEmotionService } = require('../services/resilientEmotionService');
      if (resilientEmotionService && typeof resilientEmotionService.updateConfig === 'function') {
        await resilientEmotionService.updateConfig();
        logger.info('Emotion service updated with new configuration from database');
      }
    } catch (error) {
      logger.warn(`Could not update emotion service: ${getErrorMessage(error)}`);
    }
    
    logger.info('All services updated with new configuration');
  } catch (error) {
    logger.error(`Error updating services with new config: ${getErrorMessage(error)}`);
  }
};

// @desc    Get system configuration
// @route   GET /api/configuration
// @access  Private
export const getSystemConfiguration = async (_req: Request, res: Response) => {
  try {
    logger.info('Received request for system configuration');
    
    // Get or create configuration
    let configuration = await Configuration.findOne();
    
    if (!configuration) {
      // Create default configuration if none exists
      configuration = await Configuration.create({
        twilioConfig: {
          accountSid: '',
          authToken: '',
          phoneNumbers: [],
          isEnabled: false
        },
        elevenLabsConfig: {
          apiKey: '',
          availableVoices: [],
          isEnabled: false,
          voiceSpeed: 1.0,
          voiceStability: 0.8,
          voiceClarity: 0.9
        },
        llmConfig: {
          providers: [
            {
              name: 'openai',
              apiKey: '',
              availableModels: ['gpt-3.5-turbo', 'gpt-4'],
              isEnabled: false
            }
          ],
          defaultProvider: 'openai',
          defaultModel: 'gpt-4',
          temperature: 0.7,
          maxTokens: 150
        },
        generalSettings: {
          defaultLanguage: 'English',
          supportedLanguages: ['English', 'Hindi'],
          maxConcurrentCalls: 10,
          callRetryAttempts: 3,
          callRetryDelay: 30,
          maxCallDuration: 300,
          defaultSystemPrompt: 'You are a professional sales representative making cold calls. Be polite, respectful, and helpful.',
          defaultTimeZone: 'America/New_York',
          workingHours: {
            start: '09:00',
            end: '17:00',
            timeZone: 'America/New_York',
            daysOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
          }
        },
        complianceSettings: {
          recordCalls: true,
          callIntroduction: 'Hello, this is an automated call from [Company Name]. This call may be recorded for quality and training purposes.',
          maxCallsPerLeadPerDay: 1,
          callBlackoutPeriod: {
            start: '21:00',
            end: '08:00'
          }
        },
        webhookConfig: {
          url: '',
          secret: ''
        }
      });
    }

    // Remove sensitive information before sending to client
    const configToSend = configuration.toObject();
    
    // Note: We no longer mask API keys in responses since the frontend uses password inputs for security
    // The UI handles masking through password input components
    
    // Log what we're sending back to the client (sanitized)
    logger.info('Sending system configuration to client with fields:', {
      elevenLabsConfig: {
        voiceSpeed: configToSend.elevenLabsConfig.voiceSpeed,
        voiceStability: configToSend.elevenLabsConfig.voiceStability,
        voiceClarity: configToSend.elevenLabsConfig.voiceClarity,
        isEnabled: configToSend.elevenLabsConfig.isEnabled,
      },
      llmConfig: {
        defaultProvider: configToSend.llmConfig.defaultProvider,
        defaultModel: configToSend.llmConfig.defaultModel,
        temperature: configToSend.llmConfig.temperature,
        maxTokens: configToSend.llmConfig.maxTokens,
      },
      generalSettings: {
        maxCallDuration: configToSend.generalSettings.maxCallDuration,
        defaultSystemPrompt: configToSend.generalSettings.defaultSystemPrompt ? 'SET' : 'NOT SET',
        defaultTimeZone: configToSend.generalSettings.defaultTimeZone,
      },
      webhookConfig: {
        url: configToSend.webhookConfig.url ? 'SET' : 'NOT SET',
      }
    });

    res.status(200).json(configToSend);
  } catch (error) {
    logger.error('Error in getSystemConfiguration:', error);
    res.status(500).json({
      message: 'Server error',
      error: handleError(error)
    });
    return;
  }
};

// interfaces
interface LLMProvider {
  name: string;
  apiKey?: string;
  availableModels?: string[];
  isEnabled?: boolean;
}

// Helper functions
const updateApiKeyIfChanged = (newKey: string | undefined, existingKey: string): string => {
  if (typeof newKey === 'undefined') return existingKey;
  
  // If masked (has '••••••••'), keep existing key
  if (isMaskedApiKey(newKey)) {
    logger.debug('Received masked API key, keeping existing value');
    return existingKey;
  }
  
  // If empty string is provided, it's an intentional clear
  if (newKey === '') {
    logger.info('API key explicitly cleared');
    return '';
  }
  
  return newKey;
};

const handleFieldUpdate = <T>(newValue: T | undefined, existingValue: T): T => {
  return typeof newValue === 'undefined' ? existingValue : newValue;
};

const maskApiKey = (apiKey: string): string => {
  if (!apiKey) return '';
  return '••••••••' + apiKey.slice(-4);
};

const validateProviderUpdate = (
  updated: UpdateLLMProvider | undefined, 
  existing: BaseLLMProvider
): BaseLLMProvider => {
  if (!updated) return existing;
  
  // Check if API key is being updated
  let status = existing.status;
  let apiKey = updateApiKeyIfChanged(updated.apiKey, existing.apiKey);
  
  // If API key changed, reset status to unverified
  if (apiKey !== existing.apiKey) {
    // Only change status if the key is actually being set or cleared
    // Not if we're just keeping the existing key due to masking
    if (!isMaskedApiKey(updated.apiKey || '')) {
      logger.info(`API key for provider ${existing.name} changed, resetting status to unverified`);
      status = 'unverified';
    }
  } else if (updated.status) {
    // If status is explicitly provided, use it
    status = updated.status;
  }
  
  return {
    ...existing,
    apiKey,
    availableModels: updated.availableModels ?? existing.availableModels,
    isEnabled: updated.isEnabled ?? existing.isEnabled,
    status,
    lastVerified: updated.lastVerified ?? existing.lastVerified,
    name: updated.name || existing.name
  };
};

// @desc    Update system configuration
// @route   PUT /api/configuration
// @access  Private
export const updateSystemConfiguration = async (req: Request, res: Response) => {
  const updatedConfig: UpdatedConfig = req.body;
  
  try {
    const config = await Configuration.findOne();
    
    if (!config) {
      logger.warn('Configuration not found');
      res.status(404).json({ 
        message: 'Configuration not found',
        success: false
      });
      return;
    }
    
    const existingConfig = config.toObject();
    
    // Validate and update Twilio config
    if (updatedConfig.twilioConfig) {
      logger.info('Updating Twilio configuration...');
      
      if (updatedConfig.twilioConfig.authToken) {
        const keyUpdate = handleApiKeyUpdate(updatedConfig.twilioConfig.authToken, existingConfig.twilioConfig.authToken);
        if (keyUpdate.error) {
          return res.status(400).json({ 
            message: 'Invalid Twilio auth token',
            error: keyUpdate.error 
          });
        }
        updatedConfig.twilioConfig.authToken = keyUpdate.key;
        
        // If auth token changed, reset status to unverified
        if (keyUpdate.updated) {
          logger.info('Twilio auth token changed, resetting status to unverified');
          updatedConfig.twilioConfig.status = 'unverified';
        }
      }
      
      config.twilioConfig = handleObjectUpdate(updatedConfig.twilioConfig, existingConfig.twilioConfig);
    }
    
    // Validate and update ElevenLabs config
    if (updatedConfig.elevenLabsConfig) {
      logger.info('Updating ElevenLabs configuration...');
      
      // Validate API key if provided
      if (updatedConfig.elevenLabsConfig.apiKey) {
        const validation = validateElevenLabsKey(updatedConfig.elevenLabsConfig.apiKey);
        if (!validation.isValid) {
          return res.status(400).json({ 
            message: 'Invalid ElevenLabs API key',
            error: validation.error 
          });
        }
        
        // If API key changed, reset status to unverified
        const apiKeyUpdate = handleApiKeyUpdate(updatedConfig.elevenLabsConfig.apiKey, existingConfig.elevenLabsConfig.apiKey);
        if (apiKeyUpdate.updated) {
          logger.info('ElevenLabs API key changed, resetting status to unverified');
          updatedConfig.elevenLabsConfig.status = 'unverified';
        }
      }
      
      // Validate voice parameters if provided
      const voiceValidation = validateVoiceParameters({
        voiceSpeed: updatedConfig.elevenLabsConfig.voiceSpeed,
        voiceStability: updatedConfig.elevenLabsConfig.voiceStability,
        voiceClarity: updatedConfig.elevenLabsConfig.voiceClarity
      });
      
      if (!voiceValidation.isValid) {
        return res.status(400).json({ 
          message: 'Invalid voice parameters',
          error: voiceValidation.error 
        });
      }
      
      config.elevenLabsConfig = {
        ...existingConfig.elevenLabsConfig,
        apiKey: updateApiKeyIfChanged(updatedConfig.elevenLabsConfig.apiKey, existingConfig.elevenLabsConfig.apiKey),
        availableVoices: handleFieldUpdate(updatedConfig.elevenLabsConfig.availableVoices, existingConfig.elevenLabsConfig.availableVoices),
        isEnabled: handleFieldUpdate(updatedConfig.elevenLabsConfig.isEnabled, existingConfig.elevenLabsConfig.isEnabled),
        voiceSpeed: handleFieldUpdate(updatedConfig.elevenLabsConfig.voiceSpeed, existingConfig.elevenLabsConfig.voiceSpeed),
        voiceStability: handleFieldUpdate(updatedConfig.elevenLabsConfig.voiceStability, existingConfig.elevenLabsConfig.voiceStability),
        voiceClarity: handleFieldUpdate(updatedConfig.elevenLabsConfig.voiceClarity, existingConfig.elevenLabsConfig.voiceClarity)
      };
    }
    
    // Update LLM config if provided
    if (updatedConfig.llmConfig) {
      logger.info('Updating LLM configuration...');
      
      // Handle providers
      if (updatedConfig.llmConfig.providers) {
        config.llmConfig.providers = existingConfig.llmConfig.providers.map(existingProvider => {
          const updatedProvider = updatedConfig.llmConfig?.providers?.find(p => p.name === existingProvider.name);
          return validateProviderUpdate(updatedProvider, existingProvider);
        });
      }
      
      // Validate and update LLM settings
      if (updatedConfig.llmConfig.temperature || updatedConfig.llmConfig.maxTokens) {
        const llmValidation = validateLLMParameters({
          temperature: updatedConfig.llmConfig.temperature,
          maxTokens: updatedConfig.llmConfig.maxTokens
        });
        
        if (!llmValidation.isValid) {
          return res.status(400).json({
            message: 'Invalid LLM parameters',
            error: llmValidation.error
          });
        }
      }
      
      config.llmConfig = {
        ...config.llmConfig,
        defaultProvider: handleFieldUpdate(updatedConfig.llmConfig.defaultProvider, existingConfig.llmConfig.defaultProvider),
        defaultModel: handleFieldUpdate(updatedConfig.llmConfig.defaultModel, existingConfig.llmConfig.defaultModel),
        temperature: handleFieldUpdate(updatedConfig.llmConfig.temperature, existingConfig.llmConfig.temperature),
        maxTokens: handleFieldUpdate(updatedConfig.llmConfig.maxTokens, existingConfig.llmConfig.maxTokens)
      };
    }
    
    // Validate and update general settings
    if (updatedConfig.generalSettings) {
      logger.info('Updating general settings...');
      
      const generalValidation = validateGeneralSettings({
        maxCallDuration: updatedConfig.generalSettings.maxCallDuration,
        callRetryAttempts: updatedConfig.generalSettings.callRetryAttempts,
        callRetryDelay: updatedConfig.generalSettings.callRetryDelay,
        maxConcurrentCalls: updatedConfig.generalSettings.maxConcurrentCalls
      });
      
      if (!generalValidation.isValid) {
        return res.status(400).json({
          message: 'Invalid general settings',
          error: generalValidation.error
        });
      }
      
      config.generalSettings = {
        ...existingConfig.generalSettings,
        defaultLanguage: handleFieldUpdate(updatedConfig.generalSettings.defaultLanguage, existingConfig.generalSettings.defaultLanguage),
        supportedLanguages: handleFieldUpdate(updatedConfig.generalSettings.supportedLanguages, existingConfig.generalSettings.supportedLanguages),
        maxConcurrentCalls: handleFieldUpdate(updatedConfig.generalSettings.maxConcurrentCalls, existingConfig.generalSettings.maxConcurrentCalls),
        callRetryAttempts: handleFieldUpdate(updatedConfig.generalSettings.callRetryAttempts, existingConfig.generalSettings.callRetryAttempts),
        callRetryDelay: handleFieldUpdate(updatedConfig.generalSettings.callRetryDelay, existingConfig.generalSettings.callRetryDelay),
        maxCallDuration: handleFieldUpdate(updatedConfig.generalSettings.maxCallDuration, existingConfig.generalSettings.maxCallDuration),
        defaultSystemPrompt: handleFieldUpdate(updatedConfig.generalSettings.defaultSystemPrompt, existingConfig.generalSettings.defaultSystemPrompt),
        defaultTimeZone: handleFieldUpdate(updatedConfig.generalSettings.defaultTimeZone, existingConfig.generalSettings.defaultTimeZone),
        workingHours: {
          ...existingConfig.generalSettings.workingHours,
          timeZone: handleFieldUpdate(updatedConfig.generalSettings.defaultTimeZone, existingConfig.generalSettings.workingHours.timeZone)
        }
      };
    }
    
    // Update webhook config if provided
    if (updatedConfig.webhookConfig) {
      logger.info('Updating webhook configuration...');
      config.webhookConfig = {
        ...existingConfig.webhookConfig,
        url: handleFieldUpdate(updatedConfig.webhookConfig.url, existingConfig.webhookConfig.url),
        secret: updateApiKeyIfChanged(updatedConfig.webhookConfig.secret, existingConfig.webhookConfig.secret)
      };
    }      // Save configuration changes
    try {
      await config.save();
      logger.info('Configuration saved successfully');
      
      // Update services with new API keys
      await updateServicesWithNewConfig(config);
      
      // Prepare masked response
      const response = maskSensitiveValues(config.toObject());
      
      // Log configuration update (with masked sensitive data)
      logger.info('Configuration updated:', {
        twilioConfig: {
          isEnabled: response.twilioConfig.isEnabled,
          hasAuthToken: !!response.twilioConfig.authToken,
          phoneNumberCount: response.twilioConfig.phoneNumbers?.length || 0
        },
        elevenLabsConfig: {
          isEnabled: response.elevenLabsConfig.isEnabled,
          hasApiKey: !!response.elevenLabsConfig.apiKey,
          voiceSpeed: response.elevenLabsConfig.voiceSpeed,
          voiceStability: response.elevenLabsConfig.voiceStability,
          voiceClarity: response.elevenLabsConfig.voiceClarity
        },
        llmConfig: {
          defaultProvider: response.llmConfig.defaultProvider,
          defaultModel: response.llmConfig.defaultModel,
          temperature: response.llmConfig.temperature,
          maxTokens: response.llmConfig.maxTokens,
          providers: response.llmConfig.providers.map(p => ({
            name: p.name,
            isEnabled: p.isEnabled,
            hasApiKey: !!p.apiKey
          }))
        },
        generalSettings: {
          maxCallDuration: response.generalSettings.maxCallDuration,
          maxConcurrentCalls: response.generalSettings.maxConcurrentCalls,
          callRetryAttempts: response.generalSettings.callRetryAttempts
        },
        webhookConfig: {
          hasUrl: !!response.webhookConfig.url,
          hasSecret: !!response.webhookConfig.secret
        }
      });
      
      res.status(200).json({
        message: 'Configuration updated successfully',
        success: true,
        configuration: response
      });
      
    } catch (saveError) {
      logger.error('Error saving configuration:', saveError);
      throw saveError;
    }
    
  } catch (error: unknown) {
    logger.error('Error in updateSystemConfiguration:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      config: maskSensitiveValues(req.body)
    });

    if (error instanceof Error && error.name === 'ValidationError') {
      return res.status(400).json({
        message: 'Configuration validation failed',
        success: false,
        error: error.message
      });
    }

    if (error instanceof Error && error.name === 'MongoError') {
      return res.status(500).json({
        message: 'Database error',
        success: false,
        error: 'Failed to save configuration'
      });
    }

    res.status(500).json({
      message: 'Server error',
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// @desc    Get available LLM models and providers
// @route   GET /api/configuration/llm-options
// @access  Private
export const getLLMOptions = async (_req: Request, res: Response) => {
  try {
    // This would typically fetch the latest model information from the LLM providers
    // For now, return predefined options
    const llmOptions = {
      providers: [
        {
          name: 'OpenAI',
          value: 'openai',
          models: [
            { name: 'GPT-3.5 Turbo', value: 'gpt-3.5-turbo' },
            { name: 'GPT-4', value: 'gpt-4' },
            { name: 'GPT-4 Turbo', value: 'gpt-4-turbo' }
          ]
        },
        {
          name: 'Anthropic',
          value: 'anthropic',
          models: [
            { name: 'Claude 2', value: 'claude-2' },
            { name: 'Claude Instant', value: 'claude-instant' },
            { name: 'Claude 3 Opus', value: 'claude-3-opus' },
            { name: 'Claude 3 Sonnet', value: 'claude-3-sonnet' },
            { name: 'Claude 3 Haiku', value: 'claude-3-haiku' }
          ]
        },
        {
          name: 'Google',
          value: 'google',
          models: [
            { name: 'Gemini Pro', value: 'gemini-pro' },
            { name: 'Gemini Ultra', value: 'gemini-ultra' }
          ]
        }
      ]
    };

    res.status(200).json(llmOptions);
  } catch (error) {
    logger.error('Error in getLLMOptions:', error);
    res.status(500).json({
      message: 'Server error',
      error: handleError(error)
    });
    return;
  }
};

// @desc    Get available voice options from ElevenLabs
// @route   GET /api/configuration/voice-options
// @access  Private
export const getVoiceOptions = async (_req: Request, res: Response) => {
  try {
    const configuration = await Configuration.findOne();
    
    if (!configuration || !configuration.elevenLabsConfig.apiKey) {
      return res.status(400).json({ 
        message: 'ElevenLabs API key not configured',
        voices: [] 
      });
    }

    // In a real implementation, this would fetch voices from ElevenLabs API
    // For now, return some sample voices
    const voiceOptions = [
      {
        voiceId: 'EXAVITQu4vr4xnSDxMaL',
        name: 'Rachel',
        previewUrl: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/rachel/sample.mp3'
      },
      {
        voiceId: 'VR6AewLTigWG4xSOukaG',
        name: 'Alex',
        previewUrl: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/alex/sample.mp3'
      },
      {
        voiceId: '21m00Tcm4TlvDq8ikWAM',
        name: 'Jessica',
        previewUrl: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/jessica/sample.mp3'
      },
      {
        voiceId: 'AZnzlk1XvdvUeBnXmlld',
        name: 'Michael',
        previewUrl: 'https://storage.googleapis.com/eleven-public-prod/premade/voices/michael/sample.mp3'
      }
    ];

    return res.status(200).json({ voices: voiceOptions });
  } catch (error) {
    logger.error('Error in getVoiceOptions:', error);
    return res.status(500).json({
      message: 'Server error',
      error: handleError(error)
    });
  }
};

// @desc    Test LLM connection
// @route   POST /api/configuration/test-llm
// @access  Private
export const testLLMConnection = async (req: Request, res: Response) => {
  try {
    const { provider, apiKey, model } = req.body as {
      provider: string;
      apiKey: string;
      model: string;
    };

    if (!provider || !apiKey || !model) {
      return res.status(400).json({ 
        message: 'Provider, API key, and model are required',
        success: false
      });
    }

    let isSuccessful = false;
    let response: any = null;

    // Test connection based on provider
    switch (provider) {
      case 'openai':
        try {
          const openaiResponse = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
              model,
              messages: [{ role: 'user', content: 'Say "Connection successful"' }],
              max_tokens: 50
            },
            {
              headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
              }
            }
          );
          
          isSuccessful = true;
          response = openaiResponse.data;
        } catch (error: unknown) {
          logger.error('OpenAI test connection failed:', error);
          if (error instanceof Error && 'response' in error) {
            response = (error as any).response?.data || handleError(error);
          } else {
            response = handleError(error);
          }
        }
        break;
        
      case 'anthropic':
        try {
          const anthropicResponse = await axios.post(
            'https://api.anthropic.com/v1/messages',
            {
              model,
              messages: [{ role: 'user', content: 'Say "Connection successful"' }],
              max_tokens: 50
            },
            {
              headers: {
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
                'Content-Type': 'application/json'
              }
            }
          );
          
          isSuccessful = true;
          response = anthropicResponse.data;
        } catch (error: unknown) {
          logger.error('Anthropic test connection failed:', error);
          if (error instanceof Error && 'response' in error) {
            response = (error as any).response?.data || handleError(error);
          } else {
            response = handleError(error);
          }
        }
        break;
        
      case 'google':
        try {
          const googleResponse = await axios.post(
            `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent`,
            {
              contents: [{ parts: [{ text: 'Say "Connection successful"' }] }]
            },
            {
              params: { key: apiKey },
              headers: { 'Content-Type': 'application/json' }
            }
          );
          
          isSuccessful = true;
          response = googleResponse.data;
        } catch (error: unknown) {
          logger.error('Google AI test connection failed:', error);
          if (error instanceof Error && 'response' in error) {
            response = (error as any).response?.data || handleError(error);
          } else {
            response = handleError(error);
          }
        }
        break;
        
      default:
        return res.status(400).json({ 
          message: 'Unsupported LLM provider',
          success: false
        });
    }

    // Update LLM provider status in database based on test result
    if (isSuccessful) {
      // Update status in database
      const configuration = await Configuration.findOne();
      if (configuration) {
        // Find the provider and update its status
        const providerIndex = configuration.llmConfig.providers.findIndex(
          p => p.name === provider
        );
        
        if (providerIndex >= 0) {
          configuration.llmConfig.providers[providerIndex].lastVerified = new Date();
          configuration.llmConfig.providers[providerIndex].status = 'verified';
          await configuration.save();
          logger.info(`${provider} LLM provider status updated to verified`);
        }
      }
    } else {
      // Update status to failed
      const configuration = await Configuration.findOne();
      if (configuration) {
        // Find the provider and update its status
        const providerIndex = configuration.llmConfig.providers.findIndex(
          p => p.name === provider
        );
        
        if (providerIndex >= 0) {
          configuration.llmConfig.providers[providerIndex].status = 'failed';
          await configuration.save();
          logger.info(`${provider} LLM provider status updated to failed`);
        }
      }
    }

    return res.status(200).json({
      success: isSuccessful,
      message: isSuccessful ? 'Connection successful' : 'Connection failed',
      details: response
    });
  } catch (error) {
    logger.error('Error in testLLMConnection:', error);
    return res.status(500).json({
      message: 'Server error',
      success: false,
      error: handleError(error)
    });
  }
};

// @desc    Test Twilio connection
// @route   POST /api/configuration/test-twilio
// @access  Private
export const testTwilioConnection = async (req: Request, res: Response) => {
  try {
    const { accountSid, authToken, phoneNumber } = req.body;

    if (!accountSid || !authToken) {
      return res.status(400).json({ message: 'Account SID and Auth Token are required' });
    }

    let isSuccessful = false;
    let response = null;

    try {
      // Initialize Twilio client
      const client = twilio(accountSid, authToken);
      
      // Test by fetching account info
      const account = await client.api.accounts(accountSid).fetch();
      
      // If phoneNumber is provided, verify it's valid
      if (phoneNumber) {
        // Check if phone number exists in account
        const numbers = await client.incomingPhoneNumbers.list({
          phoneNumber
        });
        
        if (numbers.length === 0) {
          return res.status(400).json({
            success: false,
            message: 'Phone number not found in Twilio account',
            accountStatus: account.status
          });
        }
      }
      
      isSuccessful = true;
      response = {
        accountStatus: account.status,
        accountType: account.type,
        accountName: account.friendlyName
      };
      
      // Update status in database
      const configuration = await Configuration.findOne();
      if (configuration) {
        configuration.twilioConfig.lastVerified = new Date();
        configuration.twilioConfig.status = 'verified';
        await configuration.save();
        logger.info('Twilio configuration status updated to verified');
      }
    } catch (error) {
      logger.error('Twilio test connection failed:', error);
      response = handleError(error);
      
      // Update status in database
      const configuration = await Configuration.findOne();
      if (configuration) {
        configuration.twilioConfig.status = 'failed';
        await configuration.save();
        logger.info('Twilio configuration status updated to failed');
      }
    }

    return res.status(200).json({
      success: isSuccessful,
      message: isSuccessful ? 'Connection successful' : 'Connection failed',
      details: response
    });
  } catch (error) {
    logger.error('Error in testTwilioConnection:', error);
    return res.status(500).json({
      message: 'Server error',
      error: handleError(error)
    });
  }
};

// @desc    Test ElevenLabs connection
// @route   POST /api/configuration/test-elevenlabs
// @access  Private
export const testElevenLabsConnection = async (req: Request, res: Response) => {
  try {
    const { apiKey } = req.body;

    if (!apiKey) {
      return res.status(400).json({ message: 'API key is required' });
    }

    let isSuccessful = false;
    let response = null;

    try {
      // Test ElevenLabs connection by getting voices
      const elevenLabsResponse = await axios.get(
        'https://api.elevenlabs.io/v1/voices',
        {
          headers: {
            'xi-api-key': apiKey,
            'Content-Type': 'application/json'
          }
        }
      );
      
      isSuccessful = true;
      response = {
        availableVoices: elevenLabsResponse.data.voices.map((voice: any) => ({
          voiceId: voice.voice_id,
          name: voice.name,
          previewUrl: voice.preview_url
        }))
      };
      
      // Update status in database
      const configuration = await Configuration.findOne();
      if (configuration) {
        configuration.elevenLabsConfig.lastVerified = new Date();
        configuration.elevenLabsConfig.status = 'verified';
        await configuration.save();
        logger.info('ElevenLabs configuration status updated to verified');
      }
    } catch (error: unknown) {
      logger.error('ElevenLabs test connection failed:', error);
      if (error instanceof Error && 'response' in error) {
        response = (error as any).response?.data || handleError(error);
      } else {
        response = handleError(error);
      }
      
      // Update status in database
      const configuration = await Configuration.findOne();
      if (configuration) {
        configuration.elevenLabsConfig.status = 'failed';
        await configuration.save();
        logger.info('ElevenLabs configuration status updated to failed');
      }
    }

    return res.status(200).json({
      success: isSuccessful,
      message: isSuccessful ? 'Connection successful' : 'Connection failed',
      details: response
    });
  } catch (error) {
    logger.error('Error in testElevenLabsConnection:', error);
    return res.status(500).json({
      message: 'Server error',
      error: handleError(error)
    });
  }
};

// @desc    Test voice synthesis with ElevenLabs
// @route   POST /api/configuration/test-voice
// @access  Private
export const testVoiceSynthesis = async (req: Request, res: Response) => {
  try {
    const { voiceId, text, apiKey } = req.body;
    logger.info(`Voice synthesis test request received with voiceId: ${voiceId}`);
    
    if (!voiceId || !text) {
      logger.warn('Voice synthesis test missing required fields', { voiceId: !!voiceId, text: !!text });
      return res.status(400).json({ message: 'Voice ID and text are required' });
    }

    let elevenLabsApiKey = apiKey;

    // If no API key provided in request, get it from configuration
    if (!elevenLabsApiKey) {
      logger.info('No API key provided in request, fetching from configuration');
      const configuration = await Configuration.findOne();
      if (!configuration?.elevenLabsConfig?.apiKey) {
        logger.warn('ElevenLabs API key not configured');
        return res.status(400).json({ message: 'ElevenLabs API key not configured' });
      }
      elevenLabsApiKey = configuration.elevenLabsConfig.apiKey;
    }
    
    // Validate API key format (ElevenLabs keys are typically 32+ characters)
    if (!elevenLabsApiKey || elevenLabsApiKey.length < 32 || elevenLabsApiKey.includes('••••••••')) {
      logger.warn('Invalid ElevenLabs API key format');
      return res.status(400).json({ message: 'Invalid ElevenLabs API key format' });
    }

    logger.info(`Making ElevenLabs API request with voice ID: ${voiceId}`);

    try {
      // Test voice synthesis with ElevenLabs
      const elevenLabsResponse = await axios.post(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        {
          text: text,
          model_id: "eleven_monolingual_v1",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.5
          }
        },
        {
          headers: {
            'xi-api-key': elevenLabsApiKey,
            'Content-Type': 'application/json'
          },
          responseType: 'arraybuffer'
        }
      );

      // Convert audio data to base64
      const audioBuffer = Buffer.from(elevenLabsResponse.data);
      const audioBase64 = audioBuffer.toString('base64');

      // Update ElevenLabs status in database
      const configuration = await Configuration.findOne();
      if (configuration) {
        configuration.elevenLabsConfig.lastVerified = new Date();
        configuration.elevenLabsConfig.status = 'verified';
        await configuration.save();
        logger.info('ElevenLabs configuration status updated to verified after successful voice synthesis');
      }

      logger.info('Voice synthesis successful');
      return res.status(200).json({
        success: true,
        message: 'Voice synthesis successful',
        audioData: `data:audio/mpeg;base64,${audioBase64}`,
        voiceId: voiceId,
        text: text
      });

    } catch (error: unknown) {
      logger.error('ElevenLabs voice synthesis failed:', error);
      let errorMessage = 'Voice synthesis failed';
      let errorDetails = handleError(error);
      let statusCode = 400;

      if (error instanceof Error && 'response' in error) {
        const axiosError = error as any;
        if (axiosError.response?.status === 401) {
          errorMessage = 'Invalid ElevenLabs API key';
          
          // Update ElevenLabs status to failed in database
          const configuration = await Configuration.findOne();
          if (configuration) {
            configuration.elevenLabsConfig.status = 'failed';
            await configuration.save();
            logger.info('ElevenLabs configuration status updated to failed after voice synthesis error');
          }
        } else if (axiosError.response?.status === 422) {
          errorMessage = 'Invalid voice ID or parameters';
        } else if (axiosError.response?.status === 404) {
          errorMessage = 'Voice ID not found';
        }
        
        // Log response for debugging
        if (axiosError.response?.data) {
          try {
            if (typeof axiosError.response.data === 'string') {
              errorDetails = axiosError.response.data;
            } else if (Buffer.isBuffer(axiosError.response.data)) {
              errorDetails = axiosError.response.data.toString('utf8');
            } else {
              errorDetails = JSON.stringify(axiosError.response.data);
            }
            logger.error(`ElevenLabs error details: ${errorDetails}`);
          } catch (parseError) {
            logger.error('Error parsing ElevenLabs error response:', parseError);
          }
        }
        
        statusCode = axiosError.response?.status || 400;
      }

      return res.status(statusCode).json({
        success: false,
        message: errorMessage,
        details: errorDetails
      });
    }

  } catch (error) {
    logger.error('Error in testVoiceSynthesis:', error);
    return res.status(500).json({
      message: 'Server error',
      error: handleError(error)
    });
  }
};

// @desc    Delete API key
// @route   DELETE /api/configuration/api-key/:provider/:name?
// @access  Private
export const deleteApiKey = async (req: Request, res: Response) => {
  try {
    const { provider, name } = req.params;
    
    logger.info(`Received request to delete API key for provider: ${provider}${name ? `, name: ${name}` : ''}`);
    
    // Get existing configuration
    let configuration = await Configuration.findOne();
    
    if (!configuration) {
      return res.status(404).json({ message: 'Configuration not found' });
    }
    
    let success = false;
    let message = '';
    
    // Delete the appropriate API key based on provider
    switch (provider) {
      case 'elevenlabs':
        if (configuration.elevenLabsConfig && configuration.elevenLabsConfig.apiKey) {
          configuration.elevenLabsConfig.apiKey = '';
          configuration.elevenLabsConfig.isEnabled = false;
          configuration.elevenLabsConfig.status = 'unverified';
          success = true;
          message = 'ElevenLabs API key deleted successfully';
          logger.info('ElevenLabs API key deleted');
        } else {
          message = 'No ElevenLabs API key found to delete';
          logger.warn('No ElevenLabs API key found to delete');
        }
        break;
        
      case 'twilio':
        if (configuration.twilioConfig) {
          configuration.twilioConfig.authToken = '';
          configuration.twilioConfig.isEnabled = false;
          configuration.twilioConfig.status = 'unverified';
          success = true;
          message = 'Twilio auth token deleted successfully';
          logger.info('Twilio auth token deleted');
        } else {
          message = 'No Twilio auth token found to delete';
          logger.warn('No Twilio auth token found to delete');
        }
        break;
        
      case 'llm':
        if (!name) {
          return res.status(400).json({ message: 'LLM provider name is required' });
        }
        
        if (configuration.llmConfig && configuration.llmConfig.providers) {
          const providerIndex = configuration.llmConfig.providers.findIndex(
            (p: any) => p.name === name
          );
          
          if (providerIndex >= 0) {
            configuration.llmConfig.providers[providerIndex].apiKey = '';
            configuration.llmConfig.providers[providerIndex].isEnabled = false;
            success = true;
            message = `${name} API key deleted successfully`;
            logger.info(`${name} API key deleted`);
            
            // If this was the default provider, update to another provider if available
            if (configuration.llmConfig.defaultProvider === name) {
              const availableProvider = configuration.llmConfig.providers.find(
                (p: any) => p.name !== name && p.apiKey
              );
              
              if (availableProvider) {
                configuration.llmConfig.defaultProvider = availableProvider.name;
                logger.info(`Updated default LLM provider to ${availableProvider.name}`);
              }
            }
          } else {
            message = `No API key found for LLM provider: ${name}`;
            logger.warn(`No API key found for LLM provider: ${name}`);
          }
        } else {
          message = 'LLM configuration not found';
          logger.warn('LLM configuration not found');
        }
        break;
        
      case 'webhook':
        if (configuration.webhookConfig) {
          configuration.webhookConfig.secret = '';
          success = true;
          message = 'Webhook secret deleted successfully';
          logger.info('Webhook secret deleted');
        } else {
          message = 'No webhook secret found to delete';
          logger.warn('No webhook secret found to delete');
        }
        break;
        
      default:
        return res.status(400).json({ message: 'Invalid provider specified' });
    }
    
    // Save the updated configuration
    if (success) {
      try {
        await configuration.save();
        
        // Update services with new configuration (removed API keys)
        await updateServicesWithNewConfig(configuration);
        
        logger.info('Configuration saved after API key deletion');
      } catch (error) {
        logger.error('Error saving configuration after API key deletion:', error);
        return res.status(500).json({
          message: 'Failed to save configuration after API key deletion',
          error: handleError(error)
        });
      }
    }
    
    return res.status(200).json({
      success,
      message
    });
  } catch (error) {
    logger.error('Error in deleteApiKey:', error);
    return res.status(500).json({
      message: 'Server error',
      error: handleError(error)
    });
  }
};
