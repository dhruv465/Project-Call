"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const CampaignSchema = new mongoose_1.default.Schema({
    name: {
        type: String,
        required: [true, 'Please provide a campaign name'],
        trim: true,
        maxlength: [100, 'Name cannot be more than 100 characters'],
    },
    description: {
        type: String,
        required: [true, 'Please provide a campaign description'],
    },
    goal: {
        type: String,
        required: [true, 'Please provide a campaign goal'],
    },
    targetAudience: {
        type: String,
        required: [true, 'Please define the target audience'],
    },
    script: {
        versions: [
            {
                name: {
                    type: String,
                    required: true,
                },
                content: {
                    type: String,
                    required: true,
                },
                isActive: {
                    type: Boolean,
                    default: false,
                },
                performance: {
                    successRate: Number,
                    avgCallDuration: Number,
                    conversionRate: Number,
                },
            },
        ],
    },
    leadSources: {
        type: [String],
        required: [true, 'Please specify at least one lead source'],
    },
    status: {
        type: String,
        enum: ['Draft', 'Active', 'Paused', 'Completed'],
        default: 'Draft',
    },
    startDate: {
        type: Date,
        required: [true, 'Please specify a start date'],
    },
    endDate: {
        type: Date,
    },
    primaryLanguage: {
        type: String,
        required: [true, 'Please specify the primary language'],
        default: 'English',
    },
    supportedLanguages: {
        type: [String],
        default: ['English'],
    },
    callTiming: {
        daysOfWeek: {
            type: [String],
            enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
            default: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        },
        startTime: {
            type: String,
            default: '09:00',
        },
        endTime: {
            type: String,
            default: '17:00',
        },
        timeZone: {
            type: String,
            default: 'Asia/Kolkata',
        },
    },
    llmConfiguration: {
        model: {
            type: String,
            required: [true, 'Please specify an LLM model'],
            default: 'gpt-4o',
        },
        systemPrompt: {
            type: String,
            required: [true, 'Please provide a system prompt'],
        },
        temperature: {
            type: Number,
            default: 0.7,
            min: 0,
            max: 2,
        },
        maxTokens: {
            type: Number,
            default: 500,
        },
    },
    voiceConfiguration: {
        provider: {
            type: String,
            default: 'elevenlabs',
            enum: ['elevenlabs', 'google', 'aws'],
        },
        voiceId: {
            type: String,
            required: [true, 'Please specify a voice ID'],
        },
        speed: {
            type: Number,
            default: 1,
            min: 0.5,
            max: 2,
        },
        pitch: {
            type: Number,
            default: 1,
            min: 0.5,
            max: 2,
        },
    },
    metrics: {
        totalCalls: {
            type: Number,
            default: 0,
        },
        connectedCalls: {
            type: Number,
            default: 0,
        },
        successfulCalls: {
            type: Number,
            default: 0,
        },
        avgCallDuration: {
            type: Number,
            default: 0,
        },
        conversionRate: {
            type: Number,
            default: 0,
        },
    },
    createdBy: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
}, { timestamps: true });
// Index for faster queries
CampaignSchema.index({ status: 1 });
CampaignSchema.index({ createdBy: 1 });
CampaignSchema.index({ startDate: 1 });
CampaignSchema.index({ 'leadSources': 1 });
const Campaign = mongoose_1.default.model('Campaign', CampaignSchema);
exports.default = Campaign;
//# sourceMappingURL=Campaign.js.map