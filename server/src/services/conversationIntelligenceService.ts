import logger from '../utils/logger';
import { ConfigurationService } from './configurationService';

// Interface for conversation turn
export interface ConversationTurn {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: Date;
  emotion?: string;
  scriptId?: string;
  intentDetected?: string;
  qualityScore?: number;
  campaignId?: string;
  userId?: string;
}

// Interface for conversation data
interface ConversationData {
  turns: ConversationTurn[];
  metadata: {
    campaignId?: string;
    agentId?: string;
    leadId?: string;
    callId?: string;
    startTime: Date;
    lastUpdateTime: Date;
    turnCount: number;
    qualityScore?: number;
    scriptAdherence?: number;
    [key: string]: any;
  };
}

/**
 * Emotion data interface
 */
export interface EmotionData {
  emotion: string;
  confidence: number;
  valence: number; // -1 to 1 (negative to positive)
  arousal: number; // 0 to 1 (calm to excited)
}

/**
 * Emotion prompt modifiers interface
 */
interface EmotionPromptModifiers {
  tone: string;
  pacing: string;
  empathy: string;
}

/**
 * Script deviation result interface
 */
export interface ScriptDeviationResult {
  deviationLevel: 'none' | 'minor' | 'significant' | 'complete' | 'unknown';
  similarity: number; // 0-1 scale
  isCompliant: boolean;
  details: Record<string, any>;
  error?: string;
}

/**
 * Next best action suggestion interface
 */
export interface NextBestActionSuggestion {
  action: string;
  confidence: number; // 0-1 scale
  reasoning: string;
  details?: Record<string, any>;
  error?: string;
}

/**
 * Conversation quality score interface
 */
export interface ConversationQualityScore {
  overall: number; // 0-100 score
  relevance: number; // 0-100 score
  empathy: number; // 0-100 score
  clarity: number; // 0-100 score
  details?: Record<string, any>;
  timestamp: number;
  error?: string;
}

/**
 * Conversation Intelligence Service
 * 
 * Provides advanced conversation management features:
 * - Conversation memory with in-memory context (last 10 turns)
 * - Dynamic prompt optimization based on customer emotion
 * - Real-time script deviation detection
 * - Predictive next-best-action suggestions
 * - Conversation quality scoring
 */
export class ConversationIntelligenceService {
  private memoryStore: Map<string, ConversationData> = new Map();
  private emotionCache: Map<string, EmotionData> = new Map();
  private qualityScoreCache: Map<string, ConversationQualityScore> = new Map();
  private configService: ConfigurationService;
  private readonly contextWindowSize: number = 10; // Number of turns to keep in context
  private readonly keyPrefix: string = 'conv:';
  private readonly keyExpiry: number = 60 * 60 * 24; // 24 hours in seconds
  
  constructor() {
    this.configService = new ConfigurationService();
    logger.info('ConversationIntelligenceService initialized with in-memory storage');
    // Set up periodic cleanup for expired conversations
    setInterval(this.cleanupExpiredConversations.bind(this), 60 * 60 * 1000); // Run hourly
  }
  
  /**
   * Clean up expired conversations
   */
  private cleanupExpiredConversations(): void {
    const now = Date.now();
    for (const [key, data] of this.memoryStore.entries()) {
      const expiryTime = data.metadata.lastUpdateTime.getTime() + this.keyExpiry * 1000;
      if (now > expiryTime) {
        this.memoryStore.delete(key);
        logger.debug(`Cleaned up expired conversation: ${key}`);
      }
    }
  }
  
  /**
   * Add a conversation turn to the sliding window context
   * @param conversationId Conversation ID
   * @param turn Conversation turn data
   */
  public async addConversationTurn(
    conversationId: string,
    turn: ConversationTurn
  ): Promise<void> {
    try {
      const key = `${this.keyPrefix}${conversationId}`;
      
      // Add timestamp if not provided
      if (!turn.timestamp) {
        turn.timestamp = new Date();
      }
      
      // Get existing data or create new
      let conversationData = this.memoryStore.get(key);
      
      if (!conversationData) {
        // Initialize new conversation data
        conversationData = {
          turns: [],
          metadata: {
            startTime: new Date(),
            lastUpdateTime: new Date(),
            turnCount: 0,
            campaignId: turn.campaignId || '',
            agentId: '',
            leadId: '',
            callId: ''
          }
        };
      }
      
      // Add turn to the array
      conversationData.turns.push(turn);
      
      // Apply sliding window if needed
      if (conversationData.turns.length > this.contextWindowSize) {
        // Keep system messages and the last N-1 non-system messages
        const systemMessages = conversationData.turns.filter(t => t.role === 'system');
        const nonSystemMessages = conversationData.turns
          .filter(t => t.role !== 'system')
          .slice(-(this.contextWindowSize - systemMessages.length));
        
        conversationData.turns = [...systemMessages, ...nonSystemMessages];
      }
      
      // Update metadata
      conversationData.metadata.lastUpdateTime = new Date();
      conversationData.metadata.turnCount++;
      
      // Store in memory
      this.memoryStore.set(key, conversationData);
      
    } catch (error) {
      logger.error(`Error adding conversation turn: ${error.message}`);
    }
  }
  
