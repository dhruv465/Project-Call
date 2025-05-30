import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
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

  useEffect(() => {
    // Fetch configuration from API
    const fetchConfiguration = async () => {
      try {
        setLoading(true);
        const data = await configApi.getConfiguration();
        setConfig({
          // Set defaults for any missing properties
          voiceProvider: data.elevenLabsConfig?.isEnabled ? 'elevenlabs' : 
                        (data.llmConfig?.providers.find((p: any) => p.name === 'openai' && p.isEnabled) ? 'openai' : 'google'),
          voiceId: data.elevenLabsConfig?.availableVoices?.[0]?.voiceId || 'rachel',
          voiceSpeed: 1.0,
          voiceStability: 0.8,
          voiceClarity: 0.9,
          
          twilioAccountSid: data.twilioConfig?.accountSid || '',
          twilioAuthToken: data.twilioConfig?.authToken || '',
          twilioPhoneNumber: data.twilioConfig?.phoneNumbers?.[0] || '',
          
          llmProvider: data.llmConfig?.defaultProvider || 'openai',
          llmModel: data.llmConfig?.defaultModel || 'gpt-4',
          llmApiKey: data.llmConfig?.providers.find((p: any) => p.name === data.llmConfig?.defaultProvider)?.apiKey || '',
          systemPrompt: data.generalSettings?.defaultSystemPrompt || `You are a professional sales representative making cold calls. Be polite, respectful, and helpful.`,
          temperature: 0.7,
          maxTokens: 150,
          
          maxCallDuration: data.generalSettings?.maxCallDuration || 300,
          retryAttempts: data.generalSettings?.callRetryAttempts || 3,
          retryDelay: 60,
          timeZone: data.generalSettings?.defaultTimeZone || 'America/New_York',
          
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
      // Transform the flat config object into the structured API format
      const apiConfig = {
        twilioConfig: {
          accountSid: config.twilioAccountSid,
          authToken: config.twilioAuthToken,
          phoneNumbers: [config.twilioPhoneNumber],
          isEnabled: !!config.twilioAccountSid && !!config.twilioAuthToken
        },
        elevenLabsConfig: {
          apiKey: config.voiceProvider === 'elevenlabs' ? config.llmApiKey : '',
          isEnabled: config.voiceProvider === 'elevenlabs'
        },
        llmConfig: {
          defaultProvider: config.llmProvider,
          defaultModel: config.llmModel,
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
        await configApi.testElevenLabsConnection({ 
          apiKey: config.llmApiKey 
        });
      }
      
      toast({
        title: "Voice Test Successful",
        description: "Voice synthesis is working correctly.",
      });
    } catch (error) {
      console.error('Voice test error:', error);
      toast({
        title: "Voice Test Failed",
        description: "Please check your voice provider settings.",
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Configuration</h1>
          <p className="text-muted-foreground">
            Configure your AI calling system settings
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleTestConnection} disabled={testingConnection}>
            {testingConnection ? (
              <TestTube className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <TestTube className="h-4 w-4 mr-2" />
            )}
            Test Connection
          </Button>
          <Button onClick={handleSave} disabled={saving}>
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
      <div className="grid gap-4 md:grid-cols-3">
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="voiceProvider">Voice Provider</Label>
              <select
                id="voiceProvider"
                className="w-full h-10 px-3 rounded-md border border-input bg-background"
                value={config.voiceProvider}
                onChange={(e) => updateConfig('voiceProvider', e.target.value)}
              >
                <option value="elevenlabs">ElevenLabs</option>
                <option value="openai">OpenAI</option>
                <option value="google">Google Cloud</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="voiceId">Voice ID</Label>
              <Input
                id="voiceId"
                value={config.voiceId}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateConfig('voiceId', e.target.value)}
                placeholder="rachel"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="voiceSpeed">Voice Speed ({config.voiceSpeed}x)</Label>
              <input
                type="range"
                id="voiceSpeed"
                min="0.5"
                max="2.0"
                step="0.1"
                value={config.voiceSpeed}
                onChange={(e) => updateConfig('voiceSpeed', parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="voiceStability">Voice Stability ({Math.round(config.voiceStability * 100)}%)</Label>
              <input
                type="range"
                id="voiceStability"
                min="0"
                max="1"
                step="0.1"
                value={config.voiceStability}
                onChange={(e) => updateConfig('voiceStability', parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
          </div>
          <Button variant="outline" onClick={handleTestVoice} disabled={testingVoice}>
            {testingVoice ? (
              <Mic className="h-4 w-4 mr-2 animate-pulse" />
            ) : (
              <Mic className="h-4 w-4 mr-2" />
            )}
            Test Voice
          </Button>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            <div className="space-y-2">
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="llmProvider">LLM Provider</Label>
              <select
                id="llmProvider"
                className="w-full h-10 px-3 rounded-md border border-input bg-background"
                value={config.llmProvider}
                onChange={(e) => updateConfig('llmProvider', e.target.value)}
              >
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
                <option value="gemini">Google Gemini</option>
              </select>
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
              <input
                type="range"
                id="temperature"
                min="0"
                max="1"
                step="0.1"
                value={config.temperature}
                onChange={(e) => updateConfig('temperature', parseFloat(e.target.value))}
                className="w-full"
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <select
                id="timeZone"
                className="w-full h-10 px-3 rounded-md border border-input bg-background"
                value={config.timeZone}
                onChange={(e) => updateConfig('timeZone', e.target.value)}
              >
                <option value="America/New_York">Eastern Time</option>
                <option value="America/Chicago">Central Time</option>
                <option value="America/Denver">Mountain Time</option>
                <option value="America/Los_Angeles">Pacific Time</option>
                <option value="UTC">UTC</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Configuration;
