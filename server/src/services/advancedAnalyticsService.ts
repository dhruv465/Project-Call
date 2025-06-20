import mongoose from 'mongoose';
import { ConfigurationService } from './configurationService';
import logger from '../utils/logger';

/**
 * Advanced Analytics Service
 * 
 * Provides predictive analytics and insights:
 * - Call outcome prediction
 * - Optimal calling time analysis
 * - Agent performance benchmarking
 * - Conversation pattern analysis
 * - ROI calculator with cost breakdown
 */
export class AdvancedAnalyticsService {
  private configService: ConfigurationService;
  
  // Models (would be defined in MongoDB models directory)
  private Call: any;
  private Lead: any;
  private Campaign: any;
  private Agent: any;
  private Analytics: any;
  
  constructor() {
    this.configService = new ConfigurationService();
    this.initialize();
  }
  
  /**
   * Initialize models
   */
  private async initialize(): Promise<void> {
    try {
      // Get model references
      this.Call = mongoose.model('Call');
      this.Lead = mongoose.model('Lead');
      this.Campaign = mongoose.model('Campaign');
      this.Agent = mongoose.model('Agent');
      this.Analytics = mongoose.model('Analytics');
      
      logger.info('Advanced Analytics Service initialized');
    } catch (error) {
      logger.error(`Failed to initialize Advanced Analytics: ${error.message}`);
    }
  }
  
  /**
   * Predict call outcome based on historical data and current patterns
   * @param callId Call ID
   * @returns Predicted outcome
   */
  public async predictCallOutcome(callId: string): Promise<CallOutcomePrediction> {
    try {
      // Get call data
      const call = await this.Call.findById(callId).lean();
      
      if (!call) {
        throw new Error(`Call ${callId} not found`);
      }
      
      // In a real implementation, this would use a trained ML model
      // For now, use simple rule-based logic based on call metrics
      
      // Default prediction
      const defaultPrediction: CallOutcomePrediction = {
        predictedOutcome: 'neutral',
        confidence: 0.5,
        timestamp: Date.now()
      };
      
      // If call is already completed, return actual outcome
      if (call.status === 'completed' && call.outcome) {
        return {
          predictedOutcome: call.outcome,
          confidence: 1.0,
          isActual: true,
          timestamp: Date.now()
        };
      }
      
      // Analyze call metrics
      const callMetrics = call.metrics || {};
      const emotions = call.emotions || [];
      const latestEmotion = emotions.length > 0 ? emotions[emotions.length - 1] : null;
      
      // Analyze call duration
      const durationMinutes = (call.duration || 0) / 60;
      
      // Longer calls tend to be more successful
      let outcomeScore = 0;
      
      if (durationMinutes > 5) {
        outcomeScore += 20;
      } else if (durationMinutes > 3) {
        outcomeScore += 10;
      }
      
      // Analyze interruptions
      const interruptions = callMetrics.interruptions || 0;
      
      if (interruptions > 5) {
        outcomeScore -= 20;
      } else if (interruptions > 2) {
        outcomeScore -= 10;
      }
      
      // Analyze latest emotion
      if (latestEmotion) {
        if (['happy', 'satisfied', 'interested'].includes(latestEmotion.primary)) {
          outcomeScore += 20;
        } else if (['angry', 'frustrated', 'annoyed'].includes(latestEmotion.primary)) {
          outcomeScore -= 20;
        }
      }
      
      // Analyze quality score
      const qualityScore = callMetrics.qualityScore || 0;
      
      if (qualityScore > 80) {
        outcomeScore += 20;
      } else if (qualityScore > 60) {
        outcomeScore += 10;
      } else if (qualityScore < 40) {
        outcomeScore -= 10;
      }
      
      // Determine predicted outcome
      let predictedOutcome = 'neutral';
      let confidence = 0.5;
      
      if (outcomeScore > 30) {
        predictedOutcome = 'positive';
        confidence = 0.7 + (Math.min(outcomeScore, 50) - 30) / 100;
      } else if (outcomeScore < -30) {
        predictedOutcome = 'negative';
        confidence = 0.7 + (Math.min(Math.abs(outcomeScore), 50) - 30) / 100;
      }
      
      return {
        predictedOutcome,
        confidence,
        factors: {
          duration: durationMinutes,
          interruptions,
          latestEmotion: latestEmotion?.primary || 'unknown',
          qualityScore
        },
        timestamp: Date.now()
      };
    } catch (error) {
      logger.error(`Error predicting call outcome: ${error.message}`);
      return {
        predictedOutcome: 'unknown',
        confidence: 0,
        error: error.message,
        timestamp: Date.now()
      };
    }
  }
  
