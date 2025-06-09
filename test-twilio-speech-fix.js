#!/usr/bin/env node

/**
 * Test script to fix speech timeout issue with Twilio enhanced speech model
 * This script verifies that when using enhanced speech model, we set a positive speechTimeout value
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

async function fixTwilioSpeechTimeout() {
  console.log(`${colors.blue}🔍 Starting Twilio Speech Timeout Fix Script${colors.reset}`);
  console.log(`${colors.yellow}⚠️  Issue: Enhanced speech model requires positive speechTimeout value${colors.reset}`);
  
  // Main webhookHandlers.ts file that needs fixing
  const webhookHandlersPath = path.resolve(process.cwd(), 'server/src/services/webhookHandlers.ts');
  
  if (!fs.existsSync(webhookHandlersPath)) {
    console.log(`${colors.red}❌ Error: Could not find webhook handlers file at ${webhookHandlersPath}${colors.reset}`);
    return;
  }
  
  console.log(`${colors.green}✅ Found webhook handlers file${colors.reset}`);
  
  // Read the file content
  let content = fs.readFileSync(webhookHandlersPath, 'utf8');
  
  // Count occurrences before fixing
  const initialOccurrences = (content.match(/speechModel: 'enhanced',\s+speechTimeout: 'auto'/g) || []).length;
  
  console.log(`${colors.yellow}🔍 Found ${initialOccurrences} instances of incorrect configuration${colors.reset}`);
  
  if (initialOccurrences === 0) {
    console.log(`${colors.green}✅ No issues found! The code appears to be already fixed.${colors.reset}`);
    return;
  }
  
  // Replace all instances of the problematic pattern
  const fixedContent = content.replace(
    /speechModel: 'enhanced',\s+speechTimeout: 'auto'/g, 
    "speechModel: 'enhanced',\n      speechTimeout: 3"
  );
  
  // Count occurrences after fixing
  const remainingOccurrences = (fixedContent.match(/speechModel: 'enhanced',\s+speechTimeout: 'auto'/g) || []).length;
  
  // Only write the file if we actually made changes
  if (remainingOccurrences < initialOccurrences) {
    // Backup the original file
    const backupPath = `${webhookHandlersPath}.bak`;
    fs.writeFileSync(backupPath, content);
    console.log(`${colors.blue}📦 Created backup at ${backupPath}${colors.reset}`);
    
    // Write the fixed content
    fs.writeFileSync(webhookHandlersPath, fixedContent);
    
    console.log(`${colors.green}✅ Fixed ${initialOccurrences - remainingOccurrences} instances${colors.reset}`);
    console.log(`${colors.cyan}ℹ️  Enhanced speech model now uses speechTimeout: 3 (seconds)${colors.reset}`);
  } else {
    console.log(`${colors.red}❌ No changes were made. Fix may have failed.${colors.reset}`);
  }
  
  // Look for other potential files that might need fixing
  console.log(`${colors.blue}🔍 Scanning for other files that might need fixing...${colors.reset}`);
  
  try {
    const grepOutput = execSync(`grep -r "speechModel: 'enhanced'" --include="*.ts" --include="*.js" ${process.cwd()} | grep -v "webhookHandlers.ts"`, { encoding: 'utf8' });
    console.log(`${colors.yellow}⚠️  Found other files that may need review:${colors.reset}`);
    console.log(grepOutput);
  } catch (error) {
    // If grep doesn't find anything, it returns non-zero exit code
    console.log(`${colors.green}✅ No other files found with potential issues${colors.reset}`);
  }
  
  console.log(`${colors.green}🎉 Fix script completed!${colors.reset}`);
  console.log(`${colors.cyan}ℹ️  Restart your server to apply the changes${colors.reset}`);
}

// Run the fix
fixTwilioSpeechTimeout().catch(error => {
  console.error(`${colors.red}❌ Error:${colors.reset}`, error);
});
