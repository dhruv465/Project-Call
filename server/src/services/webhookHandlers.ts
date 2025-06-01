import logger from '../utils/logger';
import Call, { ICall } from '../models/Call';
import { Request, Response } from 'express';
import { conversationEngine } from './index';
import { AdvancedTelephonyService } from './advancedTelephonyService';

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
    logger.info(`Voice webhook called for call ${callId} with status ${callStatus}`);

    // Find the call in the database
    const call = await Call.findById(callId);
    if (!call) {
      logger.error(`No call found with ID ${callId}`);
      res.status(404).send('Call not found');
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
    if (machineDetection === 'machine' && req.query.machineDetection === 'Hangup') {
      logger.info(`Answering machine detected for call ${callId}, hanging up`);
      res.type('text/xml');
      res.send('<Response><Hangup/></Response>');
      
      // Update call status
      await Call.findByIdAndUpdate(callId, {
        status: 'voicemail',
        endTime: new Date(),
        updatedAt: new Date()
      });
      return;
    }

    // Start the conversation with the AI
    const conversationId = await conversationEngine.startConversation(callId, call.leadId, call.campaignId);
    
    // Generate TwiML for the call
    const twiml = new (require('twilio').twiml.VoiceResponse)();
    
    // Set up the stream
    twiml.start().stream({
      url: `${process.env.SERVER_BASE_URL}/api/calls/stream?callId=${callId}&conversationId=${conversationId}`,
      track: 'both'
    });
    
    // Start with the initial AI prompt if there's a compliance script
    if (call.complianceScriptId) {
      // Load the compliance script and have the AI speak it
      twiml.say({ voice: 'Polly.Matthew' }, 'Hello, this is an automated call from Lumina Outreach.');
    }
    
    // Set up the gather for input
    twiml.gather({
      input: 'speech',
      action: `${process.env.SERVER_BASE_URL}/api/calls/gather?callId=${callId}&conversationId=${conversationId}`,
      method: 'POST',
      speechTimeout: 'auto',
      speechModel: 'enhanced'
    });
    
    // Send the TwiML response
    res.type('text/xml');
    res.send(twiml.toString());
    
  } catch (error) {
    logger.error(`Error in voice webhook for call ${callId}:`, error);
    res.status(500).send('Error processing call');
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
    logger.info(`Status webhook called for call ${callId} with status ${callStatus}`);

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

  try {
    logger.info(`Gather webhook called for call ${callId}`);

    if (speechResult) {
      // Process the speech with the conversation engine
      const aiResponse = await conversationEngine.processUserInput(conversationId, speechResult);
      
      // Generate TwiML response with AI output
      const twiml = new (require('twilio').twiml.VoiceResponse)();
      
      // Speak the AI response
      twiml.say({ voice: 'Polly.Matthew' }, aiResponse.text);
      
      // Set up another gather for continued conversation
      twiml.gather({
        input: 'speech',
        action: `${process.env.SERVER_BASE_URL}/api/calls/gather?callId=${callId}&conversationId=${conversationId}`,
        method: 'POST',
        speechTimeout: 'auto',
        speechModel: 'enhanced'
      });
      
      // Send the TwiML response
      res.type('text/xml');
      res.send(twiml.toString());
    } else {
      // No speech detected, try again
      const twiml = new (require('twilio').twiml.VoiceResponse)();
      twiml.say({ voice: 'Polly.Matthew' }, "I'm sorry, I didn't catch that. Could you please repeat?");
      
      twiml.gather({
        input: 'speech',
        action: `${process.env.SERVER_BASE_URL}/api/calls/gather?callId=${callId}&conversationId=${conversationId}`,
        method: 'POST',
        speechTimeout: 'auto',
        speechModel: 'enhanced'
      });
      
      res.type('text/xml');
      res.send(twiml.toString());
    }
  } catch (error) {
    logger.error(`Error in gather webhook for call ${callId}:`, error);
    res.status(500).send('Error processing speech input');
  }
}

/**
 * Handles Twilio stream webhook
 * This processes real-time audio streams from the call
 */
