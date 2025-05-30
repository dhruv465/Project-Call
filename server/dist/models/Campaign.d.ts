import mongoose from 'mongoose';
export interface ICampaign extends mongoose.Document {
    name: string;
    description: string;
    goal: string;
    targetAudience: string;
    script: {
        versions: {
            name: string;
            content: string;
            isActive: boolean;
            performance?: {
                successRate: number;
                avgCallDuration: number;
                conversionRate: number;
            };
        }[];
    };
    leadSources: string[];
    status: string;
    startDate: Date;
    endDate?: Date;
    primaryLanguage: string;
    supportedLanguages: string[];
    callTiming: {
        daysOfWeek: string[];
        startTime: string;
        endTime: string;
        timeZone: string;
    };
    llmConfiguration: {
        model: string;
        systemPrompt: string;
        temperature: number;
        maxTokens: number;
    };
    voiceConfiguration: {
        provider: string;
        voiceId: string;
        speed: number;
        pitch: number;
    };
    metrics: {
        totalCalls: number;
        connectedCalls: number;
        successfulCalls: number;
        avgCallDuration: number;
        conversionRate: number;
    };
    createdBy: mongoose.Schema.Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}
declare const Campaign: mongoose.Model<ICampaign, {}, {}, {}, mongoose.Document<unknown, {}, ICampaign> & ICampaign & {
    _id: mongoose.Types.ObjectId;
}, any>;
export default Campaign;
