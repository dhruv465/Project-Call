import { Request, Response } from 'express';
import Campaign from '../models/Campaign';
import { logger } from '../index';
import { handleError } from '../utils/errorHandling';

// @desc    Create a new campaign
// @route   POST /api/campaigns
// @access  Private
export const createCampaign = async (req: Request & { user?: any }, res: Response) => {
  try {
    const { name, description, goal, targetAudience, script } = req.body;

    const campaign = new Campaign({
      name,
      description,
      goal,
      targetAudience,
      script,
      createdBy: req.user.id
    });

    const savedCampaign = await campaign.save();

    res.status(201).json(savedCampaign);
  } catch (error) {
    logger.error('Error in createCampaign:', error);
    res.status(500).json({
      message: 'Server error',
      error: handleError(error)
    });
  }
};

// @desc    Get all campaigns
// @route   GET /api/campaigns
// @access  Private
export const getCampaigns = async (req: Request & { user?: any }, res: Response) => {
  try {
    const campaigns = await Campaign.find({ createdBy: req.user.id });
    res.status(200).json(campaigns);
  } catch (error) {
    logger.error('Error in getCampaigns:', error);
    res.status(500).json({
      message: 'Server error',
      error: handleError(error)
    });
  }
};

// @desc    Get campaign by ID
// @route   GET /api/campaigns/:id
// @access  Private
export const getCampaignById = async (req: Request & { user?: any }, res: Response): Promise<Response> => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }
    
    // Ensure user can only access their own campaigns
    if (campaign.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to access this campaign' });
    }
    
    return res.status(200).json(campaign);
  } catch (error) {
    logger.error('Error in getCampaignById:', error);
    return res.status(500).json({
      message: 'Server error',
      error: handleError(error)
    });
  }
};

// @desc    Update campaign
// @route   PUT /api/campaigns/:id
// @access  Private
export const updateCampaign = async (req: Request & { user?: any }, res: Response): Promise<Response> => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }
    
    // Ensure user can only update their own campaigns
    if (campaign.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to update this campaign' });
    }
    
    const updatedCampaign = await Campaign.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true }
    );
    
    return res.status(200).json(updatedCampaign);
  } catch (error) {
    logger.error('Error in updateCampaign:', error);
    return res.status(500).json({
      message: 'Server error',
      error: handleError(error)
    });
  }
};

// @desc    Delete campaign
// @route   DELETE /api/campaigns/:id
// @access  Private
export const deleteCampaign = async (req: Request & { user?: any }, res: Response): Promise<Response> => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }
    
    // Ensure user can only delete their own campaigns
    if (campaign.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to delete this campaign' });
    }
    
    await Campaign.findByIdAndDelete(req.params.id);
    
    return res.status(200).json({ message: 'Campaign deleted successfully' });
  } catch (error) {
    logger.error('Error in deleteCampaign:', error);
    return res.status(500).json({
      message: 'Server error',
      error: handleError(error)
    });
  }
};

// @desc    Generate AI script
// @route   POST /api/campaigns/:id/generate-script
// @access  Private
export const generateScript = async (req: Request & { user?: any }, res: Response): Promise<Response> => {
  try {
    const { goal } = req.body;
    
    // This would typically call an AI service (OpenAI, etc.)
    // For now, return a mock response
    const mockScript = {
      introduction: "Hello, this is [AI Agent] calling from [Company]. How are you today?",
      value: `I'm calling because we have a solution that might help with ${goal || 'your business goals'}. Is this a good time to talk?`,
      questions: [
        "What challenges are you currently facing in this area?",
        "How are you currently addressing this issue?"
      ],
      objectionHandling: {
        "notInterested": "I understand. May I ask what specific aspect doesn't interest you?",
        "noTime": "I respect your time. When would be a better time to reach out?"
      },
      closing: `Thank you for your time. I'd like to follow up with more information about how we can help with ${goal || 'your business goals'}.`
    };
    
    // In a real implementation, we would save this to the campaign
    const campaign = await Campaign.findById(req.params.id);
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }
    
    return res.status(200).json({
      message: 'Script generated successfully',
      script: mockScript
    });
  } catch (error) {
    logger.error('Error in generateScript:', error);
    return res.status(500).json({
      message: 'Server error',
      error: handleError(error)
    });
  }
};

// @desc    Test script with AI voice
// @route   POST /api/campaigns/:id/test-script
// @access  Private
export const testScript = async (_req: Request & { user?: any }, res: Response): Promise<Response> => {
  try {
    // This would typically call ElevenLabs or another TTS service
    // For now, return a mock response
    
    return res.status(200).json({
      message: 'Script test generated successfully',
      audioUrl: 'https://example.com/mock-audio.mp3' // Mock URL
    });
  } catch (error) {
    logger.error('Error in testScript:', error);
    return res.status(500).json({
      message: 'Server error',
      error: handleError(error)
    });
  }
};

// @desc    Get campaign analytics
// @route   GET /api/campaigns/:id/analytics
// @access  Private
export const getCampaignAnalytics = async (_req: Request & { user?: any }, res: Response): Promise<Response> => {
  try {
    // This would typically fetch analytics data from the database
    // For now, return mock data
    const mockAnalytics = {
      totalCalls: 42,
      successfulCalls: 18,
      callsInProgress: 5,
      failedCalls: 19,
      averageDuration: 124, // seconds
      conversionRate: 0.23,
      timeOfDayPerformance: {
        morning: 0.35,
        afternoon: 0.42,
        evening: 0.18
      },
      dailyActivity: [
        { date: '2024-05-22', calls: 12 },
        { date: '2024-05-23', calls: 15 },
        { date: '2024-05-24', calls: 8 },
        { date: '2024-05-25', calls: 7 }
      ]
    };
    
    return res.status(200).json(mockAnalytics);
  } catch (error) {
    logger.error('Error in getCampaignAnalytics:', error);
    return res.status(500).json({
      message: 'Server error',
      error: handleError(error)
    });
  }
};
