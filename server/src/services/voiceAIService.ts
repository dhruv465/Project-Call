import axios from 'axios';
import mongoose from 'mongoose';
import { logger } from '../index';

export interface VoicePersonality {
  id: string;
  name: string;
  description: string;
  voiceId: string;
  personality: string;
  style: string;
  emotionalRange: string[];
  languageSupport: string[];
  culturalAdaptations: {
    [language: string]: {
      greetings: string[];
      closings: string[];
      persuasionStyle: string;
      communicationPattern: string;
    };
  };
  settings: {
    stability: number;
    similarityBoost: number;
    style: number;
    useSpeakerBoost: boolean;
  };
  trainingMetrics: {
    emotionAccuracy: number;
    adaptationAccuracy: number;
    customerSatisfactionScore: number;
    conversionRate: number;
  };
}

export interface EmotionAnalysis {
  primary: string;
  confidence: number;
  secondary?: string;
  intensity: number;
  context: string;
  culturalContext?: string;
  adaptationNeeded: boolean;
}

export interface AdaptiveResponse {
  tone: string;
  approach: string;
  script: string;
  culturallyAdapted: boolean;
  personalityAlignment: number;
  voiceSettings: {
    speed: number;
    pitch: number;
    stability: number;
  };
}

export interface ConversationMetrics {
  emotionalEngagement: number;
  personalityConsistency: number;
  culturalApproppriateness: number;
  adaptationSuccess: number;
  overallEffectiveness: number;
}

export class VoiceAIService {
  private elevenLabsApiKey: string;
  private openAIApiKey: string;

  constructor(elevenLabsApiKey: string, openAIApiKey: string) {
    this.elevenLabsApiKey = elevenLabsApiKey;
    this.openAIApiKey = openAIApiKey;
  }

  // Voice Personalities - Dynamically generated from configuration
  static async getVoicePersonalities(): Promise<VoicePersonality[]> {
    try {
      // Get system configuration to use configured voices instead of hardcoded ones
      const configuration = await mongoose.model('Configuration').findOne();
      if (!configuration || !configuration.elevenLabsConfig) {
        throw new Error('ElevenLabs configuration not found');
      }

      const availableVoices = configuration.elevenLabsConfig.availableVoices || [];
      if (availableVoices.length === 0) {
        throw new Error('No voices configured in ElevenLabs. Please configure voices in the system settings.');
      }

      // Convert available voices to VoicePersonality format
      return availableVoices.map((voice, index) => {
        // Infer personality type from voice name
        const personalityType = this.inferPersonalityFromVoiceName(voice.name);
        
        return {
          id: personalityType,
          name: voice.name,
          description: `AI voice with ${personalityType} characteristics`,
          voiceId: voice.voiceId, // Use voice ID from configuration
          personality: personalityType,
          style: this.getStyleForPersonality(personalityType),
          emotionalRange: this.getEmotionalRangeForPersonality(personalityType),
          languageSupport: ['English', 'Hindi'], // Default supported languages
          culturalAdaptations: this.getCulturalAdaptations(personalityType),
          settings: {
            stability: 0.8,
            similarityBoost: 0.8,
            style: 0.3,
            useSpeakerBoost: true
          },
          trainingMetrics: {
            emotionAccuracy: 0.9,
            adaptationAccuracy: 0.9,
            customerSatisfactionScore: 0.85,
            conversionRate: 0.75
          }
        };
      });
    } catch (error) {
      logger.error('Error fetching voice personalities from configuration:', error);
      throw new Error('Failed to fetch voice personalities from configuration');
    }
  }

  private static inferPersonalityFromVoiceName(voiceName: string): string {
    const name = voiceName.toLowerCase();
    if (name.includes('professional') || name.includes('business') || name.includes('formal') || name.includes('rachel')) {
      return 'professional';
    } else if (name.includes('friendly') || name.includes('warm') || name.includes('casual') || name.includes('jessica')) {
      return 'friendly';
    } else if (name.includes('empathetic') || name.includes('caring') || name.includes('supportive') || name.includes('alex')) {
      return 'empathetic';
    }
    // Default to professional for unknown names
    return 'professional';
  }

