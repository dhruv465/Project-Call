/**
 * ElevenLabs API verification utility
 * Handles validation, verification, and quota management for ElevenLabs API
 */
import axios from 'axios';
import logger from './logger';
import { getErrorMessage } from './logger';
import Configuration from '../models/Configuration';

// Types for ElevenLabs API responses
interface ElevenLabsUserInfo {
  subscription: {
    tier: string;
    character_count: number;
    character_limit: number;
    next_character_count_reset_unix: number;
    status: string;
  };
  is_new_user: boolean;
  xi_api_key: string;
  can_use_delayed_payment_methods: boolean;
}

interface ElevenLabsVerificationResult {
  success: boolean;
  status: 'verified' | 'failed' | 'unverified';
  error?: string;
  errorCode?: string;
  subscription?: {
    tier: string;
    charactersUsed: number;
    characterLimit: number;
    percentUsed: number;
    resetDate?: Date;
    status: string;
  };
  message?: string;
  isUnusualActivity?: boolean;
}

/**
 * Verify ElevenLabs API key by making a request to get user information
 * @param apiKey ElevenLabs API key to verify
 * @returns Verification result with subscription information if successful
 */
export async function verifyElevenLabsApi(apiKey: string): Promise<ElevenLabsVerificationResult> {
  if (!apiKey || apiKey.trim() === '') {
    return {
      success: false,
      status: 'failed',
      error: 'API key is empty',
      message: 'Please provide a valid ElevenLabs API key'
    };
  }

  try {
    // Make API request to get user information
    const response = await axios.get('https://api.elevenlabs.io/v1/user', {
      headers: {
        'xi-api-key': apiKey,
        'Accept': 'application/json'
      },
      timeout: 10000 // 10 second timeout
    });

    const userData: ElevenLabsUserInfo = response.data;

    // Check if the API key is valid and account is active
    if (!userData?.subscription) {
      return {
        success: false,
        status: 'failed',
        error: 'Invalid API response',
        message: 'Unable to retrieve subscription information from ElevenLabs API'
      };
    }

    // Calculate percentage of quota used
    const charactersUsed = userData.subscription.character_count;
    const characterLimit = userData.subscription.character_limit;
    const percentUsed = characterLimit > 0 ? (charactersUsed / characterLimit) * 100 : 0;
    
    // Create reset date from Unix timestamp if available
    let resetDate: Date | undefined;
    if (userData.subscription.next_character_count_reset_unix) {
      resetDate = new Date(userData.subscription.next_character_count_reset_unix * 1000);
    }

    // Check subscription status
    const subscriptionStatus = userData.subscription.status || 'active';
    const isActive = subscriptionStatus.toLowerCase() === 'active';

    if (!isActive) {
      return {
        success: false,
        status: 'failed',
        error: 'Subscription not active',
        message: `ElevenLabs subscription status: ${subscriptionStatus}. Please check your account.`,
        subscription: {
          tier: userData.subscription.tier,
          charactersUsed,
          characterLimit,
          percentUsed,
          resetDate,
          status: subscriptionStatus
        }
      };
    }

    // Check if quota is near limit (95% or more)
    if (percentUsed >= 95) {
      return {
        success: true, // Still verified but with warning
        status: 'verified',
        message: `Warning: ElevenLabs quota is at ${percentUsed.toFixed(1)}% (${charactersUsed} / ${characterLimit} characters). Quota resets on ${resetDate?.toLocaleString() || 'unknown date'}.`,
        subscription: {
          tier: userData.subscription.tier,
          charactersUsed,
          characterLimit,
          percentUsed,
          resetDate,
          status: subscriptionStatus
        }
      };
    }

    // API key is valid and subscription is active with sufficient quota
    return {
      success: true,
      status: 'verified',
      message: `ElevenLabs API verified successfully. Tier: ${userData.subscription.tier}, Usage: ${percentUsed.toFixed(1)}% (${charactersUsed} / ${characterLimit} characters)`,
      subscription: {
        tier: userData.subscription.tier,
        charactersUsed,
        characterLimit,
        percentUsed,
        resetDate,
        status: subscriptionStatus
      }
    };
  } catch (error: any) {
    // Extract error information
    let errorMessage = getErrorMessage(error);
    let errorCode = '';
    let isUnusualActivity = false;

    // Check for Axios error response
    if (error.response) {
      const statusCode = error.response.status;
      errorCode = `HTTP ${statusCode}`;

      // Parse error details from response if available
      if (error.response.data) {
        // Check for the specific unusual activity error
        if (error.response.data.detail?.status === 'detected_unusual_activity') {
          isUnusualActivity = true;
          errorMessage = `Unusual activity detected: ${error.response.data.detail.message || 'Free tier usage disabled'}`;
        } else if (error.response.data.detail) {
          errorMessage = typeof error.response.data.detail === 'string' 
            ? error.response.data.detail 
            : JSON.stringify(error.response.data.detail);
        }
      }

      // Check for common status codes
      if (statusCode === 401) {
        errorMessage = 'Authentication failed. Invalid API key.';
      } else if (statusCode === 403) {
        errorMessage = 'Access forbidden. Your account may have insufficient permissions.';
      } else if (statusCode === 429) {
        errorMessage = 'Rate limit exceeded. Too many requests.';
      }
    }

    logger.error(`ElevenLabs API verification failed: ${errorMessage}`, {
      errorCode,
      isUnusualActivity,
      errorDetails: error
    });

    return {
      success: false,
      status: 'failed',
      error: errorMessage,
      errorCode,
      isUnusualActivity,
      message: isUnusualActivity 
        ? 'Your ElevenLabs account has been temporarily restricted due to unusual activity. This typically happens with free tier accounts that exceed usage limits. Please check your ElevenLabs account or upgrade to a paid plan.'
        : `Failed to verify ElevenLabs API: ${errorMessage}`
    };
  }
}

