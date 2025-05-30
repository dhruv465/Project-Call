#!/bin/bash

echo "🧹 Cleaning up training artifacts..."

# Remove large training files but keep essential models
echo "Removing temporary training data..."
find data/ -name "*.pkl" -size +100M -delete 2>/dev/null
find data/ -name "*_temp*" -delete 2>/dev/null

# Remove old model checkpoints (keep only best models)
echo "Cleaning model checkpoints..."
find models/ -name "checkpoint_*" -delete 2>/dev/null
find models/ -name "*_epoch_*" -delete 2>/dev/null

# Remove training logs older than 30 days
echo "Cleaning old logs..."
find . -name "*.log" -mtime +30 -delete 2>/dev/null

# Compress evaluation results
echo "Archiving evaluation results..."
if [ -d "evaluation_results" ]; then
    tar -czf "evaluation_results_$(date +%Y%m%d).tar.gz" evaluation_results/
    rm -rf evaluation_results/
fi

# Keep essential files
echo "Essential files preserved:"
echo "  ✓ Best trained models (models/best_*.pth)"
echo "  ✓ Model configurations (models/*_config.json)"
echo "  ✓ Production deployment (deployment/)"
echo "  ✓ Requirements and documentation"

# Show disk space saved
SAVED_SPACE=$(du -sh data/ models/ 2>/dev/null | awk '{sum += $1} END {print sum}')
echo "💾 Disk space cleaned up: $SAVED_SPACE"

echo "✅ Cleanup completed!"
