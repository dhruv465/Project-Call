import { Request, Response } from 'express';
export declare const initiateCall: (req: Request & {
    user?: any;
}, res: Response) => Promise<Response>;
export declare const getCallHistory: (req: Request & {
    user?: any;
}, res: Response) => Promise<Response>;
export declare const getCallById: (req: Request, res: Response) => Promise<Response>;
export declare const getCallRecording: (req: Request, res: Response) => Promise<Response>;
export declare const getCallTranscript: (req: Request, res: Response) => Promise<Response>;
export declare const scheduleCallback: (req: Request & {
    user?: any;
}, res: Response) => Promise<Response>;
export declare const getCallAnalytics: (req: Request, res: Response) => Promise<Response>;
export declare const exportCalls: (req: Request & {
    user?: any;
}, res: Response) => Promise<Response>;
export declare const createTestCall: (req: Request & {
    user?: any;
}, res: Response) => Promise<Response>;
