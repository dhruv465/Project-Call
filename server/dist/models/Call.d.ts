import mongoose from 'mongoose';
export interface ICall extends mongoose.Document {
    campaign: mongoose.Schema.Types.ObjectId;
    lead: mongoose.Schema.Types.ObjectId;
    twilioCallSid: string;
    status: string;
    outcome: string;
    startTime: Date;
    endTime?: Date;
    duration: number;
    recordingUrl?: string;
    transcript?: string;
    conversationLog: {
        role: string;
        content: string;
        timestamp: Date;
    }[];
    customerIntents: string[];
    sentiment: string;
    callback?: {
        scheduled: boolean;
        dateTime: Date;
        notes: string;
    };
    notes?: string;
    createdBy: mongoose.Schema.Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}
declare const Call: mongoose.Model<ICall, {}, {}, {}, mongoose.Document<unknown, {}, ICall> & ICall & {
    _id: mongoose.Types.ObjectId;
}, any>;
export default Call;
