import mongoose from 'mongoose';
export interface IConfiguration extends mongoose.Document {
    twilioConfig: {
        accountSid: string;
        authToken: string;
        phoneNumbers: string[];
        isEnabled: boolean;
    };
    elevenLabsConfig: {
        apiKey: string;
        availableVoices: {
            voiceId: string;
            name: string;
            previewUrl: string;
        }[];
        isEnabled: boolean;
    };
    llmConfig: {
        providers: {
            name: string;
            apiKey: string;
            availableModels: string[];
            isEnabled: boolean;
        }[];
        defaultProvider: string;
        defaultModel: string;
    };
    generalSettings: {
        defaultLanguage: string;
        supportedLanguages: string[];
        maxConcurrentCalls: number;
        callRetryAttempts: number;
        callRetryDelay: number;
        workingHours: {
            start: string;
            end: string;
            timeZone: string;
            daysOfWeek: string[];
        };
    };
    complianceSettings: {
        recordCalls: boolean;
        callIntroduction: string;
        maxCallsPerLeadPerDay: number;
        callBlackoutPeriod: {
            start: string;
            end: string;
        };
    };
    updatedBy: mongoose.Schema.Types.ObjectId;
    createdAt: Date;
    updatedAt: Date;
}
declare const Configuration: mongoose.Model<IConfiguration, {}, {}, {}, mongoose.Document<unknown, {}, IConfiguration> & IConfiguration & {
    _id: mongoose.Types.ObjectId;
}, any>;
export default Configuration;
