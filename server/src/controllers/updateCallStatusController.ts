import { Request, Response } from 'express';
import Call from '../models/Call';
import { sendCallNotification } from './notificationController';

// @desc    Update call status
// @route   PUT /api/calls/:id/status
// @access  Private
export const updateCallStatus = async (req: Request & { user?: any }, res: Response): Promise<Response> => {
  try {
    const { status, notes } = req.body;
    
    if (!status) {
      return res.status(400).json({ message: 'Status is required' });
    }
    
    // Valid statuses
    const validStatuses = ['Initiated', 'Ringing', 'In-Progress', 'Completed', 'Failed', 'No-Answer', 'Busy'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ 
        message: 'Invalid status',
        validStatuses
      });
    }
    
    // Find call
    const call = await Call.findById(req.params.id)
      .populate('lead', 'name phoneNumber')
      .populate('campaign', 'name');
      
    if (!call) {
      return res.status(404).json({ message: 'Call not found' });
    }
    
    // Update status
    call.status = status;
    
    // Add notes if provided
    if (notes) {
      call.notes = notes;
    }
    
    // If completing or failing, set endTime
    if (['Completed', 'Failed', 'No-Answer', 'Busy'].includes(status)) {
      call.endTime = new Date();
      
      // Calculate duration if we have a start time
      if (call.startTime) {
        const durationMs = call.endTime.getTime() - call.startTime.getTime();
        call.duration = Math.round(durationMs / 1000); // Convert to seconds
      }
    }
    
    await call.save();
    
    // Send notification manually to ensure it's populated
    await sendCallNotification(call);
    
    return res.status(200).json({
      message: `Call status updated to ${status}`,
      call
    });
  } catch (error) {
    console.error('Error in updateCallStatus:', error);
    return res.status(500).json({
      message: 'Server error',
      error: (error as Error).message
    });
  }
};
