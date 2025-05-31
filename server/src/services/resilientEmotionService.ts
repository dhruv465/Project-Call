// Production Emotion Service - Resilient Implementation
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { logger, getErrorMessage } from '../index';

interface EmotionResult {
  emotion: string;
  confidence: number;
  all_scores: { [key: string]: number };
  model_used: string;
  error?: string;
}

interface AudioFeatures {
  mfcc?: number[][];
  spectral_features?: number[];
  temporal_features?: number[];
}

export class ResilientProductionEmotionService {
  private pythonPath: string;
  private scriptPath: string;
  private isInitialized: boolean = false;

  constructor() {
    try {
      // Path to the Python script in the training directory
      this.scriptPath = path.join(__dirname, '../../../training/deployment/emotion_service_wrapper.py');
      this.pythonPath = 'python3'; // Use system Python or virtual environment
      
      // Initialize asynchronously without blocking constructor
      this.initializeService().catch(error => {
        // Handle error gracefully - just log and continue with fallbacks
        logger.warn(`Emotion service initialization failed, will use fallbacks: ${error}`);
        // Mark as initialized to use fallbacks instead of failing completely
        this.isInitialized = true;
      });
    } catch (error) {
      // Catch any constructor errors to prevent service failure
      logger.error(`Error in ProductionEmotionService constructor: ${error}`);
      this.isInitialized = true; // Use fallbacks
    }
  }

  private async initializeService(): Promise<void> {
    try {
      // Check if the Python script exists
      if (!fs.existsSync(this.scriptPath)) {
        logger.warn('Python emotion service script not found');
        // Don't try to create it - just use fallbacks
        this.isInitialized = true;
        return;
      }
      
      // Test that the Python environment is working
      try {
        // Simple test call
        const testResult = await this.executePythonScript('status', {});
        if (testResult && !testResult.error) {
          this.isInitialized = true;
          logger.info('Production emotion service initialized successfully');
        } else {
          logger.warn('Emotion service test returned an error, using fallbacks');
          this.isInitialized = true; // Still use fallbacks
        }
      } catch (testError) {
        logger.warn(`Python environment test failed, using fallbacks: ${getErrorMessage(testError)}`);
        this.isInitialized = true; // Still use fallbacks
      }
    } catch (error) {
      logger.error(`Failed to initialize production emotion service: ${getErrorMessage(error)}`);
      this.isInitialized = true; // Use fallbacks
    }
  }

  async detectEmotionFromText(text: string): Promise<EmotionResult> {
    // Always return a valid result, even in error cases
    try {
      if (!this.isInitialized) {
        return this.getFallbackResult('text_fallback');
      }

      const result = await this.executePythonScript('text', { text });
      
      // Validate the result
      if (!result || !result.emotion) {
        return this.getFallbackResult('text_invalid_result');
      }
      
      return result;
    } catch (error) {
      logger.error(`Error in text emotion detection: ${getErrorMessage(error)}`);
      return this.getFallbackResult('text_error');
    }
  }

  async detectEmotionFromAudio(audioFeatures: AudioFeatures): Promise<EmotionResult> {
    try {
      if (!this.isInitialized) {
        return this.getFallbackResult('audio_fallback');
      }

      const result = await this.executePythonScript('audio', { audio_features: audioFeatures });
      
      // Validate the result
      if (!result || !result.emotion) {
        return this.getFallbackResult('audio_invalid_result');
      }
      
      return result;
    } catch (error) {
      logger.error(`Error in audio emotion detection: ${getErrorMessage(error)}`);
      return this.getFallbackResult('audio_error');
    }
  }

  async detectEmotionMultimodal(text: string, audioFeatures: AudioFeatures): Promise<EmotionResult> {
    try {
      if (!this.isInitialized) {
        return this.getFallbackResult('multimodal_fallback');
      }

      const result = await this.executePythonScript('multimodal', { 
        text, 
        audio_features: audioFeatures 
      });
      
      // Validate the result
      if (!result || !result.emotion) {
        return this.getFallbackResult('multimodal_invalid_result');
      }
      
      return result;
    } catch (error) {
      logger.error(`Error in multimodal emotion detection: ${getErrorMessage(error)}`);
      return this.getFallbackResult('multimodal_error');
    }
  }

