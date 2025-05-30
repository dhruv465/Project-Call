"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoiceAIService = void 0;
const axios_1 = __importDefault(require("axios"));
const index_1 = require("../index");
class VoiceAIService {
    constructor(elevenLabsApiKey, openAIApiKey) {
        this.elevenLabsApiKey = elevenLabsApiKey;
        this.openAIApiKey = openAIApiKey;
    }
    // Voice Personalities - Professional, Friendly, Empathetic
    static getVoicePersonalities() {
        return [
            {
                id: 'professional',
                name: 'Professional',
                description: 'Confident, authoritative, and business-focused',
                voiceId: 'EXAVITQu4vr4xnSDxMaL', // Rachel
                personality: 'professional',
                style: 'business-formal',
                emotionalRange: ['confident', 'authoritative', 'respectful', 'clear'],
                languageSupport: ['English', 'Hindi'],
                culturalAdaptations: {
                    English: {
                        greetings: ['Good morning', 'Good afternoon', 'Hello'],
                        closings: ['Thank you for your time', 'Have a great day'],
                        persuasionStyle: 'Direct and data-driven',
                        communicationPattern: 'Linear, fact-based, time-efficient'
                    },
                    Hindi: {
                        greetings: ['नमस्कार', 'नमस्ते', 'आदाब'],
                        closings: ['धन्यवाद', 'आपका दिन शुभ हो'],
                        persuasionStyle: 'Respectful with family consideration',
                        communicationPattern: 'Relationship-first, then business'
                    }
                },
                settings: {
                    stability: 0.85,
                    similarityBoost: 0.75,
                    style: 0.2,
                    useSpeakerBoost: true
                },
                trainingMetrics: {
                    emotionAccuracy: 0.92,
                    adaptationAccuracy: 0.89,
                    customerSatisfactionScore: 0.87,
                    conversionRate: 0.76
                }
            },
            {
                id: 'friendly',
                name: 'Friendly',
                description: 'Warm, approachable, and conversational',
                voiceId: '21m00Tcm4TlvDq8ikWAM', // Jessica
                personality: 'friendly',
                style: 'casual-warm',
                emotionalRange: ['warm', 'enthusiastic', 'approachable', 'energetic'],
                languageSupport: ['English', 'Hindi'],
                culturalAdaptations: {
                    English: {
                        greetings: ['Hi there!', 'Hey!', 'Hello!', 'How are you?'],
                        closings: ['Take care!', 'Have an awesome day!', 'Talk soon!'],
                        persuasionStyle: 'Enthusiastic and relatable',
                        communicationPattern: 'Casual, conversational, story-driven'
                    },
                    Hindi: {
                        greetings: ['हैलो!', 'नमस्ते!', 'कैसे हैं आप?'],
                        closings: ['अपना ख्याल रखिए!', 'आपका दिन शानदार हो!'],
                        persuasionStyle: 'Warm and family-friendly approach',
                        communicationPattern: 'Personal stories, emotional connection'
                    }
                },
                settings: {
                    stability: 0.75,
                    similarityBoost: 0.85,
                    style: 0.4,
                    useSpeakerBoost: true
                },
                trainingMetrics: {
                    emotionAccuracy: 0.88,
                    adaptationAccuracy: 0.91,
                    customerSatisfactionScore: 0.93,
                    conversionRate: 0.71
                }
            },
            {
                id: 'empathetic',
                name: 'Empathetic',
                description: 'Understanding, caring, and emotionally intelligent',
                voiceId: 'VR6AewLTigWG4xSOukaG', // Alex
                personality: 'empathetic',
                style: 'caring-supportive',
                emotionalRange: ['understanding', 'supportive', 'patient', 'compassionate'],
                languageSupport: ['English', 'Hindi'],
                culturalAdaptations: {
                    English: {
                        greetings: ['I understand', 'I hear you', 'Thank you for sharing'],
                        closings: ['I hope this helps', 'Please feel free to reach out', 'You\'re not alone in this'],
                        persuasionStyle: 'Gentle guidance with emotional support',
                        communicationPattern: 'Listen first, acknowledge feelings, then provide solutions'
                    },
                    Hindi: {
                        greetings: ['मैं समझता हूं', 'आपकी बात सुनी', 'साझा करने के लिए धन्यवाद'],
                        closings: ['मुझे उम्मीद है यह मदद करेगा', 'बेझिझक संपर्क करें'],
                        persuasionStyle: 'Understanding with family values respect',
                        communicationPattern: 'Emotional support first, then practical solutions'
                    }
                },
                settings: {
                    stability: 0.8,
                    similarityBoost: 0.8,
                    style: 0.3,
                    useSpeakerBoost: true
                },
                trainingMetrics: {
                    emotionAccuracy: 0.94,
                    adaptationAccuracy: 0.87,
                    customerSatisfactionScore: 0.95,
                    conversionRate: 0.68
                }
            }
        ];
    }
    // Emotion Detection from Speech
    async detectEmotion(audioText, audioFeatures) {
        try {
            // Use OpenAI to analyze emotional content from text
            const response = await axios_1.default.post('https://api.openai.com/v1/chat/completions', {
                model: 'gpt-4',
                messages: [
                    {
                        role: 'system',
                        content: `You are an expert emotion detection AI. Analyze the given text for emotional content and return a JSON response with:
              - primary: main emotion (happy, sad, angry, frustrated, confused, interested, neutral, excited, worried, skeptical)
              - confidence: confidence level (0-1)
              - secondary: secondary emotion if present
              - intensity: emotional intensity (0-1)
              - context: brief context explanation
              
              Focus on detecting customer emotions that would affect sales conversation approach.`
                    },
                    {
                        role: 'user',
                        content: `Analyze this customer speech for emotions: "${audioText}"`
                    }
                ],
                temperature: 0.3,
                max_tokens: 200
            }, {
                headers: {
                    'Authorization': `Bearer ${this.openAIApiKey}`,
                    'Content-Type': 'application/json'
                }
            });
            const result = JSON.parse(response.data.choices[0].message.content);
            // Ensure adaptationNeeded property is included
            if (!result.hasOwnProperty('adaptationNeeded')) {
                result.adaptationNeeded = result.intensity > 0.6 || ['frustrated', 'angry', 'worried', 'confused'].includes(result.primary);
            }
            index_1.logger.info('Emotion detected:', result);
            return result;
        }
        catch (error) {
            index_1.logger.error('Error detecting emotion:', error);
            return {
                primary: 'neutral',
                confidence: 0.5,
                intensity: 0.5,
                context: 'Unable to analyze emotion',
                adaptationNeeded: false
            };
        }
    }
    // Generate Adaptive Response based on detected emotion
    async generateAdaptiveResponse(emotion, conversationContext, personality, language = 'English') {
        try {
            const emotionToApproach = this.getApproachForEmotion(emotion.primary);
            const prompt = `You are a ${personality.name.toLowerCase()} AI sales agent speaking in ${language}. 
      
      Customer emotion detected: ${emotion.primary} (confidence: ${emotion.confidence}, intensity: ${emotion.intensity})
      Context: ${emotion.context}
      
      Conversation context: ${conversationContext}
      
      Generate an adaptive response that:
      1. Acknowledges the customer's emotional state appropriately
      2. Adjusts tone and approach based on the emotion
      3. Maintains the ${personality.description} personality
      4. Uses ${language} language naturally
      
      Return JSON with:
      - tone: how to speak (calm, energetic, understanding, etc.)
      - approach: strategy to use (empathetic, confident, patient, etc.)
      - script: what to say (2-3 sentences max)
      - voiceSettings: { speed: 0.8-1.2, pitch: 0.8-1.2, stability: 0.7-0.9 }`;
            const response = await axios_1.default.post('https://api.openai.com/v1/chat/completions', {
                model: 'gpt-4',
                messages: [
                    { role: 'system', content: prompt },
                    { role: 'user', content: 'Generate adaptive response' }
                ],
                temperature: 0.7,
                max_tokens: 300
            }, {
                headers: {
                    'Authorization': `Bearer ${this.openAIApiKey}`,
                    'Content-Type': 'application/json'
                }
            });
            const result = JSON.parse(response.data.choices[0].message.content);
            index_1.logger.info('Adaptive response generated:', result);
            return result;
        }
        catch (error) {
            index_1.logger.error('Error generating adaptive response:', error);
            return this.getFallbackResponse(emotion.primary, personality, language);
        }
    }
    // Synthesize speech with personality and emotion adaptation
    async synthesizeSpeech(text, personality, adaptiveSettings, language = 'English') {
        try {
            // Merge personality settings with adaptive settings
            const voiceSettings = {
                stability: adaptiveSettings?.stability || personality.settings.stability,
                similarity_boost: personality.settings.similarityBoost,
                style: personality.settings.style,
                use_speaker_boost: personality.settings.useSpeakerBoost
            };
            // Adjust text for language and personality
            const adjustedText = this.adjustTextForPersonalityAndLanguage(text, personality, language);
            const response = await axios_1.default.post(`https://api.elevenlabs.io/v1/text-to-speech/${personality.voiceId}`, {
                text: adjustedText,
                model_id: 'eleven_multilingual_v2', // Supports both English and Hindi
                voice_settings: voiceSettings
            }, {
                headers: {
                    'Accept': 'audio/mpeg',
                    'Content-Type': 'application/json',
                    'xi-api-key': this.elevenLabsApiKey
                },
                responseType: 'arraybuffer'
            });
            return Buffer.from(response.data);
        }
        catch (error) {
            index_1.logger.error('Error synthesizing speech:', error);
            throw new Error('Failed to synthesize speech');
        }
    }
    // Natural Conversation Flow Management
    async manageConversationFlow(conversationHistory, currentEmotion, personality, language = 'English') {
        try {
            const prompt = `You are managing a natural conversation flow for a ${personality.name.toLowerCase()} AI sales agent.

      Conversation History: ${JSON.stringify(conversationHistory.slice(-5))}
      Current Customer Emotion: ${currentEmotion.primary} (${currentEmotion.intensity} intensity)
      Language: ${language}
      
      Analyze the conversation and provide:
      1. nextAction: what the AI should do next (ask_question, provide_info, handle_objection, schedule_callback, close_call)
      2. suggestedResponse: contextually appropriate response
      3. contextAwareness: what the AI understands about the customer's situation
      4. emotionalStrategy: how to leverage emotional intelligence
      
      Return as JSON.`;
            const response = await axios_1.default.post('https://api.openai.com/v1/chat/completions', {
                model: 'gpt-4',
                messages: [
                    { role: 'system', content: prompt },
                    { role: 'user', content: 'Analyze conversation flow' }
                ],
                temperature: 0.7,
                max_tokens: 400
            }, {
                headers: {
                    'Authorization': `Bearer ${this.openAIApiKey}`,
                    'Content-Type': 'application/json'
                }
            });
            return JSON.parse(response.data.choices[0].message.content);
        }
        catch (error) {
            index_1.logger.error('Error managing conversation flow:', error);
            return {
                nextAction: 'ask_question',
                suggestedResponse: 'How can I help you today?',
                contextAwareness: 'Limited context available',
                emotionalStrategy: 'Maintain neutral, helpful tone'
            };
        }
    }
    // Private helper methods
    getApproachForEmotion(emotion) {
        const approaches = {
            'happy': 'enthusiastic',
            'excited': 'matching-energy',
            'interested': 'informative',
            'neutral': 'professional',
            'confused': 'clarifying',
            'frustrated': 'empathetic',
            'angry': 'calming',
            'sad': 'supportive',
            'worried': 'reassuring',
            'skeptical': 'evidence-based'
        };
        return approaches[emotion] || 'professional';
    }
    getFallbackResponse(emotion, personality, language) {
        const fallbacks = {
            'English': {
                'frustrated': {
                    tone: 'calm',
                    approach: 'empathetic',
                    script: 'I understand this might be frustrating. Let me help clarify things for you.',
                    voiceSettings: { speed: 0.9, pitch: 0.9, stability: 0.85 }
                },
                'interested': {
                    tone: 'enthusiastic',
                    approach: 'informative',
                    script: 'I can see you\'re interested! Let me share some details that might be helpful.',
                    voiceSettings: { speed: 1.1, pitch: 1.0, stability: 0.8 }
                },
                'default': {
                    tone: 'professional',
                    approach: 'helpful',
                    script: 'Thank you for your time. How can I assist you today?',
                    voiceSettings: { speed: 1.0, pitch: 1.0, stability: 0.8 }
                }
            },
            'Hindi': {
                'frustrated': {
                    tone: 'calm',
                    approach: 'empathetic',
                    script: 'मैं समझ सकता हूं कि यह परेशान करने वाला हो सकता है। मुझे आपकी सहायता करने दें।',
                    voiceSettings: { speed: 0.9, pitch: 0.9, stability: 0.85 }
                },
                'interested': {
                    tone: 'enthusiastic',
                    approach: 'informative',
                    script: 'मैं देख सकता हूं कि आप रुचि रखते हैं! मुझे कुछ विवरण साझा करने दें।',
                    voiceSettings: { speed: 1.1, pitch: 1.0, stability: 0.8 }
                },
                'default': {
                    tone: 'professional',
                    approach: 'helpful',
                    script: 'आपके समय के लिए धन्यवाद। मैं आज आपकी कैसे सहायता कर सकता हूं?',
                    voiceSettings: { speed: 1.0, pitch: 1.0, stability: 0.8 }
                }
            }
        };
        return fallbacks[language][emotion] || fallbacks[language]['default'];
    }
    adjustTextForPersonalityAndLanguage(text, personality, language) {
        // Add personality-specific speech patterns and language adjustments
        let adjustedText = text;
        if (personality.id === 'friendly') {
            adjustedText = adjustedText.replace(/\./g, '!').replace(/Hello/g, language === 'Hindi' ? 'नमस्ते' : 'Hi there');
        }
        else if (personality.id === 'professional') {
            adjustedText = adjustedText.replace(/!/g, '.').replace(/Hi/g, language === 'Hindi' ? 'नमस्कार' : 'Good day');
        }
        else if (personality.id === 'empathetic') {
            adjustedText = `${adjustedText}. I'm here to help.`;
            if (language === 'Hindi') {
                adjustedText = adjustedText.replace('I\'m here to help.', 'मैं यहां आपकी सहायता के लिए हूं।');
            }
        }
        return adjustedText;
    }
}
exports.VoiceAIService = VoiceAIService;
exports.default = VoiceAIService;
//# sourceMappingURL=voiceAIService.js.map