import Redis from 'ioredis';
import { logger } from '../index';
import { v4 as uuidv4 } from 'uuid';

export interface ConversationMessage {
  id: string;
  role: 'system' | 'assistant' | 'user';
  content: string;
  timestamp: Date;
  metadata?: {
    emotion?: string;
    confidence?: number;
    processingTime?: number;
    [key: string]: any;
  };
}

export interface ConversationContext {
  conversationId: string;
  callId?: string;
  leadId?: string;
  campaignId?: string;
  messages: ConversationMessage[];
  summary?: string;
  contextualData?: Record<string, any>;
  lastUpdated: Date;
}

/**
 * Service for managing conversation memory with Redis
 * Implements a sliding window approach to maintain relevant context
 */
export class ConversationMemoryService {
  private redis: Redis;
  private readonly keyPrefix: string = 'conversation:';
  private readonly defaultTTL: number = 60 * 60 * 24; // 24 hours in seconds
  private readonly maxContextSize: number = 10; // Maximum number of messages to keep in context

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl);
    this.redis.on('error', (err) => {
      logger.error(`Redis connection error: ${err}`);
    });
    logger.info('ConversationMemoryService initialized with Redis');
  }

  /**
   * Create a new conversation context
   */
  public async createConversation(
    initialContext?: Partial<ConversationContext>
  ): Promise<ConversationContext> {
    const conversationId = initialContext?.conversationId || uuidv4();
    const context: ConversationContext = {
      conversationId,
      callId: initialContext?.callId,
      leadId: initialContext?.leadId,
      campaignId: initialContext?.campaignId,
      messages: initialContext?.messages || [],
      contextualData: initialContext?.contextualData || {},
      lastUpdated: new Date()
    };

    await this.saveConversation(context);
    return context;
  }

  /**
   * Add a message to the conversation context
   * Implements sliding window to maintain the last N messages
   */
  public async addMessage(
    conversationId: string,
    message: Omit<ConversationMessage, 'id' | 'timestamp'>
  ): Promise<ConversationContext | null> {
    const context = await this.getConversation(conversationId);
    if (!context) {
      logger.error(`Attempted to add message to non-existent conversation: ${conversationId}`);
      return null;
    }

    const newMessage: ConversationMessage = {
      id: uuidv4(),
      ...message,
      timestamp: new Date()
    };

    // Add the new message
    context.messages.push(newMessage);

    // Apply sliding window if needed
    if (context.messages.length > this.maxContextSize) {
      // Keep system messages and the last N-1 messages
      const systemMessages = context.messages.filter(msg => msg.role === 'system');
      const nonSystemMessages = context.messages
        .filter(msg => msg.role !== 'system')
        .slice(-(this.maxContextSize - systemMessages.length));
      
      context.messages = [...systemMessages, ...nonSystemMessages];
    }

    context.lastUpdated = new Date();
    await this.saveConversation(context);
    return context;
  }

  /**
   * Get the current conversation context
   */
  public async getConversation(conversationId: string): Promise<ConversationContext | null> {
    try {
      const key = `${this.keyPrefix}${conversationId}`;
      const data = await this.redis.get(key);
      
      if (!data) {
        return null;
      }
      
      const context: ConversationContext = JSON.parse(data);
      // Convert string timestamps back to Date objects
      context.lastUpdated = new Date(context.lastUpdated);
      context.messages = context.messages.map(msg => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      }));
      
      return context;
    } catch (error) {
      logger.error(`Error retrieving conversation ${conversationId}: ${error}`);
      return null;
    }
  }

  /**
   * Save the conversation context to Redis
   */
  private async saveConversation(context: ConversationContext): Promise<void> {
    try {
      const key = `${this.keyPrefix}${context.conversationId}`;
      await this.redis.set(key, JSON.stringify(context), 'EX', this.defaultTTL);
    } catch (error) {
      logger.error(`Error saving conversation ${context.conversationId}: ${error}`);
    }
  }

  /**
   * Update the conversation summary
   * This is used to maintain a condensed version of the conversation
   */
  public async updateSummary(conversationId: string, summary: string): Promise<void> {
    const context = await this.getConversation(conversationId);
    if (!context) {
      logger.error(`Attempted to update summary for non-existent conversation: ${conversationId}`);
      return;
    }

    context.summary = summary;
    context.lastUpdated = new Date();
    await this.saveConversation(context);
  }

  /**
   * Update contextual data for the conversation
   * This can include customer information, detected entities, or other relevant context
   */
  public async updateContextData(
    conversationId: string,
    data: Record<string, any>
  ): Promise<void> {
    const context = await this.getConversation(conversationId);
    if (!context) {
      logger.error(`Attempted to update context data for non-existent conversation: ${conversationId}`);
      return;
    }

    context.contextualData = {
      ...context.contextualData,
      ...data
    };
    context.lastUpdated = new Date();
    await this.saveConversation(context);
  }

  /**
   * Delete a conversation from Redis
   */
  public async deleteConversation(conversationId: string): Promise<boolean> {
    try {
      const key = `${this.keyPrefix}${conversationId}`;
      const result = await this.redis.del(key);
      return result === 1;
    } catch (error) {
      logger.error(`Error deleting conversation ${conversationId}: ${error}`);
      return false;
    }
  }

  /**
   * Get all messages for a conversation formatted for LLM context
   */
  public async getFormattedMessagesForLLM(conversationId: string): Promise<Array<{role: string, content: string}>> {
    const context = await this.getConversation(conversationId);
    if (!context) {
      return [];
    }

    return context.messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
  }

  /**
   * Extract emotional journey from conversation history
   */
  public async getEmotionalJourney(conversationId: string): Promise<Array<{timestamp: Date, emotion: string, confidence: number}>> {
    const context = await this.getConversation(conversationId);
    if (!context) {
      return [];
    }

    return context.messages
      .filter(msg => msg.role === 'user' && msg.metadata?.emotion)
      .map(msg => ({
        timestamp: msg.timestamp,
        emotion: msg.metadata?.emotion || 'neutral',
        confidence: msg.metadata?.confidence || 0.5
      }));
  }
}

// Export singleton instance
let memoryService: ConversationMemoryService | null = null;

export const getConversationMemoryService = (redisUrl?: string): ConversationMemoryService => {
  if (!memoryService && redisUrl) {
    memoryService = new ConversationMemoryService(redisUrl);
  } else if (!memoryService) {
    throw new Error('ConversationMemoryService not initialized');
  }
  return memoryService;
};

export const initializeConversationMemoryService = (redisUrl: string): ConversationMemoryService => {
  memoryService = new ConversationMemoryService(redisUrl);
  return memoryService;
};
