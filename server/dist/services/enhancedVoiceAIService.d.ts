export interface VoicePersonality {
    id: string;
    name: string;
    description: string;
    voiceId: string;
    personality: string;
    style: string;
    emotionalRange: string[];
    languageSupport: string[];
    culturalAdaptations: {
        [language: string]: {
            greetings: string[];
            closings: string[];
            persuasionStyle: string;
            communicationPattern: string;
        };
    };
    settings: {
        stability: number;
        similarityBoost: number;
        style: number;
        useSpeakerBoost: boolean;
    };
    trainingMetrics: {
        emotionAccuracy: number;
        adaptationAccuracy: number;
        customerSatisfactionScore: number;
        conversionRate: number;
    };
}
export interface EmotionAnalysis {
    primary: string;
    confidence: number;
    secondary?: string;
    intensity: number;
    context: string;
    culturalContext?: string;
    adaptationNeeded: boolean;
}
export interface AdaptiveResponse {
    tone: string;
    approach: string;
    script: string;
    culturallyAdapted: boolean;
    personalityAlignment: number;
    voiceSettings: {
        speed: number;
        pitch: number;
        stability: number;
    };
}
export interface ConversationMetrics {
    emotionalEngagement: number;
    personalityConsistency: number;
    culturalApproppriateness: number;
    adaptationSuccess: number;
    overallEffectiveness: number;
}
type Language = 'English' | 'Hindi';
export declare class EnhancedVoiceAIService {
    private elevenLabsApiKey;
    private openAIApiKey;
    private isModelTrained;
    private trainingMetrics;
    private emotionService;
    constructor(elevenLabsApiKey: string, openAIApiKey: string);
    static getEnhancedVoicePersonalities(): VoicePersonality[];
    detectEmotionWithCulturalContext(audioText: string, language?: Language, culturalContext?: string): Promise<EmotionAnalysis>;
    private detectEmotionWithOpenAI;
    private getSecondaryEmotion;
    private calculateIntensity;
    private generateContextDescription;
    private generateCulturalContext;
    private determineAdaptationNeeded;
    generateCulturallyAdaptedResponse(emotion: EmotionAnalysis, conversationContext: string, personality: VoicePersonality, language?: Language): Promise<AdaptiveResponse>;
    synthesizeMultilingualSpeech(text: string, personality: VoicePersonality, adaptiveSettings?: AdaptiveResponse['voiceSettings'], language?: Language, emotionalContext?: string): Promise<Buffer>;
    manageAdvancedConversationFlow(conversationHistory: any[], currentEmotion: EmotionAnalysis, personality: VoicePersonality, language?: Language, culturalProfile?: any): Promise<{
        nextAction: string;
        suggestedResponse: string;
        contextAwareness: string;
        emotionalStrategy: string;
        culturalConsiderations: string;
        confidenceScore: number;
    }>;
    adaptVoiceInRealTime(currentEmotion: EmotionAnalysis, conversationTurn: number, personality: VoicePersonality, language: Language): Promise<{
        adaptedPersonality: VoicePersonality;
        adaptationReason: string;
        confidence: number;
    }>;
    getConversationMetrics(): ConversationMetrics;
    markModelAsTrained(metrics: ConversationMetrics): void;
    isModelFullyTrained(): boolean;
    private shouldAdaptPersonality;
    private getAdaptedPersonality;
    private getCulturalFallbackResponse;
    private applyCulturalAndPersonalityAdaptation;
}
export default EnhancedVoiceAIService;
