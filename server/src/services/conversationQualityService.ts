import { logger } from '../index';
import Call from '../models/Call';
import { getConversationMemoryService } from './conversationMemoryService';

/**
 * Conversation quality metrics
 */
export interface ConversationQualityMetrics {
  overallScore: number; // 0-100 scale
  breakdown: {
    customerEngagement: number; // 0-100 scale
    emotionalJourney: number; // 0-100 scale
    scriptAdherence: number; // 0-100 scale
    conversationFlow: number; // 0-100 scale
    objectionHandling: number; // 0-100 scale
    empathyScore: number; // 0-100 scale
    paceScore: number; // 0-100 scale
  };
  flags: {
    excessiveInterruptions: boolean;
    unaddressedConcerns: boolean;
    missedOpportunities: boolean;
    poorEmpathy: boolean;
    scriptDeviations: boolean;
  };
  recommendations: string[];
  keyInsights: string[];
}

/**
 * Service for analyzing and scoring conversation quality in real-time
 */
export class ConversationQualityService {
  /**
   * Score a conversation in real-time
   * @param conversationId - The conversation ID
   * @param callId - The call ID
   */
  public async scoreConversation(
    conversationId: string,
    callId: string
  ): Promise<ConversationQualityMetrics> {
    try {
      // Get conversation from memory service
      const memoryService = getConversationMemoryService();
      const conversation = await memoryService.getConversation(conversationId);
      
      if (!conversation) {
        throw new Error(`Conversation ${conversationId} not found`);
      }
      
      // Get call data from database
      const call = await Call.findById(callId);
      
      if (!call) {
        throw new Error(`Call ${callId} not found`);
      }
      
      // Extract data needed for scoring
      const messages = conversation.messages;
      const customerMessages = messages.filter(msg => msg.role === 'user');
      const assistantMessages = messages.filter(msg => msg.role === 'assistant');
      const emotionalJourney = await memoryService.getEmotionalJourney(conversationId);
      
      // Calculate individual metrics
      const customerEngagement = this.calculateCustomerEngagement(
        customerMessages,
        assistantMessages
      );
      
      const emotionalJourneyScore = this.calculateEmotionalJourneyScore(
        emotionalJourney
      );
      
      const scriptAdherence = call.metrics?.agentPerformance?.scriptAdherence || 0;
      
      const conversationFlow = this.calculateConversationFlow(
        messages,
        call.customerInteraction?.interruptions || []
      );
      
      const objectionHandling = this.calculateObjectionHandling(
        messages,
        conversation.contextualData?.objections || []
      );
      
      const empathyScore = this.calculateEmpathyScore(
        assistantMessages,
        emotionalJourney
      );
      
      const paceScore = this.calculatePaceScore(
        messages,
        call.customerInteraction?.silencePeriods || []
      );
      
      // Calculate overall score (weighted average)
      const weights = {
        customerEngagement: 0.2,
        emotionalJourney: 0.15,
        scriptAdherence: 0.15,
        conversationFlow: 0.2,
        objectionHandling: 0.15,
        empathyScore: 0.1,
        paceScore: 0.05
      };
      
      const overallScore = Math.round(
        customerEngagement * weights.customerEngagement +
        emotionalJourneyScore * weights.emotionalJourney +
        scriptAdherence * weights.scriptAdherence +
        conversationFlow * weights.conversationFlow +
        objectionHandling * weights.objectionHandling +
        empathyScore * weights.empathyScore +
        paceScore * weights.paceScore
      );
      
      // Determine flags
      const flags = {
        excessiveInterruptions: (call.customerInteraction?.interruptions?.length || 0) > 3,
        unaddressedConcerns: this.hasUnaddressedConcerns(messages),
        missedOpportunities: objectionHandling < 60,
        poorEmpathy: empathyScore < 50,
        scriptDeviations: scriptAdherence < 70
      };
      
      // Generate recommendations and insights
      const recommendations = this.generateRecommendations(
        {
          customerEngagement,
          emotionalJourney: emotionalJourneyScore,
          scriptAdherence,
          conversationFlow,
          objectionHandling,
          empathyScore,
          paceScore
        },
        flags
      );
      
      const keyInsights = this.generateKeyInsights(
        messages,
        emotionalJourney,
        call
      );
      
      // Construct and return the metrics
      const qualityMetrics: ConversationQualityMetrics = {
        overallScore,
        breakdown: {
          customerEngagement,
          emotionalJourney: emotionalJourneyScore,
          scriptAdherence,
          conversationFlow,
          objectionHandling,
          empathyScore,
          paceScore
        },
        flags,
        recommendations,
        keyInsights
      };
      
      // Update call metrics in database
      await Call.findByIdAndUpdate(callId, {
        'metrics.qualityScore': overallScore,
        'metrics.conversationMetrics.customerEngagement': customerEngagement,
        'metrics.agentPerformance.objectionHandling': objectionHandling,
        'metrics.agentPerformance.overallScore': overallScore
      });
      
      return qualityMetrics;
    } catch (error) {
      logger.error(`Error scoring conversation: ${error}`);
      // Return default metrics if something goes wrong
      return {
        overallScore: 0,
        breakdown: {
          customerEngagement: 0,
          emotionalJourney: 0,
          scriptAdherence: 0,
          conversationFlow: 0,
          objectionHandling: 0,
          empathyScore: 0,
          paceScore: 0
        },
        flags: {
          excessiveInterruptions: false,
          unaddressedConcerns: false,
          missedOpportunities: false,
          poorEmpathy: false,
          scriptDeviations: false
        },
        recommendations: ['Unable to generate recommendations due to an error'],
        keyInsights: ['Unable to generate insights due to an error']
      };
    }
  }
  
