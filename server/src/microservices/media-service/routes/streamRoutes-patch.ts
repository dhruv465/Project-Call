// Quick fix patch for streamRoutes.ts

import { FastifyInstance } from 'fastify';
import { RedisClientType } from 'redis';
import { Worker } from 'worker_threads';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { FastifyRequest, FastifyReply } from '../types/api';
import { WebSocket } from 'ws';

// Helper function to get error message from unknown error
function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// Apply these global string replacements to fix all errors:
//
// 1. Replace all instances of (connection: SocketStream, req) with (connection: SocketStream, req: any)
// 2. Replace all instances of worker.postMessage({ with if (worker) { worker.postMessage({
// 3. Add corresponding closing braces for the if statements
// 4. Replace all instances of .message}`); with instanceof Error ? error.message : String(error)}`);
// 5. Replace all instances of (err) => with (err: any) =>
// 6. Replace all instances of (message) => with (message: any) =>
// 7. Replace all instances of (request, reply, done) => with (request: any, reply: any, done: any) =>

export { getErrorMessage };
