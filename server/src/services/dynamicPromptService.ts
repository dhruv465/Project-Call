import { getConversationMemoryService } from './conversationMemoryService';
import { logger } from '../index';

/**
 * Types of emotions that can be detected
 */
export type Emotion = 'positive' | 'negative' | 'neutral' | 'confused' | 'interested' | 'excited' | 'hesitant' | 'impatient';

/**
 * Prompt template with placeholders for dynamic content
 */
export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  template: string;
  emotionSpecific: boolean;
  recommendedFor?: Emotion[];
}

/**
 * Dynamic prompt optimization service
 * Adjusts AI prompts based on conversation context and customer emotion
 */
export class DynamicPromptService {
  private templates: Map<string, PromptTemplate> = new Map();
  private emotionTemplates: Map<Emotion, PromptTemplate[]> = new Map();
  
  constructor() {
    // Initialize with default templates
    this.loadDefaultTemplates();
    logger.info('DynamicPromptService initialized with default templates');
  }
  
  /**
   * Load default prompt templates
   */
  private loadDefaultTemplates(): void {
    // General templates
    const generalTemplates: PromptTemplate[] = [
      {
        id: 'default-conversation',
        name: 'Default Conversational',
        description: 'General-purpose conversational prompt',
        template: `You are an AI assistant having a phone conversation with a customer. 
                  Respond in a conversational manner.
                  
                  Customer context:
                  {{customerContext}}
                  
                  Conversation history:
                  {{conversationHistory}}
                  
                  Your response should address the customer's most recent input.`,
        emotionSpecific: false
      },
      {
        id: 'script-adherence',
        name: 'Script Adherence',
        description: 'Ensures the conversation follows the campaign script',
        template: `You are an AI assistant having a phone conversation with a customer.
                  You MUST follow the campaign script while sounding natural and conversational.
                  
                  Campaign script:
                  {{campaignScript}}
                  
                  Current stage: {{scriptStage}}
                  
                  Customer context:
                  {{customerContext}}
                  
                  Conversation history:
                  {{conversationHistory}}
                  
                  Your response should follow the script while addressing the customer's input.`,
        emotionSpecific: false
      }
    ];
    
    // Emotion-specific templates
    const emotionTemplates: PromptTemplate[] = [
      {
        id: 'positive-reinforcement',
        name: 'Positive Reinforcement',
        description: 'Reinforces positive emotions from the customer',
        template: `You are an AI assistant having a phone conversation with a customer who is showing POSITIVE emotions.
                  Respond in a way that acknowledges and reinforces their positive attitude.
                  
                  Customer context:
                  {{customerContext}}
                  
                  Conversation history:
                  {{conversationHistory}}
                  
                  Keep your response upbeat and enthusiastic while staying on topic.`,
        emotionSpecific: true,
        recommendedFor: ['positive', 'excited', 'interested']
      },
      {
        id: 'negative-mitigation',
        name: 'Negative Mitigation',
        description: 'Addresses and mitigates negative emotions from the customer',
        template: `You are an AI assistant having a phone conversation with a customer who is showing NEGATIVE emotions.
                  Respond with empathy and understanding to address their concerns.
                  
                  Customer context:
                  {{customerContext}}
                  
                  Conversation history:
                  {{conversationHistory}}
                  
                  In your response:
                  1. Acknowledge their feelings without being defensive
                  2. Show that you understand their concern
                  3. Offer a constructive solution or path forward`,
        emotionSpecific: true,
        recommendedFor: ['negative']
      },
      {
        id: 'confusion-clarity',
        name: 'Confusion Clarity',
        description: 'Provides clarity when customer shows confusion',
        template: `You are an AI assistant having a phone conversation with a customer who appears CONFUSED.
                  Your goal is to provide clarity and simple explanations.
                  
                  Customer context:
                  {{customerContext}}
                  
                  Conversation history:
                  {{conversationHistory}}
                  
                  In your response:
                  1. Simplify concepts that may be causing confusion
                  2. Ask clarifying questions if needed
                  3. Explain things step by step without being condescending`,
        emotionSpecific: true,
        recommendedFor: ['confused', 'hesitant']
      },
      {
        id: 'impatience-efficiency',
        name: 'Impatience Efficiency',
        description: 'Optimized for impatient customers',
        template: `You are an AI assistant having a phone conversation with a customer who appears IMPATIENT.
                  Be direct, efficient, and get to the point quickly.
                  
                  Customer context:
                  {{customerContext}}
                  
                  Conversation history:
                  {{conversationHistory}}
                  
                  Keep your response brief and focused on addressing their needs immediately.`,
        emotionSpecific: true,
        recommendedFor: ['impatient']
      }
    ];
    
    // Add templates to collections
    [...generalTemplates, ...emotionTemplates].forEach(template => {
      this.templates.set(template.id, template);
    });
    
    // Organize by emotion
    emotionTemplates.forEach(template => {
      if (template.recommendedFor) {
        template.recommendedFor.forEach(emotion => {
          if (!this.emotionTemplates.has(emotion)) {
            this.emotionTemplates.set(emotion, []);
          }
          this.emotionTemplates.get(emotion)?.push(template);
        });
      }
    });
  }
  
