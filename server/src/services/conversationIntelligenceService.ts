import Redis from 'ioredis';
import logger from '../utils/logger';
import { ConfigurationService } from './configurationService';

/**
 * Conversation Intelligence Service
 * 
 * Provides advanced conversation management features:
 * - Conversation memory with Redis-backed context (last 10 turns)
 * - Dynamic prompt optimization based on customer emotion
 * - Real-time script deviation detection
 * - Predictive next-best-action suggestions
 * - Conversation quality scoring
 */
export class ConversationIntelligenceService {
  private redis: Redis;
  private configService: ConfigurationService;
  private readonly contextWindowSize: number = 10; // Number of turns to keep in context
  private readonly keyPrefix: string = 'conv:';
  private readonly keyExpiry: number = 60 * 60 * 24; // 24 hours
  
  constructor() {
    this.configService = new ConfigurationService();
    this.initialize();
  }
  
  /**
   * Initialize Redis connection
   */
  private async initialize(): Promise<void> {
    try {
      const config = await this.configService.getConfiguration();
      const redisConfig = config?.redisConfig || {};
      
      this.redis = new Redis({
        host: redisConfig.host || 'localhost',
        port: redisConfig.port || 6379,
        password: redisConfig.password,
        db: redisConfig.db || 0,
        keyPrefix: this.keyPrefix,
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        }
      });
      
      this.redis.on('error', (err) => {
        logger.error(`Redis connection error: ${err.message}`);
      });
      
      logger.info('Conversation Intelligence Service initialized');
    } catch (error) {
      logger.error(`Failed to initialize Conversation Intelligence: ${error.message}`);
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
      const key = `context:${conversationId}`;
      
      // Add timestamp if not provided
      if (!turn.timestamp) {
        turn.timestamp = Date.now();
      }
      
      // Serialize turn to JSON
      const serializedTurn = JSON.stringify(turn);
      
      // Add to the end of the list
      await this.redis.rpush(key, serializedTurn);
      
      // Trim list to maintain sliding window
      await this.redis.ltrim(key, -this.contextWindowSize, -1);
      
      // Set expiry
      await this.redis.expire(key, this.keyExpiry);
      
      // Store metadata for this conversation if it's new
      if (!await this.redis.exists(`meta:${conversationId}`)) {
        await this.redis.hset(`meta:${conversationId}`, {
          startTime: Date.now(),
          turnCount: 1,
          campaignId: turn.campaignId || '',
          userId: turn.userId || ''
        });
        await this.redis.expire(`meta:${conversationId}`, this.keyExpiry);
      } else {
        // Increment turn count
        await this.redis.hincrby(`meta:${conversationId}`, 'turnCount', 1);
      }
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
      const key = `context:${conversationId}`;
      
      // Get all turns in the list
      const turns = await this.redis.lrange(key, 0, -1);
      
      // Parse JSON
      return turns.map(turn => JSON.parse(turn));
    } catch (error) {
      logger.error(`Error getting conversation context: ${error.message}`);
      return [];
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
      const emotionModifiers = await this.getEmotionPromptModifiers(emotion);
      
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
      
      return optimizedPrompt;
    } catch (error) {
      logger.error(`Error optimizing prompt: ${error.message}`);
      return basePrompt;
    }
  }
  
  /**
   * Get prompt modifiers based on detected emotion
   * @param emotion Detected emotion
   * @returns Emotion-specific prompt modifiers
   */
  private async getEmotionPromptModifiers(
    emotion: EmotionData
  ): Promise<EmotionPromptModifiers> {
    // Default modifiers
    const defaultModifiers: EmotionPromptModifiers = {
      tone: 'neutral and professional',
      pacing: 'moderate',
      empathy: 'moderate'
    };
    
    // Return default modifiers if no emotion data
    if (!emotion) return defaultModifiers;
    
    // Determine modifiers based on emotion
    switch (emotion.primary.toLowerCase()) {
      case 'angry':
      case 'frustrated':
        return {
          tone: 'calm and understanding',
          pacing: 'slow and deliberate',
          empathy: 'high'
        };
        
      case 'happy':
      case 'excited':
        return {
          tone: 'upbeat and enthusiastic',
          pacing: 'moderate to quick',
          empathy: 'moderate'
        };
        
      case 'sad':
      case 'disappointed':
        return {
          tone: 'warm and supportive',
          pacing: 'gentle and patient',
          empathy: 'very high'
        };
        
      case 'confused':
      case 'uncertain':
        return {
          tone: 'clear and helpful',
          pacing: 'slow and methodical',
          empathy: 'moderate'
        };
        
      case 'neutral':
      default:
        return defaultModifiers;
    }
  }
  
  /**
   * Detect script deviation based on conversation context
   * @param conversationId Conversation ID
   * @param currentResponse Current AI response
   * @param scriptTemplate Expected script template
   * @returns Deviation analysis
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
      let deviationLevel: 'none' | 'minor' | 'significant' | 'complete';
      
      if (similarity > 0.8) {
        deviationLevel = 'none';
      } else if (similarity > 0.5) {
        deviationLevel = 'minor';
      } else if (similarity > 0.2) {
        deviationLevel = 'significant';
      } else {
        deviationLevel = 'complete';
      }
      
      return {
        deviationLevel,
        similarity,
        isCompliant: similarity > 0.5,
        details: {
          commonWords: commonWords.size,
          templateWords: templateWords.size,
          responseWords: responseWords.size
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
   * Get next-best-action suggestion based on conversation context
   * @param conversationId Conversation ID
   * @returns Next-best-action suggestion
   */
  public async getNextBestAction(
    conversationId: string
  ): Promise<NextBestActionSuggestion> {
    try {
      // Get conversation context
      const context = await this.getConversationContext(conversationId);
      
      // Get conversation metadata
      const metadata = await this.redis.hgetall(`meta:${conversationId}`);
      
      // In a real implementation, this would use a trained model
      // For now, use simple rule-based logic
      
      // Default suggestion
      const defaultSuggestion: NextBestActionSuggestion = {
        action: 'continue',
        confidence: 0.5,
        reasoning: 'Continuing with standard conversation flow'
      };
      
      // If no context, return default
      if (!context.length) return defaultSuggestion;
      
      // Get last turn
      const lastTurn = context[context.length - 1];
      
      // Check for escalation keywords in user message
      if (lastTurn.role === 'user' && lastTurn.content) {
        const escalationKeywords = [
          'manager', 'supervisor', 'escalate', 'unhappy', 'complaint', 
          'frustrated', 'angry', 'cancel', 'refund', 'speak to a human'
        ];
        
        const hasEscalationKeywords = escalationKeywords.some(
          keyword => lastTurn.content.toLowerCase().includes(keyword)
        );
        
        if (hasEscalationKeywords) {
          return {
            action: 'escalate',
            confidence: 0.8,
            reasoning: 'User mentioned escalation keywords',
            details: {
              urgency: 'high'
            }
          };
        }
      }
      
      // Check for potential sale opportunity
      if (context.some(turn => {
        return turn.role === 'user' && turn.content && 
          (turn.content.toLowerCase().includes('interested') || 
           turn.content.toLowerCase().includes('how much') ||
           turn.content.toLowerCase().includes('pricing'));
      })) {
        return {
          action: 'offer_promotion',
          confidence: 0.7,
          reasoning: 'User showed interest in pricing or offers',
          details: {
            promotionType: 'discount'
          }
        };
      }
      
      // Check for confusion
      const confusionKeywords = [
        'don\'t understand', 'confused', 'what do you mean', 
        'unclear', 'explain', 'what is', 'how does'
      ];
      
      if (lastTurn.role === 'user' && lastTurn.content &&
          confusionKeywords.some(keyword => 
            lastTurn.content.toLowerCase().includes(keyword)
          )) {
        return {
          action: 'clarify',
          confidence: 0.6,
          reasoning: 'User appears confused or seeking clarification',
          details: {
            suggestedApproach: 'simplified explanation'
          }
        };
      }
      
      return defaultSuggestion;
    } catch (error) {
      logger.error(`Error getting next best action: ${error.message}`);
      return {
        action: 'continue',
        confidence: 0.5,
        reasoning: 'Error occurred, continuing with default flow',
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
      // Get conversation context
      const context = await this.getConversationContext(conversationId);
      
      // Default score
      const defaultScore: ConversationQualityScore = {
        overall: 50,
        relevance: 50,
        empathy: 50,
        clarity: 50,
        timestamp: Date.now()
      };
      
      // If no context, return default
      if (!context.length) return defaultScore;
      
      // In a real implementation, this would use a trained model
      // For now, use simple heuristics
      
      // Calculate relevance score
      const relevanceScore = this.calculateRelevanceScore(context);
      
      // Calculate empathy score
      const empathyScore = this.calculateEmpathyScore(context);
      
      // Calculate clarity score
      const clarityScore = this.calculateClarityScore(context);
      
      // Calculate overall score (weighted average)
      const overall = Math.round(
        (relevanceScore * 0.4) + (empathyScore * 0.3) + (clarityScore * 0.3)
      );
      
      const score: ConversationQualityScore = {
        overall,
        relevance: relevanceScore,
        empathy: empathyScore,
        clarity: clarityScore,
        timestamp: Date.now()
      };
      
      // Store score in Redis
      await this.redis.hset(
        `quality:${conversationId}`,
        score
      );
      
      return score;
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
   * Calculate relevance score based on conversation context
   * @param context Conversation context
   * @returns Relevance score (0-100)
   */
  private calculateRelevanceScore(context: ConversationTurn[]): number {
    // Simple implementation
    // Count turns where AI addresses user's previous message
    
    let relevantResponses = 0;
    let totalAssistantResponses = 0;
    
    for (let i = 1; i < context.length; i++) {
      const turn = context[i];
      const prevTurn = context[i - 1];
      
      if (turn.role === 'assistant' && prevTurn.role === 'user') {
        totalAssistantResponses++;
        
        // Check if assistant response contains words from user's message
        // This is a very simple heuristic - in production, use NLP techniques
        if (prevTurn.content && turn.content) {
          const userWords = new Set(
            prevTurn.content.toLowerCase().split(' ')
              .filter(word => word.length > 3) // Filter out short words
          );
          
          const assistantContent = turn.content.toLowerCase();
          const hasRelevantWords = Array.from(userWords)
            .some(word => assistantContent.includes(word));
          
          if (hasRelevantWords) {
            relevantResponses++;
          }
        }
      }
    }
    
    // Calculate percentage
    return totalAssistantResponses > 0
      ? Math.round((relevantResponses / totalAssistantResponses) * 100)
      : 50; // Default if no assistant responses
  }
  
  /**
   * Calculate empathy score based on conversation context
   * @param context Conversation context
   * @returns Empathy score (0-100)
   */
  private calculateEmpathyScore(context: ConversationTurn[]): number {
    // Simple implementation
    // Check for empathetic language in assistant responses
    
    const empathyKeywords = [
      'understand', 'sorry', 'appreciate', 'thank you', 'feel', 
      'concern', 'help', 'support', 'assist', 'important'
    ];
    
    let empathyPoints = 0;
    let totalAssistantResponses = 0;
    
    for (const turn of context) {
      if (turn.role === 'assistant' && turn.content) {
        totalAssistantResponses++;
        
        const content = turn.content.toLowerCase();
        
        // Count empathy keywords
        let keywordsFound = 0;
        for (const keyword of empathyKeywords) {
          if (content.includes(keyword)) {
            keywordsFound++;
          }
        }
        
        // Award points based on keywords found
        // More keywords = higher empathy
        empathyPoints += Math.min(keywordsFound * 10, 100);
      }
    }
    
    // Calculate average
    return totalAssistantResponses > 0
      ? Math.round(empathyPoints / totalAssistantResponses)
      : 50; // Default if no assistant responses
  }
  
  /**
   * Calculate clarity score based on conversation context
   * @param context Conversation context
   * @returns Clarity score (0-100)
   */
  private calculateClarityScore(context: ConversationTurn[]): number {
    // Simple implementation
    // Check for clarity indicators in assistant responses
    
    let clarityPoints = 0;
    let totalAssistantResponses = 0;
    
    for (const turn of context) {
      if (turn.role === 'assistant' && turn.content) {
        totalAssistantResponses++;
        
        const content = turn.content;
        
        // Longer responses may be less clear (up to a point)
        const lengthScore = Math.min(100, Math.max(0, 
          100 - Math.abs(content.length - 200) / 10
        ));
        
        // Sentences that are too long may be less clear
        const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
        const avgSentenceLength = sentences.reduce(
          (sum, s) => sum + s.length, 0
        ) / (sentences.length || 1);
        
        const sentenceLengthScore = Math.min(100, Math.max(0,
          100 - Math.abs(avgSentenceLength - 15) * 2
        ));
        
        // Presence of bullet points or numbered lists improves clarity
        const hasBulletPoints = content.includes('•') || 
          /\n[\s]*[*\-]\s/.test(content);
        const hasNumberedList = /\n[\s]*\d+\.?\s/.test(content);
        
        const structureScore = (hasBulletPoints || hasNumberedList) ? 100 : 70;
        
        // Average the scores
        clarityPoints += (lengthScore + sentenceLengthScore + structureScore) / 3;
      }
    }
    
    // Calculate average
    return totalAssistantResponses > 0
      ? Math.round(clarityPoints / totalAssistantResponses)
      : 50; // Default if no assistant responses
  }
}

/**
 * Conversation turn interface
 */
export interface ConversationTurn {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
  campaignId?: string;
  userId?: string;
  metadata?: Record<string, any>;
}

/**
 * Emotion data interface
 */
export interface EmotionData {
  primary: string;
  secondary?: string;
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

// Export singleton instance
export const conversationIntelligenceService = new ConversationIntelligenceService();
