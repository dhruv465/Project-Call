import twilio from 'twilio';
import mongoose from 'mongoose';
import logger from '../utils/logger';
import Call, { ICall } from '../models/Call';
import Configuration from '../models/Configuration';
import { Redis } from 'ioredis';
import CircuitBreaker from 'opossum';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import retry from 'async-retry';
import { parsePhoneNumberFromString } from 'libphonenumber-js';

// Redis client for distributed rate limiting and circuit breaking
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Configure rate limiters for different operations
const outboundCallLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'limiter:outbound-calls',
  points: 30, // 30 calls per minute
  duration: 60,
});

// Per phone number rate limiter (compliance)
const phoneNumberLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'limiter:phone-number',
  points: 2, // 2 calls per number per day
  duration: 86400,
});

// Configure circuit breaker for Twilio API
const twilioCircuitBreakerOptions = {
  timeout: 10000,
  errorThresholdPercentage: 30,
  resetTimeout: 30000,
  rollingCountTimeout: 60000,
};

// Create circuit breaker for Twilio calls
const makeCallCircuitBreaker = new CircuitBreaker(
  async (client: twilio.Twilio, params: any) => {
    return await client.calls.create(params);
  },
  twilioCircuitBreakerOptions
);

export interface CallConfiguration {
  leadId: string | mongoose.Types.ObjectId;
  campaignId: string | mongoose.Types.ObjectId;
  phoneNumber: string;
  personalityId?: string;
  abTestVariantId?: string;
  priority: 'low' | 'medium' | 'high';
  scheduledAt?: Date;
  maxRetries?: number;
  callbackUrl: string;
  callId?: string; 
  recordCall?: boolean;
  complianceScriptId?: string;
  smartDialingWindow?: boolean;
  customHeaders?: Record<string, string>;
  detectAnsweringMachine?: 'Continue' | 'Hangup' | 'DetectMessageEnd';
  timeZone?: string;
  disableCallDeduplication?: boolean;
  callReasons?: string[];
}

export interface CallMetrics {
  duration: number;
  outcome: 'connected' | 'no-answer' | 'busy' | 'failed' | 'voicemail';
  conversationMetrics: {
    customerEngagement: number;
    emotionalTone: string[];
    objectionCount: number;
    interruptionCount: number;
    conversionIndicators: string[];
  };
  qualityScore: number;
  complianceScore?: number;
  intentDetection?: {
    primaryIntent: string;
    confidence: number;
    secondaryIntents: Array<{intent: string, confidence: number}>;
  };
  callRecordingUrl?: string;
  transcriptionAnalysis?: {
    keyPhrases: string[];
    sentimentBySegment: Array<{segment: string, sentiment: number}>;
    followUpRecommendations: string[];
  };
}

export class AdvancedTelephonyService {
  private twilioClient: twilio.Twilio | null = null;
  private callQueue: Map<string, CallConfiguration> = new Map();
  private activeConversations: Map<string, any> = new Map();
  private fallbackVoiceProvider: any | null = null;
  private activeDialerStatus: 'active' | 'paused' | 'stopped' = 'stopped';
  private configuration: any = null;
  private dialingWindowsByTimezone: Record<string, {start: number, end: number}> = {
    'America/New_York': {start: 9, end: 20},
    'America/Chicago': {start: 9, end: 20},
    'America/Denver': {start: 9, end: 20},
    'America/Los_Angeles': {start: 9, end: 20},
    'default': {start: 9, end: 20}
  };

  constructor() {
    // Initialize with database configuration
    this.initializeWithConfiguration();
  }

  /**
   * Initialize Twilio client with database configuration
   */
  private async initializeWithConfiguration(): Promise<void> {
    try {
      this.configuration = await Configuration.findOne();
      
      if (!this.configuration || !this.configuration.twilioConfig.isEnabled) {
        logger.warn('Twilio configuration not found or disabled. Telephony features will be limited.');
        return;
      }

      this.twilioClient = twilio(
        this.configuration.twilioConfig.accountSid,
        this.configuration.twilioConfig.authToken
      );
      
      logger.info('Twilio client initialized with database configuration');
      
      // Setup error event handlers
      makeCallCircuitBreaker.on('open', () => {
        logger.error('Twilio call circuit breaker tripped - too many failures');
      });
      
      makeCallCircuitBreaker.on('halfOpen', () => {
        logger.info('Twilio call circuit breaker attempting to recover...');
      });
      
      makeCallCircuitBreaker.on('close', () => {
        logger.info('Twilio call circuit breaker closed - service healthy');
      });
      
      // Start periodic cleanup of expired conversations
      setInterval(() => this.cleanupStaleConversations(), 60000);
    } catch (error) {
      logger.error('Error initializing advanced telephony service:', error);
    }
  }

