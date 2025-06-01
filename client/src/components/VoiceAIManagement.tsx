import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Mic, 
  Volume2, 
  Brain, 
  Languages, 
  Heart, 
  Zap, 
  TrendingUp, 
  RotateCcw
} from 'lucide-react';
import { toast } from 'sonner';

interface VoicePersonality {
  id: string;
  name: string;
  description: string;
  emotionalRange: string[];
  languageSupport: string[];
  trainingMetrics: {
    emotionAccuracy: number;
    adaptationAccuracy: number;
    customerSatisfactionScore: number;
    conversionRate: number;
  };
}

interface EmotionAnalysis {
  primary: string;
  confidence: number;
  intensity: number;
  context: string;
  culturalContext?: string;
  adaptationNeeded: boolean;
}

interface TrainingResults {
  emotionAccuracy: number;
  personalityAccuracy: number;
  bilingualAccuracy: number;
  conversationalAccuracy: number;
  overallAccuracy: number;
  trainingComplete: boolean;
  modelVersion: string;
}

const VoiceAIManagement: React.FC = () => {
  const [personalities, setPersonalities] = useState<VoicePersonality[]>([]);
  const [selectedPersonality, setSelectedPersonality] = useState<string>('professional');
  const [selectedLanguage, setSelectedLanguage] = useState<'English' | 'Hindi'>('English');
  const [isModelTrained, setIsModelTrained] = useState(false);
  const [isTraining, setIsTraining] = useState(false);
  const [trainingProgress, setTrainingProgress] = useState(0);
  const [testText, setTestText] = useState('');
  const [emotionAnalysis, setEmotionAnalysis] = useState<EmotionAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [trainingResults, setTrainingResults] = useState<TrainingResults | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  useEffect(() => {
    loadVoicePersonalities();
  }, []);

  const loadVoicePersonalities = async () => {
    try {
      const response = await fetch('/api/lumina-outreach/personalities', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setPersonalities(data.personalities);
        setIsModelTrained(data.modelTrained);
      }
    } catch (error) {
      console.error('Error loading voice personalities:', error);
      toast.error('Failed to load voice personalities');
    }
  };

  const trainVoiceModel = async () => {
    setIsTraining(true);
    setTrainingProgress(0);
    
    try {
      // Simulate training progress
      const progressInterval = setInterval(() => {
        setTrainingProgress(prev => {
          if (prev >= 95) {
            clearInterval(progressInterval);
            return 95;
          }
          return prev + 5;
        });
      }, 500);

      const response = await fetch('/api/lumina-outreach/train-model', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      clearInterval(progressInterval);
      setTrainingProgress(100);

      if (response.ok) {
        const data = await response.json();
        setTrainingResults(data.trainingResults);
        setIsModelTrained(true);
        toast.success('Voice AI model trained successfully!');
      } else {
        throw new Error('Training failed');
      }
    } catch (error) {
      console.error('Error training voice model:', error);
      toast.error('Failed to train voice model');
    } finally {
      setIsTraining(false);
      setTimeout(() => setTrainingProgress(0), 2000);
    }
  };

  const analyzeEmotion = async () => {
    if (!testText.trim()) {
      toast.error('Please enter text to analyze');
      return;
    }

    setIsAnalyzing(true);
    try {
      const response = await fetch('/api/lumina-outreach/analyze-emotion', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: testText,
          language: selectedLanguage
        })
      });

      if (response.ok) {
        const data = await response.json();
        setEmotionAnalysis(data.emotionAnalysis);
        toast.success('Emotion analysis completed');
      } else {
        throw new Error('Analysis failed');
      }
    } catch (error) {
      console.error('Error analyzing emotion:', error);
      toast.error('Failed to analyze emotion');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const synthesizeSpeech = async () => {
    if (!testText.trim()) {
      toast.error('Please enter text to synthesize');
      return;
    }

    setIsSynthesizing(true);
    try {
      const response = await fetch('/api/lumina-outreach/synthesize-speech', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: testText,
          personalityId: selectedPersonality,
          language: selectedLanguage,
          emotionalContext: emotionAnalysis?.context
        })
      });

      if (response.ok) {
        const audioBlob = await response.blob();
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        toast.success('Speech synthesized successfully');
      } else {
        throw new Error('Synthesis failed');
      }
    } catch (error) {
      console.error('Error synthesizing speech:', error);
      toast.error('Failed to synthesize speech');
    } finally {
      setIsSynthesizing(false);
    }
  };

  const getEmotionColor = (emotion: string) => {
    const colors: Record<string, string> = {
      'happy': 'bg-green-100 text-green-800',
      'excited': 'bg-yellow-100 text-yellow-800',
      'interested': 'bg-blue-100 text-blue-800',
      'neutral': 'bg-gray-100 text-gray-800',
      'confused': 'bg-orange-100 text-orange-800',
      'frustrated': 'bg-red-100 text-red-800',
      'angry': 'bg-red-200 text-red-900',
      'sad': 'bg-purple-100 text-purple-800',
      'worried': 'bg-indigo-100 text-indigo-800',
      'skeptical': 'bg-pink-100 text-pink-800'
    };
    return colors[emotion] || 'bg-gray-100 text-gray-800';
  };

  const selectedPersonalityData = personalities.find(p => p.id === selectedPersonality);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Voice AI Management</h1>
          <p className="text-gray-600">Advanced voice AI with perfect training and cultural intelligence</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={isModelTrained ? 'default' : 'secondary'} className="gap-1">
            <Brain className="w-4 h-4" />
            {isModelTrained ? 'Trained' : 'Not Trained'}
          </Badge>
        </div>
      </div>

      {/* Training Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5" />
            Model Training & Performance
          </CardTitle>
          <CardDescription>
            Train the voice AI model with advanced emotional intelligence and cultural awareness
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isModelTrained && (
            <Alert>
              <Brain className="w-4 h-4" />
              <AlertDescription>
                The voice AI model needs to be trained before use. This will enable advanced emotion detection,
                personality adaptation, and bilingual conversation capabilities.
              </AlertDescription>
            </Alert>
          )}
          
          <div className="flex items-center justify-between">
            <Button 
              onClick={trainVoiceModel}
              disabled={isTraining}
              className="flex items-center gap-2"
            >
              {isTraining ? <RotateCcw className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
              {isTraining ? 'Training Model...' : 'Train Voice AI Model'}
            </Button>
            
            {trainingResults && (
              <div className="text-sm text-gray-600">
                Model Version: {trainingResults.modelVersion}
              </div>
            )}
          </div>

          {isTraining && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Training Progress</span>
                <span>{trainingProgress}%</span>
              </div>
              <Progress value={trainingProgress} className="h-2" />
            </div>
          )}

          {trainingResults && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {Math.round(trainingResults.emotionAccuracy * 100)}%
                </div>
                <div className="text-sm text-gray-600">Emotion Accuracy</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {Math.round(trainingResults.personalityAccuracy * 100)}%
                </div>
                <div className="text-sm text-gray-600">Personality Accuracy</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {Math.round(trainingResults.bilingualAccuracy * 100)}%
                </div>
                <div className="text-sm text-gray-600">Bilingual Accuracy</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {Math.round(trainingResults.overallAccuracy * 100)}%
                </div>
                <div className="text-sm text-gray-600">Overall Accuracy</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Voice Personalities */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="w-5 h-5" />
            Voice Personalities
          </CardTitle>
          <CardDescription>
            Advanced AI personalities with cultural intelligence and emotional adaptation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {personalities.map((personality) => (
              <div
                key={personality.id}
                className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                  selectedPersonality === personality.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setSelectedPersonality(personality.id)}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold">{personality.name}</h3>
                  <Badge variant="outline" className="text-xs">
                    {Math.round(personality.trainingMetrics.customerSatisfactionScore * 100)}%
                  </Badge>
                </div>
                <p className="text-sm text-gray-600 mb-3">{personality.description}</p>
                
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-1">
                    {personality.emotionalRange.slice(0, 3).map((emotion) => (
                      <Badge key={emotion} variant="outline" className="text-xs">
                        {emotion}
                      </Badge>
                    ))}
                  </div>
                  
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Languages className="w-3 h-3" />
                    {personality.languageSupport.join(', ')}
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <div className="text-gray-500">Emotion Acc.</div>
                    <div className="font-semibold">
                      {Math.round(personality.trainingMetrics.emotionAccuracy * 100)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500">Conversion</div>
                    <div className="font-semibold">
                      {Math.round(personality.trainingMetrics.conversionRate * 100)}%
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Testing Interface */}
      {isModelTrained && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mic className="w-5 h-5" />
              Voice AI Testing
            </CardTitle>
            <CardDescription>
              Test emotion detection, personality adaptation, and speech synthesis
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Controls */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Personality</label>
                <Select value={selectedPersonality} onValueChange={setSelectedPersonality}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {personalities.map((personality) => (
                      <SelectItem key={personality.id} value={personality.id}>
                        {personality.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Language</label>
                <Select value={selectedLanguage} onValueChange={(value) => setSelectedLanguage(value as 'English' | 'Hindi')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="English">English</SelectItem>
                    <SelectItem value="Hindi">Hindi</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Test Input */}
            <div>
              <label className="block text-sm font-medium mb-2">Test Text</label>
              <Textarea
                value={testText}
                onChange={(e) => setTestText(e.target.value)}
                placeholder={selectedLanguage === 'Hindi' 
                  ? "हिंदी में टेस्ट टेक्स्ट लिखें..." 
                  : "Enter test text in English..."
                }
                rows={3}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button 
                onClick={analyzeEmotion}
                disabled={isAnalyzing || !testText.trim()}
                variant="outline"
                className="flex items-center gap-2"
              >
                {isAnalyzing ? <RotateCcw className="w-4 h-4 animate-spin" /> : <Heart className="w-4 h-4" />}
                Analyze Emotion
              </Button>
              
              <Button 
                onClick={synthesizeSpeech}
                disabled={isSynthesizing || !testText.trim()}
                className="flex items-center gap-2"
              >
                {isSynthesizing ? <RotateCcw className="w-4 h-4 animate-spin" /> : <Volume2 className="w-4 h-4" />}
                Synthesize Speech
              </Button>
            </div>

            {/* Emotion Analysis Results */}
            {emotionAnalysis && (
              <div className="p-4 border rounded-lg bg-gray-50">
                <h3 className="font-semibold mb-3">Emotion Analysis Results</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge className={getEmotionColor(emotionAnalysis.primary)}>
                        {emotionAnalysis.primary}
                      </Badge>
                      <span className="text-sm text-gray-600">
                        {Math.round(emotionAnalysis.confidence * 100)}% confidence
                      </span>
                    </div>
                    <div className="text-sm">
                      <div className="mb-1">
                        <span className="font-medium">Intensity:</span> {Math.round(emotionAnalysis.intensity * 100)}%
                      </div>
                      <div className="mb-1">
                        <span className="font-medium">Context:</span> {emotionAnalysis.context}
                      </div>
                      {emotionAnalysis.culturalContext && (
                        <div>
                          <span className="font-medium">Cultural Context:</span> {emotionAnalysis.culturalContext}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-2">Adaptation Needed</h4>
                    <Badge variant={emotionAnalysis.adaptationNeeded ? 'destructive' : 'default'}>
                      {emotionAnalysis.adaptationNeeded ? 'Yes' : 'No'}
                    </Badge>
                    {selectedPersonalityData && (
                      <div className="mt-3">
                        <h4 className="font-medium mb-1">Recommended Response Style</h4>
                        <div className="text-sm text-gray-600">
                          {selectedPersonalityData.description}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Audio Player */}
            {audioUrl && (
              <div className="p-4 border rounded-lg bg-blue-50">
                <h3 className="font-semibold mb-3">Generated Speech</h3>
                <audio controls className="w-full" src={audioUrl}>
                  Your browser does not support the audio element.
                </audio>
                <div className="mt-2 text-sm text-gray-600">
                  Personality: {selectedPersonalityData?.name} | Language: {selectedLanguage}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Performance Metrics */}
      {isModelTrained && selectedPersonalityData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Performance Metrics
            </CardTitle>
            <CardDescription>
              Real-time performance metrics for {selectedPersonalityData.name} personality
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {Math.round(selectedPersonalityData.trainingMetrics.emotionAccuracy * 100)}%
                </div>
                <div className="text-sm text-gray-600">Emotion Detection</div>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {Math.round(selectedPersonalityData.trainingMetrics.adaptationAccuracy * 100)}%
                </div>
                <div className="text-sm text-gray-600">Adaptation Success</div>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold text-purple-600">
                  {Math.round(selectedPersonalityData.trainingMetrics.customerSatisfactionScore * 100)}%
                </div>
                <div className="text-sm text-gray-600">Customer Satisfaction</div>
              </div>
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold text-orange-600">
                  {Math.round(selectedPersonalityData.trainingMetrics.conversionRate * 100)}%
                </div>
                <div className="text-sm text-gray-600">Conversion Rate</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default VoiceAIManagement;