  /**
   * Add a custom prompt template
   */
  public addTemplate(template: PromptTemplate): void {
    this.templates.set(template.id, template);
    
    if (template.emotionSpecific && template.recommendedFor) {
      template.recommendedFor.forEach(emotion => {
        if (!this.emotionTemplates.has(emotion)) {
          this.emotionTemplates.set(emotion, []);
        }
        this.emotionTemplates.get(emotion)?.push(template);
      });
    }
    
    logger.info(`Added prompt template: ${template.id}`);
  }
  
  /**
   * Get a specific template by ID
   */
  public getTemplate(templateId: string): PromptTemplate | undefined {
    return this.templates.get(templateId);
  }
  
  /**
   * Get all templates
   */
  public getAllTemplates(): PromptTemplate[] {
    return Array.from(this.templates.values());
  }
  
  /**
   * Get templates recommended for a specific emotion
   */
  public getTemplatesForEmotion(emotion: Emotion): PromptTemplate[] {
    return this.emotionTemplates.get(emotion) || [];
  }
  
  /**
   * Generate an optimized prompt based on customer context and emotion
   */
  public async generateOptimizedPrompt(
    conversationId: string,
    templateId: string,
    emotion: Emotion = 'neutral',
    additionalContext: Record<string, any> = {}
  ): Promise<string> {
    try {
      // Get template - either the requested one or an emotion-specific one
      let template = this.templates.get(templateId);
      
      // If no template found or not emotion-specific and we have an emotion, try to find a better match
      if ((!template || !template.emotionSpecific) && emotion !== 'neutral') {
        const emotionTemplates = this.emotionTemplates.get(emotion);
        if (emotionTemplates && emotionTemplates.length > 0) {
          template = emotionTemplates[0]; // Use first matching template
          logger.info(`Using emotion-specific template ${template.id} for emotion: ${emotion}`);
        }
      }
      
      // Fallback to default if still no template
      if (!template) {
        template = this.templates.get('default-conversation');
        if (!template) {
          throw new Error('No default template available');
        }
      }
      
      // Get conversation history
      const memoryService = getConversationMemoryService();
      const conversation = await memoryService.getConversation(conversationId);
      
      if (!conversation) {
        logger.warn(`No conversation found for ID: ${conversationId}`);
        return template.template;
      }
      
      // Format conversation history
      const conversationHistory = conversation.messages
        .map(msg => `${msg.role}: ${msg.content}`)
        .join('\n\n');
      
      // Format customer context
      const customerContext = JSON.stringify(
        {
          ...conversation.contextualData,
          currentEmotion: emotion,
          ...additionalContext
        },
        null,
        2
      );
      
      // Fill in template placeholders
      let filledTemplate = template.template
        .replace('{{conversationHistory}}', conversationHistory)
        .replace('{{customerContext}}', customerContext);
      
      // Fill in any additional context
      Object.entries(additionalContext).forEach(([key, value]) => {
        filledTemplate = filledTemplate.replace(`{{${key}}}`, String(value));
      });
      
      return filledTemplate;
    } catch (error) {
      logger.error(`Error generating optimized prompt: ${error}`);
      // Return a simple fallback prompt
      return `You are an AI assistant having a conversation. Respond to the customer's most recent message appropriately.`;
    }
  }
  
  /**
   * Generate a real-time script deviation detection prompt
   */
  public generateDeviationDetectionPrompt(
    campaignScript: string,
    conversationHistory: string,
    currentStage: string
  ): string {
    return `Analyze the following conversation between an AI agent and a customer.
            Determine if the conversation has deviated from the intended script and campaign objective.
            
            Campaign Script:
            ${campaignScript}
            
            Current Expected Stage:
            ${currentStage}
            
            Conversation History:
            ${conversationHistory}
            
            Respond with a JSON object containing:
            1. isOnScript (boolean): Whether the conversation is following the script
            2. deviationLevel (number): 0-10 scale where 0 is perfectly on script and 10 is completely off-topic
            3. currentActualStage (string): The current stage of the conversation based on the script
            4. recommendedNextStep (string): Recommended action to bring the conversation back on track if needed
            5. criticalInfo (array): Any critical information that has been missed or should be addressed`;
  }
  
  /**
   * Generate a next-best-action suggestion prompt
   */
  public generateNextBestActionPrompt(
    conversationId: string,
    campaignObjective: string,
    customerContext: Record<string, any>
  ): string {
    return `Based on the conversation so far, determine the next best action for the AI agent to take.
            
            Campaign Objective:
            ${campaignObjective}
            
            Customer Context:
            ${JSON.stringify(customerContext, null, 2)}
            
            Conversation ID: ${conversationId}
            
            Respond with a JSON object containing:
            1. nextBestAction (string): The recommended next action
            2. rationale (string): Why this action is recommended
            3. alternatives (array): Alternative actions that could be taken
            4. warning (string): Any potential issues to be aware of
            5. keyMetrics (object): Key metrics to track for this action`;
  }
}

// Singleton instance
let promptService: DynamicPromptService | null = null;

export const getDynamicPromptService = (): DynamicPromptService => {
  if (!promptService) {
    promptService = new DynamicPromptService();
  }
  return promptService;
};

export const initializeDynamicPromptService = (): DynamicPromptService => {
  promptService = new DynamicPromptService();
  return promptService;
};