export async function handleTwilioStreamWebhook(req: Request, res: Response): Promise<void> {
  const callId = req.query.callId as string;
  
  try {
    logger.info(`Stream webhook called for call ${callId}`);
    
    // Process the stream data as needed
    
    res.sendStatus(200);
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
        emotionalTone: detectEmotionalTones(conversationLog),
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
  return conversationLog.length > 10 ? 0.8 : 0.5;
}

function detectEmotionalTones(conversationLog: Array<{role: string, content: string, emotion?: string}>): string[] {
  // Extract and return emotions detected in the conversation
  const emotions = new Set<string>();
  conversationLog.forEach(entry => {
    if (entry.emotion) emotions.add(entry.emotion);
  });
  return Array.from(emotions);
}

function countObjections(conversationLog: Array<{role: string, content: string, intent?: string}>): number {
  // Count objections raised by the customer
  return conversationLog.filter(entry => 
    entry.role === 'user' && 
    (entry.intent === 'objection' || /no|not interested|don't want|too expensive/i.test(entry.content))
  ).length;
}

function countInterruptions(conversationLog: Array<{role: string, content: string}>): number {
  // Detection of interruptions would be implemented based on timestamps
  return 0; // Placeholder implementation
}

function identifyConversionIndicators(conversationLog: Array<{role: string, content: string}>): string[] {
  // Identify positive indicators of conversion
  const indicators: string[] = [];
  
  // Check for positive responses
  if (conversationLog.some(entry => 
    entry.role === 'user' && 
    /yes|interested|tell me more|sounds good/i.test(entry.content)
  )) {
    indicators.push('expressed_interest');
  }
  
  // Check for questions asking for details
  if (conversationLog.some(entry => 
    entry.role === 'user' && 
    /how much|when can|what is the|how does/i.test(entry.content)
  )) {
    indicators.push('asked_details');
  }
  
  return indicators;
}

function calculateQualityScore(call: ICall): number {
  // Calculate an overall quality score for the call
  if (call.status !== 'completed') return 0;
  
  const durationScore = Math.min(call.duration || 0, 300) / 300; // Normalize to 0-1
  return durationScore * 0.8 + 0.2; // Base quality score
}

function calculateComplianceScore(call: ICall, conversationLog: Array<{role: string, content: string}>): number {
  // Calculate compliance score based on script adherence
  if (!call.complianceScriptId) return 1.0; // No compliance required
  
  // Check if compliance statements were made
  const aiIntroductions = conversationLog.filter(entry => 
    entry.role === 'assistant' && 
    entry.content.includes('automated call')
  );
  
  return aiIntroductions.length > 0 ? 1.0 : 0.5;
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
    'purchase_intent': ['buy', 'purchase', 'interested', 'get it'],
    'information_request': ['tell me', 'how does', 'what is', 'explain'],
    'objection': ['expensive', 'not interested', 'no thanks', 'maybe later'],
    'positive_feedback': ['good', 'great', 'helpful', 'thanks'],
    'negative_feedback': ['bad', 'unhelpful', 'waste', 'annoying']
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
    const positiveWords = ['yes', 'good', 'great', 'like', 'interested', 'thanks'];
    const negativeWords = ['no', 'bad', 'don\'t', 'expensive', 'not interested'];
    
    const positiveCount = positiveWords.filter(word => 
      message.toLowerCase().includes(word)
    ).length;
    
    const negativeCount = negativeWords.filter(word => 
      message.toLowerCase().includes(word)
    ).length;
    
    // Calculate sentiment score (-1 to 1)
    const sentiment = (positiveCount - negativeCount) / 
      (positiveCount + negativeCount || 1);
    
    return {
      segment: message,
      sentiment
    };
  });
  
  // Average sentiment
  const averageSentiment = sentimentBySegment.reduce(
    (sum, item) => sum + item.sentiment, 0
  ) / sentimentBySegment.length;
  
  // Generate recommendations based on sentiment
  let followUpRecommendations = [];
  
  if (averageSentiment > 0.3) {
    followUpRecommendations = [
      'Follow up with detailed information',
      'Schedule a demo or consultation',
      'Send product/service brochure'
    ];
  } else if (averageSentiment > -0.3) {
    followUpRecommendations = [
      'Follow up with additional value propositions',
      'Address potential concerns',
      'Offer limited-time incentive'
    ];
  } else {
    followUpRecommendations = [
      'Wait before following up',
      'Consider different offering',
      'Try different communication channel'
    ];
  }
  
  // Extract potential key phrases (simplified)
  const keyPhrases = userMessages
    .join(' ')
    .split(/[,.!?]/)
    .filter(phrase => phrase.trim().split(' ').length > 3)
    .slice(0, 3);
  
  return {
    keyPhrases,
    sentimentBySegment,
    followUpRecommendations
  };
}
