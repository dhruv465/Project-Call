import { logger } from '../index';
import { LLMService } from './llm/service';
import { LLMMessage } from './llm/types';
import { EnhancedVoiceAIService } from './enhancedVoiceAIService';
import Campaign from '../models/Campaign';
import Lead from '../models/Lead';

export interface ConversationState {
  phase: 'opening' | 'discovery' | 'presentation' | 'objection-handling' | 'closing' | 'follow-up';
  customerProfile: {
    engagementLevel: number;
    decisionMakingStyle: string;
    painPoints: string[];
    interests: string[];
  };
  conversationFlow: {
    completedPhases: string[];
    nextActions: string[];
    fallbackActions: string[];
  };
  contextData: {
    leadInfo: any;
    campaignInfo: any;
    previousInteractions: any[];
  };
}

export interface IntentAnalysis {
  primary: string;
  confidence: number;
  entities: { [key: string]: string };
  sentiment: 'positive' | 'negative' | 'neutral';
  urgency: 'low' | 'medium' | 'high';
  decisionIndicators: string[];
}

export interface ObjectionType {
  category: 'price' | 'timing' | 'authority' | 'need' | 'trust' | 'competitor';
  severity: 'low' | 'medium' | 'high';
  specificConcern: string;
  suggestedResponse: string;
  escalationNeeded: boolean;
}

export interface ConversationMetrics {
  engagementScore: number;
  sentimentProgression: number[];
  objectionCount: number;
  interruptionCount: number;
  responseTime: number[];
  conversionIndicators: string[];
}

export class AdvancedConversationEngine {
  private activeConversations: Map<string, ConversationState> = new Map();
  private intentPatterns: Map<string, RegExp[]> = new Map();
  private objectionHandlers: Map<string, Function> = new Map();
  private llmService: LLMService;
  private voiceAIService: EnhancedVoiceAIService;

  constructor(llmService: LLMService, voiceAIService: EnhancedVoiceAIService) {
    this.llmService = llmService;
    this.voiceAIService = voiceAIService;
    this.initializeIntentPatterns();
    this.initializeObjectionHandlers();
  }

  private initializeIntentPatterns(): void {
    this.intentPatterns.set('interest', [
      /tell me more/i,
      /sounds interesting/i,
      /how does it work/i,
      /what are the benefits/i
    ]);

    this.intentPatterns.set('price_inquiry', [
      /how much/i,
      /cost/i,
      /price/i,
      /expensive/i,
      /budget/i
    ]);

    this.intentPatterns.set('objection', [
      /not interested/i,
      /don't need/i,
      /can't afford/i,
      /not right time/i,
      /already have/i
    ]);

    this.intentPatterns.set('ready_to_buy', [
      /let's do it/i,
      /sign me up/i,
      /when can we start/i,
      /send me the contract/i
    ]);

    this.intentPatterns.set('need_authority', [
      /need to ask/i,
      /check with/i,
      /not my decision/i,
      /boss/i,
      /manager/i
    ]);
  }

  private initializeObjectionHandlers(): void {
    this.objectionHandlers.set('price', this.handlePriceObjection.bind(this));
    this.objectionHandlers.set('timing', this.handleTimingObjection.bind(this));
    this.objectionHandlers.set('authority', this.handleAuthorityObjection.bind(this));
    this.objectionHandlers.set('need', this.handleNeedObjection.bind(this));
    this.objectionHandlers.set('trust', this.handleTrustObjection.bind(this));
    this.objectionHandlers.set('competitor', this.handleCompetitorObjection.bind(this));
  }

