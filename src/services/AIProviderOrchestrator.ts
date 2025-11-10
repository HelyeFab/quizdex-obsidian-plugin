/**
 * AI Provider Orchestrator - Manages multiple AI providers with fallback logic
 *
 * FEATURES:
 * - Automatic failover between providers
 * - Exponential backoff retry logic
 * - Circuit breaker pattern for failing providers
 * - Request timeout handling
 * - Error classification and recovery
 */

import { Notice } from 'obsidian';
import { IAIProvider } from './AIProvider.interface';
import {
	Quiz,
	QuizGenerationOptions,
	GenerationResult,
	AIProviderError,
	ErrorCode
} from '../types/quiz.types';

interface CircuitBreakerState {
	failures: number;
	lastFailure: number;
	state: 'closed' | 'open' | 'half-open';
}

export class AIProviderOrchestrator {
	private providers: Map<string, IAIProvider> = new Map();
	private circuitBreakers: Map<string, CircuitBreakerState> = new Map();

	// Circuit breaker configuration
	private readonly FAILURE_THRESHOLD = 3;
	private readonly RESET_TIMEOUT = 60000; // 1 minute

	/**
	 * Register an AI provider
	 */
	registerProvider(provider: IAIProvider): void {
		this.providers.set(provider.name, provider);
		this.circuitBreakers.set(provider.name, {
			failures: 0,
			lastFailure: 0,
			state: 'closed'
		});
		console.log(`✅ Registered AI provider: ${provider.displayName}`);
	}

	/**
	 * Get a specific provider
	 */
	getProvider(name: string): IAIProvider | undefined {
		return this.providers.get(name);
	}

	/**
	 * List all registered provider names
	 */
	listProviders(): string[] {
		return Array.from(this.providers.keys());
	}

	/**
	 * Generate quiz with automatic fallback
	 */
	async generateQuizWithFallback(
		noteContents: string[],
		options: QuizGenerationOptions,
		preferredProvider?: string
	): Promise<GenerationResult> {
		const startTime = Date.now();
		const providerOrder = this.determineProviderOrder(preferredProvider);

		let lastError: AIProviderError | undefined;
		let totalAttempts = 0;

		for (const providerName of providerOrder) {
			const provider = this.providers.get(providerName);
			if (!provider) continue;

			// Check circuit breaker
			if (!this.canUseProvider(providerName)) {
				console.warn(`⚠️ Circuit breaker OPEN for ${providerName}, skipping`);
				continue;
			}

			console.log(`🔄 Attempting quiz generation with ${provider.displayName}...`);

			try {
				const quiz = await this.generateWithRetry(
					provider,
					noteContents,
					options
				);

				// Success - reset circuit breaker
				this.recordSuccess(providerName);

				const duration = Date.now() - startTime;
				console.log(`✅ Quiz generated successfully with ${provider.displayName} in ${duration}ms`);

				return {
					success: true,
					quiz,
					provider: providerName,
					attemptCount: totalAttempts + 1,
					duration
				};

			} catch (error) {
				totalAttempts++;
				const providerError = this.normalizeError(error, providerName);
				lastError = providerError;

				this.recordFailure(providerName);

				console.error(`❌ ${provider.displayName} failed:`, providerError.message);

				// If error is not retryable, don't try other providers
				if (!provider.isRetryableError(providerError)) {
					console.warn(`⚠️ Non-retryable error from ${providerName}, stopping fallback`);
					break;
				}
			}
		}

		// All providers failed
		const duration = Date.now() - startTime;
		const errorMessage = lastError
			? `All providers failed. Last error: ${lastError.message}`
			: 'No available AI providers';

		new Notice(`❌ ${errorMessage}`);

		return {
			success: false,
			error: lastError || {
				code: ErrorCode.UNKNOWN_ERROR,
				message: errorMessage,
				provider: 'none',
				retryable: false
			},
			provider: 'none',
			attemptCount: totalAttempts,
			duration
		};
	}

	/**
	 * Generate quiz with retry logic for a single provider
	 */
	private async generateWithRetry(
		provider: IAIProvider,
		noteContents: string[],
		options: QuizGenerationOptions,
		maxRetries: number = 3
	): Promise<Quiz> {
		let lastError: Error | undefined;

		for (let attempt = 0; attempt < maxRetries; attempt++) {
			try {
				// Add timeout wrapper
				const quiz = await this.withTimeout(
					provider.generateQuiz(noteContents, options),
					options.timeout || 60000 // Default 60s timeout
				);

				return quiz;

			} catch (error) {
				lastError = error as Error;
				console.warn(`Attempt ${attempt + 1}/${maxRetries} failed for ${provider.name}`);

				// Wait before retry with exponential backoff
				if (attempt < maxRetries - 1) {
					const delay = provider.getRetryDelay(attempt);
					console.log(`⏳ Waiting ${delay}ms before retry...`);
					await this.sleep(delay);
				}
			}
		}

		throw lastError || new Error('Max retries exceeded');
	}

