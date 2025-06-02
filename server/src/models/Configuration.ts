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
    voiceSpeed: number;
    voiceStability: number;
    voiceClarity: number;
  };
  voiceAIConfig: {
    personalities: {
      id: string;
      name: string;
      description: string;
      voiceId: string;
      personality: string;
      style: string;
      emotionalRange: string[];
      languageSupport: string[];
      settings: {
        stability: number;
        similarityBoost: number;
        style: number;
        useSpeakerBoost: boolean;
      };
    }[];
    emotionDetection: {
      enabled: boolean;
      sensitivity: number;
      adaptiveResponseThreshold: number;
    };
    bilingualSupport: {
      enabled: boolean;
      primaryLanguage: string;
      secondaryLanguage: string;
      autoLanguageDetection: boolean;
    };
    conversationFlow: {
      personalityAdaptation: boolean;
      contextAwareness: boolean;
      emotionBasedResponses: boolean;
      naturalPauses: boolean;
    };
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
    temperature: number;
    maxTokens: number;
  };
  generalSettings: {
    defaultLanguage: string;
    supportedLanguages: string[];
    maxConcurrentCalls: number;
    callRetryAttempts: number;
    callRetryDelay: number;
    maxCallDuration: number;
    defaultSystemPrompt: string;
    defaultTimeZone: string;
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
  webhookConfig: {
    url: string;
    secret: string;
  };
  updatedBy: mongoose.Schema.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ConfigurationSchema = new mongoose.Schema(
  {
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
      voiceSpeed: {
        type: Number,
        default: 1.0,
        min: 0.25,
        max: 4.0,
      },
      voiceStability: {
        type: Number,
        default: 0.8,
        min: 0.0,
        max: 1.0,
      },
      voiceClarity: {
        type: Number,
        default: 0.9,
        min: 0.0,
        max: 1.0,
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
      temperature: {
        type: Number,
        default: 0.7,
        min: 0.0,
        max: 2.0,
      },
      maxTokens: {
        type: Number,
        default: 150,
        min: 1,
        max: 4000,
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
      maxCallDuration: {
        type: Number,
        default: 300, // in seconds (5 minutes)
        min: 30,
        max: 3600,
      },
      defaultSystemPrompt: {
        type: String,
        default: 'You are a professional sales representative making cold calls. Be polite, respectful, and helpful.',
      },
      defaultTimeZone: {
        type: String,
        default: 'America/New_York',
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
    webhookConfig: {
      url: {
        type: String,
        default: '',
      },
      secret: {
        type: String,
        default: '',
      },
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
    },
  },
  { timestamps: true }
);

const Configuration = mongoose.model<IConfiguration>('Configuration', ConfigurationSchema);

export default Configuration;