  // Main conversation flow management
  async generateResponse(params: {
    callId: string;
    conversationState: string;
    customerInput?: string;
    campaignId: string;
    personalityId?: string;
    abTestVariantId?: string;
  }): Promise<any> {
    try {
      // Get or create conversation state
      let conversation = this.activeConversations.get(params.callId);
      if (!conversation) {
        conversation = await this.initializeConversation(params.callId, params.campaignId);
      }

      // Analyze customer input if provided
      let intentAnalysis: IntentAnalysis | null = null;
      if (params.customerInput) {
        intentAnalysis = await this.analyzeIntent(params.customerInput);
        await this.updateCustomerProfile(conversation, intentAnalysis);
      }

      // Determine next response based on conversation phase and analysis
      const response = await this.determineResponse(
        conversation,
        intentAnalysis,
        params.personalityId
      );

      // Update conversation state
      await this.updateConversationState(conversation, response, intentAnalysis);
      this.activeConversations.set(params.callId, conversation);

      return response;
    } catch (error) {
      logger.error('Error generating conversation response:', error);
      // NO HARDCODED RESPONSES - must be configured dynamically
      throw new Error(`Failed to generate conversation response: ${error.message}. Please ensure your campaign and system configuration are complete.`);
    }
  }

  private async initializeConversation(callId: string, campaignId: string): Promise<ConversationState> {
    try {
      // Fetch campaign and lead information
      const campaign = await Campaign.findById(campaignId);
      
      return {
        phase: 'opening',
        customerProfile: {
          engagementLevel: 0.5,
          decisionMakingStyle: 'unknown',
          painPoints: [],
          interests: []
        },
        conversationFlow: {
          completedPhases: [],
          nextActions: ['introduce', 'permission_to_continue'],
          fallbackActions: ['clarify', 'repeat']
        },
        contextData: {
          leadInfo: {},
          campaignInfo: campaign,
          previousInteractions: []
        }
      };
    } catch (error) {
      logger.error('Error initializing conversation:', error);
      throw error;
    }
  }

  // Intent Analysis
  async analyzeIntent(customerInput: string): Promise<IntentAnalysis> {
    try {
      let primaryIntent = 'unknown';
      let confidence = 0;
      
      // Pattern matching for quick intent detection
      for (const [intent, patterns] of this.intentPatterns.entries()) {
        for (const pattern of patterns) {
          if (pattern.test(customerInput)) {
            primaryIntent = intent;
            confidence = 0.8;
            break;
          }
        }
        if (confidence > 0) break;
      }

      // Enhanced intent analysis using LLM
      if (confidence < 0.7) {
        const llmAnalysis = await this.performLLMIntentAnalysis(customerInput);
        primaryIntent = llmAnalysis.intent;
        confidence = llmAnalysis.confidence;
      }

      // Extract entities and sentiment
      const entities = await this.extractEntities(customerInput);
      const sentiment = await this.analyzeSentiment(customerInput);
      const urgency = this.determineUrgency(customerInput);
      const decisionIndicators = this.extractDecisionIndicators(customerInput);

      return {
        primary: primaryIntent,
        confidence,
        entities,
        sentiment,
        urgency,
        decisionIndicators
      };
    } catch (error) {
      logger.error('Error analyzing intent:', error);
      return {
        primary: 'unknown',
        confidence: 0,
        entities: {},
        sentiment: 'neutral',
        urgency: 'low',
        decisionIndicators: []
      };
    }
  }

  private async performLLMIntentAnalysis(input: string): Promise<{ intent: string; confidence: number }> {
    const prompt = `
      Analyze the following customer response in a sales call context and determine the primary intent:
      
      Customer: "${input}"
      
      Possible intents: interest, price_inquiry, objection, ready_to_buy, need_authority, clarification, negative_response
      
      Respond with JSON: {"intent": "detected_intent", "confidence": 0.0-1.0}
    `;

    try {
      const messages: LLMMessage[] = [
        { role: 'user', content: prompt }
      ];
      
      const llmResponse = await this.llmService.chat({
        provider: 'openai',
        model: 'gpt-4',
        messages: messages,
        options: { 
          temperature: 0.3, 
          maxTokens: 150 
        }
      });
      
      const parsed = JSON.parse(llmResponse.content);
      return {
        intent: parsed.intent || 'unknown',
        confidence: parsed.confidence || 0.5
      };
    } catch (error) {
      logger.error('LLM intent analysis failed:', error);
      return { intent: 'unknown', confidence: 0 };
    }
  }

