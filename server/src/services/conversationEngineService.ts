import VoiceAIService, { VoicePersonality, EmotionAnalysis, AdaptiveResponse } from './voiceAIService';
import EnhancedVoiceAIService from './enhancedVoiceAIService';
import SpeechAnalysisService, { SpeechAnalysis, ConversationContext } from './speechAnalysisService';
import LLMService, { LLMProvider, Message } from './llmService';
import { logger, getErrorMessage } from '../index';
import { v4 as uuidv4 } from 'uuid';

export interface ConversationTurn {
  id: string;
  timestamp: Date;
  speaker: 'agent' | 'customer';
  content: string;
  analysis?: SpeechAnalysis;
  emotions?: EmotionAnalysis;
  voicePersonality?: VoicePersonality;
  adaptiveResponse?: AdaptiveResponse;
}

export interface CallSession {
  id: string;
  leadId: string;
  campaignId: string;
  startTime: Date;
  language: 'English' | 'Hindi';
  currentPersonality: VoicePersonality;
  conversationHistory: ConversationTurn[];
  context: ConversationContext;
  emotionHistory: Array<{
    emotion: string;
    timestamp: Date;
    intensity: number;
  }>;
  status: 'active' | 'paused' | 'completed' | 'failed';
  metrics: {
    totalTurns: number;
    avgEmotionScore: number;
    personalityChanges: number;
    adaptiveResponses: number;
  };
  llmProvider?: LLMProvider;
}

export class ConversationEngineService {
  private voiceAI: EnhancedVoiceAIService;
  private speechAnalysis: SpeechAnalysisService;
  private llmService: LLMService;
  private activeSessions: Map<string, CallSession> = new Map();

  constructor(elevenLabsApiKey: string, openAIApiKey: string, anthropicApiKey?: string, googleSpeechKey?: string) {
    this.voiceAI = new EnhancedVoiceAIService(elevenLabsApiKey, openAIApiKey);
    this.speechAnalysis = new SpeechAnalysisService(openAIApiKey, googleSpeechKey);
    this.llmService = new LLMService(openAIApiKey, anthropicApiKey);
  }
  
