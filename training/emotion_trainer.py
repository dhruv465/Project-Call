#!/usr/bin/env python3
"""
Emotion Trainer for Voice AI System
Trains text, audio, and multimodal emotion detection models.
"""

import os
import sys
import json
import logging
import argparse
from pathlib import Path
from typing import Dict, List, Tuple, Optional
import time
from datetime import datetime

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
from torch.nn.utils.rnn import pad_sequence

# Hugging Face and transformers
from transformers import (
    AutoModel, AutoTokenizer, AutoConfig,
    TrainingArguments, Trainer, EarlyStoppingCallback
)
from datasets import Dataset as HFDataset

# Evaluation metrics
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.preprocessing import LabelEncoder
import matplotlib.pyplot as plt
import seaborn as sns

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class EmotionDataset(Dataset):
    """Custom dataset for emotion detection."""
    
    def __init__(self, encodings, labels, audio_features=None):
        self.encodings = encodings
        self.labels = labels
        self.audio_features = audio_features
    
    def __getitem__(self, idx):
        item = {key: torch.tensor(val[idx]) for key, val in self.encodings.items()}
        item['labels'] = torch.tensor(self.labels[idx], dtype=torch.long)
        
        if self.audio_features is not None:
            item['audio_features'] = torch.tensor(self.audio_features[idx], dtype=torch.float32)
        
        return item
    
    def __len__(self):
        return len(self.labels)

class TextEmotionModel(nn.Module):
    """BERT-based text emotion classification model."""
    
    def __init__(self, model_name: str, num_classes: int, dropout: float = 0.3):
        super().__init__()
        self.bert = AutoModel.from_pretrained(model_name)
        self.dropout = nn.Dropout(dropout)
        self.classifier = nn.Linear(self.bert.config.hidden_size, num_classes)
        
    def forward(self, input_ids, attention_mask, **kwargs):
        outputs = self.bert(input_ids=input_ids, attention_mask=attention_mask)
        pooled_output = outputs.pooler_output
        pooled_output = self.dropout(pooled_output)
        logits = self.classifier(pooled_output)
        return {'logits': logits}

class AudioEmotionModel(nn.Module):
    """CNN-LSTM model for audio emotion classification."""
    
    def __init__(self, input_features: int, hidden_size: int, num_classes: int, 
                 num_layers: int = 2, dropout: float = 0.3):
        super().__init__()
        
        # CNN layers for feature extraction
        self.conv1 = nn.Conv1d(1, 64, kernel_size=3, padding=1)
        self.conv2 = nn.Conv1d(64, 128, kernel_size=3, padding=1)
        self.pool = nn.AdaptiveAvgPool1d(1)
        
        # LSTM layers
        self.lstm = nn.LSTM(
            input_size=128,
            hidden_size=hidden_size,
            num_layers=num_layers,
            dropout=dropout if num_layers > 1 else 0,
            batch_first=True
        )
        
        # Classification head
        self.dropout = nn.Dropout(dropout)
        self.classifier = nn.Linear(hidden_size, num_classes)
        
    def forward(self, audio_features, **kwargs):
        # audio_features: (batch_size, features)
        x = audio_features.unsqueeze(1)  # Add channel dimension
        
        # CNN feature extraction
        x = torch.relu(self.conv1(x))
        x = torch.relu(self.conv2(x))
        x = self.pool(x)  # (batch_size, 128, 1)
        
        # Prepare for LSTM
        x = x.permute(0, 2, 1)  # (batch_size, 1, 128)
        
        # LSTM processing
        lstm_out, (hidden, _) = self.lstm(x)
        
        # Use the last hidden state
        output = self.dropout(hidden[-1])  # Take last layer's hidden state
        logits = self.classifier(output)
        
        return {'logits': logits}

class MultimodalEmotionModel(nn.Module):
    """Multimodal fusion model combining text and audio."""
    
    def __init__(self, text_model: TextEmotionModel, audio_model: AudioEmotionModel,
                 num_classes: int, fusion_hidden_size: int = 64, dropout: float = 0.2):
        super().__init__()
        
        self.text_model = text_model
        self.audio_model = audio_model
        
        # Remove classification heads from individual models
        text_feature_size = text_model.bert.config.hidden_size
        audio_feature_size = audio_model.lstm.hidden_size
        
        # Fusion layer
        self.fusion = nn.Sequential(
            nn.Linear(text_feature_size + audio_feature_size, fusion_hidden_size),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(fusion_hidden_size, num_classes)
        )
        
    def forward(self, input_ids, attention_mask, audio_features, **kwargs):
        # Get text features
        text_outputs = self.text_model.bert(input_ids=input_ids, attention_mask=attention_mask)
        text_features = text_outputs.pooler_output
        
        # Get audio features (modify audio model to return features)
        x = audio_features.unsqueeze(1)
        x = torch.relu(self.audio_model.conv1(x))
        x = torch.relu(self.audio_model.conv2(x))
        x = self.audio_model.pool(x).permute(0, 2, 1)
        lstm_out, (hidden, _) = self.audio_model.lstm(x)
        audio_features_processed = hidden[-1]
        
        # Fusion
        combined_features = torch.cat([text_features, audio_features_processed], dim=1)
        logits = self.fusion(combined_features)
        
        return {'logits': logits}

