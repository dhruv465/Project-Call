import { Request, Response } from 'express';
import logger from '../utils/logger';
import Call, { ICall } from '../models/Call';
import Campaign from '../models/Campaign';
import Configuration from '../models/Configuration';
import { conversationEngine } from './index';
import { AdvancedTelephonyService } from './advancedTelephonyService';
import { EnhancedVoiceAIService } from './enhancedVoiceAIService';

// Import Twilio
const twilio = require('twilio');

/**
 * Handles Twilio voice webhook
 * This is where we set up the TwiML response and initiate the conversation
 */
export async function handleTwilioVoiceWebhook(req: Request, res: Response): Promise<void> {
  const callId = req.query.callId as string;
  const twilioSid = req.body.CallSid;
  const callStatus = req.body.CallStatus;
  const machineDetection = req.body.AnsweredBy;

  try {
    logger.info(`Voice webhook called for call ${callId} with status ${callStatus}`, {
      twilioSid,
      machineDetection,
      body: req.body,
      query: req.query
    });

    // Find the call in the database
    const call = await Call.findById(callId);
    if (!call) {
      logger.error(`No call found with ID ${callId}`);
      const twiml = new twilio.twiml.VoiceResponse();
      twiml.say({ voice: 'Polly.Matthew' }, 'We apologize, but we cannot find your call record.');
      twiml.hangup();
      res.type('text/xml');
      res.send(twiml.toString());
      return;
    }

    // Update call with Twilio SID
    await Call.findByIdAndUpdate(callId, {
      twilioSid,
      status: 'in-progress',
      startTime: new Date(),
      updatedAt: new Date()
    });

    // Handle answering machine detection if enabled
    if (machineDetection === 'machine_end_beep' || machineDetection === 'machine_end_silence') {
      logger.info(`Answering machine detected for call ${callId}, continuing with message`);
      // Continue with the call even for answering machines
    }

    // Start the conversation with the AI
    const conversationId = await conversationEngine.startConversation(
      callId, 
      call.leadId.toString(), 
      call.campaignId.toString()
    );
    
    // Get campaign and configuration for voice synthesis
    const campaign = await Campaign.findById(call.campaignId);
    const configuration = await Configuration.findOne();
    
    if (!campaign || !configuration) {
      logger.error('Campaign or configuration not found');
      const twiml = new twilio.twiml.VoiceResponse();
      twiml.say({ voice: 'Polly.Matthew' }, 'We apologize, but there was a configuration error.');
      twiml.hangup();
      res.type('text/xml');
      res.send(twiml.toString());
      return;
    }

    // Create TwiML response
    const twiml = new twilio.twiml.VoiceResponse();
    
    // Get initial AI greeting from campaign script
    const activeScript = campaign.script?.versions?.find(v => v.isActive);
    const initialPrompt = activeScript?.content || 
                         "Hello, this is an automated call from Lumina Outreach. How are you doing today?";
    
    // Get webhook base URL from environment variable only
    const baseUrl = process.env.WEBHOOK_BASE_URL;
    
    // Ensure webhook base URL is set
    if (!baseUrl) {
      logger.error('WEBHOOK_BASE_URL environment variable is not set');
      const twiml = new twilio.twiml.VoiceResponse();
      twiml.say({ voice: 'Polly.Matthew' }, 'We apologize, but there was a server configuration error.');
      twiml.hangup();
      res.type('text/xml');
      res.send(twiml.toString());
      return;
    }
    
    // Try to use ElevenLabs for initial greeting if available
    let useElevenLabs = false;
    if (configuration.elevenLabsConfig?.isEnabled && configuration.elevenLabsConfig?.apiKey) {
      try {
        const openAIProvider = configuration.llmConfig.providers.find(p => p.name === 'openai');
        if (openAIProvider?.isEnabled && openAIProvider?.apiKey) {
          const voiceAI = new EnhancedVoiceAIService(
            configuration.elevenLabsConfig.apiKey,
            openAIProvider.apiKey
          );
          
          // Debug campaign voice configuration for initial greeting
          logger.info(`🔍 Initial Greeting Voice Config Debug for call ${callId}:`, {
            campaignId: call.campaignId,
            campaignFound: !!campaign,
            voiceConfig: campaign.voiceConfiguration,
            requestedVoiceId: campaign.voiceConfiguration?.voiceId,
            voiceProvider: campaign.voiceConfiguration?.provider,
            primaryLanguage: campaign.primaryLanguage
          });
          
          const requestedVoiceId = campaign.voiceConfiguration?.voiceId || 'default';
          logger.info(`🎤 Resolving initial greeting voice ID for call ${callId}: "${requestedVoiceId}"`);
          
          const voiceId = await EnhancedVoiceAIService.getValidVoiceId(requestedVoiceId);
          
          logger.info(`🎯 Final greeting voice ID selected for call ${callId}: "${voiceId}"`);
          
          const speechResponse = await voiceAI.synthesizeAdaptiveVoice({
            text: initialPrompt,
            personalityId: voiceId,
            language: campaign.primaryLanguage === 'hi' ? 'hi' : 'en'
          });
          
          // Check if we got audio content back
          if (speechResponse.audioContent) {
            // Convert buffer to base64 and create a data URL for TwiML
            const audioBase64 = speechResponse.audioContent.toString('base64');
            const audioDataUrl = `data:audio/mpeg;base64,${audioBase64}`;
            
            logger.info(`Using ElevenLabs synthesized greeting for call ${callId}`);
            twiml.play(audioDataUrl);
            useElevenLabs = true;
          }
        }
      } catch (error) {
        logger.error(`Error using ElevenLabs for greeting: ${error}`);
      }
    }
    
    // Fallback to Polly if ElevenLabs failed
    if (!useElevenLabs) {
      logger.info(`Using Polly fallback greeting for call ${callId}`);
      twiml.say({ 
        voice: 'Polly.Matthew',
        language: campaign.primaryLanguage === 'hi' ? 'hi-IN' : 'en-US'
      }, initialPrompt);
    }
    
    // Set up gather for speech input
    twiml.gather({
      input: 'speech',
      action: `${baseUrl}/api/calls/gather?callId=${callId}&conversationId=${conversationId}`,
      method: 'POST',
      speechTimeout: 'auto',
      speechModel: 'enhanced',
      timeout: 5
    });
    
    // Fallback if no speech detected
    twiml.say({ voice: 'Polly.Matthew' }, "I'm sorry, I didn't catch that. Please speak after the tone.");
    twiml.gather({
      input: 'speech',
      action: `${baseUrl}/api/calls/gather?callId=${callId}&conversationId=${conversationId}`,
      method: 'POST',
      speechTimeout: 'auto',
      speechModel: 'enhanced',
      timeout: 5
    });
    
    // Final fallback - hang up if still no response
    twiml.say({ voice: 'Polly.Matthew' }, "Thank you for your time. Goodbye.");
    twiml.hangup();
    
    // Log TwiML for debugging
    const twimlString = twiml.toString();
    logger.info(`Voice webhook TwiML generated for call ${callId}`, {
      useElevenLabs,
      conversationId,
      twimlLength: twimlString.length,
      hasCampaign: !!campaign,
      hasConfig: !!configuration,
      elevenLabsEnabled: configuration?.elevenLabsConfig?.isEnabled
    });
    
    // Send the TwiML response
    res.type('text/xml');
    res.send(twimlString);
    
  } catch (error) {
    logger.error(`Error in voice webhook for call ${callId}:`, error);
    
    // Send fallback TwiML
    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say({ voice: 'Polly.Matthew' }, 'We apologize, but there was a technical issue. Please try again later.');
    twiml.hangup();
    
    res.type('text/xml');
    res.send(twiml.toString());
  }
}

