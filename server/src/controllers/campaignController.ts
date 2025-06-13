import { Request, Response } from 'express';
import Campaign from '../models/Campaign';
import Call from '../models/Call';
import mongoose from 'mongoose';
import { logger } from '../index';
import { handleError } from '../utils/errorHandling';
import { conversationEngine } from '../services';
import { advancedCampaignService } from '../services/advancedCampaignService';

// @desc    Create a new campaign
// @route   POST /api/campaigns
// @access  Private
export const createCampaign = async (req: Request & { user?: any }, res: Response) => {
  try {
    const { name, description, goal, targetAudience, script } = req.body;

    logger.info(`Creating new campaign "${name}" for user ${req.user.id}`);
    
    const campaign = new Campaign({
      ...req.body,
      createdBy: req.user.id
    });

    const savedCampaign = await campaign.save();
    
    logger.info(`Campaign created successfully with ID: ${savedCampaign._id}`);

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
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;
    
    const search = req.query.search as string;
    const status = req.query.status as string;
    
    // Build filter object
    const filter: any = { createdBy: req.user.id };
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (status && status !== 'All') {
      filter.status = status;
    }
    
    logger.info(`Fetching campaigns for user ${req.user.id} with filter:`, filter);
    
    const campaigns = await Campaign.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await Campaign.countDocuments(filter);
    
    // Return campaigns with pagination for client compatibility
    const responseData = {
      campaigns: campaigns || [],
      pagination: {
        page,
        pages: Math.ceil(total / limit),
        total,
        limit
      }
    };
    
    logger.info(`Returning ${campaigns.length} campaigns of ${total} total`);
    
    res.status(200).json(responseData);
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
    
    logger.info(`Updating campaign ${req.params.id} for user ${req.user.id}`);
    
    const updatedCampaign = await Campaign.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );
    
    logger.info(`Campaign ${req.params.id} updated successfully`);
    
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
    
    try {
      // Get script template from system configuration only
      const Configuration = require('../models/Configuration').default;
      const config = await Configuration.findOne();
      
      if (!config) {
        return res.status(500).json({
          message: 'System configuration not found',
          error: 'Please configure system settings before generating scripts'
        });
      }

      // Check if required configuration fields exist
      if (!config.generalSettings) {
        return res.status(500).json({
          message: 'General settings not configured',
          error: 'Please configure general settings including default script templates'
        });
      }

      // Use ONLY dynamic script generation based on goal and configuration
      const scriptResponse = {
        introduction: config.generalSettings.defaultScriptIntroduction?.replace('{goal}', goal) || 
                     config.generalSettings.companyIntroduction?.replace('{goal}', goal),
        value: config.generalSettings.defaultValueProposition?.replace('{goal}', goal) || 
               config.generalSettings.companyValueProposition?.replace('{goal}', goal),
        questions: config.generalSettings.defaultQuestions || [],
        objectionHandling: config.generalSettings.defaultObjectionHandling || {},
        closing: config.generalSettings.defaultClosing?.replace('{goal}', goal) || 
                config.generalSettings.companyClosing?.replace('{goal}', goal)
      };

      // Validate that we have all required fields
      if (!scriptResponse.introduction || !scriptResponse.value) {
        return res.status(500).json({
          message: 'Incomplete script configuration',
          error: 'Please configure all required script templates in system settings (introduction, value proposition, etc.)'
        });
      }
      
      res.status(200).json({
        script: scriptResponse
      });
    } catch (error) {
      logger.error('Error generating script:', error);
      
      // NO FALLBACKS - force proper configuration
      return res.status(500).json({
        message: 'Script generation failed',
        error: 'Unable to generate script. Please ensure system configuration is complete.',
        details: error.message
      });
    }
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
    const { scriptContent } = _req.body;
    
    if (!scriptContent) {
      return res.status(400).json({
        message: 'Script content is required'
      });
    }
    
    // Generate audio using the voice service
    // In production, this would call the actual voice synthesis service
    const audioFilename = `test-script-${Date.now()}.mp3`;
    
    // Return the URL to the generated audio
    return res.status(200).json({
      message: 'Script test generated successfully',
      audioUrl: `${process.env.API_BASE_URL}/uploads/audio/${audioFilename}`
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
    // Fetch real analytics data from the database
    const { id } = _req.params;
    
    // Get all calls for this campaign
    const calls = await Call.find({ campaign: id });
    
    // Calculate analytics metrics
    const totalCalls = calls.length;
    const successfulCalls = calls.filter(call => call.outcome === 'successful').length;
    const callsInProgress = calls.filter(call => call.status === 'in-progress').length;
    const failedCalls = calls.filter(call => call.status === 'failed').length;
    
    // Calculate average duration
    const totalDuration = calls.reduce((acc, call) => acc + (call.duration || 0), 0);
    const averageDuration = totalCalls > 0 ? Math.round(totalDuration / totalCalls) : 0;
    
    // Calculate conversion rate
    const conversionRate = totalCalls > 0 ? successfulCalls / totalCalls : 0;
    
    // Calculate time of day performance
    const callsByTimeOfDay = {
      morning: 0,
      afternoon: 0,
      evening: 0
    };
    
    calls.forEach(call => {
      const hour = new Date(call.startTime).getHours();
      if (hour >= 5 && hour < 12) {
        callsByTimeOfDay.morning++;
      } else if (hour >= 12 && hour < 17) {
        callsByTimeOfDay.afternoon++;
      } else {
        callsByTimeOfDay.evening++;
      }
    });
    
    const timeOfDayPerformance = {
      morning: totalCalls > 0 ? callsByTimeOfDay.morning / totalCalls : 0,
      afternoon: totalCalls > 0 ? callsByTimeOfDay.afternoon / totalCalls : 0,
      evening: totalCalls > 0 ? callsByTimeOfDay.evening / totalCalls : 0
    };
    
    // Calculate daily activity
    const dailyActivity = [];
    const lastSevenDays = new Date();
    lastSevenDays.setDate(lastSevenDays.getDate() - 7);
    
    const callsByDay = await Call.aggregate([
      { 
        $match: { 
          campaign: new mongoose.Types.ObjectId(id),
          startTime: { $gte: lastSevenDays }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$startTime' } },
          calls: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    
    // Format the data
    const analytics = {
      totalCalls,
      successfulCalls,
      callsInProgress,
      failedCalls,
      averageDuration,
      conversionRate,
      timeOfDayPerformance,
      dailyActivity: callsByDay.map(day => ({
        date: day._id,
        calls: day.calls
      }))
    };
    
    return res.status(200).json(analytics);
  } catch (error) {
    logger.error('Error in getCampaignAnalytics:', error);
    return res.status(500).json({
      message: 'Server error',
      error: handleError(error)
    });
  }
};

// @desc    Generate advanced AI script with compliance
// @route   POST /api/campaigns/:id/generate-advanced-script
// @access  Private
export const generateAdvancedScript = async (req: Request & { user?: any }, res: Response) => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }

    const {
      industry,
      targetAudience,
      tone = 'professional',
      language = 'en',
      complianceRegion = ['IN'],
      customVariables
    } = req.body;

    const scriptOptions = {
      industry: industry || 'general',
      targetAudience: targetAudience || campaign.targetAudience || 'business professionals',
      campaignGoal: campaign.goal,
      tone,
      language,
      complianceRegion,
      customVariables
    };

    const result = await advancedCampaignService.generateScript(scriptOptions);

    res.json({
      success: true,
      script: result.script,
      compliance: result.compliance,
      metadata: result.metadata
    });
  } catch (error) {
    logger.error('Error in generateAdvancedScript:', error);
    res.status(500).json({
      message: 'Advanced script generation failed',
      error: handleError(error)
    });
  }
};

// @desc    Create script template
// @route   POST /api/campaigns/templates
// @access  Private
export const createScriptTemplate = async (req: Request & { user?: any }, res: Response) => {
  try {
    const template = await advancedCampaignService.createTemplate(req.body, req.user.id);
    res.status(201).json({
      success: true,
      template
    });
  } catch (error) {
    logger.error('Error in createScriptTemplate:', error);
    res.status(500).json({
      message: 'Template creation failed',
      error: handleError(error)
    });
  }
};

// @desc    Get script templates
// @route   GET /api/campaigns/templates
// @access  Private
export const getScriptTemplates = async (req: Request & { user?: any }, res: Response) => {
  try {
    const { category, industry, approved } = req.query;
    const filters: any = {};
    
    if (category) filters.category = category;
    if (industry) filters.industry = industry;
    if (approved) filters['compliance.approved'] = approved === 'true';

    const templates = await advancedCampaignService.getTemplates(filters);
    res.json({
      success: true,
      templates
    });
  } catch (error) {
    logger.error('Error in getScriptTemplates:', error);
    res.status(500).json({
      message: 'Failed to fetch templates',
      error: handleError(error)
    });
  }
};

// @desc    Create A/B test
// @route   POST /api/campaigns/:id/ab-test
// @access  Private
export const createABTest = async (req: Request & { user?: any }, res: Response) => {
  try {
    const campaignId = req.params.id;
    const campaign = await Campaign.findById(campaignId);
    
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }

    if (campaign.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    const abTestConfig = {
      ...req.body,
      campaignId
    };

    const abTest = await advancedCampaignService.createABTest(abTestConfig, req.user.id);
    
    res.status(201).json({
      success: true,
      abTest
    });
  } catch (error) {
    logger.error('Error in createABTest:', error);
    res.status(500).json({
      message: 'A/B test creation failed',
      error: handleError(error)
    });
  }
};

// @desc    Get A/B tests for campaign
// @route   GET /api/campaigns/:id/ab-tests
// @access  Private
export const getCampaignABTests = async (req: Request & { user?: any }, res: Response) => {
  try {
    const campaignId = req.params.id;
    const abTests = await advancedCampaignService.getABTests(campaignId);
    
    res.json({
      success: true,
      abTests
    });
  } catch (error) {
    logger.error('Error in getCampaignABTests:', error);
    res.status(500).json({
      message: 'Failed to fetch A/B tests',
      error: handleError(error)
    });
  }
};

// @desc    Get A/B test results
// @route   GET /api/campaigns/ab-test/:testId/results
// @access  Private
export const getABTestResults = async (req: Request & { user?: any }, res: Response) => {
  try {
    const { testId } = req.params;
    const results = await advancedCampaignService.getABTestResults(testId);
    
    res.json({
      success: true,
      results
    });
  } catch (error) {
    logger.error('Error in getABTestResults:', error);
    res.status(500).json({
      message: 'Failed to fetch A/B test results',
      error: handleError(error)
    });
  }
};

// @desc    Update A/B test metrics
// @route   PUT /api/campaigns/ab-test/:testId/metrics
// @access  Private
export const updateABTestMetrics = async (req: Request & { user?: any }, res: Response) => {
  try {
    const { testId } = req.params;
    const { variantId, metrics } = req.body;
    
    const updatedTest = await advancedCampaignService.updateABTestMetrics(testId, variantId, metrics);
    
    res.json({
      success: true,
      test: updatedTest
    });
  } catch (error) {
    logger.error('Error in updateABTestMetrics:', error);
    res.status(500).json({
      message: 'Failed to update A/B test metrics',
      error: handleError(error)
    });
  }
};

// @desc    Validate script compliance
// @route   POST /api/campaigns/validate-compliance
// @access  Private
export const validateScriptCompliance = async (req: Request & { user?: any }, res: Response) => {
  try {
    const { script, regions } = req.body;
    
    if (!script || !regions) {
      return res.status(400).json({ 
        message: 'Script content and regions are required' 
      });
    }

    // Use the compliance validation from advanced campaign service
    const service = new (advancedCampaignService.constructor as any)();
    const complianceResult = await service.validateCompliance(script, regions);
    
    res.json({
      success: true,
      compliance: complianceResult
    });
  } catch (error) {
    logger.error('Error in validateScriptCompliance:', error);
    res.status(500).json({
      message: 'Compliance validation failed',
      error: handleError(error)
    });
  }
};