class EmotionTrainer:
    """Main trainer class for emotion detection models."""
    
    def __init__(self, config: Dict, data_dir: str = "data", models_dir: str = "models"):
        self.config = config
        self.data_dir = Path(data_dir)
        self.models_dir = Path(models_dir)
        self.models_dir.mkdir(exist_ok=True)
        
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        logger.info(f"Using device: {self.device}")
        
        # Load processed data
        self.data = self.load_processed_data()
        self.num_classes = len(self.data['emotion_labels'])
        
    def load_processed_data(self) -> Dict:
        """Load preprocessed data."""
        data_file = self.data_dir / "emotion_data_processed.pkl"
        if not data_file.exists():
            raise FileNotFoundError(f"Processed data not found. Run data_processor.py first.")
        
        logger.info("Loading processed data...")
        return pd.read_pickle(data_file)
    
    def create_dataloaders(self, mode: str) -> Tuple[DataLoader, DataLoader, DataLoader]:
        """Create dataloaders for training."""
        
        if mode == "text_emotion":
            train_dataset = EmotionDataset(
                self.data['train_encodings'],
                self.data['train_labels']
            )
            val_dataset = EmotionDataset(
                self.data['val_encodings'],
                self.data['val_labels']
            )
            test_dataset = EmotionDataset(
                self.data['test_encodings'],
                self.data['test_labels']
            )
            batch_size = self.config['text_model']['batch_size']
            
        elif mode == "audio_emotion":
            train_dataset = EmotionDataset(
                {},  # No text encodings for audio-only
                self.data['train_labels'],
                self.data['train_audio_features']
            )
            val_dataset = EmotionDataset(
                {},
                self.data['val_labels'],
                self.data['val_audio_features']
            )
            test_dataset = EmotionDataset(
                {},
                self.data['test_labels'],
                self.data['test_audio_features']
            )
            batch_size = self.config['audio_model']['batch_size']
            
        elif mode == "multimodal":
            train_dataset = EmotionDataset(
                self.data['train_encodings'],
                self.data['train_labels'],
                self.data['train_audio_features']
            )
            val_dataset = EmotionDataset(
                self.data['val_encodings'],
                self.data['val_labels'],
                self.data['val_audio_features']
            )
            test_dataset = EmotionDataset(
                self.data['test_encodings'],
                self.data['test_labels'],
                self.data['test_audio_features']
            )
            batch_size = self.config['multimodal_model'].get('batch_size', 64)  # Default to 64 if not specified
        
        train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True)
        val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False)
        test_loader = DataLoader(test_dataset, batch_size=batch_size, shuffle=False)
        
        return train_loader, val_loader, test_loader
    
    def train_text_emotion_model(self) -> nn.Module:
        """Train BERT-based text emotion classification model."""
        logger.info("Training text emotion model...")
        
        config = self.config['text_model']
        
        # Initialize model
        model = TextEmotionModel(
            model_name=config['model_name'],
            num_classes=self.num_classes,
            dropout=0.3
        ).to(self.device)
        
        # Create dataloaders
        train_loader, val_loader, test_loader = self.create_dataloaders("text_emotion")
        
        # Training setup
        optimizer = optim.AdamW(model.parameters(), lr=config['learning_rate'], weight_decay=config['weight_decay'])
        criterion = nn.CrossEntropyLoss(weight=torch.tensor(self.data['class_weights'], dtype=torch.float32).to(self.device))
        
        # Training loop
        best_val_acc = 0
        patience = self.config['training']['early_stopping_patience']
        patience_counter = 0
        
        train_losses = []
        val_accuracies = []
        
        for epoch in range(config['epochs']):
            # Training phase
            model.train()
            total_loss = 0
            batch_count = len(train_loader)
            
            for batch_idx, batch in enumerate(train_loader):
                if batch_idx % 10 == 0:
                    logger.info(f"  Training batch {batch_idx}/{batch_count} ({(batch_idx/batch_count*100):.1f}%)")
                
                optimizer.zero_grad()
                
                # Move data to device
                input_ids = batch['input_ids'].to(self.device)
                attention_mask = batch['attention_mask'].to(self.device)
                labels = batch['labels'].to(self.device)
                
                # Forward pass
                outputs = model(input_ids=input_ids, attention_mask=attention_mask)
                loss = criterion(outputs['logits'], labels)
                
                # Backward pass
                loss.backward()
                optimizer.step()
                
                total_loss += loss.item()
            
            avg_train_loss = total_loss / len(train_loader)
            train_losses.append(avg_train_loss)
            
            # Validation phase
            val_acc = self.evaluate_model(model, val_loader, "text")
            val_accuracies.append(val_acc)
            
            logger.info(f"Epoch {epoch+1}/{config['epochs']} - Train Loss: {avg_train_loss:.4f}, Val Acc: {val_acc:.4f}")
            
            # Early stopping
            if val_acc > best_val_acc:
                best_val_acc = val_acc
                patience_counter = 0
                # Save best model
                torch.save(model.state_dict(), self.models_dir / "best_text_emotion_model.pth")
            else:
                patience_counter += 1
                if patience_counter >= patience:
                    logger.info(f"Early stopping at epoch {epoch+1}")
                    break
        
        # Load best model for final evaluation
        model.load_state_dict(torch.load(self.models_dir / "best_text_emotion_model.pth"))
        
        # Final evaluation
        test_acc = self.evaluate_model(model, test_loader, "text")
        logger.info(f"Final text emotion model test accuracy: {test_acc:.4f}")
        
        # Save training history
        history = {
            'train_losses': train_losses,
            'val_accuracies': val_accuracies,
            'best_val_accuracy': best_val_acc,
            'test_accuracy': test_acc
        }
        
        with open(self.models_dir / "text_emotion_training_history.json", 'w') as f:
            json.dump(history, f, indent=2)
        
        return model
    
    def train_audio_emotion_model(self) -> nn.Module:
        """Train CNN-LSTM audio emotion classification model."""
        logger.info("Training audio emotion model...")
        
        config = self.config['audio_model']
        
        # Initialize model
        model = AudioEmotionModel(
            input_features=config['input_features'],
            hidden_size=config['hidden_size'],
            num_classes=self.num_classes,
            num_layers=config['num_layers'],
            dropout=config['dropout']
        ).to(self.device)
        
        # Create dataloaders
        train_loader, val_loader, test_loader = self.create_dataloaders("audio_emotion")
        
        # Training setup
        optimizer = optim.Adam(model.parameters(), lr=config['learning_rate'])
        criterion = nn.CrossEntropyLoss(weight=torch.tensor(self.data['class_weights'], dtype=torch.float32).to(self.device))
        
        # Training loop
        best_val_acc = 0
        patience = self.config['training']['early_stopping_patience']
        patience_counter = 0
        
        train_losses = []
        val_accuracies = []
        
        logger.info(f"Starting audio model training for {config['epochs']} epochs with {len(train_loader)} batches per epoch")
        
        for epoch in range(config['epochs']):
            # Training phase
            model.train()
            total_loss = 0
            batch_count = len(train_loader)
            start_time = time.time()
            
            for batch_idx, batch in enumerate(train_loader):
                if batch_idx % 5 == 0:
                    logger.info(f"  Training batch {batch_idx}/{batch_count} ({(batch_idx/batch_count*100):.1f}%)")
                
                optimizer.zero_grad()
                
                # Move data to device
                audio_features = batch['audio_features'].to(self.device)
                labels = batch['labels'].to(self.device)
                
                # Forward pass
                outputs = model(audio_features=audio_features)
                loss = criterion(outputs['logits'], labels)
                
                # Backward pass
                loss.backward()
                optimizer.step()
                
                total_loss += loss.item()
                
            epoch_time = time.time() - start_time
            logger.info(f"  Epoch {epoch+1} completed in {epoch_time:.2f} seconds")
            
            avg_train_loss = total_loss / len(train_loader)
            train_losses.append(avg_train_loss)
            
            # Validation phase
            val_acc = self.evaluate_model(model, val_loader, "audio")
            val_accuracies.append(val_acc)
            
            logger.info(f"Epoch {epoch+1}/{config['epochs']} - Train Loss: {avg_train_loss:.4f}, Val Acc: {val_acc:.4f}")
            
            # Early stopping
            if val_acc > best_val_acc:
                best_val_acc = val_acc
                patience_counter = 0
                torch.save(model.state_dict(), self.models_dir / "best_audio_emotion_model.pth")
            else:
                patience_counter += 1
                if patience_counter >= patience:
                    logger.info(f"Early stopping at epoch {epoch+1}")
                    break
        
        # Load best model for final evaluation
        model.load_state_dict(torch.load(self.models_dir / "best_audio_emotion_model.pth"))
        
        # Final evaluation
        test_acc = self.evaluate_model(model, test_loader, "audio")
        logger.info(f"Final audio emotion model test accuracy: {test_acc:.4f}")
        
        # Save training history
        history = {
            'train_losses': train_losses,
            'val_accuracies': val_accuracies,
            'best_val_accuracy': best_val_acc,
            'test_accuracy': test_acc
        }
        
        with open(self.models_dir / "audio_emotion_training_history.json", 'w') as f:
            json.dump(history, f, indent=2)
        
        return model
    
    def train_multimodal_model(self) -> nn.Module:
        """Train multimodal emotion classification model."""
        logger.info("Training multimodal emotion model...")
        
        # Load pre-trained models
        text_model = TextEmotionModel(
            model_name=self.config['text_model']['model_name'],
            num_classes=self.num_classes
        )
        text_model.load_state_dict(torch.load(self.models_dir / "best_text_emotion_model.pth"))
        
        audio_model = AudioEmotionModel(
            input_features=self.config['audio_model']['input_features'],
            hidden_size=self.config['audio_model']['hidden_size'],
            num_classes=self.num_classes,
            num_layers=self.config['audio_model']['num_layers'],
            dropout=self.config['audio_model']['dropout']
        )
        audio_model.load_state_dict(torch.load(self.models_dir / "best_audio_emotion_model.pth"))
        
        # Create multimodal model
        config = self.config['multimodal_model']
        model = MultimodalEmotionModel(
            text_model=text_model,
            audio_model=audio_model,
            num_classes=self.num_classes,
            fusion_hidden_size=config['fusion_hidden_size'],
            dropout=config['dropout']
        ).to(self.device)
        
        # Create dataloaders
        train_loader, val_loader, test_loader = self.create_dataloaders("multimodal")
        
        # Training setup (fine-tuning with lower learning rate)
        optimizer = optim.Adam(model.parameters(), lr=1e-4)
        criterion = nn.CrossEntropyLoss(weight=torch.tensor(self.data['class_weights'], dtype=torch.float32).to(self.device))
        
        # Training loop
        best_val_acc = 0
        patience = self.config['training']['early_stopping_patience']
        patience_counter = 0
        
        train_losses = []
        val_accuracies = []
        
        # Using fewer epochs for fine-tuning
        num_epochs = 3  # Reduced for faster training
        logger.info(f"Starting multimodal model training for {num_epochs} epochs with {len(train_loader)} batches per epoch")
        
        for epoch in range(num_epochs):
            model.train()
            total_loss = 0
            batch_count = len(train_loader)
            start_time = time.time()
            
            for batch_idx, batch in enumerate(train_loader):
                if batch_idx % 5 == 0:
                    logger.info(f"  Training batch {batch_idx}/{batch_count} ({(batch_idx/batch_count*100):.1f}%)")
                
                optimizer.zero_grad()
                
                # Move data to device
                input_ids = batch['input_ids'].to(self.device)
                attention_mask = batch['attention_mask'].to(self.device)
                audio_features = batch['audio_features'].to(self.device)
                labels = batch['labels'].to(self.device)
                
                # Forward pass
                outputs = model(
                    input_ids=input_ids,
                    attention_mask=attention_mask,
                    audio_features=audio_features
                )
                loss = criterion(outputs['logits'], labels)
                
                # Backward pass
                loss.backward()
                optimizer.step()
                
                total_loss += loss.item()
                
            epoch_time = time.time() - start_time
            logger.info(f"  Epoch {epoch+1} completed in {epoch_time:.2f} seconds")
            
            avg_train_loss = total_loss / len(train_loader)
            train_losses.append(avg_train_loss)
            
            # Validation phase
            val_acc = self.evaluate_model(model, val_loader, "multimodal")
            val_accuracies.append(val_acc)
            
            logger.info(f"Epoch {epoch+1}/10 - Train Loss: {avg_train_loss:.4f}, Val Acc: {val_acc:.4f}")
            
            # Early stopping
            if val_acc > best_val_acc:
                best_val_acc = val_acc
                patience_counter = 0
                torch.save(model.state_dict(), self.models_dir / "best_multimodal_emotion_model.pth")
            else:
                patience_counter += 1
                if patience_counter >= patience:
                    logger.info(f"Early stopping at epoch {epoch+1}")
                    break
        
        # Load best model for final evaluation
        model.load_state_dict(torch.load(self.models_dir / "best_multimodal_emotion_model.pth"))
        
        # Final evaluation
        test_acc = self.evaluate_model(model, test_loader, "multimodal")
        logger.info(f"Final multimodal emotion model test accuracy: {test_acc:.4f}")
        
        # Save training history
        history = {
            'train_losses': train_losses,
            'val_accuracies': val_accuracies,
            'best_val_accuracy': best_val_acc,
            'test_accuracy': test_acc
        }
        
        with open(self.models_dir / "multimodal_emotion_training_history.json", 'w') as f:
            json.dump(history, f, indent=2)
        
        return model
    
    def evaluate_model(self, model: nn.Module, data_loader: DataLoader, mode: str) -> float:
        """Evaluate model performance."""
        model.eval()
        all_predictions = []
        all_labels = []
        
        with torch.no_grad():
            for batch in data_loader:
                labels = batch['labels'].to(self.device)
                
                if mode == "text":
                    input_ids = batch['input_ids'].to(self.device)
                    attention_mask = batch['attention_mask'].to(self.device)
                    outputs = model(input_ids=input_ids, attention_mask=attention_mask)
                elif mode == "audio":
                    audio_features = batch['audio_features'].to(self.device)
                    outputs = model(audio_features=audio_features)
                elif mode == "multimodal":
                    input_ids = batch['input_ids'].to(self.device)
                    attention_mask = batch['attention_mask'].to(self.device)
                    audio_features = batch['audio_features'].to(self.device)
                    outputs = model(
                        input_ids=input_ids,
                        attention_mask=attention_mask,
                        audio_features=audio_features
                    )
                
                predictions = torch.argmax(outputs['logits'], dim=1)
                all_predictions.extend(predictions.cpu().numpy())
                all_labels.extend(labels.cpu().numpy())
        
        accuracy = accuracy_score(all_labels, all_predictions)
        return accuracy
    
    def save_model_artifacts(self, model: nn.Module, model_name: str):
        """Save model and associated artifacts."""
        logger.info(f"Saving {model_name} artifacts...")
        
        # Save model
        torch.save(model.state_dict(), self.models_dir / f"{model_name}.pth")
        
        # Save model config
        model_config = {
            'model_name': model_name,
            'num_classes': self.num_classes,
            'emotion_labels': self.data['emotion_labels'],
            'sales_emotion_mapping': self.data['sales_emotion_mapping'],
            'training_timestamp': datetime.now().isoformat()
        }
        
        with open(self.models_dir / f"{model_name}_config.json", 'w') as f:
            json.dump(model_config, f, indent=2)
        
        # Save label encoder
        import joblib
        joblib.dump(self.data['label_encoder'], self.models_dir / f"{model_name}_label_encoder.pkl")
        
        logger.info(f"{model_name} artifacts saved successfully")

