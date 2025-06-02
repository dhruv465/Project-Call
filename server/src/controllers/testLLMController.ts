import { Request, Response } from 'express';
import Configuration from '../models/Configuration';
import { logger, getErrorMessage } from '../index';
import axios from 'axios';

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

    // If API key is provided directly, use it; otherwise, get from config
    let providerApiKey = apiKey;
    let modelToUse = model;
    let providerName = provider.toLowerCase();
    
    if (!providerApiKey) {
      const config = await Configuration.findOne();
      
      if (!config) {
        return res.status(404).json({ 
          success: false, 
          message: 'Configuration not found' 
        });
      }

      // Find the provider configuration
      // Map 'gemini' to 'google' for configuration lookup
      const configProviderName = providerName === 'gemini' ? 'google' : providerName;
      
      const providerConfig = config.llmConfig.providers.find(
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

      providerApiKey = providerConfig.apiKey;
      
      // Use the model from the request or the default model from the provider config
      if (!modelToUse) {
        if (providerConfig.availableModels && providerConfig.availableModels.length > 0) {
          modelToUse = providerConfig.availableModels[0];
        } else {
          modelToUse = config.llmConfig.defaultModel;
        }
      }
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
      switch (provider.toLowerCase()) {
        case 'openai':
          response = await testOpenAIModel(providerApiKey, modelToUse, prompt, temperature);
          break;
        case 'anthropic':
          response = await testAnthropicModel(providerApiKey, modelToUse, prompt, temperature);
          break;
        case 'google':
        case 'gemini': // Add 'gemini' as an alias for 'google'
          response = await testGoogleModel(providerApiKey, modelToUse, prompt, temperature);
          break;
        default:
          return res.status(400).json({
            success: false,
            message: `Provider ${provider} is not supported for testing`
          });
      }
      
      isSuccessful = true;
      
      // Update status in database if not using a direct API key
      if (!apiKey) {
        const configuration = await Configuration.findOne();
        if (configuration) {
          // Map 'gemini' to 'google' for configuration lookup
          const configProviderName = providerName === 'gemini' ? 'google' : providerName;
          
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
          // Map 'gemini' to 'google' for configuration lookup
          const configProviderName = provider.toLowerCase() === 'gemini' ? 'google' : provider.toLowerCase();
          
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
 * Test OpenAI model with a sample prompt
 */
async function testOpenAIModel(apiKey: string, model: string, prompt: string, temperature: number) {
  const openaiUrl = 'https://api.openai.com/v1/chat/completions';
  
  const response = await axios.post(openaiUrl, {
    model: model,
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: prompt }
    ],
    temperature: temperature,
    max_tokens: 150
  }, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
  });
  
  return {
    content: response.data.choices[0].message.content,
    model: response.data.model,
    usage: response.data.usage
  };
}

/**
 * Test Anthropic model with a sample prompt
 */
async function testAnthropicModel(apiKey: string, model: string, prompt: string, temperature: number) {
  const anthropicUrl = 'https://api.anthropic.com/v1/messages';
  
  const response = await axios.post(anthropicUrl, {
    model: model,
    messages: [
      { role: 'user', content: prompt }
    ],
    max_tokens: 150,
    temperature: temperature
  }, {
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json'
    }
  });
  
  return {
    content: response.data.content[0].text,
    model: response.data.model,
    usage: {
      input_tokens: response.data.usage?.input_tokens,
      output_tokens: response.data.usage?.output_tokens
    }
  };
}

/**
 * Test Google model with a sample prompt
 */
async function testGoogleModel(apiKey: string, model: string, prompt: string, temperature: number) {
  const googleUrl = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent';
  
  const response = await axios.post(googleUrl, {
    contents: [
      { role: 'user', parts: [{ text: prompt }] }
    ],
    generationConfig: {
      temperature: temperature,
      maxOutputTokens: 150
    }
  }, {
    headers: {
      'Content-Type': 'application/json'
    },
    params: {
      key: apiKey
    }
  });
  
  return {
    content: response.data.candidates[0].content.parts[0].text,
    model: model,
    usage: {
      // Google doesn't provide token usage in the same way
      estimated_tokens: Math.ceil(prompt.length / 4) + Math.ceil(response.data.candidates[0].content.parts[0].text.length / 4)
    }
  };
}
