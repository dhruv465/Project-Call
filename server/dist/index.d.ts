import { Server as SocketIOServer } from 'socket.io';
import winston from 'winston';
declare const logger: winston.Logger;
declare const app: import("express-serve-static-core").Express;
declare const io: SocketIOServer<import("socket.io").DefaultEventsMap, import("socket.io").DefaultEventsMap, import("socket.io").DefaultEventsMap, any>;
export { app, io, logger };
