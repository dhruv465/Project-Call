import { Request, Response } from 'express';
import Call from '../models/Call';
import { io, logger } from '../index';
import { handleError } from '../utils/errorHandling';

// @desc    Get recent call notifications for a user
// @route   GET /api/notifications/calls
// @access  Private
export const getCallNotifications = async (req: Request & { user?: any }, res: Response) => {
  try {
    const userId = req.user.id;
    
    // Get recent call notifications for this user (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const calls = await Call.find({
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
      leadName: (call.lead as any)?.name || 'Unknown Lead',
      leadPhone: (call.lead as any)?.phoneNumber || 'N/A',
      campaignName: (call.campaign as any)?.name || 'Unknown Campaign',
      status: call.status.toLowerCase(),
      timestamp: call.startTime,
      // For simplicity, all existing notifications are considered read
      read: true
    }));
    
    res.status(200).json({ notifications });
  } catch (error) {
    logger.error('Error in getCallNotifications:', error);
    res.status(500).json({
      message: 'Server error',
      error: handleError(error)
    });
  }
};

// @desc    Mark notifications as read
// @route   PUT /api/notifications/read
// @access  Private
export const markNotificationsAsRead = async (_req: Request & { user?: any }, res: Response) => {
  try {
    // In a real implementation, we would update a notifications collection
    // For now, just acknowledge the request
    
    res.status(200).json({ success: true });
  } catch (error) {
    logger.error('Error in markNotificationsAsRead:', error);
    res.status(500).json({
      message: 'Server error',
      error: handleError(error)
    });
  }
};

// Utility function to send call notifications via socket.io
export const sendCallNotification = (call: any) => {
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
      io.to(`user-${call.createdBy}`).emit('call-status-update', notification);
    }
    
    // Also broadcast to campaign room for team monitoring
    if (call.campaign) {
      io.to(`campaign-${call.campaign}`).emit('call-status-update', notification);
    }
    
    // Broadcast to "all" room for admins who are monitoring all calls
    io.to('campaign-all').emit('call-status-update', notification);
    
    logger.info(`Call notification sent for call ${call._id}, status: ${call.status}`);
  } catch (error) {
    logger.error('Error sending call notification:', error);
  }
};

export default {
  getCallNotifications,
  markNotificationsAsRead,
  sendCallNotification
};
