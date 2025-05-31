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

const router = express.Router();

// All routes are protected
router.use(authenticate);

// Call management routes
router.post('/initiate', initiateCall);
router.get('/', getCallHistory);
router.get('/analytics', getCallAnalytics);
router.get('/export', exportCalls);
router.get('/:id', getCallById);
router.get('/:id/recording', getCallRecording);
router.get('/:id/transcript', getCallTranscript);
router.put('/:id/status', updateCallStatus);
router.post('/:id/schedule-callback', scheduleCallback);

export default router;
