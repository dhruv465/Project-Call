/**
 * LLM Service Base Interface
 * 
 * This file defines the base interface that all LLM providers must implement.
 */

import {
  LLMProvider,
  LLMChatRequest,
  LLMCompletionRequest,
  LLMResponse,
  LLMStreamChunk,
  ModelInfo
} from './types';

/**
 * Base interface for all LLM provider implementations
 */
export interface ILLMProviderClient {
  readonly provider: LLMProvider;
  
  /**
   * Get the name of the provider
   */
  getProviderName(): LLMProvider;
  
  /**
   * Check if the client is properly configured with API keys
   */
  isConfigured(): boolean;
  
  /**
   * Test the connection to the LLM service
   */
  testConnection(): Promise<boolean>;
  
  /**
   * Generate a completion from a prompt
   */
  completion(request: Omit<LLMCompletionRequest, 'provider'>): Promise<LLMResponse>;
  
  /**
   * Generate a chat completion from a list of messages
   */
  chat(request: Omit<LLMChatRequest, 'provider'>): Promise<LLMResponse>;
  
  /**
   * Stream a chat completion
   */
  streamChat(
    request: Omit<LLMChatRequest, 'provider'>,
    onChunk: (chunk: LLMStreamChunk) => void
  ): Promise<void>;
  
  /**
   * Use Realtime API for ultra-low latency responses (OpenAI specific)
   */
  realtimeChat?(
    request: Omit<LLMChatRequest, 'provider'>,
    onChunk: (chunk: LLMStreamChunk) => void
  ): Promise<void>;
  
  /**
   * Count tokens for a prompt or messages
   */
  countTokens(input: string | import('./types').LLMMessage[]): Promise<number>;
  
  /**
   * Get detailed information about available models
   */
  getAvailableModels(): Promise<ModelInfo[]>;
  
  /**
   * Legacy method to list available models (use getAvailableModels instead)
   */
  listModels?(): Promise<string[]>;
}
