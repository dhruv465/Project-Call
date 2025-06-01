import Call, { ICall } from '../models/Call';
import logger from '../utils/logger';
import mongoose from 'mongoose';

export interface CallTimelineMetric {
  date: string;
  totalCalls: number;
  connectedCalls: number;
  failedCalls: number;
  avgDuration: number;
  conversionRate: number;
}

export interface CampaignPerformanceMetrics {
  campaignId: string;
  campaignName?: string;
  totalCalls: number;
  connectedCalls: number;
  connectRate: number;
  averageDuration: number;
  conversionRate: number;
  customerEngagement: number;
  complianceScore: number;
  costPerCall?: number;
  costPerConversion?: number;
}

export interface CallDistributionMetrics {
  byStatus: Record<string, number>;
  byTimeOfDay: Record<string, number>;
  byDayOfWeek: Record<string, number>;
  byOutcome: Record<string, number>;
  byEmotion: Record<string, number>;
  byIntent: Record<string, number>;
}

export interface ConversationMetrics {
  averageTurns: number;
  averageCustomerSpeakingTime: number;
  averageAISpeakingTime: number;
  commonObjections: Array<{objection: string, count: number}>;
  commonIntents: Array<{intent: string, count: number}>;
  commonEmotions: Array<{emotion: string, count: number}>;
  averageEngagementScore: number;
  emotionalJourneyTrends: Array<{
    fromEmotion: string,
    toEmotion: string,
    count: number
  }>;
}

