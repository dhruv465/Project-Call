import axios from 'axios';
import logger from './logger';

/**
 * Validates a Deepgram API key through both format and API connection checking
 */
export class DeepgramValidator {
  private static readonly API_BASE_URL = 'https://api.deepgram.com/v1';
  
  /**
   * Validate a Deepgram API key's format
   * @param apiKey The API key to validate
   * @returns Validation result
   */
  public static validateKeyFormat(apiKey?: string): { isValid: boolean; error?: string } {
    if (!apiKey) {
      return { isValid: false, error: 'API key is required' };
    }
    
    if (apiKey.length < 30) {
      return {
        isValid: false,
        error: 'Deepgram API key must be at least 30 characters long'
      };
    }
    
    if (apiKey.length > 100) {
      return {
        isValid: false,
        error: 'Deepgram API key appears to be too long (max 100 characters)'
      };
    }
    
    // Check for standard key format (optional)
    if (!apiKey.startsWith('dgk_') && !apiKey.match(/^[a-zA-Z0-9_\-]{30,100}$/)) {
      return {
        isValid: false,
        error: 'Deepgram API key format appears invalid'
      };
    }
    
    return { isValid: true };
  }
  
  /**
   * Test a Deepgram API key by making a sample API call
   * @param apiKey The API key to test
   * @returns Test result with latency information
   */
  public static async testApiConnection(apiKey: string): Promise<{
    isValid: boolean;
    error?: string;
    latency?: number;
  }> {
    try {
      const startTime = Date.now();
      
      // Make a request to the balance endpoint which is lightweight
      const response = await axios.get(`${this.API_BASE_URL}/projects/balance`, {
        headers: {
          'Authorization': `Token ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 5000 // 5 second timeout
      });
      
      const latency = Date.now() - startTime;
      
      if (response.status === 200) {
        return {
          isValid: true,
          latency
        };
      } else {
        return {
          isValid: false,
          error: `Received unexpected status: ${response.status}`,
          latency
        };
      }
    } catch (error) {
      logger.error(`Deepgram API test failed: ${error.message}`);
      
      let errorMessage = 'Connection to Deepgram API failed';
      
      // Extract more specific error information if available
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        errorMessage = `Deepgram API error: ${error.response.status} - ${error.response.data?.message || 'Unknown error'}`;
      } else if (error.request) {
        // The request was made but no response was received
        errorMessage = 'No response received from Deepgram API (timeout or network issue)';
      }
      
      return {
        isValid: false,
        error: errorMessage
      };
    }
  }
  
  /**
   * Comprehensive validation of a Deepgram API key
   * @param apiKey The API key to validate
   * @returns Complete validation result
   */
  public static async validateKey(apiKey?: string): Promise<{
    isValid: boolean;
    formatValid: boolean;
    connectionValid: boolean;
    error?: string;
    latency?: number;
  }> {
    // First validate the format
    const formatValidation = this.validateKeyFormat(apiKey);
    
    if (!formatValidation.isValid) {
      return {
        isValid: false,
        formatValid: false,
        connectionValid: false,
        error: formatValidation.error
      };
    }
    
    // Then test the API connection
    try {
      const connectionTest = await this.testApiConnection(apiKey!);
      
      return {
        isValid: connectionTest.isValid,
        formatValid: true,
        connectionValid: connectionTest.isValid,
        error: connectionTest.error,
        latency: connectionTest.latency
      };
    } catch (error) {
      return {
        isValid: false,
        formatValid: true,
        connectionValid: false,
        error: `API connection test error: ${error.message}`
      };
    }
  }
  
  /**
   * Measure latency to different Deepgram regions
   * @param apiKey Valid Deepgram API key
   * @returns Latency measurements for each region
   */
  public static async measureRegionLatencies(apiKey: string): Promise<{
    [region: string]: number | null;
  }> {
    const regions = {
      'us-east': 'api.deepgram.com',
      'us-west': 'api-us-west.deepgram.com',
      'eu-west': 'api-eu-west.deepgram.com',
      'asia': 'api-asia.deepgram.com'
    };
    
    const results: { [region: string]: number | null } = {};
    
    for (const [region, endpoint] of Object.entries(regions)) {
      try {
        const startTime = Date.now();
        
        await axios.get(`https://${endpoint}/v1/projects/balance`, {
          headers: {
            'Authorization': `Token ${apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 5000
        });
        
        results[region] = Date.now() - startTime;
      } catch (error) {
        logger.error(`Failed to test ${region} region: ${error.message}`);
        results[region] = null;
      }
    }
    
    return results;
  }
  
  /**
   * Suggest the best region based on latency measurements
   * @param apiKey Valid Deepgram API key
   * @returns The recommended region with the lowest latency
   */
  public static async suggestBestRegion(apiKey: string): Promise<{
    region: string;
    latency: number | null;
    allLatencies: { [region: string]: number | null };
  }> {
    const latencies = await this.measureRegionLatencies(apiKey);
    
    // Find the region with the lowest latency
    let bestRegion = 'us-east'; // Default
    let lowestLatency = Number.MAX_SAFE_INTEGER;
    
    for (const [region, latency] of Object.entries(latencies)) {
      if (latency !== null && latency < lowestLatency) {
        bestRegion = region;
        lowestLatency = latency;
      }
    }
    
    return {
      region: bestRegion,
      latency: latencies[bestRegion],
      allLatencies: latencies
    };
  }
}

// Export validator
export default DeepgramValidator;