def main():
    parser = argparse.ArgumentParser(description="Train emotion detection models")
    parser.add_argument("--mode", choices=["text_emotion", "audio_emotion", "multimodal", "all"], 
                       default="all", help="Training mode")
    parser.add_argument("--data-dir", type=str, default="data", help="Data directory")
    parser.add_argument("--models-dir", type=str, default="models", help="Models directory")
    parser.add_argument("--config", type=str, help="Training config file")
    
    args = parser.parse_args()
    
    # Load configuration
    if args.config:
        with open(args.config, 'r') as f:
            config = json.load(f)
    else:
        config_file = Path(args.data_dir) / "training_config.json"
        if config_file.exists():
            with open(config_file, 'r') as f:
                config = json.load(f)
        else:
            logger.error("No training config found. Run data_processor.py first.")
            sys.exit(1)
    
    # Initialize trainer
    trainer = EmotionTrainer(config, data_dir=args.data_dir, models_dir=args.models_dir)
    
    try:
        if args.mode == "text_emotion" or args.mode == "all":
            model = trainer.train_text_emotion_model()
            trainer.save_model_artifacts(model, "text_emotion_model")
        
        if args.mode == "audio_emotion" or args.mode == "all":
            model = trainer.train_audio_emotion_model()
            trainer.save_model_artifacts(model, "audio_emotion_model")
        
        if args.mode == "multimodal" or args.mode == "all":
            model = trainer.train_multimodal_model()
            trainer.save_model_artifacts(model, "multimodal_emotion_model")
        
        logger.info("Training completed successfully!")
        
    except Exception as e:
        logger.error(f"Error during training: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
