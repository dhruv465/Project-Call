/**
 * production.ts
 * Production environment configuration
 */
declare const config: {
    environment: string;
    database: {
        url: string;
        ssl: boolean;
        connectionPoolSize: number;
        connectionTimeout: number;
        retryAttempts: number;
    };
    server: {
        port: number;
        host: string;
        apiPrefix: string;
        corsOrigin: string;
        jwtSecret: string;
        jwtExpiration: string;
        rateLimitWindow: number;
        rateLimitMaxRequests: number;
        trustProxy: boolean;
        uploadDir: string;
        tempDir: string;
    };
    logging: {
        level: string;
        file: boolean;
        logDir: string;
        maxSize: string;
        maxFiles: number;
        errorFile: string;
        combinedFile: string;
        sentryDsn: string;
        sentryEnvironment: string;
    };
    telephony: {
        accountSid: string;
        authToken: string;
        phoneNumbers: string[];
        defaultNumber: string;
        webhookBaseUrl: string;
        recordCalls: boolean;
        fallbackEnabled: boolean;
    };
    speech: {
        provider: string;
        apiKey: string;
        outputDir: string;
        fallbackEnabled: boolean;
        defaultVoiceId: string;
    };
    ml: {
        modelsDir: string;
        cachingEnabled: boolean;
        batchSize: number;
        tensorflowMaxThreads: number;
        emotionEnabled: boolean;
    };
    redis: {
        enabled: boolean;
        url: string;
        password: string;
        cacheTTL: number;
    };
    monitoring: {
        enabled: boolean;
        prometheusEnabled: boolean;
        healthCheckInterval: number;
        alertsEnabled: boolean;
        alertWebhookUrl: string;
        performanceThresholds: {
            cpuWarning: number;
            cpuCritical: number;
            memoryWarning: number;
            memoryCritical: number;
            apiLatencyWarning: number;
            apiLatencyCritical: number;
        };
    };
    crm: {
        provider: string;
        apiKey: string;
        apiUrl: string;
        syncEnabled: boolean;
        syncInterval: number;
        maxRetries: number;
    };
    security: {
        encryptionKey: string;
        encryptSensitiveData: boolean;
        csrfProtection: boolean;
        securityHeaders: boolean;
        apiKeyAuth: boolean;
        jwtAuth: boolean;
        auditEnabled: boolean;
        auditLogDir: string;
    };
};
export default config;
