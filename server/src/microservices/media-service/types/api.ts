// Type declarations for request handlers in the microservices
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
  file?: any;
  files?: any[];
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

// Type declarations for error handling
export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

export interface WorkerPool {
  getWorker(): Promise<any>;
  releaseWorker(worker: any): void;
  terminateAll(): Promise<void>;
  runTask(task: string, data: any): Promise<any>;
}

export interface Session {
  id: string;
  socketId: string;
  callId?: string;
  userId?: string;
  active: boolean;
  createdAt: Date;
  lastActive: Date;
}

export interface ErrorResponse {
  status: 'error';
  code: number;
  message: string;
  details?: any;
}

export interface SuccessResponse<T> {
  status: 'success';
  data: T;
}

export type ApiResponse<T> = ErrorResponse | SuccessResponse<T>;