  private async extractEntities(input: string): Promise<{ [key: string]: string }> {
    // Simple entity extraction - in production, use NER models
    const entities: { [key: string]: string } = {};
    
    // Extract common entities
    const timeRegex = /\b(\d{1,2}:\d{2}|\d{1,2}\s?(am|pm)|morning|afternoon|evening)\b/gi;
    const dateRegex = /\b(today|tomorrow|next week|monday|tuesday|wednesday|thursday|friday)\b/gi;
    const numberRegex = /\b\d+\b/g;
    
    const timeMatches = input.match(timeRegex);
    if (timeMatches) entities.time = timeMatches[0];
    
    const dateMatches = input.match(dateRegex);
    if (dateMatches) entities.date = dateMatches[0];
    
    const numberMatches = input.match(numberRegex);
    if (numberMatches) entities.number = numberMatches[0];

    return entities;
  }

  private async analyzeSentiment(input: string): Promise<'positive' | 'negative' | 'neutral'> {
    const positiveWords = ['great', 'excellent', 'good', 'interested', 'yes', 'sure', 'definitely'];
    const negativeWords = ['no', 'not', 'bad', 'terrible', 'never', 'stop', 'don\'t'];
    
    const words = input.toLowerCase().split(/\s+/);
    let positiveCount = 0;
    let negativeCount = 0;
    
    words.forEach(word => {
      if (positiveWords.includes(word)) positiveCount++;
      if (negativeWords.includes(word)) negativeCount++;
    });
    
    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }

  private determineUrgency(input: string): 'low' | 'medium' | 'high' {
    const urgentWords = ['urgent', 'asap', 'immediately', 'now', 'quickly', 'today'];
    const mediumWords = ['soon', 'this week', 'next week'];
    
    const lowerInput = input.toLowerCase();
    
    if (urgentWords.some(word => lowerInput.includes(word))) return 'high';
    if (mediumWords.some(word => lowerInput.includes(word))) return 'medium';
    return 'low';
  }

  private extractDecisionIndicators(input: string): string[] {
    const indicators = [];
    const buyingSignals = [
      'how much', 'when can we start', 'what\'s the process', 
      'send me information', 'let\'s do it', 'sounds good'
    ];
    
    const lowerInput = input.toLowerCase();
    buyingSignals.forEach(signal => {
      if (lowerInput.includes(signal)) {
        indicators.push(signal);
      }
    });
    
    return indicators;
  }