  /**
   * Calculate customer engagement score
   * Based on message length, response time, and emotional indicators
   */
  private calculateCustomerEngagement(
    customerMessages: any[],
    assistantMessages: any[]
  ): number {
    if (customerMessages.length === 0) {
      return 0;
    }
    
    // Average customer message length (longer = more engaged)
    const avgMessageLength = customerMessages.reduce(
      (sum, msg) => sum + msg.content.length,
      0
    ) / customerMessages.length;
    
    // Normalize to 0-100 scale (assuming typical message length 10-200 chars)
    const normalizedLength = Math.min(100, (avgMessageLength / 200) * 100);
    
    // Response rate (percentage of assistant messages that got a response)
    const responseRate = assistantMessages.length > 0
      ? Math.min(100, (customerMessages.length / assistantMessages.length) * 100)
      : 0;
    
    // Weighted score (length indicates depth, response rate indicates consistency)
    return Math.round((normalizedLength * 0.6) + (responseRate * 0.4));
  }
  
  /**
   * Calculate emotional journey score
   * Higher scores for positive emotional progression
   */
  private calculateEmotionalJourneyScore(
    emotionalJourney: Array<{timestamp: Date, emotion: string, confidence: number}>
  ): number {
    if (emotionalJourney.length < 2) {
      return 50; // Neutral score if not enough data
    }
    
    // Define emotional values (-100 to 100 scale)
    const emotionValues: Record<string, number> = {
      'positive': 100,
      'excited': 80,
      'interested': 60,
      'neutral': 0,
      'hesitant': -30,
      'confused': -50,
      'impatient': -70,
      'negative': -100
    };
    
    // Get starting and ending emotions
    const startEmotion = emotionalJourney[0].emotion;
    const endEmotion = emotionalJourney[emotionalJourney.length - 1].emotion;
    
    // Calculate trajectory
    const startValue = emotionValues[startEmotion] || 0;
    const endValue = emotionValues[endEmotion] || 0;
    const trajectory = endValue - startValue;
    
    // Calculate volatility (large swings reduce score)
    let volatility = 0;
    for (let i = 1; i < emotionalJourney.length; i++) {
      const prevEmotion = emotionalJourney[i - 1].emotion;
      const currEmotion = emotionalJourney[i].emotion;
      const change = Math.abs(
        (emotionValues[currEmotion] || 0) - (emotionValues[prevEmotion] || 0)
      );
      volatility += change;
    }
    
    const avgVolatility = volatility / (emotionalJourney.length - 1);
    const normalizedVolatility = Math.min(100, (avgVolatility / 200) * 100);
    
    // Higher trajectory and lower volatility = better score
    const baseScore = 50 + (trajectory / 2);
    const volatilityPenalty = normalizedVolatility * 0.3;
    
    return Math.max(0, Math.min(100, Math.round(baseScore - volatilityPenalty)));
  }
  
