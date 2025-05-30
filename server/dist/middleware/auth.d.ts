import { Request, Response, NextFunction } from 'express';
interface AuthenticatedRequest extends Request {
    user?: any;
}
export declare const authenticate: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void | Response<any, Record<string, any>>>;
export {};
