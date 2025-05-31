/**
 * production.ts
 * Production environment configuration
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Load production environment variables
const envPath = path.resolve(process.cwd(), '.env.production');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config(); // Fallback to default .env file
  console.warn('Production environment file not found, using default environment variables');
}

// Set secure defaults
const DEFAULT_PORT = 3000;
const DEFAULT_HOST = '0.0.0.0';
const DEFAULT_CORS_ORIGIN = '*';
const DEFAULT_LOG_LEVEL = 'info';

// Validate required environment variables
const requiredEnvVars = [
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'ELEVEN_LABS_API_KEY',
  'JWT_SECRET',
  'DATABASE_URL'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

// Database configuration
const database = {
  url: process.env.DATABASE_URL!,
  ssl: process.env.DATABASE_SSL === 'true',
  connectionPoolSize: parseInt(process.env.DATABASE_POOL_SIZE || '10', 10),
  connectionTimeout: parseInt(process.env.DATABASE_TIMEOUT || '30000', 10),
  retryAttempts: parseInt(process.env.DATABASE_RETRY_ATTEMPTS || '3', 10)
};

// Server configuration
const server = {
  port: parseInt(process.env.PORT || String(DEFAULT_PORT), 10),
  host: process.env.HOST || DEFAULT_HOST,
  apiPrefix: process.env.API_PREFIX || '/api',
  corsOrigin: process.env.CORS_ORIGIN || DEFAULT_CORS_ORIGIN,
  jwtSecret: process.env.JWT_SECRET!,
  jwtExpiration: process.env.JWT_EXPIRATION || '24h',
  rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW || '900000', 10), // 15 minutes
  rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX || '300', 10), // 300 requests per window
  trustProxy: process.env.TRUST_PROXY === 'true',
  uploadDir: process.env.UPLOAD_DIR || path.resolve(process.cwd(), 'uploads'),
  tempDir: process.env.TEMP_DIR || path.resolve(process.cwd(), 'tmp')
};

// Logging configuration
const logging = {
  level: process.env.LOG_LEVEL || DEFAULT_LOG_LEVEL,
  file: process.env.LOG_FILE === 'true',
  logDir: process.env.LOG_DIR || path.resolve(process.cwd(), 'logs'),
  maxSize: process.env.LOG_MAX_SIZE || '10m',
  maxFiles: parseInt(process.env.LOG_MAX_FILES || '7', 10),
  errorFile: 'error.log',
  combinedFile: 'combined.log',
  sentryDsn: process.env.SENTRY_DSN,
  sentryEnvironment: 'production'
};

// Telephony service configuration
const telephony = {
  accountSid: process.env.TWILIO_ACCOUNT_SID!,
  authToken: process.env.TWILIO_AUTH_TOKEN!,
  phoneNumbers: process.env.TWILIO_PHONE_NUMBERS?.split(',') || [],
  defaultNumber: process.env.TWILIO_DEFAULT_NUMBER,
  webhookBaseUrl: process.env.WEBHOOK_BASE_URL || `https://${process.env.PUBLIC_HOSTNAME || 'localhost'}/api/webhooks`,
  recordCalls: process.env.RECORD_CALLS === 'true',
  fallbackEnabled: process.env.TELEPHONY_FALLBACK_ENABLED === 'true'
};

// Speech service configuration
const speech = {
  provider: process.env.SPEECH_PROVIDER || 'elevenlabs',
  apiKey: process.env.ELEVEN_LABS_API_KEY!,
  outputDir: process.env.SPEECH_OUTPUT_DIR || path.resolve(process.cwd(), 'tmp/audio'),
  fallbackEnabled: process.env.SPEECH_FALLBACK_ENABLED === 'true',
  defaultVoiceId: process.env.DEFAULT_VOICE_ID
};

// Machine learning configuration
const ml = {
  modelsDir: process.env.MODELS_DIR || path.resolve(process.cwd(), '../training/models'),
  cachingEnabled: process.env.ML_CACHING_ENABLED === 'true',
  batchSize: parseInt(process.env.ML_BATCH_SIZE || '16', 10),
  tensorflowMaxThreads: parseInt(process.env.TF_NUM_THREADS || '4', 10),
  emotionEnabled: process.env.EMOTION_DETECTION_ENABLED === 'true'
};

// Redis configuration (for caching and session management)
const redis = {
  enabled: process.env.REDIS_ENABLED === 'true',
  url: process.env.REDIS_URL,
  password: process.env.REDIS_PASSWORD,
  cacheTTL: parseInt(process.env.REDIS_CACHE_TTL || '3600', 10) // 1 hour
};

// Monitoring configuration
const monitoring = {
  enabled: process.env.MONITORING_ENABLED === 'true',
  prometheusEnabled: process.env.PROMETHEUS_ENABLED === 'true',
  healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '60000', 10), // 1 minute
  alertsEnabled: process.env.ALERTS_ENABLED === 'true',
  alertWebhookUrl: process.env.ALERT_WEBHOOK_URL,
  performanceThresholds: {
    cpuWarning: parseFloat(process.env.CPU_WARNING_THRESHOLD || '70'),
    cpuCritical: parseFloat(process.env.CPU_CRITICAL_THRESHOLD || '90'),
    memoryWarning: parseFloat(process.env.MEMORY_WARNING_THRESHOLD || '70'),
    memoryCritical: parseFloat(process.env.MEMORY_CRITICAL_THRESHOLD || '90'),
    apiLatencyWarning: parseInt(process.env.API_LATENCY_WARNING || '2000', 10), // 2 seconds
    apiLatencyCritical: parseInt(process.env.API_LATENCY_CRITICAL || '5000', 10) // 5 seconds
  }
};

// CRM integration configuration
const crm = {
  provider: process.env.CRM_PROVIDER,
  apiKey: process.env.CRM_API_KEY,
  apiUrl: process.env.CRM_API_URL,
  syncEnabled: process.env.CRM_SYNC_ENABLED === 'true',
  syncInterval: parseInt(process.env.CRM_SYNC_INTERVAL || '300000', 10), // 5 minutes
  maxRetries: parseInt(process.env.CRM_SYNC_MAX_RETRIES || '3', 10)
};

// Security configuration
const security = {
  encryptionKey: process.env.ENCRYPTION_KEY,
  encryptSensitiveData: process.env.ENCRYPT_SENSITIVE_DATA === 'true',
  csrfProtection: process.env.CSRF_PROTECTION === 'true',
  securityHeaders: process.env.SECURITY_HEADERS === 'true',
  apiKeyAuth: process.env.API_KEY_AUTH === 'true',
  jwtAuth: process.env.JWT_AUTH === 'true',
  auditEnabled: process.env.AUDIT_ENABLED === 'true',
  auditLogDir: process.env.AUDIT_LOG_DIR || path.resolve(process.cwd(), 'logs/audit')
};

// Combine all configuration
const config = {
  environment: 'production',
  database,
  server,
  logging,
  telephony,
  speech,
  ml,
  redis,
  monitoring,
  crm,
  security
};

export default config;