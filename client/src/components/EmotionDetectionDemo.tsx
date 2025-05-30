import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Volume2, 
  Brain, 
  AlertTriangle,
  Wand2
} from 'lucide-react';
import { toast } from 'sonner';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

// New interfaces for emotion detection
interface EmotionAnalysis {
  dominant_emotion: string;
  emotion_scores: Record<string, number>;
  confidence: number;
  model_used: string;
  latency_ms: number;
}

interface EmotionTestResult {
  text: string;
  audioSample?: string;
  result?: EmotionAnalysis;
  loading: boolean;
  error?: string;
}

// Demo component for the new emotion detection system
export const EmotionDetectionDemo: React.FC = () => {
  const [testResults, setTestResults] = useState<EmotionTestResult[]>([]);
  const [testText, setTestText] = useState('');
  const [testAudio, setTestAudio] = useState<File | null>(null);
  const [activeTab, setActiveTab] = useState('text');
  const [isLoading, setIsLoading] = useState(false);
  
  // Sample text inputs for quick testing
  const sampleTexts = [
    "I'm so happy about the results we achieved!",
    "I'm feeling quite disappointed with the outcome.",
    "I'm not sure how to feel about this situation.",
    "This made me really angry and frustrated!",
    "I love working with your team, it's been amazing."
  ];

  const emotionColors: Record<string, string> = {
    happiness: 'bg-yellow-500',
    sadness: 'bg-blue-500',
    neutral: 'bg-gray-500',
    anger: 'bg-red-500',
    love: 'bg-pink-500',
    fear: 'bg-purple-500',
    disgust: 'bg-green-500',
    confusion: 'bg-orange-500',
    surprise: 'bg-teal-500',
    shame: 'bg-indigo-500',
    guilt: 'bg-rose-500',
    sarcasm: 'bg-amber-500',
    desire: 'bg-cyan-500'
  };

  const testEmotionDetection = async () => {
    if (activeTab === 'text' && !testText) {
      toast.error('Please enter some text to analyze');
      return;
    }

    if (activeTab === 'audio' && !testAudio) {
      toast.error('Please upload an audio file to analyze');
      return;
    }

    if (activeTab === 'multimodal' && (!testText || !testAudio)) {
      toast.error('Please provide both text and audio for multimodal analysis');
      return;
    }

    setIsLoading(true);
    const newTest: EmotionTestResult = {
      text: testText,
      audioSample: testAudio?.name,
      loading: true
    };
    
    setTestResults(prev => [newTest, ...prev]);

    try {
      // Get auth token from localStorage
      const user = localStorage.getItem('user');
      const token = user ? JSON.parse(user).token : null;
      
      let response;
      
      if (activeTab === 'text') {
        // Text-only analysis
        const headers: HeadersInit = {
          'Content-Type': 'application/json'
        };
        
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        
        response = await fetch('/api/voice-ai/analyze-emotion', {
          method: 'POST',
          headers,
          body: JSON.stringify({ text: testText })
        });
      } else if (activeTab === 'audio') {
        // Audio-only analysis
        const formData = new FormData();
        if (testAudio) {
          formData.append('audio', testAudio);
        }
        
        const headers: HeadersInit = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        
        response = await fetch('/api/voice-ai/analyze-emotion-audio', {
          method: 'POST',
          headers,
          body: formData
        });
      } else if (activeTab === 'multimodal') {
        // Multimodal analysis (text + audio)
        const formData = new FormData();
        formData.append('text', testText);
        if (testAudio) {
          formData.append('audio', testAudio);
        }
        
        const headers: HeadersInit = {};
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        
        response = await fetch('/api/voice-ai/analyze-emotion-multimodal', {
          method: 'POST',
          headers,
          body: formData
        });
      }

      if (!response?.ok) {
        throw new Error(`Error: ${response?.statusText || 'Failed to analyze emotion'}`);
      }

      const data = await response.json();
      
      // Update the test results
      setTestResults(prev => 
        prev.map((test, index) => 
          index === 0 ? { ...test, loading: false, result: data.emotionAnalysis } : test
        )
      );

      // Reset form after successful submission
      setTestText('');
      setTestAudio(null);
      
      toast.success('Emotion analysis complete!');
    } catch (error) {
      console.error('Error analyzing emotion:', error);
      setTestResults(prev => 
        prev.map((test, index) => 
          index === 0 ? { ...test, loading: false, error: (error as Error).message } : test
        )
      );
      toast.error('Failed to analyze emotion');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setTestAudio(e.target.files[0]);
    }
  };

  const useSampleText = (text: string) => {
    setTestText(text);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-6 w-6" />
          Emotion Detection Demo
        </CardTitle>
        <CardDescription>
          Test our new emotion detection models trained on the Hugging Face emotions dataset
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        <Tabs defaultValue="text" onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-3 mb-4">
            <TabsTrigger value="text">Text Analysis</TabsTrigger>
            <TabsTrigger value="audio">Audio Analysis</TabsTrigger>
            <TabsTrigger value="multimodal">Multimodal</TabsTrigger>
          </TabsList>
          
          <TabsContent value="text">
            <div className="space-y-4">
              <textarea
                className="w-full p-2 border rounded-md h-24"
                placeholder="Enter text to analyze emotion..."
                value={testText}
                onChange={(e) => setTestText(e.target.value)}
              />
              
              <div className="flex flex-wrap gap-2">
                <p className="text-sm text-gray-500 w-full">Sample texts (click to use):</p>
                {sampleTexts.map((text, index) => (
                  <Badge 
                    key={index} 
                    variant="outline" 
                    className="cursor-pointer hover:bg-gray-100 transition-colors"
                    onClick={() => useSampleText(text)}
                  >
                    {text.substring(0, 20)}...
                  </Badge>
                ))}
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="audio">
            <div className="space-y-4">
              <div className="border-2 border-dashed rounded-md p-6 text-center">
                {testAudio ? (
                  <div className="flex items-center justify-center gap-2">
                    <Volume2 className="h-6 w-6" />
                    <span>{testAudio.name}</span>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setTestAudio(null)}
                    >
                      Remove
                    </Button>
                  </div>
                ) : (
                  <>
                    <Volume2 className="h-12 w-12 mx-auto text-gray-400" />
                    <p className="mt-2">Upload an audio file for emotion analysis</p>
                    <input
                      type="file"
                      accept="audio/*"
                      className="hidden"
                      id="audio-upload"
                      onChange={handleAudioUpload}
                    />
                    <label htmlFor="audio-upload">
                      <Button className="mt-2" variant="outline" asChild>
                        <span>Select Audio File</span>
                      </Button>
                    </label>
                  </>
                )}
              </div>
              
              <Alert>
                <Volume2 className="h-4 w-4" />
                <AlertTitle>Audio Analysis</AlertTitle>
                <AlertDescription>
                  For best results, use clear audio with minimal background noise. Supported formats: MP3, WAV, M4A.
                </AlertDescription>
              </Alert>
            </div>
          </TabsContent>
          
          <TabsContent value="multimodal">
            <div className="space-y-4">
              <p className="text-sm">Multimodal analysis combines both text and audio for improved accuracy.</p>
              
              <textarea
                className="w-full p-2 border rounded-md h-24"
                placeholder="Enter text to analyze emotion..."
                value={testText}
                onChange={(e) => setTestText(e.target.value)}
              />
              
              <div className="border-2 border-dashed rounded-md p-4 text-center">
                {testAudio ? (
                  <div className="flex items-center justify-center gap-2">
                    <Volume2 className="h-6 w-6" />
                    <span>{testAudio.name}</span>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setTestAudio(null)}
                    >
                      Remove
                    </Button>
                  </div>
                ) : (
                  <>
                    <p className="mb-2">Upload matching audio file</p>
                    <input
                      type="file"
                      accept="audio/*"
                      className="hidden"
                      id="audio-upload-multimodal"
                      onChange={handleAudioUpload}
                    />
                    <label htmlFor="audio-upload-multimodal">
                      <Button variant="outline" size="sm" asChild>
                        <span>Select Audio</span>
                      </Button>
                    </label>
                  </>
                )}
              </div>
              
              <Alert variant="default" className="bg-blue-50">
                <Wand2 className="h-4 w-4" />
                <AlertTitle>Enhanced Accuracy</AlertTitle>
                <AlertDescription>
                  Multimodal analysis is 68.28% accurate, compared to 64.83% for text-only analysis.
                </AlertDescription>
              </Alert>
            </div>
          </TabsContent>
          
          <div className="mt-4">
            <Button 
              onClick={testEmotionDetection} 
              disabled={isLoading || (activeTab === 'text' && !testText) || (activeTab === 'audio' && !testAudio) || (activeTab === 'multimodal' && (!testText || !testAudio))}
              className="w-full"
            >
              {isLoading ? 'Analyzing...' : 'Analyze Emotion'}
            </Button>
          </div>
        </Tabs>
        
        {/* Results Section */}
        <div className="mt-6">
          <h3 className="text-lg font-medium mb-4">Analysis Results</h3>
          
          {testResults.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Brain className="h-12 w-12 mx-auto mb-2 opacity-30" />
              <p>No analysis results yet. Try analyzing some text or audio.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {testResults.map((result, index) => (
                <Card key={index} className="overflow-hidden">
                  <div className="p-4">
                    {result.loading ? (
                      <div className="flex items-center space-x-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
                        <p>Analyzing...</p>
                      </div>
                    ) : result.error ? (
                      <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>{result.error}</AlertDescription>
                      </Alert>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium">Input:</p>
                            <p className="text-sm text-gray-600 mt-1">
                              {result.text ? `"${result.text}"` : ''}
                              {result.audioSample ? (result.text ? ' + ' : '') + `Audio: ${result.audioSample}` : ''}
                            </p>
                          </div>
                          
                          {result.result && (
                            <Badge className={`${emotionColors[result.result.dominant_emotion] || 'bg-gray-500'} text-white`}>
                              {result.result.dominant_emotion}
                            </Badge>
                          )}
                        </div>
                        
                        {result.result && (
                          <>
                            <div className="mt-3">
                              <div className="flex justify-between text-sm mb-1">
                                <span>Confidence</span>
                                <span>{Math.round(result.result.confidence * 100)}%</span>
                              </div>
                              <Progress value={result.result.confidence * 100} className="h-2" />
                            </div>
                            
                            <Accordion type="single" collapsible className="mt-2">
                              <AccordionItem value="details">
                                <AccordionTrigger className="text-sm py-2">
                                  Detailed Results
                                </AccordionTrigger>
                                <AccordionContent>
                                  <div className="space-y-2 text-sm">
                                    <div className="grid grid-cols-2 gap-2">
                                      <div>
                                        <p className="text-gray-500">Model Used</p>
                                        <p>{result.result.model_used}</p>
                                      </div>
                                      <div>
                                        <p className="text-gray-500">Processing Time</p>
                                        <p>{result.result.latency_ms}ms</p>
                                      </div>
                                    </div>
                                    
                                    <div className="mt-2">
                                      <p className="text-gray-500 mb-1">Emotion Scores</p>
                                      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                        {Object.entries(result.result.emotion_scores || {})
                                          .sort(([, a], [, b]) => (b as number) - (a as number))
                                          .map(([emotion, score]) => (
                                            <div key={emotion} className="flex justify-between">
                                              <span>{emotion}</span>
                                              <span>{Math.round((score as number) * 100)}%</span>
                                            </div>
                                          ))
                                        }
                                      </div>
                                    </div>
                                  </div>
                                </AccordionContent>
                              </AccordionItem>
                            </Accordion>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default EmotionDetectionDemo;
