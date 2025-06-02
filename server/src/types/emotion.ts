// Types for emotion detection service
export type Emotion = 
  | 'happy' 
  | 'sad' 
  | 'angry' 
  | 'neutral' 
  | 'anxious'
  | 'confused'
  | 'frustrated'
  | 'interested';

export interface EmotionResult {
  emotion: Emotion;
  confidence: number;
  all_scores?: { [key: string]: number };
  model_used?: string;
  metadata: {
    model: string;
    latency: number;
    timestamp: string;
    note?: string;
  };
}

export interface EmotionServiceConfig {
  baseUrl: string;
  apiKey: string;
  modelVersion?: string;
  timeout?: number;
}
