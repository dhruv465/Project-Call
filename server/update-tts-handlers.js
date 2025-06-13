// Simple script to update all TTS handling in webhookHandlers.ts
const fs = require('fs');
const path = require('path');

// Path to the webhookHandlers file
const filePath = path.join(__dirname, 'src/services/webhookHandlers.ts');

// Read the file
let content = fs.readFileSync(filePath, 'utf8');

// Replace all instances of the TTS handler with the updated version that handles chunking
content = content.replace(
  /if \(audioResult\.method === 'tts'\) \{\s+\/\/ Use TTS fallback\s+twiml\.say\(\{ voice: 'alice', language: (?:'en-US'|campaign\.primaryLanguage === 'hi' \? 'hi-IN' : 'en-US') \}, (?:errorMessage|formattedGreeting|messageText|ttsText)\);\s+\} else \{/g,
  (match, p1, offset, string) => {
    // Extract the language and text variable from the original match
    const languageMatch = match.match(/language: (.*?) \},/);
    const language = languageMatch ? languageMatch[1].trim() : "'en-US'";
    
    const textMatch = match.match(/\}, (.*?)\);/);
    const textVar = textMatch ? textMatch[1].trim() : "errorMessage";
    
    // Determine the language parameter to pass to handleChunkedAudioForTwiML
    let langParam = "'en'";
    if (language.includes('campaign.primaryLanguage')) {
      langParam = 'campaign.primaryLanguage';
    } else if (language === "'hi-IN'") {
      langParam = "'hi'";
    }
    
    return `if (audioResult.method === 'tts') {
                // Check if this is a chunked audio request
                if (!handleChunkedAudioForTwiML(twiml, audioResult.url, ${langParam})) {
                  // Use regular TTS fallback
                  twiml.say({ voice: 'alice', language: ${language} }, ${textVar});
                }
              } else {`;
  }
);

// Write the file back
fs.writeFileSync(filePath, content, 'utf8');

console.log('Updated all TTS handling in webhookHandlers.ts');
