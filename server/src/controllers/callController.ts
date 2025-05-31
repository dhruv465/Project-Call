import { Request, Response } from 'express';
import Call from '../models/Call';
import Lead from '../models/Lead';
import Campaign from '../models/Campaign';
import Configuration from '../models/Configuration';
import { logger } from '../index';
import mongoose from 'mongoose';
import { handleError } from '../utils/errorHandling';

// @desc    Initiate a new AI call to a lead
// @route   POST /api/calls/initiate
// @access  Private
export const initiateCall = async (req: Request & { user?: any }, res: Response): Promise<Response> => {
  try {
    const { leadId, campaignId, scheduleTime } = req.body;

    if (!leadId || !campaignId) {
      return res.status(400).json({ message: 'Lead ID and Campaign ID are required' });
    }

    // Check if lead and campaign exist
    const lead = await Lead.findById(leadId);
    if (!lead) {
      return res.status(404).json({ message: 'Lead not found' });
    }

    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }

    // Get system configuration
    const configuration = await Configuration.findOne();
    if (!configuration || !configuration.twilioConfig.isEnabled) {
      return res.status(400).json({ message: 'Twilio is not configured or enabled' });
    }

    // Check if we have an active script
    const activeScript = campaign.script.versions.find(version => version.isActive);
    if (!activeScript) {
      return res.status(400).json({ message: 'No active script found for this campaign' });
    }

    // Create a new call record
    const newCall = new Call({
      campaign: campaignId,
      lead: leadId,
      status: scheduleTime ? 'scheduled' : 'pending',
      startTime: scheduleTime || new Date(),
      createdBy: req.user.id,
      conversationLog: [],
    });

    // If call is scheduled for future, save the scheduled time
    if (scheduleTime) {
      (newCall as any).scheduledTime = scheduleTime;
    } else {
      // Initiate call with Twilio (simplified for now)
      // In a real implementation, this would integrate with Twilio's API
      try {
        // Make real Twilio API call here
        newCall.status = 'in-progress';
        (newCall as any).twilioCallSid = `TC${Math.random().toString(36).substring(2, 15)}`;
        
        // Update lead's last contacted date
        (lead as any).lastContacted = new Date();
        (lead as any).callCount = ((lead as any).callCount || 0) + 1;
        await lead.save();
      } catch (error) {
        logger.error('Error initiating Twilio call:', error);
        newCall.status = 'failed';
        (newCall as any).notes = `Failed to initiate: ${handleError(error)}`;
      }
    }

    await newCall.save();

    return res.status(201).json({
      message: scheduleTime ? 'Call scheduled successfully' : 'Call initiated successfully',
      call: newCall
    });
  } catch (error) {
    logger.error('Error in initiateCall:', error);
    return res.status(500).json({
      message: 'Server error',
      error: handleError(error)
    });
  }
};

