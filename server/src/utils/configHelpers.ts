import { logger } from '../index';
import { ValidationResult } from './configValidation';

// Constants
const API_KEY_MASK_PATTERN = /^[•]+[^•]+$/; // Matches a string that starts with dots and ends with visible chars
const API_KEY_MIN_LENGTH = 20; // Common minimum length for API keys

/**
 * Check if a string appears to be a masked API key
 */
export function isMaskedApiKey(key: string | undefined): boolean {
  if (!key) return false;
  return API_KEY_MASK_PATTERN.test(key);
}

/**
 * Create a masked version of an API key
 */
export function createMaskedApiKey(apiKey: string): string {
  if (!apiKey) return '';
  return '••••••••' + apiKey.slice(-4);
}

/**
 * Validate API key format
 */
export function isValidApiKey(apiKey: string | undefined): ValidationResult {
  if (!apiKey) {
    return { isValid: true }; // Empty key is valid (for disabling a service)
  }

  if (apiKey.length < API_KEY_MIN_LENGTH) {
    return {
      isValid: false,
      error: `API key must be at least ${API_KEY_MIN_LENGTH} characters long`
    };
  }

  if (isMaskedApiKey(apiKey)) {
    return {
      isValid: false,
      error: 'Cannot use a masked API key'
    };
  }

  return { isValid: true };
}

/**
 * Update an API key if it has changed and is valid
 */
export function handleApiKeyUpdate(newKey: string | undefined, existingKey: string): { 
  key: string;
  updated: boolean;
  error?: string;
} {
  // If no new key provided, keep existing
  if (typeof newKey === 'undefined') {
    return { key: existingKey, updated: false };
  }

  // If the new key is masked, keep existing - check for '••••••••' pattern
  if (isMaskedApiKey(newKey)) {
    logger.info('Received masked API key, keeping existing key');
    return { key: existingKey, updated: false };
  }

  // If empty string is provided, it's an intentional clear - validate empty keys as valid
  if (newKey === '') {
    logger.info('API key explicitly cleared');
    return { key: '', updated: true };
  }

  // Validate the new key
  const validation = isValidApiKey(newKey);
  if (!validation.isValid) {
    return {
      key: existingKey,
      updated: false,
      error: validation.error
    };
  }

  // Only update if key has changed
  if (newKey !== existingKey) {
    logger.info('API key updated');
    return { key: newKey, updated: true };
  }

  return { key: existingKey, updated: false };
}

/**
 * Update configuration field value with type checking
 */
export function handleFieldUpdate<T>(newValue: T | undefined, existingValue: T): T {
  return typeof newValue === 'undefined' ? existingValue : newValue;
}

/**
 * Safely handle object field updates, preserving undefined fields
 */
export function handleObjectUpdate<T extends object>(newValue: Partial<T> | undefined, existingValue: T): T {
  if (!newValue) return existingValue;
  
  return {
    ...existingValue,
    ...Object.entries(newValue).reduce((acc, [key, value]) => {
      if (value !== undefined) {
        (acc as any)[key] = value;
      }
      return acc;
    }, {} as Partial<T>)
  };
}

/**
 * Mask sensitive values in configuration object for logging
 */
export function maskSensitiveValues(config: any): any {
  const maskedConfig = { ...config };

  // Helper to mask a value if it exists
  const maskValue = (obj: any, path: string[]) => {
    let current = obj;
    for (let i = 0; i < path.length - 1; i++) {
      if (current[path[i]]) {
        current = current[path[i]];
      } else {
        return;
      }
    }

    const lastKey = path[path.length - 1];
    if (current[lastKey]) {
      current[lastKey] = createMaskedApiKey(current[lastKey]);
    }
  };

  // Paths to sensitive values
  const sensitivePaths = [
    ['twilioConfig', 'authToken'],
    ['elevenLabsConfig', 'apiKey'],
    ['webhookConfig', 'secret']
  ];

  // Mask LLM provider API keys
  if (maskedConfig.llmConfig?.providers) {
    maskedConfig.llmConfig.providers = maskedConfig.llmConfig.providers.map((provider: any) => ({
      ...provider,
      apiKey: provider.apiKey ? createMaskedApiKey(provider.apiKey) : ''
    }));
  }

  // Mask other sensitive values
  sensitivePaths.forEach(path => maskValue(maskedConfig, path));

  return maskedConfig;
}
