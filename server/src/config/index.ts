// Server configuration
import dotenv from 'dotenv';
import { EmotionServiceConfig } from '../types/emotion';

// Load environment variables
dotenv.config();

// Emotion Service Configuration
// Note: This is kept for backward compatibility with older code
// The resilientEmotionService now uses database configuration instead of environment variables
export const EMOTION_SERVICE_CONFIG: EmotionServiceConfig = {
  baseUrl: process.env.EMOTION_SERVICE_URL || 'http://localhost:5001',
  apiKey: process.env.EMOTION_SERVICE_API_KEY || 'development-key',
  modelVersion: process.env.EMOTION_MODEL_VERSION || 'v1',
  timeout: parseInt(process.env.EMOTION_SERVICE_TIMEOUT || '5000')
};

// Export other configurations as needed...
