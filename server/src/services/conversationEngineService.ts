import VoiceAIService from './voiceAIService';
import { EnhancedVoiceAIService, VoicePersonality } from './enhancedVoiceAIService';
import SpeechAnalysisService, { SpeechAnalysis, ConversationContext } from './speechAnalysisService';
import { LLMService } from './llm/service';
import { LLMConfig, LLMProvider, LLMMessage } from './llm/types';
import { logger, getErrorMessage } from '../index';
import { v4 as uuidv4 } from 'uuid';

export interface ConversationTurn {
  id: string;
  timestamp: Date;
  speaker: 'agent' | 'customer';
  content: string;
  analysis?: SpeechAnalysis;
  voicePersonality?: VoicePersonality;
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
  status: 'active' | 'paused' | 'completed' | 'failed';
  metrics: {
    totalTurns: number;
    personalityChanges: number;
  };
  llmProvider?: LLMProvider;
}

export class ConversationEngineService {
  private voiceAI: EnhancedVoiceAIService;
  private speechAnalysis: SpeechAnalysisService;
  private llmService: LLMService;
  private activeSessions: Map<string, CallSession> = new Map();

  constructor(elevenLabsApiKey: string, openAIApiKey: string, anthropicApiKey?: string, googleSpeechKey?: string) {
    this.voiceAI = new EnhancedVoiceAIService(elevenLabsApiKey);
    this.speechAnalysis = new SpeechAnalysisService(openAIApiKey, googleSpeechKey);
    
    // Configure LLM service
    const llmConfig: LLMConfig = {
      providers: [
        {
          name: 'openai',
          apiKey: openAIApiKey,
          isEnabled: true
        }
      ],
      defaultProvider: 'openai'
    };
    
    if (anthropicApiKey) {
      llmConfig.providers.push({
        name: 'anthropic',
        apiKey: anthropicApiKey,
        isEnabled: true
      });
    }
    
    this.llmService = new LLMService(llmConfig);
  }

  // Create a new conversation session
  async createSession(
    leadId: string,
    campaignId: string,
    language: 'English' | 'Hindi' = 'English',
    personalityId?: string,
    llmProvider?: LLMProvider
  ): Promise<CallSession> {
    try {
      const sessionId = uuidv4();
      
      // Get or create voice personality
      let personality: VoicePersonality;
      if (personalityId) {
        personality = await this.voiceAI.getPersonality(personalityId);
      } else {
        // Create default personality
        personality = {
          id: uuidv4(),
          name: 'Default Agent',
          description: 'Professional and friendly customer service agent',
          voiceId: 'default',
          personality: 'professional',
          style: 'conversational',
          settings: {
            stability: 0.75,
            similarityBoost: 0.75,
            style: 0.0,
            useSpeakerBoost: true
          },
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        };
      }

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
          callObjective: 'general_inquiry',
          progress: {
            stage: 'opening',
            completed_objectives: [],
            next_steps: []
          }
        },
        status: 'active',
        metrics: {
          totalTurns: 0,
          personalityChanges: 0
        },
        llmProvider
      };

