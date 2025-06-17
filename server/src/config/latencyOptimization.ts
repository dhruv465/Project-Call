// Voice generation settings for different latency profiles
export const voiceSettings = {
  // Ultra-low latency for acknowledgments and fillers
  ultraLow: {
    stability: 0.2,
    similarityBoost: 0.6,
    style: 0.1,
    speakerBoost: true,
    outputFormat: 'mp3_44100_64',
    model: 'eleven_turbo_v2' // Use Flash v2.5 model for ultra-low latency (~75ms)
  },
  
  // Low latency for quick responses
  low: {
    stability: 0.4,
    similarityBoost: 0.7,
    style: 0.2,
    speakerBoost: true,
    outputFormat: 'mp3_44100_96',
    model: 'eleven_turbo_v2' // Use Flash v2.5 model
  },
  
  // Balanced latency for normal conversation
  balanced: {
    stability: 0.6,
    similarityBoost: 0.75,
    style: 0.3,
    speakerBoost: true,
    outputFormat: 'mp3_44100_128',
    model: 'eleven_turbo_v2' // Still use Flash v2.5 model but with better quality settings
  },
  
  // High quality for important statements
  highQuality: {
    stability: 0.8,
    similarityBoost: 0.8,
    style: 0.4,
    speakerBoost: true,
    outputFormat: 'mp3_44100_192',
    model: 'eleven_multilingual_v2' // Fall back to multilingual model for highest quality
  }
};

// Common phrases with their latency profiles
export const commonPhrases = {
  acknowledgments: [
    "I understand.",
    "Got it.",
    "I see.",
    "Thanks for sharing that.",
    "I'm listening.",
    "Please go on.",
    "That makes sense."
  ],
  
  thinking: [
    "Hmm, let me think about that.",
    "I'm considering your question.",
    "Let me process that for a moment.",
    "That's an interesting point."
  ],
  
  greetings: [
    "Hello, how are you today?",
    "Hi there! How can I help you?",
    "Good morning! How may I assist you?",
    "Thanks for calling. How can I help you today?",
    "Welcome! What can I do for you?"
  ],
  
  transitions: [
    "Moving on to the next point,",
    "Additionally,",
    "Furthermore,",
    "By the way,"
  ]
};

// Cache settings
export const cacheSettings = {
  // Maximum size of the cache in MB
  maxSizeMB: 50,
  
  // Time-to-live for cached items (in ms)
  ttl: 24 * 60 * 60 * 1000, // 24 hours
  
  // Preload settings
  preload: {
    // Whether to preload common phrases on startup
    enabled: true,
    
    // Voice IDs to preload for
    voiceIds: [], // This will be populated from configuration
    
    // Maximum concurrent preload operations
    concurrency: 3
  }
};

// Parallel processing settings
export const parallelProcessingSettings = {
  // Time to wait before playing acknowledgment sound (ms)
  acknowledgmentDelay: 800,
  
  // Time to wait before playing thinking sound (ms)
  thinkingDelay: 1500,
  
  // Whether to stream partial AI responses before completion
  streamPartialResponses: true,
  
  // Minimum time between thinking sounds (ms)
  thinkingSoundInterval: 2000,
  
  // Maximum thinking sounds to play per response
  maxThinkingSounds: 2
};

// Export default configuration
export default {
  voiceSettings,
  commonPhrases,
  cacheSettings,
  parallelProcessingSettings
};
