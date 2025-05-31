/**
 * alert_system.ts
 * Handles system alerts and notifications
 */

import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { EventEmitter } from 'events';
import logger from '../utils/logger';
import performanceMonitor, { PerformanceMetrics } from './performance_metrics';

const writeFileAsync = promisify(fs.writeFile);
const mkdirAsync = promisify(fs.mkdir);

export enum AlertLevel {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical'
}

export enum AlertType {
  PERFORMANCE = 'performance',
  SECURITY = 'security',
  SYSTEM = 'system',
  APPLICATION = 'application',
  DATABASE = 'database',
  INTEGRATION = 'integration',
  CUSTOM = 'custom'
}

export interface Alert {
  id: string;
  level: AlertLevel;
  type: AlertType | string;
  message: string;
  details?: any;
  timestamp: string;
  source?: string;
  acknowledged?: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
}

export interface AlertNotificationConfig {
  enabled: boolean;
  channels: {
    slack?: {
      webhookUrl: string;
      channel?: string;
    };
    email?: {
      recipients: string[];
      fromEmail?: string;
    };
    webhook?: {
      url: string;
      headers?: Record<string, string>;
    };
    sms?: {
      phoneNumbers: string[];
    };
  };
  throttling: {
    maxAlertsPerMinute: number;
    minTimeBetweenSameAlerts: number; // milliseconds
  };
  filters?: {
    minLevel?: AlertLevel;
    includeTypes?: string[];
    excludeTypes?: string[];
  };
}

export class AlertSystem {
  private static instance: AlertSystem;
  private events: EventEmitter;
  private alerts: Alert[];
  private config: AlertNotificationConfig;
  private alertHistoryPath: string;
  private lastAlertsByType: Map<string, number>; // Type -> timestamp
  private alertCountInLastMinute: number;
  private lastMinuteReset: number;

  private constructor() {
    this.events = new EventEmitter();
    this.alerts = [];
    this.lastAlertsByType = new Map();
    this.alertCountInLastMinute = 0;
    this.lastMinuteReset = Date.now();
    
    // Default configuration
    this.config = {
      enabled: process.env.ALERTS_ENABLED === 'true',
      channels: {
        slack: {
          webhookUrl: process.env.ALERT_WEBHOOK_URL || '',
        },
        webhook: {
          url: process.env.ALERT_HTTP_WEBHOOK || '',
        }
      },
      throttling: {
        maxAlertsPerMinute: parseInt(process.env.MAX_ALERTS_PER_MINUTE || '10', 10),
        minTimeBetweenSameAlerts: parseInt(process.env.MIN_TIME_BETWEEN_SAME_ALERTS || '300000', 10) // 5 minutes
      },
      filters: {
        minLevel: process.env.MIN_ALERT_LEVEL as AlertLevel || AlertLevel.WARNING
      }
    };
    
    this.alertHistoryPath = process.env.ALERT_HISTORY_PATH || path.resolve(process.cwd(), 'logs/alerts');
    
    // Ensure alerts directory exists
    if (!fs.existsSync(this.alertHistoryPath)) {
      fs.mkdirSync(this.alertHistoryPath, { recursive: true });
    }
    
    // Register performance monitor alerts
    this.setupPerformanceAlerts();
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): AlertSystem {
    if (!AlertSystem.instance) {
      AlertSystem.instance = new AlertSystem();
    }
    return AlertSystem.instance;
  }

  /**
   * Configure the alert system
   */
  public configure(config: Partial<AlertNotificationConfig>): void {
    this.config = {
      ...this.config,
      ...config,
      channels: {
        ...this.config.channels,
        ...config.channels
      },
      throttling: {
        ...this.config.throttling,
        ...config.throttling
      },
      filters: {
        ...this.config.filters,
        ...config.filters
      }
    };
    
    logger.info('Alert system configuration updated');
  }

  /**
   * Set up performance alert monitoring
   */
  private setupPerformanceAlerts(): void {
    performanceMonitor.onPerformanceAlert((alert) => {
      const alertLevel = alert.level === 'critical' 
        ? AlertLevel.CRITICAL 
        : AlertLevel.WARNING;
      
      this.createAlert(
        alertLevel,
        AlertType.PERFORMANCE,
        alert.message,
        alert
      );
    });
  }

