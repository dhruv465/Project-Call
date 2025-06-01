/**
 * Utility functions for checking configuration status
 */

import { configApi } from '../services/configApi';

export interface ConfigurationStatus {
  telephonyConfigured: boolean;
  voiceConfigured: boolean;
  llmConfigured: boolean;
  overallConfigured: boolean;
  details: {
    twilioAccountSid: boolean;
    twilioAuthToken: boolean;
    twilioPhoneNumber: boolean;
    elevenLabsApiKey: boolean;
    llmApiKey: boolean;
  };
}

/**
 * Check if telephony services are properly configured
 */
export async function checkTelephonyConfiguration(): Promise<ConfigurationStatus> {
  try {
    const config = await configApi.getConfiguration();
    
    const twilioAccountSid = !!(config.twilioConfig?.accountSid && !config.twilioConfig.accountSid.includes('••••'));
    const twilioAuthToken = !!(config.twilioConfig?.authToken && !config.twilioConfig.authToken.includes('••••'));
    const twilioPhoneNumber = !!(config.twilioConfig?.phoneNumbers?.[0]);
    
    const elevenLabsApiKey = !!(config.elevenLabsConfig?.apiKey && !config.elevenLabsConfig.apiKey.includes('••••'));
    
    const llmProvider = config.llmConfig?.providers?.find((p: any) => p.name === config.llmConfig?.defaultProvider);
    const llmApiKey = !!(llmProvider?.apiKey && !llmProvider.apiKey.includes('••••'));
    
    const telephonyConfigured = twilioAccountSid && twilioAuthToken && twilioPhoneNumber;
    const voiceConfigured = elevenLabsApiKey;
    const llmConfigured = llmApiKey;
    const overallConfigured = telephonyConfigured && voiceConfigured && llmConfigured;
    
    return {
      telephonyConfigured,
      voiceConfigured,
      llmConfigured,
      overallConfigured,
      details: {
        twilioAccountSid,
        twilioAuthToken,
        twilioPhoneNumber,
        elevenLabsApiKey,
        llmApiKey,
      }
    };
  } catch (error) {
    console.error('Error checking configuration:', error);
    return {
      telephonyConfigured: false,
      voiceConfigured: false,
      llmConfigured: false,
      overallConfigured: false,
      details: {
        twilioAccountSid: false,
        twilioAuthToken: false,
        twilioPhoneNumber: false,
        elevenLabsApiKey: false,
        llmApiKey: false,
      }
    };
  }
}

/**
 * Test telephony service connectivity
 */
export async function testTelephonyConnection(): Promise<{ success: boolean; message: string }> {
  try {
    const config = await configApi.getConfiguration();
    
    if (!config.twilioConfig?.accountSid || !config.twilioConfig?.authToken) {
      return {
        success: false,
        message: 'Twilio credentials not configured'
      };
    }
    
    const result = await configApi.testTwilioConnection({
      accountSid: config.twilioConfig.accountSid,
      authToken: config.twilioConfig.authToken,
      phoneNumber: config.twilioConfig.phoneNumbers?.[0]
    });
    
    return {
      success: result.success,
      message: result.message || (result.success ? 'Connection successful' : 'Connection failed')
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.response?.data?.message || 'Failed to test connection'
    };
  }
}
