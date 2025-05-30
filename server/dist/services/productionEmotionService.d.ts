interface EmotionResult {
    emotion: string;
    confidence: number;
    all_scores: {
        [key: string]: number;
    };
    model_used: string;
    error?: string;
}
interface AudioFeatures {
    mfcc?: number[][];
    spectral_features?: number[];
    temporal_features?: number[];
}
export declare class ProductionEmotionService {
    private pythonPath;
    private scriptPath;
    private isInitialized;
    constructor();
    private initializeService;
    detectEmotionFromText(text: string): Promise<EmotionResult>;
    detectEmotionFromAudio(audioFeatures: AudioFeatures): Promise<EmotionResult>;
    detectEmotionMultimodal(text: string, audioFeatures: AudioFeatures): Promise<EmotionResult>;
    getModelPerformanceStats(): Promise<any>;
    private executePythonScript;
    private getFallbackResult;
    private createPythonWrapper;
}
export default ProductionEmotionService;
