declare module 'opossum' {
  interface CircuitBreakerOptions {
    timeout?: number;
    resetTimeout?: number;
    errorThresholdPercentage?: number;
    rollingCountTimeout?: number;
    rollingCountBuckets?: number;
    capacity?: number;
    volumeThreshold?: number;
    name?: string;
    group?: string;
    enabled?: boolean;
    allowWarmUp?: boolean;
    readyToTrip?: (counts: any) => boolean;
    isFailure?: (err: any, args: any) => boolean;
    onClose?: () => void;
    onOpen?: () => void;
    onHalfOpen?: () => void;
    onFallback?: (result: any) => void;
    onSuccess?: (result: any) => void;
    onFailure?: (error: any) => void;
    onTimeout?: (error: any) => void;
    onReject?: (error: any) => void;
    fallback?: (error: any, ...args: any[]) => any;
  }

  interface CircuitBreakerStats {
    failures: number;
    fallbacks: number;
    successes: number;
    rejects: number;
    fires: number;
    timeouts: number;
    cacheHits: number;
    cacheMisses: number;
    semaphoreRejections: number;
    percentiles: {
      [key: string]: number;
    };
    latencyTimes: number[];
    latencyMean: number;
  }

  interface CircuitStatus {
    name: string;
    state: 'closed' | 'open' | 'half-open';
    stats: CircuitBreakerStats;
  }

  class CircuitBreaker {
    constructor(action: Function, options?: CircuitBreakerOptions);
    
    status: CircuitStatus;
    
    fire(...args: any[]): Promise<any>;
    fallback(fn: Function): this;
    open(): this;
    close(): this;
    disable(): this;
    enable(): this;
    isOpen(): boolean;
    isClosed(): boolean;
    isHalfOpen(): boolean;
    
    on(event: string, callback: Function): this;
    
    static isOurError(error: any): boolean;
  }

  export = CircuitBreaker;
}
