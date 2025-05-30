#!/usr/bin/env python3
"""
Data Processor for Emotion Detection Training
Downloads and preprocesses the Hugging Face emotions dataset for training.
"""

import os
import sys
import pandas as pd
import numpy as np
import argparse
import logging
from pathlib import Path
from typing import Dict, List, Tuple, Optional
import json
from datetime import datetime

# ML and NLP libraries
from datasets import load_dataset, Dataset
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.utils.class_weight import compute_class_weight
import torch
from transformers import AutoTokenizer

# Audio processing libraries
try:
    import librosa
    import soundfile as sf
    AUDIO_AVAILABLE = True
except ImportError:
    AUDIO_AVAILABLE = False
    print("Warning: Audio processing libraries not available. Install librosa and soundfile for audio features.")

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class EmotionDataProcessor:
    """
    Comprehensive data processor for emotion detection training.
    Handles both text and audio data preparation.
    """
    
    def __init__(self, data_dir: str = "data", cache_dir: str = "cache"):
        self.data_dir = Path(data_dir)
        self.cache_dir = Path(cache_dir)
        
        # Create directories
        self.data_dir.mkdir(exist_ok=True)
        self.cache_dir.mkdir(exist_ok=True)
        
        # Emotion mapping for the dataset
        self.emotion_labels = [
            'happiness', 'sadness', 'neutral', 'anger', 'love', 'fear',
            'disgust', 'confusion', 'surprise', 'shame', 'guilt', 'sarcasm', 'desire'
        ]
        
        # Sales-relevant emotion mapping
        self.sales_emotion_mapping = {
            'happiness': 'positive',
            'love': 'positive', 
            'surprise': 'positive',
            'neutral': 'neutral',
            'confusion': 'neutral',
            'sadness': 'negative',
            'anger': 'negative',
            'fear': 'negative',
            'disgust': 'negative',
            'shame': 'negative',
            'guilt': 'negative',
            'sarcasm': 'negative',
            'desire': 'interested'
        }
        
        self.label_encoder = LabelEncoder()
        self.tokenizer = None
        
    def download_dataset(self) -> Dataset:
        """Download the emotions dataset from Hugging Face."""
        logger.info("Downloading emotions dataset from Hugging Face...")
        
        try:
            # Login using CLI if needed: huggingface-cli login
            dataset = load_dataset("boltuix/emotions-dataset")
            logger.info(f"Dataset downloaded successfully. Size: {len(dataset['train'])} samples")
            return dataset
        except Exception as e:
            logger.error(f"Failed to download dataset: {e}")
            raise
    
    def preprocess_text_data(self, dataset: Dataset) -> pd.DataFrame:
        """Preprocess text data for emotion classification."""
        logger.info("Preprocessing text data...")
        
        # Convert to pandas DataFrame
        df = dataset['train'].to_pandas()
        
        # Standardize column names
        df = df.rename(columns={'Sentence': 'text', 'Label': 'emotion'})
        
        # Convert emotion labels to lowercase
        df['emotion'] = df['emotion'].str.lower()
        
        # Remove duplicates
        initial_size = len(df)
        df = df.drop_duplicates(subset=['text'])
        logger.info(f"Removed {initial_size - len(df)} duplicate samples")
        
        # Basic text cleaning
        df['text'] = df['text'].str.strip()
        df['text'] = df['text'].str.replace(r'\s+', ' ', regex=True)
        
        # Remove samples with very short text (less than 3 words)
        df = df[df['text'].str.split().str.len() >= 3]
        
        # Add sales-relevant emotion categories
        df['sales_emotion'] = df['emotion'].map(self.sales_emotion_mapping)
        
        # Add text statistics
        df['text_length'] = df['text'].str.len()
        df['word_count'] = df['text'].str.split().str.len()
        
        logger.info(f"Preprocessed text data: {len(df)} samples")
        logger.info(f"Emotion distribution:\n{df['emotion'].value_counts()}")
        
        return df
    
    def create_balanced_dataset(self, df: pd.DataFrame, max_samples_per_class: int = 5000) -> pd.DataFrame:
        """Create a balanced dataset for training."""
        logger.info("Creating balanced dataset...")
        
        balanced_dfs = []
        for emotion in df['emotion'].unique():
            emotion_df = df[df['emotion'] == emotion]
            
            if len(emotion_df) > max_samples_per_class:
                # Downsample
                emotion_df = emotion_df.sample(n=max_samples_per_class, random_state=42)
            else:
                # Upsample using text augmentation (simple repetition with slight modifications)
                additional_needed = max_samples_per_class - len(emotion_df)
                if additional_needed > 0:
                    # Simple augmentation by sampling with replacement
                    augmented = emotion_df.sample(n=additional_needed, replace=True, random_state=42)
                    emotion_df = pd.concat([emotion_df, augmented], ignore_index=True)
            
            balanced_dfs.append(emotion_df)
        
        balanced_df = pd.concat(balanced_dfs, ignore_index=True)
        balanced_df = balanced_df.sample(frac=1, random_state=42).reset_index(drop=True)
        
        logger.info(f"Balanced dataset created: {len(balanced_df)} samples")
        logger.info(f"Balanced distribution:\n{balanced_df['emotion'].value_counts()}")
        
        return balanced_df
    
    def prepare_training_data(self, df: pd.DataFrame, test_size: float = 0.2, val_size: float = 0.1) -> Dict:
        """Prepare training, validation, and test datasets."""
        logger.info("Preparing training data splits...")
        
        # Encode labels
        df['label'] = self.label_encoder.fit_transform(df['emotion'])
        
        # First split: train + val vs test
        train_val_df, test_df = train_test_split(
            df, test_size=test_size, stratify=df['label'], random_state=42
        )
        
        # Second split: train vs val
        val_size_adjusted = val_size / (1 - test_size)
        train_df, val_df = train_test_split(
            train_val_df, test_size=val_size_adjusted, stratify=train_val_df['label'], random_state=42
        )
        
        # Calculate class weights for imbalanced data handling
        class_weights = compute_class_weight(
            'balanced', 
            classes=np.unique(train_df['label']), 
            y=train_df['label']
        )
        
        data_splits = {
            'train': train_df,
            'val': val_df,
            'test': test_df,
            'label_encoder': self.label_encoder,
            'class_weights': class_weights,
            'emotion_labels': self.emotion_labels,
            'sales_emotion_mapping': self.sales_emotion_mapping
        }
        
        logger.info(f"Data splits created:")
        logger.info(f"  Train: {len(train_df)} samples")
        logger.info(f"  Validation: {len(val_df)} samples")
        logger.info(f"  Test: {len(test_df)} samples")
        
        return data_splits
    
    def tokenize_texts(self, data_splits: Dict, model_name: str = "bert-base-uncased", max_length: int = 128) -> Dict:
        """Tokenize texts for transformer models."""
        logger.info(f"Tokenizing texts with {model_name}...")
        
        self.tokenizer = AutoTokenizer.from_pretrained(model_name)
        
        for split_name in ['train', 'val', 'test']:
            df = data_splits[split_name]
            
            # Tokenize
            encodings = self.tokenizer(
                df['text'].tolist(),
                truncation=True,
                padding=True,
                max_length=max_length,
                return_tensors='pt'
            )
            
            # Add tokenized data to dataframe
            data_splits[f'{split_name}_encodings'] = encodings
            data_splits[f'{split_name}_labels'] = torch.tensor(df['label'].values)
        
        data_splits['tokenizer'] = self.tokenizer
        
        return data_splits
    
    def generate_synthetic_audio_features(self, df: pd.DataFrame) -> np.ndarray:
        """
        Generate synthetic audio features for text samples.
        In a real implementation, this would be replaced with actual audio processing.
        """
        logger.info("Generating synthetic audio features...")
        
        # Simulate audio features based on text characteristics and emotions
        features = []
        
        for _, row in df.iterrows():
            text = row['text']
            emotion = row['emotion']
            
            # Simulate MFCC features (13 coefficients)
            mfcc_features = np.random.randn(13)
            
            # Adjust features based on emotion (simplified simulation)
            emotion_adjustments = {
                'happiness': [0.5, 0.3, 0.2],
                'sadness': [-0.5, -0.3, -0.2],
                'anger': [0.8, 0.6, 0.4],
                'fear': [-0.3, -0.5, -0.4],
                'neutral': [0.0, 0.0, 0.0]
            }
            
            adjustment = emotion_adjustments.get(emotion, [0.0, 0.0, 0.0])
            mfcc_features[:3] += adjustment
            
            # Simulate pitch, energy, and rhythm features
            pitch_features = np.random.randn(5) * (0.5 if emotion in ['happiness', 'anger'] else 0.3)
            energy_features = np.random.randn(3) * (0.8 if emotion == 'anger' else 0.5)
            rhythm_features = np.random.randn(4) * (0.6 if emotion == 'happiness' else 0.4)
            
            # Combine all features
            combined_features = np.concatenate([
                mfcc_features, pitch_features, energy_features, rhythm_features
            ])
            
            features.append(combined_features)
        
        return np.array(features)
    
    def save_processed_data(self, data_splits: Dict, filename: str = "emotion_data_processed.pkl") -> None:
        """Save processed data to disk."""
        logger.info(f"Saving processed data to {filename}...")
        
        save_path = self.data_dir / filename
        
        # Convert torch tensors to numpy for serialization
        save_data = {}
        for key, value in data_splits.items():
            if isinstance(value, torch.Tensor):
                save_data[key] = value.numpy()
            elif hasattr(value, 'save_pretrained'):  # For tokenizer
                # Save tokenizer separately
                tokenizer_path = self.data_dir / "tokenizer"
                value.save_pretrained(tokenizer_path)
                save_data[key] = str(tokenizer_path)
            else:
                save_data[key] = value
        
        # Save using pandas pickle
        pd.to_pickle(save_data, save_path)
        
        # Also save metadata
        metadata = {
            'timestamp': datetime.now().isoformat(),
            'total_samples': len(data_splits['train']) + len(data_splits['val']) + len(data_splits['test']),
            'emotion_labels': data_splits['emotion_labels'],
            'sales_emotion_mapping': data_splits['sales_emotion_mapping'],
            'model_performance_targets': {
                'text_accuracy': 0.92,
                'audio_accuracy': 0.88,
                'latency_ms': 100
            }
        }
        
        metadata_path = self.data_dir / "metadata.json"
        with open(metadata_path, 'w') as f:
            json.dump(metadata, f, indent=2)
        
        logger.info(f"Data saved successfully to {save_path}")
        logger.info(f"Metadata saved to {metadata_path}")
    
    def load_processed_data(self, filename: str = "emotion_data_processed.pkl") -> Dict:
        """Load processed data from disk."""
        load_path = self.data_dir / filename
        
        if not load_path.exists():
            raise FileNotFoundError(f"Processed data file not found: {load_path}")
        
        logger.info(f"Loading processed data from {load_path}...")
        data = pd.read_pickle(load_path)
        
        # Load tokenizer if available
        tokenizer_path = self.data_dir / "tokenizer"
        if tokenizer_path.exists():
            data['tokenizer'] = AutoTokenizer.from_pretrained(tokenizer_path)
        
        logger.info("Data loaded successfully")
        return data
    
    def create_training_config(self) -> Dict:
        """Create training configuration for models."""
        config = {
            'text_model': {
                'model_name': 'bert-base-uncased',
                'max_length': 128,
                'batch_size': 16,
                'learning_rate': 2e-5,
                'epochs': 5,
                'warmup_steps': 500,
                'weight_decay': 0.01
            },
            'audio_model': {
                'model_type': 'cnn_lstm',
                'input_features': 25,  # MFCC + pitch + energy + rhythm
                'hidden_size': 128,
                'num_layers': 2,
                'dropout': 0.3,
                'batch_size': 32,
                'learning_rate': 1e-3,
                'epochs': 20
            },
            'multimodal_model': {
                'fusion_method': 'late_fusion',
                'text_weight': 0.7,
                'audio_weight': 0.3,
                'fusion_hidden_size': 64,
                'dropout': 0.2
            },
            'training': {
                'early_stopping_patience': 3,
                'save_best_model': True,
                'evaluation_steps': 100,
                'logging_steps': 50,
                'gradient_accumulation_steps': 1,
                'fp16': True
            }
        }
        
        config_path = self.data_dir / "training_config.json"
        with open(config_path, 'w') as f:
            json.dump(config, f, indent=2)
        
        logger.info(f"Training configuration saved to {config_path}")
        return config

