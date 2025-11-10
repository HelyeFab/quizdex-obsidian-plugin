/**
 * Unit tests for AIProviderOrchestrator
 *
 * Tests fallback logic, retry mechanisms, and circuit breaker
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AIProviderOrchestrator } from '../services/AIProviderOrchestrator';
import { IAIProvider } from '../services/AIProvider.interface';
import {
	Quiz,
	QuizGenerationOptions,
	AIProviderError,
	ErrorCode,
	DifficultyLevel
} from '../types/quiz.types';

// Mock provider factory
const createMockProvider = (
	name: string,
	shouldSucceed: boolean = true,
	retryable: boolean = true
): IAIProvider => {
	const mockQuiz: Quiz = {
		id: 'test-quiz-123',
		title: `Quiz from ${name}`,
		description: 'Test quiz',
		questions: [
			{
				id: 'q1',
				type: 'multiple-choice',
				question: 'Test question?',
				options: ['A', 'B', 'C', 'D'],
				correctAnswer: 'A'
			}
		],
		createdAt: new Date(),
		sourceNotes: ['test-note']
	};

	const mockError: AIProviderError = {
		code: ErrorCode.PROVIDER_ERROR,
		message: `${name} provider failed`,
		provider: name,
		retryable
	};

	return {
		name,
		displayName: `${name} Provider`,
		initialize: vi.fn(),
		testConnection: vi.fn(async () => true),
		getAvailableModels: vi.fn(async () => ['model-1', 'model-2']),
		generateQuiz: vi.fn(async () => {
			if (!shouldSucceed) {
				throw mockError;
			}
			return mockQuiz;
		}),
		validateModelName: vi.fn(async (name: string) => name),
		isRetryableError: vi.fn((error: AIProviderError) => error.retryable),
		getRetryDelay: vi.fn(() => 100),
		healthCheck: vi.fn(async () => ({ healthy: true }))
	};
};

describe('AIProviderOrchestrator', () => {
	let orchestrator: AIProviderOrchestrator;
	let mockOptions: QuizGenerationOptions;

	beforeEach(() => {
		orchestrator = new AIProviderOrchestrator();
		mockOptions = {
			selectedNotes: [],
			questionCount: 10,
			difficulty: 'medium' as DifficultyLevel,
			includeMultipleChoice: true,
			includeTrueFalse: true
		};
	});

	describe('Provider Registration', () => {
		it('should register providers', () => {
			const provider = createMockProvider('test-provider');
			orchestrator.registerProvider(provider);

			const providers = orchestrator.listProviders();
			expect(providers).toContain('test-provider');
		});

		it('should retrieve registered providers', () => {
			const provider = createMockProvider('ollama');
			orchestrator.registerProvider(provider);

			const retrieved = orchestrator.getProvider('ollama');
			expect(retrieved).toBe(provider);
		});
	});

	describe('Quiz Generation', () => {
		it('should generate quiz with first available provider', async () => {
			const provider = createMockProvider('ollama', true);
			orchestrator.registerProvider(provider);

			const result = await orchestrator.generateQuizWithFallback(
				['test content'],
				mockOptions
			);

			expect(result.success).toBe(true);
			expect(result.quiz).toBeDefined();
			expect(result.provider).toBe('ollama');
		});

		it('should use preferred provider first', async () => {
			const provider1 = createMockProvider('openai', true);
			const provider2 = createMockProvider('ollama', true);

			orchestrator.registerProvider(provider1);
			orchestrator.registerProvider(provider2);

			const result = await orchestrator.generateQuizWithFallback(
				['test content'],
				mockOptions,
				'ollama'
			);

			expect(result.success).toBe(true);
			expect(result.provider).toBe('ollama');
		});
	});

	describe('Fallback Logic', () => {
		it('should fallback to next provider on failure', async () => {
			const failingProvider = createMockProvider('provider1', false, true);
			const successProvider = createMockProvider('provider2', true);

			orchestrator.registerProvider(failingProvider);
			orchestrator.registerProvider(successProvider);

			const result = await orchestrator.generateQuizWithFallback(
				['test content'],
				mockOptions
			);

			expect(result.success).toBe(true);
			expect(result.provider).toBe('provider2');
			expect(result.attemptCount).toBeGreaterThan(1);
		});

		it('should try all providers before giving up', async () => {
			const provider1 = createMockProvider('provider1', false, true);
			const provider2 = createMockProvider('provider2', false, true);
			const provider3 = createMockProvider('provider3', false, true);

			orchestrator.registerProvider(provider1);
			orchestrator.registerProvider(provider2);
			orchestrator.registerProvider(provider3);

			const result = await orchestrator.generateQuizWithFallback(
				['test content'],
				mockOptions
			);

			expect(result.success).toBe(false);
			expect(result.error).toBeDefined();
		});

		it('should stop fallback on non-retryable error', async () => {
			const failingProvider = createMockProvider('provider1', false, false);
			const successProvider = createMockProvider('provider2', true);

			orchestrator.registerProvider(failingProvider);
			orchestrator.registerProvider(successProvider);

			const result = await orchestrator.generateQuizWithFallback(
				['test content'],
				mockOptions
			);

			// Should not reach provider2 due to non-retryable error
			expect(result.success).toBe(false);
			expect(result.attemptCount).toBe(1);
		});
	});

	describe('Circuit Breaker', () => {
		it('should open circuit after threshold failures', async () => {
			const failingProvider = createMockProvider('flaky-provider', false, true);
			orchestrator.registerProvider(failingProvider);

			// Trigger failures (default threshold is 3)
			for (let i = 0; i < 3; i++) {
				await orchestrator.generateQuizWithFallback(
					['test content'],
					mockOptions,
					'flaky-provider'
				);
			}

			const status = orchestrator.getCircuitBreakerStatus();
			const breakerState = status.get('flaky-provider');

			expect(breakerState?.state).toBe('open');
			expect(breakerState?.failures).toBeGreaterThanOrEqual(3);
		});

		it('should skip provider when circuit is open', async () => {
			const failingProvider = createMockProvider('failing', false, true);
			const successProvider = createMockProvider('backup', true);

			orchestrator.registerProvider(failingProvider);
			orchestrator.registerProvider(successProvider);

			// Trip the circuit breaker
			for (let i = 0; i < 3; i++) {
				await orchestrator.generateQuizWithFallback(
					['test content'],
					mockOptions
				);
			}

			// Next request should skip failing provider immediately
			const result = await orchestrator.generateQuizWithFallback(
				['test content'],
				mockOptions,
				'failing'
			);

			expect(result.success).toBe(true);
			expect(result.provider).toBe('backup');
		});

		it('should reset circuit on successful request', async () => {
			const provider = createMockProvider('intermittent', true);
			orchestrator.registerProvider(provider);

			// Successful request
			await orchestrator.generateQuizWithFallback(
				['test content'],
				mockOptions
			);

			const status = orchestrator.getCircuitBreakerStatus();
			const breakerState = status.get('intermittent');

			expect(breakerState?.state).toBe('closed');
			expect(breakerState?.failures).toBe(0);
		});

		it('should allow manual circuit breaker reset', async () => {
			const failingProvider = createMockProvider('failing', false, true);
			orchestrator.registerProvider(failingProvider);

			// Trip circuit breaker
			for (let i = 0; i < 3; i++) {
				await orchestrator.generateQuizWithFallback(
					['test content'],
					mockOptions
				);
			}

			// Manually reset
			orchestrator.resetCircuitBreaker('failing');

			const status = orchestrator.getCircuitBreakerStatus();
			const breakerState = status.get('failing');

			expect(breakerState?.state).toBe('closed');
			expect(breakerState?.failures).toBe(0);
		});
	});

	describe('Health Checks', () => {
		it('should test all registered providers', async () => {
			const provider1 = createMockProvider('provider1', true);
			const provider2 = createMockProvider('provider2', true);

			orchestrator.registerProvider(provider1);
			orchestrator.registerProvider(provider2);

			const results = await orchestrator.testAllProviders();

			expect(results.size).toBe(2);
			expect(results.get('provider1')).toBe(true);
			expect(results.get('provider2')).toBe(true);
		});
	});

	describe('Error Handling', () => {
		it('should track attempt counts', async () => {
			const provider1 = createMockProvider('provider1', false, true);
			const provider2 = createMockProvider('provider2', true);

			orchestrator.registerProvider(provider1);
			orchestrator.registerProvider(provider2);

			const result = await orchestrator.generateQuizWithFallback(
				['test content'],
				mockOptions
			);

			expect(result.attemptCount).toBeGreaterThan(1);
		});

		it('should measure generation duration', async () => {
			const provider = createMockProvider('provider', true);
			orchestrator.registerProvider(provider);

			const result = await orchestrator.generateQuizWithFallback(
				['test content'],
				mockOptions
			);

			expect(result.duration).toBeGreaterThanOrEqual(0);
		});
	});

	describe('Cleanup', () => {
		it('should clean up resources on destroy', () => {
			const provider = createMockProvider('test', true);
			orchestrator.registerProvider(provider);

			orchestrator.destroy();

			expect(orchestrator.listProviders()).toHaveLength(0);
		});
	});
});
