"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Advanced Voice AI Routes
const express_1 = require("express");
const voiceAIController_1 = __importDefault(require("../controllers/voiceAIController"));
const voiceAIDemoController_1 = __importDefault(require("../controllers/voiceAIDemoController"));
const enhanced_controller_integration_1 = __importDefault(require("../controllers/enhanced_controller_integration"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
const voiceAIController = new voiceAIController_1.default();
const voiceAIDemoController = new voiceAIDemoController_1.default();
const enhancedVoiceAIController = new enhanced_controller_integration_1.default();
// Training and Model Management Routes
router.post('/train-model', auth_1.authenticate, voiceAIController.trainVoiceModel);
router.post('/validate-model', auth_1.authenticate, voiceAIController.validateModelPerformance);
router.get('/personalities', auth_1.authenticate, voiceAIController.getVoicePersonalities);
// Core Voice AI Features
router.post('/analyze-emotion', auth_1.authenticate, voiceAIController.analyzeEmotion);
router.post('/generate-response', auth_1.authenticate, voiceAIController.generateAdaptiveResponse);
router.post('/synthesize-speech', auth_1.authenticate, voiceAIController.synthesizeSpeech);
// Enhanced Emotion Detection Routes
router.post('/analyze-emotion-enhanced', auth_1.authenticate, enhancedVoiceAIController.analyzeEmotionEnhanced.bind(enhancedVoiceAIController));
router.post('/analyze-emotion-audio', auth_1.authenticate, enhancedVoiceAIController.analyzeEmotionAudio.bind(enhancedVoiceAIController));
router.post('/analyze-emotion-multimodal', auth_1.authenticate, enhancedVoiceAIController.analyzeEmotionMultimodal.bind(enhancedVoiceAIController));
router.get('/model-status', auth_1.authenticate, enhancedVoiceAIController.getModelStatus.bind(enhancedVoiceAIController));
// Advanced Conversation Management
router.post('/manage-conversation', auth_1.authenticate, voiceAIController.manageConversationFlow);
router.post('/conversation-analytics', auth_1.authenticate, voiceAIController.getConversationAnalytics);
// Demo and Testing Routes
router.post('/demo/run-complete', auth_1.authenticate, voiceAIDemoController.runCompleteDemo);
router.get('/demo/status', auth_1.authenticate, voiceAIDemoController.getVoiceAIStatus);
exports.default = router;
//# sourceMappingURL=voiceAIRoutes.js.map