#!/bin/bash
# Voice AI Demo Test Script
# This script tests the Voice AI demo endpoints

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}==================================================${NC}"
echo -e "${BLUE}           Voice AI Demo Test Script              ${NC}"
echo -e "${BLUE}==================================================${NC}"

# Get auth token
echo -e "\n${YELLOW}Getting authentication token...${NC}"
TOKEN_RESPONSE=$(curl -s -X POST http://localhost:8000/api/users/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}')

TOKEN=$(echo $TOKEN_RESPONSE | grep -o '"token":"[^"]*' | sed 's/"token":"//')

if [ -z "$TOKEN" ]; then
  echo -e "${RED}Failed to get authentication token. Make sure the server is running and credentials are correct.${NC}"
  exit 1
else
  echo -e "${GREEN}Successfully obtained authentication token.${NC}"
fi

# Test 1: Get Voice AI Status
echo -e "\n${YELLOW}Test 1: Getting Voice AI Status...${NC}"
STATUS_RESPONSE=$(curl -s -X GET http://localhost:8000/api/voice-ai/demo/status \
  -H "Authorization: Bearer $TOKEN")

if echo $STATUS_RESPONSE | grep -q '"success":true'; then
  echo -e "${GREEN}✓ Voice AI status retrieved successfully${NC}"
  
  # Extract some info from the response
  MODEL_TRAINED=$(echo $STATUS_RESPONSE | grep -o '"modelTrained":[^,]*' | sed 's/"modelTrained"://')
  PERSONALITIES=$(echo $STATUS_RESPONSE | grep -o '"totalPersonalities":[^,]*' | sed 's/"totalPersonalities"://')
  
  echo -e "  - Model Trained: $MODEL_TRAINED"
  echo -e "  - Total Personalities: $PERSONALITIES"
else
  echo -e "${RED}✗ Failed to retrieve Voice AI status${NC}"
  echo $STATUS_RESPONSE
fi

# Test 2: Run Complete Demo
echo -e "\n${YELLOW}Test 2: Running Complete Voice AI Demo...${NC}"
echo -e "${BLUE}This might take some time. Please wait...${NC}"

DEMO_RESPONSE=$(curl -s -X POST http://localhost:8000/api/voice-ai/demo/run-complete \
  -H "Authorization: Bearer $TOKEN")

if echo $DEMO_RESPONSE | grep -q '"success":true'; then
  echo -e "${GREEN}✓ Voice AI demo ran successfully${NC}"
  
  # Extract summary info
  OVERALL_PERFORMANCE=$(echo $DEMO_RESPONSE | grep -o '"overallPerformance":[^,}]*' | sed 's/"overallPerformance"://')
  PERSONALITIES_TESTED=$(echo $DEMO_RESPONSE | grep -o '"personalitiesTested":[^,}]*' | sed 's/"personalitiesTested"://')
  EMOTION_TESTS=$(echo $DEMO_RESPONSE | grep -o '"emotionTestsPassed":[^,}]*' | sed 's/"emotionTestsPassed"://')
  
  echo -e "  - Overall Performance: $OVERALL_PERFORMANCE"
  echo -e "  - Personalities Tested: $PERSONALITIES_TESTED"
  echo -e "  - Emotion Tests Passed: $EMOTION_TESTS"
  
  echo -e "\n${GREEN}Demo completed successfully!${NC}"
else
  echo -e "${RED}✗ Failed to run Voice AI demo${NC}"
  echo $DEMO_RESPONSE
fi

echo -e "\n${BLUE}==================================================${NC}"
echo -e "${BLUE}          Voice AI Test Script Complete           ${NC}"
echo -e "${BLUE}==================================================${NC}"
