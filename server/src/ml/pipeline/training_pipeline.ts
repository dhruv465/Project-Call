/**
 * training_pipeline.ts
 * Handles the end-to-end model training process, from data preparation to model evaluation
 */

import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getErrorMessage } from '../../utils/logger';

const execAsync = promisify(exec);

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

export class ModelTrainingPipeline {
  private pythonScriptPath: string;
  private modelsDir: string;
  private trainingHistoryPath: string;

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
  public async trainModel(config: TrainingConfig): Promise<TrainingResult> {
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
      
      const result: TrainingResult = {
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
    } catch (error) {
      console.error('Model training failed:', error);
      throw new Error(`Model training failed: ${getErrorMessage(error)}`);
    } finally {
      // Clean up temp config
      if (fs.existsSync(configPath)) {
        fs.unlinkSync(configPath);
      }
    }
  }
  
  /**
   * Generates a new version number for the model
   */
  private generateVersion(modelType: string): string {
    const history = this.getTrainingHistory();
    const typeHistory = history.filter(h => h.modelType === modelType);
    
    if (typeHistory.length === 0) {
      return '1.0.0';
    }
    
    // Find highest version
    const versions = typeHistory.map(h => h.version)
      .map(v => v.split('.').map(Number));
    
    const highestVersion = versions.sort((a, b) => {
      if (a[0] !== b[0]) return b[0] - a[0];
      if (a[1] !== b[1]) return b[1] - a[1];
      return b[2] - a[2];
    })[0];
    
    // Increment patch version
    return `${highestVersion[0]}.${highestVersion[1]}.${highestVersion[2] + 1}`;
  }
  
  /**
   * Saves training results to history file
   */
  private saveTrainingHistory(result: TrainingResult): void {
    const history = this.getTrainingHistory();
    history.push(result);
    
    fs.writeFileSync(
      this.trainingHistoryPath,
      JSON.stringify(history, null, 2)
    );
  }
  
  /**
   * Retrieves training history
   */
  private getTrainingHistory(): TrainingResult[] {
    if (!fs.existsSync(this.trainingHistoryPath)) {
      return [];
    }
    
    try {
      const historyData = fs.readFileSync(this.trainingHistoryPath, 'utf-8');
      return JSON.parse(historyData);
    } catch (error) {
      console.error('Error reading training history:', error);
      return [];
    }
  }
  
  /**
   * Evaluates a trained model on validation data
   */
  public async evaluateModel(modelId: string, testDataPath: string): Promise<any> {
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
    } catch (error) {
      console.error('Model evaluation failed:', error);
      throw new Error(`Model evaluation failed: ${getErrorMessage(error)}`);
    }
  }
}

export default new ModelTrainingPipeline();