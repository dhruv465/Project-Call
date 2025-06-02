import { Request, Response } from 'express';
import Configuration from '../models/Configuration';
import { logger, getErrorMessage } from '../index';
import axios from 'axios';
import twilio from 'twilio';

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
    
    // Mask API keys and tokens
    if (configToSend.twilioConfig.authToken) {
      configToSend.twilioConfig.authToken = '••••••••' + configToSend.twilioConfig.authToken.slice(-4);
    }
    
    if (configToSend.elevenLabsConfig.apiKey) {
      configToSend.elevenLabsConfig.apiKey = '••••••••' + configToSend.elevenLabsConfig.apiKey.slice(-4);
    }
    
    configToSend.llmConfig.providers = configToSend.llmConfig.providers.map((provider: any) => {
      if (provider.apiKey) {
        return {
          ...provider,
          apiKey: '••••••••' + provider.apiKey.slice(-4)
        };
      }
      return provider;
    });

    // Mask webhook secret
    if (configToSend.webhookConfig?.secret) {
      configToSend.webhookConfig.secret = '••••••••' + configToSend.webhookConfig.secret.slice(-4);
    }

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

// @desc    Update system configuration
// @route   PUT /api/configuration
// @access  Private
export const updateSystemConfiguration = async (req: Request, res: Response) => {
  try {
    const updatedConfig = req.body;
    
    // Get existing configuration
    let configuration = await Configuration.findOne();
    
    if (!configuration) {
      return res.status(404).json({ message: 'Configuration not found' });
    }

    // Handle API keys and tokens - don't overwrite if masked values are sent back
    if (updatedConfig.twilioConfig) {
      if (updatedConfig.twilioConfig.authToken && 
          updatedConfig.twilioConfig.authToken.includes('••••••••')) {
        delete updatedConfig.twilioConfig.authToken;
      }
    }
    
    if (updatedConfig.elevenLabsConfig) {
      // Handle API key (don't overwrite if masked)
      if (updatedConfig.elevenLabsConfig.apiKey && 
          updatedConfig.elevenLabsConfig.apiKey.includes('••••••••')) {
        delete updatedConfig.elevenLabsConfig.apiKey;
      } else if (updatedConfig.elevenLabsConfig.apiKey) {
        // Log that we're updating the ElevenLabs API key
        logger.info('New ElevenLabs API key provided, updating...');
        configuration.elevenLabsConfig.apiKey = updatedConfig.elevenLabsConfig.apiKey;
      }
      
      // Handle availableVoices (don't overwrite existing voices if they exist)
      if (updatedConfig.elevenLabsConfig.availableVoices && 
          updatedConfig.elevenLabsConfig.availableVoices.length > 0 &&
          (!configuration.elevenLabsConfig.availableVoices || 
           configuration.elevenLabsConfig.availableVoices.length === 0)) {
        logger.info('Setting initial available voices');
        configuration.elevenLabsConfig.availableVoices = updatedConfig.elevenLabsConfig.availableVoices;
      }
      
      // Always update isEnabled flag
      if (updatedConfig.elevenLabsConfig.isEnabled !== undefined) {
        configuration.elevenLabsConfig.isEnabled = updatedConfig.elevenLabsConfig.isEnabled;
      }
    }
    
    if (updatedConfig.llmConfig && updatedConfig.llmConfig.providers) {
      updatedConfig.llmConfig.providers = updatedConfig.llmConfig.providers.map((provider: any, index: number) => {
        if (provider.apiKey && provider.apiKey.includes('••••••••')) {
          // Get the existing key from the stored configuration
          const existingProvider = configuration.llmConfig.providers[index];
          if (existingProvider) {
            return {
              ...provider,
              apiKey: existingProvider.apiKey
            };
          }
          // If provider doesn't exist in current config, remove the masked key
          delete provider.apiKey;
        }
        return provider;
      });
    }

    // Handle webhook config (don't overwrite if masked values are sent back)
    if (updatedConfig.webhookConfig) {
      if (updatedConfig.webhookConfig.secret && 
          updatedConfig.webhookConfig.secret.includes('••••••••')) {
        delete updatedConfig.webhookConfig.secret;
      }
    }

    // Update configuration with new values - but more carefully
    
    // Handle Twilio config separately (already handled API key masking above)
    if (updatedConfig.twilioConfig) {
      configuration.twilioConfig.accountSid = updatedConfig.twilioConfig.accountSid || configuration.twilioConfig.accountSid;
      configuration.twilioConfig.phoneNumbers = updatedConfig.twilioConfig.phoneNumbers || configuration.twilioConfig.phoneNumbers;
      configuration.twilioConfig.isEnabled = updatedConfig.twilioConfig.isEnabled || configuration.twilioConfig.isEnabled;
    }
    
    // Handle ElevenLabs config (already handled API key and voices above)
    if (updatedConfig.elevenLabsConfig) {
      configuration.elevenLabsConfig.isEnabled = updatedConfig.elevenLabsConfig.isEnabled || configuration.elevenLabsConfig.isEnabled;
      
      // Update voice settings
      if (updatedConfig.elevenLabsConfig.voiceSpeed !== undefined) {
        configuration.elevenLabsConfig.voiceSpeed = updatedConfig.elevenLabsConfig.voiceSpeed;
      }
      if (updatedConfig.elevenLabsConfig.voiceStability !== undefined) {
        configuration.elevenLabsConfig.voiceStability = updatedConfig.elevenLabsConfig.voiceStability;
      }
      if (updatedConfig.elevenLabsConfig.voiceClarity !== undefined) {
        configuration.elevenLabsConfig.voiceClarity = updatedConfig.elevenLabsConfig.voiceClarity;
      }
    }
    
    // Handle LLM config
    if (updatedConfig.llmConfig) {
      // Update default provider and model
      if (updatedConfig.llmConfig.defaultProvider) {
        configuration.llmConfig.defaultProvider = updatedConfig.llmConfig.defaultProvider;
      }
      if (updatedConfig.llmConfig.defaultModel) {
        configuration.llmConfig.defaultModel = updatedConfig.llmConfig.defaultModel;
      }
      
      // Update LLM settings
      if (updatedConfig.llmConfig.temperature !== undefined) {
        configuration.llmConfig.temperature = updatedConfig.llmConfig.temperature;
      }
      if (updatedConfig.llmConfig.maxTokens !== undefined) {
        configuration.llmConfig.maxTokens = updatedConfig.llmConfig.maxTokens;
      }
      
      // Handle providers
      if (updatedConfig.llmConfig.providers && Array.isArray(updatedConfig.llmConfig.providers)) {
        // Update each provider
        updatedConfig.llmConfig.providers.forEach((updatedProvider: any) => {
          const existingProviderIndex = configuration.llmConfig.providers.findIndex(
            (p: any) => p.name === updatedProvider.name
          );
          
          if (existingProviderIndex >= 0) {
            // Skip masked API keys
            if (updatedProvider.apiKey && !updatedProvider.apiKey.includes('••••••••')) {
              configuration.llmConfig.providers[existingProviderIndex].apiKey = updatedProvider.apiKey;
            }
            
            // Update other properties
            if (updatedProvider.isEnabled !== undefined) {
              configuration.llmConfig.providers[existingProviderIndex].isEnabled = updatedProvider.isEnabled;
            }
            if (updatedProvider.availableModels) {
              configuration.llmConfig.providers[existingProviderIndex].availableModels = updatedProvider.availableModels;
            }
          }
        });
      }
    }
    
    // Handle general settings
    if (updatedConfig.generalSettings) {
      // Update properties individually
      if (updatedConfig.generalSettings.defaultLanguage) {
        configuration.generalSettings.defaultLanguage = updatedConfig.generalSettings.defaultLanguage;
      }
      if (updatedConfig.generalSettings.supportedLanguages) {
        configuration.generalSettings.supportedLanguages = updatedConfig.generalSettings.supportedLanguages;
      }
      if (updatedConfig.generalSettings.maxConcurrentCalls !== undefined) {
        configuration.generalSettings.maxConcurrentCalls = updatedConfig.generalSettings.maxConcurrentCalls;
      }
      if (updatedConfig.generalSettings.callRetryAttempts !== undefined) {
        configuration.generalSettings.callRetryAttempts = updatedConfig.generalSettings.callRetryAttempts;
      }
      if (updatedConfig.generalSettings.callRetryDelay !== undefined) {
        configuration.generalSettings.callRetryDelay = updatedConfig.generalSettings.callRetryDelay;
      }
      if (updatedConfig.generalSettings.maxCallDuration !== undefined) {
        configuration.generalSettings.maxCallDuration = updatedConfig.generalSettings.maxCallDuration;
      }
      if (updatedConfig.generalSettings.defaultSystemPrompt) {
        configuration.generalSettings.defaultSystemPrompt = updatedConfig.generalSettings.defaultSystemPrompt;
      }
      if (updatedConfig.generalSettings.defaultTimeZone) {
        configuration.generalSettings.defaultTimeZone = updatedConfig.generalSettings.defaultTimeZone;
        // Also update working hours timezone for backward compatibility
        configuration.generalSettings.workingHours.timeZone = updatedConfig.generalSettings.defaultTimeZone;
      }
    }

    // Handle webhook config
    if (updatedConfig.webhookConfig) {
      if (updatedConfig.webhookConfig.url !== undefined) {
        configuration.webhookConfig.url = updatedConfig.webhookConfig.url;
      }
      if (updatedConfig.webhookConfig.secret && !updatedConfig.webhookConfig.secret.includes('••••••••')) {
        configuration.webhookConfig.secret = updatedConfig.webhookConfig.secret;
      }
    }

    logger.info('Saving updated configuration to database...');
    try {
      await configuration.save();
      logger.info('Configuration saved successfully');
    } catch (error) {
      logger.error('Error saving configuration to database:', error);
      return res.status(500).json({
        message: 'Failed to save configuration to database',
        error: handleError(error)
      });
    }

    // Update services with new API keys
    await updateServicesWithNewConfig(configuration);
    
    // Mask sensitive data before sending response
    const configToSend = configuration.toObject();
    
    if (configToSend.twilioConfig.authToken) {
      configToSend.twilioConfig.authToken = '••••••••' + configToSend.twilioConfig.authToken.slice(-4);
    }
    
    if (configToSend.elevenLabsConfig.apiKey) {
      configToSend.elevenLabsConfig.apiKey = '••••••••' + configToSend.elevenLabsConfig.apiKey.slice(-4);
    }
    
    configToSend.llmConfig.providers = configToSend.llmConfig.providers.map((provider: any) => {
      if (provider.apiKey) {
        return {
          ...provider,
          apiKey: '••••••••' + provider.apiKey.slice(-4)
        };
      }
      return provider;
    });

    // Mask webhook secret in response
    if (configToSend.webhookConfig?.secret) {
      configToSend.webhookConfig.secret = '••••••••' + configToSend.webhookConfig.secret.slice(-4);
    }

    return res.status(200).json({
      message: 'Configuration updated successfully',
      configuration: configToSend
    });
  } catch (error) {
    logger.error('Error in updateSystemConfiguration:', error);
    return res.status(500).json({
      message: 'Server error',
      error: handleError(error)
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
    const { provider, apiKey, model } = req.body;

    if (!provider || !apiKey || !model) {
      return res.status(400).json({ message: 'Provider, API key, and model are required' });
    }

    let isSuccessful = false;
    let response = null;

    // Test connection based on provider
    switch (provider) {
      case 'openai':
        try {
          // Simple test request to OpenAI
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
          // Simple test request to Anthropic
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
          // Simple test request to Google AI
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
        return res.status(400).json({ message: 'Unsupported LLM provider' });
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
    } catch (error) {
      logger.error('Twilio test connection failed:', error);
      response = handleError(error);
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
    } catch (error: unknown) {
      logger.error('ElevenLabs test connection failed:', error);
      if (error instanceof Error && 'response' in error) {
        response = (error as any).response?.data || handleError(error);
      } else {
        response = handleError(error);
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
