import winston from 'winston';
declare const logger: winston.Logger;
declare const logStream: {
    write: (message: string) => void;
};
/**
 * Safely extract error message from unknown error type
 */
export declare function getErrorMessage(error: unknown): string;
export default logger;
export { logStream };
