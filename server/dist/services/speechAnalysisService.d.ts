export interface SpeechAnalysis {
    transcript: string;
    confidence: number;
    language: 'English' | 'Hindi';
    emotions: {
        primary: string;
        secondary?: string;
        confidence: number;
        intensity: number;
    };
    intent: {
        category: string;
        confidence: number;
        entities: any[];
    };
    sentiment: 'positive' | 'negative' | 'neutral';
    speechFeatures: {
        pace: number;
        volume: number;
        tone: string;
    };
}
export interface ConversationContext {
    currentTurn: number;
    customerProfile: {
        name?: string;
        mood: string;
        interests: string[];
        objections: string[];
        engagement_level: number;
    };
    callObjective: string;
    progress: {
        stage: string;
        completed_objectives: string[];
        next_steps: string[];
    };
}
export declare class SpeechAnalysisService {
    private openAIApiKey;
    private googleSpeechKey?;
    constructor(openAIApiKey: string, googleSpeechKey?: string);
    transcribeAudio(audioBuffer: Buffer, language?: 'English' | 'Hindi'): Promise<{
        transcript: string;
        language: string;
        confidence: number;
    }>;
    analyzeSpeech(audioText: string, audioFeatures?: any): Promise<SpeechAnalysis>;
    analyzeIntent(transcript: string, conversationHistory: any[]): Promise<{
        intent: string;
        confidence: number;
        entities: any[];
        suggestedAction: string;
    }>;
    updateConversationContext(context: ConversationContext, newAnalysis: SpeechAnalysis, agentResponse?: string): Promise<ConversationContext>;
    private detectLanguage;
    private getFallbackAnalysis;
    trackEmotionChanges(emotionHistory: Array<{
        emotion: string;
        timestamp: Date;
        intensity: number;
    }>, currentEmotion: string, intensity: number): Promise<{
        emotionTrend: 'improving' | 'declining' | 'stable';
        recommendations: string[];
        alertLevel: 'low' | 'medium' | 'high';
    }>;
    private calculateEmotionTrend;
    private generateEmotionBasedRecommendations;
    private determineAlertLevel;
}
export default SpeechAnalysisService;
