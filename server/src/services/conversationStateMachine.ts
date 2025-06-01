import logger from '../utils/logger';
import { voiceAIService } from './index';
import Call, { ICall } from '../models/Call';

/**
 * Conversation state types
 */
export type ConversationState = 
  'initializing' | 
  'compliance' | 
  'greeting' | 
  'listening' | 
  'processing' | 
  'speaking' | 
  'closing' | 
  'completed' | 
  'error';

/**
 * Interface for conversation context that's maintained throughout the call
 */
export interface ConversationContext {
  callId: string;
  leadId: string;
  campaignId: string;
  state: ConversationState;
  complianceComplete: boolean;
  disclosureComplete: boolean;
  consentReceived: boolean;
  userAttention: 'high' | 'medium' | 'low';
  currentTopic?: string;
  detectedIntent?: string;
  detectedEmotion?: string;
  objections: string[];
  conversationLog: Array<{
    role: string;
    content: string;
    timestamp: Date;
    emotion?: string;
    intent?: string;
  }>;
  leadInfo?: Record<string, any>;
  campaignInfo?: Record<string, any>;
  scriptTemplate?: string;
  lastUserInteraction: Date;
  lastAIResponse: Date;
  metadata: Record<string, any>;
}

export class ConversationStateMachine {
  private conversations: Map<string, ConversationContext> = new Map();
  
