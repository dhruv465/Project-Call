"use strict";
/**
 * performance_metrics.ts
 * Monitors and tracks performance metrics for the application
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.performanceMonitor = exports.PerformanceMonitor = void 0;
const os = __importStar(require("os"));
const process = __importStar(require("process"));
const fs = __importStar(require("fs"));
const events_1 = require("events");
const util_1 = require("util");
const logger_1 = __importStar(require("../utils/logger"));
const fsWrite = (0, util_1.promisify)(fs.writeFile);
const fsAppend = (0, util_1.promisify)(fs.appendFile);
const fsMkdir = (0, util_1.promisify)(fs.mkdir);
class PerformanceMonitor {
    constructor() {
        this.metrics = this.initializeMetrics();
        this.events = new events_1.EventEmitter();
        this.responseTimeTracker = new Map();
        this.requestCounter = 0;
        this.errorCounter = 0;
        this.activeConnections = 0;
        this.intervalId = null;
        this.reportingIntervalId = null;
        this.metricsHistory = [];
        this.maxHistoryItems = 1000; // Keep last 1000 metrics readings
        this.thresholds = {
            cpu: {
                warning: parseFloat(process.env.CPU_WARNING_THRESHOLD || '70'),
                critical: parseFloat(process.env.CPU_CRITICAL_THRESHOLD || '90')
            },
            memory: {
                warning: parseFloat(process.env.MEMORY_WARNING_THRESHOLD || '70'),
                critical: parseFloat(process.env.MEMORY_CRITICAL_THRESHOLD || '90')
            },
            responseTime: {
                warning: parseInt(process.env.API_LATENCY_WARNING || '2000', 10),
                critical: parseInt(process.env.API_LATENCY_CRITICAL || '5000', 10)
            }
        };
        this.metricsPath = process.env.METRICS_PATH || './metrics';
        // Ensure metrics directory exists
        if (!fs.existsSync(this.metricsPath)) {
            fs.mkdirSync(this.metricsPath, { recursive: true });
        }
    }
    /**
     * Get the singleton instance
     */
    static getInstance() {
        if (!PerformanceMonitor.instance) {
            PerformanceMonitor.instance = new PerformanceMonitor();
        }
        return PerformanceMonitor.instance;
    }
    /**
     * Initialize the metrics object with default values
     */
    initializeMetrics() {
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const memoryInfo = process.memoryUsage();
        return {
            cpuUsage: 0,
            memoryUsage: {
                heapTotal: memoryInfo.heapTotal / 1024 / 1024,
                heapUsed: memoryInfo.heapUsed / 1024 / 1024,
                rss: memoryInfo.rss / 1024 / 1024,
                external: memoryInfo.external / 1024 / 1024,
                arrayBuffers: memoryInfo.arrayBuffers ? memoryInfo.arrayBuffers / 1024 / 1024 : 0,
                percentUsed: (memoryInfo.heapUsed / memoryInfo.heapTotal) * 100
            },
            systemMemory: {
                total: totalMem / 1024 / 1024,
                free: freeMem / 1024 / 1024,
                percentUsed: ((totalMem - freeMem) / totalMem) * 100
            },
            eventLoopLag: 0,
            uptime: process.uptime(),
            requestRate: 0,
            responseTimes: {
                avg: 0,
                min: 0,
                max: 0,
                p95: 0
            },
            activeConnections: 0,
            errorRate: 0,
            timestamp: new Date().toISOString()
        };
    }
    /**
     * Start monitoring performance metrics
     */
    start(interval = 60000) {
        if (this.intervalId) {
            this.stop();
        }
        // Collect metrics at specified interval
        this.intervalId = setInterval(() => {
            this.collectMetrics();
        }, interval);
        // Report metrics every 15 minutes
        const reportingInterval = 15 * 60 * 1000; // 15 minutes
        this.reportingIntervalId = setInterval(() => {
            this.reportMetrics();
        }, reportingInterval);
        logger_1.default.info('Performance monitoring started');
    }
    /**
     * Stop monitoring
     */
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        if (this.reportingIntervalId) {
            clearInterval(this.reportingIntervalId);
            this.reportingIntervalId = null;
        }
        logger_1.default.info('Performance monitoring stopped');
    }
    /**
     * Collect current performance metrics
     */
    async collectMetrics() {
        try {
            // Get CPU usage
            const cpuUsage = await this.getCpuUsage();
            // Get memory information
            const memoryInfo = process.memoryUsage();
            const totalMem = os.totalmem();
            const freeMem = os.freemem();
            // Calculate event loop lag
            const eventLoopLag = await this.measureEventLoopLag();
            // Calculate request rate (requests per minute)
            const requestRate = this.requestCounter;
            this.requestCounter = 0; // Reset counter
            // Calculate error rate
            const errorRate = this.errorCounter > 0
                ? (this.errorCounter / (requestRate || 1)) * 100
                : 0;
            this.errorCounter = 0; // Reset counter
            // Calculate response times
            const responseTimes = this.calculateResponseTimes();
            this.responseTimeTracker.clear(); // Clear after calculating
            // Update metrics
            this.metrics = {
                cpuUsage,
                memoryUsage: {
                    heapTotal: memoryInfo.heapTotal / 1024 / 1024,
                    heapUsed: memoryInfo.heapUsed / 1024 / 1024,
                    rss: memoryInfo.rss / 1024 / 1024,
                    external: memoryInfo.external / 1024 / 1024,
                    arrayBuffers: memoryInfo.arrayBuffers ? memoryInfo.arrayBuffers / 1024 / 1024 : 0,
                    percentUsed: (memoryInfo.heapUsed / memoryInfo.heapTotal) * 100
                },
                systemMemory: {
                    total: totalMem / 1024 / 1024,
                    free: freeMem / 1024 / 1024,
                    percentUsed: ((totalMem - freeMem) / totalMem) * 100
                },
                eventLoopLag,
                uptime: process.uptime(),
                requestRate,
                responseTimes,
                activeConnections: this.activeConnections,
                errorRate,
                timestamp: new Date().toISOString()
            };
            // Add to history
            this.metricsHistory.push({ ...this.metrics });
            // Limit history size
            if (this.metricsHistory.length > this.maxHistoryItems) {
                this.metricsHistory.shift();
            }
            // Check for threshold violations
            this.checkThresholds();
            // Emit update event
            this.events.emit('metrics-updated', this.metrics);
            // Save metrics to file
            await this.saveMetricsToFile();
        }
        catch (error) {
            logger_1.default.error(`Error collecting performance metrics: ${(0, logger_1.getErrorMessage)(error)}`);
        }
    }
    /**
     * Get CPU usage percentage
     */
    async getCpuUsage() {
        return new Promise((resolve) => {
            const startUsage = process.cpuUsage();
            const startTime = process.hrtime();
            // Measure CPU usage over a short period
            setTimeout(() => {
                const elapUsage = process.cpuUsage(startUsage);
                const elapTime = process.hrtime(startTime);
                const elapTimeMS = elapTime[0] * 1000 + elapTime[1] / 1000000;
                // Calculate percentage of CPU used in the elapsed time
                const cpuPercent = 100 * (elapUsage.user + elapUsage.system) / 1000 / elapTimeMS;
                resolve(Math.min(100, cpuPercent));
            }, 100);
        });
    }
    /**
     * Measure event loop lag
     */
    async measureEventLoopLag() {
        return new Promise((resolve) => {
            const start = Date.now();
            // Schedule a timer for the next tick of the event loop
            setImmediate(() => {
                const lag = Date.now() - start;
                resolve(lag);
            });
        });
    }
    /**
     * Calculate response time statistics
     */
    calculateResponseTimes() {
        const allResponseTimes = [];
        // Collect all response times
        this.responseTimeTracker.forEach((times) => {
            allResponseTimes.push(...times);
        });
        if (allResponseTimes.length === 0) {
            return { avg: 0, min: 0, max: 0, p95: 0 };
        }
        // Sort response times
        allResponseTimes.sort((a, b) => a - b);
        // Calculate statistics
        const avg = allResponseTimes.reduce((sum, time) => sum + time, 0) / allResponseTimes.length;
        const min = allResponseTimes[0];
        const max = allResponseTimes[allResponseTimes.length - 1];
        const p95Index = Math.ceil(allResponseTimes.length * 0.95) - 1;
        const p95 = allResponseTimes[p95Index];
        return { avg, min, max, p95 };
    }
    /**
     * Check for threshold violations
     */
    checkThresholds() {
        // Check CPU usage
        if (this.metrics.cpuUsage >= this.thresholds.cpu.critical) {
            this.emitAlert('critical', 'cpu', `CPU usage is critical: ${this.metrics.cpuUsage.toFixed(2)}%`);
        }
        else if (this.metrics.cpuUsage >= this.thresholds.cpu.warning) {
            this.emitAlert('warning', 'cpu', `CPU usage is high: ${this.metrics.cpuUsage.toFixed(2)}%`);
        }
        // Check memory usage
        if (this.metrics.systemMemory.percentUsed >= this.thresholds.memory.critical) {
            this.emitAlert('critical', 'memory', `System memory usage is critical: ${this.metrics.systemMemory.percentUsed.toFixed(2)}%`);
        }
        else if (this.metrics.systemMemory.percentUsed >= this.thresholds.memory.warning) {
            this.emitAlert('warning', 'memory', `System memory usage is high: ${this.metrics.systemMemory.percentUsed.toFixed(2)}%`);
        }
        // Check response time
        if (this.metrics.responseTimes.avg >= this.thresholds.responseTime.critical) {
            this.emitAlert('critical', 'responseTime', `Average response time is critical: ${this.metrics.responseTimes.avg.toFixed(2)}ms`);
        }
        else if (this.metrics.responseTimes.avg >= this.thresholds.responseTime.warning) {
            this.emitAlert('warning', 'responseTime', `Average response time is high: ${this.metrics.responseTimes.avg.toFixed(2)}ms`);
        }
    }
    /**
     * Emit performance alert
     */
    emitAlert(level, type, message) {
        const alert = {
            level,
            type,
            message,
            timestamp: new Date().toISOString(),
            metrics: this.metrics
        };
        this.events.emit('performance-alert', alert);
        if (level === 'critical') {
            logger_1.default.error(`PERFORMANCE ALERT: ${message}`, { alert });
        }
        else {
            logger_1.default.warn(`PERFORMANCE WARNING: ${message}`, { alert });
        }
    }
    /**
     * Save metrics to file
     */
    async saveMetricsToFile() {
        try {
            const date = new Date();
            const fileName = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}.json`;
            const filePath = `${this.metricsPath}/${fileName}`;
            const metricEntry = JSON.stringify(this.metrics) + '\n';
            if (fs.existsSync(filePath)) {
                await fsAppend(filePath, metricEntry);
            }
            else {
                await fsWrite(filePath, metricEntry);
            }
        }
        catch (error) {
            logger_1.default.error(`Error saving metrics to file: ${(0, logger_1.getErrorMessage)(error)}`);
        }
    }
    /**
     * Generate and save a performance report
     */
    async reportMetrics() {
        try {
            if (this.metricsHistory.length === 0) {
                return;
            }
            const now = new Date();
            const reportFileName = `performance_report_${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}-${now.getMinutes().toString().padStart(2, '0')}.json`;
            const reportPath = `${this.metricsPath}/reports`;
            // Ensure reports directory exists
            if (!fs.existsSync(reportPath)) {
                await fsMkdir(reportPath, { recursive: true });
            }
            // Calculate averages
            const avgCpuUsage = this.metricsHistory.reduce((sum, m) => sum + m.cpuUsage, 0) / this.metricsHistory.length;
            const avgMemUsage = this.metricsHistory.reduce((sum, m) => sum + m.systemMemory.percentUsed, 0) / this.metricsHistory.length;
            const avgResponseTime = this.metricsHistory.reduce((sum, m) => sum + m.responseTimes.avg, 0) / this.metricsHistory.length;
            const avgRequestRate = this.metricsHistory.reduce((sum, m) => sum + m.requestRate, 0) / this.metricsHistory.length;
            // Find maximum values
            const maxCpuUsage = Math.max(...this.metricsHistory.map(m => m.cpuUsage));
            const maxMemUsage = Math.max(...this.metricsHistory.map(m => m.systemMemory.percentUsed));
            const maxResponseTime = Math.max(...this.metricsHistory.map(m => m.responseTimes.max));
            const maxRequestRate = Math.max(...this.metricsHistory.map(m => m.requestRate));
            // Generate report
            const report = {
                period: {
                    start: this.metricsHistory[0].timestamp,
                    end: this.metricsHistory[this.metricsHistory.length - 1].timestamp
                },
                summary: {
                    averages: {
                        cpuUsage: avgCpuUsage,
                        memoryUsage: avgMemUsage,
                        responseTime: avgResponseTime,
                        requestRate: avgRequestRate
                    },
                    maximums: {
                        cpuUsage: maxCpuUsage,
                        memoryUsage: maxMemUsage,
                        responseTime: maxResponseTime,
                        requestRate: maxRequestRate
                    }
                },
                metrics: this.metricsHistory
            };
            await fsWrite(`${reportPath}/${reportFileName}`, JSON.stringify(report, null, 2));
            logger_1.default.info(`Performance report generated: ${reportFileName}`);
        }
        catch (error) {
            logger_1.default.error(`Error generating performance report: ${(0, logger_1.getErrorMessage)(error)}`);
        }
    }
    /**
     * Middleware to track request/response metrics
     */
    metricsMiddleware() {
        return (req, res, next) => {
            // Increment connection counter
            this.activeConnections++;
            // Track start time
            const startTime = Date.now();
            // Track endpoint
            const endpoint = `${req.method} ${req.path}`;
            // Setup response end listener
            res.on('finish', () => {
                // Decrement connection counter
                this.activeConnections--;
                // Increment request counter
                this.requestCounter++;
                // Calculate response time
                const responseTime = Date.now() - startTime;
                // Track response time by endpoint
                if (!this.responseTimeTracker.has(endpoint)) {
                    this.responseTimeTracker.set(endpoint, []);
                }
                this.responseTimeTracker.get(endpoint).push(responseTime);
                // Track errors
                if (res.statusCode >= 400) {
                    this.errorCounter++;
                }
            });
            next();
        };
    }
    /**
     * Get the current metrics
     */
    getMetrics() {
        return { ...this.metrics };
    }
    /**
     * Get historical metrics
     */
    getMetricsHistory() {
        return [...this.metricsHistory];
    }
    /**
     * Subscribe to metrics updates
     */
    onMetricsUpdated(listener) {
        this.events.on('metrics-updated', listener);
    }
    /**
     * Unsubscribe from metrics updates
     */
    offMetricsUpdated(listener) {
        this.events.off('metrics-updated', listener);
    }
    /**
     * Subscribe to performance alerts
     */
    onPerformanceAlert(listener) {
        this.events.on('performance-alert', listener);
    }
    /**
     * Unsubscribe from performance alerts
     */
    offPerformanceAlert(listener) {
        this.events.off('performance-alert', listener);
    }
}
exports.PerformanceMonitor = PerformanceMonitor;
// Create and export singleton instance
exports.performanceMonitor = PerformanceMonitor.getInstance();
exports.default = exports.performanceMonitor;
//# sourceMappingURL=performance_metrics.js.map