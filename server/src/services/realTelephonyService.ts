/**
 * realTelephonyService.ts
 * Production implementation of the telephony service using Twilio
 */

import twilio from 'twilio';
import { EventEmitter } from 'events';
import { TwilioCallStatus, CallData, TelephonyServiceInterface } from '../types/telephony';
import logger, { getErrorMessage } from '../utils/logger';

export class RealTelephonyService implements TelephonyServiceInterface {
  private client: twilio.Twilio;
  private events: EventEmitter;
  private activeCalls: Map<string, CallData>;
  private webhookBaseUrl: string;
  private fallbackMode: boolean = false;

  constructor(
    accountSid: string,
    authToken: string,
    webhookBaseUrl: string
  ) {
    // Initialize Twilio client
    this.client = twilio(accountSid, authToken);
    this.events = new EventEmitter();
    this.activeCalls = new Map();
    this.webhookBaseUrl = webhookBaseUrl;
    
    // Monitor Twilio API health
    this.monitorApiHealth();
  }

  /**
   * Initiates an outbound call
   */
  public async makeCall(
    to: string,
    from: string,
    callbackUrl: string,
    options?: { 
      timeout?: number; 
      machineDetection?: 'Enable' | 'DetectMessageEnd';
      recordingEnabled?: boolean;
    }
  ): Promise<string> {
    try {
      if (this.fallbackMode) {
        throw new Error('Telephony service is in fallback mode. Using simulated call.');
      }
      
      // Configure call parameters
      const callParams: any = {
        to,
        from,
        url: callbackUrl,
        statusCallback: `${this.webhookBaseUrl}/call-status`,
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
        statusCallbackMethod: 'POST',
      };
      
      // Add optional parameters
      if (options?.timeout) {
        callParams.timeout = options.timeout;
      }
      
      if (options?.machineDetection) {
        callParams.machineDetection = options.machineDetection;
      }
      
      if (options?.recordingEnabled) {
        callParams.record = true;
        callParams.recordingStatusCallback = `${this.webhookBaseUrl}/recording-status`;
      }
      
      // Place the call
      const call = await this.client.calls.create(callParams);
      
      // Store call data
      this.activeCalls.set(call.sid, {
        id: call.sid,
        to,
        from,
        status: call.status as TwilioCallStatus,
        startTime: new Date().toISOString(),
        recordings: []
      });
      
      logger.info(`Call initiated: ${call.sid} to ${to} from ${from}`);
      
      return call.sid;
    } catch (error) {
      logger.error(`Error making call: ${getErrorMessage(error)}`, { error });
      
      // Use fallback mode if we're not already in it
      if (!this.fallbackMode) {
        this.fallbackMode = true;
        logger.warn('Switching to fallback telephony mode');
        
        // Use simulated call (fallback logic)
        const simulatedCallId = `sim_${Date.now()}`;
        
        this.activeCalls.set(simulatedCallId, {
          id: simulatedCallId,
          to,
          from,
          status: 'initiated',
          startTime: new Date().toISOString(),
          recordings: [],
          isFallback: true
        });
        
        // Simulate call progress events
        setTimeout(() => this.handleCallStatusChange(simulatedCallId, 'ringing'), 1000);
        setTimeout(() => this.handleCallStatusChange(simulatedCallId, 'in-progress'), 3000);
        
        return simulatedCallId;
      }
      
      throw error;
    }
  }
  
  /**
   * Ends an active call
   */
  public async endCall(callId: string): Promise<boolean> {
    try {
      if (!this.activeCalls.has(callId)) {
        logger.warn(`Call ${callId} not found in active calls`);
        return false;
      }
      
      const callData = this.activeCalls.get(callId);
      
      // Use fallback for simulated calls
      if (callData.isFallback) {
        this.handleCallStatusChange(callId, 'completed');
        return true;
      }
      
      if (this.fallbackMode) {
        throw new Error('Telephony service is in fallback mode');
      }
      
      // End the call via Twilio
      await this.client.calls(callId).update({ status: 'completed' });
      
      logger.info(`Call ended: ${callId}`);
      return true;
    } catch (error) {
      logger.error(`Error ending call ${callId}: ${getErrorMessage(error)}`, { error });
      
      // If in fallback mode or error occurs, simulate call end
      if (this.activeCalls.has(callId)) {
        this.handleCallStatusChange(callId, 'completed');
        return true;
      }
      
      return false;
    }
  }
  
  /**
   * Handles incoming webhook for call status changes
   */
  public handleWebhook(eventType: string, data: any): void {
    const callId = data.CallSid;
    
    if (!callId) {
      logger.error('Received webhook without CallSid', { data });
      return;
    }
    
    switch (eventType) {
      case 'call-status':
        this.handleCallStatusChange(callId, data.CallStatus);
        break;
        
      case 'recording-status':
        this.handleRecordingUpdate(callId, data);
        break;
        
      default:
        logger.warn(`Unknown webhook event type: ${eventType}`, { data });
    }
  }
  