/**
 * Handles Twilio status callback webhook
 * This is used to track call progress and completion
 */
export async function handleTwilioStatusWebhook(req: Request, res: Response): Promise<void> {
  const callId = req.query.callId as string;
  const callStatus = req.body.CallStatus;
  const callDuration = req.body.CallDuration;
  const recordingUrl = req.body.RecordingUrl;

  try {
    logger.info(`Status webhook called for call ${callId} with status ${callStatus}`, {
      body: req.body,
      query: req.query
    });

    // Handle different call statuses
    switch (callStatus) {
      case 'completed':
        await Call.findByIdAndUpdate(callId, {
          status: 'completed',
          endTime: new Date(),
          duration: parseInt(callDuration) || 0,
          recordingUrl: recordingUrl || '',
          updatedAt: new Date()
        });
        
        // Generate call metrics
        await generateCallMetrics(callId);
        break;
        
      case 'busy':
        await Call.findByIdAndUpdate(callId, {
          status: 'busy',
          endTime: new Date(),
          updatedAt: new Date()
        });
        break;
        
      case 'no-answer':
        await Call.findByIdAndUpdate(callId, {
          status: 'no-answer',
          endTime: new Date(),
          updatedAt: new Date()
        });
        break;
        
      case 'failed':
        await Call.findByIdAndUpdate(callId, {
          status: 'failed',
          failureCode: req.body.ErrorCode || '',
          endTime: new Date(),
          updatedAt: new Date()
        });
        break;
    }
    
    res.sendStatus(200);
  } catch (error) {
    logger.error(`Error in status webhook for call ${callId}:`, error);
    res.status(500).send('Error processing status update');
  }
}

