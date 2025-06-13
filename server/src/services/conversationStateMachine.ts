import logger from '../utils/logger';
import { voiceAIService } from './index';
import Call, { ICall } from '../models/Call';
import Campaign from '../models/Campaign';
import Configuration from '../models/Configuration';
import { objectDetectionService } from './objectDetectionService';

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
  objections: string[];
  conversationLog: Array<{
    role: string;
    content: string;
    timestamp: Date;
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
  ): Promise<{ text: string, intent?: string }> {
    try {
      const conversation = this.conversations.get(conversationId);
      if (!conversation) {
        throw new Error(`Conversation not found: ${conversationId}`);
      }
      
      // Update conversation context
      conversation.lastUserInteraction = new Date();
      
      // Detect user intent from speech
      const detectedIntent = await this.detectIntent(userInput, conversation);
      conversation.detectedIntent = detectedIntent;
      
      // Check for objections
      if (await this.isObjection(userInput, detectedIntent)) {
        conversation.objections.push(userInput);
      }
      
      // Log user input
      conversation.conversationLog.push({
        role: 'user',
        content: userInput,
        timestamp: new Date(),
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
      
      // Fetch error response from configuration
      const config = await Configuration.findOne();
      return {
        text: config?.errorMessages?.generalError || "Error processing request"
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
      // Fetch the compliance script from database
      const call = await Call.findById(conversation.callId);
      const config = await Configuration.findOne();
      
      if (!call) {
        throw new Error(`Call not found: ${conversation.callId}`);
      }
      
      // Get compliance text from configuration or load specific script if a script ID is provided
      let complianceText = '';
      
      if (call.complianceScriptId) {
        // Here you would fetch the specific compliance script by ID
        // For now, we'll fall back to the default from configuration
        complianceText = config?.complianceSettings?.callIntroduction || '';
      } else {
        // Use default compliance text from configuration
        complianceText = config?.complianceSettings?.callIntroduction || '';
      }
      
      // Replace any placeholders in the compliance text
      complianceText = complianceText.replace('[Company Name]', 'our company');
      
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
      // Fetch call, campaign, and lead details
      const call = await Call.findById(conversation.callId);
      const campaign = await Campaign.findById(conversation.campaignId);
      
      if (!call || !campaign) {
        throw new Error(`Call or campaign not found for conversation ${conversationId}`);
      }
      
      // Get active script from the campaign
      const activeScript = campaign.script?.versions?.find(v => v.isActive);
      
      if (!activeScript || !activeScript.content) {
        throw new Error(`No active script found for campaign ${conversation.campaignId}`);
      }
      
      // Use the campaign script as greeting
      const greetingText = activeScript.content;
      
      // Add to conversation log
      conversation.conversationLog.push({
        role: 'assistant',
        content: greetingText,
        timestamp: new Date()
      });
      
      // Store campaign info in conversation context for future reference
      conversation.campaignInfo = {
        name: campaign.name,
        goal: campaign.goal,
        targetAudience: campaign.targetAudience,
        primaryLanguage: campaign.primaryLanguage,
        llmConfig: campaign.llmConfiguration
      };
      
      // Store script template for future use
      conversation.scriptTemplate = activeScript.content;
      
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
      // Fetch campaign to get appropriate closing message
      const campaign = await Campaign.findById(conversation.campaignId);
      const call = await Call.findById(conversation.callId);
      
      if (!campaign || !call) {
        throw new Error(`Campaign or call not found for conversation ${conversationId}`);
      }
      
      // Generate closing based on conversation context and campaign settings
      let closingText = "";
      
      // Get closing script from campaign settings
      if (campaign.scriptClosing) {
        closingText = campaign.scriptClosing;
      } else {
        // Fallback to configuration
        const config = await Configuration.findOne();
        if (conversation.consentReceived) {
          closingText = config?.closingScripts?.consentReceived || "";
        } else if (conversation.objections.length > 0) {
          closingText = config?.closingScripts?.withObjections || "";
        } else {
          closingText = config?.closingScripts?.default || "";
        }
      }
      
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
  ): Promise<{ text: string, intent?: string }> {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }
    
    try {
      // Fetch campaign to get language settings
      const campaign = await Campaign.findById(conversation.campaignId);
      
      // Use the voiceAI service to generate response
      const response = await voiceAIService.generateResponse({
        userInput,
        conversationLog: conversation.conversationLog,
        leadId: conversation.leadId,
        campaignId: conversation.campaignId,
        callContext: {
          complianceComplete: conversation.complianceComplete || false,
          disclosureComplete: conversation.disclosureComplete || false,
          currentPhase: conversation.currentTopic || 'introduction',
          language: campaign?.primaryLanguage ? 
            (campaign.primaryLanguage === 'hi' ? 'hi-IN' : 'en-US') : 'en-US'
        }
      });
      
      return response;
    } catch (error) {
      logger.error(`Error generating AI response for ${conversationId}:`, error);
      
      // NO FALLBACKS - throw error to force proper configuration
      throw new Error(`Failed to generate AI response for conversation ${conversationId}: ${error.message}. Please ensure your system configuration includes proper error messages.`);
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
      // Fetch campaign to access LLM configuration
      const campaign = await Campaign.findById(conversation.campaignId);
      
      if (!campaign) {
        logger.warn(`Campaign not found for intent detection: ${conversation.campaignId}`);
        return 'general';
      }
      
      // Fetch configuration to get closing phrases
      const config = await Configuration.findOne();
      
      // Check for closing intent based on configured phrases
      const closingPhrases = config?.intentDetection?.closingPhrases || [];
      const isClosing = closingPhrases.length > 0 && 
        closingPhrases.some(phrase => 
          userInput.toLowerCase().includes(phrase.toLowerCase())
        );
      
      if (isClosing && conversation.state !== 'closing') {
        setTimeout(() => {
          this.transitionState(conversation.callId, 'closing').catch(err => {
            logger.error('Error transitioning to closing state:', err);
          });
        }, 1000);
        return 'closing';
      }
      
      // For other intents, use the object detection service
      try {
        const intentDetection = await objectDetectionService.detectIntent(userInput);
        return intentDetection.intent || 'general';
      } catch (intentError) {
        logger.error('Error in intent detection via service:', intentError);
        return 'general';
      }
    } catch (error) {
      logger.error('Error detecting intent:', error);
      return 'general';
    }
  }
  
  /**
   * Check if user input contains an objection
   */
  private async isObjection(userInput: string, intent?: string): Promise<boolean> {
    // If intent detection already identified this as an objection
    if (intent === 'objection') return true;
    
    try {
      // Use the object detection service to detect objections
      const llmResponse = await objectDetectionService.detectObjection(userInput);
      return llmResponse.isObjection || false;
    } catch (error) {
      logger.error('Error detecting objection:', error);
      
      // Fallback to configuration-based detection in case of error
      const config = await Configuration.findOne();
      const objectionPhrases = config?.intentDetection?.objectionPhrases || [];
      
      return objectionPhrases.length > 0 && 
        objectionPhrases.some(phrase => 
          userInput.toLowerCase().includes(phrase.toLowerCase())
        );
    }
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
