import mongoose from 'mongoose';

export interface IConfiguration extends mongoose.Document {
  twilioConfig: {
    accountSid: string;
    authToken: string;
    phoneNumbers: string[];
    isEnabled: boolean;
    lastVerified?: Date | null;
    status?: 'unverified' | 'verified' | 'failed';
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
    lastVerified?: Date | null;
    status?: 'unverified' | 'verified' | 'failed';
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
    conversationalAI: {
      enabled: boolean;
      useSDK: boolean;
      interruptible: boolean;
      adaptiveTone: boolean;
      naturalConversationPacing: boolean;
      voiceSettings: {
        speed: number;
        stability: number;
        style: number;
      };
      defaultVoiceId: string;
      defaultModelId: string;
    };
  };
  llmConfig: {
    providers: {
      name: string;
      apiKey: string;
      availableModels: string[];
      isEnabled: boolean;
      lastVerified?: Date | null;
      status?: 'unverified' | 'verified' | 'failed';
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
    secret: string;
    lastVerified?: Date | null;
    status?: 'unverified' | 'verified' | 'failed';
  };
  configurationVersion?: number;
  lastSystemUpdate?: Date;
  updatedBy: mongoose.Schema.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  
  // Methods
  getMaskedConfig?: () => any;
  deleteApiKey?: (provider: string, name?: string | null) => boolean;
  updateApiKeyStatus?: (provider: string, name: string | null, status: 'unverified' | 'verified' | 'failed', details?: any) => boolean;
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
      lastVerified: {
        type: Date,
        default: null,
      },
      status: {
        type: String,
        enum: ['unverified', 'verified', 'failed'],
        default: 'unverified',
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
      lastVerified: {
        type: Date,
        default: null,
      },
      status: {
        type: String,
        enum: ['unverified', 'verified', 'failed'],
        default: 'unverified',
      },
    },
    voiceAIConfig: {
      personalities: [{
        id: {
          type: String,
          required: true
        },
        name: {
          type: String,
          required: true
        },
        description: {
          type: String,
          default: ''
        },
        voiceId: {
          type: String,
          required: true
        },
        personality: {
          type: String,
          default: 'Professional'
        },
        style: {
          type: String,
          default: 'Conversational'
        },
        emotionalRange: {
          type: [String],
          default: ['neutral', 'happy', 'concerned']
        },
        languageSupport: {
          type: [String],
          default: ['English']
        },
        settings: {
          stability: {
            type: Number,
            default: 0.8,
            min: 0.0,
            max: 1.0
          },
          similarityBoost: {
            type: Number,
            default: 0.75,
            min: 0.0,
            max: 1.0
          },
          style: {
            type: Number,
            default: 0.3,
            min: 0.0,
            max: 1.0
          },
          useSpeakerBoost: {
            type: Boolean,
            default: true
          }
        }
      }],
      emotionDetection: {
        enabled: {
          type: Boolean,
          default: true
        },
        sensitivity: {
          type: Number,
          default: 0.7,
          min: 0.1,
          max: 1.0
        },
        adaptiveResponseThreshold: {
          type: Number,
          default: 0.6,
          min: 0.1,
          max: 1.0
        }
      },
      bilingualSupport: {
        enabled: {
          type: Boolean,
          default: false
        },
        primaryLanguage: {
          type: String,
          default: 'English'
        },
        secondaryLanguage: {
          type: String,
          default: 'Hindi'
        },
        autoLanguageDetection: {
          type: Boolean,
          default: true
        }
      },
      conversationFlow: {
        personalityAdaptation: {
          type: Boolean,
          default: true
        },
        contextAwareness: {
          type: Boolean,
          default: true
        },
        emotionBasedResponses: {
          type: Boolean,
          default: true
        },
        naturalPauses: {
          type: Boolean,
          default: true
        }
      },
      conversationalAI: {
        enabled: {
          type: Boolean,
          default: true
        },
        useSDK: {
          type: Boolean,
          default: true
        },
        interruptible: {
          type: Boolean,
          default: true
        },
        adaptiveTone: {
          type: Boolean,
          default: true
        },
        naturalConversationPacing: {
          type: Boolean,
          default: true
        },
        voiceSettings: {
          speed: {
            type: Number,
            default: 1.0,
            min: 0.5,
            max: 2.0
          },
          stability: {
            type: Number,
            default: 0.75,
            min: 0.0,
            max: 1.0
          },
          style: {
            type: Number,
            default: 0.3,
            min: 0.0,
            max: 1.0
          }
        },
        defaultVoiceId: {
          type: String,
          default: ''
        },
        defaultModelId: {
          type: String,
          default: 'eleven_multilingual_v2'
        }
      }
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
            set: function(val: string) {
              // This ensures that empty strings are properly saved to the database
              // and not converted to null or ignored
              return val === '' ? '' : val;
            }
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
        min: 0,
        max: 2.0,
        default: 0.7,
      },
      maxTokens: {
        type: Number,
        min: 1,
        max: 32000,
        default: 150,
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

// Pre-save hook to ensure empty API keys are properly saved
ConfigurationSchema.pre('save', function(next) {
  try {
    // Ensure empty API keys for LLM providers are saved correctly
    if (this.llmConfig && this.llmConfig.providers) {
      for (let i = 0; i < this.llmConfig.providers.length; i++) {
        // Explicitly check and handle empty API keys
        if (this.llmConfig.providers[i].apiKey === '') {
          // Ensure the field is marked as modified
          this.markModified(`llmConfig.providers.${i}.apiKey`);
        }
      }
    }
    next();
  } catch (err) {
    next(err);
  }
});

const Configuration = mongoose.model<IConfiguration>('Configuration', ConfigurationSchema);

export default Configuration;