	/**
	 * Timeout wrapper for promises
	 */
	private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
		return Promise.race([
			promise,
			new Promise<T>((_, reject) =>
				setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs)
			)
		]);
	}

	/**
	 * Determine provider order (preferred first, then others)
	 */
	private determineProviderOrder(preferredProvider?: string): string[] {
		const allProviders = Array.from(this.providers.keys());

		if (!preferredProvider || !this.providers.has(preferredProvider)) {
			return allProviders;
		}

		// Put preferred provider first
		return [
			preferredProvider,
			...allProviders.filter(p => p !== preferredProvider)
		];
	}

	/**
	 * Circuit breaker - check if provider can be used
	 */
	private canUseProvider(providerName: string): boolean {
		const breaker = this.circuitBreakers.get(providerName);
		if (!breaker) return true;

		const now = Date.now();

		switch (breaker.state) {
			case 'closed':
				return true;

			case 'open':
				// Check if enough time has passed to try half-open
				if (now - breaker.lastFailure > this.RESET_TIMEOUT) {
					breaker.state = 'half-open';
					console.log(`🔄 Circuit breaker HALF-OPEN for ${providerName}`);
					return true;
				}
				return false;

			case 'half-open':
				// Allow one request in half-open state
				return true;
		}
	}

	/**
	 * Record successful provider call
	 */
	private recordSuccess(providerName: string): void {
		const breaker = this.circuitBreakers.get(providerName);
		if (!breaker) return;

		breaker.failures = 0;
		breaker.state = 'closed';
	}

	/**
	 * Record failed provider call
	 */
	private recordFailure(providerName: string): void {
		const breaker = this.circuitBreakers.get(providerName);
		if (!breaker) return;

		breaker.failures++;
		breaker.lastFailure = Date.now();

		if (breaker.failures >= this.FAILURE_THRESHOLD) {
			breaker.state = 'open';
			console.warn(`⚠️ Circuit breaker OPENED for ${providerName} after ${breaker.failures} failures`);
			new Notice(`⚠️ ${providerName} temporarily disabled due to errors`);
		}
	}

	/**
	 * Normalize various error types into AIProviderError
	 */
	private normalizeError(error: any, provider: string): AIProviderError {
		// Already an AIProviderError
		if (error.code && error.message && error.provider) {
			return error as AIProviderError;
		}

		// Timeout error
		if (error.message?.includes('Timeout')) {
			return {
				code: ErrorCode.TIMEOUT,
				message: 'Request timed out',
				provider,
				retryable: true
			};
		}

		// Network errors
		if (error.message?.includes('fetch') || error.message?.includes('network')) {
			return {
				code: ErrorCode.NETWORK_ERROR,
				message: error.message || 'Network error occurred',
				provider,
				retryable: true
			};
		}

		// HTTP status codes
		if (error.statusCode) {
			return this.httpStatusToError(error.statusCode, provider, error.message);
		}

		// Unknown error
		return {
			code: ErrorCode.UNKNOWN_ERROR,
			message: error.message || 'Unknown error occurred',
			provider,
			retryable: false
		};
	}

	/**
	 * Convert HTTP status codes to error codes
	 */
	private httpStatusToError(statusCode: number, provider: string, message?: string): AIProviderError {
		if (statusCode === 401) {
			return {
				code: ErrorCode.INVALID_API_KEY,
				message: message || 'Invalid API key',
				provider,
				retryable: false,
				statusCode
			};
		}

		if (statusCode === 403) {
			return {
				code: ErrorCode.FORBIDDEN,
				message: message || 'Access forbidden',
				provider,
				retryable: false,
				statusCode
			};
		}

		if (statusCode === 429) {
			return {
				code: ErrorCode.RATE_LIMIT_EXCEEDED,
				message: message || 'Rate limit exceeded',
				provider,
				retryable: true,
				statusCode
			};
		}

		if (statusCode === 404) {
			return {
				code: ErrorCode.MODEL_NOT_FOUND,
				message: message || 'Model not found',
				provider,
				retryable: false,
				statusCode
			};
		}

		if (statusCode >= 500) {
			return {
				code: ErrorCode.PROVIDER_ERROR,
				message: message || 'Provider server error',
				provider,
				retryable: true,
				statusCode
			};
		}

		return {
			code: ErrorCode.UNKNOWN_ERROR,
			message: message || `HTTP ${statusCode}`,
			provider,
			retryable: statusCode >= 500,
			statusCode
		};
	}

	/**
	 * Test all providers and return health status
	 */
	async testAllProviders(): Promise<Map<string, boolean>> {
		const results = new Map<string, boolean>();

		for (const [name, provider] of this.providers) {
			try {
				const healthy = await provider.testConnection();
				results.set(name, healthy);
			} catch (error) {
				console.error(`Failed to test provider ${name}:`, error);
				results.set(name, false);
			}
		}

		return results;
	}

	/**
	 * Get circuit breaker status for all providers
	 */
	getCircuitBreakerStatus(): Map<string, CircuitBreakerState> {
		return new Map(this.circuitBreakers);
	}

	/**
	 * Manually reset a circuit breaker
	 */
	resetCircuitBreaker(providerName: string): void {
		const breaker = this.circuitBreakers.get(providerName);
		if (breaker) {
			breaker.failures = 0;
			breaker.state = 'closed';
			console.log(`🔄 Circuit breaker RESET for ${providerName}`);
		}
	}

	/**
	 * Sleep utility
	 */
	private sleep(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms));
	}

	/**
	 * Clean up resources
	 */
	destroy(): void {
		this.providers.clear();
		this.circuitBreakers.clear();
	}
}
