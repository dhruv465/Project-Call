import fs from 'fs';
import path from 'path';
import { logger } from '../index';

/**
 * Utility to clean up temporary MP3 files that weren't properly deleted
 */
export class TempFileCleanup {
  private static cleanupInterval: NodeJS.Timeout | null = null;
  private static readonly TEMP_FILE_PATTERN = /^temp_\d+\.mp3$/;
  private static readonly CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
  private static readonly MAX_FILE_AGE_MS = 10 * 60 * 1000; // 10 minutes

  /**
   * Start the periodic cleanup process
   */
  static startPeriodicCleanup(): void {
    if (this.cleanupInterval) {
      return; // Already running
    }

    logger.info('Starting periodic temp file cleanup');
    
    // Run cleanup immediately
    this.cleanupTempFiles();
    
    // Set up periodic cleanup
    this.cleanupInterval = setInterval(() => {
      this.cleanupTempFiles();
    }, this.CLEANUP_INTERVAL_MS);
  }

  /**
   * Stop the periodic cleanup process
   */
  static stopPeriodicCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      logger.info('Stopped periodic temp file cleanup');
    }
  }

  /**
   * Clean up temporary files immediately
   */
  static cleanupTempFiles(baseDir: string = process.cwd()): void {
    try {
      const files = fs.readdirSync(baseDir);
      let cleanedCount = 0;

      files.forEach(file => {
        if (this.TEMP_FILE_PATTERN.test(file)) {
          const filePath = path.join(baseDir, file);
          
          try {
            const stats = fs.statSync(filePath);
            const fileAge = Date.now() - stats.mtime.getTime();
            
            // Delete files older than MAX_FILE_AGE_MS
            if (fileAge > this.MAX_FILE_AGE_MS) {
              fs.unlinkSync(filePath);
              cleanedCount++;
              logger.debug(`Cleaned up temp file: ${file} (age: ${Math.round(fileAge / 1000)}s)`);
            }
          } catch (error) {
            logger.warn(`Failed to clean up temp file ${file}:`, error);
          }
        }
      });

      if (cleanedCount > 0) {
        logger.info(`Cleaned up ${cleanedCount} temporary MP3 files`);
      }
    } catch (error) {
      logger.error('Error during temp file cleanup:', error);
    }
  }

  /**
   * Emergency cleanup - removes all temp files regardless of age
   */
  static emergencyCleanup(baseDir: string = process.cwd()): void {
    try {
      const files = fs.readdirSync(baseDir);
      let cleanedCount = 0;

      files.forEach(file => {
        if (this.TEMP_FILE_PATTERN.test(file)) {
          const filePath = path.join(baseDir, file);
          
          try {
            fs.unlinkSync(filePath);
            cleanedCount++;
          } catch (error) {
            logger.warn(`Failed to clean up temp file ${file}:`, error);
          }
        }
      });

      if (cleanedCount > 0) {
        logger.info(`Emergency cleanup: removed ${cleanedCount} temporary MP3 files`);
      }
    } catch (error) {
      logger.error('Error during emergency temp file cleanup:', error);
    }
  }
}
