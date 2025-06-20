declare module '@fastify/websocket' {
  import { FastifyPluginCallback, FastifyRequest, FastifyReply } from 'fastify';
  import { WebSocket } from 'ws';
  
  interface WebSocketConnection {
    socket: WebSocket;
  }
  
  interface FastifyWebSocketOptions {}
  
  const websocketPlugin: FastifyPluginCallback<FastifyWebSocketOptions>;
  export default websocketPlugin;
  
  // Add WebSocket support to Fastify routes
  declare module 'fastify' {
    interface RouteShorthandOptions {
      websocket?: boolean;
    }
  }
}
