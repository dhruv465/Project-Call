/**
 * LLM Service - Real integration with OpenAI and Anthropic
 * Provides unified interface for interacting with different LLM providers
 */
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
export declare class LLMService {
    private openAIApiKey;
    private anthropicApiKey;
    private preferredProvider;
    private defaultModel;
    constructor(openAIApiKey: string, anthropicApiKey?: string);
    /**
     * Generate a response using the specified or automatic LLM provider
     */
    generateResponse(messages: Message[], provider?: LLMProvider, config?: LLMConfig): Promise<LLMResponse>;
    /**
     * Generate response using OpenAI
     */
    private generateOpenAIResponse;
    /**
     * Generate response using Anthropic
     */
    private generateAnthropicResponse;
    /**
     * Set the preferred LLM provider
     */
    setPreferredProvider(provider: LLMProvider): void;
    /**
     * Set the default model for a provider
     */
    setDefaultModel(provider: LLMProvider, model: string): void;
    /**
     * Selects the optimal provider based on message content
     */
    private selectOptimalProvider;
    /**
     * Estimate token count for given messages
     */
    private estimateTokenCount;
    /**
     * Estimate complexity of the conversation
     */
    private estimateComplexity;
}
export default LLMService;
