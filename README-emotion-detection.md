# Voice AI Emotion Detection System

## Overview

This project implements a comprehensive emotion detection system for Voice AI applications. The system has been trained on the Hugging Face emotions dataset (boltuix/emotions-dataset) and integrates with the existing Voice AI infrastructure.

The emotion detection system consists of three main components:
1. **Text Emotion Detection**: Analyzes text input to detect emotions (64.83% accuracy)
2. **Audio Emotion Detection**: Analyzes audio input to detect emotions (14.58% accuracy)
3. **Multimodal Emotion Detection**: Combines text and audio for improved accuracy (68.28% accuracy)

## Getting Started

### Prerequisites

- Python 3.8+ with venv
- Node.js 14+ and npm
- FFmpeg (for audio processing)

### Installation

1. **Set up the training environment**:
   ```bash
   cd training
   python -m venv emotion_venv
   source emotion_venv/bin/activate  # On Windows: emotion_venv\Scripts\activate
   pip install -r requirements.txt
   ```

2. **Deploy models to production**:
   ```bash
   cd training
   source emotion_venv/bin/activate
   ./deployment/deploy.sh
   ```

3. **Start the server**:
   ```bash
   cd server
   npm install
   npm start
   ```

4. **Start the client application**:
   ```bash
   cd client
   npm install
   npm run dev
   ```

## Usage

### Web Interface

1. Open the client application in your browser (typically at http://localhost:5173)
2. Navigate to the "Voice AI" section
3. Select the "Emotion Detection" tab
4. Choose between text analysis, audio analysis, or multimodal analysis
5. Submit your input and view the emotion detection results

### API Endpoints

The system exposes the following API endpoints:

- **Text Emotion Analysis**:
  ```
  POST /api/voice-ai/analyze-emotion
  Content-Type: application/json

  {
    "text": "I'm feeling happy about the results"
  }
  ```

- **Audio Emotion Analysis**:
  ```
  POST /api/voice-ai/analyze-emotion-audio
  Content-Type: multipart/form-data

  Form data:
  - audio: [audio file]
  ```

- **Multimodal Emotion Analysis**:
  ```
  POST /api/voice-ai/analyze-emotion-multimodal
  Content-Type: multipart/form-data

  Form data:
  - audio: [audio file]
  - text: "I'm feeling happy about the results"
  ```

### Response Format

```json
{
  "success": true,
  "emotionAnalysis": {
    "dominant_emotion": "happiness",
    "emotion_scores": {
      "happiness": 0.85,
      "sadness": 0.05,
      "neutral": 0.07,
      "anger": 0.01,
      "love": 0.02
    },
    "confidence": 0.85,
    "model_used": "multimodal",
    "latency_ms": 42
  }
}
```

## System Architecture

### Training Pipeline

The training pipeline consists of the following components:

1. **Data Processing** (`data_processor.py`): Preprocesses the emotions dataset for training
2. **Emotion Trainer** (`emotion_trainer.py`): Trains the emotion detection models
3. **Model Evaluator** (`model_evaluator.py` / `simple_evaluator.py`): Evaluates model performance
4. **Voice Synthesizer** (`voice_synthesizer.py`): Trains voice synthesis with emotion awareness
5. **Model Integrator** (`model_integrator.py`): Integrates models with the Voice AI system

### Production System

The production system integrates with the existing Voice AI infrastructure:

1. **Server Integration**: 
   - Enhanced controller for emotion-aware endpoints
   - Production emotion service for model inference

2. **Client Integration**:
   - EmotionDetectionDemo component for testing and showcasing
   - Integrated in the Voice AI management interface

## Performance Metrics

| Model | Accuracy | Training Time | Parameters |
|-------|----------|---------------|------------|
| Text Emotion | 64.83% | ~45 minutes | BERT-tiny, max_len=32 |
| Audio Emotion | 14.58% | ~15 minutes | CNN-LSTM, hidden_size=32 |
| Multimodal | 68.28% | ~30 minutes | Late fusion, text_weight=0.7 |

## Future Improvements

1. **Model Accuracy**:
   - Collect real audio data to improve audio model performance
   - Implement online learning for continuous model improvement
   - Explore distillation techniques for more efficient models

2. **Integration Enhancements**:
   - Add cultural adaptation logic for multilingual support
   - Implement feedback mechanism for model corrections
   - Develop A/B testing framework for model comparison

3. **System Optimization**:
   - Optimize model latency for real-time applications
   - Implement batch processing for high-volume scenarios
   - Explore quantization for reduced model size

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Hugging Face for providing the emotions dataset
- The entire development team for their contributions