// @desc    Get call history with filtering and pagination
// @route   GET /api/calls
// @access  Private
export const getCallHistory = async (req: Request & { user?: any }, res: Response): Promise<Response> => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      status, 
      campaignId, 
      leadId,
      startDate,
      endDate,
      outcome
    } = req.query;

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const skip = (pageNum - 1) * limitNum;

    // Build query
    const query: any = {};

    if (status) query.status = status;
    if (campaignId) query.campaign = campaignId;
    if (leadId) query.lead = leadId;
    if (outcome) query.outcome = outcome;

    // Date range filtering
    if (startDate || endDate) {
      query.startTime = {};
      if (startDate) query.startTime.$gte = new Date(startDate as string);
      if (endDate) query.startTime.$lte = new Date(endDate as string);
    }

    // Execute query with population
    const calls = await Call.find(query)
      .sort({ startTime: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate('lead', 'name phoneNumber company')
      .populate('campaign', 'name');

    // Get total count for pagination
    const total = await Call.countDocuments(query);

    return res.status(200).json({
      calls,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    logger.error('Error in getCallHistory:', error);
    return res.status(500).json({
      message: 'Server error',
      error: handleError(error)
    });
  }
};

// @desc    Get detailed information about a specific call
// @route   GET /api/calls/:id
// @access  Private
export const getCallById = async (req: Request, res: Response): Promise<Response> => {
  try {
    const call = await Call.findById(req.params.id)
      .populate('lead', 'name phoneNumber company email title')
      .populate('campaign', 'name description goal')
      .populate('createdBy', 'name email');

    if (!call) {
      return res.status(404).json({ message: 'Call not found' });
    }

    return res.status(200).json({ call });
  } catch (error) {
    logger.error('Error in getCallById:', error);
    return res.status(500).json({
      message: 'Server error',
      error: (error as Error).message
    });
  }
};

// @desc    Get call recording URL
// @route   GET /api/calls/:id/recording
// @access  Private
export const getCallRecording = async (req: Request, res: Response): Promise<Response> => {
  try {
    const call = await Call.findById(req.params.id);

    if (!call) {
      return res.status(404).json({ message: 'Call not found' });
    }

    if (!(call as any).recordingUrl) {
      return res.status(404).json({ message: 'No recording available for this call' });
    }

    // In a real app, this would handle Twilio authentication and possibly proxying
    return res.status(200).json({ recordingUrl: (call as any).recordingUrl });
  } catch (error) {
    logger.error('Error in getCallRecording:', error);
    return res.status(500).json({
      message: 'Server error',
      error: (error as Error).message
    });
  }
};

// @desc    Get call transcript
// @route   GET /api/calls/:id/transcript
// @access  Private
export const getCallTranscript = async (req: Request, res: Response): Promise<Response> => {
  try {
    const call = await Call.findById(req.params.id);

    if (!call) {
      return res.status(404).json({ message: 'Call not found' });
    }

    if (!(call as any).transcript) {
      return res.status(404).json({ message: 'No transcript available for this call' });
    }

    return res.status(200).json({ 
      transcript: (call as any).transcript,
      conversationLog: (call as any).conversationLog
    });
  } catch (error) {
    logger.error('Error in getCallTranscript:', error);
    return res.status(500).json({
      message: 'Server error',
      error: (error as Error).message
    });
  }
};

// @desc    Schedule a callback for a lead
// @route   POST /api/calls/:id/schedule-callback
// @access  Private
export const scheduleCallback = async (req: Request & { user?: any }, res: Response): Promise<Response> => {
  try {
    const { dateTime, notes } = req.body;

    if (!dateTime) {
      return res.status(400).json({ message: 'Callback date and time are required' });
    }

    const call = await Call.findById(req.params.id);
    if (!call) {
      return res.status(404).json({ message: 'Call not found' });
    }

    // Update call with callback information
    (call as any).callback = {
      scheduled: true,
      dateTime: new Date(dateTime),
      notes: notes || ''
    };

    await call.save();

    // Schedule callback in a real implementation would involve 
    // setting up a job to trigger at the specified time

    return res.status(200).json({
      message: 'Callback scheduled successfully',
      callback: (call as any).callback
    });
  } catch (error) {
    logger.error('Error in scheduleCallback:', error);
    return res.status(500).json({
      message: 'Server error',
      error: (error as Error).message
    });
  }
};

// @desc    Get call analytics (metrics and statistics)
// @route   GET /api/calls/analytics
// @access  Private
export const getCallAnalytics = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { campaignId, startDate, endDate } = req.query;

    // Date range for analytics
    const dateQuery: any = {};
    if (startDate) dateQuery.$gte = new Date(startDate as string);
    if (endDate) dateQuery.$lte = new Date(endDate as string);

    // Base match criteria
    const matchCriteria: any = {};
    if (Object.keys(dateQuery).length > 0) {
      matchCriteria.startTime = dateQuery;
    }
    if (campaignId) {
      matchCriteria.campaign = new mongoose.Types.ObjectId(campaignId as string);
    }

    // Aggregate call data for analytics
    const analytics = await Call.aggregate([
      { $match: matchCriteria },
      {
        $group: {
          _id: null,
          totalCalls: { $sum: 1 },
          completedCalls: { 
            $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] }
          },
          failedCalls: { 
            $sum: { $cond: [{ $eq: ["$status", "failed"] }, 1, 0] }
          },
          averageDuration: { $avg: "$duration" },
          totalDuration: { $sum: "$duration" },
          positiveOutcomes: {
            $sum: { 
              $cond: [
                { $in: ["$outcome", ["interested", "callback-requested"]] }, 
                1, 
                0
              ] 
            }
          },
          negativeOutcomes: {
            $sum: { 
              $cond: [
                { $in: ["$outcome", ["not-interested", "do-not-call"]] }, 
                1, 
                0
              ] 
            }
          },
          // Count by outcome
          outcomeStats: {
            $push: "$outcome"
          }
        }
      },
      {
        $project: {
          _id: 0,
          totalCalls: 1,
          completedCalls: 1,
          failedCalls: 1,
          averageDuration: { $round: ["$averageDuration", 0] },
          totalDuration: 1,
          successRate: {
            $cond: [
              { $eq: ["$totalCalls", 0] },
              0,
              { $multiply: [{ $divide: ["$completedCalls", "$totalCalls"] }, 100] }
            ]
          },
          conversionRate: {
            $cond: [
              { $eq: ["$completedCalls", 0] },
              0,
              { $multiply: [{ $divide: ["$positiveOutcomes", "$completedCalls"] }, 100] }
            ]
          },
          negativeRate: {
            $cond: [
              { $eq: ["$completedCalls", 0] },
              0,
              { $multiply: [{ $divide: ["$negativeOutcomes", "$completedCalls"] }, 100] }
            ]
          },
          outcomeStats: 1
        }
      }
    ]);

    // Process outcome stats to get counts by category
    const result = analytics.length > 0 ? analytics[0] : {
      totalCalls: 0,
      completedCalls: 0,
      failedCalls: 0,
      averageDuration: 0,
      totalDuration: 0,
      successRate: 0,
      conversionRate: 0,
      negativeRate: 0,
      outcomeStats: []
    };

    // Calculate outcome distribution
    if (result.outcomeStats && result.outcomeStats.length > 0) {
      const outcomeCount: Record<string, number> = {};
      result.outcomeStats.forEach((outcome: string) => {
        if (outcome) {
          outcomeCount[outcome] = (outcomeCount[outcome] || 0) + 1;
        }
      });
      (result as any).outcomes = outcomeCount;
    }
    delete result.outcomeStats;

    // Get call volume by day
    const callsByDay = await Call.aggregate([
      { $match: matchCriteria },
      {
        $group: {
          _id: { 
            $dateToString: { format: "%Y-%m-%d", date: "$startTime" } 
          },
          count: { $sum: 1 },
          completed: { 
            $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] }
          },
          successful: {
            $sum: { 
              $cond: [
                { $in: ["$outcome", ["interested", "callback-requested"]] }, 
                1, 
                0
              ] 
            }
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    return res.status(200).json({
      summary: result,
      callsByDay
    });
  } catch (error) {
    logger.error('Error in getCallAnalytics:', error);
    return res.status(500).json({
      message: 'Server error',
      error: (error as Error).message
    });
  }
};

// @desc    Export call data to CSV, JSON, or Excel
// @route   GET /api/calls/export
// @access  Private
export const exportCalls = async (req: Request & { user?: any }, res: Response): Promise<Response> => {
  try {
    const { 
      format = 'csv',
      status, 
      campaignId, 
      leadId,
      startDate,
      endDate,
      outcome
    } = req.query;

    // Build query
    const query: any = {};

    if (status) query.status = status;
    if (campaignId) query.campaign = campaignId;
    if (leadId) query.lead = leadId;
    if (outcome) query.outcome = outcome;

    // Date range filtering
    if (startDate || endDate) {
      query.startTime = {};
      if (startDate) query.startTime.$gte = new Date(startDate as string);
      if (endDate) query.startTime.$lte = new Date(endDate as string);
    }

    // Get calls with populated lead and campaign info
    const calls = await Call.find(query)
      .sort({ startTime: -1 })
      .populate('lead', 'name phoneNumber company email')
      .populate('campaign', 'name');

    // Process calls for export
    const exportData = calls.map((call: any) => ({
      id: call._id,
      leadName: call.lead?.name || 'Unknown',
      leadPhone: call.lead?.phoneNumber || 'N/A',
      leadEmail: call.lead?.email || 'N/A',
      leadCompany: call.lead?.company || 'N/A',
      campaignName: call.campaign?.name || 'Unknown',
      status: call.status,
      startTime: call.startTime,
      endTime: call.endTime,
      duration: call.duration,
      outcome: call.outcome || 'unknown',
      notes: call.notes || '',
      hasRecording: !!call.recordingUrl,
    }));

    // Export based on requested format
    if (format === 'json') {
      // Send JSON
      return res.status(200).json({ calls: exportData });
    } 
    else if (format === 'csv') {
      // Convert to CSV using a simple method without external dependencies
      const header = Object.keys(exportData[0] || {}).join(',') + '\n';
      const csv = exportData.length 
        ? header + exportData.map((row: any) => 
            Object.values(row).map(value => 
              `"${String(value).replace(/"/g, '""')}"`
            ).join(',')
          ).join('\n')
        : header;
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=calls-export.csv');
      return res.status(200).send(csv);
    }
    else if (format === 'xlsx') {
      // For XLSX, we'll return JSON with a message to implement client-side Excel export
      // In a real implementation, you would use a library like exceljs
      return res.status(200).json({ 
        calls: exportData,
        message: 'XLSX export is handled on the client side'
      });
    }
    else {
      return res.status(400).json({ message: 'Unsupported export format' });
    }
  } catch (error) {
    logger.error('Error in exportCalls:', error);
    return res.status(500).json({
      message: 'Server error',
      error: (error as Error).message
    });
  }
};
