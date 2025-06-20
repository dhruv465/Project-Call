import Redis from 'ioredis';
import logger from './logger';

/**
 * Redis client singleton for caching and messaging
 */
export class RedisClient {
  private static instance: RedisClient;
  private client: Redis;
  private subscriber: Redis | null = null;
  private publisher: Redis | null = null;

  /**
   * Initialize Redis client with configuration
   */
  private constructor() {
    // Get Redis configuration from environment variables with fallbacks
    const redisConfig = {
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      db: Number(process.env.REDIS_DB) || 0,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 100, 3000);
        return delay;
      },
      maxRetriesPerRequest: 3
    };

    try {
      // Create main client
      this.client = new Redis(redisConfig);
      
      this.client.on('connect', () => {
        logger.info('Redis client connected');
      });
      
      this.client.on('error', (err) => {
        logger.error(`Redis client error: ${err.message}`);
      });
      
    } catch (error) {
      logger.error(`Failed to initialize Redis client: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Get Redis client singleton instance
   */
  public static getInstance(): RedisClient {
    if (!RedisClient.instance) {
      RedisClient.instance = new RedisClient();
    }
    return RedisClient.instance;
  }

  /**
   * Get Redis pub/sub subscriber client
   * Lazy initialization for better resource usage
   */
  public getSubscriber(): Redis {
    if (!this.subscriber) {
      const redisConfig = {
        host: process.env.REDIS_HOST || 'localhost',
        port: Number(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        db: Number(process.env.REDIS_DB) || 0
      };
      
      this.subscriber = new Redis(redisConfig);
      
      this.subscriber.on('error', (err) => {
        logger.error(`Redis subscriber error: ${err.message}`);
      });
    }
    
    return this.subscriber;
  }

  /**
   * Get Redis pub/sub publisher client
   * Lazy initialization for better resource usage
   */
  public getPublisher(): Redis {
    if (!this.publisher) {
      const redisConfig = {
        host: process.env.REDIS_HOST || 'localhost',
        port: Number(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        db: Number(process.env.REDIS_DB) || 0
      };
      
      this.publisher = new Redis(redisConfig);
      
      this.publisher.on('error', (err) => {
        logger.error(`Redis publisher error: ${err.message}`);
      });
    }
    
    return this.publisher;
  }

  /**
   * Set a key-value pair with optional expiration
   */
  public async set(key: string, value: string, expireMode?: string, expireValue?: number): Promise<'OK'> {
    if (expireMode && expireValue) {
      return this.client.set(key, value, expireMode as any, expireValue);
    }
    return this.client.set(key, value);
  }

  /**
   * Get a value by key
   */
  public async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  /**
   * Delete one or more keys
   */
  public async del(...keys: string[]): Promise<number> {
    return this.client.del(...keys);
  }

  /**
   * Check if a key exists
   */
  public async exists(key: string): Promise<number> {
    return this.client.exists(key);
  }

  /**
   * Set expiration on a key
   */
  public async expire(key: string, seconds: number): Promise<number> {
    return this.client.expire(key, seconds);
  }

  /**
   * Hash set operations
   */
  public async hset(key: string, field: string, value: string): Promise<number> {
    return this.client.hset(key, field, value);
  }

  /**
   * Hash get operations
   */
  public async hget(key: string, field: string): Promise<string | null> {
    return this.client.hget(key, field);
  }

  /**
   * Get all fields and values in a hash
   */
  public async hgetall(key: string): Promise<Record<string, string>> {
    return this.client.hgetall(key);
  }

  /**
   * Publish a message to a channel
   */
  public async publish(channel: string, message: string): Promise<number> {
    return this.getPublisher().publish(channel, message);
  }

  /**
   * Subscribe to a channel
   */
  public async subscribe(channel: string, callback: (channel: string, message: string) => void): Promise<void> {
    const subscriber = this.getSubscriber();
    await subscriber.subscribe(channel);
    subscriber.on('message', callback);
  }

  /**
   * Unsubscribe from a channel
   */
  public async unsubscribe(channel: string): Promise<void> {
    if (this.subscriber) {
      await this.subscriber.unsubscribe(channel);
    }
  }

  /**
   * Close all Redis connections
   */
  public async closeAll(): Promise<void> {
    if (this.subscriber) {
      await this.subscriber.quit();
    }
    
    if (this.publisher) {
      await this.publisher.quit();
    }
    
    await this.client.quit();
  }
}

export default RedisClient;
