import { Request, Response } from 'express';
export declare class EnhancedVoiceAIController {
    private productionEmotionService;
    constructor();
    analyzeEmotionEnhanced(req: Request, res: Response): Promise<void>;
    analyzeEmotionAudio(req: Request, res: Response): Promise<void>;
    analyzeEmotionMultimodal(req: Request, res: Response): Promise<void>;
    private adaptEmotionForCulture;
    getModelStatus(_req: Request, res: Response): Promise<void>;
}
export default EnhancedVoiceAIController;
