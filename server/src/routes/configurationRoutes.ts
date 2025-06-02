import express from 'express';
import { authenticate } from '../middleware/auth';
import {
  getSystemConfiguration,
  updateSystemConfiguration,
  getLLMOptions,
  getVoiceOptions,
  testTwilioConnection,
  testElevenLabsConnection,
  testVoiceSynthesis,
  deleteApiKey
} from '../controllers/configurationController';
import { makeTestCall } from '../controllers/testCallController';
import { testLLMChat, testLLMConnection, getAllLLMModels, getProviderLLMModels, getDynamicProviderModels } from '../controllers/llmControllers';
import { logger } from '../index';

const router = express.Router();

// Log middleware for configuration routes
router.use((req, res, next) => {
  logger.info(`Configuration route: ${req.method} ${req.originalUrl}`);
  next();
});

// All routes are protected
router.use(authenticate);

// Configuration routes
router.get('/', getSystemConfiguration);
router.put('/', updateSystemConfiguration);
router.get('/llm-options', getLLMOptions);
router.get('/voice-options', getVoiceOptions);

// LLM model listing routes
router.get('/llm-models', getAllLLMModels);
router.get('/llm-models/:provider', getProviderLLMModels);
router.post('/llm-models/dynamic', getDynamicProviderModels);

// API key management
router.delete('/api-key/:provider/:name?', deleteApiKey);

// Connection tests
router.post('/test-llm', testLLMConnection);
router.post('/test-llm-chat', testLLMChat);
router.post('/test-twilio', testTwilioConnection);
router.post('/test-elevenlabs', testElevenLabsConnection);
router.post('/test-voice', testVoiceSynthesis);
router.post('/test-call', makeTestCall);

export default router;
