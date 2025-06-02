/**
 * Google/Gemini Provider Implementation
 */
import { GoogleGenerativeAI } from '@google/generative-ai';
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

export class GoogleClient implements ILLMProviderClient {
  readonly provider: LLMProvider = 'google';
  private client: GoogleGenerativeAI;
  private defaultModel: string;
  
  constructor(
    apiKey: string, 
    options?: { 
      defaultModel?: string;
    }
  ) {
    this.client = new GoogleGenerativeAI(apiKey);
    this.defaultModel = options?.defaultModel || 'gemini-pro';
  }
  
  getProviderName(): LLMProvider {
    return this.provider;
  }
  
  isConfigured(): boolean {
    return !!this.client;
  }
  
  async testConnection(): Promise<boolean> {
    try {
      const model = this.client.getGenerativeModel({ model: this.defaultModel });
      await model.generateContent("Hello");
      return true;
    } catch (error) {
      logger.error(`Google/Gemini connection test failed: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }
  
  async completion(request: Omit<import('./types').LLMCompletionRequest, 'provider'>): Promise<LLMResponse> {
    try {
      const { model = this.defaultModel, prompt, options } = request;
      
      const googleModel = this.client.getGenerativeModel({
        model,
        generationConfig: {
          temperature: options?.temperature,
          maxOutputTokens: options?.maxTokens,
          topP: options?.topP,
          stopSequences: options?.stopSequences,
        }
      });
      
      const result = await googleModel.generateContent(prompt);
      const response = result.response;
      
      // Google doesn't provide token usage in the same way
      // Estimate based on input and output length
      const estimatedPromptTokens = Math.ceil(prompt.length / 4);
      const responseText = response.text();
      const estimatedCompletionTokens = Math.ceil(responseText.length / 4);
      
      const usage: TokenUsage = {
        promptTokens: estimatedPromptTokens,
        completionTokens: estimatedCompletionTokens,
        totalTokens: estimatedPromptTokens + estimatedCompletionTokens
      };
      
      return {
        content: responseText,
        model: model,
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
      
      const googleModel = this.client.getGenerativeModel({
        model,
        generationConfig: {
          temperature: options?.temperature,
          maxOutputTokens: options?.maxTokens,
          topP: options?.topP,
          stopSequences: options?.stopSequences,
        }
      });
      
      // Convert to Google's chat format
      const chat = googleModel.startChat({
        history: this.convertMessagesToGoogleFormat(messages),
      });
      
      // Get the last user message
      const lastUserMessage = messages.filter(m => m.role === 'user').pop();
      if (!lastUserMessage) {
        throw new Error('No user message found in the conversation');
      }
      
      const result = await chat.sendMessage(lastUserMessage.content);
      const response = result.response;
      
      // Estimate token usage
      const inputText = messages.map(m => m.content).join(' ');
      const estimatedPromptTokens = Math.ceil(inputText.length / 4);
      const responseText = response.text();
      const estimatedCompletionTokens = Math.ceil(responseText.length / 4);
      
      const usage: TokenUsage = {
        promptTokens: estimatedPromptTokens,
        completionTokens: estimatedCompletionTokens,
        totalTokens: estimatedPromptTokens + estimatedCompletionTokens
      };
      
      return {
        content: responseText,
        model: model,
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
      
      const googleModel = this.client.getGenerativeModel({
        model,
        generationConfig: {
          temperature: options?.temperature,
          maxOutputTokens: options?.maxTokens,
          topP: options?.topP,
          stopSequences: options?.stopSequences,
        }
      });
      
      // Convert to Google's chat format
      const chat = googleModel.startChat({
        history: this.convertMessagesToGoogleFormat(messages),
      });
      
      // Get the last user message
      const lastUserMessage = messages.filter(m => m.role === 'user').pop();
      if (!lastUserMessage) {
        throw new Error('No user message found in the conversation');
      }
      
      const result = await chat.sendMessageStream(lastUserMessage.content);
      
      for await (const chunk of result.stream) {
        const text = chunk.text();
        
        onChunk({
          content: text,
          isDone: false,
          rawChunk: chunk
        });
      }
      
      // Signal completion
      onChunk({
        content: '',
        isDone: true,
        rawChunk: null
      });
    } catch (error) {
      this.handleError(error);
    }
  }
  
  async countTokens(input: string | LLMMessage[]): Promise<number> {
    // Simplified token counting
    let text = '';
    
    if (typeof input === 'string') {
      text = input;
    } else {
      text = input.map(m => m.content).join(' ');
    }
    
    // Rough approximation: 1 token ≈ 4 characters for English text
    return Math.ceil(text.length / 4);
  }
  
  async listModels(): Promise<string[]> {
    // Google/Gemini doesn't have a list models API, so we'll return the known models
    return [
      'gemini-pro',
      'gemini-pro-vision',
      'gemini-ultra'
    ];
  }

  async getAvailableModels(): Promise<ModelInfo[]> {
    // Google/Gemini model information with current pricing and capabilities
    const models: ModelInfo[] = [
      {
        id: 'gemini-pro',
        name: 'Gemini Pro',
        description: 'Most capable Google AI model for complex reasoning, planning, and understanding.',
        maxTokens: 8192,
        contextWindow: 32768,
        pricing: {
          input: 0.0005,   // $0.5 per 1M tokens
          output: 0.0015   // $1.5 per 1M tokens
        },
        capabilities: {
          chat: true,
          completion: true,
          streaming: true,
          functionCalling: true
        }
      },
      {
        id: 'gemini-pro-vision',
        name: 'Gemini Pro Vision',
        description: 'Multimodal model that can understand both text and images for comprehensive analysis.',
        maxTokens: 8192,
        contextWindow: 32768,
        pricing: {
          input: 0.0005,
          output: 0.0015
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
        id: 'gemini-ultra',
        name: 'Gemini Ultra',
        description: 'Most capable and largest Google AI model, designed for highly complex tasks.',
        maxTokens: 8192,
        contextWindow: 32768,
        pricing: {
          input: 0.002,    // $2 per 1M tokens (estimated)
          output: 0.006    // $6 per 1M tokens (estimated)
        },
        capabilities: {
          chat: true,
          completion: true,
          streaming: true,
          functionCalling: true,
          vision: true
        }
      }
    ];

    return models;
  }
  
  private convertMessagesToGoogleFormat(messages: LLMMessage[]): { role: string, parts: { text: string }[] }[] {
    return messages
      .filter(m => m.role !== 'system') // Google handles system messages differently
      .map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));
  }
  
  private handleError(error: any): never {
    const llmError: LLMError = new Error(
      error.message || 'Unknown Google/Gemini error'
    ) as LLMError;
    
    llmError.provider = this.provider;
    llmError.name = 'GoogleError';
    
    // Google's error format is different, try to extract useful info
    if (error.status) {
      llmError.statusCode = error.status;
      // Determine if the error is retryable based on status code
      llmError.retryable = [429, 500, 502, 503, 504].includes(error.status);
    } else {
      // Network errors are generally retryable
      llmError.retryable = true;
    }
    
    llmError.rawError = error;
    
    logger.error(`Google/Gemini error: ${llmError.message}`, {
      statusCode: llmError.statusCode,
      retryable: llmError.retryable
    });
    
    throw llmError;
  }
}
