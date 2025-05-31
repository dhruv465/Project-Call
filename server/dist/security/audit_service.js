"use strict";
/**
 * audit_service.ts
 * Provides comprehensive audit trails for system activities
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
exports.auditService = exports.AuditService = exports.AuditEventType = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const util_1 = require("util");
const uuid = __importStar(require("uuid"));
const logger_1 = __importDefault(require("../utils/logger"));
const writeFileAsync = (0, util_1.promisify)(fs.writeFile);
const appendFileAsync = (0, util_1.promisify)(fs.appendFile);
const mkdirAsync = (0, util_1.promisify)(fs.mkdir);
var AuditEventType;
(function (AuditEventType) {
    // Authentication events
    AuditEventType["LOGIN"] = "LOGIN";
    AuditEventType["LOGOUT"] = "LOGOUT";
    AuditEventType["LOGIN_FAILED"] = "LOGIN_FAILED";
    AuditEventType["PASSWORD_CHANGED"] = "PASSWORD_CHANGED";
    AuditEventType["ACCOUNT_LOCKED"] = "ACCOUNT_LOCKED";
    AuditEventType["ACCOUNT_UNLOCKED"] = "ACCOUNT_UNLOCKED";
    // Data access events
    AuditEventType["DATA_ACCESS"] = "DATA_ACCESS";
    AuditEventType["DATA_EXPORT"] = "DATA_EXPORT";
    AuditEventType["DATA_IMPORT"] = "DATA_IMPORT";
    // Data modification events
    AuditEventType["DATA_CREATE"] = "DATA_CREATE";
    AuditEventType["DATA_UPDATE"] = "DATA_UPDATE";
    AuditEventType["DATA_DELETE"] = "DATA_DELETE";
    // Call-related events
    AuditEventType["CALL_INITIATED"] = "CALL_INITIATED";
    AuditEventType["CALL_CONNECTED"] = "CALL_CONNECTED";
    AuditEventType["CALL_DISCONNECTED"] = "CALL_DISCONNECTED";
    AuditEventType["CALL_RECORDED"] = "CALL_RECORDED";
    // System events
    AuditEventType["SYSTEM_STARTUP"] = "SYSTEM_STARTUP";
    AuditEventType["SYSTEM_SHUTDOWN"] = "SYSTEM_SHUTDOWN";
    AuditEventType["CONFIG_CHANGED"] = "CONFIG_CHANGED";
    AuditEventType["BACKUP_CREATED"] = "BACKUP_CREATED";
    AuditEventType["MODEL_DEPLOYED"] = "MODEL_DEPLOYED";
    // Security events
    AuditEventType["PERMISSION_CHANGED"] = "PERMISSION_CHANGED";
    AuditEventType["API_KEY_CREATED"] = "API_KEY_CREATED";
    AuditEventType["API_KEY_REVOKED"] = "API_KEY_REVOKED";
    AuditEventType["SECURITY_VIOLATION"] = "SECURITY_VIOLATION";
    // Other events
    AuditEventType["CUSTOM"] = "CUSTOM";
})(AuditEventType || (exports.AuditEventType = AuditEventType = {}));
class AuditService {
    constructor() {
        this.auditQueue = [];
        this.processingQueue = false;
        this.enabled = process.env.AUDIT_ENABLED === 'true';
        this.auditLogDir = process.env.AUDIT_LOG_DIR || path.resolve(process.cwd(), 'logs/audit');
        this.logToConsole = process.env.AUDIT_LOG_TO_CONSOLE === 'true';
        this.isAsyncMode = process.env.AUDIT_ASYNC_MODE === 'true';
        // Ensure audit log directory exists
        if (this.enabled && !fs.existsSync(this.auditLogDir)) {
            fs.mkdirSync(this.auditLogDir, { recursive: true });
        }
        // Start processing queue if in async mode
        if (this.isAsyncMode) {
            this.startQueueProcessing();
        }
    }
    /**
     * Get the singleton instance
     */
    static getInstance() {
        if (!AuditService.instance) {
            AuditService.instance = new AuditService();
        }
        return AuditService.instance;
    }
    /**
     * Configure the audit service
     */
    configure(options) {
        if (options.enabled !== undefined) {
            this.enabled = options.enabled;
        }
        if (options.auditLogDir) {
            this.auditLogDir = options.auditLogDir;
            // Ensure new audit log directory exists
            if (this.enabled && !fs.existsSync(this.auditLogDir)) {
                fs.mkdirSync(this.auditLogDir, { recursive: true });
            }
        }
        if (options.logToConsole !== undefined) {
            this.logToConsole = options.logToConsole;
        }
        if (options.isAsyncMode !== undefined) {
            this.isAsyncMode = options.isAsyncMode;
            // Start queue processing if switching to async mode
            if (this.isAsyncMode && !this.processingQueue) {
                this.startQueueProcessing();
            }
        }
        logger_1.default.info('Audit service configuration updated');
    }
    /**
     * Log an audit event
     */
    log(eventType, details) {
        if (!this.enabled) {
            return '';
        }
        const auditEvent = {
            id: uuid.v4(),
            timestamp: new Date().toISOString(),
            type: eventType,
            ...details
        };
        if (this.isAsyncMode) {
            // Add to queue for async processing
            this.auditQueue.push(auditEvent);
        }
        else {
            // Process immediately
            this.writeAuditLog(auditEvent);
        }
        return auditEvent.id;
    }
    /**
     * Start processing the audit queue
     */
    startQueueProcessing() {
        if (this.processingQueue) {
            return;
        }
        this.processingQueue = true;
        // Process queue every second
        setInterval(() => {
            this.processAuditQueue();
        }, 1000);
        logger_1.default.debug('Audit queue processing started');
    }
    /**
     * Process audit events in the queue
     */
    async processAuditQueue() {
        if (this.auditQueue.length === 0) {
            return;
        }
        // Take events from the queue (limited batch size)
        const batchSize = 100;
        const events = this.auditQueue.splice(0, batchSize);
        // Group events by date for file organization
        const eventsByDate = new Map();
        for (const event of events) {
            const date = event.timestamp.split('T')[0]; // YYYY-MM-DD
            if (!eventsByDate.has(date)) {
                eventsByDate.set(date, []);
            }
            eventsByDate.get(date).push(event);
        }
        // Write events to appropriate files
        for (const [date, dateEvents] of eventsByDate.entries()) {
            try {
                await this.writeEventsToFile(date, dateEvents);
            }
            catch (error) {
                logger_1.default.error(`Failed to write audit events for ${date}:`, error);
                // Put events back in the queue
                this.auditQueue.unshift(...dateEvents);
            }
        }
    }
    /**
     * Write events to the appropriate date-based file
     */
    async writeEventsToFile(date, events) {
        const filePath = path.join(this.auditLogDir, `audit-${date}.jsonl`);
        try {
            // Create events as newline-delimited JSON
            const eventsData = events
                .map(event => JSON.stringify(event))
                .join('\n') + '\n';
            // Append to file
            await appendFileAsync(filePath, eventsData);
        }
        catch (error) {
            if (error.code === 'ENOENT') {
                // File doesn't exist, create it
                await writeFileAsync(filePath, events.map(event => JSON.stringify(event)).join('\n') + '\n');
            }
            else {
                throw error;
            }
        }
    }
    /**
     * Write an audit event synchronously
     */
    writeAuditLog(event) {
        try {
            const date = event.timestamp.split('T')[0]; // YYYY-MM-DD
            const filePath = path.join(this.auditLogDir, `audit-${date}.jsonl`);
            // Log to console if enabled
            if (this.logToConsole) {
                const logLevel = event.status === 'failure' ? 'error' : 'info';
                logger_1.default[logLevel](`AUDIT: ${event.type}`, { audit: event });
            }
            // Write to file
            const eventData = JSON.stringify(event) + '\n';
            if (fs.existsSync(filePath)) {
                fs.appendFileSync(filePath, eventData);
            }
            else {
                fs.writeFileSync(filePath, eventData);
            }
        }
        catch (error) {
            logger_1.default.error('Failed to write audit log:', error);
        }
    }
    /**
     * Create an audit middleware for Express
     */
    createMiddleware(options = {}) {
        return (req, res, next) => {
            if (!this.enabled) {
                return next();
            }
            // Skip excluded paths
            if (options.excludePaths && options.excludePaths.some(path => req.path.startsWith(path))) {
                return next();
            }
            // Generate request ID if not already present
            const requestId = req.headers['x-request-id'] || uuid.v4();
            req.headers['x-request-id'] = requestId;
            // Extract user information
            const userId = req.user?.id || '';
            const username = req.user?.username || '';
            // Extract resource information
            const resourceType = options.resourceTypeExtractor
                ? options.resourceTypeExtractor(req)
                : this.extractResourceType(req);
            const resourceId = options.resourceIdExtractor
                ? options.resourceIdExtractor(req)
                : this.extractResourceId(req);
            // Create sanitized request details
            const requestDetails = this.sanitizeRequestDetails(req, options.sensitiveParams, options.sensitiveHeaders);
            // Determine action from method
            const action = req.method;
            // Create base audit event
            const baseEvent = {
                userId,
                username,
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
                resourceType,
                resourceId,
                action,
                details: { request: requestDetails },
                requestId,
                sessionId: req.sessionID || ''
            };
            // Capture original status code send method
            const originalSend = res.send;
            // Override send method to capture response
            res.send = function (body) {
                // Restore original functionality
                res.send = originalSend;
                // Determine event type based on method and status code
                let eventType;
                switch (req.method) {
                    case 'GET':
                        eventType = AuditEventType.DATA_ACCESS;
                        break;
                    case 'POST':
                        eventType = AuditEventType.DATA_CREATE;
                        break;
                    case 'PUT':
                    case 'PATCH':
                        eventType = AuditEventType.DATA_UPDATE;
                        break;
                    case 'DELETE':
                        eventType = AuditEventType.DATA_DELETE;
                        break;
                    default:
                        eventType = AuditEventType.CUSTOM;
                }
                // Add response details
                const status = res.statusCode < 400 ? 'success' : 'failure';
                const responseDetails = {
                    statusCode: res.statusCode,
                    statusMessage: res.statusMessage
                };
                // Log audit event
                AuditService.getInstance().log(eventType, {
                    ...baseEvent,
                    status,
                    details: {
                        ...baseEvent.details,
                        response: responseDetails
                    }
                });
                // Call original send
                return originalSend.call(this, body);
            };
            next();
        };
    }
    /**
     * Extract resource type from request
     */
    extractResourceType(req) {
        // Try to extract from path
        const pathParts = req.path.split('/').filter(Boolean);
        if (pathParts.length > 0) {
            // Handle common API patterns
            if (pathParts[0] === 'api' && pathParts.length > 1) {
                return pathParts[1];
            }
            return pathParts[0];
        }
        return 'unknown';
    }
    /**
     * Extract resource ID from request
     */
    extractResourceId(req) {
        // Try to extract from path
        const pathParts = req.path.split('/').filter(Boolean);
        // Look for ID pattern in path
        for (let i = 1; i < pathParts.length; i++) {
            const part = pathParts[i];
            // If previous part is likely a resource type and current part looks like an ID
            if (pathParts[i - 1] && !pathParts[i - 1].includes('.') &&
                (part.match(/^[a-f0-9-]{36}$/i) || // UUID pattern
                    part.match(/^[a-f0-9]{24}$/i) || // MongoDB ObjectId pattern
                    part.match(/^\d+$/))) { // Numeric ID pattern
                return part;
            }
        }
        // Check for ID in query params
        if (req.query.id) {
            return req.query.id;
        }
        // Check for ID in body
        if (req.body && req.body.id) {
            return req.body.id;
        }
        return '';
    }
    /**
     * Sanitize request details to remove sensitive information
     */
    sanitizeRequestDetails(req, sensitiveParams = [], sensitiveHeaders = []) {
        // Default sensitive parameters
        const defaultSensitiveParams = [
            'password', 'passwordConfirmation', 'token', 'apiKey',
            'secret', 'accessToken', 'refreshToken', 'creditCard',
            'cardNumber', 'cvv', 'ssn', 'socialSecurity'
        ];
        // Default sensitive headers
        const defaultSensitiveHeaders = [
            'authorization', 'x-api-key', 'cookie', 'set-cookie',
            'x-auth-token', 'x-access-token', 'refresh-token'
        ];
        // Combine defaults with custom lists
        const allSensitiveParams = [...defaultSensitiveParams, ...sensitiveParams];
        const allSensitiveHeaders = [...defaultSensitiveHeaders, ...sensitiveHeaders];
        // Sanitize query parameters
        const sanitizedQuery = { ...req.query };
        for (const param of allSensitiveParams) {
            if (sanitizedQuery[param]) {
                sanitizedQuery[param] = '***REDACTED***';
            }
        }
        // Sanitize body
        let sanitizedBody = null;
        if (req.body) {
            sanitizedBody = { ...req.body };
            this.redactSensitiveFields(sanitizedBody, allSensitiveParams);
        }
        // Sanitize headers
        const sanitizedHeaders = {};
        for (const [key, value] of Object.entries(req.headers)) {
            if (allSensitiveHeaders.includes(key.toLowerCase())) {
                sanitizedHeaders[key] = '***REDACTED***';
            }
            else {
                sanitizedHeaders[key] = value;
            }
        }
        return {
            method: req.method,
            path: req.path,
            query: sanitizedQuery,
            body: sanitizedBody,
            headers: sanitizedHeaders
        };
    }
    /**
     * Recursively redact sensitive fields in an object
     */
    redactSensitiveFields(obj, sensitiveFields) {
        if (!obj || typeof obj !== 'object') {
            return;
        }
        for (const key of Object.keys(obj)) {
            if (sensitiveFields.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
                obj[key] = '***REDACTED***';
            }
            else if (typeof obj[key] === 'object') {
                this.redactSensitiveFields(obj[key], sensitiveFields);
            }
        }
    }
    /**
     * Get audit logs for a specific date range
     */
    async getAuditLogs(options) {
        if (!this.enabled) {
            return [];
        }
        const { startDate, endDate, type, userId, resourceType, resourceId, status, limit } = options;
        // Generate date range
        const dates = [];
        const currentDate = new Date(startDate);
        while (currentDate <= endDate) {
            dates.push(currentDate.toISOString().split('T')[0]);
            currentDate.setDate(currentDate.getDate() + 1);
        }
        // Collect events from each date file
        const allEvents = [];
        for (const date of dates) {
            const filePath = path.join(this.auditLogDir, `audit-${date}.jsonl`);
            if (!fs.existsSync(filePath)) {
                continue;
            }
            try {
                const fileContent = await (0, util_1.promisify)(fs.readFile)(filePath, 'utf8');
                const lines = fileContent.split('\n').filter(Boolean);
                for (const line of lines) {
                    try {
                        const event = JSON.parse(line);
                        // Apply filters
                        if (type && event.type !== type)
                            continue;
                        if (userId && event.userId !== userId)
                            continue;
                        if (resourceType && event.resourceType !== resourceType)
                            continue;
                        if (resourceId && event.resourceId !== resourceId)
                            continue;
                        if (status && event.status !== status)
                            continue;
                        allEvents.push(event);
                        // Apply limit if needed
                        if (limit && allEvents.length >= limit) {
                            return allEvents;
                        }
                    }
                    catch (parseError) {
                        logger_1.default.error(`Failed to parse audit log entry: ${line}`, parseError);
                    }
                }
            }
            catch (error) {
                logger_1.default.error(`Failed to read audit log file ${filePath}:`, error);
            }
        }
        // Sort by timestamp (newest first)
        allEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        // Apply limit if needed
        return limit ? allEvents.slice(0, limit) : allEvents;
    }
    /**
     * Log a system startup event
     */
    logSystemStartup(details) {
        return this.log(AuditEventType.SYSTEM_STARTUP, {
            details: {
                version: process.env.npm_package_version,
                nodeVersion: process.version,
                environment: process.env.NODE_ENV,
                ...details
            },
            status: 'success'
        });
    }
    /**
     * Log a system shutdown event
     */
    logSystemShutdown(details) {
        return this.log(AuditEventType.SYSTEM_SHUTDOWN, {
            details: {
                uptime: process.uptime(),
                ...details
            },
            status: 'success'
        });
    }
    /**
     * Log a security violation event
     */
    logSecurityViolation(details) {
        return this.log(AuditEventType.SECURITY_VIOLATION, {
            userId: details.userId,
            username: details.username,
            ipAddress: details.ipAddress,
            userAgent: details.userAgent,
            resourceType: details.resourceType,
            resourceId: details.resourceId,
            details: {
                violationType: details.violationType,
                description: details.description,
                ...details
            },
            status: 'failure'
        });
    }
}
exports.AuditService = AuditService;
// Create and export singleton instance
exports.auditService = AuditService.getInstance();
exports.default = exports.auditService;
//# sourceMappingURL=audit_service.js.map