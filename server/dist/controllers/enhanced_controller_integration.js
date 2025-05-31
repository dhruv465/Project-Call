"use strict";
// Enhanced Voice AI Controller Integration with Production Models
// This file provides the integration points for the new emotion detection models
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnhancedVoiceAIController = void 0;
const productionEmotionService_1 = __importDefault(require("../services/productionEmotionService"));
const index_1 = require("../index");
class EnhancedVoiceAIController {
    constructor() {
        this.productionEmotionService = new productionEmotionService_1.default();
    }
    // Enhanced emotion analysis with production models
    async analyzeEmotionEnhanced(req, res) {
        const startTime = Date.now();
        try {
            const { text, audioFeatures, language = 'English', culturalProfile } = req.body;
            if (!text && !audioFeatures) {
                res.status(400).json({
                    success: false,
                    message: 'Text or audio features required for emotion analysis'
                });
                return;
            }
            let emotionAnalysis;
            if (text && audioFeatures) {
                // Use multimodal model for best accuracy
                emotionAnalysis = await this.productionEmotionService.detectEmotionMultimodal(text, audioFeatures);
            }
            else if (text) {
                // Use text-only model
                emotionAnalysis = await this.productionEmotionService.detectEmotionFromText(text);
            }
            else if (audioFeatures) {
                // Use audio-only model
                emotionAnalysis = await this.productionEmotionService.detectEmotionFromAudio(audioFeatures);
            }
            // Add cultural context adaptation
            if (language === 'Hindi' || culturalProfile) {
                emotionAnalysis = this.adaptEmotionForCulture(emotionAnalysis, language, culturalProfile);
            }
            res.json({
                success: true,
                emotionAnalysis,
                modelPerformance: {
                    modelUsed: emotionAnalysis?.model_used,
                    confidence: emotionAnalysis?.confidence,
                    processingTime: Date.now() - startTime
                }
            });
        }
        catch (error) {
            index_1.logger.error('Error in enhanced emotion analysis:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to analyze emotion',
                error: (0, index_1.getErrorMessage)(error)
            });
        }
    }
    // Audio-only emotion analysis endpoint
    async analyzeEmotionAudio(req, res) {
        const startTime = Date.now();
        try {
            const { audioFeatures } = req.body;
            if (!audioFeatures) {
                res.status(400).json({
                    success: false,
                    message: 'Audio features required for audio emotion analysis'
                });
                return;
            }
            const emotionAnalysis = await this.productionEmotionService.detectEmotionFromAudio(audioFeatures);
            res.json({
                success: true,
                emotionAnalysis,
                modelPerformance: {
                    modelUsed: emotionAnalysis.model_used,
                    confidence: emotionAnalysis.confidence,
                    processingTime: Date.now() - startTime
                }
            });
        }
        catch (error) {
            index_1.logger.error('Error in audio emotion analysis:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to analyze emotion from audio',
                error: (0, index_1.getErrorMessage)(error)
            });
        }
    }
    // Multimodal emotion analysis endpoint
    async analyzeEmotionMultimodal(req, res) {
        const startTime = Date.now();
        try {
            const { text, audioFeatures } = req.body;
            if (!text || !audioFeatures) {
                res.status(400).json({
                    success: false,
                    message: 'Both text and audio features required for multimodal emotion analysis'
                });
                return;
            }
            const emotionAnalysis = await this.productionEmotionService.detectEmotionMultimodal(text, audioFeatures);
            res.json({
                success: true,
                emotionAnalysis,
                modelPerformance: {
                    modelUsed: emotionAnalysis.model_used,
                    confidence: emotionAnalysis.confidence,
                    processingTime: Date.now() - startTime
                }
            });
        }
        catch (error) {
            index_1.logger.error('Error in multimodal emotion analysis:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to analyze emotion using multimodal approach',
                error: (0, index_1.getErrorMessage)(error)
            });
        }
    }
    adaptEmotionForCulture(emotionAnalysis, language, _culturalProfile) {
        // Cultural adaptation logic
        if (language === 'Hindi') {
            // Adapt for Indian cultural context
            if (emotionAnalysis?.emotion === 'anger') {
                // In Indian context, direct anger expression might be moderated
                emotionAnalysis.culturalAdaptation = 'Consider indirect communication approach';
            }
        }
        return emotionAnalysis;
    }
    // Get production model status
    async getModelStatus(_req, res) {
        try {
            const status = await this.productionEmotionService.getModelPerformanceStats();
            res.json({
                success: true,
                productionModels: status,
                timestamp: new Date().toISOString()
            });
        }
        catch (error) {
            index_1.logger.error('Error getting model status:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get model status',
                error: (0, index_1.getErrorMessage)(error)
            });
        }
    }
}
exports.EnhancedVoiceAIController = EnhancedVoiceAIController;
exports.default = EnhancedVoiceAIController;
//# sourceMappingURL=enhanced_controller_integration.js.map