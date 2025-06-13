#!/bin/zsh

# setup-env.sh - A script to set up the development environment
# This script copies the .env.example to .env and installs git hooks

echo "🔧 Setting up your development environment..."

# Check if we're in the right directory
if [ ! -f "server/package.json" ]; then
  echo "❌ Error: This script must be run from the project root directory"
  exit 1
fi

# Copy .env.example to .env if it doesn't exist
if [ ! -f "server/.env" ]; then
  echo "📝 Creating .env file from template..."
  cp server/.env.example server/.env
  echo "✅ Created server/.env - PLEASE UPDATE WITH YOUR ACTUAL CREDENTIALS"
  echo "⚠️  The .env file contains placeholders that need to be replaced with real values"
else
  echo "ℹ️  server/.env already exists. Skipping creation."
fi

# Install git hooks
echo "🔄 Installing git hooks..."
mkdir -p .git/hooks
cp -f git-hooks/pre-commit .git/hooks/
chmod +x .git/hooks/pre-commit
echo "✅ Git hooks installed"

# Check node_modules
if [ ! -d "server/node_modules" ]; then
  echo "📦 server/node_modules not found. Running npm install..."
  cd server && npm install
  cd ..
fi

if [ ! -d "client/node_modules" ]; then
  echo "📦 client/node_modules not found. Running npm install..."
  cd client && npm install
  cd ..
fi

# Verify environment
echo ""
echo "🔍 Environment verification:"

if [ -f "server/.env" ]; then
  echo "✅ server/.env file exists"
else
  echo "❌ server/.env file is missing"
fi

if [ -x ".git/hooks/pre-commit" ]; then
  echo "✅ pre-commit hook is installed"
else
  echo "❌ pre-commit hook is not installed correctly"
fi

echo ""
echo "🎉 Setup complete! Remember to update your .env file with real credentials."
echo "⚠️  Never commit your .env file or any sensitive information to the repository."
echo ""
echo "✨ You're ready to start developing!"
