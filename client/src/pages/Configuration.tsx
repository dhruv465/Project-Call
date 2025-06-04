import { useState, useEffect, useCallback } from 'react';
import api from '@/services/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Settings, 
  Save, 
  Mic, 
  Volume2, 
  Phone, 
  MessageSquare,
  TestTube,
  CheckCircle,
  AlertTriangle,
  Zap,
  Trash2,
  Check,
  X,
  PhoneCall
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { configApi } from '@/services/configApi';
import { PasswordInput } from '@/components/PasswordInput';

interface Configuration {
  // AI Voice Settings
  voiceProvider: 'elevenlabs' | 'openai' | 'google';
  voiceId: string;
  voiceSpeed: number;
  voiceStability: number;
  voiceClarity: number;
  elevenLabsApiKey: string;
  elevenLabsStatus?: 'unverified' | 'verified' | 'failed';
  
  // Phone Settings
  twilioAccountSid: string;
  twilioAuthToken: string;
  twilioPhoneNumber: string;
  twilioStatus?: 'unverified' | 'verified' | 'failed';
  
  // AI Model Settings
  llmProvider: 'openai' | 'anthropic' | 'google';
  llmModel: string;
  llmApiKey: string;
  llmStatus?: 'unverified' | 'verified' | 'failed';
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  
  // Call Settings
  maxCallDuration: number;
  retryAttempts: number;
  retryDelay: number;
  timeZone: string;
  
  // Webhook Settings
  webhookUrl: string;
  webhookSecret: string;
  webhookStatus?: 'unverified' | 'verified' | 'failed';
}

interface ModelInfo {
  id: string;
  name: string;
  description?: string;
  maxTokens?: number;
  contextWindow?: number;
  pricing?: {
    input: number;
    output: number;
  };
  capabilities?: {
    chat: boolean;
    completion: boolean;
    streaming: boolean;
    functionCalling?: boolean;
    vision?: boolean;
  };
}

