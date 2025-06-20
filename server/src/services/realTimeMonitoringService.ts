import { EventEmitter } from 'events';
import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import logger from '../utils/logger';

/**
 * Service for real-time call monitoring and metrics broadcasting
 * Provides SSE (Server-Sent Events) support for dashboard updates
 */
export class RealTimeMonitoringService extends EventEmitter {
  private io: SocketIOServer;
  private activeMonitoringSessions: Map<string, MonitoringSession>;
  private callMetrics: Map<string, CallMetrics>;
  private readonly eventTypes = {
    CALL_STATE_CHANGE: 'call:stateChange',
    AUDIO_WAVEFORM: 'call:audioWaveform',
    EMOTION_UPDATE: 'call:emotionUpdate',
    LATENCY_METRICS: 'call:latencyMetrics',
    INTERRUPTION_DETECTED: 'call:interruption',
    QUALITY_SCORE_UPDATE: 'call:qualityUpdate'
  };

  constructor(server: HttpServer) {
    super();
    
    // Initialize Socket.IO server
    this.io = new SocketIOServer(server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      },
      path: '/monitoring'
    });
    
    this.activeMonitoringSessions = new Map();
    this.callMetrics = new Map();
    
    this.setupSocketHandlers();
    logger.info('Real-time monitoring service initialized');
  }

  /**
   * Set up Socket.IO event handlers
   */
  private setupSocketHandlers(): void {
    this.io.on('connection', (socket) => {
      logger.info(`New monitoring connection: ${socket.id}`);
      
      // Create monitoring session
      const session: MonitoringSession = {
        id: socket.id,
        subscribedCalls: new Set(),
        lastActivity: Date.now()
      };
      
      this.activeMonitoringSessions.set(socket.id, session);
      
      // Handle subscription to specific call
      socket.on('monitor:subscribe', (callId: string) => {
        logger.info(`Client ${socket.id} subscribed to call ${callId}`);
        session.subscribedCalls.add(callId);
        session.lastActivity = Date.now();
        
        // Send initial state if available
        const metrics = this.callMetrics.get(callId);
        if (metrics) {
          socket.emit(this.eventTypes.CALL_STATE_CHANGE, {
            callId,
            state: metrics.state,
            timestamp: Date.now()
          });
        }
      });
      
      // Handle unsubscription from call
      socket.on('monitor:unsubscribe', (callId: string) => {
        logger.info(`Client ${socket.id} unsubscribed from call ${callId}`);
        session.subscribedCalls.delete(callId);
        session.lastActivity = Date.now();
      });
      
      // Handle disconnection
      socket.on('disconnect', () => {
        logger.info(`Monitoring connection closed: ${socket.id}`);
        this.activeMonitoringSessions.delete(socket.id);
      });
    });
  }

  /**
   * Update call state and broadcast to subscribed clients
   * @param callId Call identifier
   * @param state New call state
   */
  public updateCallState(callId: string, state: CallState): void {
    // Update metrics
    const metrics = this.getOrCreateCallMetrics(callId);
    metrics.state = state;
    metrics.lastStateChange = Date.now();
    
    // Broadcast to subscribers
    this.broadcastToCallSubscribers(callId, this.eventTypes.CALL_STATE_CHANGE, {
      callId,
      state,
      timestamp: metrics.lastStateChange
    });
    
    // Emit local event
    this.emit('stateChange', { callId, state });
  }

  /**
   * Update audio waveform data and broadcast to subscribed clients
   * @param callId Call identifier
   * @param waveformData Audio waveform data
   */
  public updateAudioWaveform(callId: string, waveformData: number[]): void {
    // Update metrics
    const metrics = this.getOrCreateCallMetrics(callId);
    metrics.lastWaveformUpdate = Date.now();
    
    // Broadcast to subscribers
    this.broadcastToCallSubscribers(callId, this.eventTypes.AUDIO_WAVEFORM, {
      callId,
      waveformData,
      timestamp: metrics.lastWaveformUpdate
    });
  }

  /**
   * Update emotion detection data and broadcast to subscribed clients
   * @param callId Call identifier
   * @param emotion Detected emotion data
   */
  public updateEmotionData(callId: string, emotion: EmotionData): void {
    // Update metrics
    const metrics = this.getOrCreateCallMetrics(callId);
    metrics.emotionHistory.push({
      emotion,
      timestamp: Date.now()
    });
    
    // Keep only last 20 emotion records
    if (metrics.emotionHistory.length > 20) {
      metrics.emotionHistory.shift();
    }
    
    // Broadcast to subscribers
    this.broadcastToCallSubscribers(callId, this.eventTypes.EMOTION_UPDATE, {
      callId,
      emotion,
      timestamp: Date.now()
    });
  }

  /**
   * Update latency metrics and broadcast to subscribed clients
   * @param callId Call identifier
   * @param latencyData Latency measurement data
   */
  public updateLatencyMetrics(callId: string, latencyData: LatencyData): void {
    // Update metrics
    const metrics = this.getOrCreateCallMetrics(callId);
    metrics.latencyMetrics = {
      ...metrics.latencyMetrics,
      ...latencyData
    };
    
    // Broadcast to subscribers
    this.broadcastToCallSubscribers(callId, this.eventTypes.LATENCY_METRICS, {
      callId,
      latency: metrics.latencyMetrics,
      timestamp: Date.now()
    });
  }

  /**
   * Record agent interruption and broadcast to subscribed clients
   * @param callId Call identifier
   * @param details Interruption details
   */
  public recordInterruption(callId: string, details: InterruptionDetails): void {
    // Update metrics
    const metrics = this.getOrCreateCallMetrics(callId);
    metrics.interruptions.push({
      ...details,
      timestamp: Date.now()
    });
    
    // Broadcast to subscribers
    this.broadcastToCallSubscribers(callId, this.eventTypes.INTERRUPTION_DETECTED, {
      callId,
      interruption: details,
      totalInterruptions: metrics.interruptions.length,
      timestamp: Date.now()
    });
  }

  /**
   * Update call quality score and broadcast to subscribed clients
   * @param callId Call identifier
   * @param qualityScore Quality score data
   */
  public updateQualityScore(callId: string, qualityScore: QualityScoreData): void {
    // Update metrics
    const metrics = this.getOrCreateCallMetrics(callId);
    metrics.qualityScore = qualityScore;
    
    // Broadcast to subscribers
    this.broadcastToCallSubscribers(callId, this.eventTypes.QUALITY_SCORE_UPDATE, {
      callId,
      qualityScore,
      timestamp: Date.now()
    });
  }

  /**
   * Get call metrics for a specific call
   * @param callId Call identifier
   * @returns Call metrics or null if not found
   */
  public getCallMetrics(callId: string): CallMetrics | null {
    return this.callMetrics.get(callId) || null;
  }

  /**
   * Broadcast event to all clients subscribed to a specific call
   * @param callId Call identifier
   * @param eventType Event type
   * @param data Event data
   */
  private broadcastToCallSubscribers(callId: string, eventType: string, data: any): void {
    // Find all sessions subscribed to this call
    for (const [socketId, session] of this.activeMonitoringSessions.entries()) {
      if (session.subscribedCalls.has(callId)) {
        this.io.to(socketId).emit(eventType, data);
      }
    }
  }

  /**
   * Get existing call metrics or create new entry
   * @param callId Call identifier
   * @returns Call metrics object
   */
  private getOrCreateCallMetrics(callId: string): CallMetrics {
    if (!this.callMetrics.has(callId)) {
      this.callMetrics.set(callId, {
        callId,
        state: 'connecting',
        emotionHistory: [],
        latencyMetrics: {
          stt: 0,
          llm: 0,
          tts: 0,
          total: 0
        },
        interruptions: [],
        qualityScore: {
          overall: 0,
          relevance: 0,
          empathy: 0,
          clarity: 0
        },
        startTime: Date.now(),
        lastStateChange: Date.now(),
        lastWaveformUpdate: 0
      });
    }
    
    return this.callMetrics.get(callId)!;
  }
}