def main():
    parser = argparse.ArgumentParser(description="Process emotion detection training data")
    parser.add_argument("--download", action="store_true", help="Download the dataset")
    parser.add_argument("--preprocess", action="store_true", help="Preprocess the data")
    parser.add_argument("--balance", action="store_true", help="Create balanced dataset")
    parser.add_argument("--max-samples", type=int, default=5000, help="Max samples per emotion class")
    parser.add_argument("--data-dir", type=str, default="data", help="Data directory")
    parser.add_argument("--cache-dir", type=str, default="cache", help="Cache directory")
    
    args = parser.parse_args()
    
    # Initialize processor
    processor = EmotionDataProcessor(data_dir=args.data_dir, cache_dir=args.cache_dir)
    
    try:
        if args.download:
            # Download dataset
            dataset = processor.download_dataset()
            
            # Preprocess text data
            df = processor.preprocess_text_data(dataset)
            
            if args.balance:
                df = processor.create_balanced_dataset(df, max_samples_per_class=args.max_samples)
            
            # Prepare training data
            data_splits = processor.prepare_training_data(df)
            
            # Tokenize texts
            data_splits = processor.tokenize_texts(data_splits)
            
            # Generate synthetic audio features (replace with real audio processing)
            for split_name in ['train', 'val', 'test']:
                split_df = data_splits[split_name]
                audio_features = processor.generate_synthetic_audio_features(split_df)
                data_splits[f'{split_name}_audio_features'] = audio_features
            
            # Save processed data
            processor.save_processed_data(data_splits)
            
            # Create training configuration
            config = processor.create_training_config()
            
            logger.info("Data processing completed successfully!")
            logger.info(f"Ready for training with {len(data_splits['train'])} training samples")
            
        elif args.preprocess:
            # Load and preprocess existing data
            logger.info("Loading existing data for preprocessing...")
            # Add preprocessing logic here
            
        else:
            parser.print_help()
            
    except Exception as e:
        logger.error(f"Error during data processing: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
