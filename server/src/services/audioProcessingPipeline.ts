import { Transform, Readable, Writable, pipeline } from 'stream';
import { promisify } from 'util';
import logger from '../utils/logger';
import { enhancedSpeechToTextService } from './enhancedSpeechToTextService';
import { ConfigurationService } from './configurationService';

// Promisify pipeline for async/await
const pipelineAsync = promisify(pipeline);

// Audio processing constants
const DEFAULT_SAMPLE_RATE = 16000;
const DEFAULT_CHANNELS = 1;
const DEFAULT_BIT_DEPTH = 16;

/**
 * High-performance audio processing pipeline with parallel processing
 * capabilities for minimum latency voice processing
 */
export class AudioProcessingPipeline {
  private configService: ConfigurationService;
  
  constructor() {
    this.configService = new ConfigurationService();
  }

  /**
   * Process an audio buffer through the complete pipeline
   * @param audioBuffer Audio buffer to process
   * @param options Processing options
   * @returns Processing result with transcription and metrics
   */
  public async processBuffer(
    audioBuffer: Buffer,
    options: AudioProcessingOptions = {}
  ): Promise<AudioProcessingResult> {
    const startTime = Date.now();
    const metrics: ProcessingMetrics = {
      startTime,
      stages: {}
    };
    
    try {
      // 1. Create source stream from buffer
      const sourceStream = new Readable({
        read() {
          this.push(audioBuffer);
          this.push(null);
        }
      });
      
      // 2. Create preprocessing transform stream
      const preprocessStream = this.createPreprocessStream(options);
      
      // Mark preprocessing start time
      metrics.stages.preprocess = { startTime: Date.now() };
      
      // 3. Process through pipeline
      const chunks: Buffer[] = [];
      const collectChunks = new Writable({
        write(chunk, encoding, callback) {
          chunks.push(chunk);
          callback();
        }
      });
      
      // Run the pipeline
      await pipelineAsync(
        sourceStream,
        preprocessStream,
        collectChunks
      );
      
      // Mark preprocessing end time
      metrics.stages.preprocess.endTime = Date.now();
      metrics.stages.preprocess.duration = 
        metrics.stages.preprocess.endTime - metrics.stages.preprocess.startTime;
      
      // Combine chunks into a single buffer
      const processedBuffer = Buffer.concat(chunks);
      
      // 4. Process speech recognition in parallel with other tasks
      metrics.stages.speechRecognition = { startTime: Date.now() };
      
      // Create a stream from the processed buffer
      const processedStream = new Readable({
        read() {
          this.push(processedBuffer);
          this.push(null);
        }
      });
      
      // Start speech recognition
      const transcriptionPromise = enhancedSpeechToTextService.transcribeStream(
        processedStream,
        {
          languageCode: options.languageCode || 'en-US',
          model: options.sttModel || 'nova-2',
          detectLanguage: options.detectLanguage || false
        }
      );
      
      // 5. Perform any additional parallel processing
      // (VAD, audio analysis, etc.) here as needed
      
      // Wait for transcription to complete
      const transcription = await transcriptionPromise;
      
      // Mark speech recognition end time
      metrics.stages.speechRecognition.endTime = Date.now();
      metrics.stages.speechRecognition.duration = 
        metrics.stages.speechRecognition.endTime - metrics.stages.speechRecognition.startTime;
      
      // Calculate total processing time
      const endTime = Date.now();
      metrics.endTime = endTime;
      metrics.totalDuration = endTime - startTime;
      
      // Prepare final result
      return {
        transcription,
        processedAudio: processedBuffer,
        metrics
      };
    } catch (error) {
      logger.error(`Error in audio processing pipeline: ${error.message}`);
      
      // Mark end time and calculate duration
      const endTime = Date.now();
      metrics.endTime = endTime;
      metrics.totalDuration = endTime - startTime;
      metrics.error = error.message;
      
      return {
        transcription: { transcript: '', confidence: 0 },
        processedAudio: Buffer.alloc(0),
        metrics,
        error: error.message
      };
    }
  }

  /**
   * Create audio preprocessing transform stream
   * @param options Processing options
   * @returns Transform stream for preprocessing
   */
  private createPreprocessStream(
    options: AudioProcessingOptions
  ): Transform {
    return new Transform({
      transform(chunk, encoding, callback) {
        try {
          // Process audio chunk
          // In a full implementation, this would include:
          // - Resampling to target rate
          // - Noise reduction
          // - Voice activity detection
          // - Format conversion
          
          // For now, we'll just pass through the chunks
          // In a real implementation, you'd use libraries like 
          // node-audioworklet or WebAudioAPI bindings
          
          callback(null, chunk);
        } catch (error) {
          callback(error);
        }
      }
    });
  }