/**
 * Update ElevenLabs configuration status in the database
 * @param status New status ('verified', 'failed', 'unverified')
 * @param details Additional details to store
 */
export async function updateElevenLabsStatus(
  status: 'verified' | 'failed' | 'unverified', 
  details?: any
): Promise<void> {
  try {
    const update: any = {
      'elevenLabsConfig.status': status,
      'elevenLabsConfig.lastVerified': new Date()
    };

    // Add additional fields if provided
    if (details?.subscription) {
      update['elevenLabsConfig.quotaInfo'] = {
        tier: details.subscription.tier,
        charactersUsed: details.subscription.charactersUsed,
        characterLimit: details.subscription.characterLimit,
        percentUsed: details.subscription.percentUsed,
        resetDate: details.subscription.resetDate,
        status: details.subscription.status
      };
    }

    if (details?.error) {
      update['elevenLabsConfig.lastError'] = details.error;
    }

    if (details?.isUnusualActivity !== undefined) {
      update['elevenLabsConfig.unusualActivityDetected'] = details.isUnusualActivity;
    }

    // Update the configuration
    await Configuration.findOneAndUpdate({}, update, { new: true });
    
    logger.info(`Updated ElevenLabs status to ${status}`, { details });
  } catch (updateError) {
    logger.error(`Failed to update ElevenLabs status: ${getErrorMessage(updateError)}`);
  }
}

/**
 * Verify ElevenLabs API key and update status in database
 * @param apiKey ElevenLabs API key to verify
 * @returns Verification result
 */
export async function verifyAndUpdateElevenLabsApiStatus(apiKey: string): Promise<ElevenLabsVerificationResult> {
  try {
    const result = await verifyElevenLabsApi(apiKey);
    
    // Update status in database
    await updateElevenLabsStatus(result.status, {
      subscription: result.subscription,
      error: result.error,
      isUnusualActivity: result.isUnusualActivity
    });
    
    return result;
  } catch (error) {
    logger.error(`Error in verifyAndUpdateElevenLabsApiStatus: ${getErrorMessage(error)}`);
    
    // Update status to failed
    await updateElevenLabsStatus('failed', {
      error: getErrorMessage(error)
    });
    
    return {
      success: false,
      status: 'failed',
      error: getErrorMessage(error),
      message: 'An unexpected error occurred while verifying the ElevenLabs API key'
    };
  }
}

export default {
  verifyElevenLabsApi,
  updateElevenLabsStatus,
  verifyAndUpdateElevenLabsApiStatus
};
