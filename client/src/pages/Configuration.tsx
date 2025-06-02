import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
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
  Zap
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { configApi } from '@/services/configApi';

interface Configuration {
  // AI Voice Settings
  voiceProvider: 'elevenlabs' | 'openai' | 'google';
  voiceId: string;
  voiceSpeed: number;
  voiceStability: number;
  voiceClarity: number;
  elevenLabsApiKey: string;
  
  // Phone Settings
  twilioAccountSid: string;
  twilioAuthToken: string;
  twilioPhoneNumber: string;
  
  // AI Model Settings
  llmProvider: 'openai' | 'anthropic' | 'google';
  llmModel: string;
  llmApiKey: string;
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
    
    // Phone Settings
    twilioAccountSid: '',
    twilioAuthToken: '',
    twilioPhoneNumber: '',
    
    // AI Model Settings
    llmProvider: 'openai',
    llmModel: 'gpt-4',
    llmApiKey: '',
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
    webhookSecret: ''
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingVoice, setTestingVoice] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<{voiceId: string, name: string, previewUrl?: string}[]>([]);
  
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
  const [availableVoices, setAvailableVoices] = useState<{voiceId: string, name: string, previewUrl?: string}[]>([]);
  
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
      // First set pre-built voices
      setAvailableVoices(prebuiltVoices);
      
      // Then try to fetch custom voices if the API key is set
      if (config.elevenLabsApiKey && !config.elevenLabsApiKey.includes('••••••••')) {
        const result = await configApi.testElevenLabsConnection({
          apiKey: config.elevenLabsApiKey
        });
        
        if (result.success && result.details?.availableVoices) {
          // Combine pre-built and custom voices
          setAvailableVoices([
            ...prebuiltVoices,
            ...result.details.availableVoices
          ]);
        }
      }
    } catch (error) {
      console.error('Error loading voices:', error);
      // Keep pre-built voices as fallback
    }
  }, [config.elevenLabsApiKey]);

  // Load available voices when API key changes
  const loadVoices = useCallback(async () => {
    try {
      // Start with prebuilt voices
      setAvailableVoices(prebuiltVoices);
      
      // Try to fetch custom voices if API key is set and not masked
      if (config.elevenLabsApiKey && !config.elevenLabsApiKey.includes('••••••••')) {
        const result = await configApi.testElevenLabsConnection({
          apiKey: config.elevenLabsApiKey
        });
        
        if (result.success && result.details?.availableVoices) {
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

  useEffect(() => {
    // Load voices when API key changes or on initial load
    loadVoices();
  }, [config.elevenLabsApiKey, loadVoices]);

  useEffect(() => {
    // Fetch configuration from API
    const fetchConfiguration = async () => {
      try {
        setLoading(true);
        const data = await configApi.getConfiguration();
        console.log('Fetched configuration:', data);
        
        setConfig({
          // Set defaults for any missing properties
          voiceProvider: data.elevenLabsConfig?.isEnabled ? 'elevenlabs' : 
                        (data.llmConfig?.providers.find((p: any) => p.name === 'openai' && p.isEnabled) ? 'openai' : 'google'),
          voiceId: data.elevenLabsConfig?.availableVoices?.[0]?.voiceId || 'rachel',
          voiceSpeed: data.elevenLabsConfig?.voiceSpeed || 1.0,
          voiceStability: data.elevenLabsConfig?.voiceStability || 0.8,
          voiceClarity: data.elevenLabsConfig?.voiceClarity || 0.9,
          elevenLabsApiKey: data.elevenLabsConfig?.apiKey || '',
          
          twilioAccountSid: data.twilioConfig?.accountSid || '',
          twilioAuthToken: data.twilioConfig?.authToken || '',
          twilioPhoneNumber: data.twilioConfig?.phoneNumbers?.[0] || '',
          
          llmProvider: data.llmConfig?.defaultProvider || 'openai',
          llmModel: data.llmConfig?.defaultModel || 'gpt-4',
          llmApiKey: data.llmConfig?.providers.find((p: any) => p.name === data.llmConfig?.defaultProvider)?.apiKey || '',
          systemPrompt: data.generalSettings?.defaultSystemPrompt || `You are a professional sales representative making cold calls. Be polite, respectful, and helpful.`,
          temperature: data.llmConfig?.temperature || 0.7,
          maxTokens: data.llmConfig?.maxTokens || 150,
          
          maxCallDuration: data.generalSettings?.maxCallDuration || 300,
          retryAttempts: data.generalSettings?.callRetryAttempts || 3,
          retryDelay: 60,
          timeZone: data.generalSettings?.defaultTimeZone || data.generalSettings?.workingHours?.timeZone || 'America/New_York',
          
          webhookUrl: data.webhookConfig?.url || '',
          webhookSecret: data.webhookConfig?.secret || ''
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
    try {
      // Debug log before save
      console.log('Saving configuration with state:', {
        voiceProvider: config.voiceProvider,
        voiceId: config.voiceId,
        elevenLabsApiKey: config.elevenLabsApiKey ? 'SET' : 'NOT SET',
        twilioAccountSid: config.twilioAccountSid ? 'SET' : 'NOT SET',
        twilioAuthToken: config.twilioAuthToken ? 'SET' : 'NOT SET',
      });
      
      // Transform the flat config object into the structured API format
      const apiConfig = {
        twilioConfig: {
          accountSid: config.twilioAccountSid,
          authToken: config.twilioAuthToken,
          phoneNumbers: [config.twilioPhoneNumber],
          isEnabled: !!config.twilioAccountSid && !!config.twilioAuthToken
        },
        elevenLabsConfig: {
          apiKey: config.elevenLabsApiKey,
          isEnabled: config.voiceProvider === 'elevenlabs' && !!config.elevenLabsApiKey,
          voiceSpeed: config.voiceSpeed,
          voiceStability: config.voiceStability,
          voiceClarity: config.voiceClarity,
          // Don't override existing voices, just ensure we have one if it's empty
          availableVoices: [{
            voiceId: config.voiceId,
            name: 'Default Voice',
            previewUrl: ''
          }]
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
              isEnabled: config.llmProvider === 'openai'
            },
            {
              name: 'anthropic',
              apiKey: config.llmProvider === 'anthropic' ? config.llmApiKey : '',
              isEnabled: config.llmProvider === 'anthropic'
            },
            {
              name: 'google',
              apiKey: config.llmProvider === 'google' ? config.llmApiKey : '',
              isEnabled: config.llmProvider === 'google'
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
          secret: config.webhookSecret
        }
      };
      
      await configApi.updateConfiguration(apiConfig);
      
      // Fetch the updated configuration to ensure we have the latest data
      const updatedConfigData = await configApi.getConfiguration();
      
      // Update the local state with the fresh data
      setConfig({
        ...config,
        // If we get masked API keys back, keep our current values
        elevenLabsApiKey: updatedConfigData.elevenLabsConfig?.apiKey?.includes('••••••••') 
          ? config.elevenLabsApiKey 
          : updatedConfigData.elevenLabsConfig?.apiKey || '',
        voiceSpeed: updatedConfigData.elevenLabsConfig?.voiceSpeed || config.voiceSpeed,
        voiceStability: updatedConfigData.elevenLabsConfig?.voiceStability || config.voiceStability,
        voiceClarity: updatedConfigData.elevenLabsConfig?.voiceClarity || config.voiceClarity,
        twilioAccountSid: updatedConfigData.twilioConfig?.accountSid || config.twilioAccountSid,
        twilioAuthToken: updatedConfigData.twilioConfig?.authToken?.includes('••••••••')
          ? config.twilioAuthToken
          : updatedConfigData.twilioConfig?.authToken || '',
        twilioPhoneNumber: updatedConfigData.twilioConfig?.phoneNumbers?.[0] || config.twilioPhoneNumber,
        temperature: updatedConfigData.llmConfig?.temperature || config.temperature,
        maxTokens: updatedConfigData.llmConfig?.maxTokens || config.maxTokens,
        maxCallDuration: updatedConfigData.generalSettings?.maxCallDuration || config.maxCallDuration,
        systemPrompt: updatedConfigData.generalSettings?.defaultSystemPrompt || config.systemPrompt,
        timeZone: updatedConfigData.generalSettings?.defaultTimeZone || config.timeZone,
        webhookUrl: updatedConfigData.webhookConfig?.url || config.webhookUrl,
        webhookSecret: updatedConfigData.webhookConfig?.secret?.includes('••••••••')
          ? config.webhookSecret
          : updatedConfigData.webhookConfig?.secret || '',
      });
      
      toast({
        title: "Configuration Saved",
        description: "Your settings have been successfully updated.",
      });
    } catch (error) {
      console.error('Error saving configuration:', error);
      toast({
        title: "Error",
        description: "Failed to save configuration. Please try again.",
        variant: "destructive",
      });
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
        
        // Make sure we're not sending a masked API key
        const apiKey = config.elevenLabsApiKey;
        if (!apiKey || apiKey.includes('••••••••')) {
          throw new Error('Please enter a valid API key. The masked key cannot be used for testing.');
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
        await configApi.testTwilioConnection({
          accountSid: config.twilioAccountSid,
          authToken: config.twilioAuthToken,
          phoneNumber: config.twilioPhoneNumber
        });
      }
      
      // Test LLM connection
      if (config.llmApiKey) {
        await configApi.testLLMConnection({
          provider: config.llmProvider,
          apiKey: config.llmApiKey,
          model: config.llmModel
        });
      }
      
      toast({
        title: "Connection Test Successful",
        description: "All services are properly configured.",
      });
    } catch (error) {
      console.error('Connection test error:', error);
      toast({
        title: "Connection Test Failed",
        description: "Please verify your API credentials.",
        variant: "destructive",
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const updateConfig = (field: keyof Configuration, value: any) => {
    setConfig((prev: Configuration) => ({ ...prev, [field]: value }));
  };

  // Debug function to log current configuration state
  // Removed unused function

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
              <CheckCircle className="h-3 w-3 mr-1" />
              Connected
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
              <CheckCircle className="h-3 w-3 mr-1" />
              Active
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
              {config.twilioAccountSid ? (
                <>
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Configured
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
                <Label htmlFor="elevenLabsApiKey">ElevenLabs API Key</Label>
                <Input
                  id="elevenLabsApiKey"
                  type="password"
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
              <Label htmlFor="twilioAccountSid">Twilio Account SID</Label>
              <Input
                id="twilioAccountSid"
                type="password"
                value={config.twilioAccountSid}
                onChange={(e) => updateConfig('twilioAccountSid', e.target.value)}
                placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="twilioAuthToken">Twilio Auth Token</Label>
              <Input
                id="twilioAuthToken"
                type="password"
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
                onValueChange={(value) => updateConfig('llmProvider', value)}
              >
                <SelectTrigger id="llmProvider" className="w-full h-10 rounded-xl">
                  <SelectValue placeholder="Select LLM provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="anthropic">Anthropic</SelectItem>
                  <SelectItem value="gemini">Google Gemini</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="llmModel">Model</Label>
              <Input
                id="llmModel"
                value={config.llmModel}
                onChange={(e) => updateConfig('llmModel', e.target.value)}
                placeholder="gpt-4"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="llmApiKey">API Key</Label>
              <Input
                id="llmApiKey"
                type="password"
                value={config.llmApiKey}
                onChange={(e) => updateConfig('llmApiKey', e.target.value)}
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
    </div>
  );
};

export default Configuration;
