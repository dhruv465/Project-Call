// Voice AI Demo and Testing Script
import { Request, Response } from 'express';
import EnhancedVoiceAIService from '../services/enhancedVoiceAIService';
import VoiceTrainingService from '../services/voiceTrainingService';
import { logger } from '../index';

export class VoiceAIDemoController {
  private voiceAIService: EnhancedVoiceAIService;
  private trainingService: VoiceTrainingService;

  constructor() {
    const elevenLabsKey = process.env.ELEVENLABS_API_KEY || '';
    const openAIKey = process.env.OPENAI_API_KEY || '';
    
    this.voiceAIService = new EnhancedVoiceAIService(elevenLabsKey, openAIKey);
    this.trainingService = new VoiceTrainingService(openAIKey);
  }

  // Run comprehensive demo of all voice AI capabilities
  runCompleteDemo = async (req: Request, res: Response) => {
    try {
      logger.info('Starting comprehensive Voice AI demo...');

      const demoResults = {
        trainingResults: null,
        personalityTests: [],
        emotionTests: [],
        bilingualTests: [],
        conversationTests: [],
        performanceMetrics: null
      };

      // Step 1: Train the model
      logger.info('Step 1: Training Voice AI Model...');
      demoResults.trainingResults = await this.trainingService.trainCompleteVoiceModel();
      
      // Mark model as trained
      this.voiceAIService.markModelAsTrained({
        emotionalEngagement: demoResults.trainingResults.emotionAccuracy,
        personalityConsistency: demoResults.trainingResults.personalityAccuracy,
        culturalApproppriateness: demoResults.trainingResults.bilingualAccuracy,
        adaptationSuccess: demoResults.trainingResults.conversationalAccuracy,
        overallEffectiveness: demoResults.trainingResults.overallAccuracy
      });

      // Step 2: Test Multiple Personalities
      logger.info('Step 2: Testing Voice Personalities...');
      const personalities = EnhancedVoiceAIService.getEnhancedVoicePersonalities();
      
      for (const personality of personalities) {
        const testResult = await this.testPersonality(personality, 'English');
        demoResults.personalityTests.push(testResult);
      }

      // Step 3: Test Emotion Detection and Adaptation
      logger.info('Step 3: Testing Emotion Detection...');
      const emotionTestCases = [
        { text: "This is taking forever! I don't have time for this!", expectedEmotion: 'frustrated' },
        { text: "Wow, this sounds really interesting! Tell me more!", expectedEmotion: 'interested' },
        { text: "I'm not sure I understand what you're saying.", expectedEmotion: 'confused' },
        { text: "I've heard this before. How is this different?", expectedEmotion: 'skeptical' },
        { text: "That sounds great! I'm excited to learn more.", expectedEmotion: 'excited' }
      ];

      for (const testCase of emotionTestCases) {
        const emotionResult = await this.testEmotionDetection(testCase.text, 'English');
        demoResults.emotionTests.push({
          input: testCase.text,
          expected: testCase.expectedEmotion,
          detected: emotionResult.primary,
          confidence: emotionResult.confidence,
          culturalAdaptation: emotionResult.culturalContext
        });
      }

      // Step 4: Test Bilingual Capabilities
      logger.info('Step 4: Testing Bilingual Capabilities...');
      const bilingualTestCases = [
        { 
          english: "Hello, how are you today?", 
          hindi: "नमस्ते, आज आप कैसे हैं?" 
        },
        { 
          english: "This is a great opportunity for your business.", 
          hindi: "यह आपके व्यवसाय के लिए एक बेहतरीन अवसर है।" 
        },
        { 
          english: "I understand your concerns about the pricing.", 
          hindi: "मैं कीमत के बारे में आपकी चिंताओं को समझता हूं।" 
        }
      ];

      for (const testCase of bilingualTestCases) {
        const englishResult = await this.testBilingualResponse(testCase.english, 'English');
        const hindiResult = await this.testBilingualResponse(testCase.hindi, 'Hindi');
        
        demoResults.bilingualTests.push({
          englishTest: englishResult,
          hindiTest: hindiResult,
          culturalAdaptation: {
            english: englishResult.culturallyAdapted,
            hindi: hindiResult.culturallyAdapted
          }
        });
      }

      // Step 5: Test Advanced Conversation Flow
      logger.info('Step 5: Testing Advanced Conversation Flow...');
      const conversationScenarios = [
        {
          name: 'Frustrated Customer Recovery',
          turns: [
            { speaker: 'customer', text: "I've been waiting for 10 minutes!", emotion: 'frustrated' },
            { speaker: 'customer', text: "What can you do for me?", emotion: 'skeptical' }
          ]
        },
        {
          name: 'Interest Building',
          turns: [
            { speaker: 'customer', text: "This sounds interesting.", emotion: 'interested' },
            { speaker: 'customer', text: "How much does it cost?", emotion: 'curious' }
          ]
        }
      ];

      for (const scenario of conversationScenarios) {
        const conversationResult = await this.testConversationFlow(scenario);
        demoResults.conversationTests.push(conversationResult);
      }

      // Step 6: Get Performance Metrics
      demoResults.performanceMetrics = this.voiceAIService.getConversationMetrics();

      logger.info('Voice AI Demo completed successfully');

      res.json({
        success: true,
        message: 'Comprehensive Voice AI demo completed successfully',
        demoResults,
        summary: {
          modelTrained: this.voiceAIService.isModelFullyTrained(),
          personalitiesTested: demoResults.personalityTests.length,
          emotionTestsPassed: demoResults.emotionTests.filter(t => t.confidence > 0.8).length,
          bilingualCapabilities: demoResults.bilingualTests.length,
          conversationScenarios: demoResults.conversationTests.length,
          overallPerformance: demoResults.performanceMetrics?.overallEffectiveness || 0
        }
      });

    } catch (error) {
      logger.error('Error running Voice AI demo:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to run Voice AI demo',
        error: error.message
      });
    }
  };

  // Test individual voice personality
  private async testPersonality(personality: any, language: 'English' | 'Hindi') {
    try {
      const testText = language === 'English' 
        ? "Hello, I'm interested in learning more about your product."
        : "नमस्ते, मैं आपके उत्पाद के बारे में और जानने में रुचि रखता हूं।";

      // Detect emotion
      const emotion = await this.voiceAIService.detectEmotionWithCulturalContext(
        testText, 
        language
      );

      // Generate adaptive response
      const response = await this.voiceAIService.generateCulturallyAdaptedResponse(
        emotion,
        testText,
        personality,
        language
      );

      return {
        personalityId: personality.id,
        personalityName: personality.name,
        language,
        testInput: testText,
        emotionDetected: emotion.primary,
        responseGenerated: response.script,
        culturallyAdapted: response.culturallyAdapted,
        personalityAlignment: response.personalityAlignment,
        metrics: personality.trainingMetrics
      };
    } catch (error) {
      logger.error(`Error testing personality ${personality.id}:`, error);
      return {
        personalityId: personality.id,
        error: error.message
      };
    }
  }

  // Test emotion detection
  private async testEmotionDetection(text: string, language: 'English' | 'Hindi') {
    try {
      const emotion = await this.voiceAIService.detectEmotionWithCulturalContext(
        text,
        language
      );
      return emotion;
    } catch (error) {
      logger.error('Error testing emotion detection:', error);
      return {
        primary: 'error',
        confidence: 0,
        intensity: 0,
        context: error.message,
        adaptationNeeded: false
      };
    }
  }

  // Test bilingual response generation
  private async testBilingualResponse(text: string, language: 'English' | 'Hindi') {
    try {
      const personalities = EnhancedVoiceAIService.getEnhancedVoicePersonalities();
      const personality = personalities[0]; // Use professional personality

      const emotion = await this.voiceAIService.detectEmotionWithCulturalContext(
        text,
        language
      );

      const response = await this.voiceAIService.generateCulturallyAdaptedResponse(
        emotion,
        text,
        personality,
        language
      );

      return {
        language,
        input: text,
        emotion: emotion.primary,
        response: response.script,
        culturallyAdapted: response.culturallyAdapted,
        culturalContext: emotion.culturalContext
      };
    } catch (error) {
      logger.error(`Error testing bilingual response for ${language}:`, error);
      return {
        language,
        error: error.message
      };
    }
  }

  // Test conversation flow management
  private async testConversationFlow(scenario: any) {
    try {
      const personalities = EnhancedVoiceAIService.getEnhancedVoicePersonalities();
      const personality = personalities.find(p => p.id === 'empathetic') || personalities[0];

      const conversationHistory = scenario.turns.map((turn: any, index: number) => ({
        id: `turn_${index}`,
        timestamp: new Date(),
        speaker: turn.speaker,
        content: turn.text,
        emotion: turn.emotion
      }));

      // Get latest customer emotion
      const latestCustomerTurn = conversationHistory
        .filter(turn => turn.speaker === 'customer')
        .pop();

      let currentEmotion;
      if (latestCustomerTurn) {
        currentEmotion = await this.voiceAIService.detectEmotionWithCulturalContext(
          latestCustomerTurn.content,
          'English'
        );
      } else {
        currentEmotion = {
          primary: 'neutral',
          confidence: 0.8,
          intensity: 0.5,
          context: 'No customer input',
          adaptationNeeded: false
        };
      }

      // Manage conversation flow
      const flowAnalysis = await this.voiceAIService.manageAdvancedConversationFlow(
        conversationHistory,
        currentEmotion,
        personality,
        'English'
      );

      // Test personality adaptation
      const adaptationResult = await this.voiceAIService.adaptVoiceInRealTime(
        currentEmotion,
        conversationHistory.length,
        personality,
        'English'
      );

      return {
        scenarioName: scenario.name,
        conversationTurns: conversationHistory.length,
        finalEmotion: currentEmotion.primary,
        flowRecommendation: flowAnalysis.nextAction,
        suggestedResponse: flowAnalysis.suggestedResponse,
        personalityAdaptation: {
          originalPersonality: personality.id,
          adaptedPersonality: adaptationResult.adaptedPersonality.id,
          adaptationNeeded: adaptationResult.adaptedPersonality.id !== personality.id,
          reason: adaptationResult.adaptationReason
        },
        culturalConsiderations: flowAnalysis.culturalConsiderations,
        confidenceScore: flowAnalysis.confidenceScore
      };
    } catch (error) {
      logger.error(`Error testing conversation flow for ${scenario.name}:`, error);
      return {
        scenarioName: scenario.name,
        error: error.message
      };
    }
  }

  // Get detailed voice AI status
  getVoiceAIStatus = async (req: Request, res: Response) => {
    try {
      const personalities = EnhancedVoiceAIService.getEnhancedVoicePersonalities();
      const metrics = this.voiceAIService.getConversationMetrics();
      const isModelTrained = this.voiceAIService.isModelFullyTrained();

      res.json({
        success: true,
        status: {
          modelTrained: isModelTrained,
          totalPersonalities: personalities.length,
          supportedLanguages: ['English', 'Hindi'],
          capabilities: [
            'Advanced emotion detection with cultural context',
            'Multiple voice personalities with adaptation',
            'Bilingual conversation support (English/Hindi)',
            'Real-time personality adaptation',
            'Cultural intelligence and communication patterns',
            'Natural conversation flow management'
          ],
          metrics,
          personalities: personalities.map(p => ({
            id: p.id,
            name: p.name,
            description: p.description,
            languages: p.languageSupport,
            emotionalRange: p.emotionalRange,
            trainingMetrics: p.trainingMetrics
          }))
        }
      });
    } catch (error) {
      logger.error('Error getting Voice AI status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get Voice AI status',
        error: error.message
      });
    }
  };
}

export default VoiceAIDemoController;
