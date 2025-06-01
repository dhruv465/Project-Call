import twilio from 'twilio';
import logger from '../utils/logger';
import Call, { ICall } from '../models/Call';
import { voiceAIService, conversationEngine } from '../services';
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
  points: Number(process.env.OUTBOUND_CALL_LIMIT_PER_MINUTE) || 30,
  duration: 60, // Per minute
});

// Per phone number rate limiter (compliance)
const phoneNumberLimiter = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: 'limiter:phone-number',
  points: Number(process.env.CALL_LIMIT_PER_NUMBER_DAILY) || 2,
  duration: 86400, // Per day
});

// Configure circuit breaker for Twilio API
const twilioCircuitBreakerOptions = {
  timeout: 10000, // If our function takes longer than 10 seconds, trigger a failure
  errorThresholdPercentage: 30, // When 30% of requests fail, trip the circuit
  resetTimeout: 30000, // After 30 seconds, try again
  rollingCountTimeout: 60000, // Collect statistics for the last minute
};

// Create circuit breaker for Twilio calls
const makeCallCircuitBreaker = new CircuitBreaker(
  async (client: twilio.Twilio, params: any) => {
    return await client.calls.create(params);
  },
  twilioCircuitBreakerOptions
);

export interface CallConfiguration {
  leadId: string;
  campaignId: string;
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
  private twilioClient: twilio.Twilio;
  private callQueue: Map<string, CallConfiguration> = new Map();
  private activeConversations: Map<string, any> = new Map();
  private fallbackVoiceProvider: any | null = null;
  private activeDialerStatus: 'active' | 'paused' | 'stopped' = 'stopped';
  private dialingWindowsByTimezone: Record<string, {start: number, end: number}> = {
    'America/New_York': {start: 9, end: 20},
    'America/Chicago': {start: 9, end: 20},
    'America/Denver': {start: 9, end: 20},
    'America/Los_Angeles': {start: 9, end: 20},
    'default': {start: 9, end: 20}
  };

  constructor() {
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
      logger.warn('Twilio credentials not configured. Telephony features will be limited.');
      return;
    }
    
    this.twilioClient = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
    
    // Configure fallback voice provider if available
    if (process.env.FALLBACK_VOICE_PROVIDER === 'nexmo' && 
        process.env.NEXMO_API_KEY && 
        process.env.NEXMO_API_SECRET) {
      this.initializeFallbackProvider('nexmo');
    } else if (process.env.FALLBACK_VOICE_PROVIDER === 'plivo' && 
               process.env.PLIVO_AUTH_ID && 
               process.env.PLIVO_AUTH_TOKEN) {
      this.initializeFallbackProvider('plivo');
    }
    