  // Objection Handling
  async identifyObjection(customerInput: string): Promise<ObjectionType | null> {
    const objectionPatterns = {
      price: [/too expensive/i, /can't afford/i, /out of budget/i, /costs too much/i],
      timing: [/not right time/i, /too busy/i, /maybe later/i, /call back/i],
      authority: [/not my decision/i, /ask my boss/i, /need approval/i],
      need: [/don't need/i, /already have/i, /not interested/i],
      trust: [/don't know you/i, /sounds too good/i, /scam/i],
      competitor: [/using competitor/i, /happy with current/i, /already working with/i]
    };

    for (const [category, patterns] of Object.entries(objectionPatterns)) {
      for (const pattern of patterns) {
        if (pattern.test(customerInput)) {
          const severity = this.assessObjectionSeverity(customerInput);
          return {
            category: category as any,
            severity,
            specificConcern: customerInput,
            suggestedResponse: await this.generateObjectionResponse(category, customerInput),
            escalationNeeded: severity === 'high'
          };
        }
      }
    }

    return null;
  }

  private assessObjectionSeverity(input: string): 'low' | 'medium' | 'high' {
    const strongNegatives = ['never', 'absolutely not', 'definitely not', 'no way'];
    const mediumNegatives = ['not sure', 'maybe not', 'probably not'];
    
    const lowerInput = input.toLowerCase();
    
    if (strongNegatives.some(phrase => lowerInput.includes(phrase))) return 'high';
    if (mediumNegatives.some(phrase => lowerInput.includes(phrase))) return 'medium';
    return 'low';
  }

  private async generateObjectionResponse(category: string, concern: string): Promise<string> {
    const handler = this.objectionHandlers.get(category);
    if (handler) {
      return await handler(concern);
    }
    // NO HARDCODED RESPONSES - must be configured dynamically
    throw new Error(`Objection handler for category '${category}' not configured. Please set up objection handling templates in your campaign configuration.`);
  }

  // Objection Handlers
  private async handlePriceObjection(concern: string): Promise<string> {
    // NO HARDCODED RESPONSES - must be configured dynamically
    throw new Error('Price objection handler not configured. Please set up objection handling templates in your campaign configuration.');
  }

  private async handleTimingObjection(concern: string): Promise<string> {
    // NO HARDCODED RESPONSES - must be configured dynamically
    throw new Error('Timing objection handler not configured. Please set up objection handling templates in your campaign configuration.');
  }

  private async handleAuthorityObjection(concern: string): Promise<string> {
    // NO HARDCODED RESPONSES - must be configured dynamically
    throw new Error('Authority objection handler not configured. Please set up objection handling templates in your campaign configuration.');
  }

  private async handleNeedObjection(concern: string): Promise<string> {
    // NO HARDCODED RESPONSES - must be configured dynamically
    throw new Error('Need objection handler not configured. Please set up objection handling templates in your campaign configuration.');
  }

  private async handleTrustObjection(concern: string): Promise<string> {
    // NO HARDCODED RESPONSES - must be configured dynamically
    throw new Error('Trust objection handler not configured. Please set up objection handling templates in your campaign configuration.');
  }

  private async handleCompetitorObjection(concern: string): Promise<string> {
    // NO HARDCODED RESPONSES - must be configured dynamically
    throw new Error('Competitor objection handler not configured. Please set up objection handling templates in your campaign configuration.');
  }

  // Conversation Flow Management
  private async determineResponse(
    conversation: ConversationState,
    intentAnalysis: IntentAnalysis | null,
    personalityId?: string
  ): Promise<any> {
    try {
      // Check for objections first
      if (intentAnalysis?.primary === 'objection') {
        return await this.handleObjectionInConversation(conversation, intentAnalysis);
      }

      // Handle based on conversation phase
      switch (conversation.phase) {
        case 'opening':
          return await this.handleOpeningPhase(conversation, intentAnalysis);
        case 'discovery':
          return await this.handleDiscoveryPhase(conversation, intentAnalysis);
        case 'presentation':
          return await this.handlePresentationPhase(conversation, intentAnalysis);
        case 'closing':
          return await this.handleClosingPhase(conversation, intentAnalysis);
        default:
          return await this.generatePhaseResponse(conversation.phase, intentAnalysis);
      }
    } catch (error) {
      logger.error('Error determining response:', error);
      // NO HARDCODED RESPONSES - must be configured dynamically
      throw new Error(`Failed to determine conversation response: ${error.message}. Please ensure your campaign configuration includes all necessary response templates.`);
    }
  }

  private async handleOpeningPhase(conversation: ConversationState, intent: IntentAnalysis | null): Promise<any> {
    if (intent?.primary === 'interest') {
      conversation.phase = 'discovery';
      return {
        text: "Great! I'd love to learn more about your current situation. What challenges are you facing in your business right now?",
        action: 'gather',
        nextState: 'discovery'
      };
    }

    return {
      text: "",
      action: 'gather',
      nextState: 'opening'
    };
  }

  private async handleDiscoveryPhase(conversation: ConversationState, intent: IntentAnalysis | null): Promise<any> {
    // Extract pain points and interests
    if (intent?.entities) {
      Object.keys(intent.entities).forEach(key => {
        if (!conversation.customerProfile.painPoints.includes(intent.entities[key])) {
          conversation.customerProfile.painPoints.push(intent.entities[key]);
        }
      });
    }

    if (conversation.customerProfile.painPoints.length >= 2) {
      conversation.phase = 'presentation';
      return {
        text: "Based on what you've shared, I can see how our solution would specifically address those challenges. Let me show you how we've helped similar companies.",
        action: 'speak',
        nextState: 'presentation'
      };
    }

    return {
      text: "That's very insightful. Can you tell me more about how this impacts your daily operations?",
      action: 'gather',
      nextState: 'discovery'
    };
  }

  private async handlePresentationPhase(conversation: ConversationState, intent: IntentAnalysis | null): Promise<any> {
    if (intent?.primary === 'ready_to_buy' || intent?.decisionIndicators.length > 0) {
      conversation.phase = 'closing';
      return {
        text: "I'm glad you see the value! Let's discuss the next steps to get you started.",
        action: 'speak',
        nextState: 'closing'
      };
    }

    if (intent?.primary === 'price_inquiry') {
      return {
        text: "Great question about investment. The cost varies based on your specific needs, but I can tell you that our clients typically see ROI within 3-6 months. Would you like me to prepare a customized proposal for you?",
        action: 'gather',
        nextState: 'presentation'
      };
    }

    return {
      text: "Here's how this specifically solves the challenges you mentioned. What questions do you have about this approach?",
      action: 'gather',
      nextState: 'presentation'
    };
  }

  private async handleClosingPhase(conversation: ConversationState, intent: IntentAnalysis | null): Promise<any> {
    if (intent?.primary === 'ready_to_buy') {
      return {
        text: "Excellent! I'll send you the agreement and we can schedule a kickoff call. What's the best email address to send this to?",
        action: 'gather',
        nextState: 'follow-up'
      };
    }

    return {
      text: "Based on everything we've discussed, this seems like a perfect fit for your needs. Are you ready to move forward?",
      action: 'gather',
      nextState: 'closing'
    };
  }

  private async handleObjectionInConversation(conversation: ConversationState, intent: IntentAnalysis): Promise<any> {
    const objection = await this.identifyObjection(intent.entities.concern || '');
    
    if (objection) {
      const response = await this.generateObjectionResponse(objection.category, objection.specificConcern);
      return {
        text: response,
        action: 'gather',
        nextState: conversation.phase,
        objectionHandled: objection.category
      };
    }

    // NO HARDCODED RESPONSES - must be configured dynamically
    throw new Error('Objection detected but no handler configured. Please set up objection handling templates in your campaign configuration.');
  }

  private async generatePhaseResponse(phase: string, intent: IntentAnalysis | null): Promise<any> {
    // NO HARDCODED RESPONSES - must be configured dynamically
    throw new Error(`Phase response for '${phase}' not configured. Please set up phase-specific templates in your campaign configuration.`);
  }

  private generateFallbackResponse(): any {
    // NO HARDCODED RESPONSES - must be configured dynamically
    throw new Error('Fallback response requested but not configured. Please ensure your campaign configuration includes comprehensive response templates.');
  }

  // Conversation State Management
  private async updateCustomerProfile(
    conversation: ConversationState,
    intent: IntentAnalysis
  ): Promise<void> {
    // Update engagement level based on responses
    if (intent.primary === 'interest') {
      conversation.customerProfile.engagementLevel = Math.min(1, conversation.customerProfile.engagementLevel + 0.2);
    } else if (intent.primary === 'objection') {
      conversation.customerProfile.engagementLevel = Math.max(0, conversation.customerProfile.engagementLevel - 0.1);
    }

    // Extract and store pain points
    if (intent.entities && Object.keys(intent.entities).length > 0) {
      Object.values(intent.entities).forEach(entity => {
        if (!conversation.customerProfile.painPoints.includes(entity)) {
          conversation.customerProfile.painPoints.push(entity);
        }
      });
    }
  }

  private async updateConversationState(
    conversation: ConversationState,
    response: any,
    intent: IntentAnalysis | null
  ): Promise<void> {
    // Mark phase as completed if moving to next phase
    if (response.nextState && response.nextState !== conversation.phase) {
      if (!conversation.conversationFlow.completedPhases.includes(conversation.phase)) {
        conversation.conversationFlow.completedPhases.push(conversation.phase);
      }
    }

    // Update next actions based on response
    conversation.conversationFlow.nextActions = this.determineNextActions(response, intent);
  }

  private determineNextActions(response: any, intent: IntentAnalysis | null): string[] {
    const actions = [];
    
    if (response.objectionHandled) {
      actions.push('follow_up_objection', 'continue_presentation');
    } else if (intent?.primary === 'interest') {
      actions.push('provide_details', 'ask_qualifying_questions');
    } else if (intent?.primary === 'ready_to_buy') {
      actions.push('close_deal', 'schedule_follow_up');
    } else {
      actions.push('clarify', 'provide_value');
    }
    
    return actions;
  }

  // Conversation Flow Adaptation
  async adaptConversationFlow(params: {
    conversationId: string;
    conversationHistory: any[];
    currentScript: string;
    language: string;
  }): Promise<any> {
    try {
      const conversation = this.activeConversations.get(params.conversationId);
      if (!conversation) {
        throw new Error('Conversation not found');
      }

      // Analyze conversation effectiveness
      const effectiveness = this.analyzeConversationEffectiveness(params.conversationHistory);
      
      // Adapt based on conversation effectiveness
      const adaptation = await this.generateAdaptation(
        conversation,
        effectiveness,
        params.language
      );

      return adaptation;
    } catch (error) {
      logger.error('Error adapting conversation flow:', error);
      throw error;
    }
  }

  private analyzeConversationEffectiveness(history: any[]): number {
    if (history.length === 0) return 0.5;
    
    let positiveResponses = 0;
    let totalResponses = history.length;
    
    history.forEach(turn => {
      if (turn.sentiment === 'positive' || turn.intent === 'interest') {
        positiveResponses++;
      }
    });
    
    return positiveResponses / totalResponses;
  }

  private async generateAdaptation(
    conversation: ConversationState,
    effectiveness: number,
    language: string
  ): Promise<any> {
    const adaptations = {
      script: '',
      voiceAdjustments: {},
      personalityShift: null,
      recommendations: []
    };

    // Adapt script based on effectiveness
    if (effectiveness < 0.3) {
      adaptations.script = await this.generateRecoveryScript(conversation);
      adaptations.recommendations.push('Switch to recovery mode');
    } else if (effectiveness > 0.7) {
      adaptations.script = await this.generateAcceleratedScript(conversation);
      adaptations.recommendations.push('Accelerate to closing');
    }

    // Standard voice adjustments based on conversation stage
    adaptations.voiceAdjustments = {
      speed: 1.0,
      tone: 'professional',
      energy: 'balanced'
    };

    return adaptations;
  }
  private async generateRecoveryScript(conversation: ConversationState): Promise<string> {
    return "I can sense this might not be resonating with you. Let me take a step back - what would be most valuable for you to hear about right now?";
  }

  private async generateAcceleratedScript(conversation: ConversationState): Promise<string> {
    return "I can see you're engaged with this solution. Would you like me to prepare a proposal so we can move forward quickly?";
  }

  // Public API Methods
  async getConversationMetrics(conversationId: string): Promise<ConversationMetrics> {
    const conversation = this.activeConversations.get(conversationId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }

    return {
      engagementScore: conversation.customerProfile.engagementLevel,
      sentimentProgression: [], // Would track sentiment over time
      objectionCount: 0, // Would count objections handled
      interruptionCount: 0, // Would track customer interruptions
      responseTime: [], // Would track AI response times
      conversionIndicators: conversation.customerProfile.interests
    };
  }

  async endConversation(conversationId: string): Promise<void> {
    this.activeConversations.delete(conversationId);
  }

  async getAllActiveConversations(): Promise<ConversationState[]> {
    return Array.from(this.activeConversations.values());
  }
}

// Export the class for use with dependency injection
// Instances should be created in services/index.ts
