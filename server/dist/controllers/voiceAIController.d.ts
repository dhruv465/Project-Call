import { Request, Response } from 'express';
interface VoiceAIRequest extends Request {
    body: {
        text?: string;
        audioBuffer?: Buffer;
        sessionId?: string;
        language?: 'English' | 'Hindi';
        personalityId?: string;
        conversationContext?: string;
        emotionalContext?: string;
        culturalProfile?: any;
        conversationHistory?: any[];
    };
}
export declare class VoiceAIController {
    private voiceAIService;
    private trainingService;
    private activeSessions;
    constructor();
    trainVoiceModel: (req: Request, res: Response) => Promise<void>;
    getVoicePersonalities: (req: Request, res: Response) => Promise<void>;
    analyzeEmotion: (req: VoiceAIRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
    generateAdaptiveResponse: (req: VoiceAIRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
    synthesizeSpeech: (req: VoiceAIRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
    manageConversationFlow: (req: VoiceAIRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
    getConversationAnalytics: (req: VoiceAIRequest, res: Response) => Promise<Response<any, Record<string, any>>>;
    validateModelPerformance: (req: Request, res: Response) => Promise<void>;
    private getEmotionRecommendations;
    private getFlowRecommendations;
}
export default VoiceAIController;
