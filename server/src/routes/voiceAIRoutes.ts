// Advanced Voice AI Routes
import { Router } from 'express';
import VoiceAIController from '../controllers/voiceAIController';
import VoiceAIDemoController from '../controllers/voiceAIDemoController';
import EnhancedVoiceAIController from '../controllers/enhanced_controller_integration';
import { authenticate } from '../middleware/auth';

const router = Router();
const voiceAIController = new VoiceAIController();
const voiceAIDemoController = new VoiceAIDemoController();
const enhancedVoiceAIController = new EnhancedVoiceAIController();

// Training and Model Management Routes
router.post('/train-model', authenticate, voiceAIController.trainVoiceModel);
router.post('/validate-model', authenticate, voiceAIController.validateModelPerformance);
router.get('/personalities', authenticate, voiceAIController.getVoicePersonalities);

// Core Voice AI Features
router.post('/analyze-emotion', authenticate, voiceAIController.analyzeEmotion);
router.post('/generate-response', authenticate, voiceAIController.generateAdaptiveResponse);
router.post('/synthesize-speech', authenticate, voiceAIController.synthesizeSpeech);

// Enhanced Emotion Detection Routes
router.post('/analyze-emotion-enhanced', authenticate, enhancedVoiceAIController.analyzeEmotionEnhanced.bind(enhancedVoiceAIController));
router.post('/analyze-emotion-audio', authenticate, enhancedVoiceAIController.analyzeEmotionAudio.bind(enhancedVoiceAIController));
router.post('/analyze-emotion-multimodal', authenticate, enhancedVoiceAIController.analyzeEmotionMultimodal.bind(enhancedVoiceAIController));
router.get('/model-status', authenticate, enhancedVoiceAIController.getModelStatus.bind(enhancedVoiceAIController));

// Advanced Conversation Management
router.post('/manage-conversation', authenticate, voiceAIController.manageConversationFlow);
router.post('/conversation-analytics', authenticate, voiceAIController.getConversationAnalytics);

// Demo and Testing Routes
router.post('/demo/run-complete', authenticate, voiceAIDemoController.runCompleteDemo);
router.get('/demo/status', authenticate, voiceAIDemoController.getVoiceAIStatus);

export default router;
