import express from 'express';
import {
  handleTwilioVoiceWebhook,
  handleTwilioStatusWebhook,
  handleTwilioGatherWebhook,
  handleTwilioStreamWebhook
} from '../services/webhookHandlers';
import {
  handleVoiceWebhook,
  handleStatusWebhook,
  handleRecordingWebhook
} from '../controllers/telephonyController';

const router = express.Router();

// Root webhook handler - will process incoming Twilio webhooks at the root path
router.post('/', async (req, res) => {
  const webhookType = req.query.webhookType as string || '';
  
  // Log incoming webhook for debugging
  console.log(`Received webhook at root path with type: ${webhookType}`, {
    body: req.body,
    query: req.query,
    path: req.path,
    url: req.url
  });

  // Route to appropriate handler based on webhookType query parameter
  switch (webhookType) {
    case 'voice':
      return handleTwilioVoiceWebhook(req, res);
    case 'status':
      return handleTwilioStatusWebhook(req, res);
    case 'gather':
      return handleTwilioGatherWebhook(req, res);
    case 'stream':
      return handleTwilioStreamWebhook(req, res);
    case 'recording':
      return handleTwilioStatusWebhook(req, res);
    case 'telephony-voice':
      return handleVoiceWebhook(req, res);
    case 'telephony-status':
      return handleStatusWebhook(req, res);
    case 'telephony-recording':
      return handleRecordingWebhook(req, res);
    default:
      // If no webhook type is specified, try to determine from body
      if (req.body.CallSid) {
        // This is likely a Twilio webhook
        // Default to voice webhook if we can't determine type
        return handleTwilioVoiceWebhook(req, res);
      }
      
      // If we can't determine the type, return a 404
      console.error('Unknown webhook type received at root path', {
        body: req.body,
        query: req.query
      });
      return res.status(400).json({ error: 'Unknown webhook type. Please specify webhookType in query parameters.' });
  }
});

export default router;
