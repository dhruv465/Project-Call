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

// Configuration API endpoints
export const configApi = {
  // Get system configuration
  getConfiguration: async () => {
    const response = await api.get('/configuration');
    return response.data;
  },

  // Update system configuration
  updateConfiguration: async (configData: any) => {
    const response = await api.put('/configuration', configData);
    return response.data;
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
  }
};
