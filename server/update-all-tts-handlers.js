// Script to update all instances of TTS handling with chunked audio support
const fs = require('fs');
const path = require('path');

// Path to the webhookHandlers file
const filePath = path.join(__dirname, 'src/services/webhookHandlers.ts');

// Read the file
let content = fs.readFileSync(filePath, 'utf8');

// Find all the occurrences of the TTS handling pattern
const ttsHandlingRegex = /if\s*\(\s*audioResult\.method\s*===\s*['"]tts['"]\s*\)\s*\{[^}]*twiml\.say\(\s*\{\s*voice\s*:\s*['"]alice['"]\s*,\s*language\s*:[^}]*\}\s*,\s*[^)]*\)\s*;\s*\}\s*else\s*\{/g;

const matches = content.match(ttsHandlingRegex);
if (matches && matches.length > 0) {
  console.log(`Found ${matches.length} TTS handling instances to update`);
  
  // Process each match
  matches.forEach((match, index) => {
    console.log(`Processing match ${index + 1}:`);
    console.log(match.substring(0, 100) + '...');
    
    // Extract the language parameter
    const langMatch = match.match(/language\s*:\s*([^,}]*)/);
    const langParam = langMatch ? langMatch[1].trim() : "'en-US'";
    
    // Extract the text parameter
    const textMatch = match.match(/\}\s*,\s*([^)]*)\)/);
    const textParam = textMatch ? textMatch[1].trim() : "errorMessage";
    
    // Determine language parameter for the handler function
    let handleLangParam = "'en'";
    if (langParam.includes('campaign.primaryLanguage')) {
      handleLangParam = 'campaign.primaryLanguage';
    } else if (langParam === "'hi-IN'") {
      handleLangParam = "'hi'";
    }
    
    // Create the replacement
    const replacement = `if (audioResult.method === 'tts') {
                // Check if this is a chunked audio request
                if (!handleChunkedAudioForTwiML(twiml, audioResult.url, ${handleLangParam})) {
                  // Use regular TTS fallback
                  twiml.say({ voice: 'alice', language: ${langParam} }, ${textParam});
                }
              } else {`;
    
    // Replace in the content
    content = content.replace(match, replacement);
  });
  
  // Write the updated file
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Updated all TTS handling in webhookHandlers.ts');
} else {
  console.log('No TTS handling instances found');
}