/**
 * Handles Twilio gather action webhook
 * This processes speech input from the caller
 */
export async function handleTwilioGatherWebhook(req: Request, res: Response): Promise<void> {
  const callId = req.query.callId as string;
  const conversationId = req.query.conversationId as string;
  const speechResult = req.body.SpeechResult;
  // Get webhook base URL from environment variable only
  const baseUrl = process.env.WEBHOOK_BASE_URL;
  
  // Ensure webhook base URL is set
  if (!baseUrl) {
    logger.error('WEBHOOK_BASE_URL environment variable is not set');
    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say({ voice: 'Polly.Matthew' }, 'We apologize, but there was a server configuration error.');
    twiml.hangup();
    res.type('text/xml');
    res.send(twiml.toString());
    return;
  }

  try {
    logger.info(`Gather webhook called for call ${callId}`, {
      speechResult,
      conversationId,
      body: req.body,
      query: req.query
    });

    // Create TwiML response
    const twiml = new twilio.twiml.VoiceResponse();

    if (speechResult) {
      // Process the speech with the conversation engine
      const aiResponse = await conversationEngine.processUserInput(conversationId, speechResult);
      
      logger.info(`AI response for call ${callId}:`, {
        text: aiResponse.text,
        intent: aiResponse.intent
      });
      
      // Get configuration for ElevenLabs
      const config = await Configuration.findOne();
      let useElevenLabs = false;
      
      if (config?.elevenLabsConfig?.isEnabled && config?.elevenLabsConfig?.apiKey) {
        // Get the call to retrieve voice settings
        const call = await Call.findById(callId);
        if (call) {
          try {
            // Get OpenAI provider for ElevenLabs
            const openAIProvider = config.llmConfig.providers.find(p => p.name === 'openai');
            if (openAIProvider?.isEnabled && openAIProvider?.apiKey) {
              // Initialize ElevenLabs service
              const voiceAI = new EnhancedVoiceAIService(
                config.elevenLabsConfig.apiKey,
                openAIProvider.apiKey
              );
              
              // Get voice configuration with detailed debugging
              const campaign = await Campaign.findById(call.campaignId);
              logger.info(`🔍 Campaign Voice Config Debug for call ${callId}:`, {
                campaignId: call.campaignId,
                campaignFound: !!campaign,
                voiceConfig: campaign?.voiceConfiguration,
                requestedVoiceId: campaign?.voiceConfiguration?.voiceId,
                voiceProvider: campaign?.voiceConfiguration?.provider
              });
              
              const requestedVoiceId = campaign?.voiceConfiguration?.voiceId || 'default';
              logger.info(`🎤 Resolving voice ID for call ${callId}: "${requestedVoiceId}"`);
              
              const voiceId = await EnhancedVoiceAIService.getValidVoiceId(requestedVoiceId);
              
              logger.info(`🎯 Final voice ID selected for call ${callId}: "${voiceId}"`);
              
              // Synthesize speech using ElevenLabs
              const speechResponse = await voiceAI.synthesizeAdaptiveVoice({
                text: aiResponse.text,
                personalityId: voiceId,
                language: campaign?.primaryLanguage === 'hi' ? 'hi' : 'en'
              });
              
              // Use ElevenLabs synthesized audio in the response
              if (speechResponse.audioContent) {
                const audioBase64 = speechResponse.audioContent.toString('base64');
                const audioDataUrl = `data:audio/mpeg;base64,${audioBase64}`;
                logger.info(`Using ElevenLabs synthesis for call ${callId} response`);
                twiml.play(audioDataUrl);
                useElevenLabs = true;
              }
            }
          } catch (error) {
            logger.error(`Error using ElevenLabs in gather webhook: ${error}`);
            useElevenLabs = false;
          }
        }
      }
      
      // Fallback to Polly voice if ElevenLabs is not available or fails
      if (!useElevenLabs) {
        logger.info(`Using Polly fallback for call ${callId} response`);
        twiml.say({ voice: 'Polly.Matthew' }, aiResponse.text);
      }
      
      // Check if conversation should continue based on intent
      const shouldContinue = aiResponse.intent !== 'goodbye' && 
                            aiResponse.intent !== 'end_call' && 
                            aiResponse.intent !== 'closing';
      
      if (shouldContinue) {
        // Set up another gather for continued conversation
        twiml.gather({
          input: 'speech',
          action: `${baseUrl}/api/calls/gather?callId=${callId}&conversationId=${conversationId}`,
          method: 'POST',
          speechTimeout: 'auto',
          speechModel: 'enhanced',
          timeout: 5
        });
        
        // Fallback if no response
        twiml.say({ voice: 'Polly.Matthew' }, "I'm sorry, I didn't catch that. Could you please repeat?");
        twiml.gather({
          input: 'speech',
          action: `${baseUrl}/api/calls/gather?callId=${callId}&conversationId=${conversationId}`,
          method: 'POST',
          speechTimeout: 'auto',
          speechModel: 'enhanced',
          timeout: 5
        });
      } else {
        // End the call gracefully
        twiml.say({ voice: 'Polly.Matthew' }, "Thank you for your time. Have a great day!");
        twiml.hangup();
      }
      
      // Log TwiML for debugging
      const twimlString = twiml.toString();
      logger.info(`Gather webhook TwiML generated for call ${callId}`, {
        useElevenLabs,
        shouldContinue,
        twimlLength: twimlString.length
      });
      
      // Send the TwiML response
      res.type('text/xml');
      res.send(twimlString);
      
    } else {
      // No speech detected, try again with more patience
      logger.info(`No speech detected for call ${callId}, prompting again`);
      
      twiml.say({ voice: 'Polly.Matthew' }, "I'm sorry, I didn't hear anything. Could you please speak?");
      
      twiml.gather({
        input: 'speech',
        action: `${baseUrl}/api/calls/gather?callId=${callId}&conversationId=${conversationId}`,
        method: 'POST',
        speechTimeout: 'auto',
        speechModel: 'enhanced',
        timeout: 8 // Give more time
      });
      
      // Final fallback - end call if still no response
      twiml.say({ voice: 'Polly.Matthew' }, "I'm sorry, we seem to be having difficulty. Thank you for your time. Goodbye.");
      twiml.hangup();
      
      res.type('text/xml');
      res.send(twiml.toString());
    }
  } catch (error) {
    logger.error(`Error in gather webhook for call ${callId}:`, error);
    
    // Send error fallback TwiML
    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say({ voice: 'Polly.Matthew' }, 'We apologize, but there was a technical issue. Please try again later.');
    twiml.hangup();
    
    res.type('text/xml');
    res.send(twiml.toString());
  }
}

