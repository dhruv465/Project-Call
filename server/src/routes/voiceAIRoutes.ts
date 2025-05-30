// Advanced Voice AI Routes
import { Router } from 'express';
import VoiceAIController from '../controllers/voiceAIController';
import VoiceAIDemoController from '../controllers/voiceAIDemoController';
import { authenticate } from '../middleware/auth';

const router = Router();
const voiceAIController = new VoiceAIController();
const voiceAIDemoController = new VoiceAIDemoController();

// Training and Model Management Routes
router.post('/train-model', authenticate, voiceAIController.trainVoiceModel);
router.post('/validate-model', authenticate, voiceAIController.validateModelPerformance);
router.get('/personalities', authenticate, voiceAIController.getVoicePersonalities);

// Core Voice AI Features
router.post('/analyze-emotion', authenticate, voiceAIController.analyzeEmotion);
router.post('/generate-response', authenticate, voiceAIController.generateAdaptiveResponse);
router.post('/synthesize-speech', authenticate, voiceAIController.synthesizeSpeech);

// Advanced Conversation Management
router.post('/manage-conversation', authenticate, voiceAIController.manageConversationFlow);
router.post('/conversation-analytics', authenticate, voiceAIController.getConversationAnalytics);

// Demo and Testing Routes
router.post('/demo/run-complete', authenticate, voiceAIDemoController.runCompleteDemo);
router.get('/demo/status', authenticate, voiceAIDemoController.getVoiceAIStatus);

export default router;
