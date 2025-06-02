import { logger } from '../index';

// Interfaces
export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

// Constants
export const MIN_CALL_DURATION = 30; // 30 seconds
export const MAX_CALL_DURATION = 3600; // 1 hour
export const MIN_RETRY_ATTEMPTS = 0;
export const MAX_RETRY_ATTEMPTS = 5;
export const MIN_RETRY_DELAY = 10; // 10 seconds
export const MAX_RETRY_DELAY = 300; // 5 minutes
export const MIN_CONCURRENT_CALLS = 1;
export const MAX_CONCURRENT_CALLS = 100;
export const MIN_TEMPERATURE = 0;
export const MAX_TEMPERATURE = 2.0;
export const MIN_MAX_TOKENS = 1;
export const MAX_MAX_TOKENS = 32000;

// Helper for validating generic number ranges
function validateNumberInRange(value: number, min: number, max: number, fieldName: string): ValidationResult {
  if (value < min || value > max) {
    return {
      isValid: false,
      error: `${fieldName} must be between ${min} and ${max}`
    };
  }
  return { isValid: true };
}

// Validate ElevenLabs API Key
export function validateElevenLabsKey(apiKey: string | undefined): ValidationResult {
  if (!apiKey) {
    return { isValid: true }; // Allow empty key for disabling the service
  }
  if (apiKey.length < 32) {
    return {
      isValid: false,
      error: 'ElevenLabs API key must be at least 32 characters long'
    };
  }
  return { isValid: true };
}

// Validate Voice Parameters
export function validateVoiceParameters(params: {
  voiceSpeed?: number;
  voiceStability?: number;
  voiceClarity?: number;
}): ValidationResult {
  const { voiceSpeed, voiceStability, voiceClarity } = params;

  if (voiceSpeed !== undefined) {
    if (voiceSpeed < 0.25 || voiceSpeed > 4.0) {
      return {
        isValid: false,
        error: 'Voice speed must be between 0.25 and 4.0'
      };
    }
  }

  if (voiceStability !== undefined) {
    if (voiceStability < 0 || voiceStability > 1) {
      return {
        isValid: false,
        error: 'Voice stability must be between 0 and 1'
      };
    }
  }

  if (voiceClarity !== undefined) {
    if (voiceClarity < 0 || voiceClarity > 1) {
      return {
        isValid: false,
        error: 'Voice clarity must be between 0 and 1'
      };
    }
  }

  return { isValid: true };
}

// Validate LLM Parameters
export function validateLLMParameters(params: {
  temperature?: number;
  maxTokens?: number;
}): ValidationResult {
  const { temperature, maxTokens } = params;

  if (temperature !== undefined) {
    const tempResult = validateNumberInRange(temperature, MIN_TEMPERATURE, MAX_TEMPERATURE, 'Temperature');
    if (!tempResult.isValid) return tempResult;
  }

  if (maxTokens !== undefined) {
    const tokenResult = validateNumberInRange(maxTokens, MIN_MAX_TOKENS, MAX_MAX_TOKENS, 'Max tokens');
    if (!tokenResult.isValid) return tokenResult;
  }

  return { isValid: true };
}

// Validate General Settings
export function validateGeneralSettings(settings: {
  maxCallDuration?: number;
  callRetryAttempts?: number;
  callRetryDelay?: number;
  maxConcurrentCalls?: number;
}): ValidationResult {
  const { maxCallDuration, callRetryAttempts, callRetryDelay, maxConcurrentCalls } = settings;

  if (maxCallDuration !== undefined) {
    const durationResult = validateNumberInRange(maxCallDuration, MIN_CALL_DURATION, MAX_CALL_DURATION, 'Max call duration');
    if (!durationResult.isValid) return durationResult;
  }

  if (callRetryAttempts !== undefined) {
    const retryResult = validateNumberInRange(callRetryAttempts, MIN_RETRY_ATTEMPTS, MAX_RETRY_ATTEMPTS, 'Call retry attempts');
    if (!retryResult.isValid) return retryResult;
  }

  if (callRetryDelay !== undefined) {
    const delayResult = validateNumberInRange(callRetryDelay, MIN_RETRY_DELAY, MAX_RETRY_DELAY, 'Call retry delay');
    if (!delayResult.isValid) return delayResult;
  }

  if (maxConcurrentCalls !== undefined) {
    const concurrentResult = validateNumberInRange(maxConcurrentCalls, MIN_CONCURRENT_CALLS, MAX_CONCURRENT_CALLS, 'Max concurrent calls');
    if (!concurrentResult.isValid) return concurrentResult;
  }

  return { isValid: true };
}

// Log validation errors
export function logValidationError(error: string): void {
  logger.error('Configuration validation error:', { error });
}
