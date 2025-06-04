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

  /**
   * Start a new conversation for a call
   */
  public async startConversation(callId: string, leadId: string, campaignId: string): Promise<string> {
    try {
      const sessionId = uuidv4();
      
      // Get default personality
      const defaultPersonality: VoicePersonality = {
        id: 'default',
        name: 'Professional',
        description: 'A professional and friendly sales agent',
        voiceId: 'default',
        personality: 'professional',
        style: 'conversational',
        emotionalRange: ['neutral', 'happy', 'sympathetic'],
        languageSupport: ['English'],
        culturalAdaptations: {
          'English': {
            greetings: ['Hello', 'Hi there'],
            closings: ['Thank you', 'Have a great day'],
            persuasionStyle: 'logical',
            communicationPattern: 'direct'
          }
        },
        settings: {
          stability: 0.7,
          similarityBoost: 0.7,
          style: 0.5,
          useSpeakerBoost: true
        },
        trainingMetrics: {
          emotionAccuracy: 0.85,
          adaptationAccuracy: 0.8,
          customerSatisfactionScore: 0.9,
          conversionRate: 0.75
        }
      };
      
      // Initialize the conversation with default settings
      await this.initializeConversation(
        sessionId,
        leadId,
        campaignId,
        defaultPersonality,
        'English'
      );
      
      logger.info(`Started new conversation ${sessionId} for call ${callId}`);
      return sessionId;
    } catch (error) {
      logger.error(`Error starting conversation for call ${callId}:`, error);
      throw error;
    }
  }
  
  /**
   * Process user input and generate AI response
   */
  public async processUserInput(conversationId: string, userInput: string): Promise<{
    text: string;
    emotion: string;
    intent: string;
  }> {
    try {
      // Find the conversation
      const session = this.activeSessions.get(conversationId);
      if (!session) {
        throw new Error(`Conversation ${conversationId} not found`);
      }
      
      // Add the user input to conversation history
      const userTurn: ConversationTurn = {
        id: uuidv4(),
        timestamp: new Date(),
        speaker: 'customer',
        content: userInput
      };
      
      session.conversationHistory.push(userTurn);
      
      // Generate response based on the user input
      const responseText = await this.generateResponse({
        sessionId: conversationId,
        userInput
      });
      
      // Create the agent turn
      const agentTurn: ConversationTurn = {
        id: uuidv4(),
        timestamp: new Date(),
        speaker: 'agent',
        content: responseText,
        emotions: {
          primary: 'neutral',
          confidence: 0.9,
          intensity: 0.8,
          context: userInput,
          adaptationNeeded: false
        }
      };
      
      // Add agent response to history
      session.conversationHistory.push(agentTurn);
      
      // Update metrics
      session.metrics.totalTurns += 2; // User + agent turn
      
      return {
        text: responseText,
        emotion: "neutral",
        intent: "continue"
      };
    } catch (error) {
      logger.error(`Error processing user input for conversation ${conversationId}:`, error);
      return {
        text: "I'm sorry, I didn't catch that. Could you please repeat?",
        emotion: "neutral",
        intent: "clarification"
      };
    }
  }
  
  /**
   * Process stream input and generate real-time responses
   */
  public async processStreamInput(
    conversationId: string, 
    callId: string,
    req: any,
    res: any
  ): Promise<void> {
    try {
      // Find the conversation
      const session = this.activeSessions.get(conversationId);
      if (!session) {
        throw new Error(`Conversation ${conversationId} not found`);
      }
      
      logger.info(`Processing stream for conversation ${conversationId}, call ${callId}`);
      
      // Set up WebSocket connection for real-time audio streaming
      const websocket = req.body;
      
      // Generate initial greeting if this is the first interaction
      if (session.conversationHistory.length === 0) {
        // Generate an opening message
        const openingMessage = await this.generateOpeningMessage(
          conversationId,
          "Customer", // Default name if we don't have it
          session.campaignId
        );
        
        // Use ElevenLabs to synthesize speech
        const voiceId = session.currentPersonality.voiceId;
        const speechResponse = await this.voiceAI.synthesizeAdaptiveVoice({
          text: openingMessage,
          personalityId: voiceId,
          language: session.language,
          adaptToEmotion: true,
          emotion: { primary: 'professional', confidence: 1.0 }
        });
        
        // Add to conversation history
        const agentTurn: ConversationTurn = {
          id: uuidv4(),
          timestamp: new Date(),
          speaker: 'agent',
          content: openingMessage,
          voicePersonality: session.currentPersonality
        };
        
        session.conversationHistory.push(agentTurn);
        session.metrics.totalTurns++;
        
        logger.info(`Generated opening for stream: ${openingMessage.substring(0, 50)}...`);
      }
      
      // Set up audio stream processing from the call
      if (websocket && websocket.on) {
        // Handle incoming audio data
        websocket.on('message', async (data: any) => {
          try {
            // Process audio data with speech recognition
            const speechResult = await this.speechAnalysis.transcribeAudio(data);
            
            if (speechResult && speechResult.transcript) {
              // Add user input to conversation
              const userTurn: ConversationTurn = {
                id: uuidv4(),
                timestamp: new Date(),
                speaker: 'customer',
                content: speechResult.transcript
              };
              
              session.conversationHistory.push(userTurn);
              
              // Generate AI response
              const responseText = await this.generateResponse({
                sessionId: conversationId,
                userInput: speechResult.transcript
              });
              
              // Use ElevenLabs to synthesize speech
              const voiceId = session.currentPersonality.voiceId;
              const speechResponse = await this.voiceAI.synthesizeAdaptiveVoice({
                text: responseText,
                personalityId: voiceId,
                language: session.language,
                adaptToEmotion: true,
                emotion: { primary: 'professional', confidence: 1.0 }
              });
              
              // Send synthesized audio back through the stream
              if (websocket.send && speechResponse.audioContent) {
                websocket.send(speechResponse.audioContent);
              }
              
              // Add to conversation history
              const agentTurn: ConversationTurn = {
                id: uuidv4(),
                timestamp: new Date(),
                speaker: 'agent',
                content: responseText,
                voicePersonality: session.currentPersonality
              };
              
              session.conversationHistory.push(agentTurn);
              session.metrics.totalTurns += 2; // User + agent
            }
          } catch (error) {
            logger.error(`Error processing audio stream: ${getErrorMessage(error)}`);
          }
        });
        
        // Handle connection close
        websocket.on('close', () => {
          logger.info(`Stream connection closed for conversation ${conversationId}`);
          // Don't end the session here as the call may still be active
        });
      }
      
      // Return success immediately, WebSocket connection is established
      res.status(200).send();
      
    } catch (error) {
      logger.error(`Error in processStreamInput: ${getErrorMessage(error)}`);
      throw error;
    }
  }
}
