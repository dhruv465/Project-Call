/**
 * conversation_scenarios.ts
 * Predefined conversation scenarios for testing and simulation
 */

export enum EmotionType {
  HAPPY = 'happy',
  SAD = 'sad',
  ANGRY = 'angry',
  NEUTRAL = 'neutral',
  SURPRISED = 'surprised',
  CONFUSED = 'confused',
  INTERESTED = 'interested',
  FRUSTRATED = 'frustrated'
}

export interface ConversationMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  emotion?: EmotionType;
  intentTags?: string[];
  timestamp?: string;
}

export interface ConversationScenario {
  id: string;
  name: string;
  description: string;
  industry?: string;
  expectedDuration?: number; // in seconds
  goals?: string[];
  messages: ConversationMessage[];
  expectedOutcomes?: string[];
  tags?: string[];
}

export interface ConversationOutcome {
  scenarioId: string;
  success: boolean;
  completedGoals: string[];
  duration: number;
  emotionSummary: Record<EmotionType, number>;
  dominantEmotion: EmotionType;
  keyInsights: string[];
  transcriptSummary: string;
}

/**
 * Collection of test conversation scenarios
 */
export const conversationScenarios: Record<string, ConversationScenario> = {
  'product-inquiry': {
    id: 'product-inquiry',
    name: 'Product Information Inquiry',
    description: 'A customer calling to inquire about product features and pricing',
    industry: 'retail',
    expectedDuration: 180,
    goals: [
      'Identify customer needs',
      'Provide accurate product information',
      'Collect customer contact information',
      'Set appropriate expectations for pricing and availability'
    ],
    messages: [
      {
        role: 'system',
        content: 'You are a product specialist for a technology company. You need to gather customer requirements, provide product information, and collect contact details for follow-up.'
      },
      {
        role: 'assistant',
        content: 'Hello! Thank you for calling our product information line. My name is Alex, and I\'d be happy to tell you about our products and services today. How may I help you?'
      },
      {
        role: 'user',
        content: 'Hi, I\'m interested in learning more about your latest smartphone model.',
        emotion: EmotionType.INTERESTED,
        intentTags: ['product-inquiry', 'information-gathering']
      },
      {
        role: 'assistant',
        content: 'Great! I\'d be happy to tell you about our latest smartphone, the TechX Pro. It features a 6.7-inch OLED display, 5G connectivity, a triple-camera system, and up to 512GB of storage. Is there a specific feature you\'re most interested in learning about?'
      },
      {
        role: 'user',
        content: 'I\'m really interested in the camera quality. How does it compare to previous models?',
        emotion: EmotionType.INTERESTED,
        intentTags: ['specific-feature-inquiry', 'comparison']
      },
      {
        role: 'assistant',
        content: 'The TechX Pro has our best camera system yet. Compared to last year\'s model, we\'ve improved low-light performance by 40%, added a new ultra-wide lens with macro capabilities, and enhanced the portrait mode with AI-powered depth mapping. Many photography experts have rated it as the best smartphone camera currently available. Would you like to know about any other features?'
      },
      {
        role: 'user',
        content: 'What about battery life? That\'s always been an issue with my current phone.',
        emotion: EmotionType.CONCERNED,
        intentTags: ['pain-point', 'specific-feature-inquiry']
      },
      {
        role: 'assistant',
        content: 'Battery life is definitely a priority in our design. The TechX Pro features a 4500mAh battery that typically lasts all day with normal usage. In our tests, it provides about 12 hours of continuous video playback or 18 hours of web browsing. It also supports fast charging, going from 0 to 50% in just 25 minutes with our compatible charger. Does battery performance like this meet your needs?'
      },
      {
        role: 'user',
        content: 'That sounds pretty good. How much does it cost?',
        emotion: EmotionType.NEUTRAL,
        intentTags: ['pricing-inquiry']
      },
      {
        role: 'assistant',
        content: 'The TechX Pro starts at $899 for the 128GB model, $999 for 256GB, and $1,199 for the 512GB version. We also offer a trade-in program that could give you up to $400 off depending on your current device. Additionally, we have financing options available starting at $37 per month. Would you like more information about our financing or trade-in programs?'
      },
      {
        role: 'user',
        content: 'That\'s a bit more than I was hoping to spend. Do you have any promotions right now?',
        emotion: EmotionType.DISAPPOINTED,
        intentTags: ['price-objection', 'discount-inquiry']
      },
      {
        role: 'assistant',
        content: 'I understand your concern about the price. Actually, we do have a special promotion running until the end of the month. If you purchase the TechX Pro, you can get a free pair of our wireless earbuds valued at $199. Also, if you\'re upgrading from one of our previous models, you qualify for an additional loyalty discount of $100. Would these offers help make the TechX Pro more accessible for you?'
      },
      {
        role: 'user',
        content: 'That definitely helps. When would I be able to get one if I ordered today?',
        emotion: EmotionType.INTERESTED,
        intentTags: ['availability-inquiry', 'purchase-intent']
      },
      {
        role: 'assistant',
        content: 'Great! The TechX Pro is currently in stock in all colors and storage options. If you place an order today, standard delivery would be 2-3 business days, or you could pick it up at your nearest retail store as soon as tomorrow. Would you prefer delivery or store pickup?'
      },
      {
        role: 'user',
        content: 'Store pickup would be perfect. I think I need to think about it a bit more, but this has been really helpful.',
        emotion: EmotionType.SATISFIED,
        intentTags: ['consideration', 'positive-feedback']
      },
      {
        role: 'assistant',
        content: 'I\'m glad I could help! I completely understand wanting to take some time to consider your options. Would it be helpful if I emailed you the details we discussed, including the special promotions? That way, you\'ll have all the information at hand when you\'re ready to make a decision.'
      },
      {
        role: 'user',
        content: 'Yes, that would be great. My email is customer@example.com.',
        emotion: EmotionType.PLEASED,
        intentTags: ['information-sharing', 'follow-up-agreement']
      },
      {
        role: 'assistant',
        content: 'Perfect! I\'ve sent a detailed email to customer@example.com with all the information about the TechX Pro, including pricing, features, and our current promotions. Is there anything else I can help you with today?'
      },
      {
        role: 'user',
        content: 'No, that\'s all. Thanks for your help!',
        emotion: EmotionType.HAPPY,
        intentTags: ['conversation-closing', 'gratitude']
      },
      {
        role: 'assistant',
        content: 'You\'re very welcome! Thank you for your interest in the TechX Pro. If you have any other questions, feel free to call back or reply to the email I sent. Have a wonderful day!'
      }
    ],
    expectedOutcomes: [
      'Customer received complete product information',
      'Customer expressed interest in making a purchase',
      'Customer provided contact information for follow-up',
      'Promotions were shared to address price concerns'
    ],
    tags: ['product', 'sales', 'information', 'technology']
  },
  
  'customer-support': {
    id: 'customer-support',
    name: 'Technical Support Call',
    description: 'A customer calling with a technical issue that needs troubleshooting',
    industry: 'technology',
    expectedDuration: 240,
    goals: [
      'Identify the technical issue',
      'Provide step-by-step troubleshooting guidance',
      'Resolve the issue or escalate appropriately',
      'Ensure customer satisfaction with the resolution'
    ],
    messages: [
      {
        role: 'system',
        content: 'You are a technical support specialist. Your goal is to help the customer resolve their technical issue while maintaining a positive and patient attitude.'
      },
      {
        role: 'assistant',
        content: 'Thank you for calling technical support. My name is Jordan. Could you please tell me what issue you\'re experiencing today?'
      },
      {
        role: 'user',
        content: 'Hi, my laptop keeps freezing up every few minutes, and it\'s really frustrating because I\'m trying to finish a work project.',
        emotion: EmotionType.FRUSTRATED,
        intentTags: ['technical-issue', 'urgent-assistance']
      },
      // Additional conversation messages would be defined here
    ],
    expectedOutcomes: [
      'Technical issue identified and resolved',
      'Customer able to continue with their work',
      'Customer satisfied with support experience',
      'Preventative advice provided to avoid future issues'
    ],
    tags: ['support', 'technical', 'troubleshooting', 'customer-service']
  },
  
  'appointment-scheduling': {
    id: 'appointment-scheduling',
    name: 'Medical Appointment Scheduling',
    description: 'A patient calling to schedule a medical appointment',
    industry: 'healthcare',
    expectedDuration: 180,
    goals: [
      'Determine the reason for the appointment',
      'Identify appropriate provider and appointment type',
      'Schedule appointment at a convenient time',
      'Provide pre-appointment instructions if needed'
    ],
    messages: [
      {
        role: 'system',
        content: 'You are a medical office scheduler. You need to gather patient information, determine the appropriate appointment type, and find a suitable time slot.'
      },
      {
        role: 'assistant',
        content: 'Thank you for calling City Health Medical Center. This is Taylor speaking. How may I assist you today?'
      },
      {
        role: 'user',
        content: 'Hi, I need to make an appointment with Dr. Johnson. I\'ve been having some back pain for the past week.',
        emotion: EmotionType.CONCERNED,
        intentTags: ['appointment-request', 'health-concern']
      },
      // Additional conversation messages would be defined here
    ],
    expectedOutcomes: [
      'Appointment successfully scheduled',
      'Patient informed of appointment details',
      'Appropriate appointment type selected based on symptoms',
      'Pre-appointment instructions provided'
    ],
    tags: ['healthcare', 'scheduling', 'medical', 'appointment']
  }
};

/**
 * Retrieve a specific conversation scenario by ID
 */
export function getScenarioById(id: string): ConversationScenario | undefined {
  return conversationScenarios[id];
}

/**
 * Filter scenarios by tags
 */
export function getScenariosByTags(tags: string[]): ConversationScenario[] {
  return Object.values(conversationScenarios).filter(scenario => 
    tags.some(tag => scenario.tags?.includes(tag))
  );
}

/**
 * Filter scenarios by industry
 */
export function getScenariosByIndustry(industry: string): ConversationScenario[] {
  return Object.values(conversationScenarios).filter(scenario => 
    scenario.industry === industry
  );
}

/**
 * Get all available scenarios
 */
export function getAllScenarios(): ConversationScenario[] {
  return Object.values(conversationScenarios);
}

/**
 * Record a conversation outcome
 */
export function recordScenarioOutcome(outcome: ConversationOutcome): void {
  // In a real implementation, this would save to a database
  console.log('Recorded scenario outcome:', outcome);
}
