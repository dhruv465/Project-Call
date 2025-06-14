/**
 * Response Cache Utility for TTS
 * Implements caching for common TTS phrases to reduce latency
 */

import logger from '../utils/logger';
import { cacheSettings } from '../config/latencyOptimization';

interface CachedResponse {
  buffer: Buffer;
  timestamp: number;
  size: number;
  usageCount: number;
  lastUsed: number;
}

interface CacheOptions {
  maxSizeMB?: number;  // Maximum size in MB
  ttl?: number;        // Time to live in milliseconds
  priorityItems?: string[]; // Keys that should never be evicted
}

export class ResponseCache {
  private cache: Map<string, CachedResponse>;
  private maxSizeBytes: number;
  private ttl: number;
  private currentSizeBytes: number = 0;
  private priorityItems: Set<string>;
  
  constructor(options?: CacheOptions) {
    this.cache = new Map<string, CachedResponse>();
    this.maxSizeBytes = (options?.maxSizeMB || cacheSettings.maxSizeMB) * 1024 * 1024;
    this.ttl = options?.ttl || cacheSettings.ttl;
    this.priorityItems = new Set(options?.priorityItems || []);
    
    // Set up cache cleanup interval
    setInterval(() => this.cleanup(), 1000 * 60 * 5); // Clean every 5 minutes
    
    logger.info(`Enhanced TTS Response Cache initialized with maxSize: ${this.maxSizeBytes / (1024 * 1024)}MB, ttl: ${this.ttl}ms`);
  }
  
  /**
   * Store an item in the cache
   */
  public set(key: string, buffer: Buffer): void {
    const size = buffer.length;
    
    // Check if we need to evict items to make room
    if (this.currentSizeBytes + size > this.maxSizeBytes) {
      this.evictItems(size);
    }
    
    // If item already exists, update it and adjust size
    if (this.cache.has(key)) {
      const oldSize = this.cache.get(key)!.size;
      this.currentSizeBytes -= oldSize;
    }
    
    this.cache.set(key, {
      buffer,
      timestamp: Date.now(),
      size,
      usageCount: 0,
      lastUsed: Date.now()
    });
    
    this.currentSizeBytes += size;
  }
  
  /**
   * Get an item from the cache
   */
  public get(key: string): Buffer | undefined {
    const item = this.cache.get(key);
    
    if (item) {
      // Check if item is expired
      if (Date.now() - item.timestamp > this.ttl) {
        this.cache.delete(key);
        this.currentSizeBytes -= item.size;
        return undefined;
      }
      
      // Update usage stats
      item.usageCount++;
      item.lastUsed = Date.now();
      
      return item.buffer;
    }
    
    return undefined;
  }
  
  /**
   * Check if an item exists in the cache
   */
  public has(key: string): boolean {
    const item = this.cache.get(key);
    
    if (item) {
      // Check if item is expired
      if (Date.now() - item.timestamp > this.ttl) {
        this.cache.delete(key);
        this.currentSizeBytes -= item.size;
        return false;
      }
      
      return true;
    }
    
    return false;
  }
  
  /**
   * Remove an item from the cache
   */
  public delete(key: string): boolean {
    const item = this.cache.get(key);
    
    if (item) {
      this.cache.delete(key);
      this.currentSizeBytes -= item.size;
      return true;
    }
    
    return false;
  }
  
  /**
   * Clear the entire cache
   */
  public clear(): void {
    this.cache.clear();
    this.currentSizeBytes = 0;
  }
  
  /**
   * Get the size of the cache in bytes
   */
  public size(): number {
    return this.currentSizeBytes;
  }
  
  /**
   * Get the number of items in the cache
   */
  public count(): number {
    return this.cache.size;
  }
  
  /**
   * Add a priority item that should never be evicted
   */
  public addPriorityItem(key: string): void {
    this.priorityItems.add(key);
  }
  
  /**
   * Remove a priority item
   */
  public removePriorityItem(key: string): void {
    this.priorityItems.delete(key);
  }
  
  /**
   * Evict items to make room for a new item
   */
  private evictItems(neededBytes: number): void {
    // Don't evict if we don't need to
    if (this.currentSizeBytes + neededBytes <= this.maxSizeBytes) {
      return;
    }
    
    // Get all non-priority items, sorted by (usage count * recency)
    const sortedItems = Array.from(this.cache.entries())
      .filter(([key]) => !this.priorityItems.has(key))
      .sort((a, b) => {
        // Score items by usage count and recency
        const scoreA = a[1].usageCount * (1 + Math.log10(Date.now() - a[1].lastUsed));
        const scoreB = b[1].usageCount * (1 + Math.log10(Date.now() - b[1].lastUsed));
        return scoreA - scoreB; // Evict less used items first
      });
    
    // Evict items until we have enough space
    let bytesFreed = 0;
    let evictedCount = 0;
    
    sortedItems.forEach(([key, item]) => {
      // Don't exceed what we need
      if (bytesFreed >= neededBytes && this.currentSizeBytes - bytesFreed + neededBytes <= this.maxSizeBytes) {
        return;
      }
      
      this.cache.delete(key);
      bytesFreed += item.size;
      evictedCount++;
    });
    
    this.currentSizeBytes -= bytesFreed;
    logger.debug(`Evicted ${evictedCount} items, freed ${bytesFreed} bytes from cache`);
  }
  
  /**
   * Cleanup expired items
   */
  private cleanup(): void {
    const now = Date.now();
    let expiredCount = 0;
    let freedBytes = 0;
    
    Array.from(this.cache.entries()).forEach(([key, item]) => {
      if (now - item.timestamp > this.ttl && !this.priorityItems.has(key)) {
        this.cache.delete(key);
        freedBytes += item.size;
        expiredCount++;
      }
    });
    
    this.currentSizeBytes -= freedBytes;
    
    if (expiredCount > 0) {
      logger.debug(`Cleaned up ${expiredCount} expired items, freed ${freedBytes} bytes from cache`);
    }
  }
  
  /**
   * Get the key of the oldest item in the cache
   */
  private getOldestKey(): string | null {
    let oldestKey: string | null = null;
    let oldestTimestamp = Date.now();
    
    this.cache.forEach((value, key) => {
      if (value.timestamp < oldestTimestamp && !this.priorityItems.has(key)) {
        oldestTimestamp = value.timestamp;
        oldestKey = key;
      }
    });
    
    return oldestKey;
  }
  
  /**
   * Get cache statistics
   */
  public getStats(): { size: number; itemCount: number; priorityItems: number; ttl: number } {
    return {
      size: this.currentSizeBytes,
      itemCount: this.cache.size,
      priorityItems: this.priorityItems.size,
      ttl: this.ttl
    };
  }
}

// Create singleton instance
const responseCache = new ResponseCache();

export default responseCache;