  /**
   * Analyze optimal calling times based on historical data
   * @param campaignId Campaign ID (optional)
   * @returns Optimal calling time analysis
   */
  public async analyzeOptimalCallingTimes(campaignId?: string): Promise<OptimalTimeAnalysis> {
    try {
      // Build query
      const query: any = { status: 'completed' };
      
      if (campaignId) {
        query.campaignId = campaignId;
      }
      
      // Get completed calls
      const calls = await this.Call.find(query).lean();
      
      if (calls.length === 0) {
        return {
          bestTimes: [],
          worstTimes: [],
          sampleSize: 0,
          timestamp: Date.now()
        };
      }
      
      // Group calls by hour of day
      const hourlyStats: Record<number, { 
        total: number; 
        positive: number;
        avgDuration: number;
      }> = {};
      
      // Initialize hourly stats
      for (let i = 0; i < 24; i++) {
        hourlyStats[i] = { total: 0, positive: 0, avgDuration: 0 };
      }
      
      // Process calls
      for (const call of calls) {
        if (!call.startTime) continue;
        
        const startTime = new Date(call.startTime);
        const hour = startTime.getHours();
        
        hourlyStats[hour].total++;
        
        if (call.outcome === 'positive') {
          hourlyStats[hour].positive++;
        }
        
        // Update average duration
        const currentTotal = hourlyStats[hour].avgDuration * (hourlyStats[hour].total - 1);
        hourlyStats[hour].avgDuration = (currentTotal + (call.duration || 0)) / hourlyStats[hour].total;
      }
      
      // Calculate success rate for each hour
      const hourlyRates = Object.entries(hourlyStats).map(([hour, stats]) => {
        const successRate = stats.total > 0 ? stats.positive / stats.total : 0;
        
        return {
          hour: parseInt(hour),
          successRate,
          callCount: stats.total,
          avgDuration: stats.avgDuration
        };
      });
      
      // Sort by success rate
      hourlyRates.sort((a, b) => b.successRate - a.successRate);
      
      // Get best and worst times
      const bestTimes = hourlyRates
        .filter(hr => hr.callCount >= 5) // Minimum sample size
        .slice(0, 3)
        .map(hr => ({
          hour: hr.hour,
          successRate: hr.successRate,
          callCount: hr.callCount,
          avgDuration: hr.avgDuration
        }));
      
      const worstTimes = [...hourlyRates]
        .filter(hr => hr.callCount >= 5) // Minimum sample size
        .sort((a, b) => a.successRate - b.successRate)
        .slice(0, 3)
        .map(hr => ({
          hour: hr.hour,
          successRate: hr.successRate,
          callCount: hr.callCount,
          avgDuration: hr.avgDuration
        }));
      
      return {
        bestTimes,
        worstTimes,
        sampleSize: calls.length,
        timestamp: Date.now()
      };
    } catch (error) {
      logger.error(`Error analyzing optimal calling times: ${error.message}`);
      return {
        bestTimes: [],
        worstTimes: [],
        sampleSize: 0,
        error: error.message,
        timestamp: Date.now()
      };
    }
  }
  
