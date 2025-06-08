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
      // In a real implementation, this would call an LLM to analyze the text
      // For now, we'll use a simple heuristic approach
      
      // This is a placeholder implementation
      // In the full system, this would be replaced with an LLM-based detector
      const objectionPhrases = [
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
      // In a real implementation, this would use an LLM to detect intent
      // For this placeholder, we'll use a simple keyword approach
      
      // Basic intent categories
      const intents = {
        inquiry: ['what is', 'how does', 'tell me about', 'explain'],
        interest: ['interested', 'sounds good', 'tell me more', 'like to'],
        objection: ['too expensive', 'not interested', 'don\'t need', 'already have'],
        affirmation: ['yes', 'sure', 'okay', 'alright', 'go ahead'],
        negation: ['no', 'nope', 'not now', 'don\'t', 'can\'t'],
        gratitude: ['thank you', 'thanks', 'appreciate', 'grateful'],
        confusion: ['confused', 'don\'t understand', 'what do you mean', 'unclear'],
        closing: ['goodbye', 'bye', 'end call', 'hang up', 'that\'s all']
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
