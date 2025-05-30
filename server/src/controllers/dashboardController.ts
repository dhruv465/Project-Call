import { Request, Response } from 'express';
import Call from '../models/Call';
import Lead from '../models/Lead';
import Campaign from '../models/Campaign';
import { logger } from '../index';
import { handleError } from '../utils/errorHandling';

// @desc    Get dashboard overview
// @route   GET /api/dashboard/overview
// @access  Private
export const getDashboardOverview = async (req: Request & { user?: any }, res: Response) => {
  try {
    // Get counts for various entities
    const campaignCount = await Campaign.countDocuments({ createdBy: req.user.id });
    const leadCount = await Lead.countDocuments();
    const callCount = await Call.countDocuments();
    const successfulCallCount = await Call.countDocuments({ status: 'completed' });
    
    // Calculate conversion rate
    const conversionRate = callCount > 0 ? (successfulCallCount / callCount) : 0;
    
    // Get recent calls
    const recentCalls = await Call.find()
      .sort({ startTime: -1 })
      .limit(5)
      .populate('lead', 'name phoneNumber')
      .populate('campaign', 'name');
      
    // Get active campaigns
    const activeCampaigns = await Campaign.find({ createdBy: req.user.id })
      .sort({ createdAt: -1 })
      .limit(5);
    
    res.status(200).json({
      stats: {
        campaigns: campaignCount,
        leads: leadCount,
        calls: callCount,
        successfulCalls: successfulCallCount,
        conversionRate: conversionRate
      },
      recentActivity: {
        calls: recentCalls,
        campaigns: activeCampaigns
      }
    });
  } catch (error) {
    logger.error('Error in getDashboardOverview:', error);
    res.status(500).json({
      message: 'Server error',
      error: handleError(error)
    });
  }
};

// @desc    Get call metrics
// @route   GET /api/dashboard/call-metrics
// @access  Private
export const getCallMetrics = async (_req: Request & { user?: any }, res: Response) => {
  try {
    // Get call status distribution
    const callStatusDistribution = await Call.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    
    // Get call outcome distribution
    const callOutcomeDistribution = await Call.aggregate([
      { $group: { _id: '$outcome', count: { $sum: 1 } } }
    ]);
    
    // Get average call duration
    const averageDurationResult = await Call.aggregate([
      { $match: { duration: { $gt: 0 } } },
      { $group: { _id: null, average: { $avg: '$duration' } } }
    ]);
    
    const averageDuration = averageDurationResult.length > 0 ? averageDurationResult[0].average : 0;
    
    res.status(200).json({
      statusDistribution: callStatusDistribution,
      outcomeDistribution: callOutcomeDistribution,
      averageDuration
    });
  } catch (error) {
    logger.error('Error in getCallMetrics:', error);
    res.status(500).json({
      message: 'Server error',
      error: handleError(error)
    });
  }
};

// @desc    Get lead metrics
// @route   GET /api/dashboard/lead-metrics
// @access  Private
export const getLeadMetrics = async (_req: Request & { user?: any }, res: Response) => {
  try {
    // Get lead source distribution
    const leadSourceDistribution = await Lead.aggregate([
      { $group: { _id: '$source', count: { $sum: 1 } } }
    ]);
    
    // Get lead status distribution
    const leadStatusDistribution = await Lead.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    
    // Get conversion by source
    const leadConversionBySource = await Lead.aggregate([
      { $match: { status: 'Converted' } },
      { $group: { _id: '$source', count: { $sum: 1 } } }
    ]);
    
    res.status(200).json({
      sourceDistribution: leadSourceDistribution,
      statusDistribution: leadStatusDistribution,
      conversionBySource: leadConversionBySource
    });
  } catch (error) {
    logger.error('Error in getLeadMetrics:', error);
    res.status(500).json({
      message: 'Server error',
      error: handleError(error)
    });
  }
};

// @desc    Get agent performance metrics
// @route   GET /api/dashboard/agent-performance
// @access  Private
export const getAgentPerformance = async (_req: Request & { user?: any }, res: Response) => {
  try {
    // Mock data for agent performance since this is an AI system
    const mockAgentPerformance = {
      callVolume: 157,
      successRate: 0.68,
      averageCallTime: 132, // seconds
      positiveResponseRate: 0.42,
      leadConversionRate: 0.23,
      callQualityScore: 0.85,
      improvement: {
        weekOverWeek: 0.12,
        monthOverMonth: 0.28
      }
    };
    
    res.status(200).json(mockAgentPerformance);
  } catch (error) {
    logger.error('Error in getAgentPerformance:', error);
    res.status(500).json({
      message: 'Server error',
      error: handleError(error)
    });
  }
};