/**
 * Handles Twilio stream webhook
 * This processes real-time audio streams from the call
 */
export async function handleTwilioStreamWebhook(req: Request, res: Response): Promise<void> {
  const callId = req.query.callId as string;
  const conversationId = req.query.conversationId as string;
  
  try {
    logger.info(`Stream webhook called for call ${callId} with conversation ${conversationId}`, {
      query: req.query,
      headers: req.headers
    });
    
    if (!callId || !conversationId) {
      logger.error('Missing callId or conversationId in stream webhook');
      res.status(400).send('Missing callId or conversationId');
      return;
    }
    
    // Get the call from database to verify it exists
    const call = await Call.findById(callId);
    if (!call) {
      logger.error(`No call found with ID ${callId} in stream webhook`);
      res.status(404).send('Call not found');
      return;
    }
    
    // Connect to the ElevenLabs voice synthesis service
    const configuration = await Configuration.findOne();
    if (!configuration || !configuration.elevenLabsConfig.isEnabled) {
      logger.error('ElevenLabs not configured for streaming');
      res.status(500).send('Voice synthesis not configured');
      return;
    }
    
    // Get appropriate LLM configuration
    const openAIProvider = configuration.llmConfig.providers.find(p => p.name === 'openai');
    if (!openAIProvider || !openAIProvider.isEnabled) {
      logger.error('OpenAI LLM not configured for streaming');
      res.status(500).send('LLM configuration not set up');
      return;
    }
    
    // Process the conversation through the conversation engine
    // This triggers real-time processing of speech and generates responses
    await conversationEngine.processStreamInput(
      conversationId, 
      callId,
      req,
      res
    );
    
  } catch (error) {
    logger.error(`Error in stream webhook for call ${callId}:`, error);
    res.status(500).send('Error processing stream');
  }
}