  /**
   * Benchmark agent performance against system average
   * @param agentId Agent ID
   * @returns Performance benchmark
   */
  public async benchmarkAgentPerformance(agentId: string): Promise<AgentPerformanceBenchmark> {
    try {
      // Get agent data
      const agent = await this.Agent.findById(agentId).lean();
      
      if (!agent) {
        throw new Error(`Agent ${agentId} not found`);
      }
      
      // Get agent's calls
      const agentCalls = await this.Call.find({
        agentId,
        status: 'completed'
      }).lean();
      
      // Get system-wide calls for comparison
      const systemCalls = await this.Call.find({
        status: 'completed'
      }).lean();
      
      // If no calls, return empty benchmark
      if (agentCalls.length === 0 || systemCalls.length === 0) {
        return {
          agentId,
          agentName: agent.name || 'Unknown',
          metrics: {},
          systemAverage: {},
          sampleSize: {
            agent: 0,
            system: systemCalls.length
          },
          timestamp: Date.now()
        };
      }
      
      // Calculate agent metrics
      const agentMetrics = this.calculatePerformanceMetrics(agentCalls);
      
      // Calculate system average
      const systemMetrics = this.calculatePerformanceMetrics(systemCalls);
      
      // Calculate percentile ranks
      const percentileRanks: Record<string, number> = {};
      
      for (const [key, value] of Object.entries(agentMetrics)) {
        if (typeof value === 'number' && systemMetrics[key] !== undefined) {
          // Positive metrics (higher is better)
          const positiveMetrics = [
            'successRate', 'avgQualityScore', 'callsPerDay'
          ];
          
          // Negative metrics (lower is better)
          const negativeMetrics = [
            'avgLatency', 'avgInterruptions'
          ];
          
          if (positiveMetrics.includes(key)) {
            // Calculate percentile for positive metrics
            percentileRanks[key] = this.calculatePercentileRank(value, key, systemCalls);
          } else if (negativeMetrics.includes(key)) {
            // Calculate percentile for negative metrics (invert for consistency)
            percentileRanks[key] = 100 - this.calculatePercentileRank(value, key, systemCalls);
          }
        }
      }
      
      return {
        agentId,
        agentName: agent.name || 'Unknown',
        metrics: agentMetrics,
        systemAverage: systemMetrics,
        percentileRanks,
        sampleSize: {
          agent: agentCalls.length,
          system: systemCalls.length
        },
        timestamp: Date.now()
      };
    } catch (error) {
      logger.error(`Error benchmarking agent performance: ${error.message}`);
      return {
        agentId,
        agentName: 'Unknown',
        metrics: {},
        systemAverage: {},
        sampleSize: {
          agent: 0,
          system: 0
        },
        error: error.message,
        timestamp: Date.now()
      };
    }
  }
  
  /**
   * Analyze conversation patterns for insight
   * @param campaignId Campaign ID (optional)
   * @returns Conversation pattern analysis
   */
  public async analyzeConversationPatterns(campaignId?: string): Promise<ConversationPatternAnalysis> {
    try {
      // Build query
      const query: any = { status: 'completed' };
      
      if (campaignId) {
        query.campaignId = campaignId;
      }
      
      // Get completed calls with transcripts
      const calls = await this.Call.find(query)
        .select('transcript outcome duration metrics')
        .lean();
      
      if (calls.length === 0) {
        return {
          commonPhrases: [],
          outcomeCorrelations: [],
          sampleSize: 0,
          timestamp: Date.now()
        };
      }
      
      // Extract transcripts
      const transcripts = calls
        .filter(call => call.transcript && call.transcript.length > 0)
        .map(call => ({
          transcript: call.transcript,
          outcome: call.outcome,
          duration: call.duration,
          metrics: call.metrics
        }));
      
      // If no transcripts, return empty analysis
      if (transcripts.length === 0) {
        return {
          commonPhrases: [],
          outcomeCorrelations: [],
          sampleSize: 0,
          timestamp: Date.now()
        };
      }
      
      // Analyze common phrases
      const commonPhrases = this.analyzeCommonPhrases(transcripts);
      
      // Analyze outcome correlations
      const outcomeCorrelations = this.analyzeOutcomeCorrelations(transcripts);
      
      return {
        commonPhrases,
        outcomeCorrelations,
        sampleSize: transcripts.length,
        timestamp: Date.now()
      };
    } catch (error) {
      logger.error(`Error analyzing conversation patterns: ${error.message}`);
      return {
        commonPhrases: [],
        outcomeCorrelations: [],
        sampleSize: 0,
        error: error.message,
        timestamp: Date.now()
      };
    }
  }
  
