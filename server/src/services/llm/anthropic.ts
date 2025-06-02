/**
 * Anthropic Provider Implementation
 */
import Anthropic from '@anthropic-ai/sdk';
import { ILLMProviderClient } from './base';
import { 
  LLMProvider,
  LLMMessage,
  LLMResponse,
  LLMStreamChunk,
  LLMError,
  TokenUsage,
  ModelInfo
} from './types';
import { logger } from '../../index';

export class AnthropicClient implements ILLMProviderClient {
  readonly provider: LLMProvider = 'anthropic';
  private client: Anthropic;
  private defaultModel: string;
  
  constructor(
    apiKey: string, 
    options?: { 
      baseUrl?: string;
      defaultModel?: string;
    }
  ) {
    this.client = new Anthropic({
      apiKey: apiKey,
      baseURL: options?.baseUrl,
    });
    
    this.defaultModel = options?.defaultModel || 'claude-3-opus-20240229';
  }
  
  getProviderName(): LLMProvider {
    return this.provider;
  }
  
  isConfigured(): boolean {
    return !!this.client;
  }
  
  async testConnection(): Promise<boolean> {
    try {
      // Use a simple message request to test connectivity
      await this.client.messages.create({
        model: this.defaultModel,
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 10,
      });
      return true;
    } catch (error) {
      logger.error(`Anthropic connection test failed: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }
  
  async completion(request: Omit<import('./types').LLMCompletionRequest, 'provider'>): Promise<LLMResponse> {
    try {
      const { model = this.defaultModel, prompt, options } = request;
      
      // Anthropic uses the chat API for both completions and chat
      const response = await this.client.messages.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: options?.temperature,
        max_tokens: options?.maxTokens,
        top_p: options?.topP,
        stop_sequences: options?.stopSequences,
      });
      
      // Anthropic provides usage in a different format
      const usage: TokenUsage = {
        promptTokens: response.usage?.input_tokens || 0,
        completionTokens: response.usage?.output_tokens || 0,
        totalTokens: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0)
      };
      
      // Safely extract content
      const content = this.extractContent(response);
      
      return {
        content,
        model: response.model,
        provider: this.provider,
        usage,
        rawResponse: response
      };
    } catch (error) {
      this.handleError(error);
    }
  }
  
  async chat(request: Omit<import('./types').LLMChatRequest, 'provider'>): Promise<LLMResponse> {
    try {
      const { model = this.defaultModel, messages, options } = request;
      
      // Convert our standard message format to Anthropic's format
      // Note: Anthropic doesn't support 'system' role in the same way as OpenAI
      // We need to handle system messages specially
      const { anthropicMessages, systemPrompt } = this.convertMessages(messages);
      
      const response = await this.client.messages.create({
        model,
        messages: anthropicMessages,
        system: systemPrompt,
        temperature: options?.temperature,
        max_tokens: options?.maxTokens,
        top_p: options?.topP,
        stop_sequences: options?.stopSequences,
      });
      
      const usage: TokenUsage = {
        promptTokens: response.usage?.input_tokens || 0,
        completionTokens: response.usage?.output_tokens || 0,
        totalTokens: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0)
      };
      
      // Safely extract content
      const content = this.extractContent(response);
      
      return {
        content,
        model: response.model,
        provider: this.provider,
        usage,
        rawResponse: response
      };
    } catch (error) {
      this.handleError(error);
    }
  }
  
  async streamChat(
    request: Omit<import('./types').LLMChatRequest, 'provider'>,
    onChunk: (chunk: LLMStreamChunk) => void
  ): Promise<void> {
    try {
      const { model = this.defaultModel, messages, options } = request;
      
      // Handle system messages
      const { anthropicMessages, systemPrompt } = this.convertMessages(messages);
      
      const stream = await this.client.messages.create({
        model,
        messages: anthropicMessages,
        system: systemPrompt,
        temperature: options?.temperature,
        max_tokens: options?.maxTokens,
        top_p: options?.topP,
        stop_sequences: options?.stopSequences,
        stream: true
      });
      
      for await (const chunk of stream) {
        // In streaming mode, only content delta is returned
        if (chunk.type === 'content_block_delta') {
          // Safely extract delta text
          const content = chunk.delta && 'text' in chunk.delta ? 
            chunk.delta.text : '';
          
          onChunk({
            content,
            isDone: false,
            rawChunk: chunk
          });
        } else if (chunk.type === 'message_stop') {
          onChunk({
            content: '',
            isDone: true,
            rawChunk: chunk
          });
        }
      }
    } catch (error) {
      this.handleError(error);
    }
  }
  
  async countTokens(input: string | LLMMessage[]): Promise<number> {
    // Simplified token counting similar to OpenAI
    let text = '';
    
    if (typeof input === 'string') {
      text = input;
    } else {
      text = input.map(m => `${m.role}: ${m.content}`).join('\n');
    }
    
    // Rough approximation: 1 token ≈ 4 characters for English text
    return Math.ceil(text.length / 4);
  }
  
  async listModels(): Promise<string[]> {
    // Anthropic doesn't have a list models API, so we'll return the known models
    return [
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307',
      'claude-2.1',
      'claude-2.0',
      'claude-instant-1.2'
    ];
  }

  async getAvailableModels(): Promise<ModelInfo[]> {
    // Anthropic model information with current pricing and capabilities
    const models: ModelInfo[] = [
      {
        id: 'claude-3-opus-20240229',
        name: 'Claude 3 Opus',
        description: 'Most powerful model for highly complex tasks, with superior performance on reasoning, math, coding, and creative writing.',
        maxTokens: 4096,
        contextWindow: 200000,
        pricing: {
          input: 0.015,   // $15 per 1M tokens
          output: 0.075   // $75 per 1M tokens
        },
        capabilities: {
          chat: true,
          completion: true,
          streaming: true,
          functionCalling: false,
          vision: true
        }
      },
      {
        id: 'claude-3-sonnet-20240229',
        name: 'Claude 3 Sonnet',
        description: 'Ideal balance of intelligence and speed for enterprise workloads, with strong performance across a wide range of tasks.',
        maxTokens: 4096,
        contextWindow: 200000,
        pricing: {
          input: 0.003,   // $3 per 1M tokens
          output: 0.015   // $15 per 1M tokens
        },
        capabilities: {
          chat: true,
          completion: true,
          streaming: true,
          functionCalling: false,
          vision: true
        }
      },
      {
        id: 'claude-3-haiku-20240307',
        name: 'Claude 3 Haiku',
        description: 'Fastest and most compact model for near-instant responsiveness and seamless AI experiences.',
        maxTokens: 4096,
        contextWindow: 200000,
        pricing: {
          input: 0.00025,  // $0.25 per 1M tokens
          output: 0.00125  // $1.25 per 1M tokens
        },
        capabilities: {
          chat: true,
          completion: true,
          streaming: true,
          functionCalling: false,
          vision: true
        }
      },
      {
        id: 'claude-2.1',
        name: 'Claude 2.1',
        description: 'Previous generation model with strong performance on text-based tasks.',
        maxTokens: 4096,
        contextWindow: 200000,
        pricing: {
          input: 0.008,   // $8 per 1M tokens
          output: 0.024   // $24 per 1M tokens
        },
        capabilities: {
          chat: true,
          completion: true,
          streaming: true,
          functionCalling: false
        }
      },
      {
        id: 'claude-2.0',
        name: 'Claude 2.0',
        description: 'Earlier version of Claude 2 with good performance on various tasks.',
        maxTokens: 4096,
        contextWindow: 100000,
        pricing: {
          input: 0.008,
          output: 0.024
        },
        capabilities: {
          chat: true,
          completion: true,
          streaming: true,
          functionCalling: false
        }
      },
      {
        id: 'claude-instant-1.2',
        name: 'Claude Instant 1.2',
        description: 'Fast and cost-effective model for simple tasks and quick responses.',
        maxTokens: 4096,
        contextWindow: 100000,
        pricing: {
          input: 0.0008,   // $0.8 per 1M tokens
          output: 0.0024   // $2.4 per 1M tokens
        },
        capabilities: {
          chat: true,
          completion: true,
          streaming: true,
          functionCalling: false
        }
      }
    ];

    return models;
  }
  
  private convertMessages(messages: LLMMessage[]): { 
    anthropicMessages: { role: 'user' | 'assistant'; content: string }[]; 
    systemPrompt?: string;
  } {
    let systemPrompt: string | undefined;
    
    const anthropicMessages = messages
      .filter(msg => {
        if (msg.role === 'system') {
          systemPrompt = msg.content;
          return false;
        }
        return true;
      })
      .map(msg => ({
        role: msg.role === 'assistant' ? 'assistant' as const : 'user' as const,
        content: msg.content
      }));
    
    return { anthropicMessages, systemPrompt };
  }
  
  private extractContent(response: any): string {
    if (!response.content || !response.content[0]) {
      return '';
    }
    
    const contentBlock = response.content[0];
    
    // Check for text content type
    if (contentBlock.type === 'text' && 'text' in contentBlock) {
      return contentBlock.text;
    }
    
    // If it's not a text block or doesn't have the expected structure
    return '';
  }
  
  private handleError(error: any): never {
    const llmError: LLMError = new Error(
      error.message || 'Unknown Anthropic error'
    ) as LLMError;
    
    llmError.provider = this.provider;
    llmError.name = 'AnthropicError';
    
    if (error.status) {
      llmError.statusCode = error.status;
      // Determine if the error is retryable based on status code
      llmError.retryable = [429, 500, 502, 503, 504].includes(error.status);
    } else {
      // Network errors are generally retryable
      llmError.retryable = true;
    }
    
    llmError.rawError = error;
    
    logger.error(`Anthropic error: ${llmError.message}`, {
      statusCode: llmError.statusCode,
      retryable: llmError.retryable
    });
    
    throw llmError;
  }
}
