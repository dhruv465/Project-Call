import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { CircuitBreaker, BreakerOptions } from 'opossum';
import logger from '../utils/logger';

/**
 * API connection pool with circuit breaker pattern
 * Manages connections to external APIs with failure detection and recovery
 */
export class ApiConnectionPool {
  private connections: Map<string, PooledConnection>;
  private defaultPoolSize: number = 5;
  private defaultTimeout: number = 10000;
  private useCircuitBreaker: boolean = true;

  constructor() {
    this.connections = new Map();
  }

  /**
   * Get or create a connection for a service
   * @param serviceName Service identifier (e.g., 'elevenlabs', 'openai')
   * @param config Connection configuration
   * @returns Pooled connection
   */
  public getConnection(
    serviceName: string,
    config: ConnectionConfig = {}
  ): PooledConnection {
    const existingConnection = this.connections.get(serviceName);
    
    if (existingConnection) {
      return existingConnection;
    }
    
    // Create new connection
    const connection = this.createConnection(serviceName, config);
    this.connections.set(serviceName, connection);
    
    return connection;
  }

  /**
   * Create a new connection with pooling and circuit breaker
   * @param serviceName Service identifier
   * @param config Connection configuration
   * @returns Pooled connection
   */
  private createConnection(
    serviceName: string,
    config: ConnectionConfig
  ): PooledConnection {
    // Connection pool size
    const poolSize = config.poolSize || this.defaultPoolSize;
    
    // Create connection instances
    const instances: AxiosInstance[] = [];
    for (let i = 0; i < poolSize; i++) {
      instances.push(
        axios.create({
          baseURL: config.baseUrl,
          timeout: config.timeout || this.defaultTimeout,
          headers: config.headers || {},
        })
      );
    }
    
    // Setup circuit breaker if enabled
    let circuitBreaker: CircuitBreaker | null = null;
    
    if (this.useCircuitBreaker) {
      const breakerOptions: BreakerOptions = {
        timeout: config.circuitBreaker?.timeout || 30000,
        resetTimeout: config.circuitBreaker?.resetTimeout || 30000,
        errorThresholdPercentage: config.circuitBreaker?.errorThreshold || 50,
        rollingCountTimeout: config.circuitBreaker?.rollingTimeout || 60000,
        rollingCountBuckets: 10,
        name: `${serviceName}-circuit`
      };
      
      // Create circuit breaker
      circuitBreaker = new CircuitBreaker(
        (requestConfig: AxiosRequestConfig) => {
          // Get an available instance from the pool
          const instance = instances[Math.floor(Math.random() * instances.length)];
          return instance(requestConfig);
        },
        breakerOptions
      );
      
      // Add listeners for circuit breaker events
      circuitBreaker.on('open', () => {
        logger.warn(`Circuit breaker for ${serviceName} is now OPEN`);
      });
      
      circuitBreaker.on('close', () => {
        logger.info(`Circuit breaker for ${serviceName} is now CLOSED`);
      });
      
      circuitBreaker.on('halfOpen', () => {
        logger.info(`Circuit breaker for ${serviceName} is now HALF-OPEN`);
      });
      
      circuitBreaker.on('fallback', (result) => {
        logger.info(`Circuit breaker fallback for ${serviceName} executed`);
      });
    }
    
    // Create connection manager
    const connection: PooledConnection = {
      service: serviceName,
      instances,
      circuitBreaker,
      poolSize,
      activeRequests: 0,
      stats: {
        totalRequests: 0,
        failedRequests: 0,
        successfulRequests: 0,
        circuitBreakerTrips: 0,
        averageResponseTime: 0
      },
      
      // Request method with circuit breaker and failover
      async request<T = any>(
        config: AxiosRequestConfig,
        options: RequestOptions = {}
      ): Promise<AxiosResponse<T>> {
        const startTime = Date.now();
        
        // Track active requests
        this.incrementActiveRequests();
        
        try {
          let response: AxiosResponse<T>;
          
          if (circuitBreaker && !options.bypassCircuitBreaker) {
            // Use circuit breaker
            response = await circuitBreaker.fire(config);
          } else {
            // Direct request to a random instance
            const instance = instances[Math.floor(Math.random() * instances.length)];
            response = await instance(config);
          }
          
          // Update statistics
          this.updateStats({
            success: true,
            responseTime: Date.now() - startTime
          });
          
          return response;
        } catch (error) {
          // Update statistics
          this.updateStats({
            success: false,
            responseTime: Date.now() - startTime
          });
          
          if (options.fallbackService && !options.isRetry) {
            // Try fallback service
            logger.info(`Attempting fallback to ${options.fallbackService} for ${serviceName} request`);
            
            try {
              const fallbackConnection = ApiConnectionPool.getInstance().getConnection(
                options.fallbackService
              );
              
              return await fallbackConnection.request<T>(config, {
                ...options,
                isRetry: true // Prevent infinite fallback loops
              });
            } catch (fallbackError) {
              logger.error(`Fallback to ${options.fallbackService} also failed:`, fallbackError);
              throw error; // Throw original error
            }
          }
          
          throw error;
        } finally {
          // Decrement active requests count
          this.decrementActiveRequests();
        }
      },
      
      // Helper method to track active requests
      incrementActiveRequests() {
        this.activeRequests++;
      },
      
      // Helper method to track active requests
      decrementActiveRequests() {
        if (this.activeRequests > 0) {
          this.activeRequests--;
        }
      },
      
      // Update connection statistics
      updateStats(requestStats: { success: boolean; responseTime: number }) {
        this.stats.totalRequests++;
        
        if (requestStats.success) {
          this.stats.successfulRequests++;
        } else {
          this.stats.failedRequests++;
        }
        
        // Update average response time using weighted average
        const currentTotal = this.stats.averageResponseTime * (this.stats.totalRequests - 1);
        this.stats.averageResponseTime = (currentTotal + requestStats.responseTime) / this.stats.totalRequests;
      },
      
      // Get connection health information
      getHealth(): ConnectionHealth {
        return {
          service: this.service,
          isOpen: circuitBreaker ? circuitBreaker.status.state === 'open' : false,
          activeRequests: this.activeRequests,
          successRate: this.stats.totalRequests > 0
            ? this.stats.successfulRequests / this.stats.totalRequests
            : 1,
          averageResponseTime: this.stats.averageResponseTime,
          lastUpdated: new Date()
        };
      }
    };
    
    return connection;
  }