  /**
   * Calculate ROI for a campaign
   * @param campaignId Campaign ID
   * @returns ROI analysis
   */
  public async calculateROI(campaignId: string): Promise<ROIAnalysis> {
    try {
      // Get campaign data
      const campaign = await this.Campaign.findById(campaignId).lean();
      
      if (!campaign) {
        throw new Error(`Campaign ${campaignId} not found`);
      }
      
      // Get campaign calls
      const calls = await this.Call.find({
        campaignId,
        status: 'completed'
      }).lean();
      
      // Get conversion data
      const conversions = await this.Analytics.find({
        campaignId,
        type: 'conversion'
      }).lean();
      
      // Calculate costs
      const aiCosts = this.calculateAICosts(calls);
      const infrastructureCosts = campaign.costs?.infrastructure || 0;
      const setupCosts = campaign.costs?.setup || 0;
      const totalCosts = aiCosts + infrastructureCosts + setupCosts;
      
      // Calculate revenue
      const totalRevenue = conversions.reduce((sum, conv) => sum + (conv.value || 0), 0);
      
      // Calculate ROI
      const roi = totalCosts > 0 ? ((totalRevenue - totalCosts) / totalCosts) * 100 : 0;
      
      // Calculate cost per call
      const costPerCall = calls.length > 0 ? totalCosts / calls.length : 0;
      
      // Calculate cost per conversion
      const costPerConversion = conversions.length > 0 ? totalCosts / conversions.length : 0;
      
      // Calculate conversion rate
      const conversionRate = calls.length > 0 ? (conversions.length / calls.length) * 100 : 0;
      
      return {
        campaignId,
        campaignName: campaign.name || 'Unknown',
        roi,
        costs: {
          ai: aiCosts,
          infrastructure: infrastructureCosts,
          setup: setupCosts,
          total: totalCosts
        },
        revenue: totalRevenue,
        metrics: {
          totalCalls: calls.length,
          totalConversions: conversions.length,
          costPerCall,
          costPerConversion,
          conversionRate
        },
        timestamp: Date.now()
      };
    } catch (error) {
      logger.error(`Error calculating ROI: ${error.message}`);
      return {
        campaignId,
        campaignName: 'Unknown',
        roi: 0,
        costs: {
          ai: 0,
          infrastructure: 0,
          setup: 0,
          total: 0
        },
        revenue: 0,
        metrics: {
          totalCalls: 0,
          totalConversions: 0,
          costPerCall: 0,
          costPerConversion: 0,
          conversionRate: 0
        },
        error: error.message,
        timestamp: Date.now()
      };
    }
  }
  
