// Enhanced Voice AI Controller Integration with Production Models
// This file provides the integration points for the new emotion detection models

import ProductionEmotionService from '../services/productionEmotionService';
import { logger, getErrorMessage } from '../index';
import { Request, Response } from 'express';

interface AudioFeatures {
  mfcc?: number[][];
  spectral_features?: number[];
  temporal_features?: number[];
}

export class EnhancedVoiceAIController {
  private productionEmotionService: ProductionEmotionService;

  constructor() {
    this.productionEmotionService = new ProductionEmotionService();
  }

  // Enhanced emotion analysis with production models
  async analyzeEmotionEnhanced(req: Request, res: Response): Promise<void> {
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
        emotionAnalysis = await this.productionEmotionService.detectEmotionMultimodal(
          text, 
          audioFeatures as AudioFeatures
        );
      } else if (text) {
        // Use text-only model
        emotionAnalysis = await this.productionEmotionService.detectEmotionFromText(text);
      } else if (audioFeatures) {
        // Use audio-only model
        emotionAnalysis = await this.productionEmotionService.detectEmotionFromAudio(audioFeatures as AudioFeatures);
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

    } catch (error) {
      logger.error('Error in enhanced emotion analysis:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to analyze emotion',
        error: getErrorMessage(error)
      });
    }
  }

  // Audio-only emotion analysis endpoint
  async analyzeEmotionAudio(req: Request, res: Response): Promise<void> {
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

    } catch (error) {
      logger.error('Error in audio emotion analysis:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to analyze emotion from audio',
        error: getErrorMessage(error)
      });
    }
  }

  // Multimodal emotion analysis endpoint
  async analyzeEmotionMultimodal(req: Request, res: Response): Promise<void> {
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

    } catch (error) {
      logger.error('Error in multimodal emotion analysis:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to analyze emotion using multimodal approach',
        error: getErrorMessage(error)
      });
    }
  }

  private adaptEmotionForCulture(emotionAnalysis: any, language: string, _culturalProfile?: any): any {
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
  async getModelStatus(_req: Request, res: Response): Promise<void> {
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
        error: getErrorMessage(error)
      });
    }
  }
}

export default EnhancedVoiceAIController;
