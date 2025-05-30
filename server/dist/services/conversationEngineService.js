"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationEngineService = void 0;
const voiceAIService_1 = __importDefault(require("./voiceAIService"));
const enhancedVoiceAIService_1 = __importDefault(require("./enhancedVoiceAIService"));
const speechAnalysisService_1 = __importDefault(require("./speechAnalysisService"));
const index_1 = require("../index");
class ConversationEngineService {
    constructor(elevenLabsApiKey, openAIApiKey, googleSpeechKey) {
        this.activeSessions = new Map();
        this.voiceAI = new enhancedVoiceAIService_1.default(elevenLabsApiKey, openAIApiKey);
        this.speechAnalysis = new speechAnalysisService_1.default(openAIApiKey, googleSpeechKey);
    }
    // Initialize a new conversation session
    async initializeConversation(sessionId, leadId, campaignId, initialPersonality = 'professional', language = 'English') {
        try {
            const personalities = enhancedVoiceAIService_1.default.getEnhancedVoicePersonalities();
            const selectedPersonality = personalities.find(p => p.id === initialPersonality) || personalities[0];
            const session = {
                id: sessionId,
                leadId,
                campaignId,
                startTime: new Date(),
                language,
                currentPersonality: selectedPersonality,
                conversationHistory: [],
                context: {
                    currentTurn: 0,
                    customerProfile: {
                        mood: 'neutral',
                        interests: [],
                        objections: [],
                        engagement_level: 0.5
                    },
                    callObjective: 'Build rapport and understand customer needs',
                    progress: {
                        stage: 'introduction',
                        completed_objectives: [],
                        next_steps: ['greet_customer', 'introduce_purpose']
                    }
                },
                emotionHistory: [],
                status: 'active',
                metrics: {
                    totalTurns: 0,
                    avgEmotionScore: 0,
                    personalityChanges: 0,
                    adaptiveResponses: 0
                }
            };
            this.activeSessions.set(sessionId, session);
            index_1.logger.info(`Conversation session initialized: ${sessionId}`);
            return session;
        }
        catch (error) {
            index_1.logger.error('Error initializing conversation:', error);
            throw new Error('Failed to initialize conversation session');
        }
    }
    // Process customer input and generate intelligent response
    async processCustomerInput(sessionId, audioBuffer, textInput) {
        try {
            const session = this.activeSessions.get(sessionId);
            if (!session) {
                throw new Error('Session not found');
            }
            let transcript = textInput || '';
            // Transcribe audio if provided
            if (audioBuffer) {
                const transcription = await this.speechAnalysis.transcribeAudio(audioBuffer, session.language);
                transcript = transcription.transcript;
                // Update language if detected differently
                if (transcription.language !== session.language) {
                    session.language = transcription.language;
                }
            }
            // Analyze speech comprehensively
            const speechAnalysis = await this.speechAnalysis.analyzeSpeech(transcript);
            // Detect emotions using production models
            const emotions = await this.voiceAI.detectEmotionWithCulturalContext(transcript, session.language);
            // Update emotion history
            session.emotionHistory.push({
                emotion: emotions.primary,
                timestamp: new Date(),
                intensity: emotions.intensity
            });
            // Track emotion changes and get recommendations
            const emotionTracking = await this.speechAnalysis.trackEmotionChanges(session.emotionHistory, emotions.primary, emotions.intensity);
            // Determine if personality change is needed
            const personalityChanged = await this.shouldChangePersonality(session, emotions, emotionTracking.alertLevel);
            if (personalityChanged) {
                session.currentPersonality = await this.selectOptimalPersonality(emotions, session.context);
                session.metrics.personalityChanges++;
            }
            // Generate adaptive response using enhanced conversation flow
            const conversationFlow = await this.voiceAI.manageAdvancedConversationFlow(session.conversationHistory, emotions, session.currentPersonality, session.language);
            const adaptiveResponse = await this.voiceAI.generateCulturallyAdaptedResponse(emotions, conversationFlow.contextAwareness, session.currentPersonality, session.language);
            // Synthesize speech response using multilingual synthesis
            const audioResponse = await this.voiceAI.synthesizeMultilingualSpeech(adaptiveResponse.script, session.currentPersonality, adaptiveResponse.voiceSettings, session.language);
            // Update conversation history
            const customerTurn = {
                id: `turn-${session.conversationHistory.length + 1}`,
                timestamp: new Date(),
                speaker: 'customer',
                content: transcript,
                analysis: speechAnalysis,
                emotions
            };
            const agentTurn = {
                id: `turn-${session.conversationHistory.length + 2}`,
                timestamp: new Date(),
                speaker: 'agent',
                content: adaptiveResponse.script,
                voicePersonality: session.currentPersonality,
                adaptiveResponse
            };
            session.conversationHistory.push(customerTurn, agentTurn);
            // Update conversation context
            session.context = await this.speechAnalysis.updateConversationContext(session.context, speechAnalysis, adaptiveResponse.script);
            // Update metrics
            session.metrics.totalTurns += 2;
            session.metrics.adaptiveResponses++;
            session.metrics.avgEmotionScore = this.calculateAverageEmotionScore(session.emotionHistory);
            index_1.logger.info(`Customer input processed for session: ${sessionId}`);
            return {
                transcript,
                analysis: speechAnalysis,
                emotions,
                adaptiveResponse,
                audioResponse,
                personalityChanged,
                recommendations: emotionTracking.recommendations
            };
        }
        catch (error) {
            index_1.logger.error('Error processing customer input:', error);
            throw new Error('Failed to process customer input');
        }
    }
    // Generate opening message for conversation
    async generateOpeningMessage(sessionId, customerName, campaignContext) {
        try {
            const session = this.activeSessions.get(sessionId);
            if (!session) {
                throw new Error('Session not found');
            }
            const openingPrompts = {
                'English': {
                    'professional': `Good ${this.getTimeOfDay()}, ${customerName || 'there'}. This is an AI assistant calling from ${campaignContext || 'our company'}. I hope I'm not catching you at a bad time.`,
                    'friendly': `Hi ${customerName || 'there'}! This is your friendly AI assistant from ${campaignContext || 'our company'}. How are you doing today?`,
                    'empathetic': `Hello ${customerName || 'there'}, I'm an AI assistant reaching out from ${campaignContext || 'our company'}. I understand your time is valuable, so I'll be brief.`
                },
                'Hindi': {
                    'professional': `नमस्कार ${customerName || ''}। मैं ${campaignContext || 'हमारी कंपनी'} से एक AI सहायक हूं। उम्मीद है आपका समय अच्छा है।`,
                    'friendly': `नमस्ते ${customerName || ''}! मैं ${campaignContext || 'हमारी कंपनी'} से आपका मित्र AI सहायक हूं। आप कैसे हैं?`,
                    'empathetic': `नमस्कार ${customerName || ''}। मैं ${campaignContext || 'हमारी कंपनी'} से AI सहायक हूं। मैं समझता हूं कि आपका समय कीमती है।`
                }
            };
            const script = openingPrompts[session.language][session.currentPersonality.id];
            const audioResponse = await this.voiceAI.synthesizeMultilingualSpeech(script, session.currentPersonality, undefined, session.language);
            // Add opening turn to conversation history
            const openingTurn = {
                id: 'opening-turn',
                timestamp: new Date(),
                speaker: 'agent',
                content: script,
                voicePersonality: session.currentPersonality
            };
            session.conversationHistory.push(openingTurn);
            session.context.progress.completed_objectives.push('greet_customer');
            return {
                script,
                audioResponse
            };
        }
        catch (error) {
            index_1.logger.error('Error generating opening message:', error);
            throw new Error('Failed to generate opening message');
        }
    }
    // Handle conversation end
    async endConversation(sessionId, reason) {
        try {
            const session = this.activeSessions.get(sessionId);
            if (!session) {
                throw new Error('Session not found');
            }
            session.status = reason === 'completed' ? 'completed' : 'failed';
            // Generate conversation summary
            const summary = await this.generateConversationSummary(session);
            // Calculate final metrics
            const finalMetrics = {
                ...session.metrics,
                duration: new Date().getTime() - session.startTime.getTime(),
                emotionTrend: this.calculateEmotionTrend(session.emotionHistory),
                engagementLevel: session.context.customerProfile.engagement_level
            };
            index_1.logger.info(`Conversation ended: ${sessionId}, Reason: ${reason}`);
            // Clean up session
            this.activeSessions.delete(sessionId);
            return {
                summary,
                metrics: finalMetrics,
                finalContext: session.context
            };
        }
        catch (error) {
            index_1.logger.error('Error ending conversation:', error);
            throw new Error('Failed to end conversation');
        }
    }
    // Get session information
    getSession(sessionId) {
        return this.activeSessions.get(sessionId);
    }
    // Get all available voice personalities
    getVoicePersonalities() {
        return voiceAIService_1.default.getVoicePersonalities();
    }
    // Private helper methods
    async shouldChangePersonality(session, emotions, alertLevel) {
        // Change personality if customer is frustrated/angry and current personality isn't empathetic
        if (alertLevel === 'high' && session.currentPersonality.id !== 'empathetic') {
            return true;
        }
        // Change to friendly if customer becomes interested/excited and current is professional
        if (emotions.primary === 'interested' && session.currentPersonality.id === 'professional') {
            return true;
        }
        // Change to professional if customer seems serious about business
        if (emotions.primary === 'serious' && session.currentPersonality.id === 'friendly') {
            return true;
        }
        return false;
    }
    async selectOptimalPersonality(emotions, _context) {
        const personalities = voiceAIService_1.default.getVoicePersonalities();
        // Select based on customer emotion and context
        if (['frustrated', 'angry', 'sad', 'worried'].includes(emotions.primary)) {
            return personalities.find(p => p.id === 'empathetic') || personalities[0];
        }
        else if (['interested', 'excited', 'happy'].includes(emotions.primary)) {
            return personalities.find(p => p.id === 'friendly') || personalities[0];
        }
        else {
            return personalities.find(p => p.id === 'professional') || personalities[0];
        }
    }
    calculateAverageEmotionScore(emotionHistory) {
        if (emotionHistory.length === 0)
            return 0.5;
        const emotionScores = {
            'angry': 0.1, 'frustrated': 0.2, 'sad': 0.3, 'worried': 0.4,
            'neutral': 0.5, 'confused': 0.4,
            'interested': 0.7, 'happy': 0.8, 'excited': 0.9, 'satisfied': 1.0
        };
        const totalScore = emotionHistory.reduce((sum, emotion) => {
            return sum + (emotionScores[emotion.emotion] || 0.5) * emotion.intensity;
        }, 0);
        return totalScore / emotionHistory.length;
    }
    calculateEmotionTrend(emotionHistory) {
        if (emotionHistory.length < 3)
            return 'stable';
        const recent = emotionHistory.slice(-3);
        const scores = recent.map(e => {
            const emotionScores = {
                'angry': 0.1, 'frustrated': 0.2, 'sad': 0.3,
                'neutral': 0.5, 'interested': 0.7, 'happy': 0.8, 'excited': 0.9
            };
            return (emotionScores[e.emotion] || 0.5) * e.intensity;
        });
        const trend = scores[2] - scores[0];
        if (trend > 0.2)
            return 'improving';
        if (trend < -0.2)
            return 'declining';
        return 'stable';
    }
    getTimeOfDay() {
        const hour = new Date().getHours();
        if (hour < 12)
            return 'morning';
        if (hour < 17)
            return 'afternoon';
        return 'evening';
    }
    async generateConversationSummary(session) {
        try {
            // This would typically use an AI service to generate a summary
            return `Conversation with ${session.leadId} lasted ${session.conversationHistory.length} turns. ` +
                `Customer emotion trend: ${this.calculateEmotionTrend(session.emotionHistory)}. ` +
                `Final engagement level: ${session.context.customerProfile.engagement_level.toFixed(2)}.`;
        }
        catch (error) {
            index_1.logger.error('Error generating conversation summary:', error);
            return 'Summary generation failed';
        }
    }
}
exports.ConversationEngineService = ConversationEngineService;
exports.default = ConversationEngineService;
//# sourceMappingURL=conversationEngineService.js.map