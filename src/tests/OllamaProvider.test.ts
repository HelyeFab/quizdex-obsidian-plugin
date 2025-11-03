/**
 * Unit tests for OllamaProvider
 *
 * Tests local LLM provider integration, model validation, and prompt handling
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { OllamaProvider } from '../services/providers/OllamaProvider';
import {
	AIProviderConfig,
	QuizGenerationOptions,
	ErrorCode,
	DifficultyLevel
} from '../types/quiz.types';
import { requestUrl } from 'obsidian';

// Mock Obsidian's requestUrl
vi.mock('obsidian', () => ({
	requestUrl: vi.fn(),
	Notice: vi.fn()
}));

describe('OllamaProvider', () => {
	let provider: OllamaProvider;
	let mockConfig: AIProviderConfig;
	let mockOptions: QuizGenerationOptions;

	beforeEach(() => {
		provider = new OllamaProvider();
		mockConfig = {
			baseURL: 'http://localhost:11434',
			model: 'llama3.1:8b',
			timeout: 60000,
			maxRetries: 3,
			maxPromptCharacters: 12000,
			keepAliveSeconds: 300
		};
		mockOptions = {
			selectedNotes: [],
			questionCount: 10,
			difficulty: 'medium' as DifficultyLevel,
			includeMultipleChoice: true,
			includeTrueFalse: true
		};
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('Initialization', () => {
		it('should initialize with valid config', async () => {
			await provider.initialize(mockConfig);
			expect(provider.name).toBe('ollama');
			expect(provider.displayName).toBe('Ollama (Local)');
		});

		it('should handle missing config gracefully', async () => {
			const emptyProvider = new OllamaProvider();
			const healthy = await emptyProvider.testConnection();
			expect(healthy).toBe(false);
		});
	});

	describe('Connection Testing', () => {
		beforeEach(async () => {
			await provider.initialize(mockConfig);
		});

		it('should test connection successfully', async () => {
			vi.mocked(requestUrl).mockResolvedValueOnce({
				status: 200,
				json: { models: [] },
				text: '',
				arrayBuffer: new ArrayBuffer(0),
				headers: {}
			});

			const result = await provider.testConnection();
			expect(result).toBe(true);
			expect(requestUrl).toHaveBeenCalledWith({
				url: 'http://localhost:11434/api/tags',
				method: 'GET',
				throw: false
			});
		});

		it('should handle connection failure', async () => {
			vi.mocked(requestUrl).mockResolvedValueOnce({
				status: 500,
				json: {},
				text: '',
				arrayBuffer: new ArrayBuffer(0),
				headers: {}
			});

			const result = await provider.testConnection();
			expect(result).toBe(false);
		});

		it('should handle network errors', async () => {
			vi.mocked(requestUrl).mockRejectedValueOnce(new Error('Network error'));

			const result = await provider.testConnection();
			expect(result).toBe(false);
		});
	});

	describe('Model Management', () => {
		beforeEach(async () => {
			await provider.initialize(mockConfig);
		});

		it('should fetch available models', async () => {
			const mockModels = [
				{ name: 'llama3.1:8b' },
				{ name: 'mistral:latest' },
				{ name: 'phi3:mini' }
			];

			vi.mocked(requestUrl).mockResolvedValueOnce({
				status: 200,
				json: { models: mockModels },
				text: '',
				arrayBuffer: new ArrayBuffer(0),
				headers: {}
			});

			const models = await provider.getAvailableModels();
			expect(models).toEqual(['llama3.1:8b', 'mistral:latest', 'phi3:mini']);
		});

		it('should cache model list for performance', async () => {
			const mockModels = [{ name: 'llama3.1:8b' }];

			vi.mocked(requestUrl).mockResolvedValueOnce({
				status: 200,
				json: { models: mockModels },
				text: '',
				arrayBuffer: new ArrayBuffer(0),
				headers: {}
			});

			// First call - should hit API
			const models1 = await provider.getAvailableModels();
			expect(requestUrl).toHaveBeenCalledTimes(1);

			// Second call - should use cache
			const models2 = await provider.getAvailableModels();
			expect(requestUrl).toHaveBeenCalledTimes(1); // Still 1, not 2
			expect(models1).toEqual(models2);
		});

		it('should handle empty model list', async () => {
			vi.mocked(requestUrl).mockResolvedValueOnce({
				status: 200,
				json: { models: [] },
				text: '',
				arrayBuffer: new ArrayBuffer(0),
				headers: {}
			});

			const models = await provider.getAvailableModels();
			expect(models).toEqual([]);
		});

		it('should validate exact model match', async () => {
			const mockModels = [{ name: 'llama3.1:8b' }];

			vi.mocked(requestUrl).mockResolvedValueOnce({
				status: 200,
				json: { models: mockModels },
				text: '',
				arrayBuffer: new ArrayBuffer(0),
				headers: {}
			});

			const validated = await provider.validateModelName('llama3.1:8b');
			expect(validated).toBe('llama3.1:8b');
		});

		it('should correct partial model names', async () => {
			const mockModels = [{ name: 'llama3.1:8b' }, { name: 'llama3.1:latest' }];

			vi.mocked(requestUrl).mockResolvedValueOnce({
				status: 200,
				json: { models: mockModels },
				text: '',
				arrayBuffer: new ArrayBuffer(0),
				headers: {}
			});

			const validated = await provider.validateModelName('llama3.1');
			expect(validated).toMatch(/llama3\.1:/);
		});

		it('should return model as-is if not found', async () => {
			vi.mocked(requestUrl).mockResolvedValueOnce({
				status: 200,
				json: { models: [] },
				text: '',
				arrayBuffer: new ArrayBuffer(0),
				headers: {}
			});

			const validated = await provider.validateModelName('nonexistent-model');
			expect(validated).toBe('nonexistent-model');
		});
	});

	describe('Quiz Generation', () => {
		beforeEach(async () => {
			await provider.initialize(mockConfig);
		});

		it('should generate quiz successfully', async () => {
			const mockResponse = {
				id: 'q1',
				title: 'Test Quiz',
				description: 'A test quiz',
				questions: [
					{
						id: 'q1',
						type: 'multiple-choice',
						question: 'What is 2+2?',
						options: ['A) 3', 'B) 4', 'C) 5', 'D) 6'],
						correctAnswer: 'B',
						explanation: 'Basic math'
					}
				]
			};

			// Mock model validation
			vi.mocked(requestUrl).mockResolvedValueOnce({
				status: 200,
				json: { models: [{ name: 'llama3.1:8b' }] },
				text: '',
				arrayBuffer: new ArrayBuffer(0),
				headers: {}
			});

			// Mock quiz generation
			vi.mocked(requestUrl).mockResolvedValueOnce({
				status: 200,
				json: {
					response: JSON.stringify(mockResponse),
					eval_count: 100,
					prompt_eval_count: 50
				},
				text: '',
				arrayBuffer: new ArrayBuffer(0),
				headers: {}
			});

			const quiz = await provider.generateQuiz(['Test content'], mockOptions);

			expect(quiz).toBeDefined();
			expect(quiz.title).toBe('Test Quiz');
			expect(quiz.questions).toHaveLength(1);
			expect(quiz.questions[0].question).toBe('What is 2+2?');
		});

		it('should truncate long content when maxPromptCharacters is set', async () => {
			const longContent = 'a'.repeat(20000);

			// Mock model validation
			vi.mocked(requestUrl).mockResolvedValueOnce({
				status: 200,
				json: { models: [{ name: 'llama3.1:8b' }] },
				text: '',
				arrayBuffer: new ArrayBuffer(0),
				headers: {}
			});

			// Mock quiz generation
			vi.mocked(requestUrl).mockResolvedValueOnce({
				status: 200,
				json: {
					response: JSON.stringify({
						title: 'Test',
						description: 'Test',
						questions: []
					})
				},
				text: '',
				arrayBuffer: new ArrayBuffer(0),
				headers: {}
			});

			await provider.generateQuiz([longContent], mockOptions);

			// Verify the request was made with truncated content
			const lastCall = vi.mocked(requestUrl).mock.calls[1];
			const requestParams = typeof lastCall[0] === 'string' ? { body: '{}' } : lastCall[0];
			const requestBody = JSON.parse(requestParams.body as string);
			expect(requestBody.prompt.length).toBeLessThan(20000);
		});

		it('should handle API errors gracefully', async () => {
			// Mock model validation
			vi.mocked(requestUrl).mockResolvedValueOnce({
				status: 200,
				json: { models: [{ name: 'llama3.1:8b' }] },
				text: '',
				arrayBuffer: new ArrayBuffer(0),
				headers: {}
			});

			// Mock failed generation
			vi.mocked(requestUrl).mockResolvedValueOnce({
				status: 500,
				json: {},
				text: '',
				arrayBuffer: new ArrayBuffer(0),
				headers: {}
			});

			await expect(
				provider.generateQuiz(['Test content'], mockOptions)
			).rejects.toThrow();
		});

		it('should handle invalid JSON responses', async () => {
			// Mock model validation
			vi.mocked(requestUrl).mockResolvedValueOnce({
				status: 200,
				json: { models: [{ name: 'llama3.1:8b' }] },
				text: '',
				arrayBuffer: new ArrayBuffer(0),
				headers: {}
			});

			// Mock invalid response
			vi.mocked(requestUrl).mockResolvedValueOnce({
				status: 200,
				json: {
					response: 'This is not valid JSON'
				},
				text: '',
				arrayBuffer: new ArrayBuffer(0),
				headers: {}
			});

			await expect(
				provider.generateQuiz(['Test content'], mockOptions)
			).rejects.toThrow();
		});

		it('should use keep_alive setting when configured', async () => {
			// Mock model validation
			vi.mocked(requestUrl).mockResolvedValueOnce({
				status: 200,
				json: { models: [{ name: 'llama3.1:8b' }] },
				text: '',
				arrayBuffer: new ArrayBuffer(0),
				headers: {}
			});

			// Mock quiz generation
			vi.mocked(requestUrl).mockResolvedValueOnce({
				status: 200,
				json: {
					response: JSON.stringify({
						title: 'Test',
						description: 'Test',
						questions: []
					})
				},
				text: '',
				arrayBuffer: new ArrayBuffer(0),
				headers: {}
			});

			await provider.generateQuiz(['Test'], mockOptions);

			const lastCall = vi.mocked(requestUrl).mock.calls[1];
			const requestParams = typeof lastCall[0] === 'string' ? { body: '{}' } : lastCall[0];
			const requestBody = JSON.parse(requestParams.body as string);
			expect(requestBody.keep_alive).toBe(300);
		});
	});

	describe('Error Classification', () => {
		it('should identify retryable errors', () => {
			const error = {
				code: ErrorCode.NETWORK_ERROR,
				message: 'Network failed',
				provider: 'ollama',
				retryable: true
			};

			expect(provider.isRetryableError(error)).toBe(true);
		});

		it('should identify non-retryable errors', () => {
			const error = {
				code: ErrorCode.INVALID_API_KEY,
				message: 'Bad key',
				provider: 'ollama',
				retryable: false
			};

			expect(provider.isRetryableError(error)).toBe(false);
		});
	});

	describe('Retry Delay', () => {
		it('should calculate exponential backoff', () => {
			expect(provider.getRetryDelay(0)).toBe(1000);
			expect(provider.getRetryDelay(1)).toBe(2000);
			expect(provider.getRetryDelay(2)).toBe(4000);
			expect(provider.getRetryDelay(3)).toBe(8000);
		});

		it('should cap retry delay at 10 seconds', () => {
			expect(provider.getRetryDelay(10)).toBe(10000);
			expect(provider.getRetryDelay(100)).toBe(10000);
		});
	});

	describe('Health Check', () => {
		beforeEach(async () => {
			await provider.initialize(mockConfig);
		});

		it('should return healthy status when connection succeeds', async () => {
			vi.mocked(requestUrl).mockResolvedValueOnce({
				status: 200,
				json: { models: [] },
				text: '',
				arrayBuffer: new ArrayBuffer(0),
				headers: {}
			});

			const health = await provider.healthCheck();
			expect(health.healthy).toBe(true);
			expect(health.latency).toBeGreaterThanOrEqual(0);
			expect(health.message).toContain('responding');
		});

		it('should return unhealthy status when connection fails', async () => {
			vi.mocked(requestUrl).mockResolvedValueOnce({
				status: 500,
				json: {},
				text: '',
				arrayBuffer: new ArrayBuffer(0),
				headers: {}
			});

			const health = await provider.healthCheck();
			expect(health.healthy).toBe(false);
			expect(health.message).toContain('unreachable');
		});
	});
});
