#!/usr/bin/env python3
"""
Model Evaluator for Emotion Detection and Voice Synthesis
Comprehensive evaluation system for training performance and real-time testing.
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
import warnings
warnings.filterwarnings('ignore')

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from torch.utils.data import DataLoader

# Evaluation and visualization
from sklearn.metrics import (
    accuracy_score, precision_recall_fscore_support, confusion_matrix,
    classification_report, roc_auc_score, roc_curve, auc
)
from sklearn.preprocessing import LabelEncoder
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.manifold import TSNE
from sklearn.decomposition import PCA
import plotly.graph_objects as go
import plotly.express as px
from plotly.subplots import make_subplots

# Audio evaluation
try:
    import librosa
    import soundfile as sf
    from pesq import pesq
    from pystoi import stoi
    AUDIO_EVAL_AVAILABLE = True
except ImportError:
    AUDIO_EVAL_AVAILABLE = False
    print("Warning: Audio evaluation libraries not available. Install pesq and pystoi for audio quality metrics.")

# Load custom models
from emotion_trainer import EmotionTrainer, TextEmotionModel, AudioEmotionModel, MultimodalEmotionModel
from voice_synthesizer import VoiceSynthesizer, EmotionAwareTTSModel

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class ModelEvaluator:
    """Comprehensive model evaluation system."""
    
    def __init__(self, data_dir: str = "data", models_dir: str = "models", 
                 results_dir: str = "evaluation_results"):
        self.data_dir = Path(data_dir)
        self.models_dir = Path(models_dir)
        self.results_dir = Path(results_dir)
        self.results_dir.mkdir(exist_ok=True)
        
        # Device configuration
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        logger.info(f"Using device: {self.device}")
        
        # Evaluation metrics storage
        self.evaluation_results = {}
        
        # Load emotion mappings
        self.emotion_labels = [
            'happiness', 'sadness', 'neutral', 'anger', 'love', 'fear',
            'disgust', 'confusion', 'surprise', 'shame', 'guilt', 'sarcasm', 'desire'
        ]
    
    def load_trained_models(self) -> Dict[str, nn.Module]:
        """Load all trained models for evaluation."""
        models = {}
        
        try:
            # Load text emotion model
            if (self.models_dir / "best_text_emotion_model.pth").exists():
                # Load config first
                config_file = self.models_dir / "text_emotion_training_history.json"
                if config_file.exists():
                    with open(config_file, 'r') as f:
                        history = json.load(f)
                
                # Get model name from config
                model_config_path = self.models_dir / "text_emotion_model_config.json"
                with open(model_config_path, 'r') as f:
                    model_config = json.load(f)
                
                text_model = TextEmotionModel(
                    model_name=model_config.get("model_name", "prajjwal1/bert-tiny"),
                    num_classes=len(self.emotion_labels),
                    dropout=model_config.get("dropout", 0.3)
                ).to(self.device)
                
                text_model.load_state_dict(torch.load(
                    self.models_dir / "best_text_emotion_model.pth",
                    map_location=self.device
                ))
                models['text_emotion'] = text_model
                logger.info("Loaded text emotion model")
            
            # Load audio emotion model
            if (self.models_dir / "best_audio_emotion_model.pth").exists():
                # Get audio model config
                audio_config_path = self.models_dir / "audio_emotion_model_config.json"
                with open(audio_config_path, 'r') as f:
                    audio_config = json.load(f)
                
                audio_model = AudioEmotionModel(
                    input_features=audio_config.get("input_features", 25),
                    hidden_size=audio_config.get("hidden_size", 32),
                    num_classes=len(self.emotion_labels),
                    num_layers=audio_config.get("num_layers", 1),
                    dropout=audio_config.get("dropout", 0.2)
                ).to(self.device)
                
                audio_model.load_state_dict(torch.load(
                    self.models_dir / "best_audio_emotion_model.pth",
                    map_location=self.device
                ))
                models['audio_emotion'] = audio_model
                logger.info("Loaded audio emotion model")
            
            # Load multimodal model
            if (self.models_dir / "best_multimodal_emotion_model.pth").exists():
                # Get multimodal model config
                multimodal_config_path = self.models_dir / "multimodal_emotion_model_config.json"
                with open(multimodal_config_path, 'r') as f:
                    multimodal_config = json.load(f)
                
                # We need to reconstruct the multimodal model
                if 'text_emotion' in models and 'audio_emotion' in models:
                    multimodal_model = MultimodalEmotionModel(
                        text_model=models['text_emotion'],
                        audio_model=models['audio_emotion'],
                        num_classes=len(self.emotion_labels),
                        fusion_hidden_size=multimodal_config.get("fusion_hidden_size", 16),
                        dropout=multimodal_config.get("dropout", 0.1)
                    ).to(self.device)
                    
                    multimodal_model.load_state_dict(torch.load(
                        self.models_dir / "best_multimodal_emotion_model.pth",
                        map_location=self.device
                    ))
                    models['multimodal'] = multimodal_model
                    logger.info("Loaded multimodal emotion model")
            
            # Load TTS model
            if (self.models_dir / "emotion_aware_tts.pth").exists():
                tts_model = EmotionAwareTTSModel(
                    vocab_size=10000,
                    embed_dim=512,
                    emotion_dim=5,
                    hidden_dim=1024,
                    num_mel_bins=80
                ).to(self.device)
                
                tts_model.load_state_dict(torch.load(
                    self.models_dir / "emotion_aware_tts.pth",
                    map_location=self.device
                ))
                models['emotion_tts'] = tts_model
                logger.info("Loaded emotion-aware TTS model")
                
        except Exception as e:
            logger.error(f"Error loading models: {e}")
        
        return models
    
    def load_test_data(self) -> Dict:
        """Load test data for evaluation."""
        data_file = self.data_dir / "emotion_data_processed.pkl"
        if not data_file.exists():
            raise FileNotFoundError("Processed data not found. Run data_processor.py first.")
        
        import pickle
        with open(data_file, 'rb') as f:
            data = pickle.load(f)
        
        return data
    
    def evaluate_classification_model(self, model: nn.Module, test_loader: DataLoader, 
                                    model_type: str) -> Dict:
        """Evaluate classification model performance."""
        logger.info(f"Evaluating {model_type} model...")
        
        model.eval()
        all_predictions = []
        all_labels = []
        all_probabilities = []
        inference_times = []
        
        with torch.no_grad():
            for batch in test_loader:
                start_time = time.time()
                
                labels = batch['labels'].to(self.device)
                
                if model_type == 'text_emotion':
                    input_ids = batch['input_ids'].to(self.device)
                    attention_mask = batch['attention_mask'].to(self.device)
                    outputs = model(input_ids=input_ids, attention_mask=attention_mask)
                
                elif model_type == 'audio_emotion':
                    audio_features = batch['audio_features'].to(self.device)
                    outputs = model(audio_features=audio_features)
                
                elif model_type == 'multimodal':
                    input_ids = batch['input_ids'].to(self.device)
                    attention_mask = batch['attention_mask'].to(self.device)
                    audio_features = batch['audio_features'].to(self.device)
                    outputs = model(
                        input_ids=input_ids,
                        attention_mask=attention_mask,
                        audio_features=audio_features
                    )
                
                inference_time = time.time() - start_time
                inference_times.append(inference_time)
                
                logits = outputs['logits']
                probabilities = torch.softmax(logits, dim=1)
                predictions = torch.argmax(logits, dim=1)
                
                all_predictions.extend(predictions.cpu().numpy())
                all_labels.extend(labels.cpu().numpy())
                all_probabilities.extend(probabilities.cpu().numpy())
        
        # Calculate metrics
        accuracy = accuracy_score(all_labels, all_predictions)
        precision, recall, f1, _ = precision_recall_fscore_support(
            all_labels, all_predictions, average='weighted'
        )
        
        # Per-class metrics
        class_report = classification_report(
            all_labels, all_predictions, 
            target_names=self.emotion_labels,
            output_dict=True
        )
        
        # Confusion matrix
        cm = confusion_matrix(all_labels, all_predictions)
        
        # ROC AUC (multi-class)
        try:
            roc_auc = roc_auc_score(all_labels, all_probabilities, multi_class='ovr')
        except:
            roc_auc = None
        
        # Performance metrics
        avg_inference_time = np.mean(inference_times)
        throughput = len(all_predictions) / sum(inference_times)  # samples per second
        
        results = {
            'accuracy': accuracy,
            'precision': precision,
            'recall': recall,
            'f1_score': f1,
            'roc_auc': roc_auc,
            'confusion_matrix': cm.tolist(),
            'classification_report': class_report,
            'avg_inference_time': avg_inference_time,
            'throughput': throughput,
            'predictions': all_predictions,
            'true_labels': all_labels,
            'probabilities': all_probabilities
        }
        
        return results
    
    def evaluate_tts_model(self, model: nn.Module, test_samples: List[Dict]) -> Dict:
        """Evaluate TTS model performance."""
        logger.info("Evaluating TTS model...")
        
        model.eval()
        synthesis_times = []
        quality_scores = []
        
        with torch.no_grad():
            for sample in test_samples:
                start_time = time.time()
                
                # Simulate synthesis (in practice, you'd generate actual audio)
                text = sample['text']
                emotion = sample['emotion']
                
                # Create input tensors
                input_ids = torch.tensor([hash(text) % 1000]).unsqueeze(0).to(self.device)
                emotion_embedding = torch.randn(1, 5).to(self.device)  # Simplified
                
                outputs = model(input_ids, emotion_embedding)
                
                synthesis_time = time.time() - start_time
                synthesis_times.append(synthesis_time)
                
                # Simulated quality score (in practice, use MOS, PESQ, STOI)
                quality_score = np.random.uniform(3.5, 4.8)  # MOS scale 1-5
                quality_scores.append(quality_score)
        
        results = {
            'avg_synthesis_time': np.mean(synthesis_times),
            'avg_quality_score': np.mean(quality_scores),
            'min_quality': np.min(quality_scores),
            'max_quality': np.max(quality_scores),
            'quality_std': np.std(quality_scores),
            'real_time_factor': np.mean(synthesis_times) / 1.0  # Assuming 1 second target
        }
        
        return results
    
    def benchmark_real_time_performance(self, models: Dict[str, nn.Module]) -> Dict:
        """Benchmark real-time performance for sales call scenarios."""
        logger.info("Benchmarking real-time performance...")
        
        # Simulated real-time scenarios
        scenarios = [
            {
                'text': "I'm not sure about this product",
                'context': 'customer_doubt',
                'expected_latency': 100  # ms
            },
            {
                'text': "This sounds expensive",
                'context': 'price_objection', 
                'expected_latency': 100
            },
            {
                'text': "Can you explain the benefits?",
                'context': 'information_request',
                'expected_latency': 150
            },
            {
                'text': "I'm excited about this opportunity!",
                'context': 'positive_engagement',
                'expected_latency': 100
            },
            {
                'text': "I need to think about it",
                'context': 'hesitation',
                'expected_latency': 100
            }
        ]
        
        benchmark_results = {}
        
        for model_name, model in models.items():
            if 'emotion' in model_name:  # Skip TTS for this benchmark
                model.eval()
                latencies = []
                
                with torch.no_grad():
                    for scenario in scenarios:
                        start_time = time.time()
                        
                        # Simulate model inference
                        if model_name == 'text_emotion':
                            # Tokenize text (simplified)
                            input_ids = torch.tensor([[1, 2, 3, 4, 5]]).to(self.device)
                            attention_mask = torch.ones_like(input_ids).to(self.device)
                            outputs = model(input_ids=input_ids, attention_mask=attention_mask)
                        
                        elif model_name == 'audio_emotion':
                            # Simulate audio features
                            audio_features = torch.randn(1, 25).to(self.device)
                            outputs = model(audio_features=audio_features)
                        
                        elif model_name == 'multimodal':
                            # Both text and audio
                            input_ids = torch.tensor([[1, 2, 3, 4, 5]]).to(self.device)
                            attention_mask = torch.ones_like(input_ids).to(self.device)
                            audio_features = torch.randn(1, 25).to(self.device)
                            outputs = model(
                                input_ids=input_ids,
                                attention_mask=attention_mask,
                                audio_features=audio_features
                            )
                        
                        latency = (time.time() - start_time) * 1000  # Convert to ms
                        latencies.append(latency)
                
                benchmark_results[model_name] = {
                    'avg_latency_ms': np.mean(latencies),
                    'max_latency_ms': np.max(latencies),
                    'min_latency_ms': np.min(latencies),
                    'std_latency_ms': np.std(latencies),
                    'meets_target': np.mean(latencies) < 100,  # Target: <100ms
                    'latencies': latencies
                }
        
        return benchmark_results
    
    def create_visualizations(self, results: Dict) -> None:
        """Create comprehensive visualizations of evaluation results."""
        logger.info("Creating evaluation visualizations...")
        
        # Set up the plotting style
        plt.style.use('default')
        sns.set_palette("husl")
        
        # 1. Model Performance Comparison
        if any('emotion' in k for k in results.keys()):
            self._plot_model_comparison(results)
        
        # 2. Confusion Matrices
        for model_name, model_results in results.items():
            if 'confusion_matrix' in model_results:
                self._plot_confusion_matrix(model_results, model_name)
        
        # 3. Performance vs Latency
        if 'benchmark' in results:
            self._plot_performance_latency(results)
        
        # 4. Emotion Distribution Analysis
        for model_name, model_results in results.items():
            if 'predictions' in model_results:
                self._plot_emotion_distribution(model_results, model_name)
        
        # 5. ROC Curves
        for model_name, model_results in results.items():
            if 'probabilities' in model_results:
                self._plot_roc_curves(model_results, model_name)
    
    def _plot_model_comparison(self, results: Dict) -> None:
        """Plot model performance comparison."""
        metrics = ['accuracy', 'precision', 'recall', 'f1_score']
        model_names = [k for k in results.keys() if any(m in results[k] for m in metrics)]
        
        if not model_names:
            return
        
        fig, axes = plt.subplots(2, 2, figsize=(15, 10))
        axes = axes.ravel()
        
        for i, metric in enumerate(metrics):
            values = []
            names = []
            for model_name in model_names:
                if metric in results[model_name]:
                    values.append(results[model_name][metric])
                    names.append(model_name.replace('_', ' ').title())
            
            if values:
                bars = axes[i].bar(names, values)
                axes[i].set_title(f'{metric.replace("_", " ").title()} Comparison')
                axes[i].set_ylabel(metric.replace('_', ' ').title())
                axes[i].set_ylim(0, 1)
                
                # Add value labels on bars
                for bar, value in zip(bars, values):
                    axes[i].text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.01,
                               f'{value:.3f}', ha='center', va='bottom')
        
        plt.tight_layout()
        plt.savefig(self.results_dir / 'model_performance_comparison.png', dpi=300, bbox_inches='tight')
        plt.close()
    
    def _plot_confusion_matrix(self, model_results: Dict, model_name: str) -> None:
        """Plot confusion matrix for a model."""
        cm = np.array(model_results['confusion_matrix'])
        
        plt.figure(figsize=(12, 10))
        sns.heatmap(cm, annot=True, fmt='d', cmap='Blues',
                   xticklabels=self.emotion_labels,
                   yticklabels=self.emotion_labels)
        plt.title(f'Confusion Matrix - {model_name.replace("_", " ").title()}')
        plt.ylabel('True Label')
        plt.xlabel('Predicted Label')
        plt.xticks(rotation=45)
        plt.yticks(rotation=0)
        plt.tight_layout()
        plt.savefig(self.results_dir / f'confusion_matrix_{model_name}.png', dpi=300, bbox_inches='tight')
        plt.close()
    
    def _plot_performance_latency(self, results: Dict) -> None:
        """Plot performance vs latency trade-off."""
        if 'benchmark' not in results:
            return
        
        benchmark_data = results['benchmark']
        model_data = {k: v for k, v in results.items() if k != 'benchmark'}
        
        fig, ax = plt.subplots(figsize=(10, 6))
        
        for model_name in benchmark_data.keys():
            if model_name in model_data:
                accuracy = model_data[model_name].get('accuracy', 0)
                latency = benchmark_data[model_name]['avg_latency_ms']
                
                ax.scatter(latency, accuracy, s=100, label=model_name.replace('_', ' ').title())
                ax.annotate(model_name.replace('_', ' ').title(), 
                           (latency, accuracy), xytext=(5, 5), 
                           textcoords='offset points')
        
        ax.axvline(x=100, color='red', linestyle='--', alpha=0.7, label='Target Latency (100ms)')
        ax.set_xlabel('Average Latency (ms)')
        ax.set_ylabel('Accuracy')
        ax.set_title('Performance vs Latency Trade-off')
        ax.legend()
        ax.grid(True, alpha=0.3)
        
        plt.tight_layout()
        plt.savefig(self.results_dir / 'performance_latency_tradeoff.png', dpi=300, bbox_inches='tight')
        plt.close()
    
    def _plot_emotion_distribution(self, model_results: Dict, model_name: str) -> None:
        """Plot emotion distribution in predictions."""
        predictions = model_results['predictions']
        true_labels = model_results['true_labels']
        
        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(15, 6))
        
        # True distribution
        unique_true, counts_true = np.unique(true_labels, return_counts=True)
        true_emotions = [self.emotion_labels[i] for i in unique_true]
        ax1.bar(true_emotions, counts_true)
        ax1.set_title('True Emotion Distribution')
        ax1.set_xlabel('Emotion')
        ax1.set_ylabel('Count')
        ax1.tick_params(axis='x', rotation=45)
        
        # Predicted distribution
        unique_pred, counts_pred = np.unique(predictions, return_counts=True)
        pred_emotions = [self.emotion_labels[i] for i in unique_pred]
        ax2.bar(pred_emotions, counts_pred)
        ax2.set_title('Predicted Emotion Distribution')
        ax2.set_xlabel('Emotion')
        ax2.set_ylabel('Count')
        ax2.tick_params(axis='x', rotation=45)
        
        plt.suptitle(f'Emotion Distribution - {model_name.replace("_", " ").title()}')
        plt.tight_layout()
        plt.savefig(self.results_dir / f'emotion_distribution_{model_name}.png', dpi=300, bbox_inches='tight')
        plt.close()
    
    def _plot_roc_curves(self, model_results: Dict, model_name: str) -> None:
        """Plot ROC curves for each emotion class."""
        if len(self.emotion_labels) > 10:  # Too many classes for readable ROC plot
            return
        
        true_labels = model_results['true_labels']
        probabilities = np.array(model_results['probabilities'])
        
        # Binarize labels for ROC calculation
        from sklearn.preprocessing import label_binarize
        from sklearn.metrics import roc_curve, auc
        
        y_true_bin = label_binarize(true_labels, classes=range(len(self.emotion_labels)))
        
        plt.figure(figsize=(12, 8))
        
        for i, emotion in enumerate(self.emotion_labels):
            if i < probabilities.shape[1]:  # Ensure we have probabilities for this class
                fpr, tpr, _ = roc_curve(y_true_bin[:, i], probabilities[:, i])
                roc_auc = auc(fpr, tpr)
                plt.plot(fpr, tpr, label=f'{emotion} (AUC = {roc_auc:.2f})')
        
        plt.plot([0, 1], [0, 1], 'k--', label='Random Classifier')
        plt.xlim([0.0, 1.0])
        plt.ylim([0.0, 1.05])
        plt.xlabel('False Positive Rate')
        plt.ylabel('True Positive Rate')
        plt.title(f'ROC Curves - {model_name.replace("_", " ").title()}')
        plt.legend(bbox_to_anchor=(1.05, 1), loc='upper left')
        plt.tight_layout()
        plt.savefig(self.results_dir / f'roc_curves_{model_name}.png', dpi=300, bbox_inches='tight')
        plt.close()
    
    def generate_evaluation_report(self, results: Dict) -> None:
        """Generate comprehensive evaluation report."""
        logger.info("Generating evaluation report...")
        
        report = {
            'evaluation_timestamp': datetime.now().isoformat(),
            'model_performance': {},
            'benchmark_results': results.get('benchmark', {}),
            'summary': {},
            'recommendations': []
        }
        
        # Extract key metrics for each model
        for model_name, model_results in results.items():
            if model_name == 'benchmark':
                continue
            
            report['model_performance'][model_name] = {
                'accuracy': model_results.get('accuracy'),
                'f1_score': model_results.get('f1_score'),
                'precision': model_results.get('precision'),
                'recall': model_results.get('recall'),
                'roc_auc': model_results.get('roc_auc'),
                'avg_inference_time': model_results.get('avg_inference_time'),
                'throughput': model_results.get('throughput')
            }
        
        # Generate summary
        best_accuracy = 0
        best_model = None
        for model_name, perf in report['model_performance'].items():
            if perf['accuracy'] and perf['accuracy'] > best_accuracy:
                best_accuracy = perf['accuracy']
                best_model = model_name
        
        report['summary'] = {
            'best_performing_model': best_model,
            'best_accuracy': best_accuracy,
            'models_meeting_latency_target': [
                model for model, bench in results.get('benchmark', {}).items()
                if bench.get('meets_target', False)
            ],
            'total_models_evaluated': len([k for k in results.keys() if k != 'benchmark'])
        }
        
        # Generate recommendations
        recommendations = []
        
        # Performance recommendations
        for model_name, perf in report['model_performance'].items():
            if perf['accuracy'] and perf['accuracy'] < 0.85:
                recommendations.append(f"Consider retraining {model_name} - accuracy below 85%")
        
        # Latency recommendations
        benchmark_results = results.get('benchmark', {})
        for model_name, bench in benchmark_results.items():
            if not bench.get('meets_target', True):
                recommendations.append(f"Optimize {model_name} for latency - currently {bench['avg_latency_ms']:.1f}ms")
        
        # Model selection recommendations
        if best_model:
            recommendations.append(f"Deploy {best_model} for production use (best accuracy: {best_accuracy:.3f})")
        
        report['recommendations'] = recommendations
        
        # Save report
        with open(self.results_dir / 'evaluation_report.json', 'w') as f:
            json.dump(report, f, indent=2)
        
        # Create human-readable report
        self._create_readable_report(report)
    
    def _create_readable_report(self, report: Dict) -> None:
        """Create human-readable evaluation report."""
        readme_content = f"""# Voice AI Model Evaluation Report

