/**
 * Provider Factory - Creates and configures all AI providers
 */

import { AIProviderOrchestrator } from './AIProviderOrchestrator';
import { OllamaProvider } from './providers/OllamaProvider';
import { OpenAIProvider } from './providers/OpenAIProvider';
import { AIProviderConfig } from '../types/quiz.types';

export class ProviderFactory {
	/**
	 * Initialize all providers and register them with the orchestrator
	 */
	static async initializeAll(
		orchestrator: AIProviderOrchestrator,
		getConfig: (provider: string) => Promise<AIProviderConfig | null>
	): Promise<void> {
		// Register Ollama (local, no API key required)
		const ollamaConfig = await getConfig('ollama');
		if (ollamaConfig) {
			const ollamaProvider = new OllamaProvider();
			await ollamaProvider.initialize(ollamaConfig);
			orchestrator.registerProvider(ollamaProvider);
		}

		// Register OpenAI
		const openaiConfig = await getConfig('openai');
		if (openaiConfig && openaiConfig.apiKey) {
			const openaiProvider = new OpenAIProvider();
			await openaiProvider.initialize(openaiConfig);
			orchestrator.registerProvider(openaiProvider);
		}

		// TODO: Add remaining providers as they're implemented
		// - Anthropic
		// - Google
		// - Perplexity
		// - Mistral
		// - Cohere
	}

	/**
	 * Get list of all supported provider names
	 */
	static getSupportedProviders(): string[] {
		return [
			'ollama',
			'openai',
			'anthropic',
			'google',
			'perplexity',
			'mistral',
			'cohere'
		];
	}

	/**
	 * Get display name for a provider
	 */
	static getProviderDisplayName(provider: string): string {
		const displayNames: Record<string, string> = {
			'ollama': 'Ollama (Local)',
			'openai': 'OpenAI',
			'anthropic': 'Anthropic',
			'google': 'Google AI',
			'perplexity': 'Perplexity',
			'mistral': 'Mistral AI',
			'cohere': 'Cohere'
		};

		return displayNames[provider] || provider;
	}

	/**
	 * Check if provider requires API key
	 */
	static requiresApiKey(provider: string): boolean {
		return provider !== 'ollama'; // Only Ollama doesn't need an API key
	}
}