  /**
   * Calculate conversation flow score
   * Based on turn-taking rhythm and interruptions
   */
  private calculateConversationFlow(
    messages: any[],
    interruptions: Array<{timestamp: Date, duration: number, interrupter: 'ai' | 'customer'}>
  ): number {
    if (messages.length < 4) {
      return 50; // Not enough messages to calculate
    }
    
    // Base score starts at 100
    let score = 100;
    
    // Deduct for interruptions (especially AI interruptions)
    const customerInterruptions = interruptions.filter(i => i.interrupter === 'customer').length;
    const aiInterruptions = interruptions.filter(i => i.interrupter === 'ai').length;
    
    score -= customerInterruptions * 3; // -3 points per customer interruption
    score -= aiInterruptions * 8; // -8 points per AI interruption (worse)
    
    // Check for balanced conversation (turn-taking)
    const roles = messages.map(m => m.role);
    let consecutiveSameRole = 0;
    
    for (let i = 1; i < roles.length; i++) {
      if (roles[i] === roles[i - 1]) {
        consecutiveSameRole++;
      }
    }
    
    // Deduct for imbalanced conversation
    score -= consecutiveSameRole * 5;
    
    return Math.max(0, Math.min(100, score));
  }
  
  /**
   * Calculate objection handling score
   */
  private calculateObjectionHandling(
    messages: any[],
    objections: string[]
  ): number {
    if (objections.length === 0) {
      return 80; // No objections to handle
    }
    
    // Start with base score
    let score = 50;
    
    // Simple keyword matching for objection handling
    // In a production system, use a more sophisticated NLP approach
    const assistantResponses = messages
      .filter(m => m.role === 'assistant')
      .map(m => m.content.toLowerCase());
    
    const objectionKeywords = objections.map(obj => obj.toLowerCase());
    
    // Check if objections were addressed in responses
    let addressedObjections = 0;
    
    for (const objection of objectionKeywords) {
      // Check if any response addresses this objection
      const addressed = assistantResponses.some(response => 
        response.includes(objection) || 
        // Look for related terms/phrases that indicate addressing the objection
        this.checkObjectionAddressed(response, objection)
      );
      
      if (addressed) {
        addressedObjections++;
      }
    }
    
    // Calculate score based on percentage of objections addressed
    const addressedPercentage = (addressedObjections / objections.length) * 100;
    score = Math.round(50 + (addressedPercentage / 2)); // 50-100 scale
    
    return score;
  }
  
  /**
   * Helper method to check if an objection was addressed
   */
  private checkObjectionAddressed(response: string, objection: string): boolean {
    // Simple keyword matching - expand this with more sophisticated NLP in production
    const objectionKeywords: Record<string, string[]> = {
      'price': ['cost', 'expensive', 'pricing', 'afford', 'budget', 'worth'],
      'time': ['schedule', 'duration', 'deadline', 'timeline', 'when'],
      'quality': ['reliability', 'performance', 'guarantee', 'warranty'],
      'competitor': ['alternative', 'other option', 'different', 'instead'],
      'need': ['necessity', 'requirement', 'essential', 'must have'],
      'trust': ['credibility', 'reputation', 'experience', 'proven']
    };
    
    // Find matching category
    const matchingCategory = Object.keys(objectionKeywords).find(
      category => objection.includes(category)
    );
    
    if (matchingCategory) {
      // Check if response contains any related keywords
      return objectionKeywords[matchingCategory].some(
        keyword => response.includes(keyword)
      );
    }
    
    return false;
  }
  
