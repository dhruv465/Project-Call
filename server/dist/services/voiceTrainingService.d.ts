export interface TrainingData {
    emotions: EmotionalTrainingSet[];
    personalities: PersonalityTrainingSet[];
    bilingual: BilingualTrainingSet[];
    conversational: ConversationalTrainingSet[];
}
export interface EmotionalTrainingSet {
    emotion: string;
    samples: Array<{
        text: string;
        language: 'English' | 'Hindi';
        context: string;
        expectedResponse: string;
        voiceSettings: any;
    }>;
    triggers: string[];
    responses: string[];
}
export interface PersonalityTrainingSet {
    personality: string;
    characteristics: string[];
    speechPatterns: string[];
    responseTones: string[];
    adaptationRules: Array<{
        trigger: string;
        adaptation: string;
    }>;
}
export interface BilingualTrainingSet {
    languagePair: ['English', 'Hindi'];
    codeSwitch: Array<{
        scenario: string;
        englishVersion: string;
        hindiVersion: string;
        mixed: string;
    }>;
    culturalAdaptations: Array<{
        concept: string;
        englishApproach: string;
        hindiApproach: string;
    }>;
}
export interface ConversationalTrainingSet {
    scenarios: Array<{
        name: string;
        context: string;
        turns: Array<{
            speaker: 'agent' | 'customer';
            text: string;
            emotion: string;
            expectedResponse?: string;
        }>;
    }>;
}
export declare class VoiceTrainingService {
    private openAIApiKey;
    private trainingData;
    constructor(openAIApiKey: string);
    private initializeTrainingData;
    private getEmotionalTrainingSet;
    private getPersonalityTrainingSet;
    private getBilingualTrainingSet;
    private getConversationalTrainingSet;
    trainEmotionRecognition(): Promise<{
        accuracy: number;
        trainingComplete: boolean;
        modelVersion: string;
    }>;
    trainPersonalityAdaptation(): Promise<{
        accuracy: number;
        trainingComplete: boolean;
        modelVersion: string;
    }>;
    trainBilingualConversation(): Promise<{
        accuracy: number;
        trainingComplete: boolean;
        modelVersion: string;
    }>;
    trainCompleteVoiceModel(): Promise<{
        emotionAccuracy: number;
        personalityAccuracy: number;
        bilingualAccuracy: number;
        conversationalAccuracy: number;
        overallAccuracy: number;
        trainingComplete: boolean;
        modelVersion: string;
    }>;
    private promoteModelsToProd;
    validateModelPerformance(testScenarios: any[]): Promise<{
        passed: number;
        failed: number;
        accuracy: number;
        detailedResults: any[];
    }>;
    private trainModel;
    private testScenario;
}
export default VoiceTrainingService;
