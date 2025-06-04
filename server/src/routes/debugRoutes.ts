import express from 'express';
import { authenticate } from '../middleware/auth';
import mongoose from 'mongoose';
import Lead from '../models/Lead';
import Campaign from '../models/Campaign';
import Call from '../models/Call';
import { logger } from '../index';
import { handleError } from '../utils/errorHandling';

const router = express.Router();

// Debug route to check lead and campaign existence
router.post('/verify-ids', authenticate, async (req, res) => {
  try {
    const { leadId, campaignId } = req.body;
    
    logger.info('Verifying IDs:', { leadId, campaignId });
    
    // Log the raw request for debugging
    logger.info('Request body:', req.body);
    
    // Check if IDs are valid MongoDB ObjectIDs
    const isValidLeadId = mongoose.Types.ObjectId.isValid(leadId);
    const isValidCampaignId = mongoose.Types.ObjectId.isValid(campaignId);
    
    let leadObj = null;
    let campaignObj = null;
    
    if (isValidLeadId) {
      leadObj = await Lead.findById(leadId);
    }
    
    if (isValidCampaignId) {
      campaignObj = await Campaign.findById(campaignId);
    }
    
    return res.status(200).json({
      isValidLeadId,
      isValidCampaignId,
      leadExists: !!leadObj,
      campaignExists: !!campaignObj,
      leadInfo: leadObj ? {
        id: leadObj._id,
        name: leadObj.name,
        phoneNumber: leadObj.phoneNumber
      } : null,
      campaignInfo: campaignObj ? {
        id: campaignObj._id,
        name: campaignObj.name
      } : null
    });
  } catch (error) {
    logger.error('Error in verify-ids:', error);
    return res.status(500).json({
      message: 'Server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Debug route for call creation
router.post('/test-call-creation', authenticate, async (req, res) => {
  try {
    const { leadId, campaignId } = req.body;
    
    logger.info('Testing call creation with:', { leadId, campaignId });
    
    // Validate IDs
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
    
    // Try to create a call with minimal fields
    const testCall = new Call({
      leadId: new mongoose.Types.ObjectId(leadId),
      campaignId: new mongoose.Types.ObjectId(campaignId),
      phoneNumber: lead.phoneNumber,
      status: 'queued',
      scheduledAt: new Date(),
      maxRetries: 3,
      retryCount: 0,
      recordCall: false,
      priority: 'medium',
      conversationLog: []
    });
    
    // Save and return the call
    const savedCall = await testCall.save();
    
    // Clean up - delete the test call
    await Call.findByIdAndDelete(savedCall._id);
    
    return res.status(200).json({
      success: true,
      message: 'Test call created and deleted successfully',
      callId: savedCall._id
    });
  } catch (error) {
    logger.error('Error in test-call-creation:', error);
    return res.status(500).json({
      message: 'Server error',
      error: handleError(error),
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

export default router;
