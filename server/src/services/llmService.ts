/**
 * LLM Service - Real integration with OpenAI and Anthropic
 * Provides unified interface for interacting with different LLM providers
 */

import axios from 'axios';
import { logger, getErrorMessage } from '../index';

export type LLMProvider = 'openai' | 'anthropic' | 'auto';

export interface LLMResponse {
  text: string;
  provider: LLMProvider;
  model: string;
  tokenUsage?: {
    input: number;
    output: number;
    total: number;
  };
  rawResponse?: any;
}

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMConfig {
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
  model?: string;
}

export class LLMService {
  private openAIApiKey: string;
  private anthropicApiKey: string;
  private preferredProvider: LLMProvider = 'auto';
  private defaultModel: Record<LLMProvider, string> = {
    openai: 'gpt-4',
    anthropic: 'claude-2',
    auto: 'gpt-4'
  };

  constructor(openAIApiKey: string, anthropicApiKey?: string) {
    this.openAIApiKey = openAIApiKey;
    this.anthropicApiKey = anthropicApiKey || '';
  }
  
  /**
   * Update API keys for LLM providers
   */
  public updateApiKeys(openAIApiKey?: string, anthropicApiKey?: string): void {
    if (openAIApiKey && openAIApiKey !== this.openAIApiKey) {
      this.openAIApiKey = openAIApiKey;
      logger.info('OpenAI API key updated');
    }
    
    if (anthropicApiKey && anthropicApiKey !== this.anthropicApiKey) {
      this.anthropicApiKey = anthropicApiKey;
      logger.info('Anthropic API key updated');
    }
  }
  
  /**
   * Get current OpenAI API key
   */
  public getOpenAIApiKey(): string {
    return this.openAIApiKey;
  }
  
  /**
   * Get current Anthropic API key
   */
  public getAnthropicApiKey(): string {
    return this.anthropicApiKey;
  }
  
  /**
   * Generate a response using the specified or automatic LLM provider
   */
  public async generateResponse(
    messages: Message[],
    provider: LLMProvider = this.preferredProvider,
    config: LLMConfig = {}
  ): Promise<LLMResponse> {
    // Auto-select provider if set to 'auto'
    const actualProvider = provider === 'auto' 
      ? this.selectOptimalProvider(messages) 
      : provider;

    // If selected provider is not available, fallback
    if ((actualProvider === 'anthropic' && !this.anthropicApiKey) || 
        (actualProvider === 'openai' && !this.openAIApiKey)) {
      const fallbackProvider = this.anthropicApiKey ? 'anthropic' : 'openai';
      logger.warn(`Selected provider ${actualProvider} not available. Falling back to ${fallbackProvider}`);
      return this.generateResponse(messages, fallbackProvider, config);
    }

    try {
      // Generate response with selected provider
      if (actualProvider === 'openai') {
        return await this.generateOpenAIResponse(messages, config);
      } else {
        return await this.generateAnthropicResponse(messages, config);
      }
    } catch (error) {
      // Try fallback if primary provider fails
      if (this.preferredProvider === 'auto' && provider !== 'auto') {
        const fallbackProvider: LLMProvider = provider === 'openai' ? 'anthropic' : 'openai';
        
        if ((fallbackProvider === 'anthropic' && this.anthropicApiKey) || 
            (fallbackProvider === 'openai' && this.openAIApiKey)) {
          logger.warn(`Provider ${provider} failed. Falling back to ${fallbackProvider}`);
          return this.generateResponse(messages, fallbackProvider, config);
        }
      }
      
      logger.error(`Error generating LLM response: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  /**
   * Generate response using OpenAI
   */
  private async generateOpenAIResponse(
    messages: Message[],
    config: LLMConfig = {}
  ): Promise<LLMResponse> {
    try {
      const model = config.model || this.defaultModel.openai;

      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model,
          messages,
          temperature: config.temperature ?? 0.7,
          max_tokens: config.maxTokens ?? 800,
          stop: config.stopSequences,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.openAIApiKey}`,
          },
        }
      );

