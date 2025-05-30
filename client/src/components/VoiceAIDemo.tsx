import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Volume2, 
  Brain, 
  Languages, 
  Heart, 
  Zap, 
  Play,
  RotateCcw,
  Check,
  AlertTriangle,
  PlayCircle,
  Bot,
  Code,
  Terminal
} from 'lucide-react';
import { toast } from 'sonner';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

interface DemoStatus {
  modelTrained: boolean;
  totalPersonalities: number;
  supportedLanguages: string[];
  capabilities: string[];
  metrics?: {
    emotionalEngagement: number;
    personalityConsistency: number;
    culturalApproppriateness: number;
    adaptationSuccess: number;
    overallEffectiveness: number;
  };
  personalities?: Array<{
    id: string;
    name: string;
    description: string;
    languages: string[];
    emotionalRange: string[];
    trainingMetrics: {
      emotionAccuracy: number;
      adaptationAccuracy: number;
      customerSatisfactionScore: number;
      conversionRate: number;
    };
  }>;
}

interface DemoResults {
  trainingResults: {
    emotionAccuracy: number;
    personalityAccuracy: number;
    bilingualAccuracy: number;
    conversationalAccuracy: number;
    overallAccuracy: number;
    modelVersion: string;
    trainingComplete: boolean;
  };
  personalityTests: Array<{
    personalityId: string;
    personalityName: string;
    language: string;
    testInput: string;
    emotionDetected: string;
    responseGenerated: string;
    culturallyAdapted: boolean;
    personalityAlignment: number;
    metrics?: any;
  }>;
  emotionTests: Array<{
    input: string;
    expected: string;
    detected: string;
    confidence: number;
    culturalAdaptation?: string;
  }>;
  bilingualTests: Array<{
    englishTest: {
      language: string;
      input: string;
      emotion: string;
      response: string;
      culturallyAdapted: boolean;
      culturalContext?: string;
    };
    hindiTest: {
      language: string;
      input: string;
      emotion: string;
      response: string;
      culturallyAdapted: boolean;
      culturalContext?: string;
    };
    culturalAdaptation: {
      english: boolean;
      hindi: boolean;
    };
  }>;
  conversationTests: Array<{
    scenarioName: string;
    conversationTurns: number;
    finalEmotion: string;
    flowRecommendation: string;
    suggestedResponse: string;
    personalityAdaptation: {
      originalPersonality: string;
      adaptedPersonality: string;
      adaptationNeeded: boolean;
      reason: string;
    };
    culturalConsiderations: string;
    confidenceScore: number;
  }>;
  performanceMetrics: {
    emotionalEngagement: number;
    personalityConsistency: number;
    culturalApproppriateness: number;
    adaptationSuccess: number;
    overallEffectiveness: number;
  };
}

