import { Server } from 'socket.io';
import { createServer } from 'http';
import express from 'express';
import logger from '../utils/logger';
import { AudioStreamManager } from './audioStreamManager';

/**
 * Dedicated WebSocket server for audio streaming with optimized performance
 * This service handles audio streaming with minimal latency
 */
export class AudioStreamingService {
  private io: Server;
  private app: express.Application;
  private server: any;
  private streamManager: AudioStreamManager;
  private readonly bufferSize: number = 4096; // Default buffer size (can be optimized)
  private readonly maxBufferCount: number = 3; // Max number of buffers to queue

  constructor(port: number = 3002) {
    this.app = express();
    this.server = createServer(this.app);
    this.io = new Server(this.server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      },
      maxHttpBufferSize: 1e6, // 1MB
      transports: ['websocket'] // Force WebSocket for lower latency
    });

    // Initialize audio stream manager
    this.streamManager = new AudioStreamManager({
      bufferSize: this.bufferSize,
      maxBufferCount: this.maxBufferCount
    });

    this.setupRoutes();
    this.setupSocketHandlers();
    this.server.listen(port, () => {
      logger.info(`Audio streaming server listening on port ${port}`);
    });
  }

  private setupRoutes() {
    this.app.get('/health', (req, res) => {
      res.status(200).json({ status: 'ok', uptime: process.uptime() });
    });
  }

  private setupSocketHandlers() {
    this.io.on('connection', (socket) => {
      logger.info(`New audio streaming connection: ${socket.id}`);
      
      // Create a new stream for this connection
      const streamId = this.streamManager.createStream(socket.id);
      
      // Send initial connection info
      socket.emit('stream:ready', { 
        streamId, 
        bufferSize: this.bufferSize,
        channels: 1,
        sampleRate: 16000
      });

      // Handle incoming audio data
      socket.on('stream:audio', async (data) => {
        try {
          // Queue the audio chunk for processing
          this.streamManager.queueAudioChunk(streamId, data);
          
          // Apply backpressure if needed
          if (this.streamManager.shouldApplyBackpressure(streamId)) {
            socket.emit('stream:backpressure', { pause: true });
          }
        } catch (error) {
          logger.error(`Error processing audio chunk: ${error.message}`);
          socket.emit('stream:error', { message: 'Failed to process audio chunk' });
        }
      });

      // Handle audio control messages
      socket.on('stream:control', (control) => {
        if (control.action === 'pause') {
          this.streamManager.pauseStream(streamId);
        } else if (control.action === 'resume') {
          this.streamManager.resumeStream(streamId);
          // If buffer is now manageable, notify client to resume sending
          if (!this.streamManager.shouldApplyBackpressure(streamId)) {
            socket.emit('stream:backpressure', { pause: false });
          }
        }
      });

      // Handle stream configuration
      socket.on('stream:config', (config) => {
        this.streamManager.configureStream(streamId, config);
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        logger.info(`Audio streaming connection closed: ${socket.id}`);
        this.streamManager.destroyStream(streamId);
      });
    });
  }
}

// Export singleton instance for direct use
export const audioStreamingService = new AudioStreamingService();
