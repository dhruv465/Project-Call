import axios from 'axios';
import { logger } from '../index';

export interface SpeechAnalysis {
  transcript: string;
  confidence: number;
  language: 'English' | 'Hindi';
  emotions: {
    primary: string;
    secondary?: string;
    confidence: number;
    intensity: number;
  };
  intent: {
    category: string;
    confidence: number;
    entities: any[];
  };
  sentiment: 'positive' | 'negative' | 'neutral';
  speechFeatures: {
    pace: number;
    volume: number;
    tone: string;
  };
}

export interface ConversationContext {
  currentTurn: number;
  customerProfile: {
    name?: string;
    mood: string;
    interests: string[];
    objections: string[];
    engagement_level: number;
  };
  callObjective: string;
  progress: {
    stage: string;
    completed_objectives: string[];
    next_steps: string[];
  };
}

export class SpeechAnalysisService {
  private openAIApiKey: string;
  private googleSpeechKey?: string;

  constructor(openAIApiKey: string, googleSpeechKey?: string) {
    this.openAIApiKey = openAIApiKey;
    this.googleSpeechKey = googleSpeechKey;
  }

  // Speech-to-Text with Language Detection
  async transcribeAudio(
    audioBuffer: Buffer,
    language?: 'English' | 'Hindi'
  ): Promise<{ transcript: string; language: string; confidence: number }> {
    try {
      // Using OpenAI Whisper for transcription with language detection
      const formData = new FormData();
      const audioBlob = new Blob([audioBuffer], { type: 'audio/wav' });
      formData.append('file', audioBlob, 'audio.wav');
      formData.append('model', 'whisper-1');
      
      if (language) {
        formData.append('language', language === 'English' ? 'en' : 'hi');
      }

      const response = await axios.post(
        'https://api.openai.com/v1/audio/transcriptions',
        formData,
        {
          headers: {
            'Authorization': `Bearer ${this.openAIApiKey}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      const detectedLanguage = this.detectLanguage(response.data.text);
      
      return {
        transcript: response.data.text,
        language: detectedLanguage,
        confidence: 0.9 // OpenAI Whisper generally has high confidence
      };
    } catch (error) {
      logger.error('Error transcribing audio:', error);
      throw new Error('Failed to transcribe audio');
    }
  }

  // Comprehensive Speech Analysis
  async analyzeSpeech(audioText: string, audioFeatures?: any): Promise<SpeechAnalysis> {
    try {
      const analysisPrompt = `Analyze this customer speech comprehensively. Return JSON with:
      
      {
        "transcript": "${audioText}",
        "confidence": 0.9,
        "language": "English or Hindi",
        "emotions": {
          "primary": "main emotion",
          "secondary": "secondary emotion if any",
          "confidence": 0.8,
          "intensity": 0.7
        },
        "intent": {
          "category": "question, objection, interest, concern, request, complaint, compliment",
          "confidence": 0.8,
          "entities": ["extracted entities"]
        },
        "sentiment": "positive, negative, or neutral",
        "speechFeatures": {
          "pace": 1.0,
          "volume": 0.8,
          "tone": "formal, casual, urgent, calm"
        }
      }
      
      Customer speech: "${audioText}"`;

      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: 'You are an expert speech analysis AI. Analyze customer speech for emotions, intent, sentiment, and communication patterns. Always return valid JSON.'
            },
            {
              role: 'user',
              content: analysisPrompt
            }
          ],
          temperature: 0.3,
          max_tokens: 500
        },
        {
          headers: {
            'Authorization': `Bearer ${this.openAIApiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const analysis = JSON.parse(response.data.choices[0].message.content);
      
      // Enhance with audio features if provided
      if (audioFeatures) {
        analysis.speechFeatures = {
          ...analysis.speechFeatures,
          ...audioFeatures
        };
      }

      logger.info('Speech analysis completed:', analysis);
      return analysis;
    } catch (error) {
      logger.error('Error analyzing speech:', error);
      return this.getFallbackAnalysis(audioText);
    }
  }

  // Intent Analysis and Classification
  async analyzeIntent(transcript: string, conversationHistory: any[]): Promise<{
    intent: string;
    confidence: number;
    entities: any[];
    suggestedAction: string;
  }> {
    try {
      const intentPrompt = `Analyze customer intent from this conversation:
      
      Recent history: ${JSON.stringify(conversationHistory.slice(-3))}
      Current message: "${transcript}"
      
      Classify intent as one of:
      - information_request
      - price_inquiry  
      - objection_handling
      - interest_expression
      - scheduling_request
      - complaint
      - technical_question
      - competitor_comparison
      - budget_concern
      - decision_making
      
      Return JSON with intent, confidence (0-1), entities, and suggestedAction.`;

      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: 'You are an expert intent classification system for sales conversations.'
            },
            {
              role: 'user',
              content: intentPrompt
            }
          ],
          temperature: 0.2,
          max_tokens: 300
        },
        {
          headers: {
            'Authorization': `Bearer ${this.openAIApiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return JSON.parse(response.data.choices[0].message.content);
    } catch (error) {
      logger.error('Error analyzing intent:', error);
      return {
        intent: 'information_request',
        confidence: 0.5,
        entities: [],
        suggestedAction: 'provide_information'
      };
    }
  }

  // Context-Aware Conversation Management
  async updateConversationContext(
    context: ConversationContext,
    newAnalysis: SpeechAnalysis,
    agentResponse?: string
  ): Promise<ConversationContext> {
    try {
      const updatePrompt = `Update conversation context based on new customer input:
      
      Current Context: ${JSON.stringify(context)}
      New Customer Input Analysis: ${JSON.stringify(newAnalysis)}
      Agent Response: ${agentResponse || 'None yet'}
      
      Update and return the conversation context with:
      - Updated customer profile (mood, interests, objections, engagement_level)
      - Progress tracking (stage, completed_objectives, next_steps)
      - Incremented turn counter
      
      Return complete updated context as JSON.`;

      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: 'You are a conversation context manager. Track customer state and conversation progress accurately.'
            },
            {
              role: 'user',
              content: updatePrompt
            }
          ],
          temperature: 0.3,
          max_tokens: 600
        },
        {
          headers: {
            'Authorization': `Bearer ${this.openAIApiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const updatedContext = JSON.parse(response.data.choices[0].message.content);
      logger.info('Conversation context updated:', updatedContext);
      
      return updatedContext;
    } catch (error) {
      logger.error('Error updating conversation context:', error);
      // Fallback: manual context update
      return {
        ...context,
        currentTurn: context.currentTurn + 1,
        customerProfile: {
          ...context.customerProfile,
          mood: newAnalysis.emotions.primary,
          engagement_level: Math.min(context.customerProfile.engagement_level + 0.1, 1.0)
        }
      };
    }
  }

  // Bilingual Language Detection
  private detectLanguage(text: string): 'English' | 'Hindi' {
    // Simple language detection based on script
    const hindiPattern = /[\u0900-\u097F]/;
    const englishPattern = /[a-zA-Z]/;
    
    const hindiMatches = (text.match(hindiPattern) || []).length;
    const englishMatches = (text.match(englishPattern) || []).length;
    
    if (hindiMatches > englishMatches) {
      return 'Hindi';
    }
    return 'English';
  }

  // Fallback analysis for error cases
  private getFallbackAnalysis(audioText: string): SpeechAnalysis {
    return {
      transcript: audioText,
      confidence: 0.5,
      language: this.detectLanguage(audioText),
      emotions: {
        primary: 'neutral',
        confidence: 0.5,
        intensity: 0.5
      },
      intent: {
        category: 'information_request',
        confidence: 0.5,
        entities: []
      },
      sentiment: 'neutral',
      speechFeatures: {
        pace: 1.0,
        volume: 0.5,
        tone: 'neutral'
      }
    };
  }

  // Real-time Emotion Tracking
  async trackEmotionChanges(
    emotionHistory: Array<{ emotion: string; timestamp: Date; intensity: number }>,
    currentEmotion: string,
    intensity: number
  ): Promise<{
    emotionTrend: 'improving' | 'declining' | 'stable';
    recommendations: string[];
    alertLevel: 'low' | 'medium' | 'high';
  }> {
    try {
      // Calculate emotion trend
      const recentEmotions = emotionHistory.slice(-5);
      const emotionTrend = this.calculateEmotionTrend(recentEmotions, currentEmotion, intensity);
      
      // Generate recommendations based on trend
      const recommendations = await this.generateEmotionBasedRecommendations(
        emotionTrend,
        currentEmotion,
        intensity
      );
      
      // Determine alert level
      const alertLevel = this.determineAlertLevel(currentEmotion, intensity, emotionTrend);
      
      return {
        emotionTrend,
        recommendations,
        alertLevel
      };
    } catch (error) {
      logger.error('Error tracking emotion changes:', error);
      return {
        emotionTrend: 'stable',
        recommendations: ['Continue with current approach'],
        alertLevel: 'low'
      };
    }
  }

  private calculateEmotionTrend(
    history: Array<{ emotion: string; timestamp: Date; intensity: number }>,
    current: string,
    currentIntensity: number
  ): 'improving' | 'declining' | 'stable' {
    if (history.length < 2) return 'stable';
    
    const emotionScores = {
      'angry': -2, 'frustrated': -1.5, 'sad': -1, 'worried': -0.5,
      'neutral': 0, 'confused': -0.3,
      'interested': 0.5, 'happy': 1, 'excited': 1.5, 'satisfied': 2
    };
    
    const currentScore = (emotionScores[current] || 0) * currentIntensity;
    const previousScore = (emotionScores[history[history.length - 1].emotion] || 0) * history[history.length - 1].intensity;
    
    const difference = currentScore - previousScore;
    
    if (difference > 0.3) return 'improving';
    if (difference < -0.3) return 'declining';
    return 'stable';
  }

  private async generateEmotionBasedRecommendations(
    trend: string,
    emotion: string,
    intensity: number
  ): Promise<string[]> {
    const recommendations = [];
    
    if (trend === 'declining' && intensity > 0.7) {
      recommendations.push('Consider switching to empathetic personality');
      recommendations.push('Slow down speech pace');
      recommendations.push('Acknowledge customer concerns directly');
    } else if (trend === 'improving' && emotion === 'interested') {
      recommendations.push('Share more detailed information');
      recommendations.push('Increase enthusiasm in voice');
      recommendations.push('Move towards closing techniques');
    } else if (emotion === 'confused') {
      recommendations.push('Simplify explanations');
      recommendations.push('Use clearer language');
      recommendations.push('Repeat key points');
    }
    
    return recommendations.length > 0 ? recommendations : ['Continue with current approach'];
  }

  private determineAlertLevel(
    emotion: string,
    intensity: number,
    trend: string
  ): 'low' | 'medium' | 'high' {
    const negativeEmotions = ['angry', 'frustrated', 'sad'];
    
    if (negativeEmotions.includes(emotion) && intensity > 0.8) {
      return 'high';
    } else if (negativeEmotions.includes(emotion) && intensity > 0.5) {
      return 'medium';
    } else if (trend === 'declining') {
      return 'medium';
    }
    
    return 'low';
  }
}

export default SpeechAnalysisService;
