// Enhanced Voice AI Controller Integration with Production Models
// This file provides the integration points for the new emotion detection models

import { ProductionEmotionService } from '../services/productionEmotionService';

export class EnhancedVoiceAIController {
  private productionEmotionService: ProductionEmotionService;

  constructor() {
    this.productionEmotionService = new ProductionEmotionService();
  }

  // Enhanced emotion analysis with production models
  async analyzeEmotionEnhanced(req, res) {
    try {
      const { text, audioFeatures, language = 'English', culturalProfile } = req.body;

      if (!text && !audioFeatures) {
        return res.status(400).json({
          success: false,
          message: 'Text or audio features required for emotion analysis'
        });
      }

      let emotionAnalysis;

      if (text && audioFeatures) {
        // Use multimodal model for best accuracy
        emotionAnalysis = await this.productionEmotionService.detectEmotionMultimodal(
          text, 
          audioFeatures
        );
      } else if (text) {
        // Use text-only model
        emotionAnalysis = await this.productionEmotionService.detectEmotionFromText(text);
      } else if (audioFeatures) {
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
          modelUsed: emotionAnalysis.model_used,
          confidence: emotionAnalysis.confidence,
          processingTime: Date.now() - req.startTime
        }
      });

    } catch (error) {
      logger.error('Error in enhanced emotion analysis:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to analyze emotion',
        error: error.message
      });
    }
  }

  private adaptEmotionForCulture(emotionAnalysis, language, culturalProfile) {
    // Cultural adaptation logic
    if (language === 'Hindi') {
      // Adapt for Indian cultural context
      if (emotionAnalysis.emotion === 'anger') {
        // In Indian context, direct anger expression might be moderated
        emotionAnalysis.culturalAdaptation = 'Consider indirect communication approach';
      }
    }
    
    return emotionAnalysis;
  }

  // Get production model status
  async getModelStatus(req, res) {
    try {
      const status = await this.productionEmotionService.getModelPerformanceStats();
      
      res.json({
        success: true,
        productionModels: status,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error getting model status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get model status',
        error: error.message
      });
    }
  }
}

export default EnhancedVoiceAIController;
