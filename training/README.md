# Emotion Detection Training Pipeline
# Voice AI Training System for Real-time Emotion Detection

This directory contains the complete training pipeline for emotion detection models using the Hugging Face emotions dataset. The system focuses on real-time emotion detection from voice and text for sales call optimization.

## Training Focus Areas

### 1. Audio Processing Models
- Real-time emotion detection from voice
- Speech-to-emotion classification
- Voice pattern analysis for emotional states

### 2. Voice Synthesis Enhancement
- Natural, contextual speech generation
- Emotion-aware voice synthesis
- Personality-based voice adaptation

### 3. Conversation Optimization
- Sales outcome prediction
- Emotional intelligence in conversations
- Real-time conversation flow optimization

## Dataset Information

**Source**: [Hugging Face Emotions Dataset](https://huggingface.co/datasets/boltuix/emotions-dataset)
- **Total Entries**: 131,306 text samples
- **Emotions**: 13 distinct emotions
- **Format**: Parquet (7.41MB)
- **License**: MIT

### Emotion Categories:
1. 😊 Happiness (31,205 - 23.76%)
2. 😢 Sadness (17,809 - 13.56%)
3. 😐 Neutral (15,733 - 11.98%)
4. 😣 Anger (13,341 - 10.16%)
5. ❤️ Love (10,512 - 8.00%)
6. 😨 Fear (8,795 - 6.70%)
7. 🤢 Disgust (8,407 - 6.40%)
8. ❓ Confusion (8,209 - 6.25%)
9. 😲 Surprise (4,560 - 3.47%)
10. 😳 Shame (4,248 - 3.24%)
11. 😔 Guilt (3,470 - 2.64%)
12. 😏 Sarcasm (2,534 - 1.93%)
13. 💫 Desire (2,483 - 1.89%)

## Training Pipeline Components

### 1. Data Processing (`data_processor.py`)
- Download and preprocess the emotions dataset
- Audio feature extraction for voice emotion detection
- Text preprocessing and tokenization
- Data augmentation and balancing

### 2. Model Training (`emotion_trainer.py`)
- Multi-modal emotion detection training
- BERT/RoBERTa for text emotion classification
- CNN/RNN models for audio emotion detection
- Cross-modal fusion models

### 3. Voice Synthesis (`voice_synthesizer.py`)
- Emotion-aware TTS training
- Voice personality adaptation
- Real-time voice modulation

### 4. Evaluation (`model_evaluator.py`)
- Comprehensive model evaluation
- Real-time performance testing
- A/B testing for conversation outcomes

### 5. Integration (`model_integrator.py`)
- Model optimization for production
- API integration with existing Voice AI system
- Real-time inference pipeline

## Training Workflow

1. **Setup Environment**
   ```bash
   cd training
   pip install -r requirements.txt
   ```

2. **Download and Process Data**
   ```python
   python data_processor.py --download --preprocess
   ```

3. **Train Emotion Detection Models**
   ```python
   python emotion_trainer.py --mode text_emotion
   python emotion_trainer.py --mode audio_emotion
   python emotion_trainer.py --mode multimodal
   ```

4. **Train Voice Synthesis**
   ```python
   python voice_synthesizer.py --train --emotions all
   ```

5. **Evaluate Models**
   ```python
   python model_evaluator.py --evaluate --benchmark
   ```

6. **Run Integration Tests**
   ```python
   # Run tests when server is available
   python test_integration.py
   
   # Run tests in mock mode (no server needed)
   python test_integration.py --mock-server
   
   # Run tests with custom server URL
   python test_integration.py --server-url http://localhost:8080
   ```

7. **Deploy to Production**
   ```python
   python model_integrator.py --deploy --optimize
   ```

## Performance Targets

- **Text Emotion Accuracy**: >92%
- **Audio Emotion Accuracy**: >88%
- **Real-time Processing**: <100ms latency
- **Voice Synthesis Quality**: MOS >4.2
- **Conversation Success Rate**: >85%

## File Cleanup

After successful training and deployment, the following files can be safely removed:
- Raw training data (will be cached in optimized format)
- Intermediate model checkpoints
- Training logs older than 30 days
- Temporary audio files

Required files to keep:
- Final trained models
- Model configuration files
- Performance benchmarks
- Integration scripts

## Integration with Existing System

The trained models will integrate with:
- `/server/src/services/enhancedVoiceAIService.ts`
- `/server/src/services/speechAnalysisService.ts`
- `/server/src/controllers/voiceAIController.ts`

## Monitoring & Maintenance

- Model performance tracking
- Continuous learning pipeline
- A/B testing framework
- Model versioning and rollback capabilities

## Integration Testing

The `test_integration.py` script verifies the integration between trained models and the production system. It performs the following checks:

1. **Model Files Deployment**: Checks if model files are correctly deployed to production folders.
2. **Service Integration**: Verifies if the emotion service files are properly integrated.
3. **API Endpoints**: Tests the emotion detection API endpoints.

### Test Modes

- **Standard Mode**: Connects to a running server to test API endpoints.
  ```bash
  python test_integration.py
  ```

- **Mock Server Mode**: Bypasses server connection tests, useful for development environments without a running server.
  ```bash
  python test_integration.py --mock-server
  ```

- **Custom Server URL**: Tests against a server at a different URL.
  ```bash
  python test_integration.py --server-url http://localhost:8080
  ```
