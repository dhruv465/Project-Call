// Voice AI Service - API-only, no local training or emotion detection
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
  settings: {
    stability: number;
    similarityBoost: number;
    style: number;
    useSpeakerBoost: boolean;
  };
}

export class VoiceAIService {
  private elevenLabsApiKey: string;
  private openAIApiKey: string;

  constructor(elevenLabsApiKey: string, openAIApiKey: string) {
    this.elevenLabsApiKey = elevenLabsApiKey;
    this.openAIApiKey = openAIApiKey;
  }

  /**
   * Get voice personalities from configuration
   */
  static async getVoicePersonalities(): Promise<VoicePersonality[]> {
    try {
      const configuration = await mongoose.model('Configuration').findOne();
      if (!configuration || !configuration.elevenLabsConfig) {
        throw new Error('ElevenLabs configuration not found');
      }

      const availableVoices = configuration.elevenLabsConfig.availableVoices || [];
      if (availableVoices.length === 0) {
        throw new Error('No voices configured in ElevenLabs. Please configure voices in the system settings.');
      }

      return availableVoices.map((voice) => {
        const personalityType = this.inferPersonalityFromVoiceName(voice.name);
        
        return {
          id: personalityType,
          name: voice.name,
          description: `AI voice with ${personalityType} characteristics`,
          voiceId: voice.voiceId,
          personality: personalityType,
          style: this.getStyleForPersonality(personalityType),
          settings: {
            stability: 0.8,
            similarityBoost: 0.8,
            style: 0.3,
            useSpeakerBoost: true
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
    if (name.includes('professional') || name.includes('business')) return 'professional';
    if (name.includes('friendly') || name.includes('warm')) return 'friendly';
    if (name.includes('calm') || name.includes('soothing')) return 'calm';
    return 'professional';
  }

  private static getStyleForPersonality(personality: string): string {
    switch (personality) {
      case 'professional': return 'Clear and authoritative';
      case 'friendly': return 'Warm and approachable';
      case 'calm': return 'Soothing and reassuring';
      default: return 'Professional and clear';
    }
  }

  /**
   * Synthesize speech with basic voice settings
   */
  async synthesizeSpeech(
    text: string,
    personality: VoicePersonality,
    language: 'English' | 'Hindi' = 'English'
  ): Promise<Buffer> {
    try {
      const voiceSettings = {
        stability: personality.settings.stability,
        similarity_boost: personality.settings.similarityBoost,
        style: personality.settings.style,
        use_speaker_boost: personality.settings.useSpeakerBoost
      };

      const response = await axios.post(
        `https://api.elevenlabs.io/v1/text-to-speech/${personality.voiceId}`,
        {
          text,
          model_id: 'eleven_multilingual_v2',
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
      throw new Error(`Failed to synthesize speech: ${error.message}`);
    }
  }

  /**
   * Generate conversational response using LLM
   */
  async generateResponse(params: {
    userInput: string;
    conversationHistory: any[];
    language: 'English' | 'Hindi';
  }): Promise<{ text: string; intent: string }> {
    try {
      const { userInput, conversationHistory, language } = params;
      
      const conversationContext = conversationHistory
        .map(msg => `${msg.role}: ${msg.content}`)
        .join('\n');
      
      const prompt = `You are a helpful AI assistant speaking in ${language}.
      
      Conversation history:
      ${conversationContext}
      
      User: ${userInput}
      
      Generate a helpful and appropriate response. Keep it conversational and natural.
      
      Return JSON with:
      - text: response text
      - intent: detected intent (greeting, question, information_request, concern, etc.)`;

      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4',
          messages: [
            { role: 'system', content: prompt },
            { role: 'user', content: 'Generate response based on the conversation' }
          ],
          temperature: 0.7,
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
      
      return {
        text: result.text || "I understand. How can I help you with that?",
        intent: result.intent || "general"
      };
    } catch (error) {
      logger.error('Error generating response:', error);
      return {
        text: "I apologize, but I'm having trouble processing your request right now. Could you please try again?",
        intent: "error"
      };
    }
  }

  /**
   * Manage conversation flow with basic next action suggestion
   */
  async manageConversationFlow(
    conversationHistory: any[],
    language: 'English' | 'Hindi' = 'English'
  ): Promise<{
    nextAction: string;
    suggestedResponse: string;
    contextAwareness: string;
  }> {
    try {
      const recentHistory = conversationHistory.slice(-5);
      const historyText = recentHistory
        .map(msg => `${msg.role}: ${msg.content}`)
        .join('\n');

      const prompt = `Analyze this conversation and suggest the next action:

      Recent conversation:
      ${historyText}
      
      Language: ${language}
      
      Provide:
      1. nextAction: what to do next (ask_question, provide_info, clarify, wrap_up, etc.)
      2. suggestedResponse: appropriate response text
      3. contextAwareness: what we understand about the conversation
      
      Return as JSON.`;

      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-4',
          messages: [
            { role: 'system', content: prompt },
            { role: 'user', content: 'Analyze the conversation flow' }
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
      
      return {
        nextAction: result.nextAction || 'ask_question',
        suggestedResponse: result.suggestedResponse || 'How can I help you today?',
        contextAwareness: result.contextAwareness || 'Basic conversation analysis'
      };
    } catch (error) {
      logger.error('Error managing conversation flow:', error);
      return {
        nextAction: 'ask_question',
        suggestedResponse: 'How can I help you today?',
        contextAwareness: 'Unable to analyze conversation context'
      };
    }
  }
}

// Export class only - instances are created with proper parameters elsewhere
export default VoiceAIService;
