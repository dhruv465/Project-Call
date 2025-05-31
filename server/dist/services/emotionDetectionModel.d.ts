import * as tf from '@tensorflow/tfjs';
export interface EmotionModelConfig {
    modelPath: string;
    vocabPath: string;
    embeddingDim: number;
    maxSequenceLength: number;
}
export declare class EmotionDetectionModel {
    private model;
    private tokenizer;
    private config;
    private isModelLoaded;
    constructor(config: EmotionModelConfig);
    /**
     * Load the model and tokenizer
     */
    loadModel(): Promise<boolean>;
    /**
     * Preprocess text for emotion detection
     */
    private preprocessText;
    /**
     * Predict emotion from text
     */
    predictEmotion(text: string): Promise<{
        emotion: string;
        confidence: number;
        allEmotions: Record<string, number>;
    }>;
    /**
     * Train the model with new data
     */
    trainModel(trainingData: Array<{
        text: string;
        emotion: string;
    }>, epochs?: number, batchSize?: number): Promise<tf.History>;
    /**
     * Create a new emotion detection model
     */
    private createModel;
    /**
     * Update tokenizer with new text data
     */
    private updateTokenizer;
    /**
     * Save model and tokenizer to disk
     */
    private saveModel;
    /**
     * Check if the model is loaded
     */
    isLoaded(): boolean;
}
