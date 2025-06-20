import { Transform, Readable, Writable } from 'stream';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';

// Audio stream configuration
interface AudioStreamConfig {
  sampleRate?: number;
  channels?: number;
  encoding?: string;
  languageCode?: string;
  alternativeLanguageCodes?: string[];
}

// Stream manager configuration
interface StreamManagerOptions {
  bufferSize?: number;
  maxBufferCount?: number;
}

/**
 * AudioStreamManager handles efficient audio processing with backpressure support
 * It manages a collection of audio streams and their processing pipelines
 */
export class AudioStreamManager {
  private streams: Map<string, AudioStreamContext>;
  private readonly bufferSize: number;
  private readonly maxBufferCount: number;

  constructor(options: StreamManagerOptions = {}) {
    this.streams = new Map();
    this.bufferSize = options.bufferSize || 4096;
    this.maxBufferCount = options.maxBufferCount || 3;
  }

  /**
   * Create a new audio stream
   * @param clientId Client identifier (socket ID)
   * @returns Stream ID
   */
  public createStream(clientId: string): string {
    const streamId = uuidv4();
    
    // Create stream processing pipeline
    const inputStream = new Readable({
      objectMode: true,
      read() {} // Implementation provided by external pushes
    });
    
    // Create processing transform stream with backpressure support
    const processingStream = new Transform({
      objectMode: true,
      highWaterMark: this.maxBufferCount,
      transform: (chunk, encoding, callback) => {
        // Process audio chunk (could add VAD, preprocessing, etc.)
        setTimeout(() => {
          // Simulate some processing (would be actual DSP in production)
          callback(null, chunk);
        }, 10);
      }
    });
    
    // Setup stream context
    this.streams.set(streamId, {
      id: streamId,
      clientId,
      inputStream,
      processingStream,
      pipeline: null,
      config: {
        sampleRate: 16000,
        channels: 1,
        encoding: 'LINEAR16',
        languageCode: 'en-US'
      },
      bufferCount: 0,
      paused: false,
      createdAt: new Date()
    });
    
    logger.info(`Created audio stream ${streamId} for client ${clientId}`);
    return streamId;
  }

  /**
   * Queue an audio chunk for processing
   * @param streamId Stream ID
   * @param chunk Audio chunk as Buffer or Uint8Array
   */
  public queueAudioChunk(streamId: string, chunk: Buffer | Uint8Array): void {
    const stream = this.getStream(streamId);
    if (!stream) {
      throw new Error(`Stream ${streamId} not found`);
    }
    
    if (stream.paused) {
      // Don't process chunks when paused
      return;
    }
    
    // Convert to Buffer if necessary
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    
    // Push to stream and update buffer count
    stream.inputStream.push(buffer);
    stream.bufferCount++;
    
    // Log buffer state for debugging
    if (stream.bufferCount % 10 === 0) {
      logger.debug(`Stream ${streamId} buffer count: ${stream.bufferCount}`);
    }
  }

  /**
   * Check if backpressure should be applied
   * @param streamId Stream ID
   * @returns True if backpressure should be applied
   */
  public shouldApplyBackpressure(streamId: string): boolean {
    const stream = this.getStream(streamId);
    if (!stream) {
      return false;
    }
    
    return stream.bufferCount >= this.maxBufferCount;
  }

  /**
   * Pause stream processing
   * @param streamId Stream ID
   */
  public pauseStream(streamId: string): void {
    const stream = this.getStream(streamId);
    if (stream) {
      stream.paused = true;
      logger.info(`Paused stream ${streamId}`);
    }
  }

  /**
   * Resume stream processing
   * @param streamId Stream ID
   */
  public resumeStream(streamId: string): void {
    const stream = this.getStream(streamId);
    if (stream) {
      stream.paused = false;
      logger.info(`Resumed stream ${streamId}`);
    }
  }

  /**
   * Configure stream parameters
   * @param streamId Stream ID
   * @param config Configuration object
   */
  public configureStream(streamId: string, config: Partial<AudioStreamConfig>): void {
    const stream = this.getStream(streamId);
    if (stream) {
      stream.config = {
        ...stream.config,
        ...config
      };
      logger.info(`Updated configuration for stream ${streamId}`);
    }
  }

  /**
   * Destroy a stream and clean up resources
   * @param streamId Stream ID
   */
  public destroyStream(streamId: string): void {
    const stream = this.getStream(streamId);
    if (stream) {
      // End streams
      stream.inputStream.push(null);
      if (stream.pipeline) {
        // Clean up pipeline
        stream.pipeline.destroy();
      }
      
      // Remove from map
      this.streams.delete(streamId);
      logger.info(`Destroyed stream ${streamId}`);
    }
  }

  /**
   * Get a stream by ID
   * @param streamId Stream ID
   * @returns Stream context or undefined
   */
  private getStream(streamId: string): AudioStreamContext | undefined {
    return this.streams.get(streamId);
  }
}

// Stream context interface
interface AudioStreamContext {
  id: string;
  clientId: string;
  inputStream: Readable;
  processingStream: Transform;
  pipeline: any; // Stream pipeline
  config: AudioStreamConfig;
  bufferCount: number;
  paused: boolean;
  createdAt: Date;
}
