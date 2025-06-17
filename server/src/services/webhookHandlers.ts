import { Request, Response } from 'express';
import logger from '../utils/logger';
import { getErrorMessage } from '../utils/logger';
import Call, { ICall } from '../models/Call';
import Campaign from '../models/Campaign';
import Configuration from '../models/Configuration';
import { conversationEngine } from './index';
import { AdvancedTelephonyService } from './advancedTelephonyService';
import { EnhancedVoiceAIService } from './enhancedVoiceAIService';
import { synthesizeVoiceResponse, processAudioForTwiML , prepareUrlForTwilioPlay } from '../utils/voiceSynthesis';
import { getPreferredVoiceId } from '../utils/voiceUtils';
import fs from 'fs';
import path from 'path';
import os from 'os';
import cloudinaryService from '../utils/cloudinaryService';

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
      
      // Get configuration for ElevenLabs
      const config = await Configuration.findOne();
      const errorMessage = config?.errorMessages?.noCallFound || 'We apologize, but we cannot find your call record.';
      
      // Generate error response with ElevenLabs if available
      const twiml = new twilio.twiml.VoiceResponse();
      
      if (config?.elevenLabsConfig?.isEnabled && config?.elevenLabsConfig?.apiKey) {
        try {
          // Check for ANY enabled LLM provider, not just OpenAI
          const enabledProvider = config.llmConfig.providers.find(p => p.isEnabled && p.apiKey);
          if (enabledProvider) {
            const voiceAI = new EnhancedVoiceAIService(
              config.elevenLabsConfig.apiKey
            );
            
            const defaultVoiceId = config.voiceAIConfig?.conversationalAI?.defaultVoiceId || 
                                 'XvRdSQXvmv5jHPGBw0XU'; // Default voice ID
            
            // Process audio safely using the processAudioForTwiML helper
            const speechResponse = await voiceAI.synthesizeAdaptiveVoice({
              text: errorMessage,
              personalityId: defaultVoiceId,
              language: 'en'
            });
            
            if (speechResponse.audioContent) {
              // Process audio safely using helper function
              const audioResult = await processAudioForTwiML(
                speechResponse.audioContent,
                errorMessage,
                'en'
              );
              
              if (audioResult.method === 'tts') {
                // Check if this is a chunked audio request
                if (!handleChunkedAudioForTwiML(twiml, audioResult.url, 'en')) {
                  // Use regular TTS fallback
                  twiml.say({ voice: 'alice', language: 'en-US' }, errorMessage);
                }
              } else {
                // Use Cloudinary URL or small base64 data
                twiml.play(prepareUrlForTwilioPlay(audioResult.url));
              }
            } else {
              // Use TTS fallback instead of empty audio
              twiml.say({ voice: 'alice', language: 'en-US' }, errorMessage);
            }
          } else {
            // Use TTS fallback instead of empty audio
            twiml.say({ voice: 'alice', language: 'en-US' }, errorMessage);
          }
        } catch (error) {
          // Use TTS fallback instead of empty audio
          twiml.say({ voice: 'alice', language: 'en-US' }, errorMessage);
        }
      } else {
        // Use TTS fallback instead of empty audio
        twiml.say({ voice: 'alice', language: 'en-US' }, errorMessage);
      }
      
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
    
    // Log the current configuration state for debugging
    logger.info(`📋 Current configuration state for call ${callId}:`, {
      configExists: !!configuration,
      deepgramConfig: {
        isEnabled: configuration?.deepgramConfig?.isEnabled,
        hasApiKey: !!configuration?.deepgramConfig?.apiKey,
        model: configuration?.deepgramConfig?.model
      },
      elevenLabsConfig: {
        isEnabled: configuration?.elevenLabsConfig?.isEnabled,
        useFlashModel: configuration?.elevenLabsConfig?.useFlashModel,
        hasApiKey: !!configuration?.elevenLabsConfig?.apiKey
      },
      llmConfig: {
        defaultProvider: configuration?.llmConfig?.defaultProvider,
        providers: configuration?.llmConfig?.providers?.map(p => ({
          name: p.name,
          isEnabled: p.isEnabled,
          useRealtimeAPI: p.useRealtimeAPI,
          hasApiKey: !!p.apiKey
        }))
      }
    });
    
    if (!campaign || !configuration) {
      logger.error('Campaign or configuration not found');
      
      // Get error message
      const errorMessage = 'We apologize, but there was a configuration error.';
      
      // Generate error response with TwiML
      const twiml = new twilio.twiml.VoiceResponse();
      
      // Try to use ElevenLabs if possible
      if (configuration?.elevenLabsConfig?.isEnabled && configuration?.elevenLabsConfig?.apiKey) {
        try {
          // Check for ANY enabled LLM provider, not just OpenAI
          const enabledProvider = configuration.llmConfig.providers.find(p => p.isEnabled && p.apiKey);
          if (enabledProvider) {
            const voiceAI = new EnhancedVoiceAIService(
              configuration.elevenLabsConfig.apiKey
            );
            
            const defaultVoiceId = configuration.voiceAIConfig?.conversationalAI?.defaultVoiceId || 
                                  'XvRdSQXvmv5jHPGBw0XU'; // Default voice ID
            
            // Process audio safely using the processAudioForTwiML helper
            const speechResponse = await voiceAI.synthesizeAdaptiveVoice({
              text: errorMessage,
              personalityId: defaultVoiceId,
              language: 'en'
            });
            
            if (speechResponse.audioContent) {
              // Process audio safely using helper function
              const audioResult = await processAudioForTwiML(
                speechResponse.audioContent,
                errorMessage,
                'en'
              );
              
              if (audioResult.method === 'tts') {
                // Check if this is a chunked audio request
                if (!handleChunkedAudioForTwiML(twiml, audioResult.url, 'en')) {
                  // Use regular TTS fallback
                  twiml.say({ voice: 'alice', language: 'en-US' }, errorMessage);
                }
              } else {
                // Use Cloudinary URL or small base64 data
                twiml.play(prepareUrlForTwilioPlay(audioResult.url));
              }
            } else {
              // Use TTS fallback instead of empty audio
              twiml.say({ voice: 'alice', language: 'en-US' }, errorMessage);
            }
          } else {
            // Use TTS fallback instead of empty audio
            twiml.say({ voice: 'alice', language: 'en-US' }, errorMessage);
          }
        } catch (error) {
          // Use TTS fallback instead of empty audio
          twiml.say({ voice: 'alice', language: 'en-US' }, errorMessage);
        }
      } else {
        // Use TTS fallback instead of empty audio
        twiml.say({ voice: 'alice', language: 'en-US' }, errorMessage);
      }
      twiml.hangup();
      res.type('text/xml');
      res.send(twiml.toString());
      return;
    }
    
    // Try to use ElevenLabs for initial greeting if available
    let useElevenLabs = false;
    
    // Create the TwiML response
    const twiml = new twilio.twiml.VoiceResponse();
    
    if (configuration.elevenLabsConfig?.isEnabled && configuration.elevenLabsConfig?.apiKey) {
      try {
        // Check for ANY enabled LLM provider, not just OpenAI
        const enabledProvider = configuration.llmConfig.providers.find(p => p.isEnabled && p.apiKey);
        if (enabledProvider) {
          logger.info(`🔧 ElevenLabs configuration status: ${configuration.elevenLabsConfig.status || 'unknown'}, API key length: ${configuration.elevenLabsConfig.apiKey.length}, using LLM provider: ${enabledProvider.name}`);
          
          const voiceAI = new EnhancedVoiceAIService(
            configuration.elevenLabsConfig.apiKey
          );
          
          // Debug campaign voice configuration for initial greeting
          logger.info(`🔍 Initial Greeting Voice Config Debug for call ${callId}:`, {
            campaignId: call.campaignId,
            campaignFound: !!campaign,
            voiceConfig: campaign.voiceConfiguration,
            requestedVoiceId: campaign.voiceConfiguration?.voiceId,
            voiceProvider: campaign.voiceConfiguration?.provider,
            primaryLanguage: campaign.primaryLanguage,
            elevenLabsApiKey: `${configuration.elevenLabsConfig.apiKey.substring(0, 5)}...${configuration.elevenLabsConfig.apiKey.substring(configuration.elevenLabsConfig.apiKey.length - 5)}`,
            providerName: enabledProvider.name,
            hasApiKey: !!enabledProvider.apiKey
          });
          
          // Get the preferred voice ID from configuration or campaign
          const preferredVoiceId = await getPreferredVoiceId();
          const requestedVoiceId = campaign.voiceConfiguration?.voiceId || preferredVoiceId;
          logger.info(`🎤 Resolving initial greeting voice ID for call ${callId}: "${requestedVoiceId}"`);
          
          const voiceId = await EnhancedVoiceAIService.getValidVoiceId(requestedVoiceId);
          logger.info(`🎯 Final greeting voice ID selected for call ${callId}: "${voiceId}"`);
          
          // Properly formatted greeting text
          const formattedGreeting = campaign.initialPrompt?.trim() || 'Hello, thank you for answering. This is an automated call.';
          logger.info(`🗣️ Synthesizing greeting: "${formattedGreeting.substring(0, 50)}${formattedGreeting.length > 50 ? '...' : ''}"`);
          
          // Try direct voice synthesis first (more reliable)
          try {
            // This uses a more reliable synthesis method with file output
            const speechFilePath = await voiceAI.synthesizeVoice({
              text: formattedGreeting,
              personalityId: voiceId,
              language: campaign.primaryLanguage === 'hi' ? 'Hindi' : 'English'
            });
            
            // Check if the file exists and is not empty
            if (fs.existsSync(speechFilePath) && fs.statSync(speechFilePath).size > 0) {
              // Process audio safely using helper function
              const audioBuffer = fs.readFileSync(speechFilePath);
              const audioResult = await processAudioForTwiML(
                audioBuffer,
                formattedGreeting,
                campaign.primaryLanguage
              );
              
              if (audioResult.method === 'tts') {
                // Check if this is a chunked audio request
                if (!handleChunkedAudioForTwiML(twiml, audioResult.url, campaign.primaryLanguage)) {
                  // Use regular TTS fallback
                  twiml.say({ voice: 'alice', language: campaign.primaryLanguage === 'hi' ? 'hi-IN' : 'en-US' }, formattedGreeting);
                }
              } else {
                // Use Cloudinary URL or small base64 data
                twiml.play(prepareUrlForTwilioPlay(audioResult.url));
                useElevenLabs = true;
              }
              
              // Clean up temp file
              try {
                fs.unlinkSync(speechFilePath);
              } catch (cleanupError) {
                logger.warn(`Failed to clean up temp file ${speechFilePath}: ${getErrorMessage(cleanupError)}`);
              }
            } else {
              throw new Error(`Speech file empty or missing: ${speechFilePath}`);
            }
          } catch (fileMethodError) {
            // Fall back to adaptive voice method if file method fails
            logger.warn(`File synthesis method failed, trying adaptive method: ${fileMethodError}`);
            
            const speechResponse = await voiceAI.synthesizeAdaptiveVoice({
              text: formattedGreeting,
              personalityId: voiceId,
              language: campaign.primaryLanguage === 'hi' ? 'hi' : 'en'
            });
            
            // Check if we got audio content back
            if (speechResponse && speechResponse.audioContent) {
              // Process audio safely using helper function
              const audioResult = await processAudioForTwiML(
                speechResponse.audioContent,
                formattedGreeting,
                campaign.primaryLanguage
              );
              
              if (audioResult.method === 'tts') {
                // Check if this is a chunked audio request
                if (!handleChunkedAudioForTwiML(twiml, audioResult.url, campaign.primaryLanguage)) {
                  // Use regular TTS fallback
                  twiml.say({ voice: 'alice', language: campaign.primaryLanguage === 'hi' ? 'hi-IN' : 'en-US' }, formattedGreeting);
                }
              } else {
                // Use Cloudinary URL or small base64 data
                twiml.play(prepareUrlForTwilioPlay(audioResult.url));
                useElevenLabs = true;
              }
            } else {
              logger.error(`⚠️ No audio content in speechResponse: ${JSON.stringify(speechResponse || {})}`);
              // Use TTS fallback
              twiml.say({ 
                voice: 'alice', 
                language: campaign.primaryLanguage === 'hi' ? 'hi-IN' : 'en-US' 
              }, formattedGreeting);
            }
          }
        } else {
          logger.error(`No enabled LLM provider with API key found. ElevenLabs may not be used for the initial greeting or might use a default/fallback voice if it can operate independently for basic synthesis.`);
        }
      } catch (error) {
        logger.error(`Error using ElevenLabs for greeting: ${error}`);
      }
    } else {
      logger.warn(`ElevenLabs not configured properly - enabled: ${!!configuration.elevenLabsConfig?.isEnabled}, apiKey exists: ${!!configuration.elevenLabsConfig?.apiKey}`);
    }
    
    // Fallback if ElevenLabs failed
    if (!useElevenLabs) {
      logger.info(`ElevenLabs failed for call ${callId}, using system configuration instead`);
      // NO HARDCODED FALLBACK - must get from campaign configuration
      if (!campaign.initialPrompt?.trim()) {
        throw new Error(`Campaign ${call.campaignId} has no initial prompt configured. Please configure the campaign with proper greeting content.`);
      }
      twiml.say({ voice: 'alice' }, campaign.initialPrompt.trim());
    }
    
    // Check if we should use WebSocket streaming with Deepgram and new AI stack
    const deepgramEnabled = configuration?.deepgramConfig?.isEnabled;
    const flashModelEnabled = configuration?.elevenLabsConfig?.useFlashModel;
    const realtimeAPIEnabled = configuration?.llmConfig?.providers?.some(p => p.useRealtimeAPI);
    
    logger.info(`Configuration check for call ${callId}: Deepgram enabled=${deepgramEnabled}, Flash model=${flashModelEnabled}, Realtime API=${realtimeAPIEnabled}`, {
      deepgramConfig: configuration?.deepgramConfig,
      elevenLabsUseFlash: configuration?.elevenLabsConfig?.useFlashModel,
      llmProviders: configuration?.llmConfig?.providers?.map(p => ({ name: p.name, useRealtimeAPI: p.useRealtimeAPI, isEnabled: p.isEnabled }))
    });
    
    const useAdvancedStreaming = deepgramEnabled || flashModelEnabled || realtimeAPIEnabled;
    
    if (useAdvancedStreaming) {
      logger.info(`Using advanced WebSocket streaming for call ${callId} with features: Deepgram=${!!configuration?.deepgramConfig?.isEnabled}, Flash=${!!configuration?.elevenLabsConfig?.useFlashModel}, Realtime=${!!configuration?.llmConfig?.providers?.some(p => p.useRealtimeAPI)}`);
      
      // Use WebSocket streaming with the new AI stack
      const connect = twiml.connect();
      const stream = connect.stream({
        url: `wss://${req.headers.host}/api/stream/voice/low-latency?callId=${callId}&conversationId=${conversationId}`,
        name: 'project-call-stream'
      });
      
      // Add stream parameters for enhanced functionality
      stream.parameter({
        name: 'callId',
        value: callId
      });
      stream.parameter({
        name: 'conversationId', 
        value: conversationId
      });
      stream.parameter({
        name: 'campaignId',
        value: call.campaignId.toString()
      });
      stream.parameter({
        name: 'leadId',
        value: call.leadId.toString()
      });
      
      // Add advanced features parameters
      if (configuration?.deepgramConfig?.isEnabled) {
        stream.parameter({
          name: 'useDeepgram',
          value: 'true'
        });
      }
      if (configuration?.elevenLabsConfig?.useFlashModel) {
        stream.parameter({
          name: 'useFlashModel',
          value: 'true'
        });
      }
      if (configuration?.llmConfig?.providers?.some(p => p.useRealtimeAPI)) {
        stream.parameter({
          name: 'useRealtimeAPI',
          value: 'true'
        });
      }
      
    } else {
      // Use traditional gather method with Twilio's built-in speech recognition
      logger.info(`Using traditional gather method for call ${callId}`);
      
      const gather = twiml.gather({
        input: 'speech',
        action: `${process.env.WEBHOOK_BASE_URL}/api/calls/gather?callId=${callId}&conversationId=${conversationId}`,
        method: 'POST',
        speechTimeout: 3,
        speechModel: 'phone_call',
        timeout: 10,  // Increased timeout to give user more time
        numDigits: 1  // Allow for backup DTMF input
      });
      
      // Add a brief pause to let the greeting audio finish
      gather.pause({ length: 1 });
      
      // Only add timeout fallback - this will only execute if no speech is detected
      // Get message from configuration for timeout handling
      const config = await Configuration.findOne();
      const goodbyeMessage = config?.callResponses?.goodbye || "Thank you for your time. Goodbye.";
      
      // Determine the default LLM provider and pass its key
      const defaultLlmProviderName = configuration?.llmConfig?.defaultProvider;
      const defaultLlmProvider = configuration?.llmConfig?.providers?.find(p => p.name === defaultLlmProviderName);

      // Use ElevenLabs for goodbye message - only on timeout
      const usedElevenLabs = await synthesizeVoiceResponse(
        twiml, 
        goodbyeMessage, 
        {
          voiceId: campaign?.voiceConfiguration?.voiceId,
          language: campaign.primaryLanguage === 'hi' ? 'hi' : 'en',
          campaignId: campaign?._id?.toString(),
          elevenLabsApiKey: configuration?.elevenLabsConfig?.apiKey,
          llmApiKey: defaultLlmProvider?.apiKey, // Use the configured default LLM API key
          fallbackBehavior: 'tts' // Use Twilio TTS as fallback instead of empty audio
        }
      );
      
      if (!usedElevenLabs) {
        logger.info(`Used Twilio TTS for goodbye message for call ${callId}`);
      }
      
      twiml.hangup();
    }
    
    // Log TwiML for debugging
    const twimlString = twiml.toString();
    const twimlLength = twimlString.length;
    const twimlSizeKB = Math.round(twimlLength / 1024 * 100) / 100;
    
    // Check TwiML size to warn about potential issues
    if (twimlLength > 61440) { // 60KB - CRITICAL warning
      logger.error(`⚠️ CRITICAL: TwiML response for call ${callId} is dangerously close to Twilio's 64KB limit at ${twimlSizeKB}KB!`);
    } else if (twimlLength > 51200) { // 50KB - Warning level
      logger.warn(`⚠️ WARNING: TwiML response for call ${callId} is large (${twimlSizeKB}KB) - approaching Twilio's 64KB limit`);
    } else if (twimlLength > 30720) { // 30KB - Info level
      logger.info(`ℹ️ NOTE: TwiML response for call ${callId} is moderately large (${twimlSizeKB}KB)`);
    }
    
    logger.info(`Voice webhook TwiML generated for call ${callId}`, {
      useElevenLabs,
      conversationId,
      twimlLength,
      twimlSizeKB,
      hasCampaign: !!campaign,
      hasConfig: !!configuration,
      elevenLabsEnabled: configuration?.elevenLabsConfig?.isEnabled,
      elevenLabsStatus: configuration?.elevenLabsConfig?.status,
      unusualActivityDetected: configuration?.elevenLabsConfig?.unusualActivityDetected || false
    });
    
    // Send the TwiML response
    res.type('text/xml');
    res.send(twimlString);
    
  } catch (error) {
    logger.error(`Error in voice webhook for call ${callId}:`, error);
    
    // Send fallback TwiML
    const twiml = new twilio.twiml.VoiceResponse();
    
    // Get message from configuration
    const config = await Configuration.findOne();
    const errorMessage = config?.errorMessages?.technicalIssue || 'We apologize, but there was a technical issue. Please try again later.';
    
    // Use ElevenLabs for error message
    await synthesizeVoiceResponse(twiml, errorMessage, {});
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
    
    // Get message from configuration
    const config = await Configuration.findOne();
    const errorMessage = config?.errorMessages?.serverError || 'We apologize, but there was a server configuration error.';
    
    // Use ElevenLabs for error message
    await synthesizeVoiceResponse(twiml, errorMessage, {});
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
      
      // Try to use ElevenLabs if configured
      if (config?.elevenLabsConfig?.isEnabled && config?.elevenLabsConfig?.apiKey) {
        // Get the call to retrieve voice settings
        const call = await Call.findById(callId);
        if (call) {
          try {
            // Get the configured default LLM provider
            const defaultProviderName = config.llmConfig.defaultProvider;
            const configuredProvider = config.llmConfig.providers.find(p => p.name === defaultProviderName);

            if (configuredProvider?.isEnabled && configuredProvider?.apiKey) {
              logger.info(`Using LLM provider '${configuredProvider.name}' for ElevenLabs in gather webhook.`);
              // Initialize ElevenLabs service
              const voiceAI = new EnhancedVoiceAIService(
                config.elevenLabsConfig.apiKey
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
                // Process audio safely using helper function
                const audioResult = await processAudioForTwiML(
                  speechResponse.audioContent,
                  aiResponse.text,
                  campaign?.primaryLanguage === 'hi' ? 'hi' : 'en'
                );
                
                if (audioResult.method === 'tts') {
                // Check if this is a chunked audio request
                if (!handleChunkedAudioForTwiML(twiml, audioResult.url, 'en')) {
                  // Use regular TTS fallback
                  twiml.say({ voice: 'alice', language: campaign?.primaryLanguage === 'hi' ? 'hi-IN' : 'en-US' }, aiResponse.text);
                }
              } else {
                  // Use Cloudinary URL or small base64 data
                  twiml.play(prepareUrlForTwilioPlay(audioResult.url));
                  useElevenLabs = true;
                }
              }
            } else {
              logger.warn(`Configured LLM provider '${defaultProviderName || 'Unknown'}' not enabled or missing API key. ElevenLabs synthesis for AI response might be skipped or use fallback.`);
              // useElevenLabs will remain false, leading to fallback.
            }
          } catch (error) {
            logger.error(`Error using ElevenLabs in gather webhook: ${error}`);
            useElevenLabs = false;
          }
        }
      }
      
      // Fallback if ElevenLabs is not available or fails
      if (!useElevenLabs) {
        logger.info(`Using TTS fallback for call ${callId} response`);
        // Use TTS instead of empty audio
        twiml.say({ 
          voice: 'alice', 
          language: 'en-US' 
        }, aiResponse.text);
      }
      
      // Check if conversation should continue based on intent
      const shouldContinue = aiResponse.intent !== 'goodbye' && 
                            aiResponse.intent !== 'end_call' &&
                            !aiResponse.text.toLowerCase().includes('goodbye') &&
                            !aiResponse.text.toLowerCase().includes('thank you for your time');
      
      if (shouldContinue) {
        // Continue the conversation with another gather
        twiml.gather({
          input: 'speech',
          action: `${baseUrl}/api/calls/gather?callId=${callId}&conversationId=${conversationId}`,
          method: 'POST',
          speechTimeout: 3,
          speechModel: 'phone_call',
          timeout: 5
        });
        
        // Handle no-speech fallback with reasonable behavior
        const noSpeechMessage = config?.errorMessages?.noSpeechDetected || "I'm sorry, I didn't hear anything. Please speak again.";
        
        // Get call and campaign information for voice synthesis
        const currentCall = await Call.findById(callId);
        const currentCampaign = currentCall ? await Campaign.findById(currentCall.campaignId) : null;
        
        // Use ElevenLabs for speech error message
        await synthesizeVoiceResponse(
          twiml, 
          noSpeechMessage, 
          {
            campaignId: currentCall?.campaignId?.toString(),
            language: currentCampaign?.primaryLanguage === 'hi' ? 'hi' : 'en'
          }
        );
        
        twiml.gather({
          input: 'speech',
          action: `${baseUrl}/api/calls/gather?callId=${callId}&conversationId=${conversationId}`,
          method: 'POST',
          speechTimeout: 3,
          speechModel: 'phone_call',
          timeout: 5
        });
      } else {
        // End the call gracefully
        const thankYouMessage = config?.callResponses?.thankYou || "Thank you for your time. Have a great day!";
        
        // Get call and campaign information
        const currentCall = await Call.findById(callId);
        const currentCampaign = currentCall ? await Campaign.findById(currentCall.campaignId) : null;
        
        // Use ElevenLabs for thank you message
        await synthesizeVoiceResponse(
          twiml, 
          thankYouMessage, 
          {
            campaignId: currentCall?.campaignId?.toString(),
            language: currentCampaign?.primaryLanguage === 'hi' ? 'hi' : 'en'
          }
        );
        
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
      
      // Get message from configuration
      const config = await Configuration.findOne();
      const noSpeechMessage = config?.errorMessages?.noSpeechDetected || "I'm sorry, we didn't hear anything. Could you please speak?";
      
      // Use ElevenLabs for no speech message
      const call = await Call.findById(callId);
      const campaign = call ? await Campaign.findById(call.campaignId) : null;
      
      await synthesizeVoiceResponse(
        twiml, 
        noSpeechMessage, 
        {
          campaignId: call?.campaignId?.toString(),
          language: campaign?.primaryLanguage === 'hi' ? 'hi' : 'en'
        }
      );
      
      // Give the user another chance to speak
      twiml.gather({
        input: 'speech',
        action: `${baseUrl}/api/calls/gather?callId=${callId}&conversationId=${conversationId}`,
        method: 'POST',
        speechTimeout: 3,
        speechModel: 'phone_call',
        timeout: 5
      });
      
      // End the call if they still don't speak
      const disconnectMessage = config?.errorMessages?.callDisconnected || "I'm sorry, we seem to be having difficulty. Thank you for your time. Goodbye.";
      
      // Use ElevenLabs for disconnect message
      await synthesizeVoiceResponse(
        twiml, 
        disconnectMessage, 
        {
          campaignId: call?.campaignId?.toString(),
          language: campaign?.primaryLanguage === 'hi' ? 'hi' : 'en'
        }
      );
      
      twiml.hangup();
    }
  } catch (error) {
    logger.error(`Error in gather webhook for call ${callId}:`, error);
    
    // Send error fallback TwiML
    const twiml = new twilio.twiml.VoiceResponse();
    
    // Get message from configuration
    const config = await Configuration.findOne();
    const errorMessage = config?.errorMessages?.technicalIssue || 'We apologize, but there was a technical issue. Please try again later.';
    
    // Use ElevenLabs for error message
    await synthesizeVoiceResponse(twiml, errorMessage, {});
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
    const defaultProviderNameStream = configuration.llmConfig.defaultProvider; // Renamed to avoid conflict
    const configuredProviderStream = configuration.llmConfig.providers.find(p => p.name === defaultProviderNameStream); // Renamed

    if (!configuredProviderStream || !configuredProviderStream.isEnabled || !configuredProviderStream.apiKey) {
      logger.error(`Configured LLM provider '${defaultProviderNameStream || 'Unknown'}' not enabled or missing API key. Streaming cannot proceed.`);
      res.status(500).send('Required LLM configuration for streaming is not properly set up.');
      return;
    }
    
    // Process the conversation through the conversation engine
    // This triggers real-time processing of speech and generates responses
    await conversationEngine.processUserInput(
      conversationId, 
      "Real-time stream processing initiated" // Placeholder text
    );
    
    // Just return success as we're handling the response elsewhere
    res.status(200).send('Stream processing initiated');
    
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
        emotionalTone: extractEmotionalTones(conversationLog),
        objectionCount: await countObjections(conversationLog),
        interruptionCount: countInterruptions(conversationLog),
        conversionIndicators: identifyConversionIndicators(conversationLog)
      },
      qualityScore: calculateQualityScore(call),
      complianceScore: calculateComplianceScore(call, conversationLog),
      intentDetection: await detectIntent(conversationLog),
      callRecordingUrl: call.recordingUrl,
      transcriptionAnalysis: await analyzeTranscription(conversationLog)
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