  /**
   * Create and process a new alert
   */
  public createAlert(
    level: AlertLevel,
    type: AlertType | string,
    message: string,
    details?: any,
    source?: string
  ): Alert | null {
    // Check if alerts are enabled
    if (!this.config.enabled) {
      logger.info(`Alert suppressed (alerts disabled): ${level} - ${message}`);
      return null;
    }
    
    // Apply level filter
    if (this.config.filters?.minLevel) {
      const levels = [AlertLevel.INFO, AlertLevel.WARNING, AlertLevel.CRITICAL];
      const minLevelIndex = levels.indexOf(this.config.filters.minLevel);
      const alertLevelIndex = levels.indexOf(level);
      
      if (alertLevelIndex < minLevelIndex) {
        logger.debug(`Alert suppressed (below min level): ${level} - ${message}`);
        return null;
      }
    }
    
    // Apply type filters
    if (this.config.filters?.includeTypes && this.config.filters.includeTypes.length > 0) {
      if (!this.config.filters.includeTypes.includes(type)) {
        logger.debug(`Alert suppressed (not in included types): ${type} - ${message}`);
        return null;
      }
    }
    
    if (this.config.filters?.excludeTypes && this.config.filters.excludeTypes.includes(type)) {
      logger.debug(`Alert suppressed (in excluded types): ${type} - ${message}`);
      return null;
    }
    
    // Apply throttling
    const now = Date.now();
    
    // Reset per-minute counter if needed
    if (now - this.lastMinuteReset > 60000) {
      this.alertCountInLastMinute = 0;
      this.lastMinuteReset = now;
    }
    
    // Check max alerts per minute
    if (this.alertCountInLastMinute >= this.config.throttling.maxAlertsPerMinute) {
      logger.warn(`Alert throttled (max per minute): ${level} - ${message}`);
      return null;
    }
    
    // Check time between same alert types
    const alertTypeKey = `${type}:${message}`;
    const lastAlertTime = this.lastAlertsByType.get(alertTypeKey);
    
    if (lastAlertTime && (now - lastAlertTime) < this.config.throttling.minTimeBetweenSameAlerts) {
      logger.debug(`Alert throttled (too frequent): ${type} - ${message}`);
      return null;
    }
    
    // Create the alert
    const alert: Alert = {
      id: `alert-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      level,
      type,
      message,
      details,
      timestamp: new Date().toISOString(),
      source: source || 'system',
      acknowledged: false
    };
    
    // Update throttling trackers
    this.lastAlertsByType.set(alertTypeKey, now);
    this.alertCountInLastMinute++;
    
    // Store the alert
    this.alerts.push(alert);
    if (this.alerts.length > 1000) {
      this.alerts.shift(); // Limit in-memory alerts
    }
    
    // Log the alert
    if (level === AlertLevel.CRITICAL) {
      logger.error(`ALERT: ${message}`, { alert });
    } else if (level === AlertLevel.WARNING) {
      logger.warn(`ALERT: ${message}`, { alert });
    } else {
      logger.info(`ALERT: ${message}`, { alert });
    }
    
    // Save to history
    this.saveAlertToHistory(alert).catch(err => {
      logger.error('Failed to save alert to history:', err);
    });
    
    // Send notifications
    this.sendAlertNotifications(alert).catch(err => {
      logger.error('Failed to send alert notifications:', err);
    });
    
    // Emit event
    this.events.emit('new-alert', alert);
    
    return alert;
  }

  /**
   * Save alert to history file
   */
  private async saveAlertToHistory(alert: Alert): Promise<void> {
    try {
      const date = new Date();
      const fileName = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}.json`;
      const filePath = path.join(this.alertHistoryPath, fileName);
      
      const alertJson = JSON.stringify(alert) + '\n';
      
      if (fs.existsSync(filePath)) {
        fs.appendFileSync(filePath, alertJson);
      } else {
        fs.writeFileSync(filePath, alertJson);
      }
    } catch (error) {
      logger.error('Error saving alert to history file:', error);
    }
  }

  /**
   * Send alert notifications to configured channels
   */
  private async sendAlertNotifications(alert: Alert): Promise<void> {
    try {
      const promises: Promise<any>[] = [];
      
      // Send to Slack
      if (this.config.channels.slack?.webhookUrl) {
        promises.push(this.sendSlackNotification(alert));
      }
      
      // Send to HTTP webhook
      if (this.config.channels.webhook?.url) {
        promises.push(this.sendWebhookNotification(alert));
      }
      
      // Send to email (would need an email service implementation)
      if (this.config.channels.email?.recipients?.length > 0) {
        promises.push(this.sendEmailNotification(alert));
      }
      
      // Wait for all notifications to be sent
      await Promise.allSettled(promises);
    } catch (error) {
      logger.error('Error sending alert notifications:', error);
    }
  }