  /**
   * Initialize a new conversation state machine
   */
  async startConversation(
    callId: string, 
    leadId: string, 
    campaignId: string,
    initialState: ConversationState = 'initializing'
  ): Promise<string> {
    try {
      // Fetch call details
      const call = await Call.findById(callId);
      if (!call) {
        throw new Error(`Call not found: ${callId}`);
      }
      
      // Create conversation context
      const conversationId = `conv_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
      
      // Create conversation state
      const conversationContext: ConversationContext = {
        callId,
        leadId,
        campaignId,
        state: initialState,
        complianceComplete: false,
        disclosureComplete: false,
        consentReceived: false,
        userAttention: 'high',
        objections: [],
        conversationLog: [],
        lastUserInteraction: new Date(),
        lastAIResponse: new Date(),
        metadata: {
          startTime: new Date(),
          complianceScriptId: call.complianceScriptId,
          callReasons: call.callReasons || []
        }
      };
      
      // Store conversation context
      this.conversations.set(conversationId, conversationContext);
      
      logger.info(`Started conversation ${conversationId} for call ${callId} in ${initialState} state`);
      
      // If we need compliance statement, transition to compliance state
      if (call.complianceScriptId) {
        await this.transitionState(conversationId, 'compliance');
        // Load compliance script from database and prepare it
        // This would call a method to get the compliance script content
      } else {
        // Skip compliance, go to greeting
        await this.transitionState(conversationId, 'greeting');
      }
      
      return conversationId;
    } catch (error) {
      logger.error(`Error starting conversation for call ${callId}:`, error);
      throw error;
    }
  }
  
  /**
   * Transition the conversation to a new state
   */
  async transitionState(
    conversationId: string, 
    newState: ConversationState,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    try {
      const conversation = this.conversations.get(conversationId);
      if (!conversation) {
        throw new Error(`Conversation not found: ${conversationId}`);
      }
      
      const previousState = conversation.state;
      conversation.state = newState;
      
      // Update metadata
      conversation.metadata = {
        ...conversation.metadata,
        ...metadata,
        lastStateTransition: {
          from: previousState,
          to: newState,
          timestamp: new Date()
        }
      };
      
      logger.debug(`Conversation ${conversationId} transitioned from ${previousState} to ${newState}`);
      
      // Perform actions based on the new state
      switch (newState) {
        case 'compliance':
          // Generate compliance statement
          await this.handleComplianceState(conversationId);
          break;
          
        case 'greeting':
          // Generate greeting based on call context
          await this.handleGreetingState(conversationId);
          break;
          
        case 'closing':
          // Generate closing statement
          await this.handleClosingState(conversationId);
          break;
          
        case 'completed':
          // Finalize the conversation
          await this.finalizeConversation(conversationId);
          break;
          
        case 'error':
          // Handle error state
          logger.error(`Conversation ${conversationId} entered error state:`, metadata.error);
          break;
      }
    } catch (error) {
      logger.error(`Error transitioning conversation ${conversationId} state:`, error);
      throw error;
    }
  }
  
  /**
   * Process user input and generate AI response
   */
  async processUserInput(
    conversationId: string, 
    userInput: string
  ): Promise<{ text: string, emotion?: string, intent?: string }> {
    try {
      const conversation = this.conversations.get(conversationId);
      if (!conversation) {
        throw new Error(`Conversation not found: ${conversationId}`);
      }
      
      // Update conversation context
      conversation.lastUserInteraction = new Date();
      
      // Detect user emotion from speech
      const detectedEmotion = await this.detectEmotion(userInput);
      conversation.detectedEmotion = detectedEmotion;
      
      // Detect user intent from speech
      const detectedIntent = await this.detectIntent(userInput, conversation);
      conversation.detectedIntent = detectedIntent;
      
      // Check for objections
      if (this.isObjection(userInput, detectedIntent)) {
        conversation.objections.push(userInput);
      }
      
      // Log user input
      conversation.conversationLog.push({
        role: 'user',
        content: userInput,
        timestamp: new Date(),
        emotion: detectedEmotion,
        intent: detectedIntent
      });
      
      // Transition to processing state
      await this.transitionState(conversationId, 'processing');
      
      // Generate AI response
      const response = await this.generateAIResponse(conversationId, userInput);
      
      // Log AI response
      conversation.conversationLog.push({
        role: 'assistant',
        content: response.text,
        timestamp: new Date()
      });
      
      // Update last AI response time
      conversation.lastAIResponse = new Date();
      
      // Transition to speaking state
      await this.transitionState(conversationId, 'speaking');
      
      // After AI finished speaking, transition back to listening
      setTimeout(() => {
        this.transitionState(conversationId, 'listening').catch(err => {
          logger.error(`Error transitioning back to listening state:`, err);
        });
      }, this.estimateSpeakingTime(response.text));
      
      return response;
    } catch (error) {
      logger.error(`Error processing user input for conversation ${conversationId}:`, error);
      
      // Transition to error state
      await this.transitionState(conversationId, 'error', { error });
      
      // Return a generic response
      return {
        text: "I'm sorry, I'm having trouble understanding. Could you please repeat that?"
      };
    }
  }
  
  /**
   * Generate compliance statement based on script
   */
  private async handleComplianceState(conversationId: string): Promise<void> {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) return;
    
    try {
      // Here we would fetch the compliance script and generate the proper text
      // For now we'll use a placeholder
      const complianceText = "Hello, this is an automated call from Lumina Outreach. This call may be recorded for quality assurance.";
      
      // Add to conversation log
      conversation.conversationLog.push({
        role: 'assistant',
        content: complianceText,
        timestamp: new Date()
      });
      
      // Mark compliance as complete
      conversation.complianceComplete = true;
      
      // Move to greeting state after compliance
      setTimeout(() => {
        this.transitionState(conversationId, 'greeting').catch(err => {
          logger.error('Error transitioning to greeting state:', err);
        });
      }, this.estimateSpeakingTime(complianceText));
    } catch (error) {
      logger.error(`Error handling compliance state for ${conversationId}:`, error);
      await this.transitionState(conversationId, 'error', { error });
    }
  }
  
  /**
   * Generate greeting based on call context
   */
  private async handleGreetingState(conversationId: string): Promise<void> {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) return;
    
    try {
      // Here we would generate a context-aware greeting
      // We could also pull information about the lead to personalize
      const greetingText = "I'm calling to discuss how our services could benefit you. Do you have a few minutes to talk?";
      
      // Add to conversation log
      conversation.conversationLog.push({
        role: 'assistant',
        content: greetingText,
        timestamp: new Date()
      });
      
      // Move to listening state after greeting
      setTimeout(() => {
        this.transitionState(conversationId, 'listening').catch(err => {
          logger.error('Error transitioning to listening state:', err);
        });
      }, this.estimateSpeakingTime(greetingText));
    } catch (error) {
      logger.error(`Error handling greeting state for ${conversationId}:`, error);
      await this.transitionState(conversationId, 'error', { error });
    }
  }
  
  /**
   * Generate closing statement
   */
  private async handleClosingState(conversationId: string): Promise<void> {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) return;
    
    try {
      // Generate appropriate closing based on conversation context
      const closingText = "Thank you for your time today. If you have any further questions, please don't hesitate to reach out. Have a great day!";
      
      // Add to conversation log
      conversation.conversationLog.push({
        role: 'assistant',
        content: closingText,
        timestamp: new Date()
      });
      
      // Move to completed state after closing
      setTimeout(() => {
        this.transitionState(conversationId, 'completed').catch(err => {
          logger.error('Error transitioning to completed state:', err);
        });
      }, this.estimateSpeakingTime(closingText));
    } catch (error) {
      logger.error(`Error handling closing state for ${conversationId}:`, error);
      await this.transitionState(conversationId, 'error', { error });
    }
  }
  
  /**
   * Finalize the conversation and save all data
   */
  private async finalizeConversation(conversationId: string): Promise<void> {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) return;
    
    try {
      // Save conversation log to call record
      await Call.findByIdAndUpdate(conversation.callId, {
        conversationLog: conversation.conversationLog,
        updatedAt: new Date()
      });
      
      logger.info(`Finalized conversation ${conversationId} for call ${conversation.callId}`);
      
      // Clean up the conversation from memory
      setTimeout(() => {
        this.conversations.delete(conversationId);
      }, 60000); // Keep in memory for a minute in case of follow-up processing
    } catch (error) {
      logger.error(`Error finalizing conversation ${conversationId}:`, error);
    }
  }
  
  /**
   * Generate AI response based on conversation context
   */
  private async generateAIResponse(
    conversationId: string,
    userInput: string
  ): Promise<{ text: string, emotion?: string, intent?: string }> {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }
    
    try {
      // Use the voiceAI service to generate response
      // This is a simplified example - in production, this would be more sophisticated
      const response = await voiceAIService.generateResponse({
        userInput,
        conversationLog: conversation.conversationLog,
        leadId: conversation.leadId,
        campaignId: conversation.campaignId,
        detectedEmotion: conversation.detectedEmotion,
        detectedIntent: conversation.detectedIntent,
        objections: conversation.objections,
        callContext: {
          complianceComplete: conversation.complianceComplete || false,
          disclosureComplete: conversation.disclosureComplete || false,
          currentPhase: conversation.currentTopic || 'introduction',
          language: 'en-US'
        }
      });
      
      return response;
    } catch (error) {
      logger.error(`Error generating AI response for ${conversationId}:`, error);
      return {
        text: "I'm sorry, I'm having difficulty with my response. Could we continue in a moment?"
      };
    }
  }
  
  /**
   * Detect emotion from user input
   */
  private async detectEmotion(userInput: string): Promise<string> {
    try {
      // This would call the emotion detection service
      // For this implementation, we'll use a simple keyword-based approach
      const emotionKeywords = {
        happy: ['great', 'awesome', 'excellent', 'happy', 'glad', 'pleased'],
        angry: ['angry', 'frustrated', 'annoyed', 'upset', 'mad'],
        confused: ['confused', 'unclear', 'don\'t understand', 'what do you mean'],
        interested: ['tell me more', 'interested', 'curious', 'go on'],
        skeptical: ['doubt', 'not sure', 'skeptical', 'really', 'proof'],
        neutral: []
      };
      
      // Default to neutral
      let detectedEmotion = 'neutral';
      let highestMatchCount = 0;
      
      // Check for each emotion
      for (const [emotion, keywords] of Object.entries(emotionKeywords)) {
        const matchCount = keywords.filter(keyword => 
          userInput.toLowerCase().includes(keyword.toLowerCase())
        ).length;
        
        if (matchCount > highestMatchCount) {
          highestMatchCount = matchCount;
          detectedEmotion = emotion;
        }
      }
      
      return detectedEmotion;
    } catch (error) {
      logger.error('Error detecting emotion:', error);
      return 'neutral';
    }
  }
  
  /**
   * Detect intent from user input
   */
  private async detectIntent(
    userInput: string, 
    conversation: ConversationContext
  ): Promise<string> {
    try {
      // This would call the intent detection service
      // For this implementation, we'll use a simple keyword-based approach
      const intents = {
        inquiry: ['what is', 'how does', 'tell me about', 'explain'],
        interest: ['interested', 'sounds good', 'tell me more', 'like to'],
        objection: ['too expensive', 'not interested', 'don\'t need', 'already have'],
        affirmation: ['yes', 'sure', 'okay', 'alright', 'go ahead'],
        negation: ['no', 'nope', 'not now', 'don\'t', 'can\'t'],
        gratitude: ['thank you', 'thanks', 'appreciate', 'grateful'],
        confusion: ['confused', 'don\'t understand', 'what do you mean', 'unclear'],
        closing: ['goodbye', 'bye', 'end call', 'hang up', 'that\'s all']
      };
      
      // Default to general conversation
      let detectedIntent = 'general';
      let highestMatchCount = 0;
      
      // Check for each intent
      for (const [intent, keywords] of Object.entries(intents)) {
        const matchCount = keywords.filter(keyword => 
          userInput.toLowerCase().includes(keyword.toLowerCase())
        ).length;
        
        if (matchCount > highestMatchCount) {
          highestMatchCount = matchCount;
          detectedIntent = intent;
        }
      }
      
      // If the intent is closing, schedule conversation to end
      if (detectedIntent === 'closing' && conversation.state !== 'closing') {
        setTimeout(() => {
          this.transitionState(conversation.callId, 'closing').catch(err => {
            logger.error('Error transitioning to closing state:', err);
          });
        }, 1000);
      }
      
      return detectedIntent;
    } catch (error) {
      logger.error('Error detecting intent:', error);
      return 'general';
    }
  }
  
  /**
   * Check if user input contains an objection
   */
  private isObjection(userInput: string, intent?: string): boolean {
    // Check if intent is objection
    if (intent === 'objection') return true;
    
    // Check for objection phrases
    const objectionPhrases = [
      'too expensive',
      'not interested',
      'don\'t need',
      'already have',
      'can\'t afford',
      'not now',
      'maybe later',
      'have to think about it',
      'need to consult',
      'don\'t have time',
      'not a good fit'
    ];
    
    return objectionPhrases.some(phrase => 
      userInput.toLowerCase().includes(phrase.toLowerCase())
    );
  }
  
  /**
   * Estimate speaking time for text in milliseconds
   */
  private estimateSpeakingTime(text: string): number {
    // Average speaking rate is ~150 words per minute
    // That's 2.5 words per second
    const wordCount = text.split(/\s+/).length;
    const seconds = wordCount / 2.5;
    
    // Add a buffer and convert to milliseconds
    return Math.max(1000, Math.ceil(seconds * 1000) + 500);
  }
  
  /**
   * Get all active conversations
   */
  getActiveConversations(): string[] {
    return Array.from(this.conversations.keys());
  }
  
  /**
   * Get conversation details
   */
  getConversation(conversationId: string): ConversationContext | undefined {
    return this.conversations.get(conversationId);
  }
  
  /**
   * Cleanup stale conversations (no activity for 15+ minutes)
   */
  cleanupStaleConversations(): void {
    const now = new Date();
    const staleThreshold = 15 * 60 * 1000; // 15 minutes
    
    for (const [id, conversation] of this.conversations.entries()) {
      const lastActivity = Math.max(
        conversation.lastUserInteraction.getTime(),
        conversation.lastAIResponse.getTime()
      );
      
      if (now.getTime() - lastActivity > staleThreshold) {
        logger.info(`Cleaning up stale conversation ${id}`);
        
        // If the conversation wasn't properly completed, finalize it
        if (conversation.state !== 'completed' && conversation.state !== 'error') {
          this.finalizeConversation(id).catch(err => {
            logger.error(`Error finalizing stale conversation ${id}:`, err);
          });
        }
        
        // Remove from memory
        this.conversations.delete(id);
      }
    }
  }
}

export const conversationStateMachine = new ConversationStateMachine();

// Start periodic cleanup of stale conversations
setInterval(() => {
  conversationStateMachine.cleanupStaleConversations();
}, 5 * 60 * 1000); // Run every 5 minutes
