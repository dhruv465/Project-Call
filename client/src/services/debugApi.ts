import api from './api';

// Add debug functions to test ID handling
export const debugApi = {
  // Verify IDs are valid and exist in the database
  verifyIds: async (data: { leadId?: string; campaignId?: string }) => {
    try {
      console.log('Debug verifyIds - sending data:', data);
      const response = await api.post('/debug/verify-ids', data);
      console.log('Debug verifyIds - received response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error in debug verifyIds:', error);
      throw error;
    }
  },
  
  // Test call creation to diagnose issues
  testCallCreation: async (data: { leadId: string, campaignId: string }) => {
    try {
      console.log('Testing call creation with data:', data);
      const response = await api.post('/debug/test-call-creation', data);
      console.log('Test call creation response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error in test call creation:', error);
      throw error;
    }
  }
};
