import { Request, Response } from 'express';
export declare const getSystemConfiguration: (_req: Request, res: Response) => Promise<void>;
export declare const updateSystemConfiguration: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getLLMOptions: (_req: Request, res: Response) => Promise<void>;
export declare const getVoiceOptions: (_req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const testLLMConnection: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const testTwilioConnection: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const testElevenLabsConnection: (req: Request, res: Response) => Promise<Response<any, Record<string, any>>>;
