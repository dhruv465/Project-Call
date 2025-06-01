import express from 'express';
import { authenticate } from '../middleware/auth';
import {
  initiateCall,
  getCallHistory,
  getCallById,
  getCallRecording,
  getCallTranscript,
  scheduleCallback,
  getCallAnalytics,
  exportCalls
} from '../controllers/callController';
import { updateCallStatus } from '../controllers/updateCallStatusController';
import { webhookHandlers } from '../services';

const router = express.Router();

// Protected routes
router.use('/initiate', authenticate);
router.use('/analytics', authenticate);
router.use('/export', authenticate);
router.use('/history', authenticate);

// Webhook routes - these should not be authenticated
router.post('/voice-webhook', webhookHandlers.handleTwilioVoiceWebhook);
router.post('/status-webhook', webhookHandlers.handleTwilioStatusWebhook);
router.post('/gather', webhookHandlers.handleTwilioGatherWebhook);
router.post('/stream', webhookHandlers.handleTwilioStreamWebhook);

// Call management routes
router.post('/initiate', initiateCall);
router.get('/', getCallHistory);
router.get('/analytics', getCallAnalytics);
router.get('/export', exportCalls);
router.get('/:id', authenticate, getCallById);
router.get('/:id/recording', authenticate, getCallRecording);
router.get('/:id/transcript', authenticate, getCallTranscript);
router.put('/:id/status', authenticate, updateCallStatus);
router.post('/:id/schedule-callback', authenticate, scheduleCallback);

export default router;
