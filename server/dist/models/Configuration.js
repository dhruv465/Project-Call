"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const ConfigurationSchema = new mongoose_1.default.Schema({
    twilioConfig: {
        accountSid: {
            type: String,
            required: false,
            default: '',
        },
        authToken: {
            type: String,
            required: false,
            default: '',
        },
        phoneNumbers: {
            type: [String],
            default: [],
        },
        isEnabled: {
            type: Boolean,
            default: false,
        },
    },
    elevenLabsConfig: {
        apiKey: {
            type: String,
            required: false,
            default: '',
        },
        availableVoices: [
            {
                voiceId: {
                    type: String,
                    required: true,
                },
                name: {
                    type: String,
                    required: true,
                },
                previewUrl: {
                    type: String,
                },
            },
        ],
        isEnabled: {
            type: Boolean,
            default: false,
        },
    },
    llmConfig: {
        providers: [
            {
                name: {
                    type: String,
                    required: true,
                },
                apiKey: {
                    type: String,
                    required: false,
                    default: '',
                },
                availableModels: {
                    type: [String],
                    required: true,
                },
                isEnabled: {
                    type: Boolean,
                    default: true,
                },
            },
        ],
        defaultProvider: {
            type: String,
            required: [true, 'Please specify a default LLM provider'],
            default: 'OpenAI',
        },
        defaultModel: {
            type: String,
            required: [true, 'Please specify a default LLM model'],
            default: 'gpt-4o',
        },
    },
    generalSettings: {
        defaultLanguage: {
            type: String,
            required: [true, 'Please specify a default language'],
            default: 'English',
        },
        supportedLanguages: {
            type: [String],
            required: [true, 'Please specify supported languages'],
            default: ['English', 'Hindi'],
        },
        maxConcurrentCalls: {
            type: Number,
            default: 10,
            min: 1,
            max: 100,
        },
        callRetryAttempts: {
            type: Number,
            default: 3,
            min: 0,
            max: 10,
        },
        callRetryDelay: {
            type: Number,
            default: 60, // in minutes
            min: 15,
            max: 1440,
        },
        workingHours: {
            start: {
                type: String,
                default: '09:00',
            },
            end: {
                type: String,
                default: '18:00',
            },
            timeZone: {
                type: String,
                default: 'Asia/Kolkata',
            },
            daysOfWeek: {
                type: [String],
                enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
                default: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
            },
        },
    },
    complianceSettings: {
        recordCalls: {
            type: Boolean,
            default: true,
        },
        callIntroduction: {
            type: String,
            default: 'Hello, this is an automated call from [Company Name]. This call may be recorded for quality and training purposes.',
        },
        maxCallsPerLeadPerDay: {
            type: Number,
            default: 1,
            min: 1,
            max: 5,
        },
        callBlackoutPeriod: {
            start: {
                type: String,
                default: '21:00',
            },
            end: {
                type: String,
                default: '08:00',
            },
        },
    },
    updatedBy: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: 'User',
        required: false,
    },
}, { timestamps: true });
const Configuration = mongoose_1.default.model('Configuration', ConfigurationSchema);
exports.default = Configuration;
//# sourceMappingURL=Configuration.js.map