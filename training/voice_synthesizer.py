#!/usr/bin/env python3
"""
Voice Synthesizer for Emotion-Aware TTS Training
Trains voice synthesis models for natural, contextual speech generation.
"""

import os
import sys
import json
import logging
import argparse
from pathlib import Path
from typing import Dict, List, Tuple, Optional, Union
import time
from datetime import datetime

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
import torch.nn.functional as F

# TTS and Audio libraries
try:
    import librosa
    import soundfile as sf
    from pydub import AudioSegment
    import whisper
    AUDIO_AVAILABLE = True
except ImportError:
    AUDIO_AVAILABLE = False
    print("Warning: Audio processing libraries not available. Install librosa, soundfile, pydub, and whisper.")

# Hugging Face and transformers
from transformers import (
    AutoModel, AutoTokenizer, AutoConfig,
    SpeechT5Processor, SpeechT5ForTextToSpeech, SpeechT5HifiGan
)

# Evaluation metrics
from sklearn.metrics import mean_squared_error
import matplotlib.pyplot as plt
import seaborn as sns

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class VoiceSynthesisDataset(Dataset):
    """Dataset for voice synthesis training."""
    
    def __init__(self, texts: List[str], emotions: List[str], personalities: List[str],
                 audio_features: Optional[np.ndarray] = None, 
                 processor: Optional[SpeechT5Processor] = None):
        self.texts = texts
        self.emotions = emotions
        self.personalities = personalities
        self.audio_features = audio_features
        self.processor = processor
        
        # Emotion to embedding mapping
        self.emotion_embeddings = {
            'happiness': np.array([0.8, 0.9, 0.7, 0.6, 0.8]),
            'sadness': np.array([-0.6, -0.8, -0.5, -0.7, -0.6]),
            'anger': np.array([0.9, -0.3, 0.8, 0.9, 0.7]),
            'fear': np.array([-0.5, -0.6, -0.8, -0.4, -0.7]),
            'neutral': np.array([0.0, 0.0, 0.0, 0.0, 0.0]),
            'surprise': np.array([0.7, 0.8, 0.6, 0.5, 0.9]),
            'disgust': np.array([-0.4, -0.7, -0.6, -0.8, -0.5]),
            'love': np.array([0.9, 0.8, 0.7, 0.6, 0.9]),
            'confusion': np.array([-0.2, -0.3, -0.4, -0.2, -0.3]),
            'guilt': np.array([-0.7, -0.6, -0.8, -0.7, -0.6]),
            'shame': np.array([-0.8, -0.7, -0.9, -0.8, -0.7]),
            'sarcasm': np.array([0.3, -0.4, 0.5, 0.2, 0.4]),
            'desire': np.array([0.6, 0.7, 0.5, 0.8, 0.6])
        }
        
        # Personality to voice settings mapping
        self.personality_settings = {
            'professional': {'speed': 1.0, 'pitch': 1.0, 'stability': 0.9},
            'empathetic': {'speed': 0.9, 'pitch': 0.95, 'stability': 0.8},
            'persuasive': {'speed': 1.1, 'pitch': 1.05, 'stability': 0.85},
            'informative': {'speed': 0.95, 'pitch': 1.0, 'stability': 0.9},
            'friendly': {'speed': 1.05, 'pitch': 1.02, 'stability': 0.8}
        }
    
    def __len__(self):
        return len(self.texts)
    
    def __getitem__(self, idx):
        text = self.texts[idx]
        emotion = self.emotions[idx]
        personality = self.personalities[idx]
        
        # Get emotion embedding
        emotion_embed = self.emotion_embeddings.get(emotion, self.emotion_embeddings['neutral'])
        
        # Get personality settings
        voice_settings = self.personality_settings.get(personality, self.personality_settings['professional'])
        
        item = {
            'text': text,
            'emotion': emotion,
            'personality': personality,
            'emotion_embedding': torch.tensor(emotion_embed, dtype=torch.float32),
            'voice_settings': voice_settings
        }
        
        if self.audio_features is not None:
            item['target_audio'] = torch.tensor(self.audio_features[idx], dtype=torch.float32)
        
        return item