  /**
   * Calculate performance metrics
   * @param calls Array of call data
   * @returns Performance metrics
   */
  private calculatePerformanceMetrics(calls: any[]): Record<string, number> {
    // Count successful calls
    const successfulCalls = calls.filter(call => call.outcome === 'positive').length;
    
    // Calculate success rate
    const successRate = calls.length > 0 ? (successfulCalls / calls.length) * 100 : 0;
    
    // Calculate average call duration
    const totalDuration = calls.reduce((sum, call) => sum + (call.duration || 0), 0);
    const avgDuration = calls.length > 0 ? totalDuration / calls.length : 0;
    
    // Calculate average latency
    const callsWithLatency = calls.filter(call => call.metrics?.latency?.total);
    const totalLatency = callsWithLatency.reduce(
      (sum, call) => sum + (call.metrics.latency.total || 0), 0
    );
    const avgLatency = callsWithLatency.length > 0 ? totalLatency / callsWithLatency.length : 0;
    
    // Calculate average interruptions
    const callsWithInterruptions = calls.filter(call => call.metrics?.interruptions !== undefined);
    const totalInterruptions = callsWithInterruptions.reduce(
      (sum, call) => sum + (call.metrics.interruptions || 0), 0
    );
    const avgInterruptions = callsWithInterruptions.length > 0 
      ? totalInterruptions / callsWithInterruptions.length 
      : 0;
    
    // Calculate average quality score
    const callsWithQualityScore = calls.filter(call => call.metrics?.qualityScore?.overall);
    const totalQualityScore = callsWithQualityScore.reduce(
      (sum, call) => sum + (call.metrics.qualityScore.overall || 0), 0
    );
    const avgQualityScore = callsWithQualityScore.length > 0 
      ? totalQualityScore / callsWithQualityScore.length 
      : 0;
    
    // Calculate calls per day (assuming calls span at least one day)
    const callDates = calls
      .filter(call => call.startTime)
      .map(call => new Date(call.startTime).toDateString());
    
    const uniqueDates = new Set(callDates);
    const callsPerDay = uniqueDates.size > 0 ? calls.length / uniqueDates.size : 0;
    
    return {
      successRate,
      avgDuration,
      avgLatency,
      avgInterruptions,
      avgQualityScore,
      callsPerDay
    };
  }
  
  /**
   * Calculate percentile rank for a metric
   * @param value Metric value
   * @param metricName Metric name
   * @param allCalls All calls for comparison
   * @returns Percentile rank (0-100)
   */
  private calculatePercentileRank(
    value: number, 
    metricName: string, 
    allCalls: any[]
  ): number {
    // Extract metric values from all calls
    const metricValues: number[] = [];
    
    for (const call of allCalls) {
      let metricValue: number | undefined;
      
      switch (metricName) {
        case 'successRate':
          // Skip, this is calculated separately
          break;
        case 'avgDuration':
          metricValue = call.duration;
          break;
        case 'avgLatency':
          metricValue = call.metrics?.latency?.total;
          break;
        case 'avgInterruptions':
          metricValue = call.metrics?.interruptions;
          break;
        case 'avgQualityScore':
          metricValue = call.metrics?.qualityScore?.overall;
          break;
      }
      
      if (metricValue !== undefined) {
        metricValues.push(metricValue);
      }
    }
    
    // Count values below current value
    const countBelow = metricValues.filter(v => v < value).length;
    
    // Calculate percentile rank
    return metricValues.length > 0 
      ? (countBelow / metricValues.length) * 100 
      : 50;
  }
  