// @desc    Get geographical distribution of calls
// @route   GET /api/dashboard/geographical
// @access  Private
export const getGeographicalDistribution = async (_req: Request & { user?: any }, res: Response) => {
  try {
    // Mock data for geographical distribution
    const mockGeoDistribution = [
      { region: 'North America', count: 243, successRate: 0.72 },
      { region: 'Europe', count: 157, successRate: 0.65 },
      { region: 'Asia', count: 128, successRate: 0.58 },
      { region: 'South America', count: 87, successRate: 0.61 },
      { region: 'Australia/Oceania', count: 56, successRate: 0.69 },
      { region: 'Africa', count: 42, successRate: 0.54 }
    ];
    
    res.status(200).json(mockGeoDistribution);
  } catch (error) {
    logger.error('Error in getGeographicalDistribution:', error);
    res.status(500).json({
      message: 'Server error',
      error: handleError(error)
    });
  }
};

// @desc    Get time series data for dashboard charts
// @route   GET /api/dashboard/time-series
// @access  Private
export const getTimeSeriesData = async (req: Request & { user?: any }, res: Response) => {
  try {
    const { metric, period = 'week' } = req.query as { metric?: string; period?: string };
    
    // Create time range based on period
    const startDate = new Date();
    
    if (period === 'week') {
      startDate.setDate(startDate.getDate() - 7);
    } else if (period === 'month') {
      startDate.setMonth(startDate.getMonth() - 1);
    } else if (period === 'year') {
      startDate.setFullYear(startDate.getFullYear() - 1);
    }
    
    // Mock time series data
    const mockTimeSeriesData = {
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      datasets: [
        {
          label: metric || 'Calls',
          data: [12, 19, 15, 22, 18, 9, 14]
        }
      ]
    };
    
    // In a real implementation, we would query the database for time-based metrics
    
    res.status(200).json(mockTimeSeriesData);
  } catch (error) {
    logger.error('Error in getTimeSeriesData:', error);
    res.status(500).json({
      message: 'Server error',
      error: handleError(error)
    });
  }
};

// @desc    Export dashboard data
// @route   GET /api/dashboard/export
// @access  Private
export const exportDashboardData = async (req: Request & { user?: any }, res: Response) => {
  try {
    const { format = 'json' } = req.query as { format?: string };
    
    // Get basic stats
    const callCount = await Call.countDocuments();
    const leadCount = await Lead.countDocuments();
    const campaignCount = await Campaign.countDocuments({ createdBy: req.user.id });
    
    // Get call stats
    const callsByStatus = await Call.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    
    // Get lead stats
    const leadsByStatus = await Lead.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    
    // Prepare export data
    const exportData = {
      generatedAt: new Date(),
      overview: {
        totalCalls: callCount,
        totalLeads: leadCount,
        totalCampaigns: campaignCount
      },
      callStats: callsByStatus,
      leadStats: leadsByStatus
    };
    
    if (format === 'json') {
      return res.status(200).json(exportData);
    } else if (format === 'csv') {
      // Convert to CSV
      let csv = 'Data Type,Category,Count\n';
      
      // Add call stats
      callsByStatus.forEach(stat => {
        csv += `Call,${stat._id},${stat.count}\n`;
      });
      
      // Add lead stats
      leadsByStatus.forEach(stat => {
        csv += `Lead,${stat._id},${stat.count}\n`;
      });
      
      // Add overview
      csv += `Overview,Total Calls,${callCount}\n`;
      csv += `Overview,Total Leads,${leadCount}\n`;
      csv += `Overview,Total Campaigns,${campaignCount}\n`;
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=dashboard-export.csv');
      return res.status(200).send(csv);
    } else {
      return res.status(400).json({ message: 'Unsupported export format' });
    }
  } catch (error) {
    logger.error('Error in exportDashboardData:', error);
    res.status(500).json({
      message: 'Server error',
      error: handleError(error)
    });
    return;
  }
};
