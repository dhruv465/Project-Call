import express from 'express';
import { getCallNotifications, markNotificationsAsRead } from '../controllers/notificationController';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticate);

// Get call notifications
router.get('/calls', getCallNotifications);

// Mark notifications as read
router.put('/read', markNotificationsAsRead);

export default router;
