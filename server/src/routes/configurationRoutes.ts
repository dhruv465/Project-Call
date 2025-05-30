import express from 'express';
import { authenticate } from '../middleware/auth';
import {
  getSystemConfiguration,
  updateSystemConfiguration,
  getLLMOptions,
  getVoiceOptions,
  testLLMConnection,
  testTwilioConnection,
  testElevenLabsConnection
} from '../controllers/configurationController';

const router = express.Router();

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

export default router;
