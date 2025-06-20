/**
 * Transcription Routes - Handles speech-to-text transcription requests
 */

import { FastifyInstance } from 'fastify';
import { RedisClientType } from 'redis';
import { Worker } from 'worker_threads';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { pipeline } from 'stream/promises';
import CircuitBreaker from 'opossum';
import { FastifyRequest, FastifyReply } from '../types/api';

// Helper function to get error message from unknown error
function getErrorMessage(error: unknown): string {
  return error instanceof Error ? getErrorMessage(error) : String(error);
}

// Circuit breaker options
const circuitOptions = {
  timeout: 30000, // 30 seconds timeout
  errorThresholdPercentage: 50, // Open after 50% failures
  resetTimeout: 30000, // 30 seconds to reset
  rollingCountTimeout: 60000, // 60 second rolling window
  rollingCountBuckets: 10, // 10 buckets
};

// Create a circuit breaker for transcription
const transcriptionCircuit = new CircuitBreaker(async (params: any) => {
  const { worker, jobId, filePath, options } = params;
  
  const jobPromise = new Promise((resolve, reject) => {
    // Set up timeout
    const timeout = setTimeout(() => {
      reject(new Error('Transcription job timed out'));
      
      // Clean up event listener
      worker.removeAllListeners(`job:${jobId}:complete`);
      worker.removeAllListeners(`job:${jobId}:error`);
    }, 60000); // 60 second timeout
    
    // Set up completion handler
    worker.on(`job:${jobId}:complete`, (result: any) => {
      clearTimeout(timeout);
      resolve(result);
      
      // Clean up event listeners
      worker.removeAllListeners(`job:${jobId}:complete`);
      worker.removeAllListeners(`job:${jobId}:error`);
    });
    
    worker.on(`job:${jobId}:error`, (error: any) => {
      clearTimeout(timeout);
      reject(new Error(getErrorMessage(error) || 'Transcription failed'));
      
      // Clean up event listeners
      worker.removeAllListeners(`job:${jobId}:complete`);
      worker.removeAllListeners(`job:${jobId}:error`);
    });
  });
  
  // Post message to worker
  worker.postMessage({
    action: 'transcribe',
    jobId,
    filePath,
    options
  });
  
  // Wait for job completion
  return jobPromise;
}, circuitOptions);

// Event listeners for circuit breaker
transcriptionCircuit.on('open', () => {
  console.log('Transcription circuit breaker opened');
});

transcriptionCircuit.on('close', () => {
  console.log('Transcription circuit breaker closed');
});

transcriptionCircuit.on('halfOpen', () => {
  console.log('Transcription circuit breaker half-open');
});

// Fallback function for when circuit is open
transcriptionCircuit.fallback(() => {
  return {
    status: 'degraded',
    transcript: '[Transcription temporarily unavailable due to service issues]',
    confidence: 0,
    words: [],
    metadata: {
      serviceStatus: 'degraded',
      message: 'The transcription service is temporarily unavailable'
    }
  };
});

