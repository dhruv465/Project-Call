#!/usr/bin/env node

/**
 * Script to check all Twilio gather configurations in webhookHandlers.ts
 */

const fs = require('fs');
const path = require('path');

function inspectWebhookHandlers() {
  const webhookHandlersPath = path.resolve(process.cwd(), 'server/src/services/webhookHandlers.ts');
  
  if (!fs.existsSync(webhookHandlersPath)) {
    console.error(`File not found: ${webhookHandlersPath}`);
    return;
  }
  
  const content = fs.readFileSync(webhookHandlersPath, 'utf8');
  
  // Find all gather blocks
  const gatherRegex = /twiml\.gather\(\{([^}]+)\}\)/gs;
  const matches = content.matchAll(gatherRegex);
  
  const gatherBlocks = [];
  
  for (const match of matches) {
    const blockContent = match[1];
    
    // Extract the speechModel and speechTimeout values
    const speechModelMatch = blockContent.match(/speechModel:\s*['"]([^'"]+)['"]/);
    const speechTimeoutMatch = blockContent.match(/speechTimeout:\s*['"]?([^'",\s]+)['"]?/);
    
    const speechModel = speechModelMatch ? speechModelMatch[1] : null;
    const speechTimeout = speechTimeoutMatch ? speechTimeoutMatch[1] : null;
    
    // Add the relevant context lines around the match
    const startPos = Math.max(0, match.index - 100);
    const endPos = Math.min(content.length, match.index + match[0].length + 100);
    const context = content.substring(startPos, endPos);
    
    gatherBlocks.push({
      speechModel,
      speechTimeout,
      context,
      line: content.substring(0, match.index).split('\n').length
    });
  }
  
  console.log(`Found ${gatherBlocks.length} gather blocks:`);
  console.log('-------------');
  
  let problemsFound = 0;
  
  gatherBlocks.forEach((block, index) => {
    const isProblematic = block.speechModel === 'enhanced' && block.speechTimeout === 'auto';
    
    if (isProblematic) {
      problemsFound++;
    }
    
    console.log(`Block #${index + 1} (Line ${block.line}):`);
    console.log(`  speechModel: ${block.speechModel}`);
    console.log(`  speechTimeout: ${block.speechTimeout}`);
    console.log(`  ${isProblematic ? '❌ ISSUE: Enhanced model with auto timeout' : '✅ Configuration is valid'}`);
    console.log('-------------');
  });
  
  if (problemsFound > 0) {
    console.log(`❌ Found ${problemsFound} problematic configurations that need fixing.`);
  } else {
    console.log('✅ All gather blocks have valid configurations.');
  }
}

inspectWebhookHandlers();