async function countObjections(conversationLog: Array<{role: string, content: string, intent?: string}>): Promise<number> {
  // Use LLM-detected intents when available
  const explicitObjections = conversationLog.filter(entry => 
    entry.role === 'user' && entry.intent === 'objection'
  ).length;
  
  // If no explicit objections are tagged, analyze content
  if (explicitObjections === 0) {
    // Get configuration for dynamic objection phrases
    try {
      const config = require('../models/Configuration').default;
      const configDoc = await config.findOne();
      const objectionPhrases = configDoc?.intentDetection?.objectionPhrases || [];
      
      // Count objections based on configured phrases
      return conversationLog.filter(entry => 
        entry.role === 'user' && 
        objectionPhrases.some(phrase => 
          entry.content.toLowerCase().includes(phrase.toLowerCase())
        )
      ).length;
    } catch (error) {
      return 0;
    }
  }
  
  return explicitObjections;
}

function countInterruptions(conversationLog: Array<{role: string, content: string, timestamp?: Date}>): number {
  // Count interruptions based on timestamp overlaps and context
  // An interruption occurs when a user starts speaking before the AI has finished
  if (conversationLog.length < 3) {
    return 0; // Not enough entries to detect interruptions
  }
  
  let interruptionCount = 0;
  const interruptionThresholdMs = 500; // Threshold in milliseconds to consider it an interruption
  
  // Start from index 2 to check AI -> User -> AI pattern
  for (let i = 2; i < conversationLog.length; i += 2) {
    const previousAI = conversationLog[i-2];
    const user = conversationLog[i-1];
    const currentAI = conversationLog[i];
    
    // Skip if any of the entries are not the expected roles
    if (previousAI.role !== 'assistant' || user.role !== 'user' || currentAI.role !== 'assistant') {
      continue;
    }
    
    // Check for interruption indicators in timestamps if available
    if (previousAI.timestamp && user.timestamp) {
      // Calculate expected AI speaking time based on text length (roughly 100ms per character)
      const expectedSpeakingTimeMs = previousAI.content.length * 100;
      
      // If user started speaking too soon after AI started
      const timeDiffMs = user.timestamp.getTime() - previousAI.timestamp.getTime();
      if (timeDiffMs < expectedSpeakingTimeMs - interruptionThresholdMs) {
        interruptionCount++;
        continue;
      }
    }
    
    // Check for interruption phrases
    const interruptionPhrases = [
      "excuse me", "hold on", "wait", "let me stop you", "can I", 
      "I need to", "actually", "sorry to interrupt"
    ];
    
    // If user message starts with an interruption phrase
    const userLower = user.content.toLowerCase().trim();
    if (interruptionPhrases.some(phrase => userLower.startsWith(phrase))) {
      interruptionCount++;
      continue;
    }
    
    // If AI response acknowledges interruption
    const aiLower = currentAI.content.toLowerCase();
    if (
      aiLower.includes("sorry for interrupting") ||
      aiLower.includes("let me continue") ||
      aiLower.includes("as I was saying") ||
      aiLower.includes("to finish my thought")
    ) {
      interruptionCount++;
    }
  }
  
  return interruptionCount;
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

function extractEmotionalTones(conversationLog: Array<{role: string, content: string, emotion?: string}>): string[] {
  // Extract emotional tones from conversation log
  if (conversationLog.length === 0) return [];
  
  // Collect emotions from explicitly tagged entries
  const explicitEmotions = conversationLog
    .filter(entry => entry.emotion)
    .map(entry => entry.emotion as string);
  
  if (explicitEmotions.length > 0) {
    // Return unique emotions
    return [...new Set(explicitEmotions)];
  }
  
  // Fall back to basic sentiment analysis if no explicit emotions
  const emotionalKeywords = {
    'positive': ['great', 'excellent', 'wonderful', 'amazing', 'fantastic', 'love', 'like', 'good', 'yes', 'interested'],
    'negative': ['bad', 'terrible', 'awful', 'hate', 'dislike', 'no', 'not interested', 'angry', 'frustrated'],
    'neutral': ['okay', 'maybe', 'think', 'consider', 'unsure'],
    'excited': ['excited', 'eager', 'can\'t wait', 'looking forward'],
    'concerned': ['worried', 'concerned', 'nervous', 'hesitant', 'unsure'],
    'confused': ['confused', 'don\'t understand', 'unclear', 'what do you mean']
  };
  
  const detectedEmotions = new Set<string>();
  
  conversationLog
    .filter(entry => entry.role === 'user')
    .forEach(entry => {
      const content = entry.content.toLowerCase();
      
      for (const [emotion, keywords] of Object.entries(emotionalKeywords)) {
        if (keywords.some(keyword => content.includes(keyword))) {
          detectedEmotions.add(emotion);
        }
      }
    });
  
  // Return detected emotions or default to neutral
  const result = Array.from(detectedEmotions);
  return result.length > 0 ? result : ['neutral'];
}

async function detectIntent(conversationLog: Array<{role: string, content: string, intent?: string}>): Promise<{
  primaryIntent: string;
  confidence: number;
  secondaryIntents: Array<{intent: string, confidence: number}>;
}> {
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
  
  // No explicit intents available, use voiceAIService for detection
  try {
    const { voiceAIService } = require('../services');
    const userTexts = userEntries.map(entry => entry.content).join(' ');
    
    const result = await voiceAIService.detectIntent(userTexts);
    return {
      primaryIntent: result.primaryIntent || 'general_conversation',
      confidence: result.confidence || 0.5,
      secondaryIntents: result.secondaryIntents || []
    };
  } catch (error) {
    // If import fails, return default intent
    return {
      primaryIntent: 'general_conversation',
      confidence: 0.5,
      secondaryIntents: []
    };
  }
}

async function analyzeTranscription(conversationLog: Array<{role: string, content: string}>): Promise<{
  keyPhrases: string[];
  sentimentBySegment: Array<{segment: string, sentiment: number}>;
  followUpRecommendations: string[];
}> {
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
  
  try {
    // Use LLM service for real sentiment analysis
    const { llmService } = require('../services');
    
    const result = await llmService.analyzeConversation({
      messages: userMessages,
      analyzeFor: ['sentiment', 'keyPhrases', 'followUpRecommendations']
    });
    
    return {
      keyPhrases: result.keyPhrases || [],
      sentimentBySegment: result.sentimentBySegment || [],
      followUpRecommendations: result.followUpRecommendations || []
    };
  } catch (error) {
    // Fall back to default response if LLM service fails
    return {
      keyPhrases: ['Error processing conversation'],
      sentimentBySegment: userMessages.map(msg => ({ segment: msg.substring(0, 50), sentiment: 0 })),
      followUpRecommendations: ['Follow up with standard process']
    };
  }
}

// Helper function to handle chunked audio text in TwiML
function handleChunkedAudioForTwiML(twiml: any, audioText: string, language: string = 'en') {
  try {
    // Check if this is a chunked audio request
    if (audioText && audioText.startsWith('USE_CHUNKED_AUDIO:')) {
      // Extract the full text from the marker
      const fullText = audioText.substring('USE_CHUNKED_AUDIO:'.length);
      
      // Check for special error markers
      const hasCloudinaryError = fullText.startsWith('[CLOUDINARY_ERROR]');
      if (hasCloudinaryError) {
        logger.warn('Detected Cloudinary error in chunked audio, using extra-small chunks');
        // Remove the error marker from the text
        const cleanText = fullText.substring('[CLOUDINARY_ERROR]'.length).trim();
        
        // Use smaller chunks for Cloudinary errors
        const chunks = splitTextIntoChunks(cleanText, 150); // Use very small chunks
        logger.info(`Split text into ${chunks.length} small chunks (150 chars max) due to Cloudinary error`);
        
        // Add each chunk as a separate say command
        for (const chunk of chunks) {
          if (chunk.trim()) { // Only add non-empty chunks
            twiml.say({ 
              voice: 'alice', 
              language: language === 'hi' ? 'hi-IN' : 'en-US' 
            }, chunk);
          }
        }
        return true;
      }
      
      // Regular chunking for non-error cases
      const chunks = splitTextIntoChunks(fullText);
      logger.info(`Split text into ${chunks.length} chunks for TTS to avoid TwiML size limits`);
      
      // Add each chunk as a separate say command
      for (const chunk of chunks) {
        if (chunk.trim()) { // Only add non-empty chunks
          twiml.say({ 
            voice: 'alice', 
            language: language === 'hi' ? 'hi-IN' : 'en-US' 
          }, chunk);
        }
      }
      return true; // Indicates we handled the chunked audio
    }
    return false; // Not a chunked audio request
  } catch (error) {
    // Super-robust error handling - never fail, just use basic TTS
    logger.error(`Error in handleChunkedAudioForTwiML: ${error.message}`);
    
    // NO HARDCODED FALLBACK MESSAGES - throw error to force proper configuration
    throw new Error(`Chunked audio processing failed: ${error.message}. Please ensure your system configuration handles large audio content properly.`);
  }
}

/**
 * Split a large text into smaller chunks to avoid TwiML size limits
 * This tries to split on sentence boundaries to maintain natural speech
 * @param text Full text to split
 * @param maxChunkLength Maximum length of each chunk (default: 250 characters)
 * @returns Array of text chunks
 */
function splitTextIntoChunks(text: string, maxChunkLength: number = 250): string[] {
  if (!text) return [];
  
  // If text is already small enough, return it as a single chunk
  if (text.length <= maxChunkLength) {
    return [text];
  }

  const chunks: string[] = [];
  let currentPosition = 0;

  while (currentPosition < text.length) {
    // Determine end of current chunk (max length or earlier)
    let chunkEnd = Math.min(currentPosition + maxChunkLength, text.length);
    
    // Try to find a sentence end (., !, ?) followed by a space or end of text
    if (chunkEnd < text.length) {
      // Search backward from max chunk length for a good break point
      const sentenceEndMatch = text.substring(currentPosition, chunkEnd).match(/[.!?]\s+(?=[A-Z])/g);
      
      if (sentenceEndMatch && sentenceEndMatch.length > 0) {
        // Find the last sentence end within this chunk
        const lastIndex = text.substring(currentPosition, chunkEnd).lastIndexOf(sentenceEndMatch[sentenceEndMatch.length - 1]);
        if (lastIndex > 0) {
          // +2 to include the period and space
          chunkEnd = currentPosition + lastIndex + 2;
        }
      } else {
        // No sentence end found, try to break at a comma or space
        const commaIndex = text.substring(currentPosition, chunkEnd).lastIndexOf(', ');
        if (commaIndex > 0) {
          chunkEnd = currentPosition + commaIndex + 2; // Include the comma and space
        } else {
          // Last resort: break at the last space
          const spaceIndex = text.substring(currentPosition, chunkEnd).lastIndexOf(' ');
          if (spaceIndex > 0) {
            chunkEnd = currentPosition + spaceIndex + 1; // Include the space
          }
          // If no space found, we'll just break at maxChunkLength
        }
      }
    }
    
    // Add the chunk to our results
    chunks.push(text.substring(currentPosition, chunkEnd).trim());
    
    // Move to next position
    currentPosition = chunkEnd;
  }
  
  return chunks;
}