  private static getStyleForPersonality(personality: string): string {
    switch (personality) {
      case 'professional': return 'business-formal';
      case 'friendly': return 'casual-warm';
      case 'empathetic': return 'caring-supportive';
      default: return 'balanced-neutral';
    }
  }

  private static getEmotionalRangeForPersonality(personality: string): string[] {
    switch (personality) {
      case 'professional': return ['confident', 'authoritative', 'respectful', 'clear'];
      case 'friendly': return ['warm', 'enthusiastic', 'approachable', 'energetic'];
      case 'empathetic': return ['understanding', 'supportive', 'patient', 'compassionate'];
      default: return ['neutral', 'balanced', 'adaptable', 'clear'];
    }
  }

  private static getCulturalAdaptations(personality: string): any {
    const baseAdaptations = {
      English: {
        greetings: ['Hello', 'Good morning', 'Good afternoon'],
        closings: ['Thank you', 'Have a great day', 'Take care'],
        persuasionStyle: 'Direct and clear',
        communicationPattern: 'Clear and respectful'
      },
      Hindi: {
        greetings: ['नमस्कार', 'नमस्ते', 'आदाब'],
        closings: ['धन्यवाद', 'आपका दिन शुभ हो', 'अपना ख्याल रखें'],
        persuasionStyle: 'Respectful and relationship-focused',
        communicationPattern: 'Contextual and family-oriented'
      }
    };

    // Customize based on personality
    switch (personality) {
      case 'professional':
        baseAdaptations.English.persuasionStyle = 'Direct and data-driven';
        baseAdaptations.English.communicationPattern = 'Linear, fact-based, time-efficient';
        break;
      case 'friendly':
        baseAdaptations.English.greetings = ['Hi there!', 'Hello!', 'Hey!'];
        baseAdaptations.English.closings = ['Take care!', 'Have an awesome day!', 'Catch you later!'];
        baseAdaptations.English.persuasionStyle = 'Enthusiastic and benefit-focused';
        break;
      case 'empathetic':
        baseAdaptations.English.greetings = ['How are you doing?', 'I hope you\'re well', 'How can I help you today?'];
        baseAdaptations.English.closings = ['I\'m here if you need anything', 'Take your time', 'You\'re in good hands'];
        baseAdaptations.English.persuasionStyle = 'Understanding and solution-focused';
        break;
    }

    return baseAdaptations;
  }

