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
export declare class VoiceAIService {
    private elevenLabsApiKey;
    private openAIApiKey;
    constructor(elevenLabsApiKey: string, openAIApiKey: string);
    static getVoicePersonalities(): VoicePersonality[];
    detectEmotion(audioText: string, audioFeatures?: any): Promise<EmotionAnalysis>;
    generateAdaptiveResponse(emotion: EmotionAnalysis, conversationContext: string, personality: VoicePersonality, language?: 'English' | 'Hindi'): Promise<AdaptiveResponse>;
    synthesizeSpeech(text: string, personality: VoicePersonality, adaptiveSettings?: AdaptiveResponse['voiceSettings'], language?: 'English' | 'Hindi'): Promise<Buffer>;
    manageConversationFlow(conversationHistory: any[], currentEmotion: EmotionAnalysis, personality: VoicePersonality, language?: 'English' | 'Hindi'): Promise<{
        nextAction: string;
        suggestedResponse: string;
        contextAwareness: string;
        emotionalStrategy: string;
    }>;
    private getApproachForEmotion;
    private getFallbackResponse;
    private adjustTextForPersonalityAndLanguage;
}
export default VoiceAIService;