  /**
   * Get the conversation context (sliding window of recent turns)
   * @param conversationId Conversation ID
   * @returns Array of conversation turns
   */
  public async getConversationContext(
    conversationId: string
  ): Promise<ConversationTurn[]> {
    try {
      const key = `${this.keyPrefix}${conversationId}`;
      const conversationData = this.memoryStore.get(key);
      
      if (!conversationData) {
        return [];
      }
      
      return conversationData.turns;
    } catch (error) {
      logger.error(`Error getting conversation context: ${error.message}`);
      return [];
    }
  }
  
  /**
   * Get emotion-specific prompt modifiers
   * @param emotion Emotion data
   * @returns Emotion prompt modifiers
   */
  private getEmotionPromptModifiers(
    emotion: EmotionData
  ): EmotionPromptModifiers {
    // Default modifiers
    const defaultModifiers: EmotionPromptModifiers = {
      tone: 'professional and helpful',
      pacing: 'moderate',
      empathy: 'appropriate'
    };
    
    // Return default if no emotion data
    if (!emotion) return defaultModifiers;
    
    switch (emotion.emotion.toLowerCase()) {
      case 'angry':
        return {
          tone: 'calm and understanding',
          pacing: 'slow and deliberate',
          empathy: 'high'
        };
      case 'frustrated':
        return {
          tone: 'patient and supportive',
          pacing: 'moderate',
          empathy: 'high'
        };
      case 'anxious':
        return {
          tone: 'reassuring and clear',
          pacing: 'moderate to slow',
          empathy: 'high'
        };
      case 'confused':
        return {
          tone: 'clear and simple',
          pacing: 'slow',
          empathy: 'moderate'
        };
      case 'happy':
        return {
          tone: 'positive and enthusiastic',
          pacing: 'moderate to fast',
          empathy: 'moderate'
        };
      case 'neutral':
      default:
        return defaultModifiers;
    }
  }
  
  /**
   * Optimize prompt based on customer emotion
   * @param conversationId Conversation ID
   * @param basePrompt Base prompt template
   * @param emotion Detected emotion
   * @returns Optimized prompt
   */
  public async optimizePromptForEmotion(
    conversationId: string,
    basePrompt: string,
    emotion: EmotionData
  ): Promise<string> {
    try {
      // Get emotion-specific prompt modifiers
      const emotionModifiers = this.getEmotionPromptModifiers(emotion);
      
      // Replace placeholders in base prompt
      let optimizedPrompt = basePrompt;
      
      // Apply emotion-specific tone
      if (emotionModifiers.tone) {
        optimizedPrompt = optimizedPrompt.replace(
          '{tone}',
          emotionModifiers.tone
        );
      }
      
      // Apply emotion-specific pacing
      if (emotionModifiers.pacing) {
        optimizedPrompt = optimizedPrompt.replace(
          '{pacing}',
          emotionModifiers.pacing
        );
      }
      
      // Apply emotion-specific empathy level
      if (emotionModifiers.empathy) {
        optimizedPrompt = optimizedPrompt.replace(
          '{empathy_level}',
          emotionModifiers.empathy
        );
      }
      
      // Store the emotion data for this conversation
      this.emotionCache.set(`${this.keyPrefix}emotion:${conversationId}`, emotion);
      
      return optimizedPrompt;
    } catch (error) {
      logger.error(`Error optimizing prompt for emotion: ${error.message}`);
      return basePrompt; // Return the original prompt if there's an error
    }
  }
  
