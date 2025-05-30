// VoiceAI Integration Documentation

## Voice AI Overview

The Voice AI system provides advanced conversational AI capabilities with emotion detection, personality adaptation, and bilingual support. Key features include:

1. **Emotion Detection and Analysis**: Detect and analyze emotions from text input with cultural context awareness.
2. **Multiple Voice Personalities**: Different AI personalities optimized for various scenarios.
3. **Bilingual Support**: Full support for English and Hindi with cultural adaptations.
4. **Real-time Adaptation**: Dynamic personality and tone adjustment based on detected emotions.
5. **Conversation Flow Management**: Advanced handling of conversation states and transitions.

## API Endpoints

### Training and Model Management
- `POST /api/voice-ai/train-model`: Train the Voice AI model
- `POST /api/voice-ai/validate-model`: Validate model performance
- `GET /api/voice-ai/personalities`: Get available voice personalities

### Core Voice AI Features
- `POST /api/voice-ai/analyze-emotion`: Analyze emotions in text input
- `POST /api/voice-ai/generate-response`: Generate adaptive response
- `POST /api/voice-ai/synthesize-speech`: Synthesize speech from text

### Advanced Conversation Management
- `POST /api/voice-ai/manage-conversation`: Manage conversation flow
- `POST /api/voice-ai/conversation-analytics`: Get analytics for conversations

### Demo and Testing
- `POST /api/voice-ai/demo/run-complete`: Run comprehensive demo
- `GET /api/voice-ai/demo/status`: Get Voice AI status and capabilities

## Integration Examples

### Basic Emotion Analysis
```typescript
const analyzeEmotion = async (text: string, language: 'English' | 'Hindi') => {
  const response = await fetch('/api/voice-ai/analyze-emotion', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ text, language })
  });
  return await response.json();
};
```

### Complete Conversation Flow
```typescript
const handleConversation = async (
  userInput: string, 
  conversationHistory: any[],
  personalityId: string,
  language: 'English' | 'Hindi'
) => {
  // 1. Analyze emotion
  const emotionResponse = await fetch('/api/voice-ai/analyze-emotion', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ text: userInput, language })
  });
  const emotionData = await emotionResponse.json();
  
  // 2. Manage conversation flow
  const flowResponse = await fetch('/api/voice-ai/manage-conversation', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      currentInput: userInput,
      emotion: emotionData.emotionAnalysis,
      conversationHistory,
      personalityId,
      language
    })
  });
  const flowData = await flowResponse.json();
  
  // 3. Generate response based on flow recommendation
  const responseResponse = await fetch('/api/voice-ai/generate-response', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      text: userInput,
      emotion: emotionData.emotionAnalysis,
      conversationFlow: flowData.flowRecommendation,
      personalityId: flowData.recommendedPersonality || personalityId,
      language
    })
  });
  const responseData = await responseResponse.json();
  
  // 4. Synthesize speech
  const speechResponse = await fetch('/api/voice-ai/synthesize-speech', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      text: responseData.response.script,
      personalityId: flowData.recommendedPersonality || personalityId,
      language,
      emotionalContext: emotionData.emotionAnalysis.context
    })
  });
  
  // Return all the data
  return {
    emotion: emotionData.emotionAnalysis,
    flow: flowData,
    response: responseData.response,
    audio: URL.createObjectURL(await speechResponse.blob())
  };
};
```

## Voice AI Personality Types

1. **Professional**: Formal, concise, and business-focused
2. **Empathetic**: Warm, understanding, and supportive
3. **Persuasive**: Confident, compelling, and solution-oriented
4. **Informative**: Clear, detailed, and educational
5. **Friendly**: Casual, approachable, and conversational

## Best Practices

1. **Train the model** before first use for optimal performance
2. **Use conversation history** for context-aware responses
3. **Adapt personality** based on user emotions and interaction style
4. **Consider cultural context** when working with multiple languages
5. **Run periodic validation** to ensure model accuracy

## Performance Metrics

- **Emotion Accuracy**: Measures accuracy of emotion detection
- **Personality Consistency**: Evaluates consistency of personality traits
- **Cultural Appropriateness**: Assesses cultural adaptation effectiveness
- **Adaptation Success**: Measures successful personality adaptations
- **Overall Effectiveness**: Combined measure of Voice AI performance
