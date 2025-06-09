import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Utility to generate webhook URLs for Twilio based on configuration
 */
export const webhookUrls = {
  /**
   * Get the base webhook URL from environment variables
   */
  getBaseUrl(): string {
    const baseUrl = process.env.WEBHOOK_BASE_URL || 'http://localhost:8000';
    return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  },

  /**
   * Generate a root webhook URL with the specified type
   * This is the recommended approach for all new webhook URLs
   * 
   * @param webhookType The type of webhook (voice, status, gather, etc.)
   * @param callId Optional call ID to include in the URL
   */
  getRootWebhookUrl(webhookType: string, callId?: string): string {
    const baseUrl = this.getBaseUrl();
    let url = `${baseUrl}/?webhookType=${webhookType}`;
    
    if (callId) {
      url += `&callId=${callId}`;
    }
    
    return url;
  },

  /**
   * Generate a voice webhook URL
   */
  getVoiceWebhookUrl(callId?: string): string {
    return this.getRootWebhookUrl('voice', callId);
  },

  /**
   * Generate a status webhook URL
   */
  getStatusWebhookUrl(callId?: string): string {
    return this.getRootWebhookUrl('status', callId);
  },

  /**
   * Generate a gather webhook URL
   */
  getGatherWebhookUrl(callId?: string): string {
    return this.getRootWebhookUrl('gather', callId);
  },

  /**
   * Generate a stream webhook URL
   */
  getStreamWebhookUrl(callId?: string): string {
    return this.getRootWebhookUrl('stream', callId);
  },

  /**
   * Generate a recording webhook URL
   */
  getRecordingWebhookUrl(callId?: string): string {
    return this.getRootWebhookUrl('recording', callId);
  },

  /**
   * Generate a telephony voice webhook URL
   */
  getTelephonyVoiceWebhookUrl(): string {
    return this.getRootWebhookUrl('telephony-voice');
  },

  /**
   * Generate a telephony status webhook URL
   */
  getTelephonyStatusWebhookUrl(): string {
    return this.getRootWebhookUrl('telephony-status');
  },

  /**
   * Generate a telephony recording webhook URL
   */
  getTelephonyRecordingWebhookUrl(): string {
    return this.getRootWebhookUrl('telephony-recording');
  },

  /**
   * Generate a webhook URL with custom parameters
   * 
   * @param webhookType The type of webhook
   * @param params An object containing additional query parameters
   */
  getCustomWebhookUrl(webhookType: string, params: Record<string, string>): string {
    const baseUrl = this.getBaseUrl();
    let url = `${baseUrl}/?webhookType=${webhookType}`;
    
    for (const [key, value] of Object.entries(params)) {
      url += `&${key}=${encodeURIComponent(value)}`;
    }
    
    return url;
  }
};

export default webhookUrls;
