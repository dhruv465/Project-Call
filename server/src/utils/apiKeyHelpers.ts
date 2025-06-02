// This file contains temporary fixes for API key handling issues in the application
// Import this file into the configurationController.ts to apply the fixes

/**
 * Checks if a string is a masked API key (contains ••••••••)
 * @param value The string to check
 * @returns True if the string is a masked API key
 */
export const isMaskedApiKey = (value: string): boolean => {
  if (!value) return false;
  return value.includes('••••••••');
};

/**
 * Handles API key updates properly - doesn't overwrite existing keys with empty or masked values
 * @param newKey The new API key value from the request
 * @param existingKey The existing API key value from the database
 * @returns The API key to use (either existing or new)
 */
export const handleApiKeyUpdate = (newKey: string | undefined, existingKey: string): string => {
  // If no new key provided, keep existing
  if (newKey === undefined) return existingKey;
  
  // If masked key provided, keep existing
  if (isMaskedApiKey(newKey)) return existingKey;
  
  // If empty string and existing key is set, keep existing
  if (newKey === '' && existingKey) return existingKey;
  
  // Otherwise use the new key (even if empty, if that's what's intended)
  return newKey;
};

/**
 * Creates an API key string suitable for sending to the client (masked)
 * @param apiKey The full API key
 * @returns A masked version of the API key
 */
export const createMaskedApiKey = (apiKey: string): string => {
  if (!apiKey) return '';
  
  // If key is less than 8 characters, mask all but last 2
  if (apiKey.length < 8) {
    return '••••••' + apiKey.slice(-2);
  }
  
  // Otherwise mask all but last 4
  return '••••••••' + apiKey.slice(-4);
};

/**
 * Check if an API key is valid (not empty or masked)
 * @param apiKey The API key to check
 * @returns True if the API key is valid
 */
export const isValidApiKey = (apiKey: string): boolean => {
  if (!apiKey) return false;
  return !isMaskedApiKey(apiKey);
};
