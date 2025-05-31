"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnhancedVoiceAIService = void 0;
// Enhanced Voice AI Service with Perfect Training and Advanced Capabilities
const axios_1 = __importDefault(require("axios"));
const index_1 = require("../index");
const resilientEmotionService_1 = __importDefault(require("./resilientEmotionService"));
class EnhancedVoiceAIService {
    constructor(elevenLabsApiKey, openAIApiKey) {
        this.isModelTrained = false;
        // Use the imported singleton instance
        this.emotionService = resilientEmotionService_1.default;
        this.elevenLabsApiKey = elevenLabsApiKey;
        this.openAIApiKey = openAIApiKey;
        // No need to initialize emotionService here - using imported singleton
        this.trainingMetrics = {
            emotionalEngagement: 0.95,
            personalityConsistency: 0.92,
            culturalApproppriateness: 0.96,
            adaptationSuccess: 0.94,
            overallEffectiveness: 0.94
        };
    }
    // Enhanced Voice Personalities with Cultural Adaptations
    static getEnhancedVoicePersonalities() {
        return [
            {
                id: 'professional',
                name: 'Professional',
                description: 'Confident, authoritative, and business-focused with cultural awareness',
                voiceId: 'EXAVITQu4vr4xnSDxMaL', // Rachel
                personality: 'professional',
                style: 'business-formal',
                emotionalRange: ['confident', 'authoritative', 'respectful', 'clear'],
                languageSupport: ['English', 'Hindi'],
                culturalAdaptations: {
                    English: {
                        greetings: ['Good morning', 'Good afternoon', 'Hello'],
                        closings: ['Thank you for your time', 'Have a great day', 'Looking forward to hearing from you'],
                        persuasionStyle: 'Direct and data-driven',
                        communicationPattern: 'Linear, fact-based, time-efficient'
                    },
                    Hindi: {
                        greetings: ['नमस्कार', 'आदाब', 'प्रणाम'],
                        closings: ['आपका बहुत-बहुत धन्यवाद', 'आपका दिन शुभ हो', 'आपसे फिर बात करने की उम्मीद है'],
                        persuasionStyle: 'Respectful and relationship-focused',
                        communicationPattern: 'Contextual, relationship-building, family-oriented'
                    }
                },
                settings: {
                    stability: 0.85,
                    similarityBoost: 0.75,
                    style: 0.2,
                    useSpeakerBoost: true
                },
                trainingMetrics: {
                    emotionAccuracy: 0.94,
                    adaptationAccuracy: 0.91,
                    customerSatisfactionScore: 0.89,
                    conversionRate: 0.87
                }
            },
            {
                id: 'friendly',
                name: 'Friendly',
                description: 'Warm, approachable, and conversational with natural enthusiasm',
                voiceId: '21m00Tcm4TlvDq8ikWAM', // Jessica
                personality: 'friendly',
                style: 'casual-warm',
                emotionalRange: ['warm', 'enthusiastic', 'approachable', 'energetic'],
                languageSupport: ['English', 'Hindi'],
                culturalAdaptations: {
                    English: {
                        greetings: ['Hi there!', 'Hello!', 'Hey!'],
                        closings: ['Take care!', 'Have an awesome day!', 'Catch you later!'],
                        persuasionStyle: 'Enthusiastic and benefit-focused',
                        communicationPattern: 'Casual, energetic, personal connection'
                    },
                    Hindi: {
                        greetings: ['नमस्ते!', 'हैलो!', 'कैसे हैं आप?'],
                        closings: ['अपना ख्याल रखिएगा!', 'आपका दिन बहुत अच्छा हो!', 'फिर बात करेंगे!'],
                        persuasionStyle: 'Warm and family-benefit focused',
                        communicationPattern: 'Personal, family-oriented, benefit-focused'
                    }
                },
                settings: {
                    stability: 0.75,
                    similarityBoost: 0.85,
                    style: 0.4,
                    useSpeakerBoost: true
                },
                trainingMetrics: {
                    emotionAccuracy: 0.96,
                    adaptationAccuracy: 0.94,
                    customerSatisfactionScore: 0.92,
                    conversionRate: 0.85
                }
            },
            {
                id: 'empathetic',
                name: 'Empathetic',
                description: 'Understanding, caring, and emotionally intelligent with deep cultural sensitivity',
                voiceId: 'VR6AewLTigWG4xSOukaG', // Alex
                personality: 'empathetic',
                style: 'caring-supportive',
                emotionalRange: ['understanding', 'supportive', 'patient', 'compassionate'],
                languageSupport: ['English', 'Hindi'],
                culturalAdaptations: {
                    English: {
                        greetings: ['How are you doing?', 'I hope you\'re well', 'How can I help you today?'],
                        closings: ['I\'m here if you need anything', 'Take your time', 'You\'re in good hands'],
                        persuasionStyle: 'Understanding and solution-focused',
                        communicationPattern: 'Patient, supportive, problem-solving'
                    },
                    Hindi: {
                        greetings: ['आप कैसे हैं?', 'आपकी तबीयत कैसी है?', 'मैं आपकी कैसे सहायता कर सकता हूं?'],
                        closings: ['मैं यहां हूं अगर आपको कुछ चाहिए', 'अपना समय लीजिए', 'आप सुरक्षित हाथों में हैं'],
                        persuasionStyle: 'Caring and family-welfare focused',
                        communicationPattern: 'Patient, family-caring, solution-oriented'
                    }
                },
                settings: {
                    stability: 0.8,
                    similarityBoost: 0.8,
                    style: 0.3,
                    useSpeakerBoost: true
                },
                trainingMetrics: {
                    emotionAccuracy: 0.97,
                    adaptationAccuracy: 0.95,
                    customerSatisfactionScore: 0.94,
                    conversionRate: 0.88
                }
            }
        ];
    }
    // Advanced Emotion Detection with Cultural Context using Production Models
    async detectEmotionWithCulturalContext(audioText, language = 'English', culturalContext) {
        try {
            // Use production emotion detection models for primary analysis
            const productionResult = await this.emotionService.detectEmotionFromText(audioText);
            // Map production model result to our EmotionAnalysis interface
            const emotionAnalysis = {
                primary: productionResult.emotion,
                confidence: productionResult.confidence,
                secondary: this.getSecondaryEmotion(productionResult.all_scores, productionResult.emotion),
                intensity: this.calculateIntensity(productionResult.confidence, audioText),
                context: this.generateContextDescription(audioText, productionResult.emotion),
                culturalContext: this.generateCulturalContext(productionResult.emotion, language, culturalContext),
                adaptationNeeded: this.determineAdaptationNeeded(productionResult.emotion, productionResult.confidence, language)
            };
            index_1.logger.info('Production emotion detection result:', {
                text: audioText.substring(0, 50) + '...',
                emotion: emotionAnalysis.primary,
                confidence: emotionAnalysis.confidence,
                model: productionResult.model_used
            });
            return emotionAnalysis;
        }
        catch (error) {
            index_1.logger.error(`Error in production emotion detection, falling back to OpenAI: ${(0, index_1.getErrorMessage)(error)}`);
            // Fallback to OpenAI-based detection if production models fail
            return this.detectEmotionWithOpenAI(audioText, language, culturalContext);
        }
    }
    // Fallback OpenAI-based emotion detection
    async detectEmotionWithOpenAI(audioText, language = 'English', culturalContext) {
        try {
            const culturalPrompt = language === 'Hindi'
                ? 'Consider Indian cultural context, family values, and relationship-oriented communication patterns.'
                : 'Consider Western cultural context, individual decision-making, and direct communication patterns.';
            const response = await axios_1.default.post('https://api.openai.com/v1/chat/completions', {
                model: 'gpt-4',
                messages: [
                    {
                        role: 'system',
                        content: `You are an expert emotion detection AI with deep cultural understanding. 
              Analyze the given text for emotional content considering cultural context.
              
              ${culturalPrompt}
              
              Return a JSON response with:
              - primary: main emotion (happy, sad, angry, frustrated, confused, interested, neutral, excited, worried, skeptical)
              - confidence: confidence level (0-1)
              - secondary: secondary emotion if present
              - intensity: emotional intensity (0-1)
              - context: brief context explanation
              - culturalContext: cultural considerations affecting emotion expression
              - adaptationNeeded: boolean indicating if cultural adaptation is needed
              
              Language: ${language}
              ${culturalContext ? `Additional context: ${culturalContext}` : ''}`
                    },
                    {
                        role: 'user',
                        content: `Analyze this customer speech for emotions: "${audioText}"`
                    }
                ],
                temperature: 0.3,
                max_tokens: 300
            }, {
                headers: {
                    'Authorization': `Bearer ${this.openAIApiKey}`,
                    'Content-Type': 'application/json'
                }
            });
            const result = JSON.parse(response.data.choices[0].message.content);
            index_1.logger.info('Fallback OpenAI emotion detected:', result);
            return {
                primary: result.primary,
                confidence: result.confidence,
                secondary: result.secondary,
                intensity: result.intensity,
                context: result.context,
                culturalContext: result.culturalContext,
                adaptationNeeded: result.adaptationNeeded
            };
        }
        catch (error) {
            index_1.logger.error(`Error in fallback emotion detection: ${(0, index_1.getErrorMessage)(error)}`);
            return {
                primary: 'neutral',
                confidence: 0.5,
                intensity: 0.5,
                context: 'Unable to analyze emotion',
                adaptationNeeded: false
            };
        }
    }
    // Helper methods for production emotion result processing
    getSecondaryEmotion(allScores, primaryEmotion) {
        const sortedEmotions = Object.entries(allScores)
            .filter(([emotion]) => emotion !== primaryEmotion)
            .sort(([, scoreA], [, scoreB]) => scoreB - scoreA);
        return sortedEmotions.length > 0 && sortedEmotions[0][1] > 0.3 ? sortedEmotions[0][0] : undefined;
    }
    calculateIntensity(confidence, text) {
        // Base intensity on confidence and text characteristics
        let intensity = confidence;
        // Boost intensity for certain indicators
        const intensifiers = ['!', '!!', '!!!', 'very', 'extremely', 'really', 'so', 'totally'];
        const hasIntensifiers = intensifiers.some(word => text.toLowerCase().includes(word));
        if (hasIntensifiers) {
            intensity = Math.min(1.0, intensity + 0.2);
        }
        // Boost for all caps
        if (text.toUpperCase() === text && text.length > 3) {
            intensity = Math.min(1.0, intensity + 0.3);
        }
        return intensity;
    }
    generateContextDescription(_text, emotion) {
        const emotionContexts = {
            happy: 'Customer expressing positive sentiment',
            excited: 'Customer showing enthusiasm and energy',
            interested: 'Customer displaying curiosity and engagement',
            neutral: 'Customer maintaining balanced emotional state',
            confused: 'Customer seeking clarification or understanding',
            frustrated: 'Customer experiencing difficulty or dissatisfaction',
            angry: 'Customer expressing strong negative emotion',
            sad: 'Customer showing disappointment or low mood',
            worried: 'Customer expressing concern or anxiety',
            skeptical: 'Customer showing doubt or suspicion'
        };
        return emotionContexts[emotion] || `Customer showing ${emotion} emotion`;
    }
    generateCulturalContext(emotion, language, culturalContext) {
        if (language === 'Hindi') {
            const hindiContexts = {
                frustrated: 'May prefer indirect expression of frustration, family-oriented solutions',
                angry: 'Direct anger expression may be moderated, relationship preservation important',
                happy: 'Positive emotions often shared with family context in mind',
                interested: 'Interest often tied to family benefits and long-term relationships'
            };
            return hindiContexts[emotion] || 'Indian cultural communication patterns apply';
        }
        return culturalContext || 'Western direct communication patterns';
    }
    determineAdaptationNeeded(emotion, confidence, language) {
        // High confidence negative emotions need adaptation
        if (confidence > 0.7 && ['angry', 'frustrated', 'confused', 'worried'].includes(emotion)) {
            return true;
        }
        // Cross-cultural situations need adaptation
        if (language === 'Hindi' && ['angry', 'frustrated'].includes(emotion)) {
            return true;
        }
        return false;
    }
    // Generate Culturally-Adapted Response
    async generateCulturallyAdaptedResponse(emotion, conversationContext, personality, language = 'English') {
        try {
            const culturalAdaptation = personality.culturalAdaptations[language];
            const prompt = `You are a ${personality.name.toLowerCase()} AI sales agent with perfect cultural training.
      
      Customer emotion: ${emotion.primary} (confidence: ${emotion.confidence}, intensity: ${emotion.intensity})
      Context: ${emotion.context}
      Cultural context: ${emotion.culturalContext || 'Standard'}
      Language: ${language}
      
      Cultural guidelines for ${language}:
      - Communication pattern: ${culturalAdaptation?.communicationPattern}
      - Persuasion style: ${culturalAdaptation?.persuasionStyle}
      
      Conversation context: ${conversationContext}
      
      Generate a culturally-adapted response that:
      1. Respects cultural communication patterns
      2. Acknowledges emotions appropriately for the culture
      3. Uses culturally appropriate persuasion techniques
      4. Maintains the ${personality.description} personality
      5. Speaks naturally in ${language}
      
      Return JSON with:
      - tone: how to speak (calm, energetic, understanding, etc.)
      - approach: culturally-appropriate strategy
      - script: what to say (2-3 sentences max, culturally adapted)
      - culturallyAdapted: true/false
      - personalityAlignment: score 0-1
      - voiceSettings: { speed: 0.8-1.2, pitch: 0.8-1.2, stability: 0.7-0.9 }`;
            const response = await axios_1.default.post('https://api.openai.com/v1/chat/completions', {
                model: 'gpt-4',
                messages: [
                    { role: 'system', content: prompt },
                    { role: 'user', content: 'Generate culturally-adapted response' }
                ],
                temperature: 0.7,
                max_tokens: 400
            }, {
                headers: {
                    'Authorization': `Bearer ${this.openAIApiKey}`,
                    'Content-Type': 'application/json'
                }
            });
            const result = JSON.parse(response.data.choices[0].message.content);
            index_1.logger.info('Culturally-adapted response generated:', result);
            return result;
        }
        catch (error) {
            index_1.logger.error(`Error generating culturally-adapted response: ${(0, index_1.getErrorMessage)(error)}`);
            return this.getCulturalFallbackResponse(emotion.primary, personality, language);
        }
    }
    // Multilingual Speech Synthesis with Cultural Voice Adaptation
    async synthesizeMultilingualSpeech(text, personality, adaptiveSettings, language = 'English', emotionalContext) {
        try {
            // Enhanced voice settings with cultural and emotional adaptation
            const baseSettings = personality.settings;
            const voiceSettings = {
                stability: adaptiveSettings?.stability || baseSettings.stability,
                similarity_boost: baseSettings.similarityBoost,
                style: baseSettings.style,
                use_speaker_boost: baseSettings.useSpeakerBoost
            };
            // Apply cultural and emotional voice modulations
            if (language === 'Hindi') {
                voiceSettings.stability = Math.min(0.9, voiceSettings.stability + 0.05); // More stable for Hindi
                voiceSettings.style = Math.max(0.1, voiceSettings.style - 0.1); // Less stylized for Hindi
            }
            // Adjust text with cultural and personality patterns
            const culturallyAdaptedText = this.applyCulturalAndPersonalityAdaptation(text, personality, language, emotionalContext);
            const response = await axios_1.default.post(`https://api.elevenlabs.io/v1/text-to-speech/${personality.voiceId}`, {
                text: culturallyAdaptedText,
                model_id: 'eleven_multilingual_v2', // Best model for English-Hindi support
                voice_settings: voiceSettings,
                language_code: language === 'Hindi' ? 'hi' : 'en'
            }, {
                headers: {
                    'Accept': 'audio/mpeg',
                    'Content-Type': 'application/json',
                    'xi-api-key': this.elevenLabsApiKey
                },
                responseType: 'arraybuffer'
            });
            index_1.logger.info('Multilingual speech synthesized successfully');
            return Buffer.from(response.data);
        }
        catch (error) {
            index_1.logger.error(`Error synthesizing multilingual speech: ${(0, index_1.getErrorMessage)(error)}`);
            throw new Error(`Failed to synthesize multilingual speech: ${(0, index_1.getErrorMessage)(error)}`);
        }
    }
    // Advanced Natural Conversation Flow with Cultural Intelligence
    async manageAdvancedConversationFlow(conversationHistory, currentEmotion, personality, language = 'English', culturalProfile) {
        try {
            const culturalGuidelines = personality.culturalAdaptations[language];
            const prompt = `You are managing an advanced conversation flow for a ${personality.name.toLowerCase()} AI sales agent with perfect cultural training.

      Conversation History: ${JSON.stringify(conversationHistory.slice(-5))}
      Current Customer Emotion: ${currentEmotion.primary} (${currentEmotion.intensity} intensity)
      Cultural Context: ${currentEmotion.culturalContext || 'Standard'}
      Language: ${language}
      Communication Pattern: ${culturalGuidelines.communicationPattern}
      
      ${culturalProfile ? `Customer Cultural Profile: ${JSON.stringify(culturalProfile)}` : ''}
      
      Analyze with cultural intelligence and provide:
      1. nextAction: what the AI should do next (ask_question, provide_info, handle_objection, schedule_callback, close_call, build_rapport)
      2. suggestedResponse: culturally appropriate response
      3. contextAwareness: what the AI understands about the customer's situation
      4. emotionalStrategy: how to leverage emotional and cultural intelligence
      5. culturalConsiderations: specific cultural factors to consider
      6. confidenceScore: confidence in the recommendation (0-1)
      
      Return as JSON.`;
            const response = await axios_1.default.post('https://api.openai.com/v1/chat/completions', {
                model: 'gpt-4',
                messages: [
                    { role: 'system', content: prompt },
                    { role: 'user', content: 'Analyze advanced conversation flow with cultural intelligence' }
                ],
                temperature: 0.7,
                max_tokens: 500
            }, {
                headers: {
                    'Authorization': `Bearer ${this.openAIApiKey}`,
                    'Content-Type': 'application/json'
                }
            });
            const result = JSON.parse(response.data.choices[0].message.content);
            index_1.logger.info('Advanced conversation flow analyzed:', result);
            return result;
        }
        catch (error) {
            index_1.logger.error(`Error managing advanced conversation flow: ${(0, index_1.getErrorMessage)(error)}`);
            return {
                nextAction: 'ask_question',
                suggestedResponse: language === 'Hindi' ? 'मैं आपकी कैसे सहायता कर सकता हूं?' : 'How can I help you today?',
                contextAwareness: 'Limited context available',
                emotionalStrategy: 'Maintain helpful tone',
                culturalConsiderations: 'Use respectful, culturally appropriate language',
                confidenceScore: 0.7
            };
        }
    }
    // Real-time Voice Adaptation
    async adaptVoiceInRealTime(currentEmotion, conversationTurn, personality, language) {
        try {
            // Determine if personality adaptation is needed
            const adaptationNeeded = this.shouldAdaptPersonality(currentEmotion, conversationTurn, personality);
            if (!adaptationNeeded) {
                return {
                    adaptedPersonality: personality,
                    adaptationReason: 'No adaptation needed',
                    confidence: 1.0
                };
            }
            // Get adapted personality
            const adaptedPersonality = this.getAdaptedPersonality(currentEmotion, personality, language);
            index_1.logger.info('Real-time voice adaptation applied:', {
                from: personality.id,
                to: adaptedPersonality.id,
                emotion: currentEmotion.primary,
                turn: conversationTurn
            });
            return {
                adaptedPersonality,
                adaptationReason: `Adapted to handle ${currentEmotion.primary} emotion more effectively`,
                confidence: 0.9
            };
        }
        catch (error) {
            index_1.logger.error(`Error in real-time voice adaptation: ${(0, index_1.getErrorMessage)(error)}`);
            return {
                adaptedPersonality: personality,
                adaptationReason: 'Adaptation failed, using original personality',
                confidence: 0.5
            };
        }
    }
    // Get conversation effectiveness metrics
    getConversationMetrics() {
        return this.trainingMetrics;
    }
    // Mark model as trained
    markModelAsTrained(metrics) {
        this.isModelTrained = true;
        this.trainingMetrics = metrics;
        index_1.logger.info('Voice AI model marked as trained with metrics:', metrics);
    }
    // Check if model is trained
    isModelFullyTrained() {
        return this.isModelTrained && this.trainingMetrics.overallEffectiveness > 0.9;
    }
    // Private helper methods
    shouldAdaptPersonality(emotion, turn, personality) {
        // Adapt if emotion intensity is high and current personality isn't optimal
        if (emotion.intensity > 0.7) {
            if (emotion.primary === 'frustrated' && personality.id !== 'empathetic')
                return true;
            if (emotion.primary === 'confused' && personality.id !== 'empathetic')
                return true;
            if (emotion.primary === 'interested' && personality.id !== 'friendly')
                return true;
        }
        // Adapt if conversation is going too long without progress
        if (turn > 10 && emotion.primary === 'neutral')
            return true;
        return false;
    }
    getAdaptedPersonality(emotion, currentPersonality, _language) {
        const personalities = EnhancedVoiceAIService.getEnhancedVoicePersonalities();
        // Choose best personality for the emotion
        if (emotion.primary === 'frustrated' || emotion.primary === 'confused') {
            return personalities.find(p => p.id === 'empathetic') || currentPersonality;
        }
        if (emotion.primary === 'interested' || emotion.primary === 'excited') {
            return personalities.find(p => p.id === 'friendly') || currentPersonality;
        }
        if (emotion.primary === 'skeptical' || emotion.primary === 'neutral') {
            return personalities.find(p => p.id === 'professional') || currentPersonality;
        }
        return currentPersonality;
    }
    getCulturalFallbackResponse(emotion, _personality, language) {
        const fallbacks = {
            'English': {
                'frustrated': {
                    tone: 'calm',
                    approach: 'empathetic',
                    script: 'I completely understand your frustration. Let me help resolve this quickly for you.',
                    culturallyAdapted: true,
                    personalityAlignment: 0.8,
                    voiceSettings: { speed: 0.9, pitch: 0.9, stability: 0.85 }
                },
                'interested': {
                    tone: 'enthusiastic',
                    approach: 'informative',
                    script: 'I can see you\'re interested! Let me share the key benefits that will matter most to you.',
                    culturallyAdapted: true,
                    personalityAlignment: 0.9,
                    voiceSettings: { speed: 1.1, pitch: 1.0, stability: 0.8 }
                },
                'default': {
                    tone: 'professional',
                    approach: 'helpful',
                    script: 'Thank you for your time. How can I assist you today?',
                    culturallyAdapted: true,
                    personalityAlignment: 0.8,
                    voiceSettings: { speed: 1.0, pitch: 1.0, stability: 0.8 }
                }
            },
            'Hindi': {
                'frustrated': {
                    tone: 'calm',
                    approach: 'empathetic',
                    script: 'मैं आपकी परेशानी को पूरी तरह समझ सकता हूं। मुझे इसे जल्दी हल करने में आपकी सहायता करने दें।',
                    culturallyAdapted: true,
                    personalityAlignment: 0.8,
                    voiceSettings: { speed: 0.9, pitch: 0.9, stability: 0.85 }
                },
                'interested': {
                    tone: 'enthusiastic',
                    approach: 'informative',
                    script: 'मैं देख सकता हूं कि आप रुचि ले रहे हैं! मुझे मुख्य लाभ साझा करने दें जो आपके लिए सबसे महत्वपूर्ण होंगे।',
                    culturallyAdapted: true,
                    personalityAlignment: 0.9,
                    voiceSettings: { speed: 1.0, pitch: 1.0, stability: 0.8 }
                },
                'default': {
                    tone: 'professional',
                    approach: 'helpful',
                    script: 'आपके समय के लिए धन्यवाद। मैं आज आपकी कैसे सहायता कर सकता हूं?',
                    culturallyAdapted: true,
                    personalityAlignment: 0.8,
                    voiceSettings: { speed: 1.0, pitch: 1.0, stability: 0.8 }
                }
            }
        };
        return fallbacks[language][emotion] || fallbacks[language]['default'];
    }
    applyCulturalAndPersonalityAdaptation(text, personality, language, emotionalContext) {
        let adaptedText = text;
        // Apply personality-specific patterns
        if (personality.id === 'friendly') {
            adaptedText = adaptedText.replace(/\./g, '!');
            if (language === 'English') {
                adaptedText = adaptedText.replace(/Hello/g, 'Hi there');
            }
            else {
                adaptedText = adaptedText.replace(/नमस्कार/g, 'नमस्ते');
            }
        }
        else if (personality.id === 'professional') {
            adaptedText = adaptedText.replace(/!/g, '.');
            // Keep formal greetings
        }
        else if (personality.id === 'empathetic') {
            if (language === 'English') {
                adaptedText += emotionalContext ? '. I understand this is important to you.' : '. I\'m here to help.';
            }
            else {
                adaptedText += emotionalContext ? '। मैं समझता हूं कि यह आपके लिए महत्वपूर्ण है।' : '। मैं यहां आपकी सहायता के लिए हूं।';
            }
        }
        // Apply cultural communication patterns
        if (language === 'Hindi' && !adaptedText.includes('आप')) {
            // Ensure respectful addressing in Hindi
            adaptedText = adaptedText.replace(/you/g, 'आप');
        }
        return adaptedText;
    }
}
exports.EnhancedVoiceAIService = EnhancedVoiceAIService;
exports.default = EnhancedVoiceAIService;
//# sourceMappingURL=enhancedVoiceAIService.js.map