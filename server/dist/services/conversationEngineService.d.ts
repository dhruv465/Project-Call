import { VoicePersonality, EmotionAnalysis, AdaptiveResponse } from './voiceAIService';
import { SpeechAnalysis, ConversationContext } from './speechAnalysisService';
import { LLMProvider } from './llmService';
export interface ConversationTurn {
    id: string;
    timestamp: Date;
    speaker: 'agent' | 'customer';
    content: string;
    analysis?: SpeechAnalysis;
    emotions?: EmotionAnalysis;
    voicePersonality?: VoicePersonality;
    adaptiveResponse?: AdaptiveResponse;
}
export interface CallSession {
    id: string;
    leadId: string;
    campaignId: string;
    startTime: Date;
    language: 'English' | 'Hindi';
    currentPersonality: VoicePersonality;
    conversationHistory: ConversationTurn[];
    context: ConversationContext;
    emotionHistory: Array<{
        emotion: string;
        timestamp: Date;
        intensity: number;
    }>;
    status: 'active' | 'paused' | 'completed' | 'failed';
    metrics: {
        totalTurns: number;
        avgEmotionScore: number;
        personalityChanges: number;
        adaptiveResponses: number;
    };
    llmProvider?: LLMProvider;
}
export declare class ConversationEngineService {
    private voiceAI;
    private speechAnalysis;
    private llmService;
    private activeSessions;
    constructor(elevenLabsApiKey: string, openAIApiKey: string, anthropicApiKey?: string, googleSpeechKey?: string);
    initializeConversation(sessionId: string, leadId: string, campaignId: string, initialPersonality?: string, language?: 'English' | 'Hindi'): Promise<CallSession>;
    processCustomerInput(sessionId: string, audioBuffer?: Buffer, textInput?: string): Promise<{
        transcript: string;
        analysis: SpeechAnalysis;
        emotions: EmotionAnalysis;
        adaptiveResponse: AdaptiveResponse;
        audioResponse: Buffer;
        personalityChanged: boolean;
        recommendations: string[];
    }>;
    generateOpeningMessage(sessionId: string, customerName?: string, campaignContext?: string): Promise<{
        script: string;
        audioResponse: Buffer;
    }>;
    endConversation(sessionId: string, reason: 'completed' | 'customer_hung_up' | 'timeout' | 'error'): Promise<{
        summary: string;
        metrics: CallSession['metrics'];
        finalContext: ConversationContext;
    }>;
    getSession(sessionId: string): CallSession | undefined;
    getVoicePersonalities(): VoicePersonality[];
    generateLLMResponse(sessionId: string, transcript: string, emotions: EmotionAnalysis, context: ConversationContext, personality: VoicePersonality): Promise<string>;
    private createSystemPrompt;
    private getTemperatureForPersonality;
    private getFallbackResponse;
    private shouldChangePersonality;
    private selectOptimalPersonality;
    private calculateAverageEmotionScore;
    private calculateEmotionTrend;
    private getTimeOfDay;
    private generateConversationSummary;
}
export default ConversationEngineService;
