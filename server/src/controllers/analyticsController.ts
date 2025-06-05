import { Request, Response } from 'express';
import { callAnalyticsService } from '../services';
import { unifiedAnalyticsService } from '../services/unifiedAnalyticsService';
import logger from '../utils/logger';

/**
 * Get call timeline metrics
 */
export const getCallTimeline = async (req: Request, res: Response): Promise<void> => {
  try {
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();
    const interval = (req.query.interval as 'hour' | 'day' | 'week' | 'month') || 'day';
    const campaignId = req.query.campaignId as string;
    
    const timeline = await callAnalyticsService.getCallTimeline(
      startDate,
      endDate,
      interval,
      campaignId
    );
    
    res.json({
      success: true,
      data: timeline
    });
  } catch (error) {
    logger.error('Error getting call timeline:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve call timeline data'
    });
  }
};

/**
 * Get campaign performance metrics
 */
export const getCampaignPerformance = async (req: Request, res: Response): Promise<void> => {
  try {
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();
    const campaignIds = req.query.campaignIds ? (req.query.campaignIds as string).split(',') : undefined;
    
    const performance = await callAnalyticsService.getCampaignPerformanceMetrics(
      startDate,
      endDate,
      campaignIds
    );
    
    res.json({
      success: true,
      data: performance
    });
  } catch (error) {
    logger.error('Error getting campaign performance:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve campaign performance data'
    });
  }
};

/**
 * Get call distribution metrics
 */
export const getCallDistribution = async (req: Request, res: Response): Promise<void> => {
  try {
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();
    const campaignId = req.query.campaignId as string;
    
    const distribution = await callAnalyticsService.getCallDistributionMetrics(
      startDate,
      endDate,
      campaignId
    );
    
    res.json({
      success: true,
      data: distribution
    });
  } catch (error) {
    logger.error('Error getting call distribution:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve call distribution data'
    });
  }
};

/**
 * Get conversation metrics
 */
export const getConversationMetrics = async (req: Request, res: Response): Promise<void> => {
  try {
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();
    const campaignId = req.query.campaignId as string;
    
    const metrics = await callAnalyticsService.getConversationMetrics(
      startDate,
      endDate,
      campaignId
    );
    
    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    logger.error('Error getting conversation metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve conversation metrics data'
    });
  }
};

/**
 * Get detailed metrics for a specific call
 */
export const getDetailedCallMetrics = async (req: Request, res: Response): Promise<void> => {
  try {
    const callId = req.params.id;
    
    const metrics = await callAnalyticsService.getDetailedCallMetrics(callId);
    
    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    logger.error(`Error getting detailed metrics for call ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve detailed call metrics'
    });
  }
};

/**
 * Get system health and monitoring metrics
 */
export const getSystemHealth = async (_req: Request, res: Response): Promise<void> => {
  try {
    // This would use the callMonitoring service to get system health
    // For now, we'll return a mock response
    const health = {
      cpuUsage: process.cpuUsage().user / 1000000,
      memoryUsage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      callsInLastHour: 42,
      activeConversations: 5,
      queuedCalls: 12,
      systemStatus: 'healthy',
      lastUpdated: new Date()
    };
    
    res.json({
      success: true,
      data: health
    });
  } catch (error) {
    logger.error('Error getting system health:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve system health data'
    });
  }
};

/**
 * Get unified call metrics for analytics page
 */
export const getUnifiedCallMetrics = async (req: Request, res: Response): Promise<void> => {
  try {
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();
    const campaignId = req.query.campaignId as string;
    
    // Use unified analytics service for consistent metrics
    const [metrics, timeline] = await Promise.all([
      unifiedAnalyticsService.getCallMetrics(startDate, endDate, campaignId),
      unifiedAnalyticsService.getCallTimeline(startDate, endDate, campaignId)
    ]);
    
    res.json({
      success: true,
      data: {
        summary: metrics,
        timeline
      }
    });
  } catch (error) {
    logger.error('Error getting unified call metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve unified call metrics'
    });
  }
};
