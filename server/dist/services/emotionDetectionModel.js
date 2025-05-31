"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmotionDetectionModel = void 0;
const tf = __importStar(require("@tensorflow/tfjs"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const index_1 = require("../index");
// Emotion labels (in order of model output)
const EMOTIONS = ['neutral', 'happy', 'sad', 'angry', 'frustrated', 'confused', 'interested', 'skeptical'];
class EmotionDetectionModel {
    constructor(config) {
        this.model = null;
        this.tokenizer = new Map();
        this.isModelLoaded = false;
        this.config = config;
    }
    /**
     * Load the model and tokenizer
     */
    async loadModel() {
        try {
            // Load tokenizer vocabulary
            if (fs.existsSync(this.config.vocabPath)) {
                const vocabData = JSON.parse(fs.readFileSync(this.config.vocabPath, 'utf-8'));
                this.tokenizer = new Map(Object.entries(vocabData));
                index_1.logger.info(`Loaded tokenizer with ${this.tokenizer.size} tokens`);
            }
            else {
                index_1.logger.error(`Tokenizer file not found at ${this.config.vocabPath}`);
                return false;
            }
            // Load TensorFlow model
            if (fs.existsSync(this.config.modelPath)) {
                this.model = await tf.loadLayersModel(`file://${this.config.modelPath}`);
                index_1.logger.info('Emotion detection model loaded successfully');
                this.isModelLoaded = true;
                return true;
            }
            else {
                index_1.logger.error(`Model file not found at ${this.config.modelPath}`);
                return false;
            }
        }
        catch (error) {
            index_1.logger.error('Error loading emotion detection model:', error);
            return false;
        }
    }
    /**
     * Preprocess text for emotion detection
     */
    preprocessText(text) {
        // Tokenize and convert to sequence
        const tokens = text.toLowerCase()
            .replace(/[^\w\s]/g, '')
            .split(/\s+/)
            .map(token => this.tokenizer.get(token) || 0); // 0 is <UNK>
        // Pad or truncate to fixed length
        if (tokens.length > this.config.maxSequenceLength) {
            return tokens.slice(0, this.config.maxSequenceLength);
        }
        // Pad with zeros
        return tokens.concat(Array(this.config.maxSequenceLength - tokens.length).fill(0));
    }
    /**
     * Predict emotion from text
     */
    async predictEmotion(text) {
        if (!this.isModelLoaded || !this.model) {
            await this.loadModel();
        }
        if (!this.model) {
            throw new Error('Emotion detection model not loaded');
        }
        try {
            // Preprocess the text
            const sequence = this.preprocessText(text);
            // Convert to tensor and predict
            const inputTensor = tf.tensor2d([sequence], [1, this.config.maxSequenceLength]);
            const prediction = this.model.predict(inputTensor);
            // Get prediction results
            const predictionData = await prediction.data();
            const dataArray = Array.from(predictionData);
            // Get the highest confidence emotion
            const maxIndex = dataArray.reduce((maxI, val, i, arr) => (val > arr[maxI] ? i : maxI), 0);
            const maxEmotion = EMOTIONS[maxIndex];
            const maxConfidence = dataArray[maxIndex];
            // Format all emotions with confidence
            const allEmotions = EMOTIONS.reduce((obj, emotion, index) => {
                obj[emotion] = Number(dataArray[index].toFixed(4));
                return obj;
            }, {});
            // Cleanup tensors
            inputTensor.dispose();
            prediction.dispose();
            return {
                emotion: maxEmotion,
                confidence: Number(maxConfidence.toFixed(4)),
                allEmotions
            };
        }
        catch (error) {
            index_1.logger.error('Error predicting emotion:', error);
            throw error;
        }
    }
    /**
     * Train the model with new data
     */
    async trainModel(trainingData, epochs = 10, batchSize = 32) {
        try {
            // Create or update tokenizer from training data
            this.updateTokenizer(trainingData.map(d => d.text));
            // Prepare training data
            const sequences = trainingData.map(d => this.preprocessText(d.text));
            const labels = trainingData.map(d => {
                const oneHot = Array(EMOTIONS.length).fill(0);
                const emotionIndex = EMOTIONS.indexOf(d.emotion);
                if (emotionIndex >= 0) {
                    oneHot[emotionIndex] = 1;
                }
                return oneHot;
            });
            // Create tensors
            const xTrain = tf.tensor2d(sequences, [sequences.length, this.config.maxSequenceLength]);
            const yTrain = tf.tensor2d(labels, [labels.length, EMOTIONS.length]);
            // Create model if it doesn't exist
            if (!this.model) {
                this.model = this.createModel();
            }
            // Train the model
            const history = await this.model.fit(xTrain, yTrain, {
                epochs,
                batchSize,
                validationSplit: 0.2,
                callbacks: {
                    onEpochEnd: (epoch, logs) => {
                        index_1.logger.info(`Epoch ${epoch + 1}/${epochs} - Loss: ${logs?.loss.toFixed(4)}, Accuracy: ${logs?.acc.toFixed(4)}`);
                    }
                }
            });
            // Save updated model and tokenizer
            await this.saveModel();
            // Cleanup tensors
            xTrain.dispose();
            yTrain.dispose();
            this.isModelLoaded = true;
            return history;
        }
        catch (error) {
            index_1.logger.error('Error training emotion model:', error);
            throw error;
        }
    }
    /**
     * Create a new emotion detection model
     */
    createModel() {
        const model = tf.sequential();
        // Embedding layer
        model.add(tf.layers.embedding({
            inputDim: this.tokenizer.size + 1, // +1 for <UNK>
            outputDim: this.config.embeddingDim,
            inputLength: this.config.maxSequenceLength
        }));
        // Bidirectional LSTM
        model.add(tf.layers.bidirectional({
            layer: tf.layers.lstm({
                units: 128,
                returnSequences: false
            }),
            mergeMode: 'concat'
        }));
        // Dense layers
        model.add(tf.layers.dense({ units: 64, activation: 'relu' }));
        model.add(tf.layers.dropout({ rate: 0.3 }));
        model.add(tf.layers.dense({ units: EMOTIONS.length, activation: 'softmax' }));
        // Compile the model
        model.compile({
            optimizer: 'adam',
            loss: 'categoricalCrossentropy',
            metrics: ['accuracy']
        });
        return model;
    }
    /**
     * Update tokenizer with new text data
     */
    updateTokenizer(texts) {
        // Process all text and update vocabulary
        texts.forEach(text => {
            const tokens = text.toLowerCase()
                .replace(/[^\w\s]/g, '')
                .split(/\s+/);
            tokens.forEach(token => {
                if (!this.tokenizer.has(token)) {
                    this.tokenizer.set(token, this.tokenizer.size + 1); // Reserve 0 for padding
                }
            });
        });
        index_1.logger.info(`Tokenizer updated with ${this.tokenizer.size} tokens`);
    }
    /**
     * Save model and tokenizer to disk
     */
    async saveModel() {
        try {
            // Create directory if it doesn't exist
            const modelDir = path.dirname(this.config.modelPath);
            if (!fs.existsSync(modelDir)) {
                fs.mkdirSync(modelDir, { recursive: true });
            }
            // Save model
            if (this.model) {
                await this.model.save(`file://${this.config.modelPath}`);
                index_1.logger.info(`Model saved to ${this.config.modelPath}`);
            }
            // Save tokenizer vocabulary
            const vocabObject = Object.fromEntries(this.tokenizer);
            fs.writeFileSync(this.config.vocabPath, JSON.stringify(vocabObject, null, 2));
            index_1.logger.info(`Tokenizer saved to ${this.config.vocabPath}`);
        }
        catch (error) {
            index_1.logger.error('Error saving model:', error);
            throw error;
        }
    }
    /**
     * Check if the model is loaded
     */
    isLoaded() {
        return this.isModelLoaded;
    }
}
exports.EmotionDetectionModel = EmotionDetectionModel;
//# sourceMappingURL=emotionDetectionModel.js.map