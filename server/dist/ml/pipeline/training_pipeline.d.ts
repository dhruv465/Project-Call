/**
 * training_pipeline.ts
 * Handles the end-to-end model training process, from data preparation to model evaluation
 */
interface TrainingConfig {
    modelType: 'audio' | 'text' | 'multimodal';
    datasetPath: string;
    epochs: number;
    batchSize: number;
    learningRate: number;
    validationSplit: number;
    outputDir: string;
}
interface TrainingResult {
    modelId: string;
    modelType: string;
    accuracy: number;
    loss: number;
    timestamp: string;
    configUsed: TrainingConfig;
    modelPath: string;
    version: string;
}
export declare class ModelTrainingPipeline {
    private pythonScriptPath;
    private modelsDir;
    private trainingHistoryPath;
    constructor();
    /**
     * Initiates model training with specified configuration
     */
    trainModel(config: TrainingConfig): Promise<TrainingResult>;
    /**
     * Generates a new version number for the model
     */
    private generateVersion;
    /**
     * Saves training results to history file
     */
    private saveTrainingHistory;
    /**
     * Retrieves training history
     */
    private getTrainingHistory;
    /**
     * Evaluates a trained model on validation data
     */
    evaluateModel(modelId: string, testDataPath: string): Promise<any>;
}
declare const _default: ModelTrainingPipeline;
export default _default;
