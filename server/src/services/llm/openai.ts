/**
 * OpenAI Provider Implementation
 */
import { OpenAI } from 'openai';
import { ILLMProviderClient } from './base';
import { 
  LLMProvider,
  LLMMessage,
  LLMResponse,
  LLMStreamChunk,
  LLMError,
  TokenUsage,
  LLMRequestOptions,
  ModelInfo
} from './types';
import { logger } from '../../index';

export class OpenAIClient implements ILLMProviderClient {
  readonly provider: LLMProvider = 'openai';
  private client: OpenAI;
  private defaultModel: string;
  
  constructor(
    apiKey: string, 
    options?: { 
      organization?: string;
      baseUrl?: string;
      defaultModel?: string;
    }
  ) {
    this.client = new OpenAI({
      apiKey: apiKey,
      organization: options?.organization,
      baseURL: options?.baseUrl
    });
    
    this.defaultModel = options?.defaultModel || 'gpt-3.5-turbo';
  }
  
  getProviderName(): LLMProvider {
    return this.provider;
  }
  
  isConfigured(): boolean {
    return !!this.client;
  }
  
  async testConnection(): Promise<boolean> {
    try {
      // Use a simple model list request to test connectivity
      await this.client.models.list();
      return true;
    } catch (error) {
      logger.error(`OpenAI connection test failed: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }
  
  async completion(request: Omit<import('./types').LLMCompletionRequest, 'provider'>): Promise<LLMResponse> {
    try {
      const { model = this.defaultModel, prompt, options } = request;
      
      // OpenAI has deprecated the completions endpoint in favor of chat completions
      // So we'll convert this to a chat completion with the prompt as a user message
      const response = await this.client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: options?.temperature,
        max_tokens: options?.maxTokens,
        top_p: options?.topP,
        frequency_penalty: options?.frequencyPenalty,
        presence_penalty: options?.presencePenalty,
        stop: options?.stopSequences,
      });
      
      const usage: TokenUsage = {
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0
      };
      
      return {
        content: response.choices[0].message.content || '',
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
      
      // Convert our standard message format to OpenAI's format
      const openAIMessages = messages.map(msg => {
        if (msg.role === 'function') {
          return {
            role: msg.role,
            content: msg.content,
            name: 'function' // Required for function messages
          } as const;
        }
        return {
          role: msg.role as 'system' | 'user' | 'assistant',
          content: msg.content
        } as const;
      });
      
      const response = await this.client.chat.completions.create({
        model,
        messages: openAIMessages,
        temperature: options?.temperature,
        max_tokens: options?.maxTokens,
        top_p: options?.topP,
        frequency_penalty: options?.frequencyPenalty,
        presence_penalty: options?.presencePenalty,
        stop: options?.stopSequences,
      });
      
      const usage: TokenUsage = {
        promptTokens: response.usage?.prompt_tokens || 0,
        completionTokens: response.usage?.completion_tokens || 0,
        totalTokens: response.usage?.total_tokens || 0
      };
      
      return {
        content: response.choices[0].message.content || '',
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
      
      // Convert our standard message format to OpenAI's format
      const openAIMessages = messages.map(msg => {
        if (msg.role === 'function') {
          return {
            role: msg.role,
            content: msg.content,
            name: 'function' // Required for function messages
          } as const;
        }
        return {
          role: msg.role as 'system' | 'user' | 'assistant',
          content: msg.content
        } as const;
      });
      
      const stream = await this.client.chat.completions.create({
        model,
        messages: openAIMessages,
        temperature: options?.temperature,
        max_tokens: options?.maxTokens,
        top_p: options?.topP,
        frequency_penalty: options?.frequencyPenalty,
        presence_penalty: options?.presencePenalty,
        stop: options?.stopSequences,
        stream: true
      });
      
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        const isDone = chunk.choices[0]?.finish_reason !== null;
        
        onChunk({
          content,
          isDone,
          rawChunk: chunk
        });
      }
    } catch (error) {
      this.handleError(error);
    }
  }
  
  async countTokens(input: string | LLMMessage[]): Promise<number> {
    // Note: This is a simplified token counting method
    // For production, consider using a proper tokenizer like tiktoken
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
    try {
      const response = await this.client.models.list();
      // Filter to only include chat models
      const chatModels = response.data
        .filter(model => model.id.includes('gpt'))
        .map(model => model.id);
      
      return chatModels;
    } catch (error) {
      this.handleError(error);
      return [];
    }
  }

  async getAvailableModels(): Promise<ModelInfo[]> {
    // OpenAI model information with current pricing and capabilities
    const models: ModelInfo[] = [
      {
        id: 'gpt-4-turbo',
        name: 'GPT-4 Turbo',
        description: 'Latest GPT-4 model with improved instruction following, JSON mode, reproducible outputs, parallel function calling, and more.',
        maxTokens: 4096,
        contextWindow: 128000,
        pricing: {
          input: 0.01,   // $0.01 per 1K tokens
          output: 0.03   // $0.03 per 1K tokens
        },
        capabilities: {
          chat: true,
          completion: true,
          streaming: true,
          functionCalling: true,
          vision: true
        }
      },
      {
        id: 'gpt-4-turbo-preview',
        name: 'GPT-4 Turbo Preview',
        description: 'Preview version of GPT-4 Turbo with the latest improvements.',
        maxTokens: 4096,
        contextWindow: 128000,
        pricing: {
          input: 0.01,
          output: 0.03
        },
        capabilities: {
          chat: true,
          completion: true,
          streaming: true,
          functionCalling: true,
          vision: true
        }
      },
      {
        id: 'gpt-4',
        name: 'GPT-4',
        description: 'More capable than any GPT-3.5 model, able to do more complex tasks, and optimized for chat.',
        maxTokens: 8192,
        contextWindow: 8192,
        pricing: {
          input: 0.03,
          output: 0.06
        },
        capabilities: {
          chat: true,
          completion: true,
          streaming: true,
          functionCalling: true
        }
      },
      {
        id: 'gpt-4-32k',
        name: 'GPT-4 32K',
        description: 'Same capabilities as the base gpt-4 mode but with 4x the context length.',
        maxTokens: 32768,
        contextWindow: 32768,
        pricing: {
          input: 0.06,
          output: 0.12
        },
        capabilities: {
          chat: true,
          completion: true,
          streaming: true,
          functionCalling: true
        }
      },
      {
        id: 'gpt-3.5-turbo',
        name: 'GPT-3.5 Turbo',
        description: 'Most capable GPT-3.5 model and optimized for chat at 1/10th the cost of text-davinci-003.',
        maxTokens: 4096,
        contextWindow: 16385,
        pricing: {
          input: 0.0015,
          output: 0.002
        },
        capabilities: {
          chat: true,
          completion: true,
          streaming: true,
          functionCalling: true
        }
      },
      {
        id: 'gpt-3.5-turbo-16k',
        name: 'GPT-3.5 Turbo 16K',
        description: 'Same capabilities as the standard gpt-3.5-turbo model but with 4 times the context.',
        maxTokens: 16384,
        contextWindow: 16384,
        pricing: {
          input: 0.003,
          output: 0.004
        },
        capabilities: {
          chat: true,
          completion: true,
          streaming: true,
          functionCalling: true
        }
      }
    ];

    return models;
  }
  
  private handleError(error: any): never {
    const llmError: LLMError = new Error(
      error.message || 'Unknown OpenAI error'
    ) as LLMError;
    
    llmError.provider = this.provider;
    llmError.name = 'OpenAIError';
    
    if (error.response) {
      llmError.statusCode = error.response.status;
      llmError.errorCode = error.response.data?.error?.code;
      // Determine if the error is retryable based on status code
      llmError.retryable = [429, 500, 502, 503, 504].includes(error.response.status);
    } else {
      // Network errors are generally retryable
      llmError.retryable = true;
    }
    
    llmError.rawError = error;
    
    logger.error(`OpenAI error: ${llmError.message}`, {
      statusCode: llmError.statusCode,
      errorCode: llmError.errorCode,
      retryable: llmError.retryable
    });
    
    throw llmError;
  }
}
