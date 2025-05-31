/**
 * crm_integration_test.ts
 * Integration tests for CRM system integration
 */

import { describe, it, before, after, beforeEach } from 'mocha';
import { expect } from 'chai';
import * as sinon from 'sinon';
import axios from 'axios';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { RealTelephonyService } from '../../src/services/realTelephonyService';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env.test') });

// Define test data
interface TestContact {
  id: string;
  name: string;
  phone: string;
  email: string;
  notes: string[];
}

interface TestLead {
  id: string;
  contactId: string;
  status: string;
  source: string;
  campaignId: string;
  interests: string[];
  score: number;
}

describe('CRM Integration Tests', () => {
  let apiClient: any;
  let sandbox: sinon.SinonSandbox;
  
  // Test data
  const testContact: TestContact = {
    id: 'test-contact-123',
    name: 'John Doe',
    phone: '+15551234567',
    email: 'john.doe@example.com',
    notes: []
  };
  
  const testLead: TestLead = {
    id: 'test-lead-123',
    contactId: testContact.id,
    status: 'new',
    source: 'phone-call',
    campaignId: 'test-campaign',
    interests: ['product-a', 'service-b'],
    score: 75
  };
  
  before(() => {
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
  });
  
  after(() => {
    sandbox.restore();
  });
  
  beforeEach(() => {
    // Reset stubs before each test
    sandbox.restore();
  });
  
  describe('Contact Management', () => {
    it('should create a new contact from a call', async () => {
      // Create a new call with contact info
      const response = await apiClient.post('/api/calls/initiate', {
        phoneNumber: testContact.phone,
        from: '+15559876543',
        campaignId: 'test-campaign',
        createContact: true,
        contactName: testContact.name
      });
      
      expect(response.status).to.equal(200);
      expect(response.data).to.have.property('callId');
      expect(response.data).to.have.property('contactId');
      
      // Verify contact was created
      const contactResponse = await apiClient.get(`/api/contacts/${response.data.contactId}`);
      expect(contactResponse.status).to.equal(200);
      expect(contactResponse.data.phone).to.equal(testContact.phone);
      expect(contactResponse.data.name).to.equal(testContact.name);
    });
    
    it('should update contact information based on call', async () => {
      // First, ensure the contact exists
      let contactId: string;
      
      try {
        const createResponse = await apiClient.post('/api/contacts', {
          name: testContact.name,
          phone: testContact.phone,
          email: testContact.email
        });
        contactId = createResponse.data.id;
      } catch (error) {
        if (error.response && error.response.status === 409) {
          // Contact already exists, get the ID
          const searchResponse = await apiClient.get(`/api/contacts?phone=${testContact.phone}`);
          contactId = searchResponse.data[0].id;
        } else {
          throw error;
        }
      }
      
      // Now simulate a call that updates the contact
      const callId = 'test-call-update-contact';
      
      // Simulate call connected
      await apiClient.post('/api/webhooks/call-status', {
        CallSid: callId,
        CallStatus: 'in-progress',
        From: '+15559876543',
        To: testContact.phone
      });
      
      // Simulate a conversation that reveals new information
      await apiClient.post('/api/webhooks/speech', {
        CallSid: callId,
        SpeechResult: `My email is updated.email@example.com and I'm interested in your premium service`
      });
      
      // End the call
      await apiClient.post(`/api/calls/${callId}/end`);
      
      // Verify contact was updated with new information
      const contactResponse = await apiClient.get(`/api/contacts/${contactId}`);
      
      // The system should have extracted the new email
      expect(contactResponse.data.email).to.equal('updated.email@example.com');
      
      // Verify contact has a note about the call
      expect(contactResponse.data.notes.length).to.be.greaterThan(0);
      expect(contactResponse.data.notes[contactResponse.data.notes.length - 1]).to.include('call');
    });
  });
  
  describe('Lead Management', () => {
    it('should convert a call into a qualified lead', async () => {
      // First create a contact
      let contactId: string;
      
      try {
        const createResponse = await apiClient.post('/api/contacts', {
          name: 'Jane Smith',
          phone: '+15557654321',
          email: 'jane.smith@example.com'
        });
        contactId = createResponse.data.id;
      } catch (error) {
        if (error.response && error.response.status === 409) {
          // Contact already exists, get the ID
          const searchResponse = await apiClient.get(`/api/contacts?phone=+15557654321`);
          contactId = searchResponse.data[0].id;
        } else {
          throw error;
        }
      }
      
      // Now initiate a call that will generate a lead
      const response = await apiClient.post('/api/calls/initiate', {
        phoneNumber: '+15557654321',
        from: '+15559876543',
        campaignId: 'test-campaign',
        contactId: contactId,
        scenarioId: 'lead-qualification'
      });
      
      const callId = response.data.callId;
      
      // Simulate call connected
      await apiClient.post('/api/webhooks/call-status', {
        CallSid: callId,
        CallStatus: 'in-progress'
      });
      
      // Simulate a conversation with high buying intent
      const conversationSteps = [
        'I\'m very interested in your premium package',
        'Yes, I have budget approval for this quarter',
        'I\'d like to schedule a demo next week',
        'My budget is around $5000'
      ];
      
      for (const customerInput of conversationSteps) {
        await apiClient.post('/api/webhooks/speech', {
          CallSid: callId,
          SpeechResult: customerInput
        });
        
        // Allow time for processing
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // End the call
      await apiClient.post(`/api/calls/${callId}/end`);
      
      // Verify a lead was created
      const leadsResponse = await apiClient.get(`/api/leads?contactId=${contactId}`);
      
      expect(leadsResponse.status).to.equal(200);
      expect(leadsResponse.data.length).to.be.greaterThan(0);
      
      const lead = leadsResponse.data[0];
      expect(lead.score).to.be.greaterThan(70); // High lead score due to buying intent
      expect(lead.status).to.equal('qualified');
      expect(lead.source).to.equal('phone-call');
      
      // Verify lead information was extracted from conversation
      expect(lead).to.have.property('budget');
      expect(lead.budget).to.include('5000');
      expect(lead).to.have.property('timeline');
      expect(lead.timeline).to.include('next week');
    });
    
    it('should update existing lead data based on follow-up call', async () => {
      // Create a lead for testing
      let leadId: string;
      let contactId: string;
      
      // Set up test contact and lead
      try {
        // First get or create contact
        const contactSearchResponse = await apiClient.get(`/api/contacts?phone=+15557654321`);
        if (contactSearchResponse.data.length > 0) {
          contactId = contactSearchResponse.data[0].id;
        } else {
          const contactResponse = await apiClient.post('/api/contacts', {
            name: 'Jane Smith',
            phone: '+15557654321',
            email: 'jane.smith@example.com'
          });
          contactId = contactResponse.data.id;
        }
        
        // Now get or create lead
        const leadSearchResponse = await apiClient.get(`/api/leads?contactId=${contactId}`);
        if (leadSearchResponse.data.length > 0) {
          leadId = leadSearchResponse.data[0].id;
        } else {
          const leadResponse = await apiClient.post('/api/leads', {
            contactId: contactId,
            status: 'new',
            source: 'test',
            campaignId: 'test-campaign',
            score: 50
          });
          leadId = leadResponse.data.id;
        }
      } catch (error) {
        console.error('Error setting up test data:', error);
        throw error;
      }
      
      // Initiate a follow-up call
      const response = await apiClient.post('/api/calls/initiate', {
        phoneNumber: '+15557654321',
        from: '+15559876543',
        campaignId: 'test-campaign-followup',
        contactId: contactId,
        leadId: leadId,
        scenarioId: 'lead-follow-up'
      });
      
      const callId = response.data.callId;
      
      // Simulate call connected
      await apiClient.post('/api/webhooks/call-status', {
        CallSid: callId,
        CallStatus: 'in-progress'
      });
      
      // Simulate a conversation with updated information
      await apiClient.post('/api/webhooks/speech', {
        CallSid: callId,
        SpeechResult: 'I\'ve discussed with my team and we\'re ready to move forward next month'
      });
      
      // End the call
      await apiClient.post(`/api/calls/${callId}/end`);
      
      // Verify lead was updated
      const leadResponse = await apiClient.get(`/api/leads/${leadId}`);
      
      expect(leadResponse.status).to.equal(200);
      expect(leadResponse.data.status).to.equal('qualified');
      expect(leadResponse.data.timeline).to.include('next month');
      
      // Score should be higher than before
      expect(leadResponse.data.score).to.be.greaterThan(50);
    });
  });
  
  describe('CRM Synchronization', () => {
    it('should sync call data with external CRM system', async () => {
      // Mock external CRM API
      const crmApiMock = sandbox.stub(axios, 'post').resolves({ 
        status: 200, 
        data: { success: true, externalId: 'ext-123' } 
      });
      
      // Call the sync endpoint
      const syncResponse = await apiClient.post('/api/crm/sync', {
        callId: 'test-call-123',
        crmSystem: 'salesforce',
        entityType: 'contact'
      });
      
      expect(syncResponse.status).to.equal(200);
      expect(syncResponse.data.success).to.be.true;
      expect(syncResponse.data).to.have.property('externalId');
      expect(crmApiMock.calledOnce).to.be.true;
      
      // Verify the sync was recorded
      const callResponse = await apiClient.get('/api/calls/test-call-123');
      expect(callResponse.data.crmSync).to.have.property('salesforce');
      expect(callResponse.data.crmSync.salesforce.externalId).to.equal('ext-123');
    });
    
    it('should handle CRM sync failures gracefully', async () => {
      // Mock external CRM API failure
      const crmApiMock = sandbox.stub(axios, 'post').rejects(new Error('CRM API unavailable'));
      
      // Call the sync endpoint
      try {
        await apiClient.post('/api/crm/sync', {
          callId: 'test-call-123',
          crmSystem: 'salesforce',
          entityType: 'contact'
        });
        
        // If it doesn't throw, it should be handling the error
        const callResponse = await apiClient.get('/api/calls/test-call-123');
        expect(callResponse.data.crmSync.salesforce.status).to.equal('failed');
        expect(callResponse.data.crmSync.salesforce.error).to.include('unavailable');
      } catch (error) {
        // If it throws, the response should indicate the issue correctly
        expect(error.response.status).to.equal(502);
        expect(error.response.data.error).to.include('CRM');
      }
      
      expect(crmApiMock.calledOnce).to.be.true;
    });
    
    it('should retry failed CRM sync operations', async () => {
      // Set up a failed sync first
      const crmApiMock = sandbox.stub(axios, 'post');
      
      // First call fails
      crmApiMock.onFirstCall().rejects(new Error('CRM API unavailable'));
      
      // Second call succeeds
      crmApiMock.onSecondCall().resolves({ 
        status: 200, 
        data: { success: true, externalId: 'ext-456' } 
      });
      
      // First attempt - should fail
      try {
        await apiClient.post('/api/crm/sync', {
          callId: 'test-call-retry',
          crmSystem: 'hubspot',
          entityType: 'contact'
        });
      } catch (error) {
        // Expected to fail
      }
      
      // Now try the retry endpoint
      const retryResponse = await apiClient.post('/api/crm/retry-sync', {
        callId: 'test-call-retry',
        crmSystem: 'hubspot'
      });
      
      expect(retryResponse.status).to.equal(200);
      expect(retryResponse.data.success).to.be.true;
      expect(retryResponse.data).to.have.property('externalId');
      expect(crmApiMock.calledTwice).to.be.true;
      
      // Verify the sync was updated
      const callResponse = await apiClient.get('/api/calls/test-call-retry');
      expect(callResponse.data.crmSync.hubspot.status).to.equal('synced');
      expect(callResponse.data.crmSync.hubspot.externalId).to.equal('ext-456');
    });
  });
});