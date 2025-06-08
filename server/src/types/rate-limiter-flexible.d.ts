declare module 'rate-limiter-flexible' {
  export interface RateLimiterOptions {
    points: number;
    duration: number;
    blockDuration?: number;
    keyPrefix?: string;
    storeClient?: any;
    inmemoryBlockOnConsumed?: number;
    inmemoryBlockDuration?: number;
    insuranceLimiter?: any;
    nbf?: number;
    clientId?: string;
    isRedisCluster?: boolean;
    timeoutMs?: number;
    execEvenly?: boolean;
    execEvenlyMinDelayMs?: number;
    indexKeys?: Array<string>;
    omitResponseHeaders?: boolean;
    enableDrafts?: boolean;
  }

  export class RateLimiterRedis {
    constructor(options: RateLimiterOptions);
    consume(key: string, points?: number): Promise<any>;
    block(key: string, secDuration: number): Promise<any>;
    penalty(key: string, points?: number): Promise<any>;
    reward(key: string, points?: number): Promise<any>;
    get(key: string): Promise<any>;
    delete(key: string): Promise<any>;
  }

  export class RateLimiterMemory {
    constructor(options: RateLimiterOptions);
    consume(key: string, points?: number): Promise<any>;
    block(key: string, secDuration: number): Promise<any>;
    penalty(key: string, points?: number): Promise<any>;
    reward(key: string, points?: number): Promise<any>;
    get(key: string): Promise<any>;
    delete(key: string): Promise<any>;
  }

  export class RateLimiterMongo {
    constructor(options: RateLimiterOptions);
    consume(key: string, points?: number): Promise<any>;
    block(key: string, secDuration: number): Promise<any>;
    penalty(key: string, points?: number): Promise<any>;
    reward(key: string, points?: number): Promise<any>;
    get(key: string): Promise<any>;
    delete(key: string): Promise<any>;
  }
}
