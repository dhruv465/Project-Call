import twilio from 'twilio';
import logger from '../utils/logger';
import Call from '../models/Call';
import { voiceAIService, conversationEngine } from '../services';

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
  callId?: string; // Add callId as optional property
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
}

export class AdvancedTelephonyService {
  private twilioClient: twilio.Twilio;
  private callQueue: Map<string, CallConfiguration> = new Map();
  private activeConversations: Map<string, any> = new Map();

  constructor() {
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
      logger.warn('Twilio credentials not configured. Telephony features will be limited.');
      return;
    }
    
    this.twilioClient = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
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

  private async processCall(callId: string): Promise<void> {
    try {
      const config = this.callQueue.get(callId);
      if (!config) {
        logger.error(`Call configuration not found: ${callId}`);
        return;
      }

      logger.info(`Processing call: ${callId}`);
      
      // Update call status
      await this.updateCallStatus(callId, 'dialing');

      // Initiate Twilio call
      const call = await this.initiateCall(config);
      
      if (call) {
        await this.updateCallStatus(callId, 'in-progress', { twilioSid: call.sid });
        this.activeConversations.set(callId, {
          twilioSid: call.sid,
          config,
          startTime: new Date(),
          conversationState: 'opening'
        });
      }

    } catch (error) {
      logger.error(`Error processing call ${callId}:`, error);
      await this.updateCallStatus(callId, 'failed', { error: error.message });
      this.callQueue.delete(callId);
    }
  }

  private async initiateCall(config: CallConfiguration): Promise<any> {
    if (!this.twilioClient) {
      throw new Error('Twilio client not initialized');
    }

    try {
      const call = await this.twilioClient.calls.create({
        to: config.phoneNumber,
        from: process.env.TWILIO_PHONE_NUMBER,
        url: `${config.callbackUrl}/voice-webhook`,
        statusCallback: `${config.callbackUrl}/status-webhook`,
        statusCallbackEvent: ['initiated', 'ringing', 'answered', 'completed'],
        record: true,
        recordingStatusCallback: `${config.callbackUrl}/recording-webhook`
      });

      logger.info(`Twilio call initiated: ${call.sid}`);
      return call;
    } catch (error) {
      logger.error('Twilio call initiation failed:', error);
      throw error;
    }
  }

  // Webhook Handlers
  async handleVoiceWebhook(req: any): Promise<string> {
    try {
      const { CallSid, CallStatus, From, To } = req.body;
      
      // Find active conversation
      const conversation = Array.from(this.activeConversations.entries())
        .find(([_, conv]) => conv.twilioSid === CallSid);

      if (!conversation) {
        logger.warn(`No active conversation found for call: ${CallSid}`);
        return this.generateDefaultTwiML();
      }

      const [callId, convData] = conversation;
      
      // Generate AI response based on conversation state
      const response = await this.generateAIResponse(callId, convData, req.body);
      
      return this.generateTwiML(response);
    } catch (error) {
      logger.error('Voice webhook error:', error);
      return this.generateErrorTwiML();
    }
  }

  async handleStatusWebhook(req: any): Promise<void> {
    try {
      const { CallSid, CallStatus, CallDuration } = req.body;
      
      // Find and update call record
      const conversation = Array.from(this.activeConversations.entries())
        .find(([_, conv]) => conv.twilioSid === CallSid);

      if (conversation) {
        const [callId, convData] = conversation;
        
        if (CallStatus === 'completed') {
          await this.handleCallCompletion(callId, {
            duration: parseInt(CallDuration) || 0,
            outcome: 'connected',
            conversationMetrics: {
              customerEngagement: 0.5,
              emotionalTone: ['neutral'],
              objectionCount: 0,
              interruptionCount: 0,
              conversionIndicators: []
            },
            qualityScore: 0.7
          });
          
          this.activeConversations.delete(callId);
          this.callQueue.delete(callId);
        } else {
          await this.updateCallStatus(callId, CallStatus);
        }
      }
    } catch (error) {
      logger.error('Status webhook error:', error);
    }
  }

  async handleRecordingWebhook(req: any): Promise<void> {
    try {
      const { CallSid, RecordingUrl, RecordingSid } = req.body;
      
      // Process recording for analytics
      await this.processCallRecording({
        callSid: CallSid,
        recordingUrl: RecordingUrl,
        recordingSid: RecordingSid
      });
    } catch (error) {
      logger.error('Recording webhook error:', error);
    }
  }