/**
 * Update a call with outcome and notes
 */
export async function updateCallWithOutcome(callId: string, outcome: string, notes?: string): Promise<ICall | null> {
  try {
    logger.debug(`Updating call ${callId} with outcome: ${outcome}`);
    
    const updatedCall = await Call.findByIdAndUpdate(
      callId, 
      { 
        $set: { 
          outcome,
          notes,
          updatedAt: new Date()
        } 
      },
      { new: true }
    );
    
    if (!updatedCall) {
      logger.warn(`Call not found for outcome update: ${callId}`);
      return null;
    }
    
    // Add outcome to metrics if it doesn't already exist
    if (!updatedCall.metrics?.outcome) {
      await Call.findByIdAndUpdate(
        callId,
        {
          $set: {
            'metrics.outcome': outcome
          }
        }
      );
    }
    
    return updatedCall;
  } catch (error) {
    logger.error(`Error updating call outcome for ${callId}:`, error);
    throw error;
  }
}

/**
 * Generate comprehensive call metrics after a call is completed
 */
async function generateCallMetrics(callId: string): Promise<void> {
  try {
    const call = await Call.findById(callId);
    if (!call) {
      logger.error(`No call found with ID ${callId} for metrics generation`);
      return;
    }
    
    // Calculate base metrics
    const outcome = call.status === 'completed' ? 'connected' : call.status;
    
    // Get conversation log if available
    const conversationLog = call.conversationLog || [];
    
    // Calculate advanced metrics
    const metrics = {
      duration: call.duration || 0,
      outcome: outcome as 'connected' | 'no-answer' | 'busy' | 'failed' | 'voicemail',
      conversationMetrics: {
        customerEngagement: calculateEngagementScore(conversationLog),
        objectionCount: countObjections(conversationLog),
        interruptionCount: countInterruptions(conversationLog),
        conversionIndicators: identifyConversionIndicators(conversationLog)
      },
      qualityScore: calculateQualityScore(call),
      complianceScore: calculateComplianceScore(call, conversationLog),
      intentDetection: detectIntent(conversationLog),
      callRecordingUrl: call.recordingUrl,
      transcriptionAnalysis: analyzeTranscription(conversationLog)
    };
    
    // Save metrics to the call record
    await Call.findByIdAndUpdate(callId, {
      metrics,
      updatedAt: new Date()
    });
    
    logger.info(`Generated comprehensive metrics for call ${callId}`);
  } catch (error) {
    logger.error(`Error generating metrics for call ${callId}:`, error);
  }
}

// Helper functions for metrics calculation
function calculateEngagementScore(conversationLog: Array<{role: string, content: string}>): number {
  // Calculate engagement based on conversation length, response times, etc.
  if (conversationLog.length === 0) return 0;
  
  // More interactions = higher engagement
  const interactionScore = Math.min(conversationLog.length / 20, 1); // Max at 20 interactions
  
  // Longer user responses = higher engagement
  const userMessages = conversationLog.filter(entry => entry.role === 'user');
  const avgUserLength = userMessages.reduce((sum, entry) => sum + entry.content.length, 0) / (userMessages.length || 1);
  const lengthScore = Math.min(avgUserLength / 100, 1); // Max at 100 chars average
  
  return (interactionScore * 0.6 + lengthScore * 0.4);
}

function countObjections(conversationLog: Array<{role: string, content: string, intent?: string}>): number {
  // Count objections raised by the customer
  return conversationLog.filter(entry => 
    entry.role === 'user' && 
    (entry.intent === 'objection' || 
     /no|not interested|don't want|too expensive|don't need|already have/i.test(entry.content))
  ).length;
}

function countInterruptions(conversationLog: Array<{role: string, content: string}>): number {
  // Detection of interruptions would be implemented based on timestamps
  // For now, return 0 as placeholder
  return 0;
}

