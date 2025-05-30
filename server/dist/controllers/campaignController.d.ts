import { Request, Response } from 'express';
export declare const createCampaign: (req: Request & {
    user?: any;
}, res: Response) => Promise<void>;
export declare const getCampaigns: (req: Request & {
    user?: any;
}, res: Response) => Promise<void>;
export declare const getCampaignById: (req: Request & {
    user?: any;
}, res: Response) => Promise<Response>;
export declare const updateCampaign: (req: Request & {
    user?: any;
}, res: Response) => Promise<Response>;
export declare const deleteCampaign: (req: Request & {
    user?: any;
}, res: Response) => Promise<Response>;
export declare const generateScript: (req: Request & {
    user?: any;
}, res: Response) => Promise<Response>;
export declare const testScript: (_req: Request & {
    user?: any;
}, res: Response) => Promise<Response>;
export declare const getCampaignAnalytics: (_req: Request & {
    user?: any;
}, res: Response) => Promise<Response>;
