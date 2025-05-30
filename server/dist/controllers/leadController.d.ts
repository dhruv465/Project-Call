import { Request, Response } from 'express';
export declare const uploadLeads: (req: Request & {
    user?: any;
}, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getLeads: (req: Request & {
    user?: any;
}, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const getLeadById: (req: Request & {
    user?: any;
}, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const updateLead: (req: Request & {
    user?: any;
}, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const deleteLead: (req: Request & {
    user?: any;
}, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const importLeadsFromCSV: (req: Request & {
    user?: any;
    file?: Express.Multer.File;
}, res: Response) => Promise<void>;
export declare const getLeadAnalytics: (_req: Request & {
    user?: any;
}, res: Response) => Promise<Response<any, Record<string, any>>>;
export declare const exportLeads: (req: Request & {
    user?: any;
}, res: Response) => Promise<Response<any, Record<string, any>>>;
