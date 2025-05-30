"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendCallNotification = exports.markNotificationsAsRead = exports.getCallNotifications = void 0;
const Call_1 = __importDefault(require("../models/Call"));
const index_1 = require("../index");
const errorHandling_1 = require("../utils/errorHandling");
// @desc    Get recent call notifications for a user
// @route   GET /api/notifications/calls
// @access  Private
const getCallNotifications = async (req, res) => {
    try {
        const userId = req.user.id;
        // Get recent call notifications for this user (last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const calls = await Call_1.default.find({
            createdBy: userId,
            startTime: { $gte: sevenDaysAgo }
        })
            .sort({ startTime: -1 })
            .limit(50)
            .populate('lead', 'name phoneNumber')
            .populate('campaign', 'name');
        // Convert to notification format
        const notifications = calls.map(call => ({
            id: call._id,
            leadName: call.lead?.name || 'Unknown Lead',
            leadPhone: call.lead?.phoneNumber || 'N/A',
            campaignName: call.campaign?.name || 'Unknown Campaign',
            status: call.status.toLowerCase(),
            timestamp: call.startTime,
            // For simplicity, all existing notifications are considered read
            read: true
        }));
        res.status(200).json({ notifications });
    }
    catch (error) {
        index_1.logger.error('Error in getCallNotifications:', error);
        res.status(500).json({
            message: 'Server error',
            error: (0, errorHandling_1.handleError)(error)
        });
    }
};
exports.getCallNotifications = getCallNotifications;
// @desc    Mark notifications as read
// @route   PUT /api/notifications/read
// @access  Private
const markNotificationsAsRead = async (_req, res) => {
    try {
        // In a real implementation, we would update a notifications collection
        // For now, just acknowledge the request
        res.status(200).json({ success: true });
    }
    catch (error) {
        index_1.logger.error('Error in markNotificationsAsRead:', error);
        res.status(500).json({
            message: 'Server error',
            error: (0, errorHandling_1.handleError)(error)
        });
    }
};
exports.markNotificationsAsRead = markNotificationsAsRead;
// Utility function to send call notifications via socket.io
const sendCallNotification = (call) => {
    try {
        // Format the notification
        const notification = {
            callId: call._id,
            leadName: call.lead?.name || 'Unknown Lead',
            leadPhone: call.lead?.phoneNumber || 'N/A',
            campaignName: call.campaign?.name || 'Unknown Campaign',
            status: call.status.toLowerCase(),
        };
        // Broadcast to specific user's room
        if (call.createdBy) {
            index_1.io.to(`user-${call.createdBy}`).emit('call-status-update', notification);
        }
        // Also broadcast to campaign room for team monitoring
        if (call.campaign) {
            index_1.io.to(`campaign-${call.campaign}`).emit('call-status-update', notification);
        }
        // Broadcast to "all" room for admins who are monitoring all calls
        index_1.io.to('campaign-all').emit('call-status-update', notification);
        index_1.logger.info(`Call notification sent for call ${call._id}, status: ${call.status}`);
    }
    catch (error) {
        index_1.logger.error('Error sending call notification:', error);
    }
};
exports.sendCallNotification = sendCallNotification;
exports.default = {
    getCallNotifications: exports.getCallNotifications,
    markNotificationsAsRead: exports.markNotificationsAsRead,
    sendCallNotification: exports.sendCallNotification
};
//# sourceMappingURL=notificationController.js.map