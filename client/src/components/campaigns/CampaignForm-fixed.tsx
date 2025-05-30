import React, { useState, useEffect } from 'react';
import { X, Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

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
  startDate: string;
  endDate: string;
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
  startDate: new Date().toISOString().split('T')[0],
  endDate: '',
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
    voiceId: '',
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

  // Toast function for notifications
  const showToast = (title: string, description: string, variant: 'default' | 'destructive' = 'default') => {
    console.log(`Toast - ${title}: ${description} (${variant})`);
  };

  // Load campaign data if editing
  const loadCampaignData = async () => {
    if (!campaignId) return;
    
    try {
      setIsLoading(true);
      // Mock data loading
      setTimeout(() => {
        setFormData({
          ...initialFormState,
          name: 'Existing Campaign',
          description: 'This is an existing campaign being edited',
        });
        setIsLoading(false);
      }, 500);
    } catch (error) {
      showToast('Error', 'Failed to load campaign data.', 'destructive');
      setIsLoading(false);
    }
  };

  useEffect(() => {
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
      
      // Mock API call
      setTimeout(() => {
        showToast(
          campaignId ? 'Campaign Updated' : 'Campaign Created',
          campaignId
            ? 'The campaign has been updated successfully.'
            : 'The campaign has been created successfully.'
        );
        
        setIsLoading(false);
        onSuccess();
        onClose();
      }, 1000);
    } catch (error) {
      console.error('Error saving campaign:', error);
      showToast('Error', 'Failed to save campaign. Please try again.', 'destructive');
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{campaignId ? 'Edit Campaign' : 'Create New Campaign'}</DialogTitle>
        </DialogHeader>
        
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
          <form onSubmit={handleSubmit}>
            {/* Tabs Navigation */}
            <div className="flex border-b mb-4">
              <button
                type="button"
                className={`px-4 py-2 ${currentTab === 'basic' ? 'border-b-2 border-primary' : ''}`}
                onClick={() => setCurrentTab('basic')}
              >
                Basic Info
              </button>
              <button
                type="button"
                className={`px-4 py-2 ${currentTab === 'script' ? 'border-b-2 border-primary' : ''}`}
                onClick={() => setCurrentTab('script')}
              >
                Call Script
              </button>
              <button
                type="button"
                className={`px-4 py-2 ${currentTab === 'scheduling' ? 'border-b-2 border-primary' : ''}`}
                onClick={() => setCurrentTab('scheduling')}
              >
                Scheduling
              </button>
              <button
                type="button"
                className={`px-4 py-2 ${currentTab === 'ai' ? 'border-b-2 border-primary' : ''}`}
                onClick={() => setCurrentTab('ai')}
              >
                AI & Voice
              </button>
            </div>
            
            <ScrollArea className="pr-4 max-h-[calc(90vh-12rem)]">
              {/* Basic Info Tab */}
              {currentTab === 'basic' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Campaign Name *
                      </label>
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                        placeholder="Enter campaign name"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Description *
                      </label>
                      <textarea
                        name="description"
                        value={formData.description}
                        onChange={handleChange}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 min-h-[80px]"
                        placeholder="Describe the purpose of this campaign"
                        required
                      />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          Campaign Goal *
                        </label>
                        <input
                          type="text"
                          name="goal"
                          value={formData.goal}
                          onChange={handleChange}
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
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
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                          placeholder="e.g., Tech companies in Bangalore"
                          required
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          Start Date *
                        </label>
                        <input
                          type="date"
                          name="startDate"
                          value={formData.startDate}
                          onChange={handleChange}
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                          required
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          End Date (Optional)
                        </label>
                        <input
                          type="date"
                          name="endDate"
                          value={formData.endDate}
                          onChange={handleChange}
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
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
                              className="flex-grow rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
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
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          Primary Language *
                        </label>
                        <select
                          name="primaryLanguage"
                          value={formData.primaryLanguage}
                          onChange={handleChange}
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                          required
                        >
                          {languages.map((language: string) => (
                            <option key={language} value={language}>
                              {language}
                            </option>
                          ))}
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          Supported Languages
                        </label>
                        <div className="bg-muted/50 p-2 rounded-md max-h-[120px] overflow-y-auto">
                          <div className="grid grid-cols-2">
                            {languages.map((language: string) => (
                              <label key={language} className="flex items-center gap-2 p-1">
                                <input
                                  type="checkbox"
                                  checked={formData.supportedLanguages.includes(language)}
                                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleLanguageChange(language, e.target.checked)}
                                  className="rounded border-gray-300 text-primary focus:ring-primary"
                                />
                                <span className="text-sm">{language}</span>
                              </label>
                            ))}
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
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
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
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 min-h-[200px]"
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
                    <div className="bg-muted/50 p-3 rounded-md">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day: string) => (
                          <label key={day} className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={formData.callTiming.daysOfWeek.includes(day)}
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleDayChange(day, e.target.checked)}
                              className="rounded border-gray-300 text-primary focus:ring-primary"
                            />
                            <span className="text-sm">{day}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Start Time
                      </label>
                      <input
                        type="time"
                        name="callTiming.startTime"
                        value={formData.callTiming.startTime}
                        onChange={handleChange}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
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
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Time Zone
                      </label>
                      <select
                        name="callTiming.timeZone"
                        value={formData.callTiming.timeZone}
                        onChange={handleChange}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      >
                        {timeZones.map((tz: string) => (
                          <option key={tz} value={tz}>
                            {tz}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}
              
              {/* AI & Voice Tab */}
              {currentTab === 'ai' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        LLM Model
                      </label>
                      <select
                        name="llmConfiguration.model"
                        value={formData.llmConfiguration.model}
                        onChange={handleChange}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      >
                        {llmModels.map((model: string) => (
                          <option key={model} value={model}>
                            {model}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Voice Provider
                      </label>
                      <select
                        name="voiceConfiguration.provider"
                        value={formData.voiceConfiguration.provider}
                        onChange={handleChange}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      >
                        {voiceProviders.map((provider: string) => (
                          <option key={provider} value={provider}>
                            {provider}
                          </option>
                        ))}
                      </select>
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
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 min-h-[100px]"
                      placeholder="Instructions for the AI model"
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Voice ID
                      </label>
                      <input
                        type="text"
                        name="voiceConfiguration.voiceId"
                        value={formData.voiceConfiguration.voiceId}
                        onChange={handleChange}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                        placeholder="Enter voice ID from provider"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Max Tokens
                      </label>
                      <input
                        type="number"
                        value={formData.llmConfiguration.maxTokens}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleNumberChange('llmConfiguration.maxTokens', e.target.value)}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                        min="100"
                        max="4000"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Temperature: {formData.llmConfiguration.temperature}
                      </label>
                      <input
                        type="range"
                        value={formData.llmConfiguration.temperature}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleNumberChange('llmConfiguration.temperature', e.target.value)}
                        className="w-full"
                        min="0"
                        max="2"
                        step="0.1"
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
                      <input
                        type="range"
                        value={formData.voiceConfiguration.speed}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleNumberChange('voiceConfiguration.speed', e.target.value)}
                        className="w-full"
                        min="0.5"
                        max="2"
                        step="0.1"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>0.5 (Slow)</span>
                        <span>2 (Fast)</span>
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Voice Pitch: {formData.voiceConfiguration.pitch}
                      </label>
                      <input
                        type="range"
                        value={formData.voiceConfiguration.pitch}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleNumberChange('voiceConfiguration.pitch', e.target.value)}
                        className="w-full"
                        min="0.5"
                        max="2"
                        step="0.1"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>0.5 (Low)</span>
                        <span>2 (High)</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </ScrollArea>
            
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Saving...' : campaignId ? 'Update Campaign' : 'Create Campaign'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CampaignForm;
