import express from 'express';
import { authenticate } from '../middleware/auth';
import {
  getSystemConfiguration,
  updateSystemConfiguration,
  getLLMOptions,
  getVoiceOptions,
  testLLMConnection,
  testTwilioConnection,
  testElevenLabsConnection,
  testVoiceSynthesis
} from '../controllers/configurationController';
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

// Connection tests
router.post('/test-llm', testLLMConnection);
router.post('/test-twilio', testTwilioConnection);
router.post('/test-elevenlabs', testElevenLabsConnection);
router.post('/test-voice', testVoiceSynthesis);

export default router;