  /**
   * Calculate empathy score
   */
  private calculateEmpathyScore(
    assistantMessages: any[],
    emotionalJourney: Array<{timestamp: Date, emotion: string, confidence: number}>
  ): number {
    if (assistantMessages.length === 0 || emotionalJourney.length === 0) {
      return 50;
    }
    
    // Count empathetic responses following emotional changes
    let empathyPoints = 0;
    let empathyOpportunities = 0;
    
    // Empathy keywords by emotion
    const empathyKeywords: Record<string, string[]> = {
      'negative': ['understand', 'sorry', 'apologize', 'difficult', 'challenging', 'frustrating'],
      'confused': ['clarify', 'explain', 'simpler', 'understand', 'confused', 'clear'],
      'hesitant': ['reassure', 'guarantee', 'ensure', 'comfortable', 'confidence'],
      'impatient': ['quickly', 'directly', 'briefly', 'immediately', 'main point'],
      'excited': ['wonderful', 'excellent', 'great', 'fantastic', 'exciting'],
      'interested': ['tell you more', 'interesting', 'details', 'information', 'learn']
    };
    
    // Check each emotional moment for empathetic response
    for (let i = 0; i < emotionalJourney.length; i++) {
      const emotion = emotionalJourney[i].emotion;
      if (emotion === 'neutral' || emotion === 'positive') continue;
      
      empathyOpportunities++;
      
      // Find the next assistant message after this emotion
      const emotionTime = emotionalJourney[i].timestamp;
      const nextMessage = assistantMessages.find(msg => 
        msg.timestamp > emotionTime
      );
      
      if (nextMessage) {
        // Check if the message contains empathetic language
        const keywords = empathyKeywords[emotion] || [];
        const isEmpathetic = keywords.some(keyword => 
          nextMessage.content.toLowerCase().includes(keyword)
        );
        
        if (isEmpathetic) {
          empathyPoints++;
        }
      }
    }
    
    // Calculate score (default to 70 if no opportunities)
    return empathyOpportunities > 0
      ? Math.round((empathyPoints / empathyOpportunities) * 100)
      : 70;
  }
  
  /**
   * Calculate pace score
   */
  private calculatePaceScore(
    messages: any[],
    silencePeriods: Array<{timestamp: Date, duration: number}>
  ): number {
    if (messages.length < 3) {
      return 50;
    }
    
    // Ideal average message length (100-150 chars)
    const avgMessageLength = messages.reduce(
      (sum, msg) => sum + msg.content.length,
      0
    ) / messages.length;
    
    // Penalize for very short or very long messages
    const lengthScore = avgMessageLength < 20
      ? 50 // Too short
      : avgMessageLength > 300
        ? 60 // Too long
        : 90; // Good length
    
    // Analyze silence periods
    const avgSilenceDuration = silencePeriods.length > 0
      ? silencePeriods.reduce((sum, s) => sum + s.duration, 0) / silencePeriods.length
      : 0;
    
    // Optimal silence is 1-3 seconds, penalize for longer silences
    const silenceScore = avgSilenceDuration === 0
      ? 80 // No silences tracked
      : avgSilenceDuration < 1000
        ? 70 // Too quick
        : avgSilenceDuration > 5000
          ? 60 // Too slow
          : 90; // Good pace
    
    // Combined score
    return Math.round((lengthScore * 0.7) + (silenceScore * 0.3));
  }
  
  /**
   * Check for unaddressed concerns in the conversation
   */
  private hasUnaddressedConcerns(messages: any[]): boolean {
    // Get customer messages
    const customerMessages = messages.filter(m => m.role === 'user');
    
    // Keywords that might indicate concerns
    const concernKeywords = [
      'worried', 'concern', 'issue', 'problem', 'trouble',
      'not sure', 'confused', 'don\'t understand', 'unsure',
      'question', 'how do I', 'what about', 'but what if'
    ];
    
    // Check last 3 customer messages for concerns
    const recentMessages = customerMessages.slice(-3);
    
    for (const msg of recentMessages) {
      const content = msg.content.toLowerCase();
      
      // Check if message contains concern keywords
      const hasConcern = concernKeywords.some(keyword => 
        content.includes(keyword)
      );
      
      if (hasConcern) {
        // Check if any subsequent assistant message addresses it
        const msgTime = msg.timestamp;
        const hasResponse = messages.some(m => 
          m.role === 'assistant' && 
          m.timestamp > msgTime &&
          m.content.length > 50 // Substantive response
        );
        
        if (!hasResponse) {
          return true; // Unaddressed concern found
        }
      }
    }
    
    return false;
  }
  
