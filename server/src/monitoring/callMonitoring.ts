import { EventEmitter } from 'events';
import logger from '../utils/logger';
import Call, { ICall } from '../models/Call';
import { Socket } from 'socket.io';
import { advancedTelephonyService, conversationStateMachine } from '../services';

// Monitoring event types
export type MonitoringEventType = 
  'call-initiated' | 
  'call-connected' | 
  'call-ended' | 
  'call-status-changed' | 
  'conversation-update' | 
  'error' | 
  'system-alert' | 
  'compliance-alert' | 
  'rate-limit-hit' |
  'metrics-update';

// Monitoring event interface
export interface MonitoringEvent {
  type: MonitoringEventType;
  timestamp: Date;
  data: any;
  severity?: 'info' | 'warning' | 'error' | 'critical';
}

class CallMonitoringService extends EventEmitter {
  private activeClients: Map<string, Socket> = new Map();
  private metricUpdateInterval: NodeJS.Timeout | null = null;
  private systemHealth: {
    cpuUsage: number;
    memoryUsage: number;
    activeConnections: number;
    queuedCalls: number;
    totalCalls24h: number;
    successRate24h: number;
    averageDuration: number;
    lastUpdated: Date;
  } = {
    cpuUsage: 0,
    memoryUsage: 0,
    activeConnections: 0,
    queuedCalls: 0,
    totalCalls24h: 0,
    successRate24h: 0,
    averageDuration: 0,
    lastUpdated: new Date()
  };
  
  constructor() {
    super();
    
    // Listen for events from other services
    this.setupEventListeners();
    
    // Start periodic metric updates
    this.startMetricUpdates();
    
    // Forward monitoring events to logger
    this.on('monitoring-event', (event: MonitoringEvent) => {
      const logMessage = `[${event.type}] ${JSON.stringify(event.data)}`;
      
      switch(event.severity) {
        case 'critical':
        case 'error':
          logger.error(logMessage);
          break;
        case 'warning':
          logger.warn(logMessage);
          break;
        default:
          logger.info(logMessage);
      }
    });
  }
  
  /**
   * Set up event listeners to capture system events
   */
  private setupEventListeners(): void {
    // Could hook into various service events
    // For now, we'll implement periodic polling
  }
  
  /**
   * Start periodic metric updates
   */
  private startMetricUpdates(): void {
    if (this.metricUpdateInterval) {
      clearInterval(this.metricUpdateInterval);
    }
    
    // Update metrics every 30 seconds
    this.metricUpdateInterval = setInterval(async () => {
      try {
        // Update system metrics
        await this.updateSystemMetrics();
        
        // Emit an event with the updated metrics
        this.emitMonitoringEvent('metrics-update', this.systemHealth);
      } catch (error) {
        logger.error('Error updating metrics:', error);
      }
    }, 30000);
  }
  
  /**
   * Update system health metrics
   */
  private async updateSystemMetrics(): Promise<void> {
    try {
      // Get telephony metrics
      const telephonyMetrics = await advancedTelephonyService.getCallMetrics('24h');
      
      // Get active conversations
      const activeConversations = conversationStateMachine.getActiveConversations().length;
      
      // Update system health
      this.systemHealth = {
        cpuUsage: process.cpuUsage().user / 1000000, // Approximate CPU usage
        memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024, // MB
        activeConnections: activeConversations + this.activeClients.size,
        queuedCalls: telephonyMetrics.queueStatus.queued,
        totalCalls24h: telephonyMetrics.totalCalls,
        successRate24h: telephonyMetrics.successRate,
        averageDuration: telephonyMetrics.averageDuration,
        lastUpdated: new Date()
      };
      
      // Check for system alerts
      this.checkSystemAlerts();
    } catch (error) {
      logger.error('Error updating system metrics:', error);
    }
  }
  
