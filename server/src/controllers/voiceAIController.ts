// Advanced Voice AI Controller with Perfect Training Integration
import { Request, Response } from 'express';
import EnhancedVoiceAIService from '../services/enhancedVoiceAIService';
import VoiceTrainingService from '../services/voiceTrainingService';
import { logger, getErrorMessage } from '../index';
import Configuration from '../models/Configuration';

interface VoiceAIRequest extends Request {
  body: {
    text?: string;
    audioBuffer?: Buffer;
    sessionId?: string;
    language?: 'English' | 'Hindi';
    personalityId?: string;
    conversationContext?: string;
    emotionalContext?: string;
    culturalProfile?: any;
    conversationHistory?: any[];
  };
}

export class VoiceAIController {
  private voiceAIService: EnhancedVoiceAIService;
  private trainingService: VoiceTrainingService;
  private activeSessions: Map<string, any> = new Map();

  constructor() {
    // We'll initialize with empty values first, then update with getCredentials
    this.voiceAIService = new EnhancedVoiceAIService('', '');
    this.trainingService = new VoiceTrainingService('');
    
    // Initialize with credentials asynchronously
    this.initializeWithCredentials().catch(error => {
      logger.error(`Error initializing VoiceAIController with credentials: ${getErrorMessage(error)}`);
    });
  }
  
  // Get credentials from database configuration
  private async initializeWithCredentials(): Promise<void> {
    try {
      // Get configuration from database
      const config = await Configuration.findOne();
      
      let elevenLabsKey = '';
      let openAIKey = '';
      
      if (config) {
        // Use credentials from database
        elevenLabsKey = config.elevenLabsConfig?.apiKey || '';
        
        const openAIProvider = config.llmConfig?.providers?.find((p: any) => p.name === 'openai');
        openAIKey = openAIProvider?.apiKey || '';
      } else {
        // Fall back to environment variables if necessary
        elevenLabsKey = process.env.ELEVENLABS_API_KEY || '';
        openAIKey = process.env.OPENAI_API_KEY || '';
        logger.warn('No configuration found in database, using environment variables as fallback');
      }
      
      // Update services with credentials
      this.voiceAIService = new EnhancedVoiceAIService(elevenLabsKey, openAIKey);
      this.trainingService = new VoiceTrainingService(openAIKey);
      
      logger.info('VoiceAIController initialized with credentials from configuration');
    } catch (error) {
      logger.error(`Failed to initialize with credentials: ${getErrorMessage(error)}`);
      
      // Fall back to environment variables if there's an error
      const elevenLabsKey = process.env.ELEVENLABS_API_KEY || '';
      const openAIKey = process.env.OPENAI_API_KEY || '';
      
      this.voiceAIService = new EnhancedVoiceAIService(elevenLabsKey, openAIKey);
      this.trainingService = new VoiceTrainingService(openAIKey);
    }
  }

