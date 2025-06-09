/**
 * Configuration Validation Utilities
 * 
 * Validates environment variables and configuration settings before service initialization
 */
import { logger } from '../index';

export interface GoogleConfig {
  apiKey: string;
  modelName: string;
}

export interface ElevenLabsConfig {
  apiKey: string;
}

export interface DatabaseConfig {
  uri: string;
  name: string;
}

export interface ConfigValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate Google/Gemini configuration
 */
export function validateGoogleConfig(): GoogleConfig {
  const apiKey = process.env.GOOGLE_API_KEY;
  const modelName = process.env.GOOGLE_MODEL_NAME || 'gemini-1.5-flash';
  
  if (!apiKey || apiKey.trim() === '') {
    throw new Error('GOOGLE_API_KEY environment variable is required');
  }
  
  if (!modelName || modelName.trim() === '') {
    logger.warn('GOOGLE_MODEL_NAME not set, using default: gemini-1.5-flash');
  }
  
  logger.info(`Google configuration validated - Model: ${modelName}`);
  return { apiKey, modelName };
}

/**
 * Validate ElevenLabs configuration
 */
export function validateElevenLabsConfig(): ElevenLabsConfig {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  
  if (!apiKey || apiKey.trim() === '') {
    throw new Error('ELEVENLABS_API_KEY environment variable is required');
  }
  
  logger.info('ElevenLabs configuration validated');
  return { apiKey };
}

/**
 * Validate database configuration
 */
export function validateDatabaseConfig(): DatabaseConfig {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/lumina_outreach';
  const name = process.env.DATABASE_NAME || 'lumina_outreach';
  
  if (!uri || uri.trim() === '') {
    throw new Error('MONGODB_URI environment variable is required');
  }
  
  logger.info(`Database configuration validated - URI: ${uri.replace(/\/\/.*@/, '//***@')}`);
  return { uri, name };
}

/**
 * Validate all critical configurations at startup
 */
export function validateAllConfigurations(): ConfigValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  try {
    validateDatabaseConfig();
  } catch (error) {
    errors.push(`Database: ${error instanceof Error ? error.message : String(error)}`);
  }
  
  try {
    validateGoogleConfig();
  } catch (error) {
    errors.push(`Google/Gemini: ${error instanceof Error ? error.message : String(error)}`);
  }
  
  try {
    validateElevenLabsConfig();
  } catch (error) {
    warnings.push(`ElevenLabs: ${error instanceof Error ? error.message : String(error)}`);
  }
  
  // Check optional configurations
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey || openaiKey.trim() === '') {
    warnings.push('OpenAI: OPENAI_API_KEY not configured');
  }
  
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey || anthropicKey.trim() === '') {
    warnings.push('Anthropic: ANTHROPIC_API_KEY not configured');
  }
  
  const twilioSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioToken = process.env.TWILIO_AUTH_TOKEN;
  if (!twilioSid || !twilioToken) {
    warnings.push('Twilio: Account SID or Auth Token not configured');
  }
  
  const isValid = errors.length === 0;
  
  if (isValid) {
    logger.info('All critical configurations validated successfully');
  } else {
    logger.error(`Configuration validation failed with ${errors.length} errors`);
  }
  
  if (warnings.length > 0) {
    logger.warn(`Configuration validation completed with ${warnings.length} warnings`);
  }
  
  return { isValid, errors, warnings };
}

/**
 * Get required environment variables with defaults
 */
export function getRequiredEnvVars() {
  return {
    // Database
    MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/lumina_outreach',
    DATABASE_NAME: process.env.DATABASE_NAME || 'lumina_outreach',
    
    // Google/Gemini
    GOOGLE_API_KEY: process.env.GOOGLE_API_KEY || '',
    GOOGLE_MODEL_NAME: process.env.GOOGLE_MODEL_NAME || 'gemini-1.5-flash',
    
    // ElevenLabs
    ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY || '',
    
    // OpenAI
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
    
    // Anthropic
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
    
    // Twilio
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID || '',
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN || '',
    
    // Server
    PORT: process.env.PORT || '3000',
    NODE_ENV: process.env.NODE_ENV || 'development'
  };
}
