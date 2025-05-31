/**
 * audit_service.ts
 * Provides comprehensive audit trails for system activities
 */
import { Request, Response, NextFunction } from 'express';
export declare enum AuditEventType {
    LOGIN = "LOGIN",
    LOGOUT = "LOGOUT",
    LOGIN_FAILED = "LOGIN_FAILED",
    PASSWORD_CHANGED = "PASSWORD_CHANGED",
    ACCOUNT_LOCKED = "ACCOUNT_LOCKED",
    ACCOUNT_UNLOCKED = "ACCOUNT_UNLOCKED",
    DATA_ACCESS = "DATA_ACCESS",
    DATA_EXPORT = "DATA_EXPORT",
    DATA_IMPORT = "DATA_IMPORT",
    DATA_CREATE = "DATA_CREATE",
    DATA_UPDATE = "DATA_UPDATE",
    DATA_DELETE = "DATA_DELETE",
    CALL_INITIATED = "CALL_INITIATED",
    CALL_CONNECTED = "CALL_CONNECTED",
    CALL_DISCONNECTED = "CALL_DISCONNECTED",
    CALL_RECORDED = "CALL_RECORDED",
    SYSTEM_STARTUP = "SYSTEM_STARTUP",
    SYSTEM_SHUTDOWN = "SYSTEM_SHUTDOWN",
    CONFIG_CHANGED = "CONFIG_CHANGED",
    BACKUP_CREATED = "BACKUP_CREATED",
    MODEL_DEPLOYED = "MODEL_DEPLOYED",
    PERMISSION_CHANGED = "PERMISSION_CHANGED",
    API_KEY_CREATED = "API_KEY_CREATED",
    API_KEY_REVOKED = "API_KEY_REVOKED",
    SECURITY_VIOLATION = "SECURITY_VIOLATION",
    CUSTOM = "CUSTOM"
}
export interface AuditEvent {
    id: string;
    timestamp: string;
    type: AuditEventType | string;
    userId?: string;
    username?: string;
    ipAddress?: string;
    userAgent?: string;
    resourceType?: string;
    resourceId?: string;
    action?: string;
    details?: any;
    status?: 'success' | 'failure' | 'warning';
    sessionId?: string;
    requestId?: string;
}
export declare class AuditService {
    private static instance;
    private enabled;
    private auditLogDir;
    private logToConsole;
    private isAsyncMode;
    private auditQueue;
    private processingQueue;
    private constructor();
    /**
     * Get the singleton instance
     */
    static getInstance(): AuditService;
    /**
     * Configure the audit service
     */
    configure(options: {
        enabled?: boolean;
        auditLogDir?: string;
        logToConsole?: boolean;
        isAsyncMode?: boolean;
    }): void;
    /**
     * Log an audit event
     */
    log(eventType: AuditEventType | string, details: Omit<AuditEvent, 'id' | 'timestamp' | 'type'>): string;
    /**
     * Start processing the audit queue
     */
    private startQueueProcessing;
    /**
     * Process audit events in the queue
     */
    private processAuditQueue;
    /**
     * Write events to the appropriate date-based file
     */
    private writeEventsToFile;
    /**
     * Write an audit event synchronously
     */
    private writeAuditLog;
    /**
     * Create an audit middleware for Express
     */
    createMiddleware(options?: {
        excludePaths?: string[];
        sensitiveParams?: string[];
        sensitiveHeaders?: string[];
        resourceTypeExtractor?: (req: Request) => string;
        resourceIdExtractor?: (req: Request) => string;
    }): (req: Request, res: Response, next: NextFunction) => void;
    /**
     * Extract resource type from request
     */
    private extractResourceType;
    /**
     * Extract resource ID from request
     */
    private extractResourceId;
    /**
     * Sanitize request details to remove sensitive information
     */
    private sanitizeRequestDetails;
    /**
     * Recursively redact sensitive fields in an object
     */
    private redactSensitiveFields;
    /**
     * Get audit logs for a specific date range
     */
    getAuditLogs(options: {
        startDate: Date;
        endDate: Date;
        type?: AuditEventType | string;
        userId?: string;
        resourceType?: string;
        resourceId?: string;
        status?: 'success' | 'failure' | 'warning';
        limit?: number;
    }): Promise<AuditEvent[]>;
    /**
     * Log a system startup event
     */
    logSystemStartup(details?: any): string;
    /**
     * Log a system shutdown event
     */
    logSystemShutdown(details?: any): string;
    /**
     * Log a security violation event
     */
    logSecurityViolation(details: {
        userId?: string;
        username?: string;
        ipAddress?: string;
        userAgent?: string;
        violationType: string;
        description: string;
        resourceType?: string;
        resourceId?: string;
        [key: string]: any;
    }): string;
}
export declare const auditService: AuditService;
export default auditService;
