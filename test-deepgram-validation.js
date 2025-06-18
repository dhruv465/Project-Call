// Test validation function for Deepgram API key

// Mock validation function based on our implementation
function validateDeepgramKey(apiKey) {
  if (!apiKey) {
    return { isValid: true }; // Allow empty key for disabling the service
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
  return { isValid: true };
}

// Test cases
console.log('Testing Deepgram API key validation...');

// Test valid keys
console.log('Valid key (40 chars):', validateDeepgramKey('a'.repeat(40)));
console.log('Valid key (35 chars):', validateDeepgramKey('a'.repeat(35)));

// Test invalid keys
console.log('Invalid key (too short):', validateDeepgramKey('short'));
console.log('Invalid key (too long):', validateDeepgramKey('a'.repeat(150)));
console.log('Empty key (should be valid):', validateDeepgramKey(''));
console.log('Undefined key (should be valid):', validateDeepgramKey(undefined));

// Test dgk_ prefix (should work now)
console.log('Key with dgk_ prefix:', validateDeepgramKey('dgk_' + 'a'.repeat(36)));

// Test other realistic formats
console.log('UUID-like key:', validateDeepgramKey('a1b2c3d4-e5f6-7890-abcd-ef1234567890'));