    // Initialize dialing windows from env if available
    if (process.env.DIALING_WINDOWS) {
      try {
        this.dialingWindowsByTimezone = JSON.parse(process.env.DIALING_WINDOWS);
      } catch (e) {
        logger.error('Failed to parse DIALING_WINDOWS env variable', e);
      }
    }
    
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
  }
  
  private initializeFallbackProvider(provider: 'nexmo' | 'plivo'): void {
    try {
      if (provider === 'nexmo') {
        // Initialize Nexmo client
        const Nexmo = require('nexmo');
        this.fallbackVoiceProvider = new Nexmo({
          apiKey: process.env.NEXMO_API_KEY,
          apiSecret: process.env.NEXMO_API_SECRET,
        });
        logger.info('Initialized Nexmo as fallback voice provider');
      } else if (provider === 'plivo') {
        // Initialize Plivo client
        const plivo = require('plivo');
        this.fallbackVoiceProvider = new plivo.Client(
          process.env.PLIVO_AUTH_ID,
          process.env.PLIVO_AUTH_TOKEN
        );
        logger.info('Initialized Plivo as fallback voice provider');
      }
    } catch (error) {
      logger.error(`Failed to initialize fallback provider ${provider}`, error);
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
            ...additionalData,
            updatedAt: new Date()
          }
        }
      );
      logger.debug(`Updated call ${callId} status to ${status}`);
    } catch (error) {
      logger.error(`Error updating call status for ${callId}:`, error);
      throw error;
    }
  }

  /**
   * Update a call with outcome and notes
   */
  async updateCallWithOutcome(callId: string, outcome: string, notes?: string): Promise<ICall | null> {
    return await import('./webhookHandlers').then(handlers => handlers.updateCallWithOutcome(callId, outcome, notes));
  }

  /**
   * Initiate a call using Twilio (or fallback provider if configured)
   */
  private async initiateCall(config: CallConfiguration): Promise<any> {
    if (!this.twilioClient) {
      throw new Error('Twilio client not initialized');
    }
    
    try {
      // Check if we can make the call through Twilio
      const useCircuitBreaker = process.env.USE_CIRCUIT_BREAKER === 'true';
      
      // Prepare call parameters
      const callParams: any = {
        to: config.phoneNumber,
        from: process.env.TWILIO_PHONE_NUMBER,
        url: `${process.env.SERVER_BASE_URL}/api/calls/voice-webhook?callId=${config.callId}`,
        statusCallback: `${process.env.SERVER_BASE_URL}/api/calls/status-webhook?callId=${config.callId}`,
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
        statusCallbackMethod: 'POST',
        record: config.recordCall === true,
      };
      
      // Add machine detection if configured
      if (config.detectAnsweringMachine) {
        callParams.machineDetection = 'Enable';
        callParams.machineDetectionTimeout = 5; // seconds
        callParams.machineDetectionAction = config.detectAnsweringMachine;
      }
      
      // Add custom headers if provided
      if (config.customHeaders) {
        // Headers must be encoded as a string for Twilio
        callParams.headers = JSON.stringify(config.customHeaders);
      }
      
      // Add timeout handling
      callParams.timeout = process.env.CALL_TIMEOUT ? parseInt(process.env.CALL_TIMEOUT) : 15;
      
      // Place the call with circuit breaker if enabled
      let call;
      if (useCircuitBreaker) {
        logger.debug(`Making call to ${config.phoneNumber} with circuit breaker`);
        call = await makeCallCircuitBreaker.fire(this.twilioClient, callParams);
      } else {
        logger.debug(`Making call to ${config.phoneNumber} directly`);
        call = await this.twilioClient.calls.create(callParams);
      }
      
      logger.info(`Call initiated to ${config.phoneNumber} with SID: ${call.sid}`);
      return call;
    } catch (error) {
      // If circuit breaker is open or Twilio fails, try fallback provider
      if ((error.name === 'CircuitBreakerError' || error.code >= 500) && this.fallbackVoiceProvider) {
        logger.warn(`Twilio call failed, trying fallback provider: ${error.message}`);
        return this.initiateCallWithFallbackProvider(config);
      }
      
      logger.error(`Error initiating call to ${config.phoneNumber}:`, error);
      throw error;
    }
  }
  
  /**
   * Use a fallback provider to make a call when Twilio is unavailable
   */
  private async initiateCallWithFallbackProvider(config: CallConfiguration): Promise<any> {
    if (!this.fallbackVoiceProvider) {
      throw new Error('No fallback provider configured');
    }
    
    try {
      if (process.env.FALLBACK_VOICE_PROVIDER === 'nexmo') {
        // Nexmo/Vonage implementation
        const call = await this.fallbackVoiceProvider.calls.create({
          to: [{ type: 'phone', number: config.phoneNumber.replace(/^\+/, '') }],
          from: { type: 'phone', number: process.env.NEXMO_PHONE_NUMBER?.replace(/^\+/, '') },
          answer_url: [`${process.env.SERVER_BASE_URL}/api/calls/nexmo-webhook?callId=${config.callId}`],
          event_url: [`${process.env.SERVER_BASE_URL}/api/calls/nexmo-events?callId=${config.callId}`]
        });
        logger.info(`Nexmo call initiated with ID: ${call.uuid}`);
        return { sid: call.uuid };
      } else if (process.env.FALLBACK_VOICE_PROVIDER === 'plivo') {
        // Plivo implementation
        const call = await this.fallbackVoiceProvider.calls.make(
          process.env.PLIVO_PHONE_NUMBER,
          config.phoneNumber,
          `${process.env.SERVER_BASE_URL}/api/calls/plivo-webhook?callId=${config.callId}`
        );
        logger.info(`Plivo call initiated with ID: ${call.requestUuid}`);
        return { sid: call.requestUuid };
      }
      
      throw new Error(`Unsupported fallback provider: ${process.env.FALLBACK_VOICE_PROVIDER}`);
    } catch (error) {
      logger.error(`Error with fallback provider:`, error);
      throw error;
    }
  }

  /**
   * Queue a new outbound call with advanced configuration options
   */
  async makeCall(config: CallConfiguration): Promise<string> {
    try {
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
        // Continue with original number
      }
      
      // Check compliance - daily call limits
      if (!config.disableCallDeduplication) {
        try {
          await phoneNumberLimiter.consume(config.phoneNumber);
        } catch (error) {
          logger.warn(`Rate limit exceeded for number ${config.phoneNumber}: ${error.message}`);
          throw new Error(`Daily call limit reached for this number`);
        }
      }

      // Check if within allowed dialing window
      if (config.smartDialingWindow && !this.isWithinDialingWindow(config.phoneNumber, config.timeZone)) {
        logger.info(`Call to ${config.phoneNumber} outside of allowed dialing window for ${config.timeZone || 'default timezone'}`);
        
        // Reschedule for next available window
        const rescheduledCall = await this.rescheduleForNextWindow(config);
        return rescheduledCall;
      }
      
      // Generate call ID if not provided
      const callId = config.callId || `call_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
      
      // Create call record
      const callRecord = await Call.create({
        _id: callId,
        leadId: config.leadId,
        campaignId: config.campaignId,
        phoneNumber: config.phoneNumber,
        status: 'queued',
        priority: config.priority,
        scheduledAt: config.scheduledAt || new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        personalityId: config.personalityId,
        abTestVariantId: config.abTestVariantId,
        maxRetries: config.maxRetries || 0,
        retryCount: 0,
        callbackUrl: config.callbackUrl,
        recordCall: config.recordCall === true,
        complianceScriptId: config.complianceScriptId,
        callReasons: config.callReasons || []
      });
      
      // Add to call queue
      this.callQueue.set(callId, { ...config, callId });
      
      logger.info(`Call queued: ${callId} for ${config.phoneNumber} with priority ${config.priority}`);
      
      // Schedule immediate execution if no scheduled time or based on priority
      if (!config.scheduledAt || config.scheduledAt <= new Date()) {
        // Prioritize calls based on priority setting
        const delayByPriority = {
          'high': 0,
          'medium': 100,
          'low': 500
        };
        
        setTimeout(() => this.processCall(callId), delayByPriority[config.priority]);
      } else {
        // Schedule for later
        const delay = config.scheduledAt.getTime() - Date.now();
        setTimeout(() => this.processCall(callId), delay);
      }

      return callRecord._id.toString();
    } catch (error) {
      logger.error('Error queueing call:', error);
      throw new Error(`Failed to queue call: ${error.message}`);
    }
  }

  // Queue Management
  async queueCall(config: CallConfiguration): Promise<string> {
    try {
      const callId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Create call record in database
      const callRecord = new Call({
        leadId: config.leadId,
        campaignId: config.campaignId,
        phoneNumber: config.phoneNumber,
        status: 'queued',
        priority: config.priority,
        scheduledAt: config.scheduledAt || new Date(),
        maxRetries: config.maxRetries || 3,
        metadata: {
          personalityId: config.personalityId,
          abTestVariantId: config.abTestVariantId
        }
      });

      await callRecord.save();
      
      // Add to queue
      this.callQueue.set(callId, { ...config, callId });
      
      logger.info(`Call queued: ${callId} for ${config.phoneNumber}`);
      
      // Schedule immediate execution if no scheduled time
      if (!config.scheduledAt || config.scheduledAt <= new Date()) {
        setImmediate(() => this.processCall(callId));
      } else {
        // Schedule for later
        const delay = config.scheduledAt.getTime() - Date.now();
        setTimeout(() => this.processCall(callId), delay);
      }

      return callRecord._id.toString();
    } catch (error) {
      logger.error('Error queueing call:', error);
      throw new Error('Failed to queue call');
    }
  }

  /**
   * Reschedule a call for the next available dialing window
   */
  private async rescheduleForNextWindow(config: CallConfiguration): Promise<string> {
    try {
      // Try to detect timezone from phone number if not provided
      let targetTimezone = config.timeZone || 'default';
      
      if (!config.timeZone) {
        const phoneInfo = parsePhoneNumberFromString(config.phoneNumber);
        if (phoneInfo) {
          const countryCode = phoneInfo.country;
          // Map country to timezone (simplified version)
          if (countryCode === 'US') {
            targetTimezone = 'America/New_York';
          }
          // Add more country-to-timezone mappings as needed
        }
      }
      
      // Get dialing window for detected timezone
      const dialingWindow = this.dialingWindowsByTimezone[targetTimezone] || 
                        this.dialingWindowsByTimezone['default'];
      
      // Calculate next available window
      const now = new Date();
      const targetDate = new Date(now.toLocaleString('en-US', { timeZone: targetTimezone }));
      const currentHour = targetDate.getHours();
      
      // If current hour is before start, schedule for start today
      // If current hour is after end, schedule for start tomorrow
      let scheduledTime: Date;
      
      if (currentHour < dialingWindow.start) {
        // Schedule for start of window today
        scheduledTime = new Date(now);
        scheduledTime.setHours(dialingWindow.start, 0, 0, 0);
      } else {
        // Schedule for start of window tomorrow
        scheduledTime = new Date(now);
        scheduledTime.setDate(scheduledTime.getDate() + 1);
        scheduledTime.setHours(dialingWindow.start, 0, 0, 0);
      }
      
      // Add some randomization to prevent all calls going out at once
      scheduledTime.setMinutes(Math.floor(Math.random() * 30));
      
      logger.info(`Rescheduling call to ${config.phoneNumber} for next window: ${scheduledTime.toISOString()}`);
      
      // Queue the call with the new scheduled time
      return this.makeCall({
        ...config,
        scheduledAt: scheduledTime,
        smartDialingWindow: false // Prevent infinite loop of rescheduling
      });
    } catch (error) {
      logger.error(`Error rescheduling call: `, error);
      throw error;
    }
  }

  /**
   * Process a queued call
   */
  private async processCall(callId: string): Promise<void> {
    try {
      const config = this.callQueue.get(callId);
      if (!config) {
        logger.error(`Call configuration not found: ${callId}`);
        return;
      }

      // Check for global rate limiting
      try {
        await outboundCallLimiter.consume('global');
      } catch (error) {
        logger.warn(`Global call rate limit reached, retrying in 60 seconds: ${error.message}`);
        // Retry after a delay
        setTimeout(() => this.processCall(callId), 60000);
        return;
      }

      logger.info(`Processing call: ${callId} to ${config.phoneNumber}`);
      
      // Update call status
      await this.updateCallStatus(callId, 'dialing');

      // Initiate call with retry logic
      const call = await retry(
        async (bail, attempt) => {
          try {
            logger.debug(`Call attempt ${attempt} for ${callId}`);
            return await this.initiateCall(config);
          } catch (error) {
            // Don't retry certain error types
            if (error.code === 21614 || // Invalid phone number
                error.code === 21217) { // Geographic permission error
              logger.error(`Non-retryable Twilio error: ${error.code} - ${error.message}`);
              bail(error);
              return;
            }
            
            // For other errors, retry
            if (attempt >= (config.maxRetries || 3)) {
              logger.error(`Max retries reached for call ${callId}`);
              bail(error);
              return;
            }
            
            throw error; // Throw to trigger retry
          }
        },
        {
          retries: config.maxRetries || 3,
          minTimeout: 1000,
          maxTimeout: 10000,
          onRetry: (error) => {
            logger.warn(`Retrying call ${callId} after error: ${error.message}`);
          }
        }
      );
      
      if (call) {
        // Success - call was initiated
        await this.updateCallStatus(callId, 'in-progress', { 
          twilioSid: call.sid,
          startTime: new Date() 
        });
        
        // Setup active conversation tracking
        this.activeConversations.set(callId, {
          twilioSid: call.sid,
          config,
          startTime: new Date(),
          lastActivity: Date.now(),
          conversationState: 'opening',
          metrics: {
            duration: 0,
            outcome: 'connected',
            conversationMetrics: {
              customerEngagement: 0,
              emotionalTone: ['neutral'],
              objectionCount: 0,
              interruptionCount: 0,
              conversionIndicators: []
            },
            qualityScore: 0
          },
          needsFinalSave: true
        });
        
        logger.info(`Call ${callId} initiated successfully with SID ${call.sid}`);
      } else {
        // This shouldn't happen due to retry logic, but just in case
        throw new Error('Call initiation failed with unknown error');
      }

    } catch (error) {
      logger.error(`Error processing call ${callId}:`, error);
      await this.updateCallStatus(callId, 'failed', { 
        error: error.message,
        failureCode: error.code || 'unknown',
        failureTime: new Date() 
      });
      
      // Remove from queue
      this.callQueue.delete(callId);
      
      // Check if we should retry based on error and retry count
      const callRecord = await Call.findById(callId);
      if (callRecord && 
          callRecord.retryCount < (callRecord.maxRetries || 3) && 
          this.isRetryableError(error)) {
        // Increment retry count
        await Call.findByIdAndUpdate(callId, {
          $inc: { retryCount: 1 },
          $set: { updatedAt: new Date() }
        });
        // Schedule retry with exponential backoff
        const delayMs = Math.pow(2, callRecord.retryCount) * 1000 * 60; // 2^n minutes
        const retryTime = new Date(Date.now() + delayMs);
        logger.info(`Scheduling retry #${callRecord.retryCount + 1} for call ${callId} at ${retryTime.toISOString()}`);
        // Reconstruct config from callRecord
        const retryConfig: CallConfiguration = {
          leadId: callRecord.leadId,
          campaignId: callRecord.campaignId,
          phoneNumber: callRecord.phoneNumber,
          personalityId: callRecord.personalityId,
          abTestVariantId: callRecord.abTestVariantId,
          priority: callRecord.priority,
          scheduledAt: retryTime,
          maxRetries: callRecord.maxRetries,
          callbackUrl: callRecord.callbackUrl,
          callId: callId,
          recordCall: callRecord.recordCall,
          complianceScriptId: callRecord.complianceScriptId,
          smartDialingWindow: false,
          customHeaders: undefined,
          detectAnsweringMachine: undefined,
          timeZone: undefined,
          disableCallDeduplication: undefined,
          callReasons: callRecord.callReasons || []
        };
        // Add to queue and schedule
        this.callQueue.set(callId, retryConfig);
        setTimeout(() => this.processCall(callId), delayMs);
      }
    }
  }
  
  /**
   * Determine if an error should trigger a retry
   */
  private isRetryableError(error: any): boolean {
    // List of Twilio error codes that are temporary and should be retried
    const retryableCodes = [
      'ETIMEDOUT',
      'ECONNRESET',
      'EADDRINUSE',
      'ESOCKETTIMEDOUT',
      'ECONNREFUSED',
      'EPIPE',
      'EHOSTUNREACH',
      'EAI_AGAIN',
      '500', // Server errors
      '503',
      '504',
      '429' // Rate limiting
    ];
    
    // Twilio specific error codes that are retryable
    const retryableTwilioCodes = [
      20003, // Authentication timeout
      20400, // Temporary Twilio carrier failure
      30003, // Temporarily unavailable
      30001  // Queue overflow
    ];
    
    if (!error) return false;
    
    // Check for error codes in the error object
    return (
      retryableCodes.includes(error.code) ||
      retryableTwilioCodes.includes(error.code) ||
      (error.message && error.message.toLowerCase().includes('timeout')) ||
      (error.message && error.message.toLowerCase().includes('temporarily unavailable'))
    );
  }

  /**
   * Cleans up stale conversations that have been inactive
   * Prevents memory leaks from abandoned calls
   */
  private cleanupStaleConversations(): void {
    const maxInactiveTime = Number(process.env.CALL_MAX_INACTIVE_TIME) || 3600000; // 1 hour default
    const now = Date.now();
    
    for (const [callId, convoData] of this.activeConversations.entries()) {
      if (now - convoData.lastActivity > maxInactiveTime) {
        logger.info(`Cleaning up stale conversation for call ${callId} (inactive for ${(now - convoData.lastActivity) / 60000} minutes)`);
        this.activeConversations.delete(callId);
        
        // Optionally save any unsaved conversation data
        if (convoData.needsFinalSave) {
          this.saveConversationMetrics(callId, {
            ...convoData.metrics,
            outcome: 'failed',
            conversationMetrics: {
              ...convoData.metrics?.conversationMetrics,
              customerEngagement: convoData.metrics?.conversationMetrics?.customerEngagement || 0,
              emotionalTone: convoData.metrics?.conversationMetrics?.emotionalTone || ['neutral'],
              objectionCount: convoData.metrics?.conversationMetrics?.objectionCount || 0,
              interruptionCount: convoData.metrics?.conversationMetrics?.interruptionCount || 0,
              conversionIndicators: convoData.metrics?.conversationMetrics?.conversionIndicators || []
            },
            qualityScore: convoData.metrics?.qualityScore || 0.1,
            complianceScore: convoData.metrics?.complianceScore || 0
          }).catch(err => {
            logger.error(`Failed to save final metrics for stale call ${callId}`, err);
          });
        }
      }
    }
  }

  /**
   * Checks if a number should be called based on timezone restrictions
   * @param phoneNumber The phone number to check
   * @param timezone The timezone to use (optional)
   */
  private isWithinDialingWindow(phoneNumber: string, timezone?: string): boolean {
    if (!phoneNumber) return false;
    
    try {
      // Try to detect timezone from phone number if not provided
      let detectedTimezone = timezone || 'default';
      
      if (!timezone) {
        const phoneInfo = parsePhoneNumberFromString(phoneNumber);
        if (phoneInfo) {
          const countryCode = phoneInfo.country;
          // Map country to timezone (simplified version)
          if (countryCode === 'US') {
            // Default to Eastern for US - would ideally use area code lookup
            detectedTimezone = 'America/New_York';
          }
          // Add more country-to-timezone mappings as needed
        }
      }
      
      // Get dialing window for detected timezone
      const dialingWindow = this.dialingWindowsByTimezone[detectedTimezone] || 
                          this.dialingWindowsByTimezone['default'];
      
      // Get current hour in the target timezone
      const targetTime = new Date().toLocaleString('en-US', { timeZone: detectedTimezone });
      const targetHour = new Date(targetTime).getHours();
      
      // Check if current hour is within dialing window
      return targetHour >= dialingWindow.start && targetHour < dialingWindow.end;
      
    } catch (error) {
      logger.error(`Error checking dialing window for ${phoneNumber}`, error);
      return false; // Fail closed - don't dial if we can't determine if it's allowed
    }
  }

  // Public API Methods
  async getCallQueue(): Promise<any[]> {
    return Array.from(this.callQueue.values());
  }

  async getActiveConversations(): Promise<any[]> {
    return Array.from(this.activeConversations.values());
  }

  async pauseCall(callId: string): Promise<void> {
    const conversation = this.activeConversations.get(callId);
    if (conversation && this.twilioClient) {
      await this.twilioClient.calls(conversation.twilioSid).update({ status: 'completed' });
    }
  }

  async getCallMetrics(timeRange: string = '24h'): Promise<any> {
    try {
      const startDate = new Date();
      startDate.setHours(startDate.getHours() - parseInt(timeRange.replace('h', '')));

      const calls = await Call.find({
        createdAt: { $gte: startDate }
      });

      return {
        totalCalls: calls.length,
        connectedCalls: calls.filter(c => c.status === 'completed').length,
        averageDuration: calls.reduce((acc, c) => acc + (c.duration || 0), 0) / calls.length,
        successRate: calls.filter(c => c.status === 'completed').length / calls.length,
        queueStatus: {
          queued: this.callQueue.size,
          active: this.activeConversations.size
        }
      };
    } catch (error) {
      logger.error('Error getting call metrics:', error);
      throw error;
    }
  }

  /**
   * Handle incoming voice webhook from Twilio
   */
  async handleVoiceWebhook(req: any, res: any): Promise<void> {
    const callId = req.query.callId;
    const twilioResponse = new (require('twilio').twiml.VoiceResponse)();
    
    try {
      logger.debug(`Received voice webhook for call ${callId}`);
      
      // Update call status
      await this.updateCallStatus(callId, 'in-progress');
      
      // Get the conversation state from active conversations
      const conversation = this.activeConversations.get(callId);
      
      if (!conversation) {
        logger.error(`No active conversation found for call ${callId}`);
        twilioResponse.say('We are unable to process your call at this time. Please try again later.');
        twilioResponse.hangup();
        res.type('text/xml');
        res.send(twilioResponse.toString());
        return;
      }
      
      // Add a brief pause to allow the call to connect properly
      twilioResponse.pause({ length: 1 });
      
      // Set up for conversation - normally this would call into a conversationEngine
      // Note: In a real implementation, this would integrate with an AI service
      twilioResponse.say('Hello, thank you for taking our call. This is an automated system.');
      
      // Gather user input after initial greeting
      const gather = twilioResponse.gather({
        input: 'speech',
        timeout: 3,
        speechTimeout: 'auto',
        action: `/api/calls/input-webhook?callId=${callId}`,
        method: 'POST'
      });
      
      gather.say('How are you doing today?');
      
      // If no input is received, try again
      twilioResponse.redirect(`/api/calls/voice-webhook?callId=${callId}`);
      
      res.type('text/xml');
      res.send(twilioResponse.toString());
      
    } catch (error) {
      logger.error(`Error in voice webhook for call ${callId}:`, error);
      twilioResponse.say('We encountered an error processing your call. Please try again later.');
      twilioResponse.hangup();
      res.type('text/xml');
      res.send(twilioResponse.toString());
    }
  }

  /**
   * Handle status updates from Twilio
   */
  async handleStatusWebhook(req: any, res: any): Promise<void> {
    const callId = req.query.callId;
    const callStatus = req.body.CallStatus;
    const callDuration = req.body.CallDuration ? parseInt(req.body.CallDuration) : 0;
    
    try {
      logger.debug(`Received status webhook for call ${callId}: ${callStatus}`);
      
      // Map Twilio status to our internal status
      const statusMap: Record<string, any> = {
        'initiated': 'dialing',
        'ringing': 'dialing',
        'in-progress': 'in-progress',
        'completed': 'completed',
        'busy': 'busy',
        'no-answer': 'no-answer',
        'failed': 'failed',
        'canceled': 'failed'
      };
      
      const internalStatus = statusMap[callStatus] || callStatus;
      
      // Update call in database with new status
      if (callStatus === 'completed') {
        await this.updateCallStatus(callId, internalStatus, {
          endTime: new Date(),
          duration: callDuration
        });
        
        // Save final metrics if call is completed
        const conversation = this.activeConversations.get(callId);
        if (conversation && conversation.needsFinalSave) {
          await this.saveConversationMetrics(callId, {
            ...conversation.metrics,
            duration: callDuration,
            outcome: 'connected'
          });
          conversation.needsFinalSave = false;
        }
        
        // Clean up
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
    const recordingDuration = req.body.RecordingDuration;
    
    try {
      logger.debug(`Received recording webhook for call ${callId}: ${recordingUrl}`);
      
      // Update the call with recording information
      await Call.findByIdAndUpdate(callId, {
        $set: {
          recordingUrl,
          'metrics.callRecordingUrl': recordingUrl
        }
      });
      
      // Schedule transcription and analysis if needed
      // This would typically call into another service
      
      res.status(200).send('Recording processed');
      
    } catch (error) {
      logger.error(`Error in recording webhook for call ${callId}:`, error);
      res.status(500).send('Error processing recording');
    }
  }
}

export const advancedTelephonyService = new AdvancedTelephonyService();