  /**
   * Generate recommendations based on metrics and flags
   */
  private generateRecommendations(
    metrics: ConversationQualityMetrics['breakdown'],
    flags: ConversationQualityMetrics['flags']
  ): string[] {
    const recommendations: string[] = [];
    
    // Add recommendations based on scores
    if (metrics.customerEngagement < 60) {
      recommendations.push(
        'Improve customer engagement by asking more open-ended questions and acknowledging customer inputs.'
      );
    }
    
    if (metrics.emotionalJourney < 50) {
      recommendations.push(
        'Focus on improving emotional trajectory by addressing negative emotions with empathy and building rapport.'
      );
    }
    
    if (metrics.scriptAdherence < 70) {
      recommendations.push(
        'Improve script adherence while maintaining natural conversation flow. Key script points are being missed.'
      );
    }
    
    if (metrics.conversationFlow < 60) {
      recommendations.push(
        'Improve conversation flow by reducing interruptions and allowing appropriate response time.'
      );
    }
    
    if (metrics.objectionHandling < 60) {
      recommendations.push(
        'Enhance objection handling by directly addressing customer concerns with specific solutions.'
      );
    }
    
    if (metrics.empathyScore < 50) {
      recommendations.push(
        'Increase empathetic responses by acknowledging customer emotions and demonstrating understanding.'
      );
    }
    
    if (metrics.paceScore < 60) {
      recommendations.push(
        'Adjust conversation pace to match customer rhythm - current pace may be too fast or too slow.'
      );
    }
    
    // Add recommendations based on flags
    if (flags.excessiveInterruptions) {
      recommendations.push(
        'Reduce interruptions to allow customer to complete their thoughts.'
      );
    }
    
    if (flags.unaddressedConcerns) {
      recommendations.push(
        'Address all customer concerns directly - some key concerns are being overlooked.'
      );
    }
    
    if (flags.missedOpportunities) {
      recommendations.push(
        'Look for opportunities to provide value and address implicit needs in customer messages.'
      );
    }
    
    return recommendations;
  }
  
  /**
   * Generate key insights from the conversation
   */
  private generateKeyInsights(
    messages: any[],
    emotionalJourney: Array<{timestamp: Date, emotion: string, confidence: number}>,
    call: any
  ): string[] {
    const insights: string[] = [];
    
    // Add insight about call outcome if available
    if (call.outcome) {
      insights.push(`Call outcome: ${call.outcome}`);
    }
    
    // Add insight about emotional journey
    if (emotionalJourney.length > 0) {
      const startEmotion = emotionalJourney[0].emotion;
      const endEmotion = emotionalJourney[emotionalJourney.length - 1].emotion;
      
      insights.push(`Customer emotion shifted from ${startEmotion} to ${endEmotion} during the conversation.`);
    }
    
    // Add insight about conversation balance
    const customerMessages = messages.filter(m => m.role === 'user');
    const assistantMessages = messages.filter(m => m.role === 'assistant');
    
    const customerWords = customerMessages.reduce(
      (sum, msg) => sum + msg.content.split(' ').length,
      0
    );
    
    const assistantWords = assistantMessages.reduce(
      (sum, msg) => sum + msg.content.split(' ').length,
      0
    );
    
    const wordRatio = customerWords > 0
      ? (assistantWords / customerWords).toFixed(1)
      : '0';
    
    insights.push(`AI to customer word ratio: ${wordRatio}:1`);
    
    // Add insight about interruptions if any
    if (call.customerInteraction?.interruptions?.length > 0) {
      const aiInterruptions = call.customerInteraction.interruptions.filter(
        (i: any) => i.interrupter === 'ai'
      ).length;
      
      const customerInterruptions = call.customerInteraction.interruptions.filter(
        (i: any) => i.interrupter === 'customer'
      ).length;
      
      insights.push(`Interruptions: ${aiInterruptions} by AI, ${customerInterruptions} by customer`);
    }
    
    return insights;
  }
}

// Singleton instance
let qualityService: ConversationQualityService | null = null;

export const getConversationQualityService = (): ConversationQualityService => {
  if (!qualityService) {
    qualityService = new ConversationQualityService();
  }
  return qualityService;
};

export const initializeConversationQualityService = (): ConversationQualityService => {
  qualityService = new ConversationQualityService();
  return qualityService;
};
