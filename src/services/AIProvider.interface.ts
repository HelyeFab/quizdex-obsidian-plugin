/**
 * Provider Abstraction Layer - Interface for all AI providers
 *
 * This allows QuizDex to support multiple AI providers with a unified interface
 */

import { Quiz, QuizGenerationOptions, AIProviderConfig, AIProviderError } from '../types/quiz.types';

export interface IAIProvider {
	/**
	 * Unique identifier for this provider
	 */
	readonly name: string;

	/**
	 * Human-readable display name
	 */
	readonly displayName: string;

	/**
	 * Initialize the provider with configuration
	 */
	initialize(config: AIProviderConfig): Promise<void>;

	/**
	 * Test if the provider is properly configured and accessible
	 */
	testConnection(): Promise<boolean>;

	/**
	 * Get list of available models from the provider
	 */
	getAvailableModels(): Promise<string[]>;

	/**
	 * Generate a quiz from the provided content
	 * @throws AIProviderError on failure
	 */
	generateQuiz(
		noteContents: string[],
		options: QuizGenerationOptions
	): Promise<Quiz>;

	/**
	 * Validate and normalize a model name for this provider
	 */
	validateModelName(modelName: string): Promise<string>;

	/**
	 * Check if an error is retryable
	 */
	isRetryableError(error: AIProviderError): boolean;

	/**
	 * Get suggested retry delay in milliseconds
	 */
	getRetryDelay(attemptNumber: number): number;

	/**
	 * Provider-specific health check
	 */
	healthCheck(): Promise<{
		healthy: boolean;
		latency?: number;
		message?: string;
	}>;
}

/**
 * Base configuration all providers need
 */
export interface BaseProviderConfig {
	baseURL: string;
	model: string;
	timeout?: number;
	maxRetries?: number;
}
