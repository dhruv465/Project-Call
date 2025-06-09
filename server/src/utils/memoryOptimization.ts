/**
 * Memory optimization utilities for production environments
 */

// Memory monitoring and garbage collection optimization
export const initializeMemoryOptimization = () => {
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    console.log('Initializing memory optimization for production...');

    // Force garbage collection every 30 seconds to prevent memory buildup
    const gcInterval = setInterval(() => {
      if ((global as any).gc) {
        (global as any).gc();
      }
    }, 30000);

    // Monitor memory usage and log warnings
    const memoryMonitorInterval = setInterval(() => {
      const memUsage = process.memoryUsage();
      const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
      const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
      const rss = Math.round(memUsage.rss / 1024 / 1024);
      
      // Log warning if heap usage exceeds 1.5GB
      if (heapUsedMB > 1536) {
        console.warn(`⚠️  High memory usage detected: ${heapUsedMB}MB heap used / ${heapTotalMB}MB heap total / ${rss}MB RSS`);
      }

      // Log info every 5 minutes with current usage
      const now = Date.now();
      if (!global.lastMemoryLog || now - global.lastMemoryLog > 300000) {
        console.log(`📊 Memory usage: ${heapUsedMB}MB heap / ${rss}MB RSS`);
        (global as any).lastMemoryLog = now;
      }
    }, 60000);

    // Enhanced process event handlers for graceful shutdown
    const gracefulShutdown = (signal: string) => {
      console.log(`Received ${signal}. Cleaning up memory monitoring...`);
      clearInterval(gcInterval);
      clearInterval(memoryMonitorInterval);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught exceptions and unhandled rejections
    process.on('uncaughtException', (error) => {
      console.error('💥 Uncaught Exception:', error);
      gracefulShutdown('UNCAUGHT_EXCEPTION');
      setTimeout(() => process.exit(1), 1000);
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
      gracefulShutdown('UNHANDLED_REJECTION');
      setTimeout(() => process.exit(1), 1000);
    });

    console.log('✅ Memory optimization initialized');
  }
};

// Memory usage reporting utility
export const getMemoryUsage = () => {
  const memUsage = process.memoryUsage();
  return {
    heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
    heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
    rss: Math.round(memUsage.rss / 1024 / 1024), // MB
    external: Math.round(memUsage.external / 1024 / 1024), // MB
    arrayBuffers: Math.round(memUsage.arrayBuffers / 1024 / 1024), // MB
  };
};

// Declare global types
declare global {
  namespace NodeJS {
    interface Global {
      gc?: () => void;
      lastMemoryLog?: number;
    }
  }
}