  /**
   * Detect script deviation
   * @param conversationId Conversation ID
   * @param currentResponse Current agent response
   * @param scriptTemplate Expected script template
   * @returns Script deviation result
   */
  public async detectScriptDeviation(
    conversationId: string,
    currentResponse: string,
    scriptTemplate: string
  ): Promise<ScriptDeviationResult> {
    try {
      // Simple implementation with basic similarity check
      // In production, this would use more sophisticated NLP techniques
      
      // Convert to lowercase and remove punctuation for comparison
      const normalizedResponse = currentResponse
        .toLowerCase()
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '');
        
      const normalizedTemplate = scriptTemplate
        .toLowerCase()
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, '');
      
      // Calculate word overlap
      const responseWords = new Set(normalizedResponse.split(' '));
      const templateWords = new Set(normalizedTemplate.split(' '));
      
      const commonWords = new Set(
        [...responseWords].filter(word => templateWords.has(word))
      );
      
      const similarity = commonWords.size / templateWords.size;
      
      // Determine deviation level
      let deviationLevel: 'none' | 'minor' | 'significant' | 'complete' | 'unknown';
      
      if (similarity > 0.8) {
        deviationLevel = 'none';
      } else if (similarity > 0.6) {
        deviationLevel = 'minor';
      } else if (similarity > 0.3) {
        deviationLevel = 'significant';
      } else {
        deviationLevel = 'complete';
      }
      
      // Store the result in memory cache
      const key = `${this.keyPrefix}${conversationId}`;
      const conversationData = this.memoryStore.get(key);
      
      if (conversationData) {
        conversationData.metadata.scriptAdherence = similarity;
        this.memoryStore.set(key, conversationData);
      }
      
