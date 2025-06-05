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
    try {
      // Attempt to fetch models from OpenAI API
      return await this.fetchOpenAIModels();
    } catch (error) {
      logger.error(`Failed to fetch OpenAI models details: ${error instanceof Error ? error.message : String(error)}`);
      // Don't provide fallback model info, just return an empty array
      return [];
    }
  }

  private async fetchOpenAIModels(): Promise<ModelInfo[]> {
    try {
      const response = await this.client.models.list();
      
      if (!response.data || !Array.isArray(response.data)) {
        throw new Error('Invalid response format from OpenAI API');
      }
      
      // Filter to only include chat models and create ModelInfo objects
      const chatModels = response.data
        .filter(model => model.id.includes('gpt'))
        .map(model => {
          const displayName = this.formatModelName(model.id);
          
          return {
            id: model.id,
            name: displayName,
            description: `${displayName} - OpenAI language model`,
            // OpenAI API doesn't provide detailed model info, so we use minimal defaults
            maxTokens: 4096, // Conservative default
            contextWindow: 8192, // Conservative default
            capabilities: {
              chat: true,
              completion: true,
              streaming: true,
              // Basic capability detection without hardcoded rules
              functionCalling: model.id.includes('gpt-4') || model.id.includes('gpt-3.5'),
              vision: model.id.includes('gpt-4') && model.id.includes('vision')
            }
          };
        });
      
      return chatModels;
    } catch (error) {
      logger.error(`Error fetching OpenAI models: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  private formatModelName(modelId: string): string {
    // Convert model ID like 'gpt-4-turbo' to 'GPT-4 Turbo'
    return modelId
      .split('-')
      .map(part => {
        if (part === 'gpt') return 'GPT';
        if (part.match(/^\d/)) return part; // Keep version numbers as-is
        return part.charAt(0).toUpperCase() + part.slice(1);
      })
      .join('-');
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
