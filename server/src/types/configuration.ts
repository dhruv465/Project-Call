// Configuration type definitions

// LLM Provider Types
export interface BaseLLMProvider {
  name: string;
  apiKey: string;
  availableModels: string[];
  isEnabled: boolean;
  lastVerified?: Date;
  status?: 'unverified' | 'verified' | 'failed';
}

export interface UpdateLLMProvider {
  name: string;
  apiKey?: string;
  availableModels?: string[];
  isEnabled?: boolean;
  lastVerified?: Date;
  status?: 'unverified' | 'verified' | 'failed';
}

export interface LLMConfig {
  providers: BaseLLMProvider[];
  defaultProvider: string;
  defaultModel: string;
  temperature: number;
  maxTokens: number;
}

// Voice Configuration Types
export interface VoiceConfig {
  voiceId: string;
  name: string;
  previewUrl: string;
}

export interface ElevenLabsConfig {
  apiKey: string;
  availableVoices: VoiceConfig[];
  isEnabled: boolean;
  voiceSpeed: number;
  voiceStability: number;
  voiceClarity: number;
  lastVerified?: Date;
  status?: 'unverified' | 'verified' | 'failed';
}

// Communication Provider Types
export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  phoneNumbers: string[];
  isEnabled: boolean;
  lastVerified?: Date;
  status?: 'unverified' | 'verified' | 'failed';
}

// Webhook Configuration
export interface WebhookConfig {
  url: string;
  secret: string;
  lastVerified?: Date;
  status?: 'unverified' | 'verified' | 'failed';
}

// Working Hours Configuration
export interface WorkingHours {
  start: string;
  end: string;
  timeZone: string;
  daysOfWeek: string[];
}

// General Settings
export interface GeneralSettings {
  defaultLanguage: string;
  supportedLanguages: string[];
  maxConcurrentCalls: number;
  callRetryAttempts: number;
  callRetryDelay: number;
  maxCallDuration: number;
  defaultSystemPrompt: string;
  defaultTimeZone: string;
  workingHours: WorkingHours;
}

// Compliance Settings
export interface ComplianceSettings {
  recordCalls: boolean;
  callIntroduction: string;
  maxCallsPerLeadPerDay: number;
  callBlackoutPeriod: {
    start: string;
    end: string;
  };
}

// Full Configuration Interface
export interface IConfiguration {
  twilioConfig: TwilioConfig;
  elevenLabsConfig: ElevenLabsConfig;
  llmConfig: LLMConfig;
  generalSettings: GeneralSettings;
  complianceSettings: ComplianceSettings;
  webhookConfig: WebhookConfig;
  toObject(): any;
  save(): Promise<any>;
}

// Update Configuration Interface
export interface UpdatedConfig {
  twilioConfig?: Partial<TwilioConfig>;
  elevenLabsConfig?: Partial<ElevenLabsConfig>;
  llmConfig?: {
    providers?: UpdateLLMProvider[];
    defaultProvider?: string;
    defaultModel?: string;
    temperature?: number;
    maxTokens?: number;
  };
  generalSettings?: Partial<GeneralSettings>;
  complianceSettings?: Partial<ComplianceSettings>;
  webhookConfig?: Partial<WebhookConfig>;
}