  // Emotion Detection from Speech
  async detectEmotion(audioText: string, audioFeatures?: any): Promise<EmotionAnalysis> {
    try {
      // Use OpenAI to analyze emotional content from text
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: `You are an expert emotion detection AI. Analyze the given text for emotional content and return a JSON response with:
              - primary: main emotion (happy, sad, angry, frustrated, confused, interested, neutral, excited, worried, skeptical)
              - confidence: confidence level (0-1)
              - secondary: secondary emotion if present
              - intensity: emotional intensity (0-1)
              - context: brief context explanation
              
              Focus on detecting customer emotions that would affect sales conversation approach.`
            },
            {
              role: 'user',
              content: `Analyze this customer speech for emotions: "${audioText}"`
            }
          ],
          temperature: 0.3,
          max_tokens: 200
        },
        {
          headers: {
            'Authorization': `Bearer ${this.openAIApiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const result = JSON.parse(response.data.choices[0].message.content);
      
      // Ensure adaptationNeeded property is included
      if (!result.hasOwnProperty('adaptationNeeded')) {
        result.adaptationNeeded = result.intensity > 0.6 || ['frustrated', 'angry', 'worried', 'confused'].includes(result.primary);
      }
      
      logger.info('Emotion detected:', result);
      return result;
    } catch (error) {
      logger.error('Error detecting emotion:', error);
      return {
        primary: 'neutral',
        confidence: 0.5,
        intensity: 0.5,
        context: 'Unable to analyze emotion',
        adaptationNeeded: false
      };
    }
  }

  // Generate Adaptive Response based on detected emotion
  async generateAdaptiveResponse(
    emotion: EmotionAnalysis,
    conversationContext: string,
    personality: VoicePersonality,
    language: 'English' | 'Hindi' = 'English'
  ): Promise<AdaptiveResponse> {
    try {
      const emotionToApproach = this.getApproachForEmotion(emotion.primary);
      
      const prompt = `You are a ${personality.name.toLowerCase()} AI sales agent speaking in ${language}. 
      
      Customer emotion detected: ${emotion.primary} (confidence: ${emotion.confidence}, intensity: ${emotion.intensity})
      Context: ${emotion.context}
      
      Conversation context: ${conversationContext}
      
      Generate an adaptive response that:
      1. Acknowledges the customer's emotional state appropriately
      2. Adjusts tone and approach based on the emotion
      3. Maintains the ${personality.description} personality
      4. Uses ${language} language naturally
      
      Return JSON with:
      - tone: how to speak (calm, energetic, understanding, etc.)
      - approach: strategy to use (empathetic, confident, patient, etc.)
      - script: what to say (2-3 sentences max)
      - voiceSettings: { speed: 0.8-1.2, pitch: 0.8-1.2, stability: 0.7-0.9 }`;

      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4',
          messages: [
            { role: 'system', content: prompt },
            { role: 'user', content: 'Generate adaptive response' }
          ],
          temperature: 0.7,
          max_tokens: 300
        },
        {
          headers: {
            'Authorization': `Bearer ${this.openAIApiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const result = JSON.parse(response.data.choices[0].message.content);
      
      logger.info('Adaptive response generated:', result);
      return result;
    } catch (error) {
      logger.error('Error generating adaptive response:', error);
      return this.getFallbackResponse(emotion.primary, personality, language);
    }
  }

  // Synthesize speech with personality and emotion adaptation
  async synthesizeSpeech(
    text: string,
    personality: VoicePersonality,
    adaptiveSettings?: AdaptiveResponse['voiceSettings'],
    language: 'English' | 'Hindi' = 'English'
  ): Promise<Buffer> {
    try {
      // Merge personality settings with adaptive settings
      const voiceSettings = {
        stability: adaptiveSettings?.stability || personality.settings.stability,
        similarity_boost: personality.settings.similarityBoost,
        style: personality.settings.style,
        use_speaker_boost: personality.settings.useSpeakerBoost
      };

      // Adjust text for language and personality
      const adjustedText = this.adjustTextForPersonalityAndLanguage(text, personality, language);

      const response = await axios.post(
        `https://api.elevenlabs.io/v1/text-to-speech/${personality.voiceId}`,
        {
          text: adjustedText,
          model_id: 'eleven_multilingual_v2', // Supports both English and Hindi
          voice_settings: voiceSettings
        },
        {
          headers: {
            'Accept': 'audio/mpeg',
            'Content-Type': 'application/json',
            'xi-api-key': this.elevenLabsApiKey
          },
          responseType: 'arraybuffer'
        }
      );

      return Buffer.from(response.data);
    } catch (error) {
      logger.error('Error synthesizing speech:', error);
      throw new Error('Failed to synthesize speech');
    }
  }

  // Natural Conversation Flow Management
  async manageConversationFlow(
    conversationHistory: any[],
    currentEmotion: EmotionAnalysis,
    personality: VoicePersonality,
    language: 'English' | 'Hindi' = 'English'
  ): Promise<{
    nextAction: string;
    suggestedResponse: string;
    contextAwareness: string;
    emotionalStrategy: string;
  }> {
    try {
      const prompt = `You are managing a natural conversation flow for a ${personality.name.toLowerCase()} AI sales agent.

      Conversation History: ${JSON.stringify(conversationHistory.slice(-5))}
      Current Customer Emotion: ${currentEmotion.primary} (${currentEmotion.intensity} intensity)
      Language: ${language}
      
      Analyze the conversation and provide:
      1. nextAction: what the AI should do next (ask_question, provide_info, handle_objection, schedule_callback, close_call)
      2. suggestedResponse: contextually appropriate response
      3. contextAwareness: what the AI understands about the customer's situation
      4. emotionalStrategy: how to leverage emotional intelligence
      
      Return as JSON.`;

      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4',
          messages: [
            { role: 'system', content: prompt },
            { role: 'user', content: 'Analyze conversation flow' }
          ],
          temperature: 0.7,
          max_tokens: 400
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
      logger.error('Error managing conversation flow:', error);
      return {
        nextAction: 'ask_question',
        suggestedResponse: 'How can I help you today?',
        contextAwareness: 'Limited context available',
        emotionalStrategy: 'Maintain neutral, helpful tone'
      };
    }
  }

  // Private helper methods
  private getApproachForEmotion(emotion: string): string {
    const approaches = {
      'happy': 'enthusiastic',
      'excited': 'matching-energy',
      'interested': 'informative',
      'neutral': 'professional',
      'confused': 'clarifying',
      'frustrated': 'empathetic',
      'angry': 'calming',
      'sad': 'supportive',
      'worried': 'reassuring',
      'skeptical': 'evidence-based'
    };
    
    return approaches[emotion] || 'professional';
  }

  private getFallbackResponse(emotion: string, personality: VoicePersonality, language: string): AdaptiveResponse {
    const fallbacks = {
      'English': {
        'frustrated': {
          tone: 'calm',
          approach: 'empathetic',
          script: 'I understand this might be frustrating. Let me help clarify things for you.',
          voiceSettings: { speed: 0.9, pitch: 0.9, stability: 0.85 }
        },
        'interested': {
          tone: 'enthusiastic',
          approach: 'informative',
          script: 'I can see you\'re interested! Let me share some details that might be helpful.',
          voiceSettings: { speed: 1.1, pitch: 1.0, stability: 0.8 }
        },
        'default': {
          tone: 'professional',
          approach: 'helpful',
          script: 'Thank you for your time. How can I assist you today?',
          voiceSettings: { speed: 1.0, pitch: 1.0, stability: 0.8 }
        }
      },
      'Hindi': {
        'frustrated': {
          tone: 'calm',
          approach: 'empathetic',
          script: 'मैं समझ सकता हूं कि यह परेशान करने वाला हो सकता है। मुझे आपकी सहायता करने दें।',
          voiceSettings: { speed: 0.9, pitch: 0.9, stability: 0.85 }
        },
        'interested': {
          tone: 'enthusiastic',
          approach: 'informative',
          script: 'मैं देख सकता हूं कि आप रुचि रखते हैं! मुझे कुछ विवरण साझा करने दें।',
          voiceSettings: { speed: 1.1, pitch: 1.0, stability: 0.8 }
        },
        'default': {
          tone: 'professional',
          approach: 'helpful',
          script: 'आपके समय के लिए धन्यवाद। मैं आज आपकी कैसे सहायता कर सकता हूं?',
          voiceSettings: { speed: 1.0, pitch: 1.0, stability: 0.8 }
        }
      }
    };

    return fallbacks[language][emotion] || fallbacks[language]['default'];
  }

  private adjustTextForPersonalityAndLanguage(text: string, personality: VoicePersonality, language: string): string {
    // Add personality-specific speech patterns and language adjustments
    let adjustedText = text;

    if (personality.id === 'friendly') {
      adjustedText = adjustedText.replace(/\./g, '!').replace(/Hello/g, language === 'Hindi' ? 'नमस्ते' : 'Hi there');
    } else if (personality.id === 'professional') {
      adjustedText = adjustedText.replace(/!/g, '.').replace(/Hi/g, language === 'Hindi' ? 'नमस्कार' : 'Good day');
    } else if (personality.id === 'empathetic') {
      adjustedText = `${adjustedText}. I'm here to help.`;
      if (language === 'Hindi') {
        adjustedText = adjustedText.replace('I\'m here to help.', 'मैं यहां आपकी सहायता के लिए हूं।');
      }
    }

    return adjustedText;
  }
}

export default VoiceAIService;