  /**
   * Update API keys for all integrated services
   */
  public updateApiKeys(
    elevenLabsApiKey?: string, 
    openAIApiKey?: string, 
    anthropicApiKey?: string, 
    googleSpeechKey?: string
  ): void {
    try {
      if (elevenLabsApiKey || openAIApiKey) {
        this.voiceAI = new EnhancedVoiceAIService(
          elevenLabsApiKey || this.voiceAI.getElevenLabsApiKey(),
          openAIApiKey || this.voiceAI.getOpenAIApiKey()
        );
      }
      
      if (openAIApiKey || googleSpeechKey) {
        this.speechAnalysis.updateApiKeys(openAIApiKey, googleSpeechKey);
      }
      
      if (openAIApiKey || anthropicApiKey) {
        this.llmService.updateApiKeys(openAIApiKey, anthropicApiKey);
      }
      
      logger.info('ConversationEngineService API keys updated successfully');
    } catch (error) {
      logger.error(`Error updating ConversationEngineService API keys: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Initialize a new conversation session
   */
  public async initializeConversation(
    sessionId: string,
    leadId: string,
    campaignId: string,
    personality: VoicePersonality,
    language: 'English' | 'Hindi'
  ): Promise<CallSession> {
    try {
      const session: CallSession = {
        id: sessionId,
        leadId,
        campaignId,
        startTime: new Date(),
        language,
        currentPersonality: personality,
        conversationHistory: [],
        context: {
          currentTurn: 0,
          customerProfile: {
            mood: 'neutral',
            interests: [],
            objections: [],
            engagement_level: 0.5
          },
          callObjective: 'sales',
          progress: {
            stage: 'opening',
            completed_objectives: [],
            next_steps: ['introduce_self']
          }
        },
        emotionHistory: [],
        status: 'active',
        metrics: {
          totalTurns: 0,
          avgEmotionScore: 0.5,
          personalityChanges: 0,
          adaptiveResponses: 0
        }
      };

      this.activeSessions.set(sessionId, session);
      logger.info(`Conversation session initialized: ${sessionId}`);
      
      return session;
    } catch (error) {
      logger.error(`Error initializing conversation session: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  /**
   * Generate an opening message for a conversation
   */
  public async generateOpeningMessage(
    sessionId: string,
    leadName: string,
    campaignName: string
  ): Promise<string> {
    try {
      const session = this.activeSessions.get(sessionId);
      if (!session) {
        throw new Error(`Session not found: ${sessionId}`);
      }

      const { currentPersonality, language } = session;
      
      // Generate culturally appropriate opening message
      const messages: Message[] = [
        {
          role: 'system',
          content: `You are a ${currentPersonality.name.toLowerCase()} AI sales agent speaking in ${language}. Generate a warm, professional opening message for a cold call.`
        },
        {
          role: 'user',
          content: `Generate an opening message for:
- Lead name: ${leadName}
- Campaign: ${campaignName}
- Language: ${language}
- Personality: ${currentPersonality.name}

Keep it brief, friendly, and culturally appropriate. Include a polite greeting and briefly mention why you're calling.`
        }
      ];

      const response = await this.llmService.generateResponse(messages, 'auto', {
        temperature: 0.7,
        maxTokens: 150
      });

      const openingMessage = response.text.trim();
      
      // Add to conversation history
      const turn: ConversationTurn = {
        id: uuidv4(),
        timestamp: new Date(),
        speaker: 'agent',
        content: openingMessage,
        voicePersonality: currentPersonality
      };

      session.conversationHistory.push(turn);
      session.metrics.totalTurns++;
      
      logger.info(`Opening message generated for session ${sessionId}: ${openingMessage.substring(0, 50)}...`);
      
      return openingMessage;
    } catch (error) {
      logger.error(`Error generating opening message: ${getErrorMessage(error)}`);
      
      // Fallback opening message
      const fallback = `Hello ${leadName}, this is an AI assistant calling about ${campaignName}. How are you today?`;
      return fallback;
    }
  }

  /**
   * Get active session by ID
   */
  public getSession(sessionId: string): CallSession | undefined {
    return this.activeSessions.get(sessionId);
  }

  /**
   * End a conversation session
   */
  public async endSession(sessionId: string, outcome?: string): Promise<void> {
    try {
      const session = this.activeSessions.get(sessionId);
      if (session) {
        session.status = 'completed';
        logger.info(`Conversation session ended: ${sessionId} with outcome: ${outcome || 'unknown'}`);
      }
      this.activeSessions.delete(sessionId);
    } catch (error) {
      logger.error(`Error ending session: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Adapt conversation flow based on customer emotion and context
   */
  public async adaptConversationFlow(params: {
    conversationId: string;
    customerEmotion: any;
    conversationHistory: any[];
    currentScript: string;
    language: string;
  }): Promise<{
    script: string;
    voiceAdjustments: any;
    personalityShift: any;
    recommendations: any[];
  }> {
    try {
      const { conversationId, customerEmotion, conversationHistory, currentScript, language } = params;
      
      // Get session if it exists
      const session = this.activeSessions.get(conversationId);
      const personality = session?.currentPersonality || { id: 'professional', name: 'Professional' };
      
      // Convert language code to full name
      const lang = language === 'hi' ? 'Hindi' : 'English';
      
      // Use voice AI service to manage conversation flow
      const flowResult = await this.voiceAI.manageAdvancedConversationFlow(
        conversationHistory,
        customerEmotion,
        personality as any,
        lang as any
      );
      
      // Get adaptation recommendations
      const adaptationRecs = await this.voiceAI.getAdaptationRecommendations(customerEmotion);
      
      // Adapt voice settings based on emotion
      const voiceAdjustments = {
        speed: customerEmotion.primary === 'frustrated' ? 0.9 : 1.0,
        pitch: customerEmotion.primary === 'excited' ? 1.1 : 1.0,
        stability: customerEmotion.primary === 'confused' ? 0.9 : 0.8
      };
      
      // Determine if personality shift is needed
      const personalityShift = {
        needed: adaptationRecs.recommendations.some((rec: any) => rec.type === 'personality_switch'),
        from: personality.id,
        to: customerEmotion.primary === 'frustrated' ? 'empathetic' : personality.id
      };
      
      return {
        script: flowResult.suggestedResponse,
        voiceAdjustments,
        personalityShift,
        recommendations: adaptationRecs.recommendations
      };
    } catch (error) {
      logger.error(`Error adapting conversation flow: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  /**
   * Generate response using conversation engine capabilities
   */
  public async generateResponse(params: {
    sessionId: string;
    userInput: string;
    context?: any;
  }): Promise<string> {
    try {
      const { sessionId, userInput, context } = params;
      const session = this.activeSessions.get(sessionId);
      
      if (!session) {
        throw new Error(`Session not found: ${sessionId}`);
      }
      
      // Analyze customer emotion
      const emotion = await this.voiceAI.detectEmotionWithCulturalContext(
        userInput,
        session.language as any
      );
      
      // Generate response using advanced conversation flow
      const flowResult = await this.voiceAI.manageAdvancedConversationFlow(
        session.conversationHistory,
        emotion,
        session.currentPersonality as any,
        session.language as any
      );
      
      return flowResult.suggestedResponse;
    } catch (error) {
      logger.error(`Error generating response: ${getErrorMessage(error)}`);
      throw error;
    }
  }
}
