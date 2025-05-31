/**
 * alert_system.ts
 * Handles system alerts and notifications
 */
export declare enum AlertLevel {
    INFO = "info",
    WARNING = "warning",
    CRITICAL = "critical"
}
export declare enum AlertType {
    PERFORMANCE = "performance",
    SECURITY = "security",
    SYSTEM = "system",
    APPLICATION = "application",
    DATABASE = "database",
    INTEGRATION = "integration",
    CUSTOM = "custom"
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
        minTimeBetweenSameAlerts: number;
    };
    filters?: {
        minLevel?: AlertLevel;
        includeTypes?: string[];
        excludeTypes?: string[];
    };
}
export declare class AlertSystem {
    private static instance;
    private events;
    private alerts;
    private config;
    private alertHistoryPath;
    private lastAlertsByType;
    private alertCountInLastMinute;
    private lastMinuteReset;
    private constructor();
    /**
     * Get the singleton instance
     */
    static getInstance(): AlertSystem;
    /**
     * Configure the alert system
     */
    configure(config: Partial<AlertNotificationConfig>): void;
    /**
     * Set up performance alert monitoring
     */
    private setupPerformanceAlerts;
    /**
     * Create and process a new alert
     */
    createAlert(level: AlertLevel, type: AlertType | string, message: string, details?: any, source?: string): Alert | null;
    /**
     * Save alert to history file
     */
    private saveAlertToHistory;
    /**
     * Send alert notifications to configured channels
     */
    private sendAlertNotifications;
    /**
     * Send alert notification to Slack
     */
    private sendSlackNotification;
    /**
     * Send alert notification to HTTP webhook
     */
    private sendWebhookNotification;
    /**
     * Send email notification
     * Note: This would need an actual email service implementation
     */
    private sendEmailNotification;
    /**
     * Acknowledge an alert
     */
    acknowledgeAlert(alertId: string, acknowledgedBy: string): Alert | null;
    /**
     * Get all alerts
     */
    getAlerts(filter?: {
        level?: AlertLevel;
        type?: string;
        acknowledged?: boolean;
        since?: Date;
        limit?: number;
    }): Alert[];
    /**
     * Get a specific alert by ID
     */
    getAlertById(alertId: string): Alert | null;
    /**
     * Subscribe to new alerts
     */
    onNewAlert(listener: (alert: Alert) => void): void;
    /**
     * Unsubscribe from new alerts
     */
    offNewAlert(listener: (alert: Alert) => void): void;
    /**
     * Subscribe to alert acknowledgements
     */
    onAlertAcknowledged(listener: (alert: Alert) => void): void;
    /**
     * Unsubscribe from alert acknowledgements
     */
    offAlertAcknowledged(listener: (alert: Alert) => void): void;
}
export declare const alertSystem: AlertSystem;
export default alertSystem;