/**
 * Monitoring session interface
 */
interface MonitoringSession {
  id: string;
  subscribedCalls: Set<string>;
  lastActivity: number;
}

/**
 * Call state type
 */
export type CallState = 'connecting' | 'speaking' | 'listening' | 'processing' | 'ended' | 'error';

/**
 * Call metrics interface
 */
export interface CallMetrics {
  callId: string;
  state: CallState;
  emotionHistory: Array<{
    emotion: EmotionData;
    timestamp: number;
  }>;
  latencyMetrics: LatencyData;
  interruptions: Array<InterruptionDetails & { timestamp: number }>;
  qualityScore: QualityScoreData;
  startTime: number;
  lastStateChange: number;
  lastWaveformUpdate: number;
}

/**
 * Emotion data interface
 */
export interface EmotionData {
  primary: string;
  secondary?: string;
  confidence: number;
  valence: number; // -1 to 1 (negative to positive)
  arousal: number; // 0 to 1 (calm to excited)
}

/**
 * Latency data interface
 */
export interface LatencyData {
  stt: number; // Speech-to-text latency in ms
  llm: number; // LLM processing latency in ms
  tts: number; // Text-to-speech latency in ms
  total: number; // Total round-trip latency in ms
}

/**
 * Interruption details interface
 */
export interface InterruptionDetails {
  type: 'user' | 'system';
  reason?: string;
  duration?: number;
}

/**
 * Quality score data interface
 */
export interface QualityScoreData {
  overall: number; // 0-100 score
  relevance: number; // 0-100 score
  empathy: number; // 0-100 score
  clarity: number; // 0-100 score
  details?: Record<string, any>;
}

// Export singleton instance
export const realTimeMonitoringService = new RealTimeMonitoringService(
  require('http').createServer()
);