      this.activeSessions.set(sessionId, session);
      logger.info(`Created conversation session: ${sessionId}`);
      return session;
    } catch (error) {
      logger.error('Error creating conversation session:', getErrorMessage(error));
      throw error;
    }
  }

  // Process user input and generate response
  async processConversationTurn(
    sessionId: string,
    userInput: string,
    audioData?: string
  ): Promise<{
    response: string;
    audioUrl?: string;
    sessionUpdate: CallSession;
  }> {
    try {
      const session = this.activeSessions.get(sessionId);
      if (!session) {
        throw new Error(`Session not found: ${sessionId}`);
      }

      // Analyze speech if audio data provided
      let speechAnalysis: SpeechAnalysis | undefined;
      if (audioData) {
        speechAnalysis = await this.speechAnalysis.analyzeSpeech(audioData, session.context);
      }

      // Add user turn to conversation
      const userTurn: ConversationTurn = {
        id: uuidv4(),
        timestamp: new Date(),
        speaker: 'customer',
        content: userInput,
        analysis: speechAnalysis,
        voicePersonality: session.currentPersonality
      };

      session.conversationHistory.push(userTurn);
      session.metrics.totalTurns++;

      // Generate response using voice AI
      const response = await this.voiceAI.generateResponse({
        userInput: userInput,
        conversationLog: session.conversationHistory.map(turn => ({
          role: turn.speaker === 'agent' ? 'assistant' : 'user',
          content: turn.content,
          timestamp: turn.timestamp
        })),
        leadId: session.leadId,
        campaignId: session.campaignId,
        callContext: {
          complianceComplete: true,
          disclosureComplete: true,
          currentPhase: session.context.progress.stage,
          language: session.language
        }
      });

      // Generate audio using voice synthesis
      const audioUrl = await this.voiceAI.synthesizeVoice({
        text: response.text,
        personalityId: session.currentPersonality.id,
        language: session.language
      });

      // Add agent turn to conversation
      const agentTurn: ConversationTurn = {
        id: uuidv4(),
        timestamp: new Date(),
        speaker: 'agent',
        content: response.text,
        voicePersonality: session.currentPersonality
      };

      session.conversationHistory.push(agentTurn);
      session.metrics.totalTurns++;

      // Update session
      this.activeSessions.set(sessionId, session);

      return {
        response: response.text,
        audioUrl,
        sessionUpdate: session
      };
    } catch (error) {
      logger.error('Error processing conversation turn:', getErrorMessage(error));
      throw error;
    }
  }

  // Get session information
  getSession(sessionId: string): CallSession | undefined {
    return this.activeSessions.get(sessionId);
  }

  // End conversation session
  async endSession(sessionId: string): Promise<CallSession | null> {
    try {
      const session = this.activeSessions.get(sessionId);
      if (!session) {
        return null;
      }

      session.status = 'completed';
      this.activeSessions.delete(sessionId);
      
      logger.info(`Ended conversation session: ${sessionId}`);
      return session;
    } catch (error) {
      logger.error('Error ending conversation session:', getErrorMessage(error));
      throw error;
    }
  }

  // Get all active sessions
  getActiveSessions(): CallSession[] {
    return Array.from(this.activeSessions.values());
  }

  // Update session personality
  async updateSessionPersonality(sessionId: string, personalityId: string): Promise<CallSession | null> {
    try {
      const session = this.activeSessions.get(sessionId);
      if (!session) {
        return null;
      }

      const newPersonality = await this.voiceAI.getPersonality(personalityId);
      session.currentPersonality = newPersonality;
      session.metrics.personalityChanges++;

      this.activeSessions.set(sessionId, session);
      return session;
    } catch (error) {
      logger.error('Error updating session personality:', getErrorMessage(error));
      throw error;
    }
  }

  // Generate opening message for a conversation
  async generateOpeningMessage(
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
      
      // Generate opening message using LLM
      const messages: LLMMessage[] = [
        {
          role: 'system',
          content: `You are a ${currentPersonality.name.toLowerCase()} AI sales agent speaking in ${language}. Generate a warm, professional opening message for a call.`
        },
        {
          role: 'user',
          content: `Generate an opening message for:
- Lead name: ${leadName}
- Campaign: ${campaignName}
- Language: ${language}
- Personality: ${currentPersonality.name}

Keep it brief, friendly, and professional.`
        }
      ];

      const response = await this.llmService.chat({
        provider: 'openai',
        model: 'gpt-4',
        messages: messages,
        options: {
          temperature: 0.7,
          maxTokens: 150
        }
      });

      const openingMessage = response.content.trim();
      
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
      
      logger.info(`Opening message generated for session ${sessionId}`);
      
      return openingMessage;
    } catch (error) {
      logger.error(`Error generating opening message: ${getErrorMessage(error)}`);
      
      // Fallback opening message
      return `Hello ${leadName}, this is an AI assistant calling about ${campaignName}. How are you today?`;
    }
  }

  // Start a new conversation for a call
  async startConversation(callId: string, leadId: string, campaignId: string): Promise<string> {
    try {
      const session = await this.createSession(leadId, campaignId, 'English');
      
      logger.info(`Started new conversation ${session.id} for call ${callId}`);
      return session.id;
    } catch (error) {
      logger.error(`Error starting conversation for call ${callId}:`, error);
      throw error;
    }
  }
  
  // Process user input and generate AI response
  async processUserInput(conversationId: string, userInput: string): Promise<{
    text: string;
    intent: string;
  }> {
    try {
      const result = await this.processConversationTurn(conversationId, userInput);
      
      return {
        text: result.response,
        intent: "continue"
      };
    } catch (error) {
      logger.error(`Error processing user input for conversation ${conversationId}:`, error);
      return {
        text: "I'm sorry, I didn't catch that. Could you please repeat?",
        intent: "clarification"
      };
    }
  }

  // Get conversation metrics
  getConversationMetrics(sessionId: string): any {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      return null;
    }

    return {
      sessionId,
      duration: Date.now() - session.startTime.getTime(),
      totalTurns: session.metrics.totalTurns,
      personalityChanges: session.metrics.personalityChanges,
      conversationStage: session.context.progress.stage,
      status: session.status
    };
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      // Check if all required services are available
      const voiceAIHealth = await this.voiceAI.healthCheck();
      // The LLM service doesn't have a healthCheck method, so we'll test basic functionality
      const llmHealth = await this.testLLMConnection();
      
      return voiceAIHealth && llmHealth;
    } catch (error) {
      logger.error('Conversation engine health check failed:', getErrorMessage(error));
      return false;
    }
  }

  // Test LLM connection
  private async testLLMConnection(): Promise<boolean> {
    try {
      const testMessages: LLMMessage[] = [
        {
          role: 'user',
          content: 'Hello, this is a connection test.'
        }
      ];

      const response = await this.llmService.chat({
        provider: 'openai',
        model: 'gpt-4',
        messages: testMessages,
        options: {
          temperature: 0.1,
          maxTokens: 10
        }
      });

      return !!response.content;
    } catch (error) {
      logger.error('LLM connection test failed:', getErrorMessage(error));
      return false;
    }
  }
}

// Export default for compatibility
export default ConversationEngineService;