function identifyConversionIndicators(conversationLog: Array<{role: string, content: string}>): string[] {
  // Identify positive indicators of conversion
  const indicators: string[] = [];
  
  const userMessages = conversationLog
    .filter(entry => entry.role === 'user')
    .map(entry => entry.content.toLowerCase());
  
  // Check for positive responses
  if (userMessages.some(msg => /yes|interested|tell me more|sounds good|great/i.test(msg))) {
    indicators.push('expressed_interest');
  }
  
  // Check for questions asking for details
  if (userMessages.some(msg => /how much|when can|what is the|how does|pricing|cost/i.test(msg))) {
    indicators.push('asked_details');
  }
  
  // Check for commitment language
  if (userMessages.some(msg => /sign up|register|buy|purchase|get started/i.test(msg))) {
    indicators.push('commitment_language');
  }
  
  // Check for contact information sharing
  if (userMessages.some(msg => /@|email|phone|contact/i.test(msg))) {
    indicators.push('shared_contact_info');
  }
  
  return indicators;
}

function calculateQualityScore(call: ICall): number {
  // Calculate an overall quality score for the call
  if (call.status !== 'completed') return 0;
  
  // Base score on duration (longer calls typically = more engagement)
  const durationScore = Math.min((call.duration || 0) / 300, 1); // Normalize to 0-1, max at 5 minutes
  
  // Add bonus for positive outcomes
  const outcomeBonus = ['interested', 'callback-requested'].includes(call.outcome || '') ? 0.2 : 0;
  
  return Math.min(durationScore * 0.8 + 0.2 + outcomeBonus, 1);
}

function calculateComplianceScore(call: ICall, conversationLog: Array<{role: string, content: string}>): number {
  // Calculate compliance score based on script adherence
  if (!call.complianceScriptId) return 1.0; // No compliance required
  
  let score = 1.0;
  
  // Check if AI properly introduced itself
  const aiIntroductions = conversationLog.filter(entry => 
    entry.role === 'assistant' && 
    (entry.content.includes('automated call') || 
     entry.content.includes('AI assistant') ||
     entry.content.includes('calling from'))
  );
  
  if (aiIntroductions.length === 0) score -= 0.3;
  
  // Check if consent was obtained when required
  const consentPhrases = conversationLog.filter(entry =>
    entry.role === 'assistant' &&
    (entry.content.includes('permission') ||
     entry.content.includes('consent') ||
     entry.content.includes('okay to continue'))
  );
  
  if (consentPhrases.length === 0) score -= 0.2;
  
  return Math.max(score, 0);
}