  /**
   * Process a live audio stream with real-time feedback
   * @param audioStream Input audio stream
   * @param options Processing options
   * @param onProgress Progress callback
   * @returns Audio processing result
   */
  public async processStream(
    audioStream: Readable,
    options: AudioProcessingOptions = {},
    onProgress?: (result: AudioProcessingResult) => void
  ): Promise<AudioProcessingResult> {
    const startTime = Date.now();
    const metrics: ProcessingMetrics = {
      startTime,
      stages: {}
    };
    
    try {
      // Check if advanced processing is enabled
      const config = await this.configService.getConfiguration();
      const useAdvancedProcessing = config?.voiceAIConfig?.useAdvancedProcessing || false;
      
      // 1. Create preprocessing transform stream
      const preprocessStream = this.createPreprocessStream(options);
      
      // Mark preprocessing start time
      metrics.stages.preprocess = { startTime: Date.now() };
      
      // 2. Process through pipeline
      const processedChunks: Buffer[] = [];
      const processedStream = new Transform({
        transform(chunk, encoding, callback) {
          processedChunks.push(chunk);
          this.push(chunk);
          callback();
        }
      });
      
      // 3. Connect streaming speech recognition
      metrics.stages.speechRecognition = { startTime: Date.now() };
      
      // Create pipeline
      const processingPipeline = pipeline(
        audioStream,
        preprocessStream,
        processedStream,
        (err) => {
          if (err) {
            logger.error(`Error in stream processing pipeline: ${err.message}`);
          }
        }
      );
      
      // 4. Start speech recognition
      const transcription = await enhancedSpeechToTextService.transcribeStream(
        processedStream,
        {
          languageCode: options.languageCode || 'en-US',
          model: options.sttModel || 'nova-2',
          detectLanguage: options.detectLanguage || false,
          interimResults: options.interimResults || false
        }
      );
      
      // Mark speech recognition end time
      metrics.stages.speechRecognition.endTime = Date.now();
      metrics.stages.speechRecognition.duration = 
        metrics.stages.speechRecognition.endTime - metrics.stages.speechRecognition.startTime;
      
      // 5. Finalize processed audio
      const processedBuffer = Buffer.concat(processedChunks);
      
      // Mark preprocessing end time
      metrics.stages.preprocess.endTime = Date.now();
      metrics.stages.preprocess.duration = 
        metrics.stages.preprocess.endTime - metrics.stages.preprocess.startTime;
      
      // Calculate total processing time
      const endTime = Date.now();
      metrics.endTime = endTime;
      metrics.totalDuration = endTime - startTime;
      
      // Prepare final result
      const result: AudioProcessingResult = {
        transcription,
        processedAudio: processedBuffer,
        metrics
      };
      
      // Call progress callback with final result
      if (onProgress) {
        onProgress(result);
      }
      
      return result;
    } catch (error) {
      logger.error(`Error in audio stream processing: ${error.message}`);
      
      // Mark end time and calculate duration
      const endTime = Date.now();
      metrics.endTime = endTime;
      metrics.totalDuration = endTime - startTime;
      metrics.error = error.message;
      
      return {
        transcription: { transcript: '', confidence: 0 },
        processedAudio: Buffer.alloc(0),
        metrics,
        error: error.message
      };
    }
  }
}

/**
 * Audio processing options interface
 */
export interface AudioProcessingOptions {
  sampleRate?: number;
  channels?: number;
  bitDepth?: number;
  format?: 'wav' | 'mp3' | 'raw';
  languageCode?: string;
  sttModel?: string;
  noiseReduction?: boolean;
  detectLanguage?: boolean;
  interimResults?: boolean;
}

/**
 * Audio processing result interface
 */
export interface AudioProcessingResult {
  transcription: any;
  processedAudio: Buffer;
  metrics: ProcessingMetrics;
  error?: string;
}

/**
 * Processing metrics interface
 */
export interface ProcessingMetrics {
  startTime: number;
  endTime?: number;
  totalDuration?: number;
  error?: string;
  stages: {
    [key: string]: {
      startTime: number;
      endTime?: number;
      duration?: number;
    };
  };
}

// Export singleton instance
export const audioProcessingPipeline = new AudioProcessingPipeline();