const Configuration = () => {
  const { toast } = useToast();
  const [config, setConfig] = useState<Configuration>({
    // AI Voice Settings
    voiceProvider: 'elevenlabs',
    voiceId: 'rachel',
    voiceSpeed: 1.0,
    voiceStability: 0.8,
    voiceClarity: 0.9,
    elevenLabsApiKey: '',
    elevenLabsStatus: 'unverified',
    
    // Phone Settings
    twilioAccountSid: '',
    twilioAuthToken: '',
    twilioPhoneNumber: '',
    twilioStatus: 'unverified',
    
    // AI Model Settings
    llmProvider: 'openai',
    llmModel: 'gpt-4',
    llmApiKey: '',
    llmStatus: 'unverified',
    systemPrompt: `You are a professional sales representative making cold calls. Be polite, respectful, and helpful. Your goal is to:
1. Introduce yourself and your company
2. Understand the prospect's needs
3. Present relevant solutions
4. Schedule a follow-up if there's interest
5. Respect their time and decisions

Keep the conversation natural and engaging. If they're not interested, politely end the call.`,
    temperature: 0.7,
    maxTokens: 150,
    
    // Call Settings
    maxCallDuration: 300, // 5 minutes
    retryAttempts: 3,
    retryDelay: 60, // 1 minute
    timeZone: 'America/New_York',
    
    // Webhook Settings
    webhookUrl: '',
    webhookSecret: '',
    webhookStatus: 'unverified'
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingVoice, setTestingVoice] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testingCall, setTestingCall] = useState(false);
  const [openTestCallDialog, setOpenTestCallDialog] = useState(false);
  const [testCallNumber, setTestCallNumber] = useState("");
  const [testCallMessage, setTestCallMessage] = useState("This is a test call from your AI calling system.");
  const [testingLLMChat, setTestingLLMChat] = useState(false);
  const [openTestLLMChatDialog, setOpenTestLLMChatDialog] = useState(false);
  const [testLLMPrompt, setTestLLMPrompt] = useState("Hello, can you introduce yourself and tell me what you can do?");
  const [testLLMResponse, setTestLLMResponse] = useState("");
  const [availableVoices, setAvailableVoices] = useState<{voiceId: string, name: string, previewUrl?: string}[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{type: string; name?: string} | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<boolean | null>(null);
  const [availableModels, setAvailableModels] = useState<{ [provider: string]: ModelInfo[] }>({});
  const [loadingModels, setLoadingModels] = useState(false);
  const [apiKeyDebounceTimer, setApiKeyDebounceTimer] = useState<NodeJS.Timeout | null>(null);
  
  // Pre-built ElevenLabs voices
  const prebuiltVoices = [
    { voiceId: 'pNInz6obpgDQGcFmaJgB', name: 'Adam (Male)' },
    { voiceId: 'yoZ06aMxZJJ28mfd3POQ', name: 'Sam (Male)' },
    { voiceId: 'EXAVITQu4vr4xnSDxMaL', name: 'Bella (Female)' },
    { voiceId: 'ErXwobaYiN019PkySvjV', name: 'Antoni (Male)' },
    { voiceId: 'MF3mGyEYCl7XYWbV9V6O', name: 'Elli (Female)' },
    { voiceId: 'TxGEqnHWrfWFTfGW9XjX', name: 'Josh (Male)' },
    { voiceId: 'VR6AewLTigWG4xSOukaG', name: 'Arnold (Male)' },
    { voiceId: '21m00Tcm4TlvDq8ikWAM', name: 'Jessica (Female)' },
    { voiceId: 'AZnzlk1XvdvUeBnXmlld', name: 'Michael (Male)' }
  ];

  // Load available voices
  const loadVoices = useCallback(async () => {
    try {
      // Start with prebuilt voices
      setAvailableVoices(prebuiltVoices);
      
      // Check if API key is set and not masked
      console.log('ElevenLabs API key status:', {
        key: config.elevenLabsApiKey ? 'SET' : 'NOT SET',
        length: config.elevenLabsApiKey?.length
      });
      
      // Try to fetch custom voices if API key is set
      if (config.elevenLabsApiKey) {
        console.log('Fetching available voices from ElevenLabs...');
        const result = await configApi.testElevenLabsConnection({
          apiKey: config.elevenLabsApiKey
        });
        
        if (result.success && result.details?.availableVoices) {
          console.log(`Received ${result.details.availableVoices.length} voices from ElevenLabs`);
          // Add custom voices if available
          setAvailableVoices([
            ...prebuiltVoices,
            ...result.details.availableVoices
          ]);
        }
      }
    } catch (error) {
      console.error('Error loading voices:', error);
      // Keep prebuilt voices as fallback
    }
  }, [config.elevenLabsApiKey]);

  // Fetch available models from the API (for saved configurations)
  const fetchAvailableModels = useCallback(async () => {
    if (!config.llmApiKey) {
      return;
    }

    try {
      setLoadingModels(true);
      const response = await api.get('/configuration/llm-models');

      if (response.data.success) {
        setAvailableModels(response.data.models);
      }
    } catch (error) {
      console.error('Failed to fetch available models:', error);
    } finally {
      setLoadingModels(false);
    }
  }, [config.llmApiKey]);

  // Dynamically fetch models when user enters an API key
  const fetchModelsWithApiKey = useCallback(async (provider: string, apiKey: string) => {
    if (!apiKey || apiKey.length < 10) {
      // Clear models for the provider if API key is invalid
      setAvailableModels(prev => ({
        ...prev,
        [provider]: []
      }));
      return;
    }

    try {
      setLoadingModels(true);
      const response = await configApi.fetchModelsWithApiKey(provider, apiKey);
      
      if (response.success && response.models) {
        setAvailableModels(prev => ({
          ...prev,
          [provider]: response.models
        }));
        
        // If no model is currently selected and models are available, select the first one
        if (!config.llmModel && response.models.length > 0) {
          updateConfig('llmModel', response.models[0].id);
        }
      }
    } catch (error) {
      console.error(`Failed to fetch models for ${provider}:`, error);
      // Clear models on error
      setAvailableModels(prev => ({
        ...prev,
        [provider]: []
      }));
      
      // Show toast error
      toast({
        title: "Failed to fetch models",
        description: error instanceof Error ? error.message : "Please check your API key and try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingModels(false);
    }
  }, [config.llmModel, toast]);

  // Clean up debounce timer on unmount
  useEffect(() => {
    return () => {
      if (apiKeyDebounceTimer) {
        clearTimeout(apiKeyDebounceTimer);
      }
    };
  }, [apiKeyDebounceTimer]);

  useEffect(() => {
    // Load voices when API key changes or on initial load
    loadVoices();
  }, [config.elevenLabsApiKey, loadVoices]);

  useEffect(() => {
    // Fetch available models when provider or API key changes
    fetchAvailableModels();
  }, [config.llmProvider, config.llmApiKey, fetchAvailableModels]);

  useEffect(() => {
    // Fetch available models when provider or API key changes
    fetchAvailableModels();
  }, [config.llmProvider, config.llmApiKey, fetchAvailableModels]);

  useEffect(() => {
    // Fetch configuration from API
    const fetchConfiguration = async () => {
      try {
        setLoading(true);
        const data = await configApi.getConfiguration();
        console.log('Fetched configuration from server:', {
          elevenLabsConfig: {
            voiceSpeed: data.elevenLabsConfig?.voiceSpeed,
            voiceStability: data.elevenLabsConfig?.voiceStability,
            voiceClarity: data.elevenLabsConfig?.voiceClarity,
            isEnabled: data.elevenLabsConfig?.isEnabled,
          },
          llmConfig: {
            defaultProvider: data.llmConfig?.defaultProvider,
            defaultModel: data.llmConfig?.defaultModel,
            temperature: data.llmConfig?.temperature,
            maxTokens: data.llmConfig?.maxTokens,
          },
          generalSettings: {
            maxCallDuration: data.generalSettings?.maxCallDuration,
            defaultSystemPrompt: data.generalSettings?.defaultSystemPrompt ? 'SET' : 'NOT SET',
            defaultTimeZone: data.generalSettings?.defaultTimeZone,
          },
          webhookConfig: {
            url: data.webhookConfig?.url ? 'SET' : 'NOT SET',
          }
        });
        
        setConfig({
          // Set defaults for any missing properties
          voiceProvider: data.elevenLabsConfig?.isEnabled ? 'elevenlabs' : 
                        (data.llmConfig?.providers.find((p: any) => p.name === 'openai' && p.isEnabled) ? 'openai' : 'google'),
          voiceId: data.elevenLabsConfig?.availableVoices?.[0]?.voiceId || 'rachel',
          voiceSpeed: data.elevenLabsConfig?.voiceSpeed || 1.0,
          voiceStability: data.elevenLabsConfig?.voiceStability || 0.8,
          voiceClarity: data.elevenLabsConfig?.voiceClarity || 0.9,
          elevenLabsApiKey: data.elevenLabsConfig?.apiKey || '',
          elevenLabsStatus: data.elevenLabsConfig?.status || 'unverified',
          
          twilioAccountSid: data.twilioConfig?.accountSid || '',
          twilioAuthToken: data.twilioConfig?.authToken || '',
          twilioPhoneNumber: data.twilioConfig?.phoneNumbers?.[0] || '',
          twilioStatus: data.twilioConfig?.status || 'unverified',
          
          llmProvider: data.llmConfig?.defaultProvider || 'openai',
          llmModel: data.llmConfig?.defaultModel || 'gpt-4',
          llmApiKey: data.llmConfig?.providers.find((p: any) => p.name === data.llmConfig?.defaultProvider)?.apiKey || '',
          llmStatus: data.llmConfig?.providers.find((p: any) => p.name === data.llmConfig?.defaultProvider)?.status || 'unverified',
          systemPrompt: data.generalSettings?.defaultSystemPrompt || `You are a professional sales representative making cold calls. Be polite, respectful, and helpful.`,
          temperature: data.llmConfig?.temperature || 0.7,
          maxTokens: data.llmConfig?.maxTokens || 150,
          
          maxCallDuration: data.generalSettings?.maxCallDuration || 300,
          retryAttempts: data.generalSettings?.callRetryAttempts || 3,
          retryDelay: 60,
          timeZone: data.generalSettings?.defaultTimeZone || data.generalSettings?.workingHours?.timeZone || 'America/New_York',
          
          webhookUrl: data.webhookConfig?.url || '',
          webhookSecret: data.webhookConfig?.secret || '',
          webhookStatus: data.webhookConfig?.status || 'unverified'
        });
      } catch (error) {
        console.error('Error fetching configuration:', error);
        toast({
          title: "Error",
          description: "Failed to load configuration. Using default settings.",
          variant: "destructive",
        });
        // Keep the default state
      } finally {
        setLoading(false);
      }
    };

    fetchConfiguration();
  }, [toast]);

  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(null); // Reset save state
    try {
      // Debug log before save
      console.log('Saving configuration with voice settings:', {
        voiceProvider: config.voiceProvider,
        voiceId: config.voiceId,
        voiceSpeed: config.voiceSpeed,
        voiceStability: config.voiceStability,
        voiceClarity: config.voiceClarity,
        elevenLabsApiKey: config.elevenLabsApiKey ? `${config.elevenLabsApiKey.slice(0, 4)}...${config.elevenLabsApiKey.slice(-4)}` : 'NOT SET',
      });
      
      console.log('Saving configuration with LLM settings:', {
        llmProvider: config.llmProvider,
        llmModel: config.llmModel,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
        llmApiKey: config.llmApiKey ? 'SET' : 'NOT SET',
      });
      
      // Transform the flat config object into the structured API format
      const apiConfig = {
        twilioConfig: {
          accountSid: config.twilioAccountSid,
          authToken: config.twilioAuthToken,
          phoneNumbers: config.twilioPhoneNumber ? [config.twilioPhoneNumber] : [],
          isEnabled: !!config.twilioAccountSid && !!config.twilioAuthToken,
          status: config.twilioStatus
        },
        elevenLabsConfig: {
          apiKey: config.elevenLabsApiKey,
          isEnabled: config.voiceProvider === 'elevenlabs' && !!config.elevenLabsApiKey,
          voiceSpeed: config.voiceSpeed,
          voiceStability: config.voiceStability,
          voiceClarity: config.voiceClarity,
          status: config.elevenLabsStatus,
          availableVoices: availableVoices.length > 0 ? availableVoices : []
        },
        llmConfig: {
          defaultProvider: config.llmProvider,
          defaultModel: config.llmModel,
          temperature: config.temperature,
          maxTokens: config.maxTokens,
          providers: [
            {
              name: 'openai',
              apiKey: config.llmProvider === 'openai' ? config.llmApiKey : '',
              availableModels: ['gpt-3.5-turbo', 'gpt-4'],
              isEnabled: config.llmProvider === 'openai',
              status: config.llmProvider === 'openai' ? config.llmStatus : 'unverified'
            },
            {
              name: 'anthropic',
              apiKey: config.llmProvider === 'anthropic' ? config.llmApiKey : '',
              availableModels: ['claude-instant-1', 'claude-2'],
              isEnabled: config.llmProvider === 'anthropic',
              status: config.llmProvider === 'anthropic' ? config.llmStatus : 'unverified'
            },
            {
              name: 'google',
              apiKey: config.llmProvider === 'google' ? config.llmApiKey : '',
              availableModels: ['gemini-pro'],
              isEnabled: config.llmProvider === 'google',
              status: config.llmProvider === 'google' ? config.llmStatus : 'unverified'
            }
          ]
        },
        generalSettings: {
          maxCallDuration: config.maxCallDuration,
          callRetryAttempts: config.retryAttempts,
          defaultTimeZone: config.timeZone,
          defaultSystemPrompt: config.systemPrompt
        },
        webhookConfig: {
          url: config.webhookUrl,
          secret: config.webhookSecret,
          status: config.webhookStatus
        }
      };
      
      await configApi.updateConfiguration(apiConfig);
      
      // Debug log - check what was sent to server
      console.log('API Config sent to server:', {
        twilioConfig: {
          accountSid: apiConfig.twilioConfig.accountSid ? 'SET' : 'NOT SET',
          authToken: apiConfig.twilioConfig.authToken ? 'SET' : 'NOT SET',
          phoneNumbers: apiConfig.twilioConfig.phoneNumbers || [],
          isEnabled: apiConfig.twilioConfig.isEnabled
        },
        elevenLabsConfig: {
          apiKey: apiConfig.elevenLabsConfig.apiKey ? 'SET' : 'NOT SET',
          voiceSpeed: apiConfig.elevenLabsConfig.voiceSpeed,
          voiceStability: apiConfig.elevenLabsConfig.voiceStability,
          voiceClarity: apiConfig.elevenLabsConfig.voiceClarity,
          isEnabled: apiConfig.elevenLabsConfig.isEnabled
        },
        llmConfig: {
          providers: apiConfig.llmConfig.providers.map((p: any) => ({
            name: p.name,
            apiKey: p.apiKey ? 'SET' : 'NOT SET',
            isEnabled: p.isEnabled
          })),
          defaultProvider: apiConfig.llmConfig.defaultProvider,
          temperature: apiConfig.llmConfig.temperature,
          maxTokens: apiConfig.llmConfig.maxTokens
        }
      });
      
      // Fetch the updated configuration to ensure we have the latest data
      const updatedConfigData = await configApi.getConfiguration();
      
      // Update the local state with the fresh data
      setConfig(prevConfig => {
        // Log what we're receiving from the server
        console.log('Received updated configuration from server:', {
          elevenLabsConfig: {
            voiceSpeed: updatedConfigData.elevenLabsConfig?.voiceSpeed,
            voiceStability: updatedConfigData.elevenLabsConfig?.voiceStability,
            voiceClarity: updatedConfigData.elevenLabsConfig?.voiceClarity,
          },
          llmConfig: {
            temperature: updatedConfigData.llmConfig?.temperature,
            maxTokens: updatedConfigData.llmConfig?.maxTokens,
          },
          generalSettings: {
            maxCallDuration: updatedConfigData.generalSettings?.maxCallDuration,
            defaultSystemPrompt: updatedConfigData.generalSettings?.defaultSystemPrompt ? 'SET' : 'NOT SET',
            defaultTimeZone: updatedConfigData.generalSettings?.defaultTimeZone,
          },
          webhookConfig: {
            url: updatedConfigData.webhookConfig?.url ? 'SET' : 'NOT SET',
          }
        });          // Get the LLM API key - preserve the one we have if the server returns a masked key
          const currentProvider = updatedConfigData.llmConfig?.defaultProvider || prevConfig.llmProvider;
          const serverProviderKey = updatedConfigData.llmConfig?.providers?.find(
            (p: any) => p.name === currentProvider
          )?.apiKey;
          
          // Get current provider status
          const currentProviderStatus = updatedConfigData.llmConfig?.providers?.find(
            (p: any) => p.name === currentProvider
          )?.status || 'unverified';
          
          const llmApiKey = serverProviderKey || prevConfig.llmApiKey;
          
          return {
            ...prevConfig,
            // Update ElevenLabs API key and status
            elevenLabsApiKey: updatedConfigData.elevenLabsConfig?.apiKey || prevConfig.elevenLabsApiKey,
            
            // Update status values from server
            elevenLabsStatus: updatedConfigData.elevenLabsConfig?.status || prevConfig.elevenLabsStatus,
            
            // Always take the updated voice settings, even if they're 0
            voiceSpeed: updatedConfigData.elevenLabsConfig?.voiceSpeed !== undefined
              ? updatedConfigData.elevenLabsConfig.voiceSpeed
              : prevConfig.voiceSpeed,
              
            voiceStability: updatedConfigData.elevenLabsConfig?.voiceStability !== undefined
              ? updatedConfigData.elevenLabsConfig.voiceStability
              : prevConfig.voiceStability,
              
            voiceClarity: updatedConfigData.elevenLabsConfig?.voiceClarity !== undefined
              ? updatedConfigData.elevenLabsConfig.voiceClarity
              : prevConfig.voiceClarity,
              
            // Twilio config
            twilioAccountSid: updatedConfigData.twilioConfig?.accountSid || prevConfig.twilioAccountSid,
            twilioAuthToken: updatedConfigData.twilioConfig?.authToken || prevConfig.twilioAuthToken,
            twilioPhoneNumber: updatedConfigData.twilioConfig?.phoneNumbers?.[0] || prevConfig.twilioPhoneNumber,
            twilioStatus: updatedConfigData.twilioConfig?.status || prevConfig.twilioStatus,
            
            // LLM config
            llmProvider: updatedConfigData.llmConfig?.defaultProvider || prevConfig.llmProvider,
            llmModel: updatedConfigData.llmConfig?.defaultModel || prevConfig.llmModel,
            llmApiKey,
            llmStatus: currentProviderStatus,
            temperature: updatedConfigData.llmConfig?.temperature !== undefined
              ? updatedConfigData.llmConfig.temperature
              : prevConfig.temperature,
            maxTokens: updatedConfigData.llmConfig?.maxTokens !== undefined
              ? updatedConfigData.llmConfig.maxTokens
              : prevConfig.maxTokens,
            
            // General settings
            maxCallDuration: updatedConfigData.generalSettings?.maxCallDuration ?? prevConfig.maxCallDuration,
            systemPrompt: updatedConfigData.generalSettings?.defaultSystemPrompt || prevConfig.systemPrompt,
            timeZone: updatedConfigData.generalSettings?.defaultTimeZone || prevConfig.timeZone,
            
            // Webhook config
            webhookUrl: updatedConfigData.webhookConfig?.url || prevConfig.webhookUrl,
            webhookSecret: updatedConfigData.webhookConfig?.secret || prevConfig.webhookSecret,
            webhookStatus: updatedConfigData.webhookConfig?.status || prevConfig.webhookStatus,
          };
      });
      
      // Show success toast and update state
      toast({
        title: "Configuration Saved",
        description: "Your settings have been successfully updated and applied.",
        variant: "default",
      });
      setSaveSuccess(true);
      
      // Auto-hide the success indicator after 3 seconds
      setTimeout(() => {
        setSaveSuccess(null);
      }, 3000);
    } catch (error) {
      console.error('Error saving configuration:', error);
      toast({
        title: "Error",
        description: "Failed to save configuration. Please try again.",
        variant: "destructive",
      });
      setSaveSuccess(false);
      
      // Auto-hide the error indicator after 5 seconds
      setTimeout(() => {
        setSaveSuccess(null);
      }, 5000);
    } finally {
      setSaving(false);
    }
  };

  const handleTestVoice = async () => {
    setTestingVoice(true);
    try {
      if (config.voiceProvider === 'elevenlabs') {
        const testText = "Hello! This is a test of the voice synthesis system. The voice sounds clear and natural.";
        console.log(`Testing voice with ID: ${config.voiceId}`);
        
        // Make sure we have a valid API key
        const apiKey = config.elevenLabsApiKey;
        if (!apiKey) {
          throw new Error('Please enter a valid API key.');
        }
        
        if (!config.voiceId) {
          throw new Error('Please select a voice to test.');
        }
        
        try {
          const result = await configApi.testVoiceSynthesis({ 
            voiceId: config.voiceId,
            text: testText,
            apiKey: apiKey
          });
          
          // Update status to verified on successful test
          setConfig(prev => ({
            ...prev,
            elevenLabsStatus: 'verified'
          }));
          
          // Play the synthesized audio
          if (result.audioData) {
            const audio = new Audio(result.audioData);
            await audio.play();
            
            toast({
              title: "Voice Test Successful",
              description: "Voice synthesis is working correctly and audio is playing.",
            });
          }
        } catch (error: any) {
          console.error('Voice synthesis test error:', error);
          
          // Update status to failed
          setConfig(prev => ({
            ...prev,
            elevenLabsStatus: 'failed'
          }));
          
          // Check for voice limit reached error
          const errorDetails = error.response?.data?.details;
          if (errorDetails && errorDetails.includes('voice_limit_reached')) {
            toast({
              title: "Voice Limit Reached",
              description: "You've reached your custom voice limit on ElevenLabs. Try using pre-built voices instead.",
              variant: "destructive",
            });
          } else {
            throw error;
          }
        }
      }
    } catch (error: any) {
      console.error('Voice test error:', error);
      
      // Update status to failed on any error
      setConfig(prev => ({
        ...prev,
        elevenLabsStatus: 'failed'
      }));
      
      toast({
        title: "Voice Test Failed",
        description: error.message || "Please check your ElevenLabs API key and voice ID.",
        variant: "destructive",
      });
    } finally {
      setTestingVoice(false);
    }
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    try {
      // Test Twilio connection
      if (config.twilioAccountSid && config.twilioAuthToken) {
        try {
          const twilioResult = await configApi.testTwilioConnection({
            accountSid: config.twilioAccountSid,
            authToken: config.twilioAuthToken,
            phoneNumber: config.twilioPhoneNumber
          });
          
          // Update Twilio status based on test result
          setConfig(prev => ({
            ...prev,
            twilioStatus: twilioResult.success ? 'verified' : 'failed'
          }));
        } catch (error) {
          setConfig(prev => ({
            ...prev,
            twilioStatus: 'failed'
          }));
        }
      }
      
      // Test LLM connection
      if (config.llmApiKey) {
        try {
          const llmResult = await configApi.testLLMConnection({
            provider: config.llmProvider,
            apiKey: config.llmApiKey,
            model: config.llmModel
          });
          
          // Update LLM status based on test result
          setConfig(prev => ({
            ...prev,
            llmStatus: llmResult.success ? 'verified' : 'failed'
          }));
        } catch (error) {
          setConfig(prev => ({
            ...prev,
            llmStatus: 'failed'
          }));
        }
      }
      
      // Test ElevenLabs connection if it's the current voice provider
      if (config.voiceProvider === 'elevenlabs' && config.elevenLabsApiKey) {
        try {
          const elevenLabsResult = await configApi.testElevenLabsConnection({
            apiKey: config.elevenLabsApiKey
          });
          
          // Update ElevenLabs status based on test result
          setConfig(prev => ({
            ...prev,
            elevenLabsStatus: elevenLabsResult.success ? 'verified' : 'failed'
          }));
        } catch (error) {
          setConfig(prev => ({
            ...prev,
            elevenLabsStatus: 'failed'
          }));
        }
      }
      
      toast({
        title: "Connection Test Completed",
        description: "All services have been tested. Check status indicators for results.",
      });
    } catch (error) {
      console.error('Connection test error:', error);
      toast({
        title: "Connection Test Failed",
        description: "An error occurred while testing connections.",
        variant: "destructive",
      });
    } finally {
      setTestingConnection(false);
    }
  };

  // Updates the API key and resets verification status
  const updateApiKey = (field: keyof Configuration, value: string) => {
    console.log(`Updating API key for ${field}`);
    
    // Reset verification status when API key changes
    let statusField: keyof Configuration | null = null;
    
    if (field === 'elevenLabsApiKey') {
      statusField = 'elevenLabsStatus';
    } else if (field === 'twilioAuthToken') {
      statusField = 'twilioStatus';
    } else if (field === 'llmApiKey') {
      statusField = 'llmStatus';
    } else if (field === 'webhookSecret') {
      statusField = 'webhookStatus';
    }
    
    setConfig(prev => {
      const updates: Partial<Configuration> = { [field]: value };
      
      // Reset status to unverified when API key changes
      if (statusField) {
        updates[statusField] = 'unverified';
      }
      
      return { ...prev, ...updates };
    });
  };

  // Updates a single field in the config state
  const updateConfig = (field: keyof Configuration, value: any) => {
    console.log(`Updating configuration field: ${field} with value:`, 
      field.includes('ApiKey') || field.includes('AuthToken') ? '[MASKED]' : value);
    
    // Special handling for API keys to reset verification status
    if (field === 'elevenLabsApiKey' || field === 'twilioAuthToken' || 
        field === 'llmApiKey' || field === 'webhookSecret') {
      updateApiKey(field, value);
      return;
    }
    
    setConfig((prev: Configuration) => {
      const newConfig = { ...prev, [field]: value };
      
      // Add additional logging for voice settings specifically
      if (field === 'voiceSpeed' || field === 'voiceStability' || field === 'voiceClarity') {
        console.log(`Voice setting updated - ${field}: ${value} (previous: ${prev[field]})`);
      }
      
      // Special handling for LLM provider changes
      if (field === 'llmProvider' && prev.llmProvider !== value) {
        console.log(`LLM provider changed from ${prev.llmProvider} to ${value}`);
      }
      
      return newConfig;
    });
  };

  // Handle LLM provider changes
  const handleProviderChange = useCallback((newProvider: 'openai' | 'anthropic' | 'google') => {
    // Update the provider
    updateConfig('llmProvider', newProvider);
    
    // Clear current models for the new provider
    setAvailableModels(prev => ({
      ...prev,
      [newProvider]: []
    }));
    
    // Clear selected model if it doesn't exist for the new provider
    if (config.llmModel && (!availableModels[newProvider] || !availableModels[newProvider].some(model => model.id === config.llmModel))) {
      updateConfig('llmModel', '');
    }
    
    // If we have an API key, trigger dynamic model fetching for the new provider
    if (config.llmApiKey) {
      console.log(`Provider changed to ${newProvider}, fetching models with existing API key`);
      fetchModelsWithApiKey(newProvider, config.llmApiKey);
    }
  }, [updateConfig, config.llmModel, config.llmApiKey, availableModels, fetchModelsWithApiKey]);

  // Handler for API key changes with debouncing
  const handleApiKeyChange = useCallback((value: string) => {
    // Update the config immediately for UI responsiveness
    updateConfig('llmApiKey', value);
    
    // Clear any existing timer
    if (apiKeyDebounceTimer) {
      clearTimeout(apiKeyDebounceTimer);
    }
    
    // Set a new timer to fetch models after user stops typing
    const timer = setTimeout(() => {
      fetchModelsWithApiKey(config.llmProvider, value);
    }, 1000); // 1 second delay
    
    setApiKeyDebounceTimer(timer);
  }, [config.llmProvider, fetchModelsWithApiKey, apiKeyDebounceTimer, updateConfig]);

  const handleDeleteItem = (type: string, name?: string) => {
    setItemToDelete({ type, name });
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    
    setDeleteDialogOpen(false);
    try {
      // Perform delete action based on the type
      if (itemToDelete.type === 'twilio') {
        await configApi.deleteApiKey({ provider: 'twilio' });
        toast({
          title: "Twilio Configuration Deleted",
          description: "Your Twilio settings have been removed.",
          variant: "destructive",
        });
      } else if (itemToDelete.type === 'elevenlabs') {
        await configApi.deleteApiKey({ provider: 'elevenlabs' });
        toast({
          title: "ElevenLabs Configuration Deleted",
          description: "Your ElevenLabs settings have been removed.",
          variant: "destructive",
        });
      } else if (itemToDelete.type === 'llm' && itemToDelete.name) {
        await configApi.deleteApiKey({ provider: 'llm', name: itemToDelete.name });
        toast({
          title: `${itemToDelete.name} API Key Deleted`,
          description: `Your ${itemToDelete.name} API key has been removed.`,
          variant: "destructive",
        });
      } else if (itemToDelete.type === 'webhook') {
        await configApi.deleteApiKey({ provider: 'webhook' });
        toast({
          title: "Webhook Secret Deleted",
          description: "Your webhook secret has been removed.",
          variant: "destructive",
        });
      }
      
      // Refresh configuration to get updated state after deletion
      await configApi.getConfiguration();
      
      // Update local state with updated configuration
      setConfig(prevConfig => {
        // Reset API keys based on the type deleted
        if (itemToDelete.type === 'twilio') {
          return {
            ...prevConfig,
            twilioAccountSid: '',
            twilioAuthToken: '',
            twilioPhoneNumber: '',
            twilioStatus: 'unverified'
          };
        } else if (itemToDelete.type === 'elevenlabs') {
          return {
            ...prevConfig,
            elevenLabsApiKey: '',
            elevenLabsStatus: 'unverified'
          };
        } else if (itemToDelete.type === 'llm' && itemToDelete.name) {
          return {
            ...prevConfig,
            ...(prevConfig.llmProvider === itemToDelete.name ? { 
              llmApiKey: '',
              llmStatus: 'unverified'
            } : {})
          };
        } else if (itemToDelete.type === 'webhook') {
          return {
            ...prevConfig,
            webhookSecret: '',
            webhookStatus: 'unverified'
          };
        }
        return prevConfig;
      });
      
      setItemToDelete(null);
    } catch (error) {
      console.error('Error deleting configuration:', error);
      toast({
        title: "Error Deleting Configuration",
        description: "Failed to delete the configuration. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleTestCall = async () => {
    // Validate inputs
    if (!testCallNumber) {
      toast({
        title: "Missing Phone Number",
        description: "Please enter a phone number to receive the test call.",
        variant: "destructive",
      });
      return;
    }

    // Validate that Twilio credentials are set
    if (!config.twilioAccountSid || !config.twilioAuthToken || !config.twilioPhoneNumber) {
      toast({
        title: "Missing Twilio Configuration",
        description: "Please configure your Twilio credentials and phone number first.",
        variant: "destructive",
      });
      return;
    }

    setTestingCall(true);
    try {
      const result = await configApi.makeTestCall({
        accountSid: config.twilioAccountSid,
        authToken: config.twilioAuthToken,
        fromNumber: config.twilioPhoneNumber,
        toNumber: testCallNumber,
        message: testCallMessage
      });
      
      if (result.success) {
        toast({
          title: "Test Call Initiated",
          description: `A test call is being made to ${testCallNumber}. Status: ${result.status}`,
        });
        
        // Update Twilio status to verified if successful
        setConfig(prev => ({
          ...prev,
          twilioStatus: 'verified'
        }));
      } else {
        toast({
          title: "Test Call Failed",
          description: result.message || "Failed to make test call. Please check your Twilio configuration.",
          variant: "destructive",
        });
        
        // Update Twilio status to failed
        setConfig(prev => ({
          ...prev,
          twilioStatus: 'failed'
        }));
      }
    } catch (error: any) {
      console.error('Test call error:', error);
      toast({
        title: "Test Call Error",
        description: error.message || "An error occurred while making the test call.",
        variant: "destructive",
      });
      
      // Update Twilio status to failed
      setConfig(prev => ({
        ...prev,
        twilioStatus: 'failed'
      }));
    } finally {
      setTestingCall(false);
      setOpenTestCallDialog(false);
    }
  };

  const handleTestLLMChat = async () => {
    // Validate input
    if (!testLLMPrompt) {
      toast({
        title: "Missing Prompt",
        description: "Please enter a test prompt.",
        variant: "destructive",
      });
      return;
    }

    // Validate that LLM credentials are set
    if (!config.llmApiKey) {
      toast({
        title: "Missing API Key",
        description: "Please enter a valid LLM API key first.",
        variant: "destructive",
      });
      return;
    }

    setTestingLLMChat(true);
    setTestLLMResponse("");
    
    try {
      // Use correct provider name - map to server expected names
      const providerName = config.llmProvider.toLowerCase();
      const serverProviderName = providerName; // No mapping needed now since frontend uses 'google'
      
      const result = await configApi.testLLMChat({
        provider: serverProviderName,
        model: config.llmModel,
        prompt: testLLMPrompt,
        temperature: config.temperature,
        apiKey: config.llmApiKey // Pass the current API key from the input
      });
      
      if (result.success) {
        setTestLLMResponse(result.response.content);
        
        toast({
          title: "Test Successful",
          description: "The LLM responded successfully to your prompt.",
        });
        
        // Update LLM status to verified if successful
        setConfig(prev => ({
          ...prev,
          llmStatus: 'verified'
        }));
      } else {
        toast({
          title: "Test Failed",
          description: result.message || "Failed to get a response from the LLM. Please check your configuration.",
          variant: "destructive",
        });
        
        // Update LLM status to failed
        setConfig(prev => ({
          ...prev,
          llmStatus: 'failed'
        }));
      }
    } catch (error: any) {
      console.error('LLM chat test error:', error);
      setTestLLMResponse("");
      toast({
        title: "Test Error",
        description: error.message || "An error occurred while testing the LLM.",
        variant: "destructive",
      });
      
      // Update LLM status to failed
      setConfig(prev => ({
        ...prev,
        llmStatus: 'failed'
      }));
    } finally {
      setTestingLLMChat(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Settings className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p>Loading configuration...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col space-y-4 sm:flex-row sm:justify-between sm:items-center sm:space-y-0">
        <div className="min-w-0 flex-shrink-0">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight truncate">Configuration</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Configure your AI calling system settings
          </p>
        </div>
        <div className="flex flex-row gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleTestConnection} disabled={testingConnection}>
            {testingConnection ? (
              <TestTube className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <TestTube className="h-4 w-4 mr-2" />
            )}
            Test Connection
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? (
              <Save className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Configuration
          </Button>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Voice Provider</CardTitle>
            <Mic className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">{config.voiceProvider}</div>
            <Badge variant="outline" className="mt-1">
              {config.elevenLabsStatus === 'verified' ? (
                <>
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Connected
                </>
              ) : config.elevenLabsStatus === 'failed' ? (
                <>
                  <AlertTriangle className="h-3 w-3 mr-1 text-red-500" />
                  Failed
                </>
              ) : config.elevenLabsApiKey ? (
                <>
                  <AlertTriangle className="h-3 w-3 mr-1 text-yellow-500" />
                  Unverified
                </>
              ) : (
                <>
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Not Set
                </>
              )}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">LLM Provider</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold capitalize">{config.llmProvider}</div>
            <Badge variant="outline" className="mt-1">
              {config.llmStatus === 'verified' ? (
                <>
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Active
                </>
              ) : config.llmStatus === 'failed' ? (
                <>
                  <AlertTriangle className="h-3 w-3 mr-1 text-red-500" />
                  Failed
                </>
              ) : config.llmApiKey ? (
                <>
                  <AlertTriangle className="h-3 w-3 mr-1 text-yellow-500" />
                  Unverified
                </>
              ) : (
                <>
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Not Set
                </>
              )}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Phone Service</CardTitle>
            <Phone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Twilio</div>
            <Badge variant="outline" className="mt-1">
              {config.twilioStatus === 'verified' ? (
                <>
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Connected
                </>
              ) : config.twilioStatus === 'failed' ? (
                <>
                  <AlertTriangle className="h-3 w-3 mr-1 text-red-500" />
                  Failed
                </>
              ) : config.twilioAccountSid ? (
                <>
                  <AlertTriangle className="h-3 w-3 mr-1 text-yellow-500" />
                  Unverified
                </>
              ) : (
                <>
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Not Set
                </>
              )}
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* AI Voice Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Volume2 className="h-5 w-5" />
            AI Voice Settings
          </CardTitle>
          <CardDescription>
            Configure the voice synthesis for your AI calls
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="voiceProvider">Voice Provider</Label>
              <Select
                value={config.voiceProvider}
                onValueChange={(value) => updateConfig('voiceProvider', value)}
              >
                <SelectTrigger id="voiceProvider" className="w-full h-10 rounded-xl">
                  <SelectValue placeholder="Select voice provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="elevenlabs">ElevenLabs</SelectItem>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="google">Google Cloud</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="voiceId">Voice</Label>
              <Select
                value={config.voiceId}
                onValueChange={(value) => updateConfig('voiceId', value)}
              >
                <SelectTrigger id="voiceId" className="w-full h-10 rounded-xl">
                  <SelectValue placeholder="Select a voice" />
                </SelectTrigger>
                <SelectContent>
                  {availableVoices.map((voice) => (
                    <SelectItem key={voice.voiceId} value={voice.voiceId}>
                      {voice.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {config.voiceProvider === 'elevenlabs' && (
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="elevenLabsApiKey">ElevenLabs API Key</Label>
                  {config.elevenLabsApiKey && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleDeleteItem('elevenlabs')}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete Key
                    </Button>
                  )}
                </div>
                <PasswordInput
                  id="elevenLabsApiKey"
                  value={config.elevenLabsApiKey}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateConfig('elevenLabsApiKey', e.target.value)}
                  placeholder="Enter your ElevenLabs API key"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="voiceSpeed">Voice Speed ({config.voiceSpeed}x)</Label>
              <Slider
                id="voiceSpeed"
                min={0.5}
                max={2.0}
                step={0.1}
                value={[config.voiceSpeed]}
                onValueChange={(value) => updateConfig('voiceSpeed', value[0])}
                className="py-4"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="voiceStability">Voice Stability ({Math.round(config.voiceStability * 100)}%)</Label>
              <Slider
                id="voiceStability"
                min={0}
                max={1}
                step={0.1}
                value={[config.voiceStability]}
                onValueChange={(value) => updateConfig('voiceStability', value[0])}
                className="py-4"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="voiceClarity">Voice Clarity ({Math.round(config.voiceClarity * 100)}%)</Label>
              <Slider
                id="voiceClarity"
                min={0}
                max={1}
                step={0.1}
                value={[config.voiceClarity]}
                onValueChange={(value) => updateConfig('voiceClarity', value[0])}
                className="py-4"
              />
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleTestVoice} disabled={testingVoice}>
            {testingVoice ? (
              <Mic className="h-4 w-4 mr-2 animate-pulse" />
            ) : (
              <Mic className="h-4 w-4 mr-2" />
            )}
            {testingVoice ? 'Testing...' : 'Test Voice'}
          </Button>
          <div className="text-xs text-muted-foreground mt-2">
            Make sure you've entered a valid API key and voice ID before testing. 
            Voice IDs can be found in your ElevenLabs dashboard.
          </div>
        </CardContent>
      </Card>

      {/* Phone Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Phone Integration
          </CardTitle>
          <CardDescription>
            Configure Twilio settings for making calls
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="twilioAccountSid">Twilio Account SID</Label>
                {config.twilioAccountSid && config.twilioAuthToken && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleDeleteItem('twilio')}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete Keys
                  </Button>
                )}
              </div>
              <PasswordInput
                id="twilioAccountSid"
                value={config.twilioAccountSid}
                onChange={(e) => updateConfig('twilioAccountSid', e.target.value)}
                placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="twilioAuthToken">Twilio Auth Token</Label>
              <PasswordInput
                id="twilioAuthToken"
                value={config.twilioAuthToken}
                onChange={(e) => updateConfig('twilioAuthToken', e.target.value)}
                placeholder="your-auth-token"
              />
            </div>
            <div className="space-y-2 lg:col-span-1">
              <Label htmlFor="twilioPhoneNumber">Twilio Phone Number</Label>
              <Input
                id="twilioPhoneNumber"
                value={config.twilioPhoneNumber}
                onChange={(e) => updateConfig('twilioPhoneNumber', e.target.value)}
                placeholder="+1234567890"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setOpenTestCallDialog(true)} 
              disabled={!config.twilioAccountSid || !config.twilioAuthToken || !config.twilioPhoneNumber || testingCall}
            >
              {testingCall ? (
                <PhoneCall className="h-4 w-4 mr-2 animate-pulse" />
              ) : (
                <PhoneCall className="h-4 w-4 mr-2" />
              )}
              {testingCall ? 'Making Call...' : 'Test Call'}
            </Button>
          </div>
          <div className="text-xs text-muted-foreground mt-2">
            Make sure you've entered valid Twilio credentials and a phone number before testing.
          </div>
        </CardContent>
      </Card>

      {/* AI Model Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            AI Model Configuration
          </CardTitle>
          <CardDescription>
            Configure the language model for conversations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="llmProvider">LLM Provider</Label>
              <Select
                value={config.llmProvider}
                onValueChange={(value) => handleProviderChange(value as 'openai' | 'anthropic' | 'google')}
              >
                <SelectTrigger id="llmProvider" className="w-full h-10 rounded-xl">
                  <SelectValue placeholder="Select LLM provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="anthropic">Anthropic</SelectItem>
                  <SelectItem value="google">Google Gemini</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="llmModel">Model</Label>
              <Select
                value={config.llmModel}
                onValueChange={(value) => updateConfig('llmModel', value)}
              >
                <SelectTrigger id="llmModel" className="w-full h-10 rounded-xl">
                  <SelectValue placeholder="Select a model">
                    {config.llmModel && availableModels[config.llmProvider] ? (
                      <span className="font-medium">
                        {availableModels[config.llmProvider].find(model => model.id === config.llmModel)?.name || config.llmModel}
                      </span>
                    ) : (
                      "Select a model"
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {loadingModels ? (
                    <SelectItem value="" disabled>Loading models...</SelectItem>
                  ) : availableModels[config.llmProvider]?.length > 0 ? (
                    availableModels[config.llmProvider].map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        <div className="flex flex-col">
                          <span className="font-medium">{model.name}</span>
                          {model.description && (
                            <span className="text-xs text-muted-foreground truncate max-w-[300px]">
                              {model.description}
                            </span>
                          )}
                          {model.pricing && (
                            <span className="text-xs text-muted-foreground">
                              Input: ${model.pricing.input}/1K tokens, Output: ${model.pricing.output}/1K tokens
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="" disabled>
                      {config.llmApiKey 
                        ? 'No models available' 
                        : 'Enter API key to see available models'
                      }
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="llmApiKey">API Key</Label>
                  {config.llmApiKey && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleDeleteItem('llm', config.llmProvider)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete Key
                    </Button>
                  )}
                </div>
                <PasswordInput
                  id="llmApiKey"
                  value={config.llmApiKey}
                  onChange={(e) => handleApiKeyChange(e.target.value)}
                  placeholder="sk-..."
                />
              </div>
            <div className="space-y-2">
              <Label htmlFor="temperature">Temperature ({config.temperature})</Label>
              <Slider
                id="temperature"
                min={0}
                max={1}
                step={0.1}
                value={[config.temperature]}
                onValueChange={(value) => updateConfig('temperature', value[0])}
                className="py-4"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="systemPrompt">System Prompt</Label>
            <Textarea
              id="systemPrompt"
              value={config.systemPrompt}
              onChange={(e) => updateConfig('systemPrompt', e.target.value)}
              rows={8}
              placeholder="Enter the system prompt for your AI assistant..."
              className="min-h-[120px] sm:min-h-[200px]"
            />
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setOpenTestLLMChatDialog(true)} 
              disabled={!config.llmApiKey || testingLLMChat}
            >
              {testingLLMChat ? (
                <MessageSquare className="h-4 w-4 mr-2 animate-pulse" />
              ) : (
                <MessageSquare className="h-4 w-4 mr-2" />
              )}
              {testingLLMChat ? 'Testing...' : 'Test AI Chat'}
            </Button>
          </div>
          <div className="text-xs text-muted-foreground mt-2">
            Test your LLM configuration with a sample prompt to ensure it's working correctly.
          </div>
        </CardContent>
      </Card>

      {/* Call Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Call Settings
          </CardTitle>
          <CardDescription>
            Configure call behavior and retry logic
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="maxCallDuration">Max Call Duration (seconds)</Label>
              <Input
                id="maxCallDuration"
                type="number"
                value={config.maxCallDuration}
                onChange={(e) => updateConfig('maxCallDuration', parseInt(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="retryAttempts">Retry Attempts</Label>
              <Input
                id="retryAttempts"
                type="number"
                value={config.retryAttempts}
                onChange={(e) => updateConfig('retryAttempts', parseInt(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="retryDelay">Retry Delay (seconds)</Label>
              <Input
                id="retryDelay"
                type="number"
                value={config.retryDelay}
                onChange={(e) => updateConfig('retryDelay', parseInt(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="timeZone">Time Zone</Label>
              <Select
                value={config.timeZone}
                onValueChange={(value) => updateConfig('timeZone', value)}
              >
                <SelectTrigger id="timeZone" className="w-full h-10 rounded-xl">
                  <SelectValue placeholder="Select time zone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="America/New_York">Eastern Time</SelectItem>
                  <SelectItem value="America/Chicago">Central Time</SelectItem>
                  <SelectItem value="America/Denver">Mountain Time</SelectItem>
                  <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                  <SelectItem value="UTC">UTC</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Webhook Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Webhook Integration
          </CardTitle>
          <CardDescription>
            Configure webhook for receiving call events
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-2 lg:col-span-2">
              <Label htmlFor="webhookUrl">Webhook URL</Label>
              <Input
                id="webhookUrl"
                value={config.webhookUrl}
                onChange={(e) => updateConfig('webhookUrl', e.target.value)}
                placeholder="https://your-server.com/webhook"
              />
            </div>
            <div className="space-y-2 lg:col-span-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="webhookSecret">Webhook Secret</Label>
                {config.webhookSecret && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleDeleteItem('webhook')}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete Secret
                  </Button>
                )}
              </div>
              <PasswordInput
                id="webhookSecret"
                value={config.webhookSecret}
                onChange={(e) => updateConfig('webhookSecret', e.target.value)}
                placeholder="Enter your webhook secret key"
              />
              <div className="text-xs text-muted-foreground mt-2">
                The webhook secret is used to verify that requests are coming from our service.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
            <AlertDialogDescription>
              {itemToDelete?.type === 'twilio' && 'Are you sure you want to delete your Twilio configuration?'}
              {itemToDelete?.type === 'elevenlabs' && 'Are you sure you want to delete your ElevenLabs configuration?'}
              {itemToDelete?.type === 'llm' && `Are you sure you want to delete your ${itemToDelete.name} API key?`}
              {itemToDelete?.type === 'webhook' && 'Are you sure you want to delete your Webhook secret?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteDialogOpen(false)}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete} 
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Save Success Indicator */}
      {saveSuccess !== null && (
        <div className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-lg transition-opacity duration-500 flex items-center gap-2 ${
          saveSuccess ? 'bg-green-100 text-green-800 border border-green-300' : 'bg-red-100 text-red-800 border border-red-300'
        }`}>
          {saveSuccess ? (
            <Check className="h-5 w-5 text-green-600" />
          ) : (
            <X className="h-5 w-5 text-red-600" />
          )}
          {saveSuccess 
            ? 'Configuration saved successfully!' 
            : 'Failed to save configuration. Please try again.'}
        </div>
      )}

      {/* Test Call Dialog */}
      <AlertDialog open={openTestCallDialog} onOpenChange={setOpenTestCallDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Make Test Call</AlertDialogTitle>
            <AlertDialogDescription>
              This will make a test call using your Twilio configuration.
              Enter the phone number that should receive the test call.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="testCallNumber">Phone Number to Call</Label>
              <Input
                id="testCallNumber"
                placeholder="+1234567890"
                value={testCallNumber}
                onChange={(e) => setTestCallNumber(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Enter a phone number in E.164 format (e.g., +1234567890)</p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="testCallMessage">Test Message (Optional)</Label>
              <Textarea
                id="testCallMessage"
                placeholder="This is a test call from your AI calling system."
                value={testCallMessage}
                onChange={(e) => setTestCallMessage(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleTestCall} disabled={testingCall}>
              {testingCall ? 'Making Call...' : 'Make Test Call'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Test LLM Chat Dialog */}
      <AlertDialog open={openTestLLMChatDialog} onOpenChange={setOpenTestLLMChatDialog}>
        <AlertDialogContent className="max-w-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Test AI Chat</AlertDialogTitle>
            <AlertDialogDescription>
              Test your AI model with a sample prompt to verify it's working correctly.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="testLLMPrompt">Test Prompt</Label>
              <Textarea
                id="testLLMPrompt"
                placeholder="Enter a prompt to test the AI response..."
                value={testLLMPrompt}
                onChange={(e) => setTestLLMPrompt(e.target.value)}
                rows={3}
              />
            </div>
            
            {testLLMResponse && (
              <div className="space-y-2 mt-4">
                <Label>AI Response</Label>
                <div className="border rounded-md p-3 bg-muted text-muted-foreground whitespace-pre-wrap">
                  {testLLMResponse}
                </div>
              </div>
            )}
          </div>
          
          <AlertDialogFooter>
            <AlertDialogCancel>Close</AlertDialogCancel>
            <AlertDialogAction onClick={handleTestLLMChat} disabled={testingLLMChat}>
              {testingLLMChat ? 'Testing...' : 'Test AI Response'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Configuration;