  /**
   * Send alert notification to Slack
   */
  private async sendSlackNotification(alert: Alert): Promise<void> {
    try {
      if (!this.config.channels.slack?.webhookUrl) {
        return;
      }
      
      // Format the Slack message
      const color = alert.level === AlertLevel.CRITICAL 
        ? '#FF0000' 
        : alert.level === AlertLevel.WARNING 
          ? '#FFA500' 
          : '#36a64f';
      
      const message = {
        text: `*${alert.level.toUpperCase()} ALERT*: ${alert.message}`,
        attachments: [
          {
            color,
            fields: [
              {
                title: 'Type',
                value: alert.type,
                short: true
              },
              {
                title: 'Time',
                value: new Date(alert.timestamp).toLocaleString(),
                short: true
              },
              {
                title: 'Source',
                value: alert.source || 'system',
                short: true
              },
              {
                title: 'Alert ID',
                value: alert.id,
                short: true
              }
            ],
            footer: 'Voice AI Monitoring System'
          }
        ]
      };
      
      // If there are details, add them
      if (alert.details) {
        message.attachments[0].fields.push({
          title: 'Details',
          value: typeof alert.details === 'object' 
            ? JSON.stringify(alert.details, null, 2) 
            : String(alert.details),
          short: false
        });
      }
      
      // Send to Slack
      await axios.post(this.config.channels.slack.webhookUrl, message);
      
      logger.debug(`Slack notification sent for alert ${alert.id}`);
    } catch (error) {
      logger.error(`Error sending Slack notification for alert ${alert.id}:`, error);
    }
  }

  /**
   * Send alert notification to HTTP webhook
   */
  private async sendWebhookNotification(alert: Alert): Promise<void> {
    try {
      if (!this.config.channels.webhook?.url) {
        return;
      }
      
      // Send to webhook
      await axios.post(
        this.config.channels.webhook.url,
        alert,
        {
          headers: this.config.channels.webhook.headers || {
            'Content-Type': 'application/json'
          }
        }
      );
      
      logger.debug(`Webhook notification sent for alert ${alert.id}`);
    } catch (error) {
      logger.error(`Error sending webhook notification for alert ${alert.id}:`, error);
    }
  }

  /**
   * Send email notification
   * Note: This would need an actual email service implementation
   */
  private async sendEmailNotification(alert: Alert): Promise<void> {
    // This is a placeholder for email notification implementation
    logger.debug(`Email notification would be sent for alert ${alert.id}`);
    return Promise.resolve();
  }

  /**
   * Acknowledge an alert
   */
  public acknowledgeAlert(alertId: string, acknowledgedBy: string): Alert | null {
    const alertIndex = this.alerts.findIndex(a => a.id === alertId);
    
    if (alertIndex === -1) {
      return null;
    }
    
    // Update the alert
    const alert = this.alerts[alertIndex];
    const updatedAlert: Alert = {
      ...alert,
      acknowledged: true,
      acknowledgedBy,
      acknowledgedAt: new Date().toISOString()
    };
    
    // Replace the alert in the array
    this.alerts[alertIndex] = updatedAlert;
    
    // Log the acknowledgement
    logger.info(`Alert ${alertId} acknowledged by ${acknowledgedBy}`);
    
    // Emit event
    this.events.emit('alert-acknowledged', updatedAlert);
    
    return updatedAlert;
  }

  /**
   * Get all alerts
   */
  public getAlerts(filter?: {
    level?: AlertLevel;
    type?: string;
    acknowledged?: boolean;
    since?: Date;
    limit?: number;
  }): Alert[] {
    let filteredAlerts = [...this.alerts];
    
    // Apply filters
    if (filter) {
      if (filter.level) {
        filteredAlerts = filteredAlerts.filter(a => a.level === filter.level);
      }
      
      if (filter.type) {
        filteredAlerts = filteredAlerts.filter(a => a.type === filter.type);
      }
      
      if (filter.acknowledged !== undefined) {
        filteredAlerts = filteredAlerts.filter(a => a.acknowledged === filter.acknowledged);
      }
      
      if (filter.since) {
        filteredAlerts = filteredAlerts.filter(a => new Date(a.timestamp) >= filter.since);
      }
      
      // Sort by timestamp (newest first)
      filteredAlerts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      // Apply limit
      if (filter.limit) {
        filteredAlerts = filteredAlerts.slice(0, filter.limit);
      }
    }
    
    return filteredAlerts;
  }

  /**
   * Get a specific alert by ID
   */
  public getAlertById(alertId: string): Alert | null {
    return this.alerts.find(a => a.id === alertId) || null;
  }

  /**
   * Subscribe to new alerts
   */
  public onNewAlert(listener: (alert: Alert) => void): void {
    this.events.on('new-alert', listener);
  }

  /**
   * Unsubscribe from new alerts
   */
  public offNewAlert(listener: (alert: Alert) => void): void {
    this.events.off('new-alert', listener);
  }

  /**
   * Subscribe to alert acknowledgements
   */
  public onAlertAcknowledged(listener: (alert: Alert) => void): void {
    this.events.on('alert-acknowledged', listener);
  }

  /**
   * Unsubscribe from alert acknowledgements
   */
  public offAlertAcknowledged(listener: (alert: Alert) => void): void {
    this.events.off('alert-acknowledged', listener);
  }
}

// Create and export singleton instance
export const alertSystem = AlertSystem.getInstance();
export default alertSystem;