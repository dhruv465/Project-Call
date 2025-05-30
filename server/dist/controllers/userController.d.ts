import { Request, Response } from 'express';
export declare const createUser: (req: Request, res: Response) => Promise<Response>;
export declare const loginUser: (req: Request, res: Response) => Promise<Response>;
export declare const getUserProfile: (req: Request & {
    user?: any;
}, res: Response) => Promise<Response>;
export declare const updateUserProfile: (req: Request & {
    user?: any;
}, res: Response) => Promise<Response>;
export declare const getAllUsers: (req: Request & {
    user?: any;
}, res: Response) => Promise<Response>;