  /**
   * Analyze common phrases in transcripts
   * @param transcripts Array of transcript data
   * @returns Common phrases analysis
   */
  private analyzeCommonPhrases(
    transcripts: Array<{ 
      transcript: any[]; 
      outcome: string;
      duration: number;
      metrics: any;
    }>
  ): CommonPhrase[] {
    // Simple phrase extraction for now
    // In a real implementation, this would use NLP techniques
    
    // Extract user messages
    const userMessages: string[] = [];
    
    for (const transcript of transcripts) {
      for (const turn of transcript.transcript) {
        if (turn.role === 'user' && turn.content) {
          userMessages.push(turn.content);
        }
      }
    }
    
    // Count phrases (simple n-gram analysis)
    const phraseCounts: Record<string, number> = {};
    
    for (const message of userMessages) {
      const words = message.toLowerCase().split(/\s+/);
      
      // Extract 2-grams and 3-grams
      for (let n = 2; n <= 3; n++) {
        for (let i = 0; i <= words.length - n; i++) {
          const phrase = words.slice(i, i + n).join(' ');
          
          // Skip short phrases
          if (phrase.length < 5) continue;
          
          phraseCounts[phrase] = (phraseCounts[phrase] || 0) + 1;
        }
      }
    }
    
    // Convert to array and sort by count
    const phrases = Object.entries(phraseCounts)
      .filter(([_, count]) => count >= 3) // Minimum frequency
      .map(([phrase, count]) => ({
        phrase,
        frequency: count,
        frequencyPercent: (count / userMessages.length) * 100
      }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 10); // Top 10
    
    return phrases;
  }
  
  /**
   * Analyze outcome correlations in transcripts
   * @param transcripts Array of transcript data
   * @returns Outcome correlation analysis
   */
  private analyzeOutcomeCorrelations(
    transcripts: Array<{ 
      transcript: any[]; 
      outcome: string;
      duration: number;
      metrics: any;
    }>
  ): OutcomeCorrelation[] {
    // Group transcripts by outcome
    const positiveTranscripts = transcripts.filter(t => t.outcome === 'positive');
    const negativeTranscripts = transcripts.filter(t => t.outcome === 'negative');
    
    // If not enough data for comparison, return empty array
    if (positiveTranscripts.length < 5 || negativeTranscripts.length < 5) {
      return [];
    }
    
    // Extract features to correlate with outcomes
    const correlations: OutcomeCorrelation[] = [];
    
    // 1. Call duration correlation
    const positiveDurations = positiveTranscripts.map(t => t.duration);
    const negativeDurations = negativeTranscripts.map(t => t.duration);
    
    const avgPositiveDuration = positiveDurations.reduce((sum, d) => sum + d, 0) / positiveDurations.length;
    const avgNegativeDuration = negativeDurations.reduce((sum, d) => sum + d, 0) / negativeDurations.length;
    
    correlations.push({
      factor: 'callDuration',
      positiveAvg: avgPositiveDuration,
      negativeAvg: avgNegativeDuration,
      differential: avgPositiveDuration - avgNegativeDuration,
      correlationStrength: Math.min(1, Math.abs(avgPositiveDuration - avgNegativeDuration) / Math.max(avgPositiveDuration, avgNegativeDuration))
    });
    
    // 2. Interruption correlation
    const positiveInterruptions = positiveTranscripts.map(t => t.metrics?.interruptions || 0);
    const negativeInterruptions = negativeTranscripts.map(t => t.metrics?.interruptions || 0);
    
    const avgPositiveInterruptions = positiveInterruptions.reduce((sum, i) => sum + i, 0) / positiveInterruptions.length;
    const avgNegativeInterruptions = negativeInterruptions.reduce((sum, i) => sum + i, 0) / negativeInterruptions.length;
    
    correlations.push({
      factor: 'interruptions',
      positiveAvg: avgPositiveInterruptions,
      negativeAvg: avgNegativeInterruptions,
      differential: avgPositiveInterruptions - avgNegativeInterruptions,
      correlationStrength: Math.min(1, Math.abs(avgPositiveInterruptions - avgNegativeInterruptions) / Math.max(1, Math.max(avgPositiveInterruptions, avgNegativeInterruptions)))
    });
    
    // 3. User response length correlation
    const extractAvgUserResponseLength = (transcripts: any[]) => {
      let totalLength = 0;
      let count = 0;
      
      for (const transcript of transcripts) {
        for (const turn of transcript.transcript) {
          if (turn.role === 'user' && turn.content) {
            totalLength += turn.content.length;
            count++;
          }
        }
      }
      
      return count > 0 ? totalLength / count : 0;
    };
    
    const avgPositiveUserLength = extractAvgUserResponseLength(positiveTranscripts);
    const avgNegativeUserLength = extractAvgUserResponseLength(negativeTranscripts);
    
    correlations.push({
      factor: 'userResponseLength',
      positiveAvg: avgPositiveUserLength,
      negativeAvg: avgNegativeUserLength,
      differential: avgPositiveUserLength - avgNegativeUserLength,
      correlationStrength: Math.min(1, Math.abs(avgPositiveUserLength - avgNegativeUserLength) / Math.max(1, Math.max(avgPositiveUserLength, avgNegativeUserLength)))
    });
    
    // Sort by correlation strength
    return correlations.sort((a, b) => b.correlationStrength - a.correlationStrength);
  }
  
  /**
   * Calculate AI costs for calls
   * @param calls Array of call data
   * @returns Total AI costs
   */
  private calculateAICosts(calls: any[]): number {
    // This is a simplified cost calculation
    // In a real implementation, would track actual API usage
    
    const STT_COST_PER_MINUTE = 0.006; // $0.006 per minute
    const LLM_COST_PER_1K_TOKENS = 0.002; // $0.002 per 1K tokens
    const TTS_COST_PER_1K_CHARS = 0.015; // $0.015 per 1K characters
    
    let totalCost = 0;
    
    for (const call of calls) {
      const durationMinutes = (call.duration || 0) / 60;
      
      // STT cost
      const sttCost = durationMinutes * STT_COST_PER_MINUTE;
      
      // LLM cost (estimate tokens based on transcript)
      let llmCost = 0;
      if (call.transcript) {
        const totalChars = call.transcript.reduce((sum: number, turn: any) => {
          return sum + (turn.content?.length || 0);
        }, 0);
        
        // Rough estimate: 4 chars = 1 token
        const totalTokens = totalChars / 4;
        llmCost = (totalTokens / 1000) * LLM_COST_PER_1K_TOKENS;
      }
      
      // TTS cost (estimate characters spoken by AI)
      let ttsCost = 0;
      if (call.transcript) {
        const aiChars = call.transcript
          .filter((turn: any) => turn.role === 'assistant')
          .reduce((sum: number, turn: any) => {
            return sum + (turn.content?.length || 0);
          }, 0);
        
        ttsCost = (aiChars / 1000) * TTS_COST_PER_1K_CHARS;
      }
      
      // Add to total
      totalCost += sttCost + llmCost + ttsCost;
    }
    
    return totalCost;
  }
}

/**
 * Call outcome prediction interface
 */
export interface CallOutcomePrediction {
  predictedOutcome: string;
  confidence: number; // 0-1 scale
  isActual?: boolean;
  factors?: Record<string, any>;
  timestamp: number;
  error?: string;
}

/**
 * Optimal time analysis interface
 */
export interface OptimalTimeAnalysis {
  bestTimes: Array<{
    hour: number;
    successRate: number;
    callCount: number;
    avgDuration: number;
  }>;
  worstTimes: Array<{
    hour: number;
    successRate: number;
    callCount: number;
    avgDuration: number;
  }>;
  sampleSize: number;
  timestamp: number;
  error?: string;
}

/**
 * Agent performance benchmark interface
 */
export interface AgentPerformanceBenchmark {
  agentId: string;
  agentName: string;
  metrics: Record<string, number>;
  systemAverage: Record<string, number>;
  percentileRanks?: Record<string, number>;
  sampleSize: {
    agent: number;
    system: number;
  };
  timestamp: number;
  error?: string;
}

/**
 * Conversation pattern analysis interface
 */
export interface ConversationPatternAnalysis {
  commonPhrases: CommonPhrase[];
  outcomeCorrelations: OutcomeCorrelation[];
  sampleSize: number;
  timestamp: number;
  error?: string;
}

/**
 * Common phrase interface
 */
export interface CommonPhrase {
  phrase: string;
  frequency: number;
  frequencyPercent: number;
}

/**
 * Outcome correlation interface
 */
export interface OutcomeCorrelation {
  factor: string;
  positiveAvg: number;
  negativeAvg: number;
  differential: number;
  correlationStrength: number; // 0-1 scale
}

/**
 * ROI analysis interface
 */
export interface ROIAnalysis {
  campaignId: string;
  campaignName: string;
  roi: number; // Percentage
  costs: {
    ai: number;
    infrastructure: number;
    setup: number;
    total: number;
  };
  revenue: number;
  metrics: {
    totalCalls: number;
    totalConversions: number;
    costPerCall: number;
    costPerConversion: number;
    conversionRate: number; // Percentage
  };
  timestamp: number;
  error?: string;
}

// Export singleton instance
export const advancedAnalyticsService = new AdvancedAnalyticsService();
