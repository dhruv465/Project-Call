/**
 * performance_metrics.ts
 * Monitors and tracks performance metrics for the application
 */
import { Request, Response, NextFunction } from 'express';
export interface PerformanceMetrics {
    cpuUsage: number;
    memoryUsage: {
        heapTotal: number;
        heapUsed: number;
        rss: number;
        external: number;
        arrayBuffers: number;
        percentUsed: number;
    };
    systemMemory: {
        total: number;
        free: number;
        percentUsed: number;
    };
    eventLoopLag: number;
    uptime: number;
    requestRate: number;
    responseTimes: {
        avg: number;
        min: number;
        max: number;
        p95: number;
    };
    activeConnections: number;
    errorRate: number;
    timestamp: string;
}
export declare class PerformanceMonitor {
    private static instance;
    private metrics;
    private events;
    private responseTimeTracker;
    private requestCounter;
    private errorCounter;
    private intervalId;
    private reportingIntervalId;
    private activeConnections;
    private metricsHistory;
    private readonly maxHistoryItems;
    private readonly thresholds;
    private metricsPath;
    private constructor();
    /**
     * Get the singleton instance
     */
    static getInstance(): PerformanceMonitor;
    /**
     * Initialize the metrics object with default values
     */
    private initializeMetrics;
    /**
     * Start monitoring performance metrics
     */
    start(interval?: number): void;
    /**
     * Stop monitoring
     */
    stop(): void;
    /**
     * Collect current performance metrics
     */
    private collectMetrics;
    /**
     * Get CPU usage percentage
     */
    private getCpuUsage;
    /**
     * Measure event loop lag
     */
    private measureEventLoopLag;
    /**
     * Calculate response time statistics
     */
    private calculateResponseTimes;
    /**
     * Check for threshold violations
     */
    private checkThresholds;
    /**
     * Emit performance alert
     */
    private emitAlert;
    /**
     * Save metrics to file
     */
    private saveMetricsToFile;
    /**
     * Generate and save a performance report
     */
    private reportMetrics;
    /**
     * Middleware to track request/response metrics
     */
    metricsMiddleware(): (req: Request, res: Response, next: NextFunction) => void;
    /**
     * Get the current metrics
     */
    getMetrics(): PerformanceMetrics;
    /**
     * Get historical metrics
     */
    getMetricsHistory(): PerformanceMetrics[];
    /**
     * Subscribe to metrics updates
     */
    onMetricsUpdated(listener: (metrics: PerformanceMetrics) => void): void;
    /**
     * Unsubscribe from metrics updates
     */
    offMetricsUpdated(listener: (metrics: PerformanceMetrics) => void): void;
    /**
     * Subscribe to performance alerts
     */
    onPerformanceAlert(listener: (alert: any) => void): void;
    /**
     * Unsubscribe from performance alerts
     */
    offPerformanceAlert(listener: (alert: any) => void): void;
}
export declare const performanceMonitor: PerformanceMonitor;
export default performanceMonitor;
