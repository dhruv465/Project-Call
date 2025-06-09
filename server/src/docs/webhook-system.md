# Webhook System Documentation

## Overview

The webhook system in Project Call allows integration with external services like Twilio. This document explains how webhooks are configured and how to use the webhook URL utility to ensure consistent URL generation.

## Webhook Route Architecture

1. **Root Webhook Handler**: The application now includes a dedicated root webhook handler (`/`) that processes all incoming webhook requests. This is essential for services like Twilio that may send webhook requests to the root path.

2. **Webhook Types**: The root handler routes requests to specific handlers based on the `webhookType` query parameter:
   - `voice`: Handles initial call setup and TwiML generation
   - `status`: Processes call status updates (e.g., completed, failed)
   - `gather`: Handles DTMF input and speech recognition
   - `stream`: Manages real-time audio streaming
   - `recording`: Processes call recording notifications
   - `telephony-voice`, `telephony-status`, `telephony-recording`: Specialized telephony handlers

## Using the Webhook URL Utility

Always use the `webhookUrls` utility to generate webhook URLs rather than constructing them manually. This ensures consistency and allows for centralized changes to URL formatting.

```typescript
// Import the utility
import webhookUrls from '../utils/webhookUrls';

// Generate webhook URLs
const voiceWebhookUrl = webhookUrls.getVoiceWebhookUrl(callId);
const statusWebhookUrl = webhookUrls.getStatusWebhookUrl(callId);
const gatherWebhookUrl = webhookUrls.getGatherWebhookUrl(callId);
```

## Webhook Base URL Configuration

The system uses the `WEBHOOK_BASE_URL` environment variable to determine the base URL for all webhooks. This must be configured correctly in production:

- In development: Usually an ngrok URL like `https://xxxx-xxx-xxx-xx.ngrok-free.app`
- In production: Your application's public URL like `https://your-domain.com`

## Testing Webhooks

Use the `verify-twilio-webhooks.js` script to test webhook functionality:

```bash
node verify-twilio-webhooks.js
```

## Troubleshooting

Common webhook issues:

1. **404 "Route not found"**: Ensure the root webhook handler is mounted correctly in `index.ts`
2. **Invalid webhook responses**: Check that the appropriate TwiML is being returned
3. **Authentication errors**: Validate Twilio signature if enabled
4. **Missing environment variables**: Verify `WEBHOOK_BASE_URL` is set correctly

## Best Practices

1. Always use the `webhookUrls` utility for generating webhook URLs
2. Include appropriate error handling in webhook routes
3. Keep webhook handlers simple and focused
4. Use detailed logging for webhook requests to assist with debugging
