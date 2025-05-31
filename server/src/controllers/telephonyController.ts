import { Request, Response } from 'express';
import { logger } from '../index';
import { handleError } from '../utils/errorHandling';
import { advancedTelephonyService } from '../services/advancedTelephonyService';

// @desc    Queue a new call
// @route   POST /api/telephony/queue-call
// @access  Private
export const queueCall = async (req: Request & { user?: any }, res: Response) => {
  try {
    const {
      leadId,
      campaignId,
      phoneNumber,
      personalityId,
      abTestVariantId,
      priority = 'medium',
      scheduledAt,
      maxRetries = 3
    } = req.body;

    if (!leadId || !campaignId || !phoneNumber) {
      return res.status(400).json({
        message: 'Lead ID, campaign ID, and phone number are required'
      });
    }

    const callbackUrl = `${process.env.API_BASE_URL || 'http://localhost:8000'}/api/telephony`;

    const callId = await advancedTelephonyService.queueCall({
      leadId,
      campaignId,
      phoneNumber,
      personalityId,
      abTestVariantId,
      priority,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
      maxRetries,
      callbackUrl
    });

    res.status(201).json({
      success: true,
      callId,
      message: 'Call queued successfully'
    });
  } catch (error) {
    logger.error('Error in queueCall:', error);
    res.status(500).json({
      message: 'Failed to queue call',
      error: handleError(error)
    });
  }
};

// @desc    Handle Twilio voice webhook
// @route   POST /api/telephony/voice-webhook
// @access  Public (Twilio webhook)
export const handleVoiceWebhook = async (req: Request, res: Response) => {
  try {
    const twiml = await advancedTelephonyService.handleVoiceWebhook(req);
    
    res.type('text/xml');
    res.send(twiml);
  } catch (error) {
    logger.error('Error in handleVoiceWebhook:', error);
    res.type('text/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Say voice="alice">I apologize, but I'm experiencing technical difficulties.</Say>
        <Hangup/>
      </Response>`);
  }
};

// @desc    Handle Twilio status webhook
// @route   POST /api/telephony/status-webhook
// @access  Public (Twilio webhook)
export const handleStatusWebhook = async (req: Request, res: Response) => {
  try {
    await advancedTelephonyService.handleStatusWebhook(req);
    res.status(200).send('OK');
  } catch (error) {
    logger.error('Error in handleStatusWebhook:', error);
    res.status(500).send('Error');
  }
};

// @desc    Handle Twilio recording webhook
// @route   POST /api/telephony/recording-webhook
// @access  Public (Twilio webhook)
export const handleRecordingWebhook = async (req: Request, res: Response) => {
  try {
    await advancedTelephonyService.handleRecordingWebhook(req);
    res.status(200).send('OK');
  } catch (error) {
    logger.error('Error in handleRecordingWebhook:', error);
    res.status(500).send('Error');
  }
};

// @desc    Get call queue status
// @route   GET /api/telephony/queue
// @access  Private
export const getCallQueue = async (req: Request & { user?: any }, res: Response) => {
  try {
    const queue = await advancedTelephonyService.getCallQueue();
    const activeConversations = await advancedTelephonyService.getActiveConversations();

    res.json({
      success: true,
      queue: {
        pending: queue.length,
        active: activeConversations.length,
        details: {
          queuedCalls: queue,
          activeConversations: activeConversations.map(conv => ({
            callId: conv.callId,
            startTime: conv.startTime,
            phoneNumber: conv.config.phoneNumber,
            conversationState: conv.conversationState
          }))
        }
      }
    });
  } catch (error) {
    logger.error('Error in getCallQueue:', error);
    res.status(500).json({
      message: 'Failed to fetch call queue',
      error: handleError(error)
    });
  }
};

// @desc    Get telephony metrics
// @route   GET /api/telephony/metrics
// @access  Private
export const getTelephonyMetrics = async (req: Request & { user?: any }, res: Response) => {
  try {
    const { timeRange = '24h' } = req.query;
    const metrics = await advancedTelephonyService.getCallMetrics(timeRange as string);

    res.json({
      success: true,
      metrics,
      timeRange
    });
  } catch (error) {
    logger.error('Error in getTelephonyMetrics:', error);
    res.status(500).json({
      message: 'Failed to fetch telephony metrics',
      error: handleError(error)
    });
  }
};

// @desc    Pause/stop a call
// @route   PUT /api/telephony/calls/:callId/pause
// @access  Private
export const pauseCall = async (req: Request & { user?: any }, res: Response) => {
  try {
    const { callId } = req.params;
    
    await advancedTelephonyService.pauseCall(callId);
    
    res.json({
      success: true,
      message: 'Call paused successfully'
    });
  } catch (error) {
    logger.error('Error in pauseCall:', error);
    res.status(500).json({
      message: 'Failed to pause call',
      error: handleError(error)
    });
  }
};

// @desc    Bulk queue calls for campaign
// @route   POST /api/telephony/bulk-queue
// @access  Private
export const bulkQueueCalls = async (req: Request & { user?: any }, res: Response) => {
  try {
    const { 
      campaignId, 
      leadIds, 
      personalityId, 
      abTestVariantId,
      priority = 'medium',
      scheduledAt,
      staggerInterval = 60 // seconds between calls
    } = req.body;

    if (!campaignId || !leadIds || !Array.isArray(leadIds)) {
      return res.status(400).json({
        message: 'Campaign ID and lead IDs array are required'
      });
    }

    const results = [];
    const callbackUrl = `${process.env.API_BASE_URL || 'http://localhost:8000'}/api/telephony`;

    for (let i = 0; i < leadIds.length; i++) {
      try {
        const leadId = leadIds[i];
        const scheduleTime = scheduledAt 
          ? new Date(new Date(scheduledAt).getTime() + (i * staggerInterval * 1000))
          : new Date(Date.now() + (i * staggerInterval * 1000));

        // In a real implementation, you'd fetch the lead's phone number
        const phoneNumber = `+1234567890${i}`; // Placeholder

        const callId = await advancedTelephonyService.queueCall({
          leadId,
          campaignId,
          phoneNumber,
          personalityId,
          abTestVariantId,
          priority,
          scheduledAt: scheduleTime,
          maxRetries: 3,
          callbackUrl
        });

        results.push({
          leadId,
          callId,
          scheduledAt: scheduleTime,
          status: 'queued'
        });
      } catch (error) {
        results.push({
          leadId: leadIds[i],
          status: 'failed',
          error: error.message
        });
      }
    }

    const successCount = results.filter(r => r.status === 'queued').length;
    const failCount = results.filter(r => r.status === 'failed').length;

    res.json({
      success: true,
      summary: {
        total: leadIds.length,
        queued: successCount,
        failed: failCount
      },
      results
    });
  } catch (error) {
    logger.error('Error in bulkQueueCalls:', error);
    res.status(500).json({
      message: 'Bulk call queueing failed',
      error: handleError(error)
    });
  }
};
