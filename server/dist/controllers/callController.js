"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTestCall = exports.exportCalls = exports.getCallAnalytics = exports.scheduleCallback = exports.getCallTranscript = exports.getCallRecording = exports.getCallById = exports.getCallHistory = exports.initiateCall = void 0;
const Call_1 = __importDefault(require("../models/Call"));
const Lead_1 = __importDefault(require("../models/Lead"));
const Campaign_1 = __importDefault(require("../models/Campaign"));
const Configuration_1 = __importDefault(require("../models/Configuration"));
const index_1 = require("../index");
const mongoose_1 = __importDefault(require("mongoose"));
const errorHandling_1 = require("../utils/errorHandling");
// @desc    Initiate a new AI call to a lead
// @route   POST /api/calls/initiate
// @access  Private
const initiateCall = async (req, res) => {
    try {
        const { leadId, campaignId, scheduleTime } = req.body;
        if (!leadId || !campaignId) {
            return res.status(400).json({ message: 'Lead ID and Campaign ID are required' });
        }
        // Check if lead and campaign exist
        const lead = await Lead_1.default.findById(leadId);
        if (!lead) {
            return res.status(404).json({ message: 'Lead not found' });
        }
        const campaign = await Campaign_1.default.findById(campaignId);
        if (!campaign) {
            return res.status(404).json({ message: 'Campaign not found' });
        }
        // Get system configuration
        const configuration = await Configuration_1.default.findOne();
        if (!configuration || !configuration.twilioConfig.isEnabled) {
            return res.status(400).json({ message: 'Twilio is not configured or enabled' });
        }
        // Check if we have an active script
        const activeScript = campaign.script.versions.find(version => version.isActive);
        if (!activeScript) {
            return res.status(400).json({ message: 'No active script found for this campaign' });
        }
        // Create a new call record
        const newCall = new Call_1.default({
            campaign: campaignId,
            lead: leadId,
            status: scheduleTime ? 'scheduled' : 'pending',
            startTime: scheduleTime || new Date(),
            createdBy: req.user.id,
            conversationLog: [],
        });
        // If call is scheduled for future, save the scheduled time
        if (scheduleTime) {
            newCall.scheduledTime = scheduleTime;
        }
        else {
            // Initiate call with Twilio (simplified for now)
            // In a real implementation, this would integrate with Twilio's API
            try {
                // Simplified mock - in a real app this would make a Twilio API call
                newCall.status = 'in-progress';
                newCall.twilioCallSid = `TC${Math.random().toString(36).substring(2, 15)}`;
                // Update lead's last contacted date
                lead.lastContacted = new Date();
                lead.callCount = (lead.callCount || 0) + 1;
                await lead.save();
            }
            catch (error) {
                index_1.logger.error('Error initiating Twilio call:', error);
                newCall.status = 'failed';
                newCall.notes = `Failed to initiate: ${(0, errorHandling_1.handleError)(error)}`;
            }
        }
        await newCall.save();
        return res.status(201).json({
            message: scheduleTime ? 'Call scheduled successfully' : 'Call initiated successfully',
            call: newCall
        });
    }
    catch (error) {
        index_1.logger.error('Error in initiateCall:', error);
        return res.status(500).json({
            message: 'Server error',
            error: (0, errorHandling_1.handleError)(error)
        });
    }
};
exports.initiateCall = initiateCall;
// @desc    Get call history with filtering and pagination
// @route   GET /api/calls
// @access  Private
const getCallHistory = async (req, res) => {
    try {
        const { page = 1, limit = 10, status, campaignId, leadId, startDate, endDate, outcome } = req.query;
        const pageNum = Number(page);
        const limitNum = Number(limit);
        const skip = (pageNum - 1) * limitNum;
        // Build query
        const query = {};
        if (status)
            query.status = status;
        if (campaignId)
            query.campaign = campaignId;
        if (leadId)
            query.lead = leadId;
        if (outcome)
            query.outcome = outcome;
        // Date range filtering
        if (startDate || endDate) {
            query.startTime = {};
            if (startDate)
                query.startTime.$gte = new Date(startDate);
            if (endDate)
                query.startTime.$lte = new Date(endDate);
        }
        // Execute query with population
        const calls = await Call_1.default.find(query)
            .sort({ startTime: -1 })
            .skip(skip)
            .limit(limitNum)
            .populate('lead', 'name phoneNumber company')
            .populate('campaign', 'name');
        // Get total count for pagination
        const total = await Call_1.default.countDocuments(query);
        return res.status(200).json({
            calls,
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                pages: Math.ceil(total / limitNum)
            }
        });
    }
    catch (error) {
        index_1.logger.error('Error in getCallHistory:', error);
        return res.status(500).json({
            message: 'Server error',
            error: (0, errorHandling_1.handleError)(error)
        });
    }
};
exports.getCallHistory = getCallHistory;
// @desc    Get detailed information about a specific call
// @route   GET /api/calls/:id
// @access  Private
const getCallById = async (req, res) => {
    try {
        const call = await Call_1.default.findById(req.params.id)
            .populate('lead', 'name phoneNumber company email title')
            .populate('campaign', 'name description goal')
            .populate('createdBy', 'name email');
        if (!call) {
            return res.status(404).json({ message: 'Call not found' });
        }
        return res.status(200).json({ call });
    }
    catch (error) {
        index_1.logger.error('Error in getCallById:', error);
        return res.status(500).json({
            message: 'Server error',
            error: error.message
        });
    }
};
exports.getCallById = getCallById;
// @desc    Get call recording URL
// @route   GET /api/calls/:id/recording
// @access  Private
const getCallRecording = async (req, res) => {
    try {
        const call = await Call_1.default.findById(req.params.id);
        if (!call) {
            return res.status(404).json({ message: 'Call not found' });
        }
        if (!call.recordingUrl) {
            return res.status(404).json({ message: 'No recording available for this call' });
        }
        // In a real app, this would handle Twilio authentication and possibly proxying
        return res.status(200).json({ recordingUrl: call.recordingUrl });
    }
    catch (error) {
        index_1.logger.error('Error in getCallRecording:', error);
        return res.status(500).json({
            message: 'Server error',
            error: error.message
        });
    }
};
exports.getCallRecording = getCallRecording;
// @desc    Get call transcript
// @route   GET /api/calls/:id/transcript
// @access  Private
const getCallTranscript = async (req, res) => {
    try {
        const call = await Call_1.default.findById(req.params.id);
        if (!call) {
            return res.status(404).json({ message: 'Call not found' });
        }
        if (!call.transcript) {
            return res.status(404).json({ message: 'No transcript available for this call' });
        }
        return res.status(200).json({
            transcript: call.transcript,
            conversationLog: call.conversationLog
        });
    }
    catch (error) {
        index_1.logger.error('Error in getCallTranscript:', error);
        return res.status(500).json({
            message: 'Server error',
            error: error.message
        });
    }
};
exports.getCallTranscript = getCallTranscript;
// @desc    Schedule a callback for a lead
// @route   POST /api/calls/:id/schedule-callback
// @access  Private
const scheduleCallback = async (req, res) => {
    try {
        const { dateTime, notes } = req.body;
        if (!dateTime) {
            return res.status(400).json({ message: 'Callback date and time are required' });
        }
        const call = await Call_1.default.findById(req.params.id);
        if (!call) {
            return res.status(404).json({ message: 'Call not found' });
        }
        // Update call with callback information
        call.callback = {
            scheduled: true,
            dateTime: new Date(dateTime),
            notes: notes || ''
        };
        await call.save();
        // Schedule callback in a real implementation would involve 
        // setting up a job to trigger at the specified time
        return res.status(200).json({
            message: 'Callback scheduled successfully',
            callback: call.callback
        });
    }
    catch (error) {
        index_1.logger.error('Error in scheduleCallback:', error);
        return res.status(500).json({
            message: 'Server error',
            error: error.message
        });
    }
};
exports.scheduleCallback = scheduleCallback;
// @desc    Get call analytics (metrics and statistics)
// @route   GET /api/calls/analytics
// @access  Private
const getCallAnalytics = async (req, res) => {
    try {
        const { campaignId, startDate, endDate } = req.query;
        // Date range for analytics
        const dateQuery = {};
        if (startDate)
            dateQuery.$gte = new Date(startDate);
        if (endDate)
            dateQuery.$lte = new Date(endDate);
        // Base match criteria
        const matchCriteria = {};
        if (Object.keys(dateQuery).length > 0) {
            matchCriteria.startTime = dateQuery;
        }
        if (campaignId) {
            matchCriteria.campaign = new mongoose_1.default.Types.ObjectId(campaignId);
        }
        // Aggregate call data for analytics
        const analytics = await Call_1.default.aggregate([
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
            const outcomeCount = {};
            result.outcomeStats.forEach((outcome) => {
                if (outcome) {
                    outcomeCount[outcome] = (outcomeCount[outcome] || 0) + 1;
                }
            });
            result.outcomes = outcomeCount;
        }
        delete result.outcomeStats;
        // Get call volume by day
        const callsByDay = await Call_1.default.aggregate([
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
    }
    catch (error) {
        index_1.logger.error('Error in getCallAnalytics:', error);
        return res.status(500).json({
            message: 'Server error',
            error: error.message
        });
    }
};
exports.getCallAnalytics = getCallAnalytics;
// @desc    Export call data to CSV, JSON, or Excel
// @route   GET /api/calls/export
// @access  Private
const exportCalls = async (req, res) => {
    try {
        const { format = 'csv', status, campaignId, leadId, startDate, endDate, outcome } = req.query;
        // Build query
        const query = {};
        if (status)
            query.status = status;
        if (campaignId)
            query.campaign = campaignId;
        if (leadId)
            query.lead = leadId;
        if (outcome)
            query.outcome = outcome;
        // Date range filtering
        if (startDate || endDate) {
            query.startTime = {};
            if (startDate)
                query.startTime.$gte = new Date(startDate);
            if (endDate)
                query.startTime.$lte = new Date(endDate);
        }
        // Get calls with populated lead and campaign info
        const calls = await Call_1.default.find(query)
            .sort({ startTime: -1 })
            .populate('lead', 'name phoneNumber company email')
            .populate('campaign', 'name');
        // Process calls for export
        const exportData = calls.map((call) => ({
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
                ? header + exportData.map((row) => Object.values(row).map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n')
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
    }
    catch (error) {
        index_1.logger.error('Error in exportCalls:', error);
        return res.status(500).json({
            message: 'Server error',
            error: error.message
        });
    }
};
exports.exportCalls = exportCalls;
// @desc    Create a test call (for development/testing only)
// @route   POST /api/calls/test
// @access  Private
const createTestCall = async (req, res) => {
    try {
        const { id, leadName, leadPhone, campaignName, status = 'Initiated' } = req.body;
        // Create a mock lead
        const mockLead = new Lead_1.default({
            name: leadName || 'Test Lead',
            phoneNumber: leadPhone || '+919876543210', // Valid Indian phone number
            email: 'test@example.com',
            source: 'Test Import',
            languagePreference: 'English',
            status: 'New',
            createdBy: req.user?.id || 'test-user'
        });
        await mockLead.save();
        // Create a mock campaign
        const mockCampaign = new Campaign_1.default({
            name: campaignName || 'Test Campaign',
            description: 'Test campaign for notifications',
            goal: 'Test campaign goal',
            targetAudience: 'Test audience',
            script: {
                versions: [{
                        name: 'Default',
                        content: 'Hello, this is a test call.',
                        isActive: true
                    }]
            },
            leadSources: ['Test Import'],
            status: 'active',
            startDate: new Date(),
            primaryLanguage: 'English',
            supportedLanguages: ['English'],
            callTiming: {
                daysOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
                startTime: '09:00',
                endTime: '18:00',
                timeZone: 'Asia/Kolkata'
            },
            aiSettings: {
                model: 'gpt-3.5-turbo',
                systemPrompt: 'You are a professional sales representative.',
                maxTokens: 1000,
                temperature: 0.7
            },
            voiceSettings: {
                provider: 'elevenlabs',
                voiceId: 'default-voice',
                speed: 1.0,
                pitch: 1.0
            },
            createdBy: req.user?.id || 'test-user'
        });
        await mockCampaign.save();
        // Create the test call
        const call = new Call_1.default({
            _id: id ? new mongoose_1.default.Types.ObjectId(id.replace('test-call-', '').padStart(24, '0')) : undefined,
            lead: mockLead._id,
            campaign: mockCampaign._id,
            status,
            startTime: new Date(),
            createdBy: req.user?.id || 'test-user',
            aiPersonality: 'Professional sales representative',
            callObjective: 'Test call objective',
            notes: 'Test call for notification system'
        });
        await call.save();
        // Populate the call for the response
        const populatedCall = await Call_1.default.findById(call._id)
            .populate('lead', 'name phoneNumber')
            .populate('campaign', 'name');
        index_1.logger.info(`Test call created: ${call._id}`);
        return res.status(201).json({
            message: 'Test call created successfully',
            call: populatedCall
        });
    }
    catch (error) {
        index_1.logger.error('Error in createTestCall:', error);
        return res.status(500).json({
            message: 'Server error',
            error: error.message
        });
    }
};
exports.createTestCall = createTestCall;
//# sourceMappingURL=callController.js.map