/**
 * call_flow_test.ts
 * Integration tests for the complete call flow
 */

import { describe, it, before, after, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import * as sinon from 'sinon';
import axios from 'axios';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { RealTelephonyService } from '../../src/services/realTelephonyService';
import { RealSpeechService } from '../../src/services/realSpeechService';
import ModelRegistry from '../../src/ml/pipeline/model_registry';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env.test') });

describe('Call Flow Integration Tests', () => {
  let telephonyService: RealTelephonyService;
  let speechService: RealSpeechService;
  let apiClient: any;
  let sandbox: sinon.SinonSandbox;
  
  const testPhoneNumber = '+15551234567';
  const testFromNumber = '+15559876543';
  
  before(async () => {
    // Create API client
    apiClient = axios.create({
      baseURL: process.env.API_BASE_URL || 'http://localhost:3000',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.TEST_API_KEY || 'test-api-key'}`
      }
    });
    
    // Initialize sandbox
    sandbox = sinon.createSandbox();
    
    // Set up services for testing
    telephonyService = new RealTelephonyService(
      process.env.TWILIO_ACCOUNT_SID || 'test-sid',
      process.env.TWILIO_AUTH_TOKEN || 'test-token',
      process.env.WEBHOOK_BASE_URL || 'http://localhost:3000/api/webhooks'
    );
    
    speechService = new RealSpeechService(
      process.env.ELEVEN_LABS_API_KEY || 'test-key',
      path.resolve(__dirname, '../../tmp/test-audio')
    );
    
    // Ensure we're using test models
    const models = await ModelRegistry.getModels({ status: 'production' });
    if (models.length === 0) {
      console.warn('No production models found. Tests may fail or use fallbacks.');
    }
  });
  
  after(() => {
    sandbox.restore();
  });
  
  beforeEach(() => {
    // Reset stubs before each test
    sandbox.restore();
  });
  
  afterEach(() => {
    // Additional cleanup if needed
  });
  
  describe('Outbound Call Flow', () => {
    it('should initiate a call successfully', async () => {
      // Stub telephony service to avoid actual API calls
      const makeCallStub = sandbox.stub(telephonyService, 'makeCall').resolves('test-call-id');
      
      // Test API endpoint
      const response = await apiClient.post('/api/calls/initiate', {
        phoneNumber: testPhoneNumber,
        from: testFromNumber,
        campaignId: 'test-campaign'
      });
      
      expect(response.status).to.equal(200);
      expect(response.data).to.have.property('callId');
      expect(makeCallStub.calledOnce).to.be.true;
    });
    
    it('should process the conversation flow', async () => {
      // This test would mock the webhook calls that would normally come from Twilio
      // Stub necessary components
      
      // 1. Simulate call connected webhook
      const callConnectedResponse = await apiClient.post('/api/webhooks/call-status', {
        CallSid: 'test-call-id',
        CallStatus: 'in-progress',
        From: testFromNumber,
        To: testPhoneNumber
      });
      
      expect(callConnectedResponse.status).to.equal(200);
      
      // 2. Simulate speech recognition webhook (initial greeting)
      const speechRecognitionResponse = await apiClient.post('/api/webhooks/speech', {
        CallSid: 'test-call-id',
        SpeechResult: 'Hello, who is this?'
      });
      
      expect(speechRecognitionResponse.status).to.equal(200);
      
      // 3. Check that the system responded with appropriate dialog
      // This would typically involve checking logs or a test endpoint
      const callStatusResponse = await apiClient.get(`/api/calls/test-call-id`);
      
      expect(callStatusResponse.status).to.equal(200);
      expect(callStatusResponse.data).to.have.property('status');
      expect(callStatusResponse.data).to.have.property('interactions');
      expect(callStatusResponse.data.interactions.length).to.be.greaterThan(0);
    });
    
    it('should handle call termination', async () => {
      // Stub end call method
      const endCallStub = sandbox.stub(telephonyService, 'endCall').resolves(true);
      
      // Test call termination
      const response = await apiClient.post('/api/calls/test-call-id/end');
      
      expect(response.status).to.equal(200);
      expect(endCallStub.calledOnce).to.be.true;
      
      // Verify call record is updated
      const callStatusResponse = await apiClient.get(`/api/calls/test-call-id`);
      expect(callStatusResponse.data.status).to.equal('completed');
    });
  });
  
  describe('Error Handling and Fallbacks', () => {
    it('should handle telephony service failures', async () => {
      // Stub makeCall to simulate failure
      const makeCallStub = sandbox.stub(telephonyService, 'makeCall').rejects(new Error('Service unavailable'));
      
      // Ensure there's a fallback mechanism
      try {
        await apiClient.post('/api/calls/initiate', {
          phoneNumber: testPhoneNumber,
          from: testFromNumber,
          campaignId: 'test-campaign'
        });
        
        // If it doesn't throw, we should have a fallback
        expect(makeCallStub.calledOnce).to.be.true;
      } catch (error) {
        // If it throws, the response should indicate a service issue
        expect(error.response.status).to.equal(503);
        expect(error.response.data).to.have.property('error');
        expect(error.response.data.error).to.include('service');
      }
    });
    
    it('should handle speech service failures', async () => {
      // Stub speech synthesis to simulate failure
      const synthesizeStub = sandbox.stub(speechService, 'synthesizeSpeech').rejects(new Error('Synthesis failed'));
      
      // Trigger a speech synthesis via an appropriate endpoint
      const response = await apiClient.post('/api/tts', {
        text: 'Hello, this is a test',
        voiceId: 'test-voice'
      });
      
      // Even with the failure, we should get a response with fallback audio
      expect(response.status).to.equal(200);
      expect(response.data).to.have.property('audioUrl');
      expect(synthesizeStub.calledOnce).to.be.true;
    });
  });
  
  describe('End-to-End Conversation Scenarios', () => {
    it('should handle a complete successful conversation flow', async () => {
      // This test simulates a complete conversation from start to finish
      // with multiple speech recognition and response cycles
      
      // Initialize the call
      const initResponse = await apiClient.post('/api/calls/initiate', {
        phoneNumber: testPhoneNumber,
        from: testFromNumber,
        campaignId: 'test-campaign',
        scenarioId: 'test-conversation-complete'
      });
      
      const callId = initResponse.data.callId;
      
      // 1. Simulate call connected
      await apiClient.post('/api/webhooks/call-status', {
        CallSid: callId,
        CallStatus: 'in-progress'
      });
      
      // 2. System greeting (happens automatically)
      
      // 3. Simulate customer response
      await apiClient.post('/api/webhooks/speech', {
        CallSid: callId,
        SpeechResult: 'Hi, I\'m interested in your services'
      });
      
      // 4. Simulate customer questions and system responses
      const conversationSteps = [
        'What services do you offer?',
        'How much does it cost?',
        'Do you have any special offers?',
        'I\'d like to sign up'
      ];
      
      for (const customerInput of conversationSteps) {
        await apiClient.post('/api/webhooks/speech', {
          CallSid: callId,
          SpeechResult: customerInput
        });
        
        // Allow time for processing
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // 5. End the call
      await apiClient.post(`/api/calls/${callId}/end`);
      
      // 6. Verify the call record contains the complete conversation
      const callDataResponse = await apiClient.get(`/api/calls/${callId}`);
      
      expect(callDataResponse.status).to.equal(200);
      expect(callDataResponse.data).to.have.property('interactions');
      expect(callDataResponse.data.interactions.length).to.be.at.least(conversationSteps.length);
      expect(callDataResponse.data.status).to.equal('completed');
      
      // Verify emotion analysis was performed
      expect(callDataResponse.data).to.have.property('emotionAnalysis');
      expect(callDataResponse.data.emotionAnalysis).to.have.property('overallSentiment');
    });
    
    it('should handle a conversation with interruptions', async () => {
      // This test simulates a conversation with interruptions and overlapping speech
      
      // Similar to the previous test but with interruption events
      // Implementation would depend on how the system handles interruptions
    });
  });
});