class CallAnalyticsService {
  /**
   * Get timeline metrics for calls over a period
   */
  async getCallTimeline(
    startDate: Date, 
    endDate: Date, 
    interval: 'hour' | 'day' | 'week' | 'month' = 'day',
    campaignId?: string
  ): Promise<CallTimelineMetric[]> {
    try {
      const match: any = {
        createdAt: { $gte: startDate, $lte: endDate }
      };
      
      if (campaignId) {
        match.campaignId = campaignId;
      }
      
      // Determine the date format for grouping based on interval
      let dateFormat;
      switch (interval) {
        case 'hour':
          dateFormat = '%Y-%m-%d %H:00';
          break;
        case 'day':
          dateFormat = '%Y-%m-%d';
          break;
        case 'week':
          dateFormat = '%Y-W%U'; // Year-Week format
          break;
        case 'month':
          dateFormat = '%Y-%m';
          break;
      }
      
      const pipeline = [
        { $match: match },
        { $group: {
          _id: { 
            dateGroup: { $dateToString: { format: dateFormat, date: '$createdAt' } }
          },
          totalCalls: { $sum: 1 },
          connectedCalls: { 
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          failedCalls: { 
            $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] }
          },
          totalDuration: { $sum: { $ifNull: ['$duration', 0] } },
          conversions: { 
            $sum: { 
              $cond: [
                { $gte: [{ $ifNull: ['$metrics.conversionProbability', 0] }, 0.7] }, 
                1, 
                0
              ] 
            }
          }
        }},
        { $project: {
          _id: 0,
          date: '$_id.dateGroup',
          totalCalls: 1,
          connectedCalls: 1,
          failedCalls: 1,
          avgDuration: { 
            $cond: [
              { $eq: ['$connectedCalls', 0] },
              0,
              { $divide: ['$totalDuration', '$connectedCalls'] }
            ]
          },
          conversionRate: { 
            $cond: [
              { $eq: ['$connectedCalls', 0] },
              0,
              { $divide: ['$conversions', '$connectedCalls'] }
            ]
          }
        }},
        { $sort: { date: 1 } }
      ] as any[];
      
      const results = await Call.aggregate(pipeline);
      return results;
    } catch (error) {
      logger.error('Error getting call timeline:', error);
      throw error;
    }
  }
  
  /**
   * Get performance metrics by campaign
   */
  async getCampaignPerformanceMetrics(
    startDate: Date, 
    endDate: Date,
    campaignIds?: string[]
  ): Promise<CampaignPerformanceMetrics[]> {
    try {
      const match: any = {
        createdAt: { $gte: startDate, $lte: endDate }
      };
      
      if (campaignIds && campaignIds.length > 0) {
        match.campaignId = { $in: campaignIds };
      }
      
      const pipeline = [
        { $match: match },
        { $group: {
          _id: '$campaignId',
          totalCalls: { $sum: 1 },
          connectedCalls: { 
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          },
          totalDuration: { $sum: { $ifNull: ['$duration', 0] } },
          conversions: { 
            $sum: { 
              $cond: [
                { $gte: [{ $ifNull: ['$metrics.conversionProbability', 0] }, 0.7] }, 
                1, 
                0
              ] 
            }
          },
          totalEngagement: { $sum: { $ifNull: ['$metrics.conversationMetrics.customerEngagement', 0] } },
          totalComplianceScore: { $sum: { $ifNull: ['$metrics.complianceScore', 0] } }
        }},
        { $project: {
          _id: 0,
          campaignId: '$_id',
          totalCalls: 1,
          connectedCalls: 1,
          connectRate: { 
            $cond: [
              { $eq: ['$totalCalls', 0] },
              0,
              { $divide: ['$connectedCalls', '$totalCalls'] }
            ]
          },
          averageDuration: { 
            $cond: [
              { $eq: ['$connectedCalls', 0] },
              0,
              { $divide: ['$totalDuration', '$connectedCalls'] }
            ]
          },
          conversionRate: { 
            $cond: [
              { $eq: ['$connectedCalls', 0] },
              0,
              { $divide: ['$conversions', '$connectedCalls'] }
            ]
          },
          customerEngagement: { 
            $cond: [
              { $eq: ['$connectedCalls', 0] },
              0,
              { $divide: ['$totalEngagement', '$connectedCalls'] }
            ]
          },
          complianceScore: { 
            $cond: [
              { $eq: ['$connectedCalls', 0] },
              0,
              { $divide: ['$totalComplianceScore', '$connectedCalls'] }
            ]
          }
        }},
        { $sort: { conversionRate: -1 } }
      ] as any[];
      
      const results = await Call.aggregate(pipeline);
      
      // Fetch campaign names (this would need to be implemented based on your Campaign model)
      // const campaignNames = await getCampaignNames(results.map(r => r.campaignId));
      
      return results.map(result => ({
        ...result,
        // campaignName: campaignNames[result.campaignId] || 'Unknown Campaign'
      }));
    } catch (error) {
      logger.error('Error getting campaign performance metrics:', error);
      throw error;
    }
  }
  
  /**
   * Get call distribution metrics
   */
  async getCallDistributionMetrics(
    startDate: Date,
    endDate: Date,
    campaignId?: string
  ): Promise<CallDistributionMetrics> {
    try {
      const match: any = {
        createdAt: { $gte: startDate, $lte: endDate }
      };
      
      if (campaignId) {
        match.campaignId = campaignId;
      }
      
      // By status distribution
      const statusPipeline = [
        { $match: match },
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $project: { _id: 0, status: '$_id', count: 1 } }
      ];
      
      // By time of day distribution (hourly)
      const timeOfDayPipeline = [
        { $match: match },
        { $project: {
          hour: { $hour: '$createdAt' }
        }},
        { $group: { _id: '$hour', count: { $sum: 1 } } },
        { $project: { _id: 0, hour: '$_id', count: 1 } },
        { $sort: { hour: 1 } }
      ];
      
      // By day of week distribution
      const dayOfWeekPipeline = [
        { $match: match },
        { $project: {
          dayOfWeek: { $dayOfWeek: '$createdAt' } // 1 for Sunday, 2 for Monday, etc.
        }},
        { $group: { _id: '$dayOfWeek', count: { $sum: 1 } } },
        { $project: { _id: 0, dayOfWeek: '$_id', count: 1 } },
        { $sort: { dayOfWeek: 1 } }
      ];
      
      // By outcome distribution
      const outcomePipeline = [
        { $match: match },
        { $group: { _id: '$metrics.outcome', count: { $sum: 1 } } },
        { $project: { _id: 0, outcome: '$_id', count: 1 } }
      ];
      
      // By emotion distribution (primary emotion from emotional journey)
      const emotionPipeline = [
        { $match: match },
        { $unwind: { path: '$metrics.emotionalJourney', preserveNullAndEmptyArrays: false } },
        { $group: { _id: '$metrics.emotionalJourney.emotion', count: { $sum: 1 } } },
        { $project: { _id: 0, emotion: '$_id', count: 1 } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ];
      
      // By intent distribution
      const intentPipeline = [
        { $match: match },
        { $match: { 'metrics.intentDetection.primaryIntent': { $exists: true } } },
        { $group: { _id: '$metrics.intentDetection.primaryIntent', count: { $sum: 1 } } },
        { $project: { _id: 0, intent: '$_id', count: 1 } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ];
      
      // Execute all pipelines in parallel
      const [
        statusResults,
        timeOfDayResults,
        dayOfWeekResults,
        outcomeResults,
        emotionResults,
        intentResults
      ] = await Promise.all([
        Call.aggregate(statusPipeline as any[]),
        Call.aggregate(timeOfDayPipeline as any[]),
        Call.aggregate(dayOfWeekPipeline as any[]),
        Call.aggregate(outcomePipeline as any[]),
        Call.aggregate(emotionPipeline as any[]),
        Call.aggregate(intentPipeline as any[])
      ]);
      
      // Format results into dictionaries
      const byStatus = statusResults.reduce((acc, { status, count }) => {
        acc[status || 'unknown'] = count;
        return acc;
      }, {} as Record<string, number>);
      
      const byTimeOfDay = timeOfDayResults.reduce((acc, { hour, count }) => {
        acc[hour.toString()] = count;
        return acc;
      }, {} as Record<string, number>);
      
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const byDayOfWeek = dayOfWeekResults.reduce((acc, { dayOfWeek, count }) => {
        // Convert 1-7 to day names
        acc[dayNames[dayOfWeek - 1]] = count;
        return acc;
      }, {} as Record<string, number>);
      
      const byOutcome = outcomeResults.reduce((acc, { outcome, count }) => {
        acc[outcome || 'unknown'] = count;
        return acc;
      }, {} as Record<string, number>);
      
      const byEmotion = emotionResults.reduce((acc, { emotion, count }) => {
        acc[emotion || 'unknown'] = count;
        return acc;
      }, {} as Record<string, number>);
      
      const byIntent = intentResults.reduce((acc, { intent, count }) => {
        acc[intent || 'unknown'] = count;
        return acc;
      }, {} as Record<string, number>);
      
      return {
        byStatus,
        byTimeOfDay,
        byDayOfWeek,
        byOutcome,
        byEmotion,
        byIntent
      };
    } catch (error) {
      logger.error('Error getting call distribution metrics:', error);
      throw error;
    }
  }
  
  /**
   * Get conversation metrics
   */
  async getConversationMetrics(
    startDate: Date,
    endDate: Date,
    campaignId?: string
  ): Promise<ConversationMetrics> {
    try {
      const match: any = {
        createdAt: { $gte: startDate, $lte: endDate },
        status: 'completed', // Only analyze completed calls
        conversationLog: { $exists: true, $ne: [] }
      };
      
      if (campaignId) {
        match.campaignId = campaignId;
      }
      
      // Basic conversation metrics
      const basicMetricsPipeline = [
        { $match: match },
        { $project: {
          conversationTurns: { $size: '$conversationLog' },
          customerInteraction: 1,
          metrics: 1
        }},
        { $group: {
          _id: null,
          totalCalls: { $sum: 1 },
          totalTurns: { $sum: '$conversationTurns' },
          totalCustomerSpeakingTime: { $sum: { $ifNull: ['$customerInteraction.totalSpeakingTime', 0] } },
          totalAISpeakingTime: { 
            $sum: { 
              $multiply: [
                { $ifNull: ['$customerInteraction.totalSpeakingTime', 0] },
                { $ifNull: ['$customerInteraction.speakingTimeRatio', 1] }
              ]
            }
          },
          totalEngagementScore: { $sum: { $ifNull: ['$metrics.conversationMetrics.customerEngagement', 0] } }
        }},
        { $project: {
          _id: 0,
          averageTurns: { $divide: ['$totalTurns', '$totalCalls'] },
          averageCustomerSpeakingTime: { $divide: ['$totalCustomerSpeakingTime', '$totalCalls'] },
          averageAISpeakingTime: { $divide: ['$totalAISpeakingTime', '$totalCalls'] },
          averageEngagementScore: { $divide: ['$totalEngagementScore', '$totalCalls'] }
        }}
      ];
      
      // Common objections
      const objectionsPipeline = [
        { $match: match },
        { $match: { 'metrics.conversationMetrics.objectionCount': { $gt: 0 } } },
        { $unwind: '$conversationLog' },
        { $match: { 
          'conversationLog.role': 'user',
          'conversationLog.intent': 'objection'
        }},
        { $group: { 
          _id: '$conversationLog.content',
          count: { $sum: 1 }
        }},
        { $project: { 
          _id: 0,
          objection: '$_id',
          count: 1
        }},
        { $sort: { count: -1 } },
        { $limit: 10 }
      ];
      
      // Common intents
      const intentsPipeline = [
        { $match: match },
        { $unwind: '$conversationLog' },
        { $match: { 
          'conversationLog.role': 'user',
          'conversationLog.intent': { $exists: true, $ne: null }
        }},
        { $group: { 
          _id: '$conversationLog.intent',
          count: { $sum: 1 }
        }},
        { $project: { 
          _id: 0,
          intent: '$_id',
          count: 1
        }},
        { $sort: { count: -1 } },
        { $limit: 10 }
      ];
      
      // Common emotions
      const emotionsPipeline = [
        { $match: match },
        { $unwind: '$conversationLog' },
        { $match: { 
          'conversationLog.role': 'user',
          'conversationLog.emotion': { $exists: true, $ne: null }
        }},
        { $group: { 
          _id: '$conversationLog.emotion',
          count: { $sum: 1 }
        }},
        { $project: { 
          _id: 0,
          emotion: '$_id',
          count: 1
        }},
        { $sort: { count: -1 } },
        { $limit: 10 }
      ];
      
      // Emotional journey trends
      const emotionalJourneyPipeline = [
        { $match: match },
        { $match: { 'metrics.emotionalJourney': { $exists: true, $ne: [] } } },
        // Use $map to create pairs of consecutive emotions
        { $project: {
          emotionPairs: {
            $map: {
              input: { $range: [0, { $subtract: [{ $size: '$metrics.emotionalJourney' }, 1] }] },
              as: 'i',
              in: {
                fromEmotion: { $arrayElemAt: ['$metrics.emotionalJourney.emotion', '$$i'] },
                toEmotion: { $arrayElemAt: ['$metrics.emotionalJourney.emotion', { $add: ['$$i', 1] }] }
              }
            }
          }
        }},
        { $unwind: '$emotionPairs' },
        { $group: {
          _id: {
            fromEmotion: '$emotionPairs.fromEmotion',
            toEmotion: '$emotionPairs.toEmotion'
          },
          count: { $sum: 1 }
        }},
        { $project: {
          _id: 0,
          fromEmotion: '$_id.fromEmotion',
          toEmotion: '$_id.toEmotion',
          count: 1
        }},
        { $sort: { count: -1 } },
        { $limit: 15 }
      ];
      
      // Execute all pipelines in parallel
      const [
        basicMetricsResults,
        objectionsResults,
        intentsResults,
        emotionsResults,
        emotionalJourneyResults
      ] = await Promise.all([
        Call.aggregate(basicMetricsPipeline as any[]),
        Call.aggregate(objectionsPipeline as any[]),
        Call.aggregate(intentsPipeline as any[]),
        Call.aggregate(emotionsPipeline as any[]),
        Call.aggregate(emotionalJourneyPipeline as any[])
      ]);
      
      // Extract values from results
      const basicMetrics = basicMetricsResults[0] || {
        averageTurns: 0,
        averageCustomerSpeakingTime: 0,
        averageAISpeakingTime: 0,
        averageEngagementScore: 0
      };
      
      return {
        averageTurns: basicMetrics.averageTurns,
        averageCustomerSpeakingTime: basicMetrics.averageCustomerSpeakingTime,
        averageAISpeakingTime: basicMetrics.averageAISpeakingTime,
        commonObjections: objectionsResults,
        commonIntents: intentsResults,
        commonEmotions: emotionsResults,
        averageEngagementScore: basicMetrics.averageEngagementScore,
        emotionalJourneyTrends: emotionalJourneyResults
      };
    } catch (error) {
      logger.error('Error getting conversation metrics:', error);
      throw error;
    }
  }
  
  /**
   * Get detailed metrics for a specific call
   */
  async getDetailedCallMetrics(callId: string): Promise<any> {
    try {
      const call = await Call.findById(callId);
      
      if (!call) {
        throw new Error(`Call not found: ${callId}`);
      }
      
      // Analyze conversation turns
      const conversationTurns = call.conversationLog?.length || 0;
      
      // Calculate emotional progression
      const emotionalProgression = call.metrics?.emotionalJourney?.map(e => ({
        emotion: e.emotion,
        confidence: e.confidence,
        timestamp: e.timestamp
      })) || [];
      
      // Calculate speaking time distribution
      const speakingTimeDistribution = {
        ai: call.customerInteraction?.totalSpeakingTime 
          ? call.customerInteraction.totalSpeakingTime * (call.customerInteraction.speakingTimeRatio || 1)
          : 0,
        customer: call.customerInteraction?.totalSpeakingTime || 0
      };
      
      // Calculate response times
      const responseTimes = [];
      if (call.conversationLog && call.conversationLog.length > 1) {
        for (let i = 1; i < call.conversationLog.length; i++) {
          const prevMsg = call.conversationLog[i-1];
          const currMsg = call.conversationLog[i];
          
          if (prevMsg.role !== currMsg.role) {
            const prevTime = new Date(prevMsg.timestamp).getTime();
            const currTime = new Date(currMsg.timestamp).getTime();
            const responseTime = (currTime - prevTime) / 1000; // in seconds
            
            responseTimes.push({
              from: prevMsg.role,
              to: currMsg.role,
              responseTime
            });
          }
        }
      }
      
      // Count interruptions
      const interruptions = call.customerInteraction?.interruptions?.length || 0;
      
      return {
        callId,
        duration: call.duration || 0,
        status: call.status,
        startTime: call.startTime,
        endTime: call.endTime,
        conversationTurns,
        emotionalProgression,
        speakingTimeDistribution,
        responseTimes,
        interruptions,
        qualityScore: call.metrics?.qualityScore || 0,
        conversionProbability: call.metrics?.conversionProbability || 0,
        followUpRecommendation: call.metrics?.followUpRecommendation || 'none',
        transcript: call.conversationLog?.map(entry => ({
          role: entry.role,
          content: entry.content,
          timestamp: entry.timestamp,
          emotion: entry.emotion,
          intent: entry.intent
        })) || []
      };
    } catch (error) {
      logger.error(`Error getting detailed metrics for call ${callId}:`, error);
      throw error;
    }
  }
}

export const callAnalyticsService = new CallAnalyticsService();
export default callAnalyticsService;