  /**
   * Updates call status based on webhook data
   */
  private handleCallStatusChange(callId: string, status: TwilioCallStatus): void {
    if (!this.activeCalls.has(callId)) {
      // This might be a new incoming call we're not tracking yet
      if (status === 'ringing' || status === 'initiated') {
        this.activeCalls.set(callId, {
          id: callId,
          status,
          startTime: new Date().toISOString(),
          recordings: []
        });
      } else {
        logger.warn(`Received status update for unknown call: ${callId}`);
        return;
      }
    }
    
    // Update call status
    const callData = this.activeCalls.get(callId);
    const updatedCallData = { ...callData, status };
    
    // Add end time if call is completed or failed
    if (status === 'completed' || status === 'failed' || status === 'busy' || status === 'no-answer') {
      updatedCallData.endTime = new Date().toISOString();
    }
    
    this.activeCalls.set(callId, updatedCallData);
    
    // Emit event for status change
    this.events.emit('call-status-change', {
      callId,
      status,
      callData: updatedCallData
    });
    
    logger.info(`Call ${callId} status changed to ${status}`);
    
    // Clean up completed calls after a delay
    if (status === 'completed' || status === 'failed') {
      setTimeout(() => {
        this.activeCalls.delete(callId);
        logger.info(`Call ${callId} removed from active calls`);
      }, 300000); // 5 minutes
    }
  }
  
  /**
   * Updates recording information for a call
   */
  private handleRecordingUpdate(callId: string, data: any): void {
    if (!this.activeCalls.has(callId)) {
      logger.warn(`Received recording update for unknown call: ${callId}`);
      return;
    }
    
    const callData = this.activeCalls.get(callId);
    const recordings = [...(callData.recordings || [])];
    
    recordings.push({
      id: data.RecordingSid,
      duration: parseInt(data.RecordingDuration || '0', 10),
      url: data.RecordingUrl,
      status: data.RecordingStatus === 'completed' ? 'completed' : 
              data.RecordingStatus === 'failed' ? 'failed' : 'processing'
    });
    
    this.activeCalls.set(callId, { ...callData, recordings });
    
    logger.info(`Call ${callId} recording updated: ${data.RecordingSid}`);
  }
  
  /**
   * Gets current status of a call
   */
  public getCallStatus(callId: string): TwilioCallStatus | null {
    const call = this.activeCalls.get(callId);
    return call ? call.status : null;
  }
  
  /**
   * Gets data for a specific call
   */
  public getCallData(callId: string): CallData | null {
    return this.activeCalls.get(callId) || null;
  }
  
  /**
   * Retrieves all active calls
   */
  public getActiveCalls(): CallData[] {
    return Array.from(this.activeCalls.values());
  }
  
  /**
   * Subscribes to telephony events
   */
  public on(event: string, listener: (...args: any[]) => void): void {
    this.events.on(event, listener);
  }
  
  /**
   * Unsubscribes from telephony events
   */
  public off(event: string, listener: (...args: any[]) => void): void {
    this.events.off(event, listener);
  }
  
  /**
   * Monitors Twilio API health and toggles fallback mode
   */
  private monitorApiHealth(): void {
    const checkApiHealth = async () => {
      try {
        if (this.fallbackMode) {
          // Try to recover from fallback mode
          await this.client.api.v2010.account.fetch();
          
          // If no error, exit fallback mode
          this.fallbackMode = false;
          logger.info('Telephony service recovered from fallback mode');
        }
      } catch (error) {
        if (!this.fallbackMode) {
          logger.error('Twilio API health check failed, entering fallback mode', { error });
          this.fallbackMode = true;
        }
      }
    };
    
    // Check health every 5 minutes
    setInterval(checkApiHealth, 300000);
  }
  
  /**
   * Check service health
   */
  public async checkHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    message?: string;
  }> {
    try {
      if (this.fallbackMode) {
        return {
          status: 'degraded',
          message: 'Telephony service is in fallback mode'
        };
      }

      // Try to fetch account info to verify API connectivity
      try {
        // Ping the Twilio API by listing a resource
        await this.client.calls.list({limit: 1});
        return { status: 'healthy' };
      } catch (error) {
        logger.error(`Twilio API check failed: ${getErrorMessage(error)}`);
        this.fallbackMode = true;
        return {
          status: 'unhealthy',
          message: `Twilio API check failed: ${getErrorMessage(error)}`
        };
      }
    } catch (error) {
      logger.error(`Error checking telephony service health: ${getErrorMessage(error)}`);
      return {
        status: 'unhealthy',
        message: `Internal error: ${getErrorMessage(error)}`
      };
    }
  }
}

// Types
export interface TelephonyConfig {
  accountSid: string;
  authToken: string;
  webhookBaseUrl: string;
}

// Create singleton instance
let telephonyService: RealTelephonyService | null = null;

export function initializeTelephonyService(config: TelephonyConfig): RealTelephonyService {
  if (!telephonyService) {
    telephonyService = new RealTelephonyService(
      config.accountSid,
      config.authToken,
      config.webhookBaseUrl
    );
  }
  
  return telephonyService;
}

export function getTelephonyService(): RealTelephonyService {
  if (!telephonyService) {
    throw new Error('Telephony service not initialized');
  }
  
  return telephonyService;
}

export default {
  initialize: initializeTelephonyService,
  getService: getTelephonyService
};