const VoiceAIDemo: React.FC = () => {
  const [isRunningDemo, setIsRunningDemo] = useState(false);
  const [demoProgress, setDemoProgress] = useState(0);
  const [demoResults, setDemoResults] = useState<DemoResults | null>(null);
  const [demoStatus, setDemoStatus] = useState<DemoStatus | null>(null);
  const [currentStep, setCurrentStep] = useState<string>('');
  const [loadingStatus, setLoadingStatus] = useState(false);

  useEffect(() => {
    fetchVoiceAIStatus();
  }, []);

  const fetchVoiceAIStatus = async () => {
    setLoadingStatus(true);
    try {
      const response = await fetch('/api/voice-ai/demo/status', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setDemoStatus(data.status);
        toast.success('Voice AI status loaded successfully');
      } else {
        throw new Error('Failed to load Voice AI status');
      }
    } catch (error) {
      console.error('Error loading Voice AI status:', error);
      toast.error('Failed to load Voice AI status');
    } finally {
      setLoadingStatus(false);
    }
  };

  const runCompleteDemo = async () => {
    setIsRunningDemo(true);
    setDemoProgress(0);
    setCurrentStep('Initializing Voice AI demo...');
    
    const progressSteps = [
      'Training Voice AI model...',
      'Testing voice personalities...',
      'Testing emotion detection...',
      'Testing bilingual capabilities...',
      'Testing conversation flows...',
      'Gathering performance metrics...',
      'Finalizing demo results...'
    ];
    
    const progressInterval = setInterval(() => {
      setDemoProgress(prev => {
        if (prev >= 95) {
          clearInterval(progressInterval);
          return 95;
        }
        
        // Change the step message at certain progress points
        if (prev === 0) {
          setCurrentStep(progressSteps[0]);
        } else if (prev === 15) {
          setCurrentStep(progressSteps[1]);
        } else if (prev === 30) {
          setCurrentStep(progressSteps[2]);
        } else if (prev === 45) {
          setCurrentStep(progressSteps[3]);
        } else if (prev === 60) {
          setCurrentStep(progressSteps[4]);
        } else if (prev === 75) {
          setCurrentStep(progressSteps[5]);
        } else if (prev === 90) {
          setCurrentStep(progressSteps[6]);
        }
        
        return prev + 2;
      });
    }, 400);

    try {
      const response = await fetch('/api/voice-ai/demo/run-complete', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });

      clearInterval(progressInterval);
      setDemoProgress(100);
      setCurrentStep('Demo completed successfully!');

      if (response.ok) {
        const data = await response.json();
        setDemoResults(data.demoResults);
        // Also update the status after demo
        await fetchVoiceAIStatus();
        toast.success('Voice AI demo completed successfully!');
      } else {
        throw new Error('Demo failed');
      }
    } catch (error) {
      console.error('Error running Voice AI demo:', error);
      toast.error('Failed to run Voice AI demo');
      setCurrentStep('Demo failed. Please try again.');
    } finally {
      setIsRunningDemo(false);
      // Leave the progress bar at 100% for a moment to show completion
      setTimeout(() => {
        if (demoProgress === 100) {
          setDemoProgress(0);
        }
      }, 3000);
    }
  };

  const getAccuracyColorClass = (accuracy: number) => {
    if (accuracy >= 0.9) return 'text-green-600';
    if (accuracy >= 0.8) return 'text-blue-600';
    if (accuracy >= 0.7) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getEmotionBadgeClass = (emotion: string) => {
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
    return colors[emotion.toLowerCase()] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Voice AI Demo & Showcase</h2>
          <p className="text-gray-600">Run a comprehensive demo of all Voice AI capabilities</p>
        </div>
        <div className="flex items-center gap-2">
          {demoStatus && (
            <Badge variant={demoStatus.modelTrained ? 'default' : 'secondary'} className="gap-1">
              <Brain className="w-4 h-4" />
              {demoStatus.modelTrained ? 'Model Trained' : 'Model Not Trained'}
            </Badge>
          )}
        </div>
      </div>

      {/* Status and Capabilities */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5" />
            Voice AI Capabilities
          </CardTitle>
          <CardDescription>
            Current status and available capabilities of the Voice AI system
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingStatus ? (
            <div className="flex items-center justify-center p-4">
              <RotateCcw className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : demoStatus ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-medium mb-2">System Status</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Model Status:</span>
                      <Badge variant={demoStatus.modelTrained ? 'default' : 'outline'}>
                        {demoStatus.modelTrained ? 'Trained' : 'Not Trained'}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Personalities:</span>
                      <span>{demoStatus.totalPersonalities}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Languages:</span>
                      <span>{demoStatus.supportedLanguages.join(', ')}</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-medium mb-2">Performance Metrics</h3>
                  {demoStatus.metrics ? (
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Emotional Engagement:</span>
                        <span className={getAccuracyColorClass(demoStatus.metrics.emotionalEngagement)}>
                          {Math.round(demoStatus.metrics.emotionalEngagement * 100)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Cultural Appropriateness:</span>
                        <span className={getAccuracyColorClass(demoStatus.metrics.culturalApproppriateness)}>
                          {Math.round(demoStatus.metrics.culturalApproppriateness * 100)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Overall Effectiveness:</span>
                        <span className={getAccuracyColorClass(demoStatus.metrics.overallEffectiveness)}>
                          {Math.round(demoStatus.metrics.overallEffectiveness * 100)}%
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-gray-500 text-sm italic">
                      Run a demo to see performance metrics
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4">
                <h3 className="font-medium mb-2">Capabilities</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {demoStatus.capabilities.map((capability, index) => (
                    <div key={index} className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-green-500 mt-0.5" />
                      <span className="text-sm">{capability}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                Unable to load Voice AI status. Please try refreshing.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Demo Runner */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PlayCircle className="w-5 h-5" />
            Comprehensive Demo
          </CardTitle>
          <CardDescription>
            Run a complete demonstration of all Voice AI capabilities
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Button 
              onClick={runCompleteDemo}
              disabled={isRunningDemo}
              className="flex items-center gap-2"
            >
              {isRunningDemo ? <RotateCcw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              {isRunningDemo ? 'Running Demo...' : 'Run Complete Demo'}
            </Button>
            
            <div className="text-sm text-gray-600">
              {demoResults?.trainingResults?.modelVersion && (
                <span>Model Version: {demoResults.trainingResults.modelVersion}</span>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          {demoProgress > 0 && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{currentStep}</span>
                <span>{demoProgress}%</span>
              </div>
              <Progress value={demoProgress} className="h-2" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Demo Results */}
      {demoResults && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Terminal className="w-5 h-5" />
              Demo Results
            </CardTitle>
            <CardDescription>
              Detailed results of the Voice AI demonstration
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Training Results */}
            <div>
              <h3 className="text-lg font-medium mb-3">Training Results</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 border rounded-lg">
                  <div className={`text-xl font-bold ${getAccuracyColorClass(demoResults.trainingResults.emotionAccuracy)}`}>
                    {Math.round(demoResults.trainingResults.emotionAccuracy * 100)}%
                  </div>
                  <div className="text-sm text-gray-600">Emotion Accuracy</div>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className={`text-xl font-bold ${getAccuracyColorClass(demoResults.trainingResults.personalityAccuracy)}`}>
                    {Math.round(demoResults.trainingResults.personalityAccuracy * 100)}%
                  </div>
                  <div className="text-sm text-gray-600">Personality Accuracy</div>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className={`text-xl font-bold ${getAccuracyColorClass(demoResults.trainingResults.bilingualAccuracy)}`}>
                    {Math.round(demoResults.trainingResults.bilingualAccuracy * 100)}%
                  </div>
                  <div className="text-sm text-gray-600">Bilingual Accuracy</div>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className={`text-xl font-bold ${getAccuracyColorClass(demoResults.trainingResults.overallAccuracy)}`}>
                    {Math.round(demoResults.trainingResults.overallAccuracy * 100)}%
                  </div>
                  <div className="text-sm text-gray-600">Overall Accuracy</div>
                </div>
              </div>
            </div>

            {/* Accordion with detailed test results */}
            <Accordion type="single" collapsible className="w-full">
              {/* Personality Tests */}
              <AccordionItem value="personalities">
                <AccordionTrigger className="text-lg font-medium">
                  <div className="flex items-center gap-2">
                    <Heart className="w-5 h-5" />
                    Personality Tests ({demoResults.personalityTests.length})
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4">
                    {demoResults.personalityTests.map((test, index) => (
                      <div key={index} className="p-4 border rounded-lg">
                        <div className="flex justify-between mb-2">
                          <h4 className="font-medium">{test.personalityName}</h4>
                          <Badge>{test.language}</Badge>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div>
                            <span className="font-medium">Test Input:</span> {test.testInput}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">Emotion Detected:</span>
                            <Badge className={getEmotionBadgeClass(test.emotionDetected)}>
                              {test.emotionDetected}
                            </Badge>
                          </div>
                          <div>
                            <span className="font-medium">Response:</span>
                            <div className="mt-1 p-2 bg-gray-50 rounded text-gray-700">
                              {test.responseGenerated}
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1">
                              <span className="font-medium">Culturally Adapted:</span>
                              {test.culturallyAdapted ? (
                                <Check className="w-4 h-4 text-green-500" />
                              ) : (
                                <AlertTriangle className="w-4 h-4 text-yellow-500" />
                              )}
                            </div>
                            <div>
                              <span className="font-medium">Personality Alignment:</span>{' '}
                              {Math.round(test.personalityAlignment * 100)}%
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Emotion Tests */}
              <AccordionItem value="emotions">
                <AccordionTrigger className="text-lg font-medium">
                  <div className="flex items-center gap-2">
                    <Heart className="w-5 h-5" />
                    Emotion Tests ({demoResults.emotionTests.length})
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4">
                    {demoResults.emotionTests.map((test, index) => (
                      <div key={index} className="p-4 border rounded-lg">
                        <div className="space-y-2 text-sm">
                          <div>
                            <span className="font-medium">Input:</span> {test.input}
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">Expected:</span>
                              <Badge className={getEmotionBadgeClass(test.expected)}>
                                {test.expected}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">Detected:</span>
                              <Badge className={getEmotionBadgeClass(test.detected)}>
                                {test.detected}
                              </Badge>
                            </div>
                          </div>
                          <div>
                            <span className="font-medium">Confidence:</span>{' '}
                            {Math.round(test.confidence * 100)}%
                          </div>
                          {test.culturalAdaptation && (
                            <div>
                              <span className="font-medium">Cultural Context:</span>{' '}
                              {test.culturalAdaptation}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Bilingual Tests */}
              <AccordionItem value="bilingual">
                <AccordionTrigger className="text-lg font-medium">
                  <div className="flex items-center gap-2">
                    <Languages className="w-5 h-5" />
                    Bilingual Tests ({demoResults.bilingualTests.length})
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4">
                    {demoResults.bilingualTests.map((test, index) => (
                      <div key={index} className="p-4 border rounded-lg">
                        <h4 className="font-medium mb-3">Test Case #{index + 1}</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* English Test */}
                          <div className="space-y-2 text-sm p-3 bg-gray-50 rounded">
                            <div className="flex justify-between mb-1">
                              <h5 className="font-medium">English</h5>
                              <Badge className={getEmotionBadgeClass(test.englishTest.emotion)}>
                                {test.englishTest.emotion}
                              </Badge>
                            </div>
                            <div>
                              <span className="font-medium">Input:</span> {test.englishTest.input}
                            </div>
                            <div>
                              <span className="font-medium">Response:</span>
                              <div className="mt-1 p-2 bg-white rounded text-gray-700">
                                {test.englishTest.response}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">Culturally Adapted:</span>
                              {test.englishTest.culturallyAdapted ? (
                                <Check className="w-4 h-4 text-green-500" />
                              ) : (
                                <AlertTriangle className="w-4 h-4 text-yellow-500" />
                              )}
                            </div>
                          </div>

                          {/* Hindi Test */}
                          <div className="space-y-2 text-sm p-3 bg-gray-50 rounded">
                            <div className="flex justify-between mb-1">
                              <h5 className="font-medium">Hindi</h5>
                              <Badge className={getEmotionBadgeClass(test.hindiTest.emotion)}>
                                {test.hindiTest.emotion}
                              </Badge>
                            </div>
                            <div>
                              <span className="font-medium">Input:</span> {test.hindiTest.input}
                            </div>
                            <div>
                              <span className="font-medium">Response:</span>
                              <div className="mt-1 p-2 bg-white rounded text-gray-700">
                                {test.hindiTest.response}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">Culturally Adapted:</span>
                              {test.hindiTest.culturallyAdapted ? (
                                <Check className="w-4 h-4 text-green-500" />
                              ) : (
                                <AlertTriangle className="w-4 h-4 text-yellow-500" />
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Conversation Tests */}
              <AccordionItem value="conversations">
                <AccordionTrigger className="text-lg font-medium">
                  <div className="flex items-center gap-2">
                    <Volume2 className="w-5 h-5" />
                    Conversation Scenarios ({demoResults.conversationTests.length})
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4">
                    {demoResults.conversationTests.map((test, index) => (
                      <div key={index} className="p-4 border rounded-lg">
                        <div className="flex justify-between mb-3">
                          <h4 className="font-medium">{test.scenarioName}</h4>
                          <Badge className={getEmotionBadgeClass(test.finalEmotion)}>
                            {test.finalEmotion}
                          </Badge>
                        </div>
                        <div className="space-y-3 text-sm">
                          <div>
                            <span className="font-medium">Conversation Turns:</span> {test.conversationTurns}
                          </div>
                          <div>
                            <span className="font-medium">Flow Recommendation:</span> {test.flowRecommendation}
                          </div>
                          <div>
                            <span className="font-medium">Suggested Response:</span>
                            <div className="mt-1 p-2 bg-gray-50 rounded text-gray-700">
                              {test.suggestedResponse}
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <span className="font-medium">Personality Adaptation:</span>
                              <div className="mt-1 space-y-1">
                                <div className="flex justify-between">
                                  <span>Original Personality:</span>
                                  <span>{test.personalityAdaptation.originalPersonality}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Adapted Personality:</span>
                                  <span>{test.personalityAdaptation.adaptedPersonality}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Adaptation Needed:</span>
                                  {test.personalityAdaptation.adaptationNeeded ? (
                                    <Check className="w-4 h-4 text-green-500" />
                                  ) : (
                                    <AlertTriangle className="w-4 h-4 text-yellow-500" />
                                  )}
                                </div>
                              </div>
                            </div>
                            <div>
                              <span className="font-medium">Cultural Considerations:</span>
                              <div className="mt-1 p-2 bg-gray-50 rounded text-gray-700">
                                {test.culturalConsiderations}
                              </div>
                            </div>
                          </div>
                          <div>
                            <span className="font-medium">Confidence Score:</span>{' '}
                            {Math.round(test.confidenceScore * 100)}%
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Performance Metrics */}
              <AccordionItem value="metrics">
                <AccordionTrigger className="text-lg font-medium">
                  <div className="flex items-center gap-2">
                    <Zap className="w-5 h-5" />
                    Overall Performance Metrics
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2 p-4 border rounded-lg">
                      <div className="flex justify-between">
                        <span className="font-medium">Emotional Engagement:</span>
                        <span className={getAccuracyColorClass(demoResults.performanceMetrics.emotionalEngagement)}>
                          {Math.round(demoResults.performanceMetrics.emotionalEngagement * 100)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-medium">Personality Consistency:</span>
                        <span className={getAccuracyColorClass(demoResults.performanceMetrics.personalityConsistency)}>
                          {Math.round(demoResults.performanceMetrics.personalityConsistency * 100)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-medium">Cultural Appropriateness:</span>
                        <span className={getAccuracyColorClass(demoResults.performanceMetrics.culturalApproppriateness)}>
                          {Math.round(demoResults.performanceMetrics.culturalApproppriateness * 100)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-medium">Adaptation Success:</span>
                        <span className={getAccuracyColorClass(demoResults.performanceMetrics.adaptationSuccess)}>
                          {Math.round(demoResults.performanceMetrics.adaptationSuccess * 100)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-medium">Overall Effectiveness:</span>
                        <span className={getAccuracyColorClass(demoResults.performanceMetrics.overallEffectiveness)}>
                          {Math.round(demoResults.performanceMetrics.overallEffectiveness * 100)}%
                        </span>
                      </div>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <h3 className="font-medium mb-3">Summary</h3>
                      <div className="space-y-2 text-sm">
                        <p>
                          The Voice AI model demonstrates excellent performance across emotion detection, 
                          personality management, and cultural adaptation capabilities. The system successfully
                          identifies user emotions and adapts its responses accordingly.
                        </p>
                        <p>
                          Bilingual support between English and Hindi is fully functional with proper cultural
                          context adaptation. The conversation flow management system effectively handles
                          complex scenarios and adapts personality based on user emotions.
                        </p>
                        <p className="font-medium mt-3">
                          Overall effectiveness: {Math.round(demoResults.performanceMetrics.overallEffectiveness * 100)}%
                        </p>
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>
      )}

      {/* Code Snippet for Integration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="w-5 h-5" />
            Integration Guidelines
          </CardTitle>
          <CardDescription>
            How to integrate Voice AI capabilities into your application
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p>
              The Voice AI system can be easily integrated into your application using the following API endpoints.
              All endpoints require authentication via Bearer token.
            </p>
            
            <div className="p-4 bg-gray-900 text-gray-100 rounded-md font-mono text-sm overflow-x-auto">
              <pre>{`// 1. Initialize and train the Voice AI model
await fetch('/api/voice-ai/train-model', {
  method: 'POST',
  headers: {
    'Authorization': \`Bearer \${token}\`,
    'Content-Type': 'application/json'
  }
});

// 2. Analyze user emotion from text
const emotionResponse = await fetch('/api/voice-ai/analyze-emotion', {
  method: 'POST',
  headers: {
    'Authorization': \`Bearer \${token}\`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    text: "User input text",
    language: "English" // or "Hindi"
  })
});

// 3. Generate adaptive response based on emotion
const responseData = await fetch('/api/voice-ai/generate-response', {
  method: 'POST',
  headers: {
    'Authorization': \`Bearer \${token}\`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    text: "User input text",
    emotion: emotionData,
    personalityId: "professional",
    language: "English"
  })
});

// 4. Synthesize speech from response
const audioResponse = await fetch('/api/voice-ai/synthesize-speech', {
  method: 'POST',
  headers: {
    'Authorization': \`Bearer \${token}\`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    text: responseData.script,
    personalityId: "professional",
    language: "English"
  })
});
const audioBlob = await audioResponse.blob();
const audioUrl = URL.createObjectURL(audioBlob);`}</pre>
            </div>
            
            <p className="text-sm text-gray-600 mt-4">
              For more advanced usage, including conversation flow management and cultural adaptation, 
              refer to the API documentation or run the demo to see all capabilities in action.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default VoiceAIDemo;
