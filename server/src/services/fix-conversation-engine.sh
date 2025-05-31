#!/bin/bash

# Fix conversation engine service by replacing the duplicate updateApiKeys method
sed -i.bak '/public updateApiKeys(elevenLabsApiKey?: string, openAIApiKey?: string, anthropicApiKey?: string, googleSpeechKey?: string): void {$/,/  \/\/ Update API keys for all integrated services/d' /Users/dhruvsmac/Desktop/Project\ Call/server/src/services/conversationEngineService.ts

echo "Fixed conversationEngineService.ts"