function detectIntent(conversationLog: Array<{role: string, content: string, intent?: string}>): {
  primaryIntent: string;
  confidence: number;
  secondaryIntents: Array<{intent: string, confidence: number}>;
} {
  // Simplified intent detection
  const userEntries = conversationLog.filter(entry => entry.role === 'user');
  
  if (userEntries.length === 0) {
    return {
      primaryIntent: 'unknown',
      confidence: 0,
      secondaryIntents: []
    };
  }
  
  // Look for explicit intents first
  const intents = userEntries
    .filter(entry => entry.intent)
    .map(entry => entry.intent as string);
  
  if (intents.length > 0) {
    // Count intent frequencies
    const intentCounts = intents.reduce((acc, intent) => {
      acc[intent] = (acc[intent] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    // Sort by frequency
    const sortedIntents = Object.entries(intentCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([intent, count]) => ({
        intent,
        confidence: count / intents.length
      }));
    
    return {
      primaryIntent: sortedIntents[0].intent,
      confidence: sortedIntents[0].confidence,
      secondaryIntents: sortedIntents.slice(1)
    };
  }
  
  // Fallback to keyword-based detection
  const keywords = {
    'purchase_intent': ['buy', 'purchase', 'interested', 'get it', 'sign up', 'register'],
    'information_request': ['tell me', 'how does', 'what is', 'explain', 'more information'],
    'objection': ['expensive', 'not interested', 'no thanks', 'maybe later', 'don\'t need'],
    'positive_feedback': ['good', 'great', 'helpful', 'thanks', 'appreciate'],
    'negative_feedback': ['bad', 'unhelpful', 'waste', 'annoying', 'stop calling']
  };
  
  const scores: Record<string, number> = {};
  
  // Count keywords in user messages
  Object.entries(keywords).forEach(([intent, words]) => {
    const matchCount = userEntries.reduce((count, entry) => {
      const matches = words.filter(word => 
        entry.content.toLowerCase().includes(word.toLowerCase())
      ).length;
      return count + matches;
    }, 0);
    
    scores[intent] = matchCount;
  });
  
  // Find the highest scoring intent
  const sortedScores = Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .filter(([_, score]) => score > 0)
    .map(([intent, score]) => ({
      intent,
      confidence: Math.min(score / 5, 1) // Normalize confidence
    }));
  
  if (sortedScores.length > 0) {
    return {
      primaryIntent: sortedScores[0].intent,
      confidence: sortedScores[0].confidence,
      secondaryIntents: sortedScores.slice(1)
    };
  }
  
  // Default intent if nothing detected
  return {
    primaryIntent: 'general_conversation',
    confidence: 0.5,
    secondaryIntents: []
  };
}

function analyzeTranscription(conversationLog: Array<{role: string, content: string}>): {
  keyPhrases: string[];
  sentimentBySegment: Array<{segment: string, sentiment: number}>;
  followUpRecommendations: string[];
} {
  // Extract user messages
  const userMessages = conversationLog
    .filter(entry => entry.role === 'user')
    .map(entry => entry.content);
  
  if (userMessages.length === 0) {
    return {
      keyPhrases: [],
      sentimentBySegment: [],
      followUpRecommendations: ['No user input detected']
    };
  }
  
  // Simple sentiment analysis (would be replaced with more sophisticated NLP)
  const sentimentBySegment = userMessages.map(message => {
    // Simple keyword-based sentiment
    const positiveWords = ['yes', 'good', 'great', 'like', 'interested', 'thanks', 'appreciate', 'love', 'excellent'];
    const negativeWords = ['no', 'bad', 'don\'t', 'expensive', 'not interested', 'hate', 'terrible', 'awful'];
    
    const lowerMessage = message.toLowerCase();
    const positiveCount = positiveWords.filter(word => lowerMessage.includes(word)).length;
    const negativeCount = negativeWords.filter(word => lowerMessage.includes(word)).length;
    
    // Calculate sentiment score (-1 to 1)
    let sentiment = 0;
    if (positiveCount + negativeCount > 0) {
      sentiment = (positiveCount - negativeCount) / (positiveCount + negativeCount);
    }
    
    return {
      segment: message.substring(0, 50) + (message.length > 50 ? '...' : ''),
      sentiment
    };
  });
  
  // Average sentiment
  const averageSentiment = sentimentBySegment.reduce(
    (sum, item) => sum + item.sentiment, 0
  ) / sentimentBySegment.length;
  
  // Generate recommendations based on sentiment and conversation content
  let followUpRecommendations: string[] = [];
  
  if (averageSentiment > 0.3) {
    followUpRecommendations = [
      'Follow up with detailed information within 24 hours',
      'Schedule a demo or consultation call',
      'Send product/service brochure via email',
      'Add to high-priority lead list'
    ];
  } else if (averageSentiment > -0.3) {
    followUpRecommendations = [
      'Follow up with additional value propositions in 3-5 days',
      'Address potential concerns mentioned in call',
      'Offer limited-time incentive or discount',
      'Send case studies or testimonials'
    ];
  } else {
    followUpRecommendations = [
      'Wait 30+ days before following up',
      'Consider different product/service offering',
      'Update lead status to "not interested"',
      'Remove from active campaign'
    ];
  }
  
  // Extract key phrases (simplified version)
  const keyPhrases: string[] = [];
  
  // Look for questions
  const questions = userMessages.filter(msg => msg.includes('?') || 
    /^(what|when|where|why|how|is|are|can|do|does)/i.test(msg));
  keyPhrases.push(...questions.slice(0, 2));
  
  // Look for statements with specific keywords
  const importantStatements = userMessages.filter(msg => 
    /need|want|looking for|interested in|problem|issue|concern/i.test(msg));
  keyPhrases.push(...importantStatements.slice(0, 2));
  
  // Extract any mentioned prices, dates, or numbers
  const numbersAndDates = userMessages.filter(msg => 
    /\$|\d+|january|february|march|april|may|june|july|august|september|october|november|december/i.test(msg));
  keyPhrases.push(...numbersAndDates.slice(0, 1));
  
  // Limit to 3 key phrases and clean them up
  const cleanKeyPhrases = keyPhrases
    .slice(0, 3)
    .map(phrase => phrase.trim())
    .filter(phrase => phrase.length > 10 && phrase.length < 100);
  
  return {
    keyPhrases: cleanKeyPhrases.length > 0 ? cleanKeyPhrases : ['No significant phrases detected'],
    sentimentBySegment,
    followUpRecommendations
  };
}