  /**
   * Check for system alerts based on metrics
   */
  private checkSystemAlerts(): void {
    // Check memory usage
    if (this.systemHealth.memoryUsage > 1024) { // > 1GB
      this.emitMonitoringEvent('system-alert', {
        message: 'High memory usage detected',
        memoryUsage: `${this.systemHealth.memoryUsage.toFixed(2)} MB`
      }, 'warning');
    }
    
    // Check success rate
    if (this.systemHealth.successRate24h < 0.5 && this.systemHealth.totalCalls24h > 10) {
      this.emitMonitoringEvent('system-alert', {
        message: 'Low call success rate detected',
        successRate: `${(this.systemHealth.successRate24h * 100).toFixed(2)}%`,
        totalCalls: this.systemHealth.totalCalls24h
      }, 'warning');
    }
    
    // Check queue size
    if (this.systemHealth.queuedCalls > 100) {
      this.emitMonitoringEvent('system-alert', {
        message: 'Large call queue detected',
        queuedCalls: this.systemHealth.queuedCalls
      }, 'warning');
    }
  }
  
  /**
   * Register a client for real-time updates
   */
  registerClient(clientId: string, socket: Socket): void {
    this.activeClients.set(clientId, socket);
    logger.info(`Monitoring client registered: ${clientId}`);
    
    // Send initial system health
    socket.emit('system-health', this.systemHealth);
    
    // Send active calls summary
    this.sendActiveCallsSummary(socket);
  }
  
  /**
   * Unregister a client
   */
  unregisterClient(clientId: string): void {
    if (this.activeClients.has(clientId)) {
      this.activeClients.delete(clientId);
      logger.info(`Monitoring client unregistered: ${clientId}`);
    }
  }
  
  /**
   * Send active calls summary to a client
   */
  private async sendActiveCallsSummary(socket: Socket): Promise<void> {
    try {
      // Get active calls
      const activeCalls = await Call.find({
        status: { $in: ['dialing', 'in-progress'] }
      }).sort({ startTime: -1 }).limit(10);
      
      // Send to client
      socket.emit('active-calls', activeCalls.map(call => ({
        id: call._id,
        phoneNumber: call.phoneNumber,
        status: call.status,
        duration: call.duration || 0,
        startTime: call.startTime
      })));
    } catch (error) {
      logger.error('Error sending active calls summary:', error);
    }
  }
  
  /**
   * Emit a monitoring event
   */
  emitMonitoringEvent(
    type: MonitoringEventType, 
    data: any, 
    severity: 'info' | 'warning' | 'error' | 'critical' = 'info'
  ): void {
    const event: MonitoringEvent = {
      type,
      timestamp: new Date(),
      data,
      severity
    };
    
    // Emit internally
    this.emit('monitoring-event', event);
    
    // Broadcast to all connected clients
    for (const socket of this.activeClients.values()) {
      socket.emit('monitoring-event', event);
    }
  }
  
  /**
   * Get current system health metrics
   */
  getSystemHealth(): typeof this.systemHealth {
    return { ...this.systemHealth };
  }
  
  /**
   * Get the count of connected monitoring clients
   */
  getClientCount(): number {
    return this.activeClients.size;
  }
  
  /**
   * Track a call status change
   */
  trackCallStatusChange(callId: string, oldStatus: string, newStatus: string): void {
    this.emitMonitoringEvent('call-status-changed', {
      callId,
      oldStatus,
      newStatus,
      timestamp: new Date()
    });
  }
  
  /**
   * Track a compliance-related event
   */
  trackComplianceEvent(callId: string, event: string, details: any): void {
    this.emitMonitoringEvent('compliance-alert', {
      callId,
      event,
      details
    }, 'warning');
  }
  
  /**
   * Track a rate limit hit
   */
  trackRateLimitHit(resource: string, limit: number, timeWindow: string): void {
    this.emitMonitoringEvent('rate-limit-hit', {
      resource,
      limit,
      timeWindow
    }, 'warning');
  }
  
  /**
   * Track a system error
   */
  trackError(source: string, error: Error, context: any = {}): void {
    this.emitMonitoringEvent('error', {
      source,
      message: error.message,
      stack: error.stack,
      context
    }, 'error');
  }
}

export const callMonitoring = new CallMonitoringService();

export default callMonitoring;
