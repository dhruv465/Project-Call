import mongoose from 'mongoose';
export interface ILead extends mongoose.Document {
    name: string;
    phoneNumber: string;
    email?: string;
    company?: string;
    title?: string;
    source: string;
    languagePreference: string;
    status: string;
    notes?: string;
    tags?: string[];
    lastContacted?: Date;
    callCount: number;
    createdAt: Date;
    updatedAt: Date;
}
declare const Lead: mongoose.Model<ILead, {}, {}, {}, mongoose.Document<unknown, {}, ILead> & ILead & {
    _id: mongoose.Types.ObjectId;
}, any>;
export default Lead;
