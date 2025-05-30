import { Request, Response } from 'express';
export declare class VoiceAIDemoController {
    private voiceAIService;
    private trainingService;
    constructor();
    runCompleteDemo: (req: Request, res: Response) => Promise<void>;
    private testPersonality;
    private testEmotionDetection;
    private testBilingualResponse;
    private testConversationFlow;
    getVoiceAIStatus: (req: Request, res: Response) => Promise<void>;
}
export default VoiceAIDemoController;
