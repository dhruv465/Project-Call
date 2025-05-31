"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoiceAIController = void 0;
const enhancedVoiceAIService_1 = __importDefault(require("../services/enhancedVoiceAIService"));
const voiceTrainingService_1 = __importDefault(require("../services/voiceTrainingService"));
const index_1 = require("../index");
class VoiceAIController {
    constructor() {
        this.activeSessions = new Map();
        // Initialize and train the voice AI model
        this.trainVoiceModel = async (req, res) => {
            try {
                index_1.logger.info('Starting voice AI model training...');
                // Train all components of the voice model
                const trainingResults = await this.trainingService.trainCompleteVoiceModel();
                // Mark the service as trained with the results
                this.voiceAIService.markModelAsTrained({
                    emotionalEngagement: trainingResults.emotionAccuracy,
                    personalityConsistency: trainingResults.personalityAccuracy,
                    culturalApproppriateness: trainingResults.bilingualAccuracy,
                    adaptationSuccess: trainingResults.conversationalAccuracy,
                    overallEffectiveness: trainingResults.overallAccuracy
                });
                index_1.logger.info('Voice AI model training completed successfully');
                res.json({
                    success: true,
                    message: 'Voice AI model training completed successfully',
                    trainingResults,
                    modelStatus: 'fully_trained'
                });
            }
            catch (error) {
                index_1.logger.error('Error training voice AI model:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to train voice AI model',
                    error: (0, index_1.getErrorMessage)(error)
                });
            }
        };
        // Get available voice personalities
        this.getVoicePersonalities = async (req, res) => {
            try {
                const personalities = enhancedVoiceAIService_1.default.getEnhancedVoicePersonalities();
                res.json({
                    success: true,
                    personalities,
                    trainingMetrics: this.voiceAIService.getConversationMetrics(),
                    modelTrained: this.voiceAIService.isModelFullyTrained()
                });
            }
            catch (error) {
                index_1.logger.error('Error getting voice personalities:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to get voice personalities',
                    error: (0, index_1.getErrorMessage)(error)
                });
            }
        };
        // Analyze customer emotion with cultural context
        this.analyzeEmotion = async (req, res) => {
            try {
                const { text, language = 'English', culturalProfile } = req.body;
                if (!text) {
                    return res.status(400).json({
                        success: false,
                        message: 'Text is required for emotion analysis'
                    });
                }
                const emotionAnalysis = await this.voiceAIService.detectEmotionWithCulturalContext(text, language, culturalProfile ? JSON.stringify(culturalProfile) : undefined);
                res.json({
                    success: true,
                    emotionAnalysis,
                    recommendations: this.getEmotionRecommendations(emotionAnalysis)
                });
            }
            catch (error) {
                index_1.logger.error('Error analyzing emotion:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to analyze emotion',
                    error: (0, index_1.getErrorMessage)(error)
                });
            }
        };
        // Generate adaptive response
        this.generateAdaptiveResponse = async (req, res) => {
            try {
                const { conversationContext, language = 'English', personalityId = 'professional', emotionalContext } = req.body;
                if (!conversationContext) {
                    return res.status(400).json({
                        success: false,
                        message: 'Conversation context is required'
                    });
                }
                // Get the selected personality
                const personalities = enhancedVoiceAIService_1.default.getEnhancedVoicePersonalities();
                const personality = personalities.find(p => p.id === personalityId) || personalities[0];
                // Detect emotion from conversation context
                const emotion = await this.voiceAIService.detectEmotionWithCulturalContext(conversationContext, language, emotionalContext);
                // Generate culturally-adapted response
                const adaptiveResponse = await this.voiceAIService.generateCulturallyAdaptedResponse(emotion, conversationContext, personality, language);
                res.json({
                    success: true,
                    emotion,
                    adaptiveResponse,
                    personality: {
                        id: personality.id,
                        name: personality.name,
                        trainingMetrics: personality.trainingMetrics
                    }
                });
            }
            catch (error) {
                index_1.logger.error('Error generating adaptive response:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to generate adaptive response',
                    error: (0, index_1.getErrorMessage)(error)
                });
            }
        };
        // Synthesize speech with advanced features
        this.synthesizeSpeech = async (req, res) => {
            try {
                const { text, personalityId = 'professional', language = 'English', emotionalContext } = req.body;
                if (!text) {
                    return res.status(400).json({
                        success: false,
                        message: 'Text is required for speech synthesis'
                    });
                }
                // Get the selected personality
                const personalities = enhancedVoiceAIService_1.default.getEnhancedVoicePersonalities();
                const personality = personalities.find(p => p.id === personalityId) || personalities[0];
                // Synthesize speech with cultural adaptation
                const audioBuffer = await this.voiceAIService.synthesizeMultilingualSpeech(text, personality, undefined, // adaptiveSettings not available
                language, emotionalContext);
                res.set({
                    'Content-Type': 'audio/mpeg',
                    'Content-Length': audioBuffer.length.toString(),
                    'Content-Disposition': 'attachment; filename="voice_response.mp3"'
                });
                res.send(audioBuffer);
            }
            catch (error) {
                index_1.logger.error('Error synthesizing speech:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to synthesize speech',
                    error: (0, index_1.getErrorMessage)(error)
                });
            }
        };
        // Manage conversation flow with advanced AI
        this.manageConversationFlow = async (req, res) => {
            try {
                const { sessionId, conversationHistory = [], personalityId = 'professional', language = 'English', culturalProfile } = req.body;
                if (!sessionId) {
                    return res.status(400).json({
                        success: false,
                        message: 'Session ID is required'
                    });
                }
                // Get the selected personality
                const personalities = enhancedVoiceAIService_1.default.getEnhancedVoicePersonalities();
                const personality = personalities.find(p => p.id === personalityId) || personalities[0];
                // Get latest customer message for emotion analysis
                const latestMessage = conversationHistory[conversationHistory.length - 1];
                const customerText = latestMessage?.speaker === 'customer' ? latestMessage.content : '';
                let currentEmotion;
                if (customerText) {
                    currentEmotion = await this.voiceAIService.detectEmotionWithCulturalContext(customerText, language, culturalProfile ? JSON.stringify(culturalProfile) : undefined);
                }
                else {
                    currentEmotion = {
                        primary: 'neutral',
                        confidence: 0.8,
                        intensity: 0.5,
                        context: 'No recent customer input',
                        adaptationNeeded: false
                    };
                }
                // Manage advanced conversation flow
                const flowAnalysis = await this.voiceAIService.manageAdvancedConversationFlow(conversationHistory, currentEmotion, personality, language, culturalProfile);
                // Check if personality adaptation is needed
                const adaptationResult = await this.voiceAIService.adaptVoiceInRealTime(currentEmotion, conversationHistory.length, personality, language);
                // Update session
                this.activeSessions.set(sessionId, {
                    conversationHistory,
                    currentEmotion,
                    personality: adaptationResult.adaptedPersonality,
                    language,
                    culturalProfile,
                    lastUpdate: new Date()
                });
                res.json({
                    success: true,
                    flowAnalysis,
                    emotionAnalysis: currentEmotion,
                    personalityAdaptation: adaptationResult,
                    sessionUpdated: true,
                    recommendations: this.getFlowRecommendations(flowAnalysis, currentEmotion)
                });
            }
            catch (error) {
                index_1.logger.error('Error managing conversation flow:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to manage conversation flow',
                    error: (0, index_1.getErrorMessage)(error)
                });
            }
        };
        // Get conversation analytics
        this.getConversationAnalytics = async (req, res) => {
            try {
                const { sessionId } = req.body;
                if (!sessionId || !this.activeSessions.has(sessionId)) {
                    return res.status(404).json({
                        success: false,
                        message: 'Session not found'
                    });
                }
                const session = this.activeSessions.get(sessionId);
                const metrics = this.voiceAIService.getConversationMetrics();
                res.json({
                    success: true,
                    analytics: {
                        sessionMetrics: {
                            totalTurns: session.conversationHistory.length,
                            currentEmotion: session.currentEmotion,
                            personalityUsed: session.personality.name,
                            language: session.language,
                            duration: new Date().getTime() - new Date(session.lastUpdate).getTime()
                        },
                        voiceModelMetrics: metrics,
                        isModelTrained: this.voiceAIService.isModelFullyTrained()
                    }
                });
            }
            catch (error) {
                index_1.logger.error('Error getting conversation analytics:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to get conversation analytics',
                    error: (0, index_1.getErrorMessage)(error)
                });
            }
        };
        // Validate model performance
        this.validateModelPerformance = async (req, res) => {
            try {
                const testScenarios = req.body.testScenarios || [
                    {
                        id: 'frustrated_customer',
                        input: 'This is taking too long, I want to cancel!',
                        expectedEmotion: 'frustrated',
                        expectedResponse: 'empathetic'
                    },
                    {
                        id: 'interested_customer',
                        input: 'This sounds really interesting, tell me more!',
                        expectedEmotion: 'interested',
                        expectedResponse: 'enthusiastic'
                    }
                ];
                const validationResults = await this.trainingService.validateModelPerformance(testScenarios);
                res.json({
                    success: true,
                    validationResults,
                    modelStatus: validationResults.accuracy > 0.9 ? 'excellent' : validationResults.accuracy > 0.8 ? 'good' : 'needs_improvement'
                });
            }
            catch (error) {
                index_1.logger.error('Error validating model performance:', error);
                res.status(500).json({
                    success: false,
                    message: 'Failed to validate model performance',
                    error: (0, index_1.getErrorMessage)(error)
                });
            }
        };
        const elevenLabsKey = process.env.ELEVENLABS_API_KEY || '';
        const openAIKey = process.env.OPENAI_API_KEY || '';
        this.voiceAIService = new enhancedVoiceAIService_1.default(elevenLabsKey, openAIKey);
        this.trainingService = new voiceTrainingService_1.default(openAIKey);
    }
    // Private helper methods
    getEmotionRecommendations(emotion) {
        const recommendations = {
            'frustrated': [
                'Use empathetic personality',
                'Lower speaking pace',
                'Acknowledge frustration immediately',
                'Offer quick solutions'
            ],
            'interested': [
                'Use friendly personality',
                'Increase enthusiasm',
                'Provide detailed information',
                'Ask engaging questions'
            ],
            'confused': [
                'Use empathetic personality',
                'Slow down explanation',
                'Use simple language',
                'Provide step-by-step guidance'
            ],
            'skeptical': [
                'Use professional personality',
                'Provide evidence and proof',
                'Use data-driven arguments',
                'Build credibility'
            ]
        };
        return recommendations[emotion.primary] || [
            'Maintain current approach',
            'Monitor emotion changes',
            'Be ready to adapt'
        ];
    }
    getFlowRecommendations(flowAnalysis, emotion) {
        return {
            immediate: [
                `Execute: ${flowAnalysis.nextAction}`,
                `Emotion strategy: ${flowAnalysis.emotionalStrategy}`,
                `Cultural consideration: ${flowAnalysis.culturalConsiderations}`
            ],
            strategic: [
                emotion.intensity > 0.7 ? 'High emotional intensity detected - prioritize emotional response' : 'Normal emotional state',
                flowAnalysis.confidenceScore > 0.8 ? 'High confidence in recommendation' : 'Monitor response and adapt',
                'Continue building rapport and trust'
            ]
        };
    }
}
exports.VoiceAIController = VoiceAIController;
exports.default = VoiceAIController;
//# sourceMappingURL=voiceAIController.js.map