  /**
   * Get health status for all connections
   * @returns Array of connection health statuses
   */
  public getConnectionHealth(): ConnectionHealth[] {
    return Array.from(this.connections.values()).map(
      connection => connection.getHealth()
    );
  }

  /**
   * Close all connections in the pool
   */
  public closeAll(): void {
    this.connections.clear();
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): ApiConnectionPool {
    if (!ApiConnectionPool.instance) {
      ApiConnectionPool.instance = new ApiConnectionPool();
    }
    return ApiConnectionPool.instance;
  }

  private static instance: ApiConnectionPool;
}

/**
 * Connection configuration interface
 */
export interface ConnectionConfig {
  baseUrl?: string;
  timeout?: number;
  poolSize?: number;
  headers?: Record<string, string>;
  circuitBreaker?: {
    timeout?: number;
    resetTimeout?: number;
    errorThreshold?: number;
    rollingTimeout?: number;
  };
}

/**
 * Request options interface
 */
export interface RequestOptions {
  fallbackService?: string;
  bypassCircuitBreaker?: boolean;
  isRetry?: boolean;
}

/**
 * Pooled connection interface
 */
export interface PooledConnection {
  service: string;
  instances: AxiosInstance[];
  circuitBreaker: CircuitBreaker | null;
  poolSize: number;
  activeRequests: number;
  stats: {
    totalRequests: number;
    failedRequests: number;
    successfulRequests: number;
    circuitBreakerTrips: number;
    averageResponseTime: number;
  };
  
  request<T = any>(
    config: AxiosRequestConfig,
    options?: RequestOptions
  ): Promise<AxiosResponse<T>>;
  
  incrementActiveRequests(): void;
  decrementActiveRequests(): void;
  updateStats(requestStats: { success: boolean; responseTime: number }): void;
  getHealth(): ConnectionHealth;
}

/**
 * Connection health interface
 */
export interface ConnectionHealth {
  service: string;
  isOpen: boolean;
  activeRequests: number;
  successRate: number;
  averageResponseTime: number;
  lastUpdated: Date;
}

// Export singleton instance
export const apiConnectionPool = ApiConnectionPool.getInstance();
