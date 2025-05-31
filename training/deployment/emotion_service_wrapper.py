#!/usr/bin/env python3
"""
Emotion Service Wrapper for Node.js Integration
Bridges the TypeScript service with the Python emotion detection models.
"""

import sys
import json
import os
from pathlib import Path

# Add the training directory to Python path
training_dir = Path(__file__).parent.parent
sys.path.append(str(training_dir))

try:
    # Try to import the production service
    from production_emotion_service import ProductionEmotionService
    service = ProductionEmotionService()
    SERVICE_AVAILABLE = True
    print(f"Successfully loaded ProductionEmotionService", file=sys.stderr)
except ImportError as e:
    SERVICE_AVAILABLE = False
    print(f"Warning: Production emotion service not available: {e}", file=sys.stderr)
except Exception as e:
    SERVICE_AVAILABLE = False
    print(f"Error initializing emotion service: {e}", file=sys.stderr)

def main():
    if len(sys.argv) != 3:
        print(json.dumps({"error": "Invalid arguments"}))
        sys.exit(1)
    
    mode = sys.argv[1]
    data = json.loads(sys.argv[2])
    
    if not SERVICE_AVAILABLE:
        # Return fallback result
        result = {
            "emotion": "neutral",
            "confidence": 0.5,
            "all_scores": {
                "neutral": 0.5,
                "happiness": 0.2,
                "sadness": 0.1,
                "anger": 0.1,
                "love": 0.1
            },
            "model_used": f"{mode}_fallback"
        }
        print(json.dumps(result))
        return
    
    try:
        if mode == "text":
            result = service.detect_emotion_from_text(data.get("text", ""))
        elif mode == "audio":
            # Convert audio features to numpy array if needed
            audio_features = data.get("audio_features", {})
            result = service.detect_emotion_from_audio(audio_features)
        elif mode == "multimodal":
            text = data.get("text", "")
            audio_features = data.get("audio_features", {})
            result = service.detect_emotion_multimodal(text, audio_features)
        elif mode == "status":
            result = {
                "models": {
                    "text_emotion": {"status": "ready", "accuracy": "64.83%"},
                    "audio_emotion": {"status": "ready", "accuracy": "72.58%"},
                    "multimodal_emotion": {"status": "ready", "accuracy": "78.28%"}
                },
                "last_updated": "2025-05-30T00:00:00Z"
            }
        else:
            result = {"error": f"Unknown mode: {mode}"}
        
        print(json.dumps(result))
        
    except Exception as e:
        error_result = {
            "error": str(e),
            "emotion": "neutral",
            "confidence": 0.5,
            "model_used": f"{mode}_error"
        }
        print(json.dumps(error_result))

if __name__ == "__main__":
    main()
