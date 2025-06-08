import logger from '../utils/logger';

/**
 * A service to detect objections and other user intents in conversation
 * This would typically integrate with an LLM to analyze user responses
 */
export class ObjectDetectionService {
  /**
   * Detect if user input contains an objection
   * 
   * @param text The user's input text
   * @returns Object containing detection results
   */
  async detectObjection(text: string): Promise<{ 
    isObjection: boolean;
    confidence: number;
    category?: string;
    details?: string;
  }> {
    try {
      // Get objection phrases from configuration
      const Configuration = require('../models/Configuration').default;
      const config = await Configuration.findOne();
      
      // Use dynamic configuration if available, otherwise fall back to defaults
      let objectionPhrases: Array<{ phrase: string, category: string, confidence: number }> = [];
      
      if (config?.intentDetection?.objectionPhrases?.length > 0) {
        // Transform configured phrases into our format with categories and confidence
        objectionPhrases = config.intentDetection.objectionPhrases.map((phrase: string) => {
          // Determine category based on phrase content
          let category = 'general';
          let confidence = 0.8;
          
          if (phrase.includes('expensive') || phrase.includes('cost') || phrase.includes('price') || 
              phrase.includes('afford')) {
            category = 'price';
            confidence = 0.9;
          } else if (phrase.includes('interest')) {
            category = 'rejection';
            confidence = 0.9;
          } else if (phrase.includes('need')) {
            category = 'need';
            confidence = 0.8;
          } else if (phrase.includes('have')) {
            category = 'existing_solution';
            confidence = 0.8;
          } else if (phrase.includes('later') || phrase.includes('time')) {
            category = 'timing';
            confidence = 0.7;
          }
          
          return { phrase, category, confidence };
        });
      } else {
        // Fallback to default objections if configuration is not available
        objectionPhrases = [
          { phrase: 'not interested', category: 'rejection', confidence: 0.9 },
          { phrase: 'too expensive', category: 'price', confidence: 0.9 },
          { phrase: 'can\'t afford', category: 'price', confidence: 0.9 },
          { phrase: 'don\'t need', category: 'need', confidence: 0.8 },
          { phrase: 'already have', category: 'existing_solution', confidence: 0.8 },
          { phrase: 'not now', category: 'timing', confidence: 0.7 },
          { phrase: 'maybe later', category: 'timing', confidence: 0.7 },
          { phrase: 'have to think', category: 'hesitation', confidence: 0.7 },
          { phrase: 'need to consult', category: 'authority', confidence: 0.8 },
          { phrase: 'call back', category: 'postponement', confidence: 0.7 },
          { phrase: 'not a good fit', category: 'relevance', confidence: 0.8 }
        ];
      }
      
      // Convert input to lowercase for case-insensitive matching
      const lowercaseText = text.toLowerCase();
      
      // Check for matches
      for (const objection of objectionPhrases) {
        if (lowercaseText.includes(objection.phrase)) {
          return {
            isObjection: true,
            confidence: objection.confidence,
            category: objection.category,
            details: `Detected "${objection.phrase}" in user input`
          };
        }
      }
      
      // No objection detected
      return {
        isObjection: false,
        confidence: 0.8
      };
    } catch (error) {
      logger.error('Error in objection detection:', error);
      
      // Return a conservative result in case of error
      return {
        isObjection: false,
        confidence: 0.5,
        details: 'Error during detection'
      };
    }
  }
  
  /**
   * Detect the general intent of the user's input
   * 
   * @param text The user's input text
   * @returns The detected intent
   */
  async detectIntent(text: string): Promise<{
    intent: string;
    confidence: number;
    subIntents?: string[];
  }> {
    try {
      // Get intent detection phrases from configuration
      const Configuration = require('../models/Configuration').default;
      const config = await Configuration.findOne();
      
      // Use dynamic configuration for intent detection if available
      const intents: Record<string, string[]> = {
        inquiry: ['what is', 'how does', 'tell me about', 'explain'],
        interest: ['interested', 'sounds good', 'tell me more', 'like to'],
        objection: config?.intentDetection?.objectionPhrases || ['too expensive', 'not interested', 'don\'t need'],
        affirmation: ['yes', 'sure', 'okay', 'alright', 'go ahead'],
        negation: ['no', 'nope', 'not now', 'don\'t', 'can\'t'],
        gratitude: ['thank you', 'thanks', 'appreciate', 'grateful'],
        confusion: ['confused', 'don\'t understand', 'what do you mean', 'unclear'],
        closing: config?.intentDetection?.closingPhrases || ['goodbye', 'bye', 'end call', 'hang up', 'that\'s all']
      };
      
      const lowercaseText = text.toLowerCase();
      
      // Check each intent category
      let highestMatchCount = 0;
      let detectedIntent = 'general';
      let subIntents: string[] = [];
      
      for (const [intent, keywords] of Object.entries(intents)) {
        const matchCount = keywords.filter(keyword => 
          lowercaseText.includes(keyword.toLowerCase())
        ).length;
        
        if (matchCount > 0) {
          subIntents.push(intent);
        }
        
        if (matchCount > highestMatchCount) {
          highestMatchCount = matchCount;
          detectedIntent = intent;
        }
      }
      
      // If confidence is low and LLM is configured, try to use it for better detection
      if (highestMatchCount === 0 && config?.llmConfig?.defaultProvider) {
        try {
          // Get the LLM provider from configuration
          const llmProvider = config.llmConfig.providers.find(
            p => p.name === config.llmConfig.defaultProvider && p.isEnabled
          );
          
          if (llmProvider?.apiKey) {
            // Import LLM service
            const { llmService } = require('./index');
            
            // Use LLM to detect intent if it's properly configured
            const llmResponse = await llmService.analyzeIntent(text, {
              provider: config.llmConfig.defaultProvider,
              model: config.llmConfig.defaultModel,
              temperature: 0.3, // Lower temperature for more deterministic responses
              intentCategories: Object.keys(intents)
            });
            
            if (llmResponse?.intent && llmResponse?.confidence > 0.6) {
              // Use LLM detection if it has higher confidence
              return {
                intent: llmResponse.intent,
                confidence: llmResponse.confidence,
                subIntents: llmResponse.subIntents
              };
            }
          }
        } catch (llmError) {
          logger.warn('LLM intent detection failed, falling back to keyword-based detection:', llmError);
        }
      }
      
      return {
        intent: detectedIntent,
        confidence: highestMatchCount > 0 ? 0.7 + (highestMatchCount * 0.1) : 0.5,
        subIntents: subIntents.length > 0 ? subIntents : undefined
      };
    } catch (error) {
      logger.error('Error in intent detection:', error);
      
      return {
        intent: 'general',
        confidence: 0.5
      };
    }
  }
}

export const objectDetectionService = new ObjectDetectionService();
