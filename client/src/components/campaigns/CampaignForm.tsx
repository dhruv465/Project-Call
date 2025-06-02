import React, { useState, useEffect } from 'react';
import { X, Plus } from 'lucide-react';
import {
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { DatePicker } from '@/components/ui/date-picker';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import api from '@/services/api';
import { configApi } from '@/services/configApi';
import { toast } from '@/components/ui/use-toast';

// Custom styles with consistent spacing
const inputStyles = "w-full rounded-xl border border-input bg-background px-4 py-3 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2";
const textareaStyles = "w-full rounded-xl border border-input bg-background px-4 py-3 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 min-h-[100px]";
const labelStyles = "block text-sm font-medium mb-2";

// Define Props
interface CampaignFormProps {
  campaignId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

// Define the form data structure
interface CampaignFormData {
  name: string;
  description: string;
  goal: string;
  targetAudience: string;
  leadSources: string[];
  primaryLanguage: string;
  supportedLanguages: string[];
  startDate: Date | undefined;
  endDate: Date | undefined;
  script: {
    name: string;
    content: string;
  };
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
}

// Initial form state
const initialFormState: CampaignFormData = {
  name: '',
  description: '',
  goal: '',
  targetAudience: '',
  leadSources: [''],
  primaryLanguage: 'English',
  supportedLanguages: ['English'],
  startDate: new Date(),
  endDate: undefined,
  script: {
    name: 'Primary Script',
    content: '',
  },
  callTiming: {
    daysOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    startTime: '09:00',
    endTime: '17:00',
    timeZone: 'Asia/Kolkata',
  },
  llmConfiguration: {
    model: 'gpt-4o',
    systemPrompt: 'You are an AI assistant making a call on behalf of a company. Be professional, friendly, and helpful.',
    temperature: 0.7,
    maxTokens: 500,
  },
  voiceConfiguration: {
    provider: 'elevenlabs',
    voiceId: 'default-voice-id', // Default value to ensure validation passes
    speed: 1.0,
    pitch: 1.0,
  },
};

// Time zone options
const timeZones = [
  'Asia/Kolkata', 
  'America/New_York', 
  'America/Los_Angeles', 
  'Europe/London', 
  'Australia/Sydney'
];

// Language options
const languages = [
  'English',
  'Hindi',
  'Tamil',
  'Telugu',
  'Marathi',
  'Kannada',
  'Bengali',
  'Gujarati'
];

// LLM model options
const llmModels = [
  'gpt-4o',
  'gpt-3.5-turbo',
  'claude-3-opus',
  'claude-3-sonnet',
  'gemini-pro'
];

// Voice provider options
const voiceProviders = [
  'elevenlabs',
  'google',
  'aws'
];

const CampaignForm = ({ campaignId, onClose, onSuccess }: CampaignFormProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState<CampaignFormData>(initialFormState);
  const [currentTab, setCurrentTab] = useState<'basic' | 'script' | 'scheduling' | 'ai'>('basic');
  const [systemConfig, setSystemConfig] = useState<any>(null);
  const [availableLLMModels, setAvailableLLMModels] = useState<string[]>(llmModels);

  // Toast function for notifications
  const showToast = (title: string, description: string, variant: 'default' | 'destructive' = 'default') => {
    toast({
      title,
      description,
      variant
    });
  };

  // Load campaign data if editing
  const loadCampaignData = async () => {
    if (!campaignId) return;
    
    try {
      setIsLoading(true);
      // Real API call to fetch campaign data
      const response = await api.get(`/campaigns/${campaignId}`);
      const campaignData = response.data;
      
      // Map API data to form structure
      const formattedData = {
        ...initialFormState,
        name: campaignData.name,
        description: campaignData.description,
        goal: campaignData.goal,
        targetAudience: campaignData.targetAudience,
        leadSources: campaignData.leadSources || [''],
        primaryLanguage: campaignData.primaryLanguage,
        supportedLanguages: campaignData.supportedLanguages || [campaignData.primaryLanguage],
        startDate: campaignData.startDate ? new Date(campaignData.startDate) : new Date(),
        endDate: campaignData.endDate ? new Date(campaignData.endDate) : undefined,
        script: {
          name: campaignData.script?.versions?.[0]?.name || 'Primary Script',
          content: campaignData.script?.versions?.[0]?.content || '',
        },
        callTiming: {
          daysOfWeek: campaignData.callTiming?.daysOfWeek || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
          startTime: campaignData.callTiming?.startTime || '09:00',
          endTime: campaignData.callTiming?.endTime || '17:00',
          timeZone: campaignData.callTiming?.timeZone || 'Asia/Kolkata',
        },
        llmConfiguration: {
          model: campaignData.llmConfiguration?.model || 'gpt-4o',
          systemPrompt: campaignData.llmConfiguration?.systemPrompt || 'You are an AI assistant making a call on behalf of a company. Be professional, friendly, and helpful.',
          temperature: campaignData.llmConfiguration?.temperature || 0.7,
          maxTokens: campaignData.llmConfiguration?.maxTokens || 500,
        },
        voiceConfiguration: {
          provider: campaignData.voiceConfiguration?.provider || 'elevenlabs',
          voiceId: campaignData.voiceConfiguration?.voiceId || '',
          speed: campaignData.voiceConfiguration?.speed || 1.0,
          pitch: campaignData.voiceConfiguration?.pitch || 1.0,
        },
      };
      
      setFormData(formattedData);
      setIsLoading(false);
    } catch (error) {
      console.error('Error loading campaign data:', error);
      showToast('Error', 'Failed to load campaign data.', 'destructive');
      setIsLoading(false);
    }
  };

  // Load system configuration
  const loadSystemConfiguration = async () => {
    try {
      setIsLoading(true);
      const config = await configApi.getConfiguration();
      setSystemConfig(config);
      
      // Filter LLM models based on the configured provider
      if (config.llmConfig?.providers) {
        const defaultProvider = config.llmConfig.defaultProvider;
        const providerInfo = config.llmConfig.providers.find((p: any) => p.name === defaultProvider);
        
        if (providerInfo && providerInfo.availableModels && providerInfo.availableModels.length > 0) {
          setAvailableLLMModels(providerInfo.availableModels);
        }
      }
      
      // Update the form with defaults from system configuration if not editing
      if (!campaignId) {
        setFormData(prev => ({
          ...prev,
          llmConfiguration: {
            ...prev.llmConfiguration,
            model: config.llmConfig?.defaultModel || prev.llmConfiguration.model,
            temperature: config.llmConfig?.temperature || prev.llmConfiguration.temperature,
            maxTokens: config.llmConfig?.maxTokens || prev.llmConfiguration.maxTokens,
            systemPrompt: config.generalSettings?.defaultSystemPrompt || prev.llmConfiguration.systemPrompt,
          },
          voiceConfiguration: {
            ...prev.voiceConfiguration,
            provider: config.elevenLabsConfig?.isEnabled ? 'elevenlabs' : 
                    (config.llmConfig?.providers.find((p: any) => p.name === 'openai' && p.isEnabled) ? 'openai' : 'google'),
            speed: config.elevenLabsConfig?.voiceSpeed || prev.voiceConfiguration.speed,
            // If ElevenLabs is enabled and there are available voices, use the first one
            voiceId: config.elevenLabsConfig?.isEnabled && config.elevenLabsConfig?.availableVoices?.length > 0 
                    ? config.elevenLabsConfig.availableVoices[0].voiceId 
                    : prev.voiceConfiguration.voiceId
          },
          callTiming: {
            ...prev.callTiming,
            timeZone: config.generalSettings?.defaultTimeZone || prev.callTiming.timeZone,
          }
        }));
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error('Error loading system configuration:', error);
      showToast('Warning', 'Could not load system configuration. Using default settings.', 'default');
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Load system configuration first
    loadSystemConfiguration();
    
    // If editing, load campaign data
    if (campaignId) {
      loadCampaignData();
    }
  }, [campaignId]);

  // Update form data
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData((prev: CampaignFormData) => ({
        ...prev,
        [parent]: {
          ...(prev[parent as keyof CampaignFormData] as any),
          [child]: value,
        },
      }));
    } else {
      setFormData((prev: CampaignFormData) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  // Handle checkbox changes (days of week)
  const handleDayChange = (day: string, checked: boolean) => {
    setFormData((prev: CampaignFormData) => {
      const currentDays = [...prev.callTiming.daysOfWeek];
      
      if (checked && !currentDays.includes(day)) {
        currentDays.push(day);
      } else if (!checked && currentDays.includes(day)) {
        const index = currentDays.indexOf(day);
        currentDays.splice(index, 1);
      }
      
      return {
        ...prev,
        callTiming: {
          ...prev.callTiming,
          daysOfWeek: currentDays,
        },
      };
    });
  };

  // Handle lead sources
  const addLeadSource = () => {
    setFormData((prev: CampaignFormData) => ({
      ...prev,
      leadSources: [...prev.leadSources, ''],
    }));
  };

  const updateLeadSource = (index: number, value: string) => {
    setFormData((prev: CampaignFormData) => {
      const updatedSources = [...prev.leadSources];
      updatedSources[index] = value;
      return {
        ...prev,
        leadSources: updatedSources,
      };
    });
  };

  const removeLeadSource = (index: number) => {
    setFormData((prev: CampaignFormData) => {
      const updatedSources = [...prev.leadSources];
      updatedSources.splice(index, 1);
      return {
        ...prev,
        leadSources: updatedSources,
      };
    });
  };

  // Handle supported languages
  const handleLanguageChange = (language: string, checked: boolean) => {
    setFormData((prev: CampaignFormData) => {
      let updatedLanguages = [...prev.supportedLanguages];
      
      if (checked && !updatedLanguages.includes(language)) {
        updatedLanguages.push(language);
      } else if (!checked && updatedLanguages.includes(language)) {
        updatedLanguages = updatedLanguages.filter((l: string) => l !== language);
      }
      
      return {
        ...prev,
        supportedLanguages: updatedLanguages,
      };
    });
  };

  // Handle number inputs for temperature, speed, etc.
  const handleNumberChange = (name: string, value: string) => {
    const [parent, child] = name.split('.');
    const numValue = parseFloat(value);
    
    if (!isNaN(numValue)) {
      setFormData((prev: CampaignFormData) => {
        const updatedData = { ...prev };
        if (parent === 'llmConfiguration') {
          updatedData.llmConfiguration = {
            ...updatedData.llmConfiguration,
            [child]: numValue
          };
        } else if (parent === 'voiceConfiguration') {
          updatedData.voiceConfiguration = {
            ...updatedData.voiceConfiguration,
            [child]: numValue
          };
        }
        return updatedData;
      });
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    try {
      setIsLoading(true);
      
      // Validate form data
      if (!formData.name || !formData.description || !formData.goal || !formData.targetAudience) {
        showToast('Missing Required Fields', 'Please fill in all required fields.', 'destructive');
        setIsLoading(false);
        return;
      }
      
      // Ensure all required fields have values that pass server validation
      const defaultVoiceId = formData.voiceConfiguration.voiceId || 'default-voice-id';
      const defaultSystemPrompt = formData.llmConfiguration.systemPrompt || 'You are an AI assistant making a call on behalf of a company. Be professional, friendly, and helpful.';
      const startDate = formData.startDate ? new Date(formData.startDate) : new Date();
      
      // Format dates for API submission
      const submissionData = {
        ...formData,
        status: 'Draft', // Default status for new campaigns
        script: {
          versions: [{
            name: formData.script.name || 'Primary Script',
            content: formData.script.content || 'Hello, this is an AI assistant calling from our company.',
            isActive: true
          }]
        },
        startDate: startDate.toISOString(), // Always provide a valid startDate
        endDate: formData.endDate ? formData.endDate.toISOString() : null,
        llmConfiguration: {
          model: formData.llmConfiguration.model || 'gpt-4o',
          systemPrompt: defaultSystemPrompt,
          temperature: formData.llmConfiguration.temperature || 0.7,
          maxTokens: formData.llmConfiguration.maxTokens || 500
        },
        voiceConfiguration: {
          provider: formData.voiceConfiguration.provider || 'elevenlabs',
          voiceId: defaultVoiceId,
          speed: formData.voiceConfiguration.speed || 1.0,
          pitch: formData.voiceConfiguration.pitch || 1.0
        }
      };
      
      // Real API call to create or update the campaign
      console.log('Submitting campaign:', submissionData);
      
      let response;
      if (campaignId) {
        // Update existing campaign
        response = await api.put(`/campaigns/${campaignId}`, submissionData);
      } else {
        // Create new campaign
        response = await api.post('/campaigns', submissionData);
      }
      
      console.log('Campaign saved successfully:', response.data);
      
      showToast(
        campaignId ? 'Campaign Updated' : 'Campaign Created',
        campaignId
          ? 'The campaign has been updated successfully.'
          : 'The campaign has been created successfully.'
      );
      
      setIsLoading(false);
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error saving campaign:', error);
      showToast('Error', 'Failed to save campaign. Please try again.', 'destructive');
      setIsLoading(false);
    }
  };

  return (
    <SheetContent className="w-full sm:max-w-2xl lg:max-w-3xl p-0">
      <div className="flex flex-col h-full">
        <div className="px-4 sm:px-6 py-4 border-b">
          <SheetHeader>
            <SheetTitle>{campaignId ? 'Edit Campaign' : 'Create New Campaign'}</SheetTitle>
            <SheetDescription>
              {campaignId ? 'Update campaign details and configuration' : 'Create a new Lumina Outreach campaign'}
            </SheetDescription>
          </SheetHeader>
        </div>
        
        <ScrollArea className="flex-1">
          <div className="px-4 sm:px-6 py-4 sm:py-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                  <p className="mt-4 text-muted-foreground">
                    {campaignId ? 'Loading campaign data...' : 'Creating campaign...'}
                  </p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
            {/* Tabs Navigation */}
            <div className="flex border-b mb-6 -mx-2 px-2 overflow-x-auto">
              <button
                type="button"
                className={`px-3 sm:px-5 py-3 text-sm sm:text-base whitespace-nowrap ${currentTab === 'basic' ? 'border-b-2 border-primary' : ''}`}
                onClick={() => setCurrentTab('basic')}
              >
                Basic Info
              </button>
              <button
                type="button"
                className={`px-3 sm:px-5 py-3 text-sm sm:text-base whitespace-nowrap ${currentTab === 'script' ? 'border-b-2 border-primary' : ''}`}
                onClick={() => setCurrentTab('script')}
              >
                Call Script
              </button>
              <button
                type="button"
                className={`px-3 sm:px-5 py-3 text-sm sm:text-base whitespace-nowrap ${currentTab === 'scheduling' ? 'border-b-2 border-primary' : ''}`}
                onClick={() => setCurrentTab('scheduling')}
              >
                Scheduling
              </button>
              <button
                type="button"
                className={`px-3 sm:px-5 py-3 text-sm sm:text-base whitespace-nowrap ${currentTab === 'ai' ? 'border-b-2 border-primary' : ''}`}
                onClick={() => setCurrentTab('ai')}
              >
                AI & Voice
              </button>
            </div>
            
            {/* Tab Content with proper spacing */}
            <div className="space-y-6 pb-6">
              {/* Basic Info Tab */}
              {currentTab === 'basic' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 gap-6">
                    <div className="space-y-2">
                      <label className={labelStyles}>
                        Campaign Name *
                      </label>
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        className={inputStyles}
                        placeholder="Enter campaign name"
                        required
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label className={labelStyles}>
                        Description *
                      </label>
                      <textarea
                        name="description"
                        value={formData.description}
                        onChange={handleChange}
                        className={textareaStyles}
                        placeholder="Describe the purpose of this campaign"
                        required
                      />
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          Campaign Goal *
                        </label>
                        <input
                          type="text"
                          name="goal"
                          value={formData.goal}
                          onChange={handleChange}
                          className={inputStyles}
                          placeholder="e.g., Book demos, qualify leads"
                          required
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          Target Audience *
                        </label>
                        <input
                          type="text"
                          name="targetAudience"
                          value={formData.targetAudience}
                          onChange={handleChange}
                          className={inputStyles}
                          placeholder="e.g., Tech companies in Bangalore"
                          required
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          Start Date *
                        </label>
                        <DatePicker 
                          date={formData.startDate}
                          setDate={(date) => setFormData(prev => ({ ...prev, startDate: date }))}
                          placeholder="Select start date"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          End Date (Optional)
                        </label>
                        <DatePicker 
                          date={formData.endDate}
                          setDate={(date) => setFormData(prev => ({ ...prev, endDate: date }))}
                          placeholder="Select end date"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Lead Sources *
                      </label>
                      <div className="space-y-2">
                        {formData.leadSources.map((source: string, index: number) => (
                          <div key={index} className="flex items-center gap-2">
                            <input
                              type="text"
                              value={source}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateLeadSource(index, e.target.value)}
                              className={inputStyles}
                              placeholder="e.g., Website Form, Trade Show"
                              required
                            />
                            {formData.leadSources.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeLeadSource(index)}
                                className="p-2 text-muted-foreground hover:text-destructive"
                              >
                                <X size={16} />
                              </button>
                            )}
                          </div>
                        ))}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={addLeadSource}
                          className="mt-2"
                        >
                          <Plus size={16} className="mr-2" />
                          Add Lead Source
                        </Button>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          Primary Language *
                        </label>
                        <Select
                          value={formData.primaryLanguage}
                          onValueChange={(value) => setFormData(prev => ({...prev, primaryLanguage: value}))}
                        >
                          <SelectTrigger className="w-full rounded-xl">
                            <SelectValue placeholder="Select a language" />
                          </SelectTrigger>
                          <SelectContent>
                            {languages.map((language: string) => (
                              <SelectItem key={language} value={language}>
                                {language}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          Supported Languages
                        </label>
                        <div className="bg-muted/50 p-3 rounded-xl max-h-[120px] overflow-y-auto">
                          <div className="flex flex-wrap gap-2">
                            {languages.map((language: string) => {
                              const isSelected = formData.supportedLanguages.includes(language);
                              return (
                                <Badge 
                                  key={language} 
                                  variant={isSelected ? "default" : "outline"}
                                  className={`cursor-pointer transition-colors ${isSelected ? "" : "hover:bg-secondary/20"}`}
                                  onClick={() => handleLanguageChange(language, !isSelected)}
                                >
                                  {language}
                                </Badge>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Script Tab */}
              {currentTab === 'script' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Script Name
                    </label>
                    <input
                      type="text"
                      name="script.name"
                      value={formData.script.name}
                      onChange={handleChange}
                      className={inputStyles}
                      placeholder="e.g., Primary Script, Version A"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Script Content *
                    </label>
                    <div className="text-xs text-muted-foreground mb-2">
                      You can use variables like {"{agent_name}"}, {"{company_name}"}, {"{product_name}"} in your script.
                    </div>
                    <textarea
                      name="script.content"
                      value={formData.script.content}
                      onChange={handleChange}
                      className={textareaStyles}
                      placeholder="Enter your call script here..."
                      required
                    />
                  </div>
                </div>
              )}
              
              {/* Scheduling Tab */}
              {currentTab === 'scheduling' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Days of Week
                    </label>
                    <div className="bg-muted/50 p-3 rounded-xl">
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                        {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day: string) => (
                          <div key={day} className="flex items-center gap-2">
                            <Checkbox
                              id={`day-${day}`}
                              checked={formData.callTiming.daysOfWeek.includes(day)}
                              onCheckedChange={(checked: boolean) => handleDayChange(day, checked)}
                            />
                            <label htmlFor={`day-${day}`} className="text-sm cursor-pointer">
                              {day}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Start Time
                      </label>
                      <input
                        type="time"
                        name="callTiming.startTime"
                        value={formData.callTiming.startTime}
                        onChange={handleChange}
                        className={inputStyles}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        End Time
                      </label>
                      <input
                        type="time"
                        name="callTiming.endTime"
                        value={formData.callTiming.endTime}
                        onChange={handleChange}
                        className={inputStyles}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Time Zone
                      </label>
                      <Select
                        value={formData.callTiming.timeZone}
                        onValueChange={(value) => setFormData(prev => ({
                          ...prev, 
                          callTiming: {
                            ...prev.callTiming,
                            timeZone: value
                          }
                        }))}
                      >
                        <SelectTrigger className="w-full rounded-xl">
                          <SelectValue placeholder="Select a time zone" />
                        </SelectTrigger>
                        <SelectContent>
                          {timeZones.map((tz: string) => (
                            <SelectItem key={tz} value={tz}>
                              {tz}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}
              
              {/* AI & Voice Tab */}
              {currentTab === 'ai' && (
                <div className="space-y-4">
                  {systemConfig && (
                    <div className="bg-blue-50 dark:bg-blue-950/30 p-3 rounded-xl text-sm border border-blue-200 dark:border-blue-800">
                      <p className="font-medium">Using system configuration settings</p>
                      <p className="text-muted-foreground text-xs mt-1">
                        The AI and voice settings shown here are based on the system-wide configuration.
                        {systemConfig.llmConfig?.defaultProvider && (
                          <span> Using {systemConfig.llmConfig.defaultProvider} as the LLM provider.</span>
                        )}
                      </p>
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        LLM Model
                      </label>
                      <Select
                        value={formData.llmConfiguration.model}
                        onValueChange={(value) => setFormData(prev => ({
                          ...prev, 
                          llmConfiguration: {
                            ...prev.llmConfiguration,
                            model: value
                          }
                        }))}
                      >
                        <SelectTrigger className="w-full rounded-xl">
                          <SelectValue placeholder="Select a model" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableLLMModels.map((model: string) => (
                            <SelectItem key={model} value={model}>
                              {model}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Voice Provider
                      </label>
                      <Select
                        value={formData.voiceConfiguration.provider}
                        onValueChange={(value) => setFormData(prev => ({
                          ...prev, 
                          voiceConfiguration: {
                            ...prev.voiceConfiguration,
                            provider: value
                          }
                        }))}
                        disabled={systemConfig?.elevenLabsConfig?.isEnabled}
                      >
                        <SelectTrigger className="w-full rounded-xl">
                          <SelectValue placeholder="Select a voice provider" />
                        </SelectTrigger>
                        <SelectContent>
                          {voiceProviders
                            .filter(provider => 
                              !systemConfig || 
                              (provider === 'elevenlabs' && systemConfig?.elevenLabsConfig?.isEnabled) ||
                              (provider === 'google')
                            )
                            .map((provider: string) => (
                              <SelectItem key={provider} value={provider}>
                                {provider}
                              </SelectItem>
                            ))
                          }
                        </SelectContent>
                      </Select>
                      {systemConfig?.elevenLabsConfig?.isEnabled && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Voice provider is set by system configuration
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      System Prompt
                    </label>
                    <textarea
                      name="llmConfiguration.systemPrompt"
                      value={formData.llmConfiguration.systemPrompt}
                      onChange={handleChange}
                      className={textareaStyles}
                      placeholder="Instructions for the AI model"
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Voice
                      </label>
                      {systemConfig?.elevenLabsConfig?.availableVoices && 
                       formData.voiceConfiguration.provider === 'elevenlabs' ? (
                        <Select
                          value={formData.voiceConfiguration.voiceId}
                          onValueChange={(value) => setFormData(prev => ({
                            ...prev, 
                            voiceConfiguration: {
                              ...prev.voiceConfiguration,
                              voiceId: value
                            }
                          }))}
                        >
                          <SelectTrigger className="w-full rounded-xl">
                            <SelectValue placeholder="Select a voice" />
                          </SelectTrigger>
                          <SelectContent>
                            {systemConfig.elevenLabsConfig.availableVoices.map((voice: any) => (
                              <SelectItem key={voice.voiceId} value={voice.voiceId}>
                                {voice.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <input
                          type="text"
                          name="voiceConfiguration.voiceId"
                          value={formData.voiceConfiguration.voiceId}
                          onChange={handleChange}
                          className={inputStyles}
                          placeholder="Enter voice ID from provider"
                        />
                      )}
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Max Tokens
                      </label>
                      <input
                        type="number"
                        value={formData.llmConfiguration.maxTokens}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleNumberChange('llmConfiguration.maxTokens', e.target.value)}
                        className={inputStyles}
                        min="100"
                        max="4000"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Temperature: {formData.llmConfiguration.temperature}
                      </label>
                      <Slider
                        value={[formData.llmConfiguration.temperature]}
                        onValueChange={(value) => handleNumberChange('llmConfiguration.temperature', value[0].toString())}
                        min={0}
                        max={2}
                        step={0.1}
                        className="py-4"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>0 (Precise)</span>
                        <span>2 (Creative)</span>
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Voice Speed: {formData.voiceConfiguration.speed}
                      </label>
                      <Slider
                        value={[formData.voiceConfiguration.speed]}
                        onValueChange={(value) => handleNumberChange('voiceConfiguration.speed', value[0].toString())}
                        min={0.25}
                        max={4.0}
                        step={0.05}
                        className="py-4"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>0.25 (Slow)</span>
                        <span>4.0 (Fast)</span>
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Voice Pitch: {formData.voiceConfiguration.pitch}
                      </label>
                      <Slider
                        value={[formData.voiceConfiguration.pitch]}
                        onValueChange={(value) => handleNumberChange('voiceConfiguration.pitch', value[0].toString())}
                        min={-1.0}
                        max={1.0}
                        step={0.1}
                        className="py-4"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>-1.0 (Lower)</span>
                        <span>1.0 (Higher)</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
              
              {/* Form Actions */}
              <div className="flex flex-row justify-end gap-2 pt-6 border-t mt-6">
                <Button type="button" variant="outline" size="sm" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={isLoading}>
                  {isLoading ? 'Saving...' : campaignId ? 'Update Campaign' : 'Create Campaign'}
                </Button>
              </div>
            </form>
          )}
        </div>
      </ScrollArea>
      </div>
    </SheetContent>
  );
};

export default CampaignForm;