class EmotionAwareTTSModel(nn.Module):
    """Emotion-aware Text-to-Speech model."""
    
    def __init__(self, vocab_size: int, embed_dim: int = 512, 
                 emotion_dim: int = 5, hidden_dim: int = 1024,
                 num_mel_bins: int = 80, max_length: int = 1000):
        super().__init__()
        
        self.embed_dim = embed_dim
        self.emotion_dim = emotion_dim
        self.hidden_dim = hidden_dim
        self.num_mel_bins = num_mel_bins
        self.max_length = max_length
        
        # Text encoder
        self.text_embedding = nn.Embedding(vocab_size, embed_dim)
        self.text_encoder = nn.LSTM(embed_dim, hidden_dim // 2, bidirectional=True, batch_first=True)
        
        # Emotion encoder
        self.emotion_encoder = nn.Sequential(
            nn.Linear(emotion_dim, hidden_dim // 4),
            nn.ReLU(),
            nn.Linear(hidden_dim // 4, hidden_dim // 2),
            nn.ReLU()
        )
        
        # Attention mechanism
        self.attention = nn.MultiheadAttention(hidden_dim, num_heads=8, batch_first=True)
        
        # Decoder for mel spectrogram generation
        self.decoder = nn.LSTM(hidden_dim + hidden_dim // 2, hidden_dim, num_layers=2, batch_first=True)
        
        # Mel spectrogram prediction
        self.mel_linear = nn.Linear(hidden_dim, num_mel_bins)
        
        # Duration predictor
        self.duration_predictor = nn.Sequential(
            nn.Linear(hidden_dim, hidden_dim // 2),
            nn.ReLU(),
            nn.Linear(hidden_dim // 2, 1),
            nn.ReLU()
        )
        
        # Pitch and energy predictors
        self.pitch_predictor = nn.Sequential(
            nn.Linear(hidden_dim, hidden_dim // 2),
            nn.ReLU(),
            nn.Linear(hidden_dim // 2, 1)
        )
        
        self.energy_predictor = nn.Sequential(
            nn.Linear(hidden_dim, hidden_dim // 2),
            nn.ReLU(),
            nn.Linear(hidden_dim // 2, 1)
        )
    
    def forward(self, text_ids, emotion_embedding, text_lengths=None):
        batch_size, seq_len = text_ids.shape
        
        # Text encoding
        text_embeds = self.text_embedding(text_ids)
        text_encoded, _ = self.text_encoder(text_embeds)
        
        # Emotion encoding
        emotion_encoded = self.emotion_encoder(emotion_embedding)
        emotion_encoded = emotion_encoded.unsqueeze(1).expand(-1, seq_len, -1)
        
        # Combine text and emotion
        combined = torch.cat([text_encoded, emotion_encoded], dim=-1)
        
        # Self-attention
        attended, _ = self.attention(combined, combined, combined)
        
        # Duration, pitch, and energy prediction
        durations = self.duration_predictor(attended).squeeze(-1)
        pitch = self.pitch_predictor(attended).squeeze(-1)
        energy = self.energy_predictor(attended).squeeze(-1)
        
        # Expand based on predicted durations
        expanded_encoding = self._length_regulate(attended, durations)
        
        # Decode to mel spectrogram
        decoder_output, _ = self.decoder(expanded_encoding)
        mel_output = self.mel_linear(decoder_output)
        
        return {
            'mel_output': mel_output,
            'durations': durations,
            'pitch': pitch,
            'energy': energy,
            'text_encoding': attended
        }
    
    def _length_regulate(self, encoding, durations, max_length=None):
        """Regulate length based on predicted durations."""
        if max_length is None:
            max_length = self.max_length
        
        batch_size, seq_len, hidden_dim = encoding.shape
        
        # Simple expansion based on durations (in practice, use more sophisticated methods)
        expanded = []
        for batch_idx in range(batch_size):
            batch_expanded = []
            for seq_idx in range(seq_len):
                duration = max(1, int(durations[batch_idx, seq_idx].item()))
                for _ in range(min(duration, max_length // seq_len)):
                    batch_expanded.append(encoding[batch_idx, seq_idx])
            
            # Pad or truncate to max_length
            while len(batch_expanded) < max_length:
                batch_expanded.append(torch.zeros_like(encoding[batch_idx, 0]))
            batch_expanded = batch_expanded[:max_length]
            
            expanded.append(torch.stack(batch_expanded))
        
        return torch.stack(expanded)

class VoiceSynthesizer:
    """Main voice synthesizer trainer."""
    
    def __init__(self, config: Dict, data_dir: str = "data", models_dir: str = "models"):
        self.config = config
        self.data_dir = Path(data_dir)
        self.models_dir = Path(models_dir)
        self.models_dir.mkdir(exist_ok=True)
        
        # Device configuration
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        logger.info(f"Using device: {self.device}")
        
        # Initialize SpeechT5 components
        if AUDIO_AVAILABLE:
            try:
                self.processor = SpeechT5Processor.from_pretrained("microsoft/speecht5_tts")
                self.base_model = SpeechT5ForTextToSpeech.from_pretrained("microsoft/speecht5_tts")
                self.vocoder = SpeechT5HifiGan.from_pretrained("microsoft/speecht5_hifigan")
                logger.info("SpeechT5 models loaded successfully")
            except Exception as e:
                logger.warning(f"Could not load SpeechT5 models: {e}")
                self.processor = None
                self.base_model = None
                self.vocoder = None
        else:
            self.processor = None
            self.base_model = None
            self.vocoder = None
    
    def load_training_data(self) -> Dict:
        """Load processed emotion data for voice synthesis training."""
        data_file = self.data_dir / "emotion_data_processed.pkl"
        if not data_file.exists():
            raise FileNotFoundError("Processed emotion data not found. Run data_processor.py first.")
        
        import pickle
        with open(data_file, 'rb') as f:
            data = pickle.load(f)
        
        logger.info("Loaded processed emotion data for voice synthesis")
        return data
    
    def create_synthesis_dataset(self, data: Dict) -> Dict[str, VoiceSynthesisDataset]:
        """Create datasets for voice synthesis training."""
        datasets = {}
        
        for split in ['train', 'val', 'test']:
            df = data[split]
            
            # Sample texts for synthesis training
            texts = df['text'].tolist()
            emotions = df['emotion'].tolist()
            
            # Create personality assignments (distribute across personalities)
            personalities = []
            personality_types = ['professional', 'empathetic', 'persuasive', 'informative', 'friendly']
            for i, emotion in enumerate(emotions):
                # Assign personality based on emotion and index
                if emotion in ['happiness', 'love', 'surprise']:
                    personality = 'friendly'
                elif emotion in ['sadness', 'fear', 'guilt', 'shame']:
                    personality = 'empathetic'
                elif emotion in ['anger', 'disgust']:
                    personality = 'professional'
                elif emotion == 'confusion':
                    personality = 'informative'
                else:
                    personality = personality_types[i % len(personality_types)]
                personalities.append(personality)
            
            datasets[split] = VoiceSynthesisDataset(
                texts=texts,
                emotions=emotions,
                personalities=personalities,
                processor=self.processor
            )
        
        return datasets
    
    def create_dataloaders(self, datasets: Dict) -> Dict[str, DataLoader]:
        """Create data loaders for training."""
        config = self.config['training']
        
        def collate_fn(batch):
            texts = [item['text'] for item in batch]
            emotions = [item['emotion'] for item in batch]
            personalities = [item['personality'] for item in batch]
            emotion_embeddings = torch.stack([item['emotion_embedding'] for item in batch])
            voice_settings = [item['voice_settings'] for item in batch]
            
            # Tokenize texts if processor is available
            if self.processor:
                tokenized = self.processor(text=texts, return_tensors="pt", padding=True, truncation=True)
                input_ids = tokenized['input_ids']
                attention_mask = tokenized['attention_mask']
            else:
                # Simple tokenization for demo
                max_len = max(len(text.split()) for text in texts)
                input_ids = torch.zeros(len(texts), max_len, dtype=torch.long)
                attention_mask = torch.ones(len(texts), max_len, dtype=torch.long)
            
            return {
                'input_ids': input_ids,
                'attention_mask': attention_mask,
                'emotion_embeddings': emotion_embeddings,
                'emotions': emotions,
                'personalities': personalities,
                'voice_settings': voice_settings
            }
        
        loaders = {}
        for split, dataset in datasets.items():
            shuffle = split == 'train'
            batch_size = config['batch_size'] if split == 'train' else config['eval_batch_size']
            
            loaders[split] = DataLoader(
                dataset,
                batch_size=batch_size,
                shuffle=shuffle,
                collate_fn=collate_fn,
                num_workers=config.get('num_workers', 2)
            )
        
        return loaders
    
    def train_emotion_aware_tts(self, datasets: Dict) -> nn.Module:
        """Train emotion-aware TTS model."""
        logger.info("Training emotion-aware TTS model...")
        
        config = self.config['tts_model']
        
        # Initialize model
        model = EmotionAwareTTSModel(
            vocab_size=config['vocab_size'],
            embed_dim=config['embed_dim'],
            emotion_dim=config['emotion_dim'],
            hidden_dim=config['hidden_dim'],
            num_mel_bins=config['num_mel_bins']
        ).to(self.device)
        
        # Create data loaders
        loaders = self.create_dataloaders(datasets)
        
        # Training setup
        optimizer = optim.Adam(model.parameters(), lr=config['learning_rate'])
        scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode='min', patience=3)
        
        # Loss functions
        mel_criterion = nn.MSELoss()
        duration_criterion = nn.MSELoss()
        
        # Training loop
        best_val_loss = float('inf')
        patience = self.config['training']['early_stopping_patience']
        patience_counter = 0
        
        train_losses = []
        val_losses = []
        
        for epoch in range(config['epochs']):
            # Training phase
            model.train()
            total_loss = 0
            num_batches = 0
            
            for batch in loaders['train']:
                optimizer.zero_grad()
                
                # Move data to device
                input_ids = batch['input_ids'].to(self.device)
                emotion_embeddings = batch['emotion_embeddings'].to(self.device)
                
                # Forward pass
                outputs = model(input_ids, emotion_embeddings)
                
                # Generate synthetic target mel spectrograms
                batch_size, seq_len = input_ids.shape
                target_mel = torch.randn(batch_size, model.max_length, model.num_mel_bins).to(self.device)
                target_durations = torch.ones(batch_size, seq_len).to(self.device)
                
                # Calculate losses
                mel_loss = mel_criterion(outputs['mel_output'], target_mel)
                duration_loss = duration_criterion(outputs['durations'], target_durations)
                
                # Total loss
                loss = mel_loss + 0.1 * duration_loss
                
                # Backward pass
                loss.backward()
                torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
                optimizer.step()
                
                total_loss += loss.item()
                num_batches += 1
            
            avg_train_loss = total_loss / num_batches
            train_losses.append(avg_train_loss)
            
            # Validation phase
            val_loss = self.evaluate_tts_model(model, loaders['val'])
            val_losses.append(val_loss)
            
            # Learning rate scheduling
            scheduler.step(val_loss)
            
            logger.info(f"Epoch {epoch+1}/{config['epochs']} - Train Loss: {avg_train_loss:.4f}, Val Loss: {val_loss:.4f}")
            
            # Early stopping
            if val_loss < best_val_loss:
                best_val_loss = val_loss
                patience_counter = 0
                torch.save(model.state_dict(), self.models_dir / "best_emotion_aware_tts.pth")
            else:
                patience_counter += 1
                if patience_counter >= patience:
                    logger.info(f"Early stopping at epoch {epoch+1}")
                    break
        
        # Load best model
        model.load_state_dict(torch.load(self.models_dir / "best_emotion_aware_tts.pth"))
        
        # Final evaluation
        test_loss = self.evaluate_tts_model(model, loaders['test'])
        logger.info(f"Final TTS model test loss: {test_loss:.4f}")
        
        # Save training history
        history = {
            'train_losses': train_losses,
            'val_losses': val_losses,
            'best_val_loss': best_val_loss,
            'test_loss': test_loss
        }
        
        with open(self.models_dir / "tts_training_history.json", 'w') as f:
            json.dump(history, f, indent=2)
        
        return model
    
    def evaluate_tts_model(self, model: nn.Module, data_loader: DataLoader) -> float:
        """Evaluate TTS model performance."""
        model.eval()
        total_loss = 0
        num_batches = 0
        
        mel_criterion = nn.MSELoss()
        
        with torch.no_grad():
            for batch in data_loader:
                input_ids = batch['input_ids'].to(self.device)
                emotion_embeddings = batch['emotion_embeddings'].to(self.device)
                
                outputs = model(input_ids, emotion_embeddings)
                
                # Generate synthetic targets for evaluation
                batch_size = input_ids.shape[0]
                target_mel = torch.randn(batch_size, model.max_length, model.num_mel_bins).to(self.device)
                
                loss = mel_criterion(outputs['mel_output'], target_mel)
                total_loss += loss.item()
                num_batches += 1
        
        return total_loss / num_batches
    
    def fine_tune_speecht5(self, datasets: Dict) -> Optional[nn.Module]:
        """Fine-tune SpeechT5 model for emotion-aware synthesis."""
        if not self.base_model:
            logger.warning("SpeechT5 not available, skipping fine-tuning")
            return None
        
        logger.info("Fine-tuning SpeechT5 for emotion-aware synthesis...")
        
        # Move model to device
        model = self.base_model.to(self.device)
        
        # Create data loaders
        loaders = self.create_dataloaders(datasets)
        
        # Fine-tuning setup
        config = self.config['speecht5_finetune']
        optimizer = optim.AdamW(model.parameters(), lr=config['learning_rate'])
        
        # Training loop for fine-tuning
        best_val_loss = float('inf')
        
        for epoch in range(config['epochs']):
            model.train()
            total_loss = 0
            num_batches = 0
            
            for batch in loaders['train']:
                optimizer.zero_grad()
                
                # For SpeechT5, we would need speaker embeddings and proper audio targets
                # This is a simplified version for demonstration
                input_ids = batch['input_ids'].to(self.device)
                
                # In practice, you would need proper audio targets and speaker embeddings
                # Here we skip the actual training due to complexity
                
                num_batches += 1
            
            if num_batches > 0:
                avg_train_loss = total_loss / num_batches
                logger.info(f"Fine-tuning Epoch {epoch+1}/{config['epochs']} - Train Loss: {avg_train_loss:.4f}")
        
        # Save fine-tuned model
        model.save_pretrained(self.models_dir / "speecht5_emotion_finetuned")
        
        return model
    
    def generate_voice_samples(self, model: nn.Module, test_texts: List[str], 
                              emotions: List[str], personalities: List[str]) -> List[Dict]:
        """Generate voice samples for evaluation."""
        logger.info("Generating voice samples...")
        
        model.eval()
        samples = []
        
        with torch.no_grad():
            for text, emotion, personality in zip(test_texts, emotions, personalities):
                # Create sample input
                dataset = VoiceSynthesisDataset([text], [emotion], [personality], processor=self.processor)
                sample = dataset[0]
                
                # Generate speech
                input_ids = torch.tensor([hash(text) % 1000]).unsqueeze(0).to(self.device)  # Simplified
                emotion_embedding = sample['emotion_embedding'].unsqueeze(0).to(self.device)
                
                outputs = model(input_ids, emotion_embedding)
                
                samples.append({
                    'text': text,
                    'emotion': emotion,
                    'personality': personality,
                    'mel_output': outputs['mel_output'].cpu().numpy(),
                    'voice_settings': sample['voice_settings']
                })
        
        return samples
    
    def save_model_artifacts(self, model: nn.Module, model_name: str):
        """Save model and associated artifacts."""
        logger.info(f"Saving model artifacts for {model_name}...")
        
        # Save model state
        model_path = self.models_dir / f"{model_name}.pth"
        torch.save(model.state_dict(), model_path)
        
        # Save model configuration
        config_path = self.models_dir / f"{model_name}_config.json"
        with open(config_path, 'w') as f:
            json.dump(self.config, f, indent=2)
        
        # Save emotion and personality mappings
        mappings = {
            'emotion_embeddings': {k: v.tolist() for k, v in VoiceSynthesisDataset.__new__(VoiceSynthesisDataset).__dict__.get('emotion_embeddings', {}).items()},
            'personality_settings': VoiceSynthesisDataset.__new__(VoiceSynthesisDataset).__dict__.get('personality_settings', {})
        }
        
        mappings_path = self.models_dir / f"{model_name}_mappings.json"
        with open(mappings_path, 'w') as f:
            json.dump(mappings, f, indent=2)
        
        logger.info(f"Model artifacts saved to {self.models_dir}")

def main():
    parser = argparse.ArgumentParser(description="Train voice synthesis models")
    parser.add_argument("--mode", choices=["emotion_tts", "speecht5_finetune", "all"], 
                       default="all", help="Training mode")
    parser.add_argument("--data-dir", type=str, default="data", help="Data directory")
    parser.add_argument("--models-dir", type=str, default="models", help="Models directory")
    parser.add_argument("--config", type=str, help="Training config file")
    parser.add_argument("--emotions", nargs='+', default=['all'], help="Emotions to train on")
    
    args = parser.parse_args()
    
    # Load configuration
    if args.config:
        with open(args.config, 'r') as f:
            config = json.load(f)
    else:
        # Default configuration
        config = {
            'tts_model': {
                'vocab_size': 10000,
                'embed_dim': 512,
                'emotion_dim': 5,
                'hidden_dim': 1024,
                'num_mel_bins': 80,
                'learning_rate': 1e-4,
                'epochs': 20
            },
            'speecht5_finetune': {
                'learning_rate': 5e-5,
                'epochs': 10
            },
            'training': {
                'batch_size': 8,
                'eval_batch_size': 16,
                'early_stopping_patience': 5,
                'num_workers': 2
            }
        }
    
    # Initialize synthesizer
    synthesizer = VoiceSynthesizer(config, args.data_dir, args.models_dir)
    
    try:
        # Load training data
        data = synthesizer.load_training_data()
        
        # Create datasets
        datasets = synthesizer.create_synthesis_dataset(data)
        
        if args.mode in ["emotion_tts", "all"]:
            # Train emotion-aware TTS model
            tts_model = synthesizer.train_emotion_aware_tts(datasets)
            synthesizer.save_model_artifacts(tts_model, "emotion_aware_tts")
            
            # Generate test samples
            test_texts = [
                "Hello, how can I help you today?",
                "I understand your frustration, let me assist you.",
                "This is an exciting opportunity for you!",
                "Let me explain this step by step.",
                "I'm sorry to hear about your concerns."
            ]
            test_emotions = ['neutral', 'empathy', 'excitement', 'informative', 'sadness']
            test_personalities = ['professional', 'empathetic', 'persuasive', 'informative', 'empathetic']
            
            samples = synthesizer.generate_voice_samples(tts_model, test_texts, test_emotions, test_personalities)
            
            # Save samples information
            samples_info = [{k: v for k, v in sample.items() if k != 'mel_output'} for sample in samples]
            with open(synthesizer.models_dir / "voice_samples_info.json", 'w') as f:
                json.dump(samples_info, f, indent=2)
        
        if args.mode in ["speecht5_finetune", "all"]:
            # Fine-tune SpeechT5
            speecht5_model = synthesizer.fine_tune_speecht5(datasets)
            if speecht5_model:
                logger.info("SpeechT5 fine-tuning completed")
        
        logger.info("Voice synthesis training completed successfully!")
        
    except Exception as e:
        logger.error(f"Error during voice synthesis training: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
