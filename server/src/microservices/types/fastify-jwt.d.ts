import { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    jwtVerify(): Promise<void>;
    user?: any;
  }
  
  interface FastifyInstance {
    auth(handler: (request: FastifyRequest, reply: FastifyReply) => Promise<void>): void;
    jwt: {
      sign(payload: object): string;
      verify(token: string): any;
    };
  }
}
