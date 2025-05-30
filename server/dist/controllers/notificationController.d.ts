import { Request, Response } from 'express';
export declare const getCallNotifications: (req: Request & {
    user?: any;
}, res: Response) => Promise<void>;
export declare const markNotificationsAsRead: (_req: Request & {
    user?: any;
}, res: Response) => Promise<void>;
export declare const sendCallNotification: (call: any) => void;
declare const _default: {
    getCallNotifications: (req: Request & {
        user?: any;
    }, res: Response) => Promise<void>;
    markNotificationsAsRead: (_req: Request & {
        user?: any;
    }, res: Response) => Promise<void>;
    sendCallNotification: (call: any) => void;
};
export default _default;