      return {
        text: response.data.choices[0].message.content.trim(),
        provider: 'openai',
        model,
        tokenUsage: {
          input: response.data.usage.prompt_tokens,
          output: response.data.usage.completion_tokens,
          total: response.data.usage.total_tokens,
        },
        rawResponse: response.data,
      };
    } catch (error) {
      logger.error(`OpenAI API error: ${getErrorMessage(error)}`);
      throw new Error(`OpenAI API error: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Generate response using Anthropic
   */
  private async generateAnthropicResponse(
    messages: Message[],
    config: LLMConfig = {}
  ): Promise<LLMResponse> {
    try {
      const model = config.model || this.defaultModel.anthropic;
      
      // Convert messages to Anthropic format
      const systemMessage = messages.find(m => m.role === 'system')?.content || '';
      const conversationMessages = messages.filter(m => m.role !== 'system');
      
      // Build prompt in Claude format
      let prompt = systemMessage ? `${systemMessage}\n\n` : '';
      
      for (const message of conversationMessages) {
        if (message.role === 'user') {
          prompt += `Human: ${message.content}\n\n`;
        } else if (message.role === 'assistant') {
          prompt += `Assistant: ${message.content}\n\n`;
        }
      }
      
      // Add final prompt for Claude to respond to
      prompt += 'Assistant: ';

      const response = await axios.post(
        'https://api.anthropic.com/v1/complete',
        {
          prompt,
          model,
          max_tokens_to_sample: config.maxTokens ?? 800,
          temperature: config.temperature ?? 0.7,
          stop_sequences: config.stopSequences || ['\n\nHuman:'],
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.anthropicApiKey,
            'anthropic-version': '2023-06-01',
          },
        }
      );

      return {
        text: response.data.completion.trim(),
        provider: 'anthropic',
        model,
        rawResponse: response.data,
      };
    } catch (error) {
      logger.error(`Anthropic API error: ${getErrorMessage(error)}`);
      throw new Error(`Anthropic API error: ${getErrorMessage(error)}`);
    }
  }

  /**
   * Set the preferred LLM provider
   */
  public setPreferredProvider(provider: LLMProvider): void {
    this.preferredProvider = provider;
  }

  /**
   * Set the default model for a provider
   */
  public setDefaultModel(provider: LLMProvider, model: string): void {
    this.defaultModel[provider] = model;
  }

  /**
   * Selects the optimal provider based on message content
   */
  private selectOptimalProvider(messages: Message[]): LLMProvider {
    // Implement logic to choose the best provider based on the context
    // For example: long contexts to Claude, complex reasoning to GPT-4
    
    const totalTokens = this.estimateTokenCount(messages);
    const complexity = this.estimateComplexity(messages);
    
    // Use Anthropic for longer contexts if available
    if (totalTokens > 6000 && this.anthropicApiKey) {
      return 'anthropic';
    }
    
    // Use OpenAI for more complex reasoning
    if (complexity > 0.7) {
      return 'openai';
    }
    
    // Default to available provider
    return this.openAIApiKey ? 'openai' : 'anthropic';
  }

  /**
   * Estimate token count for given messages
   */
  private estimateTokenCount(messages: Message[]): number {
    // Simple estimation: ~4 chars per token
    return messages.reduce((count, msg) => count + Math.ceil(msg.content.length / 4), 0);
  }

  /**
   * Estimate complexity of the conversation
   */
  private estimateComplexity(messages: Message[]): number {
    // Simple complexity heuristic
    const text = messages.map(m => m.content).join(' ');
    
    // Count markers of complexity
    const complexityMarkers = [
      'explain', 'analyze', 'compare', 'evaluate', 
      'why', 'how', 'complex', 'difficult', 'reasoning',
      'technical', 'detailed'
    ];
    
    const markerCount = complexityMarkers.reduce((count, marker) => {
      return count + (text.toLowerCase().match(new RegExp(marker, 'g')) || []).length;
    }, 0);
    
    return Math.min(1, markerCount / 10);
  }
}

export default LLMService;
