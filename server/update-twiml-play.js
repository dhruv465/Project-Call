// Script to update all twiml.play calls with proper URL formatting
const fs = require('fs');
const path = require('path');

// Files to update
const files = [
  'src/services/webhookHandlers.ts',
  'src/services/enhancedVoiceAIService.ts'
];

// Read the imports from voiceSynthesis.ts
files.forEach(filePath => {
  const fullPath = path.join(__dirname, filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`File not found: ${fullPath}`);
    return;
  }
  
  let content = fs.readFileSync(fullPath, 'utf8');
  
  // First, ensure the prepareUrlForTwilioPlay function is imported
  if (filePath === 'src/services/webhookHandlers.ts') {
    // Check if import already exists
    if (!content.includes('prepareUrlForTwilioPlay')) {
      // Find the import for processAudioForTwiML
      const importRegex = /import\s*{\s*([^}]+)\s*}\s*from\s*['"](\.\.\/utils\/voiceSynthesis)['"]/;
      const importMatch = content.match(importRegex);
      
      if (importMatch) {
        const currentImports = importMatch[1];
        const newImports = currentImports.includes('prepareUrlForTwilioPlay') 
          ? currentImports 
          : `${currentImports}, prepareUrlForTwilioPlay`;
        
        content = content.replace(
          importRegex,
          `import { ${newImports} } from '${importMatch[2]}'`
        );
        
        console.log(`Updated import in ${filePath}`);
      } else {
        console.log(`Could not find import pattern in ${filePath}`);
      }
    }
  }
  
  if (filePath === 'src/services/enhancedVoiceAIService.ts') {
    // Ensure the function is available in this file
    if (!content.includes('prepareUrlForTwilioPlay')) {
      // Add the function import through dynamic import
      const voiceSynthesisImportRegex = /const\s*{\s*processAudioForTwiML\s*}\s*=\s*require\(['"](\.\.\/utils\/voiceSynthesis)['"]\)/;
      const voiceSynthesisImportMatch = content.match(voiceSynthesisImportRegex);
      
      if (voiceSynthesisImportMatch) {
        content = content.replace(
          voiceSynthesisImportRegex,
          `const { processAudioForTwiML, prepareUrlForTwilioPlay } = require('${voiceSynthesisImportMatch[1]}')`
        );
        
        console.log(`Updated require in ${filePath}`);
      } else {
        console.log(`Could not find require pattern in ${filePath}`);
      }
    }
  }
  
  // Now update all twiml.play calls
  const playRegex = /twiml\.play\s*\(\s*audioResult\.url\s*\)/g;
  
  if (content.match(playRegex)) {
    content = content.replace(
      playRegex,
      'twiml.play(prepareUrlForTwilioPlay(audioResult.url))'
    );
    
    console.log(`Updated twiml.play calls in ${filePath}`);
  } else {
    console.log(`No matching twiml.play calls found in ${filePath}`);
  }
  
  // Write back the updated content
  fs.writeFileSync(fullPath, content, 'utf8');
});

console.log('Finished updating files');
