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
- `POST /api/lumina-outreach/train-model`: Train the Voice AI model
- `POST /api/lumina-outreach/validate-model`: Validate model performance
- `GET /api/lumina-outreach/personalities`: Get available voice personalities

### Core Voice AI Features
- `POST /api/lumina-outreach/analyze-emotion`: Analyze emotions in text input
- `POST /api/lumina-outreach/generate-response`: Generate adaptive response
- `POST /api/lumina-outreach/synthesize-speech`: Synthesize speech from text

### Advanced Conversation Management
- `POST /api/lumina-outreach/manage-conversation`: Manage conversation flow
- `POST /api/lumina-outreach/conversation-analytics`: Get analytics for conversations

### Demo and Testing
- `POST /api/lumina-outreach/demo/run-complete`: Run comprehensive demo
- `GET /api/lumina-outreach/demo/status`: Get Voice AI status and capabilities

## Integration Examples

### Basic Voice Synthesis
```typescript
const synthesizeSpeech = async (text: string, language: 'English' | 'Hindi') => {
  const response = await fetch('/api/lumina-outreach/synthesize-speech', {
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
  const emotionResponse = await fetch('/api/lumina-outreach/analyze-emotion', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ text: userInput, language })
  });
  const emotionData = await emotionResponse.json();
  
  // 2. Manage conversation flow
  const flowResponse = await fetch('/api/lumina-outreach/manage-conversation', {
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
  const responseResponse = await fetch('/api/lumina-outreach/generate-response', {
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
  const speechResponse = await fetch('/api/lumina-outreach/synthesize-speech', {
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

Voice personalities are configured through the ElevenLabs API integration. Available personalities depend on the voices configured in your system. Each voice automatically adapts to provide appropriate responses based on context and detected emotions.

To configure voice personalities:
1. Set up your ElevenLabs API key in system settings
2. Available voices will be automatically imported from your ElevenLabs account
3. Each voice will be available as a personality option

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
