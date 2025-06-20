// Type declarations for Fastify
declare module 'fastify' {
  export interface FastifyInstance {
    register(plugin: any, options?: any): FastifyInstance;
    get(path: string, handler: (request: any, reply: any) => void): void;
    get(path: string, options: any, handler: (request: any, reply: any) => void): void;
    post(path: string, handler: (request: any, reply: any) => void): void;
    post(path: string, options: any, handler: (request: any, reply: any) => void): void;
    put(path: string, handler: (request: any, reply: any) => void): void;
    put(path: string, options: any, handler: (request: any, reply: any) => void): void;
    delete(path: string, handler: (request: any, reply: any) => void): void;
    delete(path: string, options: any, handler: (request: any, reply: any) => void): void;
    use(middleware: any): void;
    listen(options: any): Promise<string>;
    addHook(name: string, hook: any): void;
    setNotFoundHandler(handler: any): void;
    setErrorHandler(handler: any): void;
    decorate(name: string, value: any): void;
    decorateRequest(name: string, value: any): void;
    decorateReply(name: string, value: any): void;
    auth?: (handlers: any[]) => any;
    jwt?: any;
    log: any;
    websocketServer: any;
  }

  export interface FastifyReply {
    status(code: number): FastifyReply;
    header(name: string, value: string): FastifyReply;
    send(data: any): void;
    type(contentType: string): FastifyReply;
    code(statusCode: number): FastifyReply;
    redirect(url: string): void;
    raw: any;
  }

  export interface FastifyRequest {
    params: Record<string, any>;
    query: Record<string, any>;
    body: any;
    headers: Record<string, any>;
    ip: string;
    log: any;
    raw: any;
    id: string;
    socket: any;
    connection: any;
    user?: any;
    jwtVerify?: () => Promise<void>;
  }

  export default function fastify(options?: any): FastifyInstance;
}

// Type declarations for MongoDB
declare module 'mongodb' {
  export class MongoClient {
    constructor(url: string, options?: any);
    connect(): Promise<MongoClient>;
    db(name?: string): Db;
    close(): Promise<void>;
  }

  export class Db {
    collection<T = any>(name: string): Collection<T>;
  }

  export class Collection<T = any> {
    find(query?: any): Cursor<T>;
    findOne(query: any): Promise<T | null>;
    insertOne(doc: any): Promise<any>;
    insertMany(docs: any[]): Promise<any>;
    updateOne(filter: any, update: any, options?: any): Promise<any>;
    updateMany(filter: any, update: any, options?: any): Promise<any>;
    deleteOne(filter: any): Promise<any>;
    deleteMany(filter: any): Promise<any>;
    aggregate(pipeline: any[]): Cursor<any>;
    countDocuments(filter?: any): Promise<number>;
    estimatedDocumentCount(): Promise<number>;
  }

  export class Cursor<T = any> {
    toArray(): Promise<T[]>;
    forEach(callback: (doc: T) => void): Promise<void>;
    map<U>(transform: (doc: T) => U): Cursor<U>;
    limit(value: number): Cursor<T>;
    skip(value: number): Cursor<T>;
    sort(sort: any): Cursor<T>;
    project(projection: any): Cursor<T>;
  }

  export class ObjectId {
    constructor(id?: string | Buffer);
    toString(): string;
  }
}

// Type declarations for mathjs
declare module 'mathjs' {
  export function mean(values: number[]): number;
  export function std(values: number[]): number;
  export function median(values: number[]): number;
  export function quantileSeq(values: number[], prob: number | number[]): number | number[];
  export function sum(values: number[]): number;
  export function variance(values: number[]): number;
  export function mode(values: number[]): number[];
  export function min(values: number[]): number;
  export function max(values: number[]): number;
  export function mad(values: number[]): number;
  export function abs(value: number): number;
  export function sqrt(value: number): number;
  export function pow(base: number, exponent: number): number;
  export function log(value: number, base?: number): number;
  export function exp(value: number): number;
  export function round(value: number, precision?: number): number;
  export function floor(value: number): number;
  export function ceil(value: number): number;
  export function multiply(a: number | number[], b: number | number[]): number | number[];
  export function divide(a: number | number[], b: number | number[]): number | number[];
  export function add(a: number | number[], b: number | number[]): number | number[];
  export function subtract(a: number | number[], b: number | number[]): number | number[];
}

// Type declarations for ml-regression-simple-linear
declare module 'ml-regression-simple-linear' {
  export default class SimpleLinearRegression {
    constructor(x: number[], y: number[]);
    predict(x: number | number[]): number | number[];
    slope: number;
    intercept: number;
    coefficients: number[];
    toString(precision?: number): string;
    toLaTeX(precision?: number): string;
    score(x: number[], y: number[]): { r: number; r2: number; chi2: number; rmsd: number };
  }
}

// Type declarations for Fastify plugins
declare module '@fastify/cors' {
  export default function cors(options?: any): any;
}

declare module '@fastify/helmet' {
  export default function helmet(options?: any): any;
}

declare module '@fastify/rate-limit' {
  export default function rateLimit(options?: any): any;
}

declare module '@fastify/compress' {
  export default function compress(options?: any): any;
}

declare module '@fastify/multipart' {
  export default function multipart(options?: any): any;
}

declare module '@fastify/websocket' {
  export default function websocket(options?: any): any;
}

declare module '@fastify/http-proxy' {
  export default function httpProxy(options?: any): any;
}

declare module 'fastify-circuit-breaker' {
  export default function circuitBreaker(options?: any): any;
}

declare module '@fastify/auth' {
  export default function auth(options?: any): any;
}

declare module '@fastify/jwt' {
  export default function jwt(options?: any): any;
}

// Type declarations for pino
declare module 'pino' {
  export interface Logger {
    info(msg: string, ...args: any[]): void;
    error(msg: string, ...args: any[]): void;
    warn(msg: string, ...args: any[]): void;
    debug(msg: string, ...args: any[]): void;
    trace(msg: string, ...args: any[]): void;
    fatal(msg: string, ...args: any[]): void;
    child(bindings: Record<string, any>): Logger;
  }

  export default function pino(options?: any): Logger;
}