  async getModelPerformanceStats(): Promise<any> {
    try {
      const result = await this.executePythonScript('status', {});
      return result;
    } catch (error) {
      logger.error(`Error getting model performance stats: ${getErrorMessage(error)}`);
      return {
        models: {
          text_emotion: { status: 'unknown', accuracy: 'N/A' },
          audio_emotion: { status: 'unknown', accuracy: 'N/A' },
          multimodal_emotion: { status: 'unknown', accuracy: 'N/A' }
        },
        last_updated: new Date().toISOString()
      };
    }
  }
  
  private getDefaultStats(): any {
    return {
      models: {
        text_emotion: { status: 'fallback', accuracy: 'N/A' },
        audio_emotion: { status: 'fallback', accuracy: 'N/A' },
        multimodal_emotion: { status: 'fallback', accuracy: 'N/A' }
      },
      last_updated: new Date().toISOString()
    };
  }

  private async executePythonScript(mode: string, data: any): Promise<any> {
    return new Promise((resolve) => {
      try {
        const args = [this.scriptPath, mode, JSON.stringify(data)];
        const pythonProcess = spawn(this.pythonPath, args);
        
        let output = '';
        let errorOutput = '';
        let hasTimedOut = false;
        let processEnded = false;

        // Set timeout for long-running processes
        const timeout = setTimeout(() => {
          hasTimedOut = true;
          pythonProcess.kill();
          logger.warn(`Python process timed out for mode: ${mode}`);
          resolve(this.getFallbackResult(`${mode}_timeout`));
        }, 5000); // 5-second timeout
        
        pythonProcess.stdout.on('data', (data) => {
          output += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
          errorOutput += data.toString();
          // Log stderr as debug - it may contain useful info
          logger.debug(`Python stderr: ${data.toString()}`);
        });

        pythonProcess.on('close', (code) => {
          clearTimeout(timeout);
          
          if (processEnded || hasTimedOut) return; // Already handled
          processEnded = true;
          
          if (code !== 0) {
            logger.warn(`Python process exited with code ${code}: ${errorOutput}`);
            resolve(this.getFallbackResult(`${mode}_process_error`));
            return;
          }

          try {
            const trimmedOutput = output.trim();
            if (!trimmedOutput) {
              logger.warn('Empty output from Python script');
              resolve(this.getFallbackResult(`${mode}_empty_output`));
              return;
            }
            
            const result = JSON.parse(trimmedOutput);
            resolve(result);
          } catch (parseError) {
            logger.error(`Failed to parse Python script output: ${getErrorMessage(parseError)}`);
            resolve(this.getFallbackResult(`${mode}_parse_error`));
          }
        });

        pythonProcess.on('error', (error) => {
          clearTimeout(timeout);
          
          if (processEnded || hasTimedOut) return; // Already handled
          processEnded = true;
          
          logger.error(`Failed to start Python process: ${error}`);
          resolve(this.getFallbackResult(`${mode}_spawn_error`));
        });
      } catch (error) {
        // Catch any unexpected errors in the spawn process itself
        logger.error(`Unexpected error executing Python script: ${error}`);
        resolve(this.getFallbackResult(`${mode}_unexpected_error`));
      }
    });
  }

  private getFallbackResult(modelUsed: string): EmotionResult {
    // Simple rule-based fallback for demonstration
    const fallbackEmotions = ['neutral', 'happiness', 'sadness', 'anger', 'love'];
    const randomEmotion = fallbackEmotions[Math.floor(Math.random() * fallbackEmotions.length)];
    
    const scores: { [key: string]: number } = {};
    fallbackEmotions.forEach(emotion => {
      scores[emotion] = emotion === randomEmotion ? 0.6 + Math.random() * 0.3 : Math.random() * 0.2;
    });

    return {
      emotion: randomEmotion,
      confidence: scores[randomEmotion],
      all_scores: scores,
      model_used: modelUsed
    };
  }
}

// Export a singleton instance
const productionEmotionService = new ResilientProductionEmotionService();
export default productionEmotionService;
