"use strict";
/**
 * LLM Service - Real integration with OpenAI and Anthropic
 * Provides unified interface for interacting with different LLM providers
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LLMService = void 0;
const axios_1 = __importDefault(require("axios"));
const index_1 = require("../index");
class LLMService {
    constructor(openAIApiKey, anthropicApiKey) {
        this.preferredProvider = 'auto';
        this.defaultModel = {
            openai: 'gpt-4',
            anthropic: 'claude-2',
            auto: 'gpt-4'
        };
        this.openAIApiKey = openAIApiKey;
        this.anthropicApiKey = anthropicApiKey || '';
    }
    /**
     * Generate a response using the specified or automatic LLM provider
     */
    async generateResponse(messages, provider = this.preferredProvider, config = {}) {
        // Auto-select provider if set to 'auto'
        const actualProvider = provider === 'auto'
            ? this.selectOptimalProvider(messages)
            : provider;
        // If selected provider is not available, fallback
        if ((actualProvider === 'anthropic' && !this.anthropicApiKey) ||
            (actualProvider === 'openai' && !this.openAIApiKey)) {
            const fallbackProvider = this.anthropicApiKey ? 'anthropic' : 'openai';
            index_1.logger.warn(`Selected provider ${actualProvider} not available. Falling back to ${fallbackProvider}`);
            return this.generateResponse(messages, fallbackProvider, config);
        }
        try {
            // Generate response with selected provider
            if (actualProvider === 'openai') {
                return await this.generateOpenAIResponse(messages, config);
            }
            else {
                return await this.generateAnthropicResponse(messages, config);
            }
        }
        catch (error) {
            // Try fallback if primary provider fails
            if (this.preferredProvider === 'auto' && provider !== 'auto') {
                const fallbackProvider = provider === 'openai' ? 'anthropic' : 'openai';
                if ((fallbackProvider === 'anthropic' && this.anthropicApiKey) ||
                    (fallbackProvider === 'openai' && this.openAIApiKey)) {
                    index_1.logger.warn(`Provider ${provider} failed. Falling back to ${fallbackProvider}`);
                    return this.generateResponse(messages, fallbackProvider, config);
                }
            }
            index_1.logger.error(`Error generating LLM response: ${(0, index_1.getErrorMessage)(error)}`);
            throw error;
        }
    }
    /**
     * Generate response using OpenAI
     */
    async generateOpenAIResponse(messages, config = {}) {
        try {
            const model = config.model || this.defaultModel.openai;
            const response = await axios_1.default.post('https://api.openai.com/v1/chat/completions', {
                model,
                messages,
                temperature: config.temperature ?? 0.7,
                max_tokens: config.maxTokens ?? 800,
                stop: config.stopSequences,
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.openAIApiKey}`,
                },
            });
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
        }
        catch (error) {
            index_1.logger.error(`OpenAI API error: ${(0, index_1.getErrorMessage)(error)}`);
            throw new Error(`OpenAI API error: ${(0, index_1.getErrorMessage)(error)}`);
        }
    }
    /**
     * Generate response using Anthropic
     */
    async generateAnthropicResponse(messages, config = {}) {
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
                }
                else if (message.role === 'assistant') {
                    prompt += `Assistant: ${message.content}\n\n`;
                }
            }
            // Add final prompt for Claude to respond to
            prompt += 'Assistant: ';
            const response = await axios_1.default.post('https://api.anthropic.com/v1/complete', {
                prompt,
                model,
                max_tokens_to_sample: config.maxTokens ?? 800,
                temperature: config.temperature ?? 0.7,
                stop_sequences: config.stopSequences || ['\n\nHuman:'],
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.anthropicApiKey,
                    'anthropic-version': '2023-06-01',
                },
            });
            return {
                text: response.data.completion.trim(),
                provider: 'anthropic',
                model,
                rawResponse: response.data,
            };
        }
        catch (error) {
            index_1.logger.error(`Anthropic API error: ${(0, index_1.getErrorMessage)(error)}`);
            throw new Error(`Anthropic API error: ${(0, index_1.getErrorMessage)(error)}`);
        }
    }
    /**
     * Set the preferred LLM provider
     */
    setPreferredProvider(provider) {
        this.preferredProvider = provider;
    }
    /**
     * Set the default model for a provider
     */
    setDefaultModel(provider, model) {
        this.defaultModel[provider] = model;
    }
    /**
     * Selects the optimal provider based on message content
     */
    selectOptimalProvider(messages) {
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
    estimateTokenCount(messages) {
        // Simple estimation: ~4 chars per token
        return messages.reduce((count, msg) => count + Math.ceil(msg.content.length / 4), 0);
    }
    /**
     * Estimate complexity of the conversation
     */
    estimateComplexity(messages) {
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
exports.LLMService = LLMService;
exports.default = LLMService;
//# sourceMappingURL=llmService.js.map