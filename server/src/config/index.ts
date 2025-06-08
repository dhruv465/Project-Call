// Server configuration
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Database configuration
export const DB_CONFIG = {
  uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/projectcall',
  options: {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }
};

// Server configuration
export const SERVER_CONFIG = {
  port: parseInt(process.env.PORT || '3001'),
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true
  }
};

// API Keys configuration
export const API_KEYS = {
  elevenLabs: process.env.ELEVENLABS_API_KEY || '',
  openAI: process.env.OPENAI_API_KEY || '',
  anthropic: process.env.ANTHROPIC_API_KEY || '',
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    phoneNumber: process.env.TWILIO_PHONE_NUMBER || ''
  }
};

// JWT configuration
export const JWT_CONFIG = {
  secret: process.env.JWT_SECRET || 'your-secret-key',
  expiresIn: process.env.JWT_EXPIRES_IN || '24h'
};

export default {
  DB_CONFIG,
  SERVER_CONFIG,
  API_KEYS,
  JWT_CONFIG
};