  // Initialize and train the voice AI model
  trainVoiceModel = async (req: Request, res: Response) => {
    try {
      logger.info('Starting voice AI model training...');

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

      logger.info('Voice AI model training completed successfully');

      res.json({
        success: true,
        message: 'Voice AI model training completed successfully',
        trainingResults,
        modelStatus: 'fully_trained'
      });
    } catch (error) {
      logger.error('Error training voice AI model:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to train voice AI model',
        error: getErrorMessage(error)
      });
    }
  };

  // Get available voice personalities
  getVoicePersonalities = async (req: Request, res: Response) => {
    try {
      const personalities = EnhancedVoiceAIService.getEnhancedVoicePersonalities();
      
      res.json({
        success: true,
        personalities,
        trainingMetrics: this.voiceAIService.getConversationMetrics(),
        modelTrained: this.voiceAIService.isModelFullyTrained()
      });
    } catch (error) {
      logger.error('Error getting voice personalities:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get voice personalities',
        error: getErrorMessage(error)
      });
    }
  };

  // Analyze customer emotion with cultural context
  analyzeEmotion = async (req: VoiceAIRequest, res: Response) => {
    try {
      const { text, language = 'English', culturalProfile } = req.body;

      if (!text) {
        return res.status(400).json({
          success: false,
          message: 'Text is required for emotion analysis'
        });
      }

      const emotionAnalysis = await this.voiceAIService.detectEmotionWithCulturalContext(
        text,
        language,
        culturalProfile ? JSON.stringify(culturalProfile) : undefined
      );

      res.json({
        success: true,
        emotionAnalysis,
        recommendations: this.getEmotionRecommendations(emotionAnalysis)
      });
    } catch (error) {
      logger.error('Error analyzing emotion:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to analyze emotion',
        error: getErrorMessage(error)
      });
    }
  };

  // Generate adaptive response
  generateAdaptiveResponse = async (req: VoiceAIRequest, res: Response) => {
    try {
      const { 
        conversationContext, 
        language = 'English', 
        personalityId = 'professional',
        emotionalContext 
      } = req.body;

      if (!conversationContext) {
        return res.status(400).json({
          success: false,
          message: 'Conversation context is required'
        });
      }

      // Get the selected personality
      const personalities = EnhancedVoiceAIService.getEnhancedVoicePersonalities();
      const personality = personalities.find(p => p.id === personalityId) || personalities[0];

      // Detect emotion from conversation context
      const emotion = await this.voiceAIService.detectEmotionWithCulturalContext(
        conversationContext,
        language,
        emotionalContext
      );

      // Generate culturally-adapted response
      const adaptiveResponse = await this.voiceAIService.generateCulturallyAdaptedResponse(
        emotion,
        conversationContext,
        personality,
        language
      );

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
    } catch (error) {
      logger.error('Error generating adaptive response:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate adaptive response',
        error: getErrorMessage(error)
      });
    }
  };

  // Synthesize speech with advanced features
  synthesizeSpeech = async (req: VoiceAIRequest, res: Response) => {
    try {
      const { 
        text, 
        personalityId = 'professional',
        language = 'English',
        emotionalContext
      } = req.body;

      if (!text) {
        return res.status(400).json({
          success: false,
          message: 'Text is required for speech synthesis'
        });
      }

      // Get the selected personality
      const personalities = EnhancedVoiceAIService.getEnhancedVoicePersonalities();
      const personality = personalities.find(p => p.id === personalityId) || personalities[0];

      // Synthesize speech with cultural adaptation
      const audioBuffer = await this.voiceAIService.synthesizeMultilingualSpeech(
        text,
        personality,
        undefined, // adaptiveSettings not available
        language,
        emotionalContext
      );

      res.set({
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.length.toString(),
        'Content-Disposition': 'attachment; filename="voice_response.mp3"'
      });

      res.send(audioBuffer);
    } catch (error) {
      logger.error('Error synthesizing speech:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to synthesize speech',
        error: getErrorMessage(error)
      });
    }
  };

  // Manage conversation flow with advanced AI
  manageConversationFlow = async (req: VoiceAIRequest, res: Response) => {
    try {
      const { 
        sessionId,
        conversationHistory = [],
        personalityId = 'professional',
        language = 'English',
        culturalProfile 
      } = req.body;

      if (!sessionId) {
        return res.status(400).json({
          success: false,
          message: 'Session ID is required'
        });
      }

      // Get the selected personality
      const personalities = EnhancedVoiceAIService.getEnhancedVoicePersonalities();
      const personality = personalities.find(p => p.id === personalityId) || personalities[0];

      // Get latest customer message for emotion analysis
      const latestMessage = conversationHistory[conversationHistory.length - 1];
      const customerText = latestMessage?.speaker === 'customer' ? latestMessage.content : '';

      let currentEmotion;
      if (customerText) {
        currentEmotion = await this.voiceAIService.detectEmotionWithCulturalContext(
          customerText,
          language,
          culturalProfile ? JSON.stringify(culturalProfile) : undefined
        );
      } else {
        currentEmotion = {
          primary: 'neutral',
          confidence: 0.8,
          intensity: 0.5,
          context: 'No recent customer input',
          adaptationNeeded: false
        };
      }

      // Manage advanced conversation flow
      const flowAnalysis = await this.voiceAIService.manageAdvancedConversationFlow(
        conversationHistory,
        currentEmotion,
        personality,
        language,
        culturalProfile
      );

      // Check if personality adaptation is needed
      const adaptationResult = await this.voiceAIService.adaptVoiceInRealTime(
        currentEmotion,
        conversationHistory.length,
        personality,
        language
      );

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
    } catch (error) {
      logger.error('Error managing conversation flow:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to manage conversation flow',
        error: getErrorMessage(error)
      });
    }
  };

  // Get conversation analytics
  getConversationAnalytics = async (req: VoiceAIRequest, res: Response) => {
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
    } catch (error) {
      logger.error('Error getting conversation analytics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get conversation analytics',
        error: getErrorMessage(error)
      });
    }
  };

  // Validate model performance
  validateModelPerformance = async (req: Request, res: Response) => {
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
    } catch (error) {
      logger.error('Error validating model performance:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to validate model performance',
        error: getErrorMessage(error)
      });
    }
  };

  // Private helper methods
  private getEmotionRecommendations(emotion: any) {
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

  private getFlowRecommendations(flowAnalysis: any, emotion: any) {
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

export default VoiceAIController;
