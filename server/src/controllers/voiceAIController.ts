import { Request, Response } from 'express';
import { logger } from '../index';
import { handleError } from '../utils/errorHandling';
import { 
  voiceAIService, 
  emotionDetectionService, 
  conversationEngine 
} from '../services';

// @desc    Analyze emotion from text/audio
// @route   POST /api/lumina-outreach/analyze-emotion
// @access  Private
export const analyzeEmotion = async (req: Request, res: Response) => {
  try {
    const { text, audioData, language = 'en' } = req.body;

    if (!text && !audioData) {
      return res.status(400).json({ message: 'Either text or audio data is required' });
    }

    let emotionResult;
    
    if (audioData) {
      // Process audio emotion detection
      emotionResult = await emotionDetectionService.analyzeAudioEmotion(audioData);
    } else {
      // Process text emotion detection
      emotionResult = await emotionDetectionService.analyzeTextEmotion(text, language);
    }

    res.json({
      emotion: emotionResult,
      adaptationRecommendations: await voiceAIService.getAdaptationRecommendations(emotionResult),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error in analyzeEmotion:', error);
    res.status(500).json({
      message: 'Emotion analysis failed',
      error: handleError(error)
    });
  }
};

// @desc    Get voice personalities
// @route   GET /api/lumina-outreach/personalities
// @access  Private
export const getVoicePersonalities = async (req: Request, res: Response) => {
  try {
    const personalities = await voiceAIService.getAvailablePersonalities();
    res.json(personalities);
  } catch (error) {
    logger.error('Error in getVoicePersonalities:', error);
    res.status(500).json({
      message: 'Failed to fetch voice personalities',
      error: handleError(error)
    });
  }
};

// @desc    Synthesize adaptive voice response
// @route   POST /api/lumina-outreach/synthesize
// @access  Private
export const synthesizeVoice = async (req: Request, res: Response) => {
  try {
    const { 
      text, 
      personalityId, 
      emotion, 
      language = 'en',
      adaptToEmotion = true 
    } = req.body;

    if (!text) {
      return res.status(400).json({ message: 'Text is required for synthesis' });
    }

    const audioResult = await voiceAIService.synthesizeAdaptiveVoice({
      text,
      personalityId,
      emotion,
      language,
      adaptToEmotion
    });

    res.json({
      audioUrl: audioResult.audioUrl,
      metadata: audioResult.metadata,
      adaptations: audioResult.adaptations
    });
  } catch (error) {
    logger.error('Error in synthesizeVoice:', error);
    res.status(500).json({
      message: 'Voice synthesis failed',
      error: handleError(error)
    });
  }
};

// @desc    Real-time conversation adaptation
// @route   POST /api/lumina-outreach/adapt-conversation
// @access  Private
export const adaptConversation = async (req: Request, res: Response) => {
  try {
    const { 
      conversationId,
      customerEmotion,
      conversationHistory,
      currentScript,
      language = 'en'
    } = req.body;

    const adaptation = await conversationEngine.adaptConversationFlow({
      conversationId,
      customerEmotion,
      conversationHistory,
      currentScript,
      language
    });

    res.json({
      adaptedScript: adaptation.script,
      voiceAdjustments: adaptation.voiceAdjustments,
      personalityShift: adaptation.personalityShift,
      recommendations: adaptation.recommendations
    });
  } catch (error) {
    logger.error('Error in adaptConversation:', error);
    res.status(500).json({
      message: 'Conversation adaptation failed',
      error: handleError(error)
    });
  }
};

// @desc    Train voice personality
// @route   POST /api/lumina-outreach/train-personality
// @access  Private
export const trainVoicePersonality = async (req: Request, res: Response) => {
  try {
    const { 
      personalityConfig,
      trainingData,
      targetMetrics 
    } = req.body;

    const trainingResult = await voiceAIService.trainPersonality({
      personalityConfig,
      trainingData,
      targetMetrics
    });

    res.json({
      trainingId: trainingResult.id,
      status: trainingResult.status,
      estimatedCompletion: trainingResult.estimatedCompletion,
      metrics: trainingResult.initialMetrics
    });
  } catch (error) {
    logger.error('Error in trainVoicePersonality:', error);
    res.status(500).json({
      message: 'Voice personality training failed',
      error: handleError(error)
    });
  }
};

// @desc    Get emotion detection metrics
// @route   GET /api/lumina-outreach/metrics
// @access  Private
export const getEmotionMetrics = async (req: Request, res: Response) => {
  try {
    const { timeRange = '7d', personalityId } = req.query;

    const metrics = await emotionDetectionService.getMetrics({
      timeRange: timeRange as string,
      personalityId: personalityId as string
    });

    res.json(metrics);
  } catch (error) {
    logger.error('Error in getEmotionMetrics:', error);
    res.status(500).json({
      message: 'Failed to fetch emotion metrics',
      error: handleError(error)
    });
  }
};

// @desc    Test voice AI capabilities
// @route   POST /api/lumina-outreach/test
// @access  Private
export const testVoiceAI = async (req: Request, res: Response) => {
  try {
    const { 
      testType = 'comprehensive',
      personalityId,
      testScenarios 
    } = req.body;

    const testResults = await voiceAIService.runComprehensiveTest({
      testType,
      personalityId,
      testScenarios
    });

    res.json({
      testId: testResults.id,
      results: testResults.results,
      performance: testResults.performance,
      recommendations: testResults.recommendations
    });
  } catch (error) {
    logger.error('Error in testVoiceAI:', error);
    res.status(500).json({
      message: 'Voice AI testing failed',
      error: handleError(error)
    });
  }
};