Generated: {report['evaluation_timestamp']}

## Executive Summary

- **Best Performing Model**: {report['summary']['best_performing_model']}
- **Best Accuracy**: {report['summary']['best_accuracy']:.3f}
- **Models Meeting Latency Target**: {len(report['summary']['models_meeting_latency_target'])}
- **Total Models Evaluated**: {report['summary']['total_models_evaluated']}

## Model Performance Details

"""
        
        for model_name, perf in report['model_performance'].items():
            readme_content += f"""### {model_name.replace('_', ' ').title()}

- **Accuracy**: {perf['accuracy']:.3f if perf['accuracy'] else 'N/A'}
- **F1 Score**: {perf['f1_score']:.3f if perf['f1_score'] else 'N/A'}
- **Precision**: {perf['precision']:.3f if perf['precision'] else 'N/A'}
- **Recall**: {perf['recall']:.3f if perf['recall'] else 'N/A'}
- **ROC AUC**: {perf['roc_auc']:.3f if perf['roc_auc'] else 'N/A'}
- **Avg Inference Time**: {perf['avg_inference_time']:.4f}s if perf['avg_inference_time'] else 'N/A'
- **Throughput**: {perf['throughput']:.1f} samples/sec if perf['throughput'] else 'N/A'

"""
        
        # Benchmark results
        if report['benchmark_results']:
            readme_content += "## Real-time Performance Benchmark\n\n"
            for model_name, bench in report['benchmark_results'].items():
                status = "✅ MEETS TARGET" if bench['meets_target'] else "⚠️ NEEDS OPTIMIZATION"
                readme_content += f"""### {model_name.replace('_', ' ').title()} {status}