  private async generateAIResponse(callId: string, conversation: any, webhookData: any): Promise<any> {
    try {
      const { config, conversationState } = conversation;
      
      // Analyze customer speech if available
      let customerEmotion = null;
      if (webhookData.SpeechResult) {
        customerEmotion = await voiceAIService.analyzeCustomerEmotion(webhookData.SpeechResult);
      }

      // Generate contextual response
      const responseText = await conversationEngine.generateResponse({
        sessionId: callId,
        userInput: webhookData.SpeechResult || '',
        context: {
          conversationState,
          customerEmotion,
          campaignId: config.campaignId,
          personalityId: config.personalityId,
          abTestVariantId: config.abTestVariantId
        }
      });

      // Create response object
      const response = {
        text: responseText,
        action: 'speak',
        nextState: 'active'
      };

      // Update conversation state
      conversation.conversationState = response.nextState;
      conversation.lastResponse = response;

      return response;
    } catch (error) {
      logger.error('Error generating AI response:', error);
      return {
        text: "I apologize, but I'm experiencing technical difficulties. Let me transfer you to a human agent.",
        action: 'transfer',
        nextState: 'transfer'
      };
    }
  }

  private generateTwiML(response: any): string {
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
      ${response.action === 'speak' ? `<Say voice="alice">${response.text}</Say>` : ''}
      ${response.action === 'gather' ? `
        <Gather input="speech" timeout="5" speechTimeout="2" action="/voice-webhook" method="POST">
          <Say voice="alice">${response.text}</Say>
        </Gather>
      ` : ''}
      ${response.action === 'transfer' ? `
        <Say voice="alice">${response.text}</Say>
        <Dial>${process.env.TRANSFER_NUMBER || '+1234567890'}</Dial>
      ` : ''}
      ${response.action === 'hangup' ? `
        <Say voice="alice">${response.text}</Say>
        <Hangup/>
      ` : ''}
    </Response>`;
    
    return twiml;
  }

  private generateDefaultTwiML(): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
      <Say voice="alice">Hello, this is an AI assistant. How can I help you today?</Say>
      <Gather input="speech" timeout="5" action="/voice-webhook" method="POST">
        <Say voice="alice">Please let me know how I can assist you.</Say>
      </Gather>
    </Response>`;
  }

  private generateErrorTwiML(): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
      <Say voice="alice">I apologize, but I'm experiencing technical difficulties. Please try calling back later.</Say>
      <Hangup/>
    </Response>`;
  }

  // Call Analytics and Completion
  private async handleCallCompletion(callId: string, metrics: CallMetrics): Promise<void> {
    try {
      // Analyze conversation for insights
      const conversation = this.activeConversations.get(callId);
      if (conversation) {
        // Extract conversation metrics
        const conversationAnalysis = await this.analyzeConversation(conversation);
        
        // Update call record with comprehensive metrics
        await this.updateCallStatus(callId, 'completed', {
          ...metrics,
          conversationAnalysis,
          completedAt: new Date()
        });

        // Update A/B test metrics if applicable
        if (conversation.config.abTestVariantId) {
          await this.updateABTestMetrics(
            conversation.config.abTestVariantId,
            conversationAnalysis
          );
        }

        logger.info(`Call completed: ${callId}, Duration: ${metrics.duration}s`);
      }
    } catch (error) {
      logger.error('Error handling call completion:', error);
    }
  }

  private async analyzeConversation(conversation: any): Promise<any> {
    // Implement conversation analysis
    return {
      emotionalJourney: conversation.emotionalStates || [],
      engagementLevel: conversation.engagementScore || 0,
      objectionHandling: conversation.objections || [],
      conversionIndicators: conversation.conversionSignals || [],
      qualityScore: conversation.qualityScore || 0
    };
  }

  private async updateCallStatus(callId: string, status: string, additionalData: any = {}): Promise<void> {
    try {
      await Call.findOneAndUpdate(
        { _id: callId },
        { 
          $set: { 
            status,
            ...additionalData,
            updatedAt: new Date()
          }
        }
      );
    } catch (error) {
      logger.error('Error updating call status:', error);
    }
  }

  private async processCallRecording(recordingData: any): Promise<void> {
    try {
      // Download and analyze recording
      // Implement sentiment analysis, keyword detection, etc.
      logger.info(`Processing recording: ${recordingData.recordingSid}`);
      
      // Store recording URL and analysis results
      // This would integrate with your emotion detection and conversation analysis services
    } catch (error) {
      logger.error('Error processing call recording:', error);
    }
  }

  private async updateABTestMetrics(variantId: string, metrics: any): Promise<void> {
    try {
      // Update A/B test metrics based on call results
      // This would integrate with the advancedCampaignService
      logger.info(`Updating A/B test metrics for variant: ${variantId}`);
    } catch (error) {
      logger.error('Error updating A/B test metrics:', error);
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
        successRate: calls.filter(c => c.outcome === 'connected').length / calls.length,
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
}

export const advancedTelephonyService = new AdvancedTelephonyService();
