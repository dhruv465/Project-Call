#!/usr/bin/env node

/**
 * Script to directly fix the Twilio gather configuration issue
 */

const fs = require('fs');
const path = require('path');

function fixWebhookHandlers() {
  const webhookHandlersPath = path.resolve(process.cwd(), 'server/src/services/webhookHandlers.ts');
  
  if (!fs.existsSync(webhookHandlersPath)) {
    console.error(`File not found: ${webhookHandlersPath}`);
    return;
  }
  
  // Read the file content
  let content = fs.readFileSync(webhookHandlersPath, 'utf8');
  
  // Create a backup
  fs.writeFileSync(`${webhookHandlersPath}.backup`, content);
  console.log(`Created backup at ${webhookHandlersPath}.backup`);
  
  // Replace all problematic configurations
  const fixedContent = content.replace(
    /speechModel:\s*['"]enhanced['"],\s*speechTimeout:\s*['"]auto['"]/g,
    `speechModel: 'enhanced',\n      speechTimeout: 3 // Fixed value as enhanced model requires positive speechTimeout`
  );
  
  // Write the fixed content back
  fs.writeFileSync(webhookHandlersPath, fixedContent);
  
  // Check if any changes were made
  if (content !== fixedContent) {
    console.log(`✅ Successfully updated the file`);
  } else {
    console.log(`No changes were made to the file`);
  }
}

fixWebhookHandlers();
