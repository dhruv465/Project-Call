"use strict";
/**
 * alert_system.ts
 * Handles system alerts and notifications
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.alertSystem = exports.AlertSystem = exports.AlertType = exports.AlertLevel = void 0;
const axios_1 = __importDefault(require("axios"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const util_1 = require("util");
const events_1 = require("events");
const logger_1 = __importDefault(require("../utils/logger"));
const performance_metrics_1 = __importDefault(require("./performance_metrics"));
const writeFileAsync = (0, util_1.promisify)(fs.writeFile);
const mkdirAsync = (0, util_1.promisify)(fs.mkdir);
var AlertLevel;
(function (AlertLevel) {
    AlertLevel["INFO"] = "info";
    AlertLevel["WARNING"] = "warning";
    AlertLevel["CRITICAL"] = "critical";
})(AlertLevel || (exports.AlertLevel = AlertLevel = {}));
var AlertType;
(function (AlertType) {
    AlertType["PERFORMANCE"] = "performance";
    AlertType["SECURITY"] = "security";
    AlertType["SYSTEM"] = "system";
    AlertType["APPLICATION"] = "application";
    AlertType["DATABASE"] = "database";
    AlertType["INTEGRATION"] = "integration";
    AlertType["CUSTOM"] = "custom";
})(AlertType || (exports.AlertType = AlertType = {}));
class AlertSystem {
    constructor() {
        this.events = new events_1.EventEmitter();
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
                minLevel: process.env.MIN_ALERT_LEVEL || AlertLevel.WARNING
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
    static getInstance() {
        if (!AlertSystem.instance) {
            AlertSystem.instance = new AlertSystem();
        }
        return AlertSystem.instance;
    }
    /**
     * Configure the alert system
     */
    configure(config) {
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
        logger_1.default.info('Alert system configuration updated');
    }
    /**
     * Set up performance alert monitoring
     */
    setupPerformanceAlerts() {
        performance_metrics_1.default.onPerformanceAlert((alert) => {
            const alertLevel = alert.level === 'critical'
                ? AlertLevel.CRITICAL
                : AlertLevel.WARNING;
            this.createAlert(alertLevel, AlertType.PERFORMANCE, alert.message, alert);
        });
    }
    /**
     * Create and process a new alert
     */
    createAlert(level, type, message, details, source) {
        // Check if alerts are enabled
        if (!this.config.enabled) {
            logger_1.default.info(`Alert suppressed (alerts disabled): ${level} - ${message}`);
            return null;
        }
        // Apply level filter
        if (this.config.filters?.minLevel) {
            const levels = [AlertLevel.INFO, AlertLevel.WARNING, AlertLevel.CRITICAL];
            const minLevelIndex = levels.indexOf(this.config.filters.minLevel);
            const alertLevelIndex = levels.indexOf(level);
            if (alertLevelIndex < minLevelIndex) {
                logger_1.default.debug(`Alert suppressed (below min level): ${level} - ${message}`);
                return null;
            }
        }
        // Apply type filters
        if (this.config.filters?.includeTypes && this.config.filters.includeTypes.length > 0) {
            if (!this.config.filters.includeTypes.includes(type)) {
                logger_1.default.debug(`Alert suppressed (not in included types): ${type} - ${message}`);
                return null;
            }
        }
        if (this.config.filters?.excludeTypes && this.config.filters.excludeTypes.includes(type)) {
            logger_1.default.debug(`Alert suppressed (in excluded types): ${type} - ${message}`);
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
            logger_1.default.warn(`Alert throttled (max per minute): ${level} - ${message}`);
            return null;
        }
        // Check time between same alert types
        const alertTypeKey = `${type}:${message}`;
        const lastAlertTime = this.lastAlertsByType.get(alertTypeKey);
        if (lastAlertTime && (now - lastAlertTime) < this.config.throttling.minTimeBetweenSameAlerts) {
            logger_1.default.debug(`Alert throttled (too frequent): ${type} - ${message}`);
            return null;
        }
        // Create the alert
        const alert = {
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
            logger_1.default.error(`ALERT: ${message}`, { alert });
        }
        else if (level === AlertLevel.WARNING) {
            logger_1.default.warn(`ALERT: ${message}`, { alert });
        }
        else {
            logger_1.default.info(`ALERT: ${message}`, { alert });
        }
        // Save to history
        this.saveAlertToHistory(alert).catch(err => {
            logger_1.default.error('Failed to save alert to history:', err);
        });
        // Send notifications
        this.sendAlertNotifications(alert).catch(err => {
            logger_1.default.error('Failed to send alert notifications:', err);
        });
        // Emit event
        this.events.emit('new-alert', alert);
        return alert;
    }
    /**
     * Save alert to history file
     */
    async saveAlertToHistory(alert) {
        try {
            const date = new Date();
            const fileName = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}.json`;
            const filePath = path.join(this.alertHistoryPath, fileName);
            const alertJson = JSON.stringify(alert) + '\n';
            if (fs.existsSync(filePath)) {
                fs.appendFileSync(filePath, alertJson);
            }
            else {
                fs.writeFileSync(filePath, alertJson);
            }
        }
        catch (error) {
            logger_1.default.error('Error saving alert to history file:', error);
        }
    }
    /**
     * Send alert notifications to configured channels
     */
    async sendAlertNotifications(alert) {
        try {
            const promises = [];
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
        }
        catch (error) {
            logger_1.default.error('Error sending alert notifications:', error);
        }
    }
    /**
     * Send alert notification to Slack
     */
    async sendSlackNotification(alert) {
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
            await axios_1.default.post(this.config.channels.slack.webhookUrl, message);
            logger_1.default.debug(`Slack notification sent for alert ${alert.id}`);
        }
        catch (error) {
            logger_1.default.error(`Error sending Slack notification for alert ${alert.id}:`, error);
        }
    }
    /**
     * Send alert notification to HTTP webhook
     */
    async sendWebhookNotification(alert) {
        try {
            if (!this.config.channels.webhook?.url) {
                return;
            }
            // Send to webhook
            await axios_1.default.post(this.config.channels.webhook.url, alert, {
                headers: this.config.channels.webhook.headers || {
                    'Content-Type': 'application/json'
                }
            });
            logger_1.default.debug(`Webhook notification sent for alert ${alert.id}`);
        }
        catch (error) {
            logger_1.default.error(`Error sending webhook notification for alert ${alert.id}:`, error);
        }
    }
    /**
     * Send email notification
     * Note: This would need an actual email service implementation
     */
    async sendEmailNotification(alert) {
        // This is a placeholder for email notification implementation
        logger_1.default.debug(`Email notification would be sent for alert ${alert.id}`);
        return Promise.resolve();
    }
    /**
     * Acknowledge an alert
     */
    acknowledgeAlert(alertId, acknowledgedBy) {
        const alertIndex = this.alerts.findIndex(a => a.id === alertId);
        if (alertIndex === -1) {
            return null;
        }
        // Update the alert
        const alert = this.alerts[alertIndex];
        const updatedAlert = {
            ...alert,
            acknowledged: true,
            acknowledgedBy,
            acknowledgedAt: new Date().toISOString()
        };
        // Replace the alert in the array
        this.alerts[alertIndex] = updatedAlert;
        // Log the acknowledgement
        logger_1.default.info(`Alert ${alertId} acknowledged by ${acknowledgedBy}`);
        // Emit event
        this.events.emit('alert-acknowledged', updatedAlert);
        return updatedAlert;
    }
    /**
     * Get all alerts
     */
    getAlerts(filter) {
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
    getAlertById(alertId) {
        return this.alerts.find(a => a.id === alertId) || null;
    }
    /**
     * Subscribe to new alerts
     */
    onNewAlert(listener) {
        this.events.on('new-alert', listener);
    }
    /**
     * Unsubscribe from new alerts
     */
    offNewAlert(listener) {
        this.events.off('new-alert', listener);
    }
    /**
     * Subscribe to alert acknowledgements
     */
    onAlertAcknowledged(listener) {
        this.events.on('alert-acknowledged', listener);
    }
    /**
     * Unsubscribe from alert acknowledgements
     */
    offAlertAcknowledged(listener) {
        this.events.off('alert-acknowledged', listener);
    }
}
exports.AlertSystem = AlertSystem;
// Create and export singleton instance
exports.alertSystem = AlertSystem.getInstance();
exports.default = exports.alertSystem;
//# sourceMappingURL=alert_system.js.map