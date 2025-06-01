#!/bin/bash

echo "🚀 Deploying Voice AI Training Models to Production..."

# Create deployment directories
mkdir -p ../server/src/services/production
mkdir -p ../server/src/models/production

# Copy optimized models
echo "📦 Copying optimized models..."
cp deployment/models_config.json ../server/src/models/production/
cp deployment/production_emotion_service.py ../server/src/services/production/

# Copy integration files
echo "🔧 Installing integration components..."
cp deployment/enhanced_controller_integration.ts ../server/src/controllers/

# Install production dependencies
echo "📋 Installing production dependencies..."
cd ../server
npm install

# Restart services (if running)
echo "🔄 Restarting services..."
if pgrep -f "node.*server" > /dev/null; then
    echo "Restarting Node.js server..."
    pkill -f "node.*server"
    sleep 2
    npm start &
fi

echo "✅ Deployment completed successfully!"
echo "📊 Production models are now integrated with the Voice AI system"
echo "🔍 Monitor performance at: http://localhost:8000/api/lumina-outreach/model-status"

# Run integration tests
echo "🧪 Running integration tests..."
cd ../training
python test_integration.py

echo "🎉 Voice AI Training System is now live!"
