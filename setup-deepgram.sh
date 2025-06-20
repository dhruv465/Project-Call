#!/bin/bash

# Script to validate Deepgram API key and set up configuration
# Usage: ./setup-deepgram.sh [API_KEY]

# Terminal colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Deepgram Setup Script${NC}"
echo -e "${BLUE}====================${NC}\n"

# Check if API key is provided as an argument or set as environment variable
API_KEY=$1
if [ -z "$API_KEY" ]; then
  if [ -z "$DEEPGRAM_API_KEY" ]; then
    echo -e "${YELLOW}No API key provided as argument. Checking for environment variable...${NC}"
    
    # Prompt for API key if not found
    echo -e "${YELLOW}DEEPGRAM_API_KEY environment variable not found.${NC}"
    echo -n "Enter your Deepgram API key: "
    read API_KEY
    
    if [ -z "$API_KEY" ]; then
      echo -e "${RED}No API key provided. Exiting.${NC}"
      exit 1
    fi
    
    # Temporarily set environment variable
    export DEEPGRAM_API_KEY="$API_KEY"
  else
    echo -e "${GREEN}Using DEEPGRAM_API_KEY from environment.${NC}"
    API_KEY=$DEEPGRAM_API_KEY
  fi
fi

echo -e "\n${BLUE}Step 1: Validating Deepgram API Key${NC}"
echo -e "${YELLOW}Running validation script...${NC}\n"

# Run validation script
node deepgram-validate.js "$API_KEY"
VALIDATE_EXIT_CODE=$?

if [ $VALIDATE_EXIT_CODE -ne 0 ]; then
  echo -e "\n${RED}Validation failed. Please check your API key and try again.${NC}"
  exit 1
fi

echo -e "\n${BLUE}Step 2: Setting up Deepgram Configuration${NC}"
echo -n "Would you like to update the Deepgram configuration in the database? (y/N): "
read UPDATE_CONFIG

if [[ $UPDATE_CONFIG == "y" || $UPDATE_CONFIG == "Y" ]]; then
  echo -n "Enable auto-region selection for best performance? (Y/n): "
  read AUTO_REGION
  
  AUTO_REGION_FLAG=""
  if [[ $AUTO_REGION != "n" && $AUTO_REGION != "N" ]]; then
    AUTO_REGION_FLAG="--auto-region=true"
  fi
  
  echo -n "Enable fallback to Google Speech-to-Text? (Y/n): "
  read FALLBACK
  
  FALLBACK_FLAG="--fallback=true"
  if [[ $FALLBACK == "n" || $FALLBACK == "N" ]]; then
    FALLBACK_FLAG="--fallback=false"
  fi
  
  echo -e "\n${YELLOW}Running configuration setup script...${NC}\n"
  
  # Run configuration script
  node setup-deepgram-config.js --key="$API_KEY" $AUTO_REGION_FLAG $FALLBACK_FLAG
  CONFIG_EXIT_CODE=$?
  
  if [ $CONFIG_EXIT_CODE -ne 0 ]; then
    echo -e "\n${RED}Configuration setup failed.${NC}"
    exit 1
  fi
else
  echo -e "\n${YELLOW}Skipping configuration update.${NC}"
fi

echo -e "\n${GREEN}Deepgram setup complete!${NC}"
echo -e "${BLUE}To use Deepgram in your application:${NC}"
echo -e "1. Make sure the MongoDB configuration is updated (if you chose to update it)"
echo -e "2. Restart your application server to apply the new configuration"
echo -e "3. Monitor your logs for any Deepgram-related issues"

exit 0
