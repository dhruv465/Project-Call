import { Request, Response } from 'express';
export declare const getDashboardOverview: (req: Request & {
    user?: any;
}, res: Response) => Promise<void>;
export declare const getCallMetrics: (_req: Request & {
    user?: any;
}, res: Response) => Promise<void>;
export declare const getLeadMetrics: (_req: Request & {
    user?: any;
}, res: Response) => Promise<void>;
export declare const getAgentPerformance: (_req: Request & {
    user?: any;
}, res: Response) => Promise<void>;
export declare const getGeographicalDistribution: (_req: Request & {
    user?: any;
}, res: Response) => Promise<void>;
export declare const getTimeSeriesData: (req: Request & {
    user?: any;
}, res: Response) => Promise<void>;
export declare const exportDashboardData: (req: Request & {
    user?: any;
}, res: Response) => Promise<Response<any, Record<string, any>>>;