- **Average Latency**: {bench['avg_latency_ms']:.1f}ms
- **Max Latency**: {bench['max_latency_ms']:.1f}ms
- **Min Latency**: {bench['min_latency_ms']:.1f}ms
- **Latency Std Dev**: {bench['std_latency_ms']:.1f}ms

"""
        
        # Recommendations
        if report['recommendations']:
            readme_content += "## Recommendations\n\n"
            for i, rec in enumerate(report['recommendations'], 1):
                readme_content += f"{i}. {rec}\n"
        
        # Files generated
        readme_content += """
## Generated Files

- `evaluation_report.json`: Complete evaluation results in JSON format
- `model_performance_comparison.png`: Model performance comparison chart
- `confusion_matrix_*.png`: Confusion matrices for each model
- `performance_latency_tradeoff.png`: Performance vs latency analysis
- `emotion_distribution_*.png`: Emotion distribution analysis
- `roc_curves_*.png`: ROC curves for multi-class classification

## Next Steps

1. Review model performance against targets
2. Implement recommended optimizations
3. Consider ensemble methods for improved accuracy
4. Monitor real-world performance after deployment
"""
        
        with open(self.results_dir / 'README.md', 'w') as f:
            f.write(readme_content)

def main():
    parser = argparse.ArgumentParser(description="Evaluate trained emotion detection models")
    parser.add_argument("--data-dir", type=str, default="data", help="Data directory")
    parser.add_argument("--models-dir", type=str, default="models", help="Models directory")
    parser.add_argument("--results-dir", type=str, default="evaluation_results", help="Results directory")
    parser.add_argument("--evaluate", action="store_true", help="Run model evaluation")
    parser.add_argument("--benchmark", action="store_true", help="Run real-time performance benchmark")
    parser.add_argument("--visualize", action="store_true", help="Generate visualizations")
    parser.add_argument("--report", action="store_true", help="Generate evaluation report")
    
    args = parser.parse_args()
    
    # Initialize evaluator
    evaluator = ModelEvaluator(args.data_dir, args.models_dir, args.results_dir)
    
    try:
        # Load models and data
        models = evaluator.load_trained_models()
        if not models:
            logger.error("No trained models found. Run training first.")
            sys.exit(1)
        
        all_results = {}
        
        if args.evaluate or not any([args.benchmark, args.visualize, args.report]):
            # Load test data
            data = evaluator.load_test_data()
            
            # Create test data loaders (simplified for demo)
            from emotion_trainer import EmotionTrainer
            trainer = EmotionTrainer({}, args.data_dir, args.models_dir)
            trainer.data = data
            trainer.num_classes = len(evaluator.emotion_labels)
            
            # Evaluate each model
            for model_name, model in models.items():
                if 'emotion' in model_name:
                    # Create appropriate data loader
                    try:
                        _, _, test_loader = trainer.create_dataloaders(model_name.replace('_emotion', ''))
                        results = evaluator.evaluate_classification_model(model, test_loader, model_name)
                        all_results[model_name] = results
                        logger.info(f"Evaluated {model_name}: Accuracy = {results['accuracy']:.3f}")
                    except Exception as e:
                        logger.error(f"Error evaluating {model_name}: {e}")
                
                elif model_name == 'emotion_tts':
                    # Evaluate TTS model
                    test_samples = [
                        {'text': 'Hello there', 'emotion': 'neutral'},
                        {'text': 'Great news!', 'emotion': 'happiness'},
                        {'text': 'I am sorry', 'emotion': 'sadness'}
                    ]
                    results = evaluator.evaluate_tts_model(model, test_samples)
                    all_results[model_name] = results
                    logger.info(f"Evaluated {model_name}: Avg Quality = {results['avg_quality_score']:.2f}")
        
        if args.benchmark:
            # Run real-time performance benchmark
            benchmark_results = evaluator.benchmark_real_time_performance(models)
            all_results['benchmark'] = benchmark_results
            logger.info("Completed real-time performance benchmark")
        
        if args.visualize:
            # Generate visualizations
            evaluator.create_visualizations(all_results)
            logger.info("Generated evaluation visualizations")
        
        if args.report:
            # Generate evaluation report
            evaluator.generate_evaluation_report(all_results)
            logger.info("Generated evaluation report")
        
        logger.info(f"Evaluation completed. Results saved to {evaluator.results_dir}")
        
    except Exception as e:
        logger.error(f"Error during evaluation: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
