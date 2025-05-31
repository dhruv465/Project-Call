"use strict";
/**
 * training_pipeline.ts
 * Handles the end-to-end model training process, from data preparation to model evaluation
 */
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
exports.ModelTrainingPipeline = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const logger_1 = require("../../utils/logger");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class ModelTrainingPipeline {
    constructor() {
        // Configure paths to Python training scripts
        this.pythonScriptPath = path.resolve(__dirname, '../../../../../training');
        this.modelsDir = path.resolve(__dirname, '../../../../../training/models');
        this.trainingHistoryPath = path.resolve(__dirname, '../../../../../training/training_history.json');
        // Ensure directories exist
        if (!fs.existsSync(this.modelsDir)) {
            fs.mkdirSync(this.modelsDir, { recursive: true });
        }
    }
    /**
     * Initiates model training with specified configuration
     */
    async trainModel(config) {
        console.log(`Starting model training for ${config.modelType} model...`);
        // Prepare training configuration
        const configPath = path.join(this.pythonScriptPath, 'temp_config.json');
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        try {
            // Execute Python training script with config
            const command = `cd ${this.pythonScriptPath} && python emotion_trainer.py --config ${configPath}`;
            const { stdout } = await execAsync(command);
            // Parse training results
            const resultLines = stdout.trim().split('\n');
            const resultLine = resultLines[resultLines.length - 1];
            const resultJson = JSON.parse(resultLine);
            // Generate model ID and version
            const modelId = `${config.modelType}_${Date.now()}`;
            const version = this.generateVersion(config.modelType);
            const result = {
                modelId,
                modelType: config.modelType,
                accuracy: resultJson.accuracy,
                loss: resultJson.loss,
                timestamp: new Date().toISOString(),
                configUsed: config,
                modelPath: resultJson.model_path,
                version
            };
            // Save training history
            this.saveTrainingHistory(result);
            console.log(`Model training completed. Model ID: ${modelId}, Accuracy: ${result.accuracy}`);
            return result;
        }
        catch (error) {
            console.error('Model training failed:', error);
            throw new Error(`Model training failed: ${(0, logger_1.getErrorMessage)(error)}`);
        }
        finally {
            // Clean up temp config
            if (fs.existsSync(configPath)) {
                fs.unlinkSync(configPath);
            }
        }
    }
    /**
     * Generates a new version number for the model
     */
    generateVersion(modelType) {
        const history = this.getTrainingHistory();
        const typeHistory = history.filter(h => h.modelType === modelType);
        if (typeHistory.length === 0) {
            return '1.0.0';
        }
        // Find highest version
        const versions = typeHistory.map(h => h.version)
            .map(v => v.split('.').map(Number));
        const highestVersion = versions.sort((a, b) => {
            if (a[0] !== b[0])
                return b[0] - a[0];
            if (a[1] !== b[1])
                return b[1] - a[1];
            return b[2] - a[2];
        })[0];
        // Increment patch version
        return `${highestVersion[0]}.${highestVersion[1]}.${highestVersion[2] + 1}`;
    }
    /**
     * Saves training results to history file
     */
    saveTrainingHistory(result) {
        const history = this.getTrainingHistory();
        history.push(result);
        fs.writeFileSync(this.trainingHistoryPath, JSON.stringify(history, null, 2));
    }
    /**
     * Retrieves training history
     */
    getTrainingHistory() {
        if (!fs.existsSync(this.trainingHistoryPath)) {
            return [];
        }
        try {
            const historyData = fs.readFileSync(this.trainingHistoryPath, 'utf-8');
            return JSON.parse(historyData);
        }
        catch (error) {
            console.error('Error reading training history:', error);
            return [];
        }
    }
    /**
     * Evaluates a trained model on validation data
     */
    async evaluateModel(modelId, testDataPath) {
        const history = this.getTrainingHistory();
        const modelInfo = history.find(h => h.modelId === modelId);
        if (!modelInfo) {
            throw new Error(`Model with ID ${modelId} not found`);
        }
        const evalCommand = `cd ${this.pythonScriptPath} && python model_evaluator.py --model_path ${modelInfo.modelPath} --test_data ${testDataPath}`;
        try {
            const { stdout } = await execAsync(evalCommand);
            const evalResult = JSON.parse(stdout.trim());
            return {
                modelId,
                evaluationTimestamp: new Date().toISOString(),
                metrics: evalResult
            };
        }
        catch (error) {
            console.error('Model evaluation failed:', error);
            throw new Error(`Model evaluation failed: ${(0, logger_1.getErrorMessage)(error)}`);
        }
    }
}
exports.ModelTrainingPipeline = ModelTrainingPipeline;
exports.default = new ModelTrainingPipeline();
//# sourceMappingURL=training_pipeline.js.map