export function registerTranscriptionRoutes(
  server: FastifyInstance,
  redisClient: RedisClientType,
  workerPool: Map<string, Worker>
) {
  // Circuit breaker status endpoint
  server.get('/transcribe/circuit', async (request: any, reply: any) => {
    return {
      state: transcriptionCircuit.status.state,
      stats: {
        successes: transcriptionCircuit.stats.successes,
        failures: transcriptionCircuit.stats.failures,
        rejects: transcriptionCircuit.stats.rejects,
        timeouts: transcriptionCircuit.stats.timeouts,
        latencyMean: transcriptionCircuit.stats.latency.mean,
      }
    };
  });
  
  // Reset circuit breaker
  server.post('/transcribe/circuit/reset', async (request: any, reply: any) => {
    transcriptionCircuit.close();
    return { success: true, message: 'Circuit breaker reset' };
  });

  // Direct transcription endpoint
  server.post('/transcribe', async (request: any, reply: any) => {
    try {
      const data = await request.file();
      
      if (!data) {
        return reply.code(400).send({ error: 'No file uploaded' });
      }
      
      // Validate file type
      const fileType = data.mimetype;
      if (!fileType.includes('audio/')) {
        return reply.code(400).send({ error: 'Invalid file type. Only audio files are allowed.' });
      }
      
      // Get parameters
      const { language, model, enhanced } = request.query as {
        language?: string;
        model?: string;
        enhanced?: string;
      };
      
      // Generate a unique file name for temporary storage
      const fileExtension = path.extname(data.filename) || '.wav';
      const fileName = `temp_${uuidv4()}${fileExtension}`;
      const filePath = path.join(__dirname, '../../../../uploads/audio', fileName);
      
      // Save the file temporarily
      await pipeline(data.file, fs.createWriteStream(filePath));
      
      // Prepare job ID
      const jobId = uuidv4();
      
      // Choose a worker
      const workerIds = Array.from(workerPool.keys());
      if (workerIds.length === 0) {
        // Clean up the temporary file
        try {
          await fs.promises.unlink(filePath);
        } catch (unlinkError) {
          server.log.error(`Error deleting temporary file: ${getErrorMessage(unlinkError)}`);
        }
        
        return reply.code(503).send({ error: 'No workers available' });
      }
      
      // Simple round-robin worker selection
      const workerId = workerIds[Math.floor(Math.random() * workerIds.length)];
      const worker = workerPool.get(workerId);

      // Use circuit breaker to manage transcription job
      let result;
      try {
        result = await transcriptionCircuit.fire({
          worker,
          jobId,
          filePath,
          options: {
            language: language || 'en',
            model: model || 'general',
            enhanced: enhanced === 'true'
          }
        });
        
        // Track successful transcription
        await redisClient.hIncrBy('transcription:stats', 'success_count', 1);
        
        // Add to recent jobs
        const jobData = {
          id: jobId,
          timestamp: Date.now(),
          status: 'completed',
          language: language || 'en',
          model: model || 'general'
        };
        
        await redisClient.lPush('transcription:recent_jobs', jobId);
        await redisClient.hSet(`transcription:job:${jobId}`, jobData);
        await redisClient.expire(`transcription:job:${jobId}`, 86400); // 24 hour TTL
        await redisClient.lTrim('transcription:recent_jobs', 0, 99); // Keep only 100 most recent
      } catch (error: any) {
        // Track failed transcription
        await redisClient.hIncrBy('transcription:stats', 'error_count', 1);
        
        // Log the error
        server.log.error(`Transcription job ${jobId} failed: ${getErrorMessage(error)}`);
        
        // Add to recent jobs
        const jobData = {
          id: jobId,
          timestamp: Date.now(),
          status: 'failed',
          error: getErrorMessage(error),
          language: language || 'en',
          model: model || 'general'
        };
        
        await redisClient.lPush('transcription:recent_jobs', jobId);
        await redisClient.hSet(`transcription:job:${jobId}`, jobData);
        await redisClient.expire(`transcription:job:${jobId}`, 86400); // 24 hour TTL
        
        // Return fallback or error
        if (transcriptionCircuit.status.state === 'open') {
          result = transcriptionCircuit.fallback();
        } else {
          throw error;
        }
      }
      
      // Clean up the temporary file
      try {
        await fs.promises.unlink(filePath);
      } catch (unlinkError) {
        server.log.error(`Error deleting temporary file: ${getErrorMessage(unlinkError)}`);
      }
      
      return result;
    } catch (error: any) {
      server.log.error(`Error transcribing audio: ${getErrorMessage(error)}`);
      return reply.code(500).send({ error: 'Failed to transcribe audio file' });
    }
  });
  
  // Real-time transcription status
  server.get('/transcribe/status', async (request: any, reply: any) => {
    try {
      // Count active workers and their current load
      const activeWorkers = workerPool.size;
      let totalJobs = 0;
      
      // Get transcription statistics from Redis
      const stats = await redisClient.hGetAll('transcription:stats');
      
      // Get recent transcription jobs
      const recentJobs = await redisClient.lRange('transcription:recent_jobs', 0, 9);
      const jobDetails = [];
      
      for (const jobId of recentJobs) {
        const job = await redisClient.hGetAll(`job:${jobId}`);
        if (job && Object.keys(job).length > 0) {
          jobDetails.push({
            jobId,
            status: job.status,
            createdAt: job.createdAt,
            completedAt: job.completedAt || null,
            processingTime: job.processingTime || null
          });
        }
      }
      
      return {
        activeWorkers,
        totalJobs: parseInt(stats.totalJobs || '0', 10),
        successfulJobs: parseInt(stats.successfulJobs || '0', 10),
        failedJobs: parseInt(stats.failedJobs || '0', 10),
        averageProcessingTime: parseFloat(stats.averageProcessingTime || '0'),
        recentJobs: jobDetails
      };
    } catch (error: any) {
      server.log.error(`Error getting transcription status: ${getErrorMessage(error)}`);
      return reply.code(500).send({ error: 'Failed to get transcription status' });
    }
  });
  
  // Language detection endpoint
  server.post('/transcribe/detect-language', async (request: any, reply: any) => {
    try {
      const data = await request.file();
      
      if (!data) {
        return reply.code(400).send({ error: 'No file uploaded' });
      }
      
      // Validate file type
      const fileType = data.mimetype;
      if (!fileType.includes('audio/')) {
        return reply.code(400).send({ error: 'Invalid file type. Only audio files are allowed.' });
      }
      
      // Generate a unique file name for temporary storage
      const fileExtension = path.extname(data.filename) || '.wav';
      const fileName = `temp_${uuidv4()}${fileExtension}`;
      const filePath = path.join(__dirname, '../../../../uploads/audio', fileName);
      
      // Save the file temporarily
      await pipeline(data.file, fs.createWriteStream(filePath));
      
      // Prepare job ID
      const jobId = uuidv4();
      
      // Create promise to handle job completion
      const jobPromise = new Promise((resolve, reject) => {
        // Set up timeout
        const timeout = setTimeout(() => {
          reject(new Error('Language detection job timed out'));
          
          // Clean up event listener
          workerPool.forEach(worker => {
            worker.removeAllListeners(`job:${jobId}:complete`);
            worker.removeAllListeners(`job:${jobId}:error`);
          });
        }, 30000); // 30 second timeout
        
        // Set up completion handler
        workerPool.forEach(worker => {
          worker.on(`job:${jobId}:complete`, (result) => {
            clearTimeout(timeout);
            resolve(result);
            
            // Clean up event listeners
            workerPool.forEach(w => {
              w.removeAllListeners(`job:${jobId}:complete`);
              w.removeAllListeners(`job:${jobId}:error`);
            });
          });
          
          worker.on(`job:${jobId}:error`, (error) => {
            clearTimeout(timeout);
            reject(new Error(getErrorMessage(error) || 'Language detection failed'));
            
            // Clean up event listeners
            workerPool.forEach(w => {
              w.removeAllListeners(`job:${jobId}:complete`);
              w.removeAllListeners(`job:${jobId}:error`);
            });
          });
        });
      });
      
      // Choose a worker
      const workerIds = Array.from(workerPool.keys());
      if (workerIds.length === 0) {
        // Clean up the temporary file
        try {
          await fs.promises.unlink(filePath);
        } catch (unlinkError) {
          server.log.error(`Error deleting temporary file: ${getErrorMessage(unlinkError)}`);
        }
        
        return reply.code(503).send({ error: 'No workers available' });
      }
      
      // Simple round-robin worker selection
      const workerId = workerIds[Math.floor(Math.random() * workerIds.length)];
      const worker = workerPool.get(workerId);
      
      if (!worker) {
        // Clean up temporary file on worker assignment failure
        try {
          await fs.promises.unlink(filePath);
        } catch (unlinkError) {
          server.log.error(`Error deleting temporary file: ${getErrorMessage(unlinkError)}`);
        }
        
        return reply.code(503).send({ error: 'Worker not available' });
      }
      
      // Post message to worker
      worker.postMessage({
        action: 'detectLanguage',
        jobId,
        filePath
      });
      
      // Wait for job completion
      const result = await jobPromise;
      
      // Clean up the temporary file
      try {
        await fs.promises.unlink(filePath);
      } catch (unlinkError) {
        server.log.error(`Error deleting temporary file: ${getErrorMessage(unlinkError)}`);
      }
      
      return result;
    } catch (error) {
      server.log.error(`Error detecting language: ${getErrorMessage(error)}`);
      return reply.code(500).send({ error: 'Failed to detect language' });
    }
  });
}
