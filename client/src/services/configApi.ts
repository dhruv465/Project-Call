import api from './api';

// Types
interface LLMConnectionData {
  provider: string;
  apiKey: string;
  model: string;
}

interface TwilioConnectionData {
  accountSid: string;
  authToken: string;
  phoneNumber?: string;
}

interface ElevenLabsConnectionData {
  apiKey: string;
}

interface VoiceSynthesisTestData {
  voiceId: string;
  text: string;
  apiKey?: string;
}

// Configuration API endpoints
export const configApi = {
  // Get system configuration
  getConfiguration: async () => {
    const response = await api.get('/configuration');
    return response.data;
  },

  // Update system configuration
  updateConfiguration: async (configData: any) => {
    // Log the configuration data being sent
    console.log('Updating configuration:', {
      ...configData,
      twilioConfig: {
        ...configData.twilioConfig,
        authToken: configData.twilioConfig.authToken ? '[MASKED]' : 'NOT SET',
      },
      elevenLabsConfig: {
        ...configData.elevenLabsConfig,
        apiKey: configData.elevenLabsConfig.apiKey ? '[MASKED]' : 'NOT SET',
      },
      llmConfig: {
        ...configData.llmConfig,
        providers: configData.llmConfig.providers.map((p: any) => ({
          ...p,
          apiKey: p.apiKey ? '[MASKED]' : 'NOT SET',
        })),
      },
    });
    
    try {
      const response = await api.put('/configuration', configData);
      console.log('Configuration update response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error updating configuration:', error);
      throw error;
    }
  },

  // Get LLM options
  getLLMOptions: async () => {
    const response = await api.get('/configuration/llm-options');
    return response.data;
  },

  // Get voice options
  getVoiceOptions: async () => {
    const response = await api.get('/configuration/voice-options');
    return response.data;
  },

  // Test LLM connection
  testLLMConnection: async (connectionData: LLMConnectionData) => {
    const response = await api.post('/configuration/test-llm', connectionData);
    return response.data;
  },

  // Test Twilio connection
  testTwilioConnection: async (connectionData: TwilioConnectionData) => {
    const response = await api.post('/configuration/test-twilio', connectionData);
    return response.data;
  },

  // Test ElevenLabs connection
  testElevenLabsConnection: async (connectionData: ElevenLabsConnectionData) => {
    const response = await api.post('/configuration/test-elevenlabs', connectionData);
    return response.data;
  },

  // Test voice synthesis
  testVoiceSynthesis: async (synthesisData: VoiceSynthesisTestData) => {
    console.log('Testing voice synthesis with data:', {
      voiceId: synthesisData.voiceId,
      text: synthesisData.text ? `${synthesisData.text.substring(0, 20)}...` : 'empty',
      apiKey: synthesisData.apiKey ? `${synthesisData.apiKey.substring(0, 5)}...${synthesisData.apiKey.substring(synthesisData.apiKey.length - 5)}` : 'NOT SET'
    });
    
    if (!synthesisData.voiceId) {
      throw new Error('Voice ID is required');
    }
    
    if (!synthesisData.text) {
      throw new Error('Text is required');
    }
    
    if (!synthesisData.apiKey) {
      throw new Error('API key is required');
    }
    
    try {
      const response = await api.post('/configuration/test-voice', synthesisData);
      console.log('Voice synthesis test response:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('Voice synthesis test error:', error);
      // Enhanced error reporting with more details
      if (error.response) {
        const errorDetails = error.response.data;
        console.error('Error details:', errorDetails);
        throw new Error(errorDetails.message || 'Voice test failed. Server returned an error.');
      }
      throw error;
    }
  }
};
