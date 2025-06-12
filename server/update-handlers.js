// This is a helper script to modify all instances of adaptive voice synthesis in webhookHandlers.ts

import fs from 'fs';
import path from 'path';

// Path to webhookHandlers.ts
const filePath = path.join(__dirname, 'server/src/services/webhookHandlers.ts');

// Read the file
let content = fs.readFileSync(filePath, 'utf8');

// Find and replace all instances of direct base64 encoding with the safer method
const regex = /const speechResponse = await voiceAI\.synthesizeAdaptiveVoice\(\{[\s\S]*?personalityId: [^,}]+[,]?[\s\S]*?language: [^}]+\}\);[\s\S]*?if \(speechResponse\.audioContent\) \{[\s\S]*?const audioBase64 = speechResponse\.audioContent\.toString\('base64'\);[\s\S]*?const audioDataUrl = `data:audio\/mpeg;base64,\${audioBase64}`;[\s\S]*?twiml\.play\(audioDataUrl\);[\s\S]*?\} else \{[\s\S]*?\/\/ Fallback to empty audio[\s\S]*?twiml\.play\(''\);[\s\S]*?\}/g;

const replacement = (match, offset, string) => {
  // Extract the text, personalityId, and language from the original code
  const textMatch = match.match(/text: ([^,}]+)/);
  const idMatch = match.match(/personalityId: ([^,}]+)/);
  const langMatch = match.match(/language: ([^,}]+)/);
  
  const text = textMatch ? textMatch[1] : 'errorMessage';
  const id = idMatch ? idMatch[1] : 'defaultVoiceId';
  const lang = langMatch ? langMatch[1] : "'en'";
  
  return `const speechResponse = await voiceAI.synthesizeAdaptiveVoiceForTwiML({
              text: ${text},
              personalityId: ${id},
              language: ${lang},
              twiml: twiml,
              fallbackText: ${text}
            });`;
};

// Perform the replacement
const updatedContent = content.replace(regex, replacement);

// Write the file back
fs.writeFileSync(filePath, updatedContent, 'utf8');

console.log('All instances of adaptive voice synthesis have been updated to use the safer method.');