  /**
   * Ensure configuration is loaded and Twilio client is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.twilioClient || !this.configuration) {
      await this.initializeWithConfiguration();
    }
    
    if (!this.twilioClient) {
      throw new Error('Twilio client not initialized - check configuration');
    }
  }

  /**
   * Update configuration dynamically without restart
   */
  async updateConfiguration(): Promise<void> {
    await this.initializeWithConfiguration();
    logger.info('Advanced telephony service configuration updated');
  }

  /**
   * Queue a new outbound call with advanced configuration options
   */
  async makeCall(config: CallConfiguration): Promise<string> {
    try {
      await this.ensureInitialized();
      
      // Validate configuration
      if (!config.phoneNumber) {
        throw new Error('Phone number is required');
      }
      
      // Normalize phone number
      try {
        const phoneInfo = parsePhoneNumberFromString(config.phoneNumber);
        if (phoneInfo) {
          config.phoneNumber = phoneInfo.format('E.164');
        }
      } catch (error) {
        logger.warn(`Invalid phone number format: ${config.phoneNumber}`, error);
      }
      
      // Check compliance - daily call limits
      if (!config.disableCallDeduplication) {
        try {
          await phoneNumberLimiter.consume(config.phoneNumber);
        } catch (error) {
          logger.warn(`Rate limit exceeded for number ${config.phoneNumber}: ${error.message}`);
          throw new Error('Daily call limit exceeded for this phone number');
        }
      }
      
      // Check smart dialing window
      if (config.smartDialingWindow && !this.isWithinDialingWindow(config.timeZone)) {
        logger.info(`Call to ${config.phoneNumber} scheduled outside dialing window`);
        return this.scheduleCall(config);
      }
      
      // Apply rate limiting for outbound calls
      try {
        await outboundCallLimiter.consume('global');
      } catch (error) {
        logger.warn(`Outbound call rate limit exceeded: ${error.message}`);
        throw new Error('Call rate limit exceeded');
      }
      
      // Create call record in database
      const callRecord = new Call({
        leadId: config.leadId,
        campaignId: config.campaignId,
        phoneNumber: config.phoneNumber,
        status: 'queued',
        personalityId: config.personalityId,
        abTestVariantId: config.abTestVariantId,
        scheduledAt: config.scheduledAt || new Date(),
        priority: config.priority || 'medium',
        callReasons: config.callReasons || [],
        complianceScriptId: config.complianceScriptId,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      const savedCall = await callRecord.save();
      const callId = savedCall._id.toString();
      
      // Add to queue
      config.callId = callId;
      this.callQueue.set(callId, config);
      
      // Initiate call with retry mechanism
      const twilioCall = await retry(
        async () => this.initiateCall(config),
        {
          retries: config.maxRetries || 3,
          factor: 2,
          minTimeout: 1000,
          maxTimeout: 5000,
          onRetry: (error, attempt) => {
            logger.warn(`Call attempt ${attempt} failed for ${config.phoneNumber}: ${error.message}`);
          }
        }
      );
      
      // Update call record with Twilio SID
      await Call.findByIdAndUpdate(callId, {
        $set: {
          twilioSid: twilioCall.sid,
          status: 'initiated',
          updatedAt: new Date()
        }
      });
      
      logger.info(`Call queued successfully with ID: ${callId}`);
      return callId;
      
    } catch (error) {
      logger.error('Error making call:', error);
      throw error;
    }
  }

  /**
   * Initiate a call using Twilio API with circuit breaker
   */
  private async initiateCall(config: CallConfiguration): Promise<any> {
    try {
      await this.ensureInitialized();
      
      const callParams: any = {
        to: config.phoneNumber,
        from: this.configuration.twilioConfig.phoneNumber,
        url: `${config.callbackUrl}?callId=${config.callId}`,
        statusCallback: `${config.callbackUrl}/status?callId=${config.callId}`,
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
        statusCallbackMethod: 'POST',
        method: 'POST',
        timeout: 30,
        fallbackUrl: `${config.callbackUrl}/fallback?callId=${config.callId}`,
        fallbackMethod: 'POST'
      };
      
      // Add recording if requested
      if (config.recordCall) {
        callParams.record = true;
        callParams.recordingStatusCallback = `${config.callbackUrl}/recording?callId=${config.callId}`;
        callParams.recordingStatusCallbackMethod = 'POST';
      }
      
      // Configure answering machine detection
      if (config.detectAnsweringMachine) {
        callParams.machineDetection = 'Enable';
        callParams.machineDetectionTimeout = 5;
        callParams.machineDetectionAction = config.detectAnsweringMachine;
      }
      
      // Add custom headers if provided
      if (config.customHeaders) {
        callParams.headers = JSON.stringify(config.customHeaders);
      }
      
      // Place the call using circuit breaker
      logger.debug(`Making call to ${config.phoneNumber}`);
      const call = await makeCallCircuitBreaker.fire(this.twilioClient!, callParams);
      
      logger.info(`Call initiated to ${config.phoneNumber} with SID: ${call.sid}`);
      return call;
      
    } catch (error) {
      logger.error(`Error initiating call to ${config.phoneNumber}:`, error);
      throw error;
    }
  }

  /**
   * Check if current time is within allowed dialing window for timezone
   */
  private isWithinDialingWindow(timeZone?: string): boolean {
    const now = new Date();
    const zone = timeZone || 'default';
    const window = this.dialingWindowsByTimezone[zone] || this.dialingWindowsByTimezone.default;
    
    const currentHour = now.getHours();
    return currentHour >= window.start && currentHour < window.end;
  }

  /**
   * Schedule a call for later execution
   */
  private async scheduleCall(config: CallConfiguration): Promise<string> {
    // Implementation would depend on your scheduling system
    // For now, we'll just set a scheduledAt time for the next valid dialing window
    const scheduledAt = this.getNextDialingWindow(config.timeZone);
    config.scheduledAt = scheduledAt;
    
    logger.info(`Call to ${config.phoneNumber} scheduled for ${scheduledAt}`);
    return 'scheduled';
  }

  /**
   * Get the next valid dialing window time
   */
  private getNextDialingWindow(timeZone?: string): Date {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const zone = timeZone || 'default';
    const window = this.dialingWindowsByTimezone[zone] || this.dialingWindowsByTimezone.default;
    
    tomorrow.setHours(window.start, 0, 0, 0);
    return tomorrow;
  }

  /**
   * Clean up stale conversations and queue entries
   */
  private async cleanupStaleConversations(): Promise<void> {
    const staleThreshold = Date.now() - (30 * 60 * 1000); // 30 minutes
    
    for (const [callId, conversation] of this.activeConversations.entries()) {
      if (conversation.lastActivity < staleThreshold) {
        logger.debug(`Cleaning up stale conversation: ${callId}`);
        this.activeConversations.delete(callId);
        this.callQueue.delete(callId);
      }
    }
  }

  /**
   * Save conversation metrics to the database
   */
  private async saveConversationMetrics(callId: string, metrics: CallMetrics): Promise<void> {
    try {
      await Call.findOneAndUpdate(
        { _id: callId },
        { 
          $set: { 
            metrics,
            updatedAt: new Date()
          }
        }
      );
      logger.debug(`Saved metrics for call ${callId}`);
    } catch (error) {
      logger.error(`Error saving call metrics for ${callId}:`, error);
      throw error;
    }
  }

  /**
   * Update the status of a call in the database
   */
  private async updateCallStatus(
    callId: string, 
    status: ICall['status'], 
    additionalData: Record<string, any> = {}
  ): Promise<void> {
    try {
      await Call.findByIdAndUpdate(
        callId,
        {
          $set: {
            status,
            updatedAt: new Date(),
            ...additionalData
          }
        }
      );
      logger.debug(`Updated call ${callId} status to: ${status}`);
    } catch (error) {
      logger.error(`Error updating call status for ${callId}:`, error);
      throw error;
    }
  }

  /**
   * Handle voice webhooks from Twilio
   */
  async handleVoiceWebhook(req: any, res: any): Promise<void> {
    const callId = req.query.callId;
    
    try {
      logger.debug(`Received voice webhook for call ${callId}`);
      
      // Update call status to answered
      await this.updateCallStatus(callId, 'in-progress', {
        answeredAt: new Date()
      });
      
      // Initialize conversation tracking
      this.activeConversations.set(callId, {
        startTime: Date.now(),
        lastActivity: Date.now(),
        metrics: {
          duration: 0,
          outcome: 'connected',
          conversationMetrics: {
            customerEngagement: 0,
            emotionalTone: [],
            objectionCount: 0,
            interruptionCount: 0,
            conversionIndicators: []
          },
          qualityScore: 0
        },
        needsFinalSave: true
      });
      
      // Return TwiML response to handle the call
      const twiml = new twilio.twiml.VoiceResponse();
      
      // Add a greeting or redirect to your voice AI handler
      twiml.say({
        voice: 'alice',
        language: 'en-US'
      }, 'Hello, please hold while I connect you to our AI assistant.');
      
      // You would typically redirect to your voice AI service here
      twiml.redirect(`${req.query.callbackUrl}/voice-ai?callId=${callId}`);
      
      res.type('text/xml');
      res.send(twiml.toString());
      
    } catch (error) {
      logger.error(`Error in voice webhook for call ${callId}:`, error);
      
      const twiml = new twilio.twiml.VoiceResponse();
      twiml.say('We apologize, but there was an error. Please try again later.');
      twiml.hangup();
      
      res.type('text/xml');
      res.send(twiml.toString());
    }
  }

  /**
   * Handle status update webhooks from Twilio
   */
  async handleStatusWebhook(req: any, res: any): Promise<void> {
    const callId = req.query.callId;
    const callStatus = req.body.CallStatus;
    const callDuration = parseInt(req.body.CallDuration || '0', 10);
    
    try {
      logger.debug(`Received status webhook for call ${callId}: ${callStatus}`);
      
      // Map Twilio statuses to internal statuses
      const statusMap: Record<string, ICall['status']> = {
        'queued': 'queued',
        'initiated': 'dialing',
        'ringing': 'dialing',
        'in-progress': 'in-progress',
        'completed': 'completed',
        'busy': 'busy',
        'failed': 'failed',
        'no-answer': 'no-answer',
        'canceled': 'failed'
      };
      
      const internalStatus = statusMap[callStatus] || 'failed';
      
      if (callStatus === 'completed') {
        await this.updateCallStatus(callId, internalStatus, {
          endTime: new Date(),
          duration: callDuration
        });
        
        const conversation = this.activeConversations.get(callId);
        if (conversation && conversation.needsFinalSave) {
          await this.saveConversationMetrics(callId, {
            ...conversation.metrics,
            duration: callDuration,
            outcome: 'connected'
          });
          conversation.needsFinalSave = false;
        }
        
        this.callQueue.delete(callId);
        this.activeConversations.delete(callId);
      } else if (['failed', 'busy', 'no-answer'].includes(callStatus)) {
        await this.updateCallStatus(callId, internalStatus, {
          endTime: new Date(),
          failureCode: callStatus
        });
      } else {
        await this.updateCallStatus(callId, internalStatus);
      }
      
      res.status(200).send('Status update received');
      
    } catch (error) {
      logger.error(`Error in status webhook for call ${callId}:`, error);
      res.status(500).send('Error processing status update');
    }
  }

  /**
   * Handle recording webhooks from Twilio
   */
  async handleRecordingWebhook(req: any, res: any): Promise<void> {
    const callId = req.query.callId;
    const recordingUrl = req.body.RecordingUrl;
    
    try {
      logger.debug(`Received recording webhook for call ${callId}: ${recordingUrl}`);
      
      await Call.findByIdAndUpdate(callId, {
        $set: {
          recordingUrl,
          'metrics.callRecordingUrl': recordingUrl
        }
      });
      
      res.status(200).send('Recording processed');
      
    } catch (error) {
      logger.error(`Error in recording webhook for call ${callId}:`, error);
      res.status(500).send('Error processing recording');
    }
  }

  /**
   * Get call queue status
   */
  getQueueStatus(): any {
    return {
      totalQueued: this.callQueue.size,
      activeConversations: this.activeConversations.size,
      dialerStatus: this.activeDialerStatus
    };
  }

  /**
   * Pause the dialer
   */
  pauseDialer(): void {
    this.activeDialerStatus = 'paused';
    logger.info('Advanced telephony dialer paused');
  }

  /**
   * Resume the dialer
   */
  resumeDialer(): void {
    this.activeDialerStatus = 'active';
    logger.info('Advanced telephony dialer resumed');
  }

  /**
   * Stop the dialer
   */
  stopDialer(): void {
    this.activeDialerStatus = 'stopped';
    logger.info('Advanced telephony dialer stopped');
  }
}

export const advancedTelephonyService = new AdvancedTelephonyService();