      return {
        deviationLevel,
        similarity,
        isCompliant: similarity >= 0.6, // Threshold for compliance
        details: {
          commonWords: commonWords.size,
          totalTemplateWords: templateWords.size,
          totalResponseWords: responseWords.size
        }
      };
    } catch (error) {
      logger.error(`Error detecting script deviation: ${error.message}`);
      return {
        deviationLevel: 'unknown',
        similarity: 0,
        isCompliant: false,
        details: {},
        error: error.message
      };
    }
  }
  
  /**
   * Suggest next best action based on conversation context
   * @param conversationId Conversation ID
   * @returns Next best action suggestion
   */
  public async suggestNextBestAction(
    conversationId: string
  ): Promise<NextBestActionSuggestion> {
    try {
      const context = await this.getConversationContext(conversationId);
      
      if (context.length === 0) {
        return {
          action: 'Introduce yourself and the purpose of the call',
          confidence: 0.9,
          reasoning: 'Starting a new conversation'
        };
      }
      
      // Get the last customer message
      const lastCustomerMessage = [...context]
        .reverse()
        .find(turn => turn.role === 'user');
      
      if (!lastCustomerMessage) {
        return {
          action: 'Ask an open-ended question to engage the customer',
          confidence: 0.8,
          reasoning: 'No customer messages found yet'
        };
      }
      
      // Simple rule-based suggestions
      // In production, this would use more sophisticated ML techniques
      const content = lastCustomerMessage.content.toLowerCase();
      
      if (content.includes('price') || content.includes('cost') || content.includes('expensive')) {
        return {
          action: 'Explain the value proposition and ROI of the product/service',
          confidence: 0.85,
          reasoning: 'Customer is price-sensitive'
        };
      } else if (content.includes('competitor') || content.includes('alternative')) {
        return {
          action: 'Highlight unique differentiators from competitors',
          confidence: 0.9,
          reasoning: 'Customer is comparing options'
        };
      } else if (content.includes('think') || content.includes('consider')) {
        return {
          action: 'Address concerns and provide social proof',
          confidence: 0.75,
          reasoning: 'Customer is in consideration phase'
        };
      } else if (content.includes('not interested') || content.includes('no thanks')) {
        return {
          action: 'Acknowledge their position respectfully and ask for feedback',
          confidence: 0.85,
          reasoning: 'Customer is showing resistance'
        };
      }
      
      // Default action
      return {
        action: 'Ask about their specific needs and requirements',
        confidence: 0.7,
        reasoning: 'General engagement to understand customer needs'
      };
    } catch (error) {
      logger.error(`Error suggesting next best action: ${error.message}`);
      return {
        action: 'Continue the conversation naturally',
        confidence: 0.5,
        reasoning: 'Error in analysis',
        error: error.message
      };
    }
  }
  
  /**
   * Score conversation quality
   * @param conversationId Conversation ID
   * @returns Conversation quality score
   */
  public async scoreConversationQuality(
    conversationId: string
  ): Promise<ConversationQualityScore> {
    try {
      const context = await this.getConversationContext(conversationId);
      
      if (context.length < 2) {
        return {
          overall: 50, // Neutral score for insufficient data
          relevance: 50,
          empathy: 50,
          clarity: 50,
          timestamp: Date.now()
        };
      }
      
      // Extract agent responses
      const agentResponses = context.filter(turn => turn.role === 'assistant');
      
      if (agentResponses.length === 0) {
        return {
          overall: 50,
          relevance: 50,
          empathy: 50,
          clarity: 50,
          timestamp: Date.now()
        };
      }
      
      // Simple scoring algorithm
      // In production, this would use more sophisticated NLP/ML
      
      // Analyze for empathy words
      const empathyWords = ['understand', 'appreciate', 'hear', 'feel', 'concern'];
      let empathyScore = 0;
      
      // Analyze for clarity indicators
      const clarityIndicators = ['specifically', 'example', 'mean', 'detail'];
      let clarityScore = 0;
      
      // Analyze relevance by checking for topic consistency
      let relevanceScore = 0;
      
      for (const response of agentResponses) {
        const content = response.content.toLowerCase();
        
        // Empathy score calculation
        empathyScore += empathyWords.reduce((count, word) => 
          count + (content.includes(word) ? 1 : 0), 0);
          
        // Clarity score calculation
        clarityScore += clarityIndicators.reduce((count, word) =>
          count + (content.includes(word) ? 1 : 0), 0);
        
        // Simple relevance heuristic based on response length
        if (content.length > 100) relevanceScore += 1;
      }
      
      // Normalize scores to 0-100 scale
      const normalizedEmpathy = Math.min(100, Math.max(0, (empathyScore / agentResponses.length) * 25));
      const normalizedClarity = Math.min(100, Math.max(0, (clarityScore / agentResponses.length) * 25));
      const normalizedRelevance = Math.min(100, Math.max(0, (relevanceScore / agentResponses.length) * 100));
      
      const overallScore = (normalizedEmpathy + normalizedClarity + normalizedRelevance) / 3;
      
      const result = {
        overall: Math.round(overallScore),
        relevance: Math.round(normalizedRelevance),
        empathy: Math.round(normalizedEmpathy),
        clarity: Math.round(normalizedClarity),
        timestamp: Date.now()
      };
      
      // Store the result in cache
      this.qualityScoreCache.set(`${this.keyPrefix}quality:${conversationId}`, result);
      
      // Update metadata
      const key = `${this.keyPrefix}${conversationId}`;
      const conversationData = this.memoryStore.get(key);
      
      if (conversationData) {
        conversationData.metadata.qualityScore = result.overall;
        this.memoryStore.set(key, conversationData);
      }
      
      return result;
    } catch (error) {
      logger.error(`Error scoring conversation quality: ${error.message}`);
      return {
        overall: 50,
        relevance: 50,
        empathy: 50,
        clarity: 50,
        timestamp: Date.now(),
        error: error.message
      };
    }
  }
  
  /**
   * Get conversation metadata
   * @param conversationId Conversation ID
   * @returns Conversation metadata or null if not found
   */
  public async getConversationMetadata(
    conversationId: string
  ): Promise<Record<string, any> | null> {
    try {
      const key = `${this.keyPrefix}${conversationId}`;
      const conversationData = this.memoryStore.get(key);
      
      if (!conversationData) {
        return null;
      }
      
      return conversationData.metadata;
    } catch (error) {
      logger.error(`Error getting conversation metadata: ${error.message}`);
      return null;
    }
  }
  
  /**
   * Delete a conversation and all associated data
   * @param conversationId Conversation ID
   * @returns Success indicator
   */
  public async deleteConversation(
    conversationId: string
  ): Promise<boolean> {
    try {
      const prefix = this.keyPrefix;
      
      // Delete main conversation data
      this.memoryStore.delete(`${prefix}${conversationId}`);
      
      // Delete any associated caches
      this.emotionCache.delete(`${prefix}emotion:${conversationId}`);
      this.qualityScoreCache.delete(`${prefix}quality:${conversationId}`);
      
      return true;
    } catch (error) {
      logger.error(`Error deleting conversation: ${error.message}`);
      return false;
    }
  }
}

// Export singleton instance
export const conversationIntelligenceService = new ConversationIntelligenceService();
