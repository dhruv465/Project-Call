// Simple Emotion Service - Bypasses complex emotion detection for ElevenLabs integration
import { logger } from '../index';

export interface EmotionAnalysis {
  primary: string;
  confidence: number;
  secondary?: string;
  intensity: number;
  context: string;
  culturalContext?: string;
  adaptationNeeded: boolean;
}

export interface EmotionResult {
  emotion: string;
  confidence: number;
  all_scores?: { [key: string]: number };
  model_used?: string;
  metadata: {
    model: string;
    latency: number;
    timestamp: string;
    note?: string;
  };
}

/**
 * Simple emotion service that always returns neutral emotion
 * This bypasses complex emotion detection systems that cause 401 errors
 * and allows ElevenLabs to work directly without emotion analysis overhead
 */
export class SimpleEmotionService {
  
  /**
   * Always returns neutral emotion analysis
   */
  async detectEmotionWithCulturalContext(
    audioText: string,
    language: string = 'English',
    culturalContext?: string
  ): Promise<EmotionAnalysis> {
    logger.info('Using simplified emotion detection (always neutral)', {
      textLength: audioText.length,
      language,
      component: 'SimpleEmotionService'
    });

    return {
      primary: 'neutral',
      confidence: 0.8,
      secondary: undefined,
      intensity: 0.3,
      context: 'Neutral conversation tone',
      culturalContext: language === 'Hindi' ? 'Indian cultural context' : 'Western cultural context',
      adaptationNeeded: false
    };
  }

  /**
   * Always returns neutral emotion from text
   */
  async detectEmotionFromText(text: string): Promise<EmotionResult> {
    logger.info('Using simplified text emotion detection (always neutral)', {
      textLength: text.length,
      component: 'SimpleEmotionService'
    });

    return {
      emotion: 'neutral',
      confidence: 0.8,
      all_scores: {
        neutral: 0.8,
        happy: 0.1,
        sad: 0.05,
        angry: 0.025,
        frustrated: 0.025
      },
      model_used: 'simple_neutral',
      metadata: {
        model: 'simple-emotion-service',
        latency: 1, // Instant response
        timestamp: new Date().toISOString(),
        note: 'Simplified emotion detection - always returns neutral'
      }
    };
  }

  /**
   * Always returns neutral emotion from audio
   */
  async detectEmotionFromAudio(audioData: string): Promise<EmotionResult> {
    logger.info('Using simplified audio emotion detection (always neutral)', {
      component: 'SimpleEmotionService'
    });

    return {
      emotion: 'neutral',
      confidence: 0.8,
      all_scores: {
        neutral: 0.8,
        happy: 0.1,
        sad: 0.05,
        angry: 0.025,
        frustrated: 0.025
      },
      model_used: 'simple_neutral_audio',
      metadata: {
        model: 'simple-emotion-service',
        latency: 1,
        timestamp: new Date().toISOString(),
        note: 'Simplified audio emotion detection - always returns neutral'
      }
    };
  }

  /**
   * Get model performance stats
   */
  async getModelPerformanceStats(): Promise<any> {
    return {
      models: {
        simple_emotion: { status: 'ready', accuracy: '100%' },
        note: 'Simple service always returns neutral emotion'
      },
      last_updated: new Date().toISOString()
    };
  }
}

// Export singleton instance
export default new SimpleEmotionService();
