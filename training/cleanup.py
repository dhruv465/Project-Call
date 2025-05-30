#!/usr/bin/env python3
"""
Cleanup script for emotion detection training files
Removes unnecessary files after successful training and deployment
"""

import os
import shutil
import logging
from pathlib import Path
import datetime
import argparse

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def cleanup_training_files(dry_run=False):
    """
    Cleanup unnecessary training files as per README specifications
    """
    base_dir = Path(__file__).parent.absolute()
    
    # Files/directories to remove
    to_remove = [
        # Raw training data (except for processed data)
        Path(base_dir, "data", "raw"),
        # Intermediate model checkpoints (keep only the best models)
        Path(base_dir, "models", "text_emotion_model.pth"),
        Path(base_dir, "models", "audio_emotion_model.pth"),
        Path(base_dir, "models", "multimodal_emotion_model.pth"),
        # Cache files
        Path(base_dir, "cache"),
        # Temporary audio files
        Path(base_dir, "__pycache__"),
    ]
    
    # Old log files (older than 30 days)
    log_dir = Path(base_dir, "logs")
    if log_dir.exists():
        thirty_days_ago = datetime.datetime.now() - datetime.timedelta(days=30)
        for log_file in log_dir.glob("*.log"):
            file_time = datetime.datetime.fromtimestamp(log_file.stat().st_mtime)
            if file_time < thirty_days_ago:
                to_remove.append(log_file)
    
    # Process removal
    removed = 0
    skipped = 0
    for item in to_remove:
        if item.exists():
            if dry_run:
                logger.info(f"Would remove: {item}")
                removed += 1
            else:
                try:
                    if item.is_dir():
                        shutil.rmtree(item)
                    else:
                        item.unlink()
                    logger.info(f"Removed: {item}")
                    removed += 1
                except Exception as e:
                    logger.error(f"Failed to remove {item}: {e}")
                    skipped += 1
        else:
            skipped += 1
    
    logger.info(f"Cleanup complete. Removed: {removed}, Skipped: {skipped}")
    
    # List files to keep
    logger.info("Required files kept:")
    logger.info(" - Final trained models (best_*.pth)")
    logger.info(" - Model configuration files (*.json)")
    logger.info(" - Performance benchmarks (evaluation_results/)")
    logger.info(" - Integration scripts (deployment/)")

def main():
    parser = argparse.ArgumentParser(description="Cleanup unnecessary training files")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be deleted without actually deleting")
    args = parser.parse_args()
    
    cleanup_training_files(dry_run=args.dry_run)

if __name__ == "__main__":
    main()
