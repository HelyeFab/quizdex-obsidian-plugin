/**
 * Integration tests for end-to-end quiz generation flow
 *
 * Tests the complete workflow from note reading to quiz generation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AIProviderOrchestrator } from '../../services/AIProviderOrchestrator';
import { OllamaProvider } from '../../services/providers/OllamaProvider';
import { QuizGenerationOptions, DifficultyLevel } from '../../types/quiz.types';
import { requestUrl } from 'obsidian';

vi.mock('obsidian', () => ({
	requestUrl: vi.fn(),
	Notice: vi.fn()
}));

describe('Quiz Generation Integration', () => {
	let orchestrator: AIProviderOrchestrator;
	let ollamaProvider: OllamaProvider;

	const mockNoteContent = `
# JavaScript Fundamentals

## Variables
Variables in JavaScript can be declared using let, const, or var.
- let: block-scoped variable
- const: block-scoped constant
- var: function-scoped variable (legacy)

## Functions
Functions are first-class citizens in JavaScript.
They can be passed as arguments, returned from other functions, and assigned to variables.

## Closures
A closure is a function that has access to variables in its outer scope, even after the outer function has returned.
	`.trim();

	const mockQuizResponse = {
		title: 'JavaScript Fundamentals Quiz',
		description: 'Test your knowledge of JavaScript basics',
		questions: [
			{
				id: 'q1',
				type: 'multiple-choice',
				question: 'Which keyword creates a block-scoped constant?',
				options: ['A) var', 'B) let', 'C) const', 'D) function'],
				correctAnswer: 'C',
				explanation: 'const creates a block-scoped constant that cannot be reassigned'
			},
			{
				id: 'q2',
				type: 'true-false',
				question: 'Functions in JavaScript are first-class citizens',
				correctAnswer: 'true',
				explanation: 'Functions can be passed as arguments, returned, and assigned to variables'
			}
		]
	};

	beforeEach(() => {
		orchestrator = new AIProviderOrchestrator();
		ollamaProvider = new OllamaProvider();
		vi.clearAllMocks();
	});

	describe('Full Generation Pipeline', () => {
		it('should generate quiz from note content successfully', async () => {
			// Setup provider
			await ollamaProvider.initialize({
				baseURL: 'http://localhost:11434',
				model: 'llama3.1:8b'
			});

			orchestrator.registerProvider(ollamaProvider);

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
					response: JSON.stringify(mockQuizResponse),
					eval_count: 250,
					prompt_eval_count: 150
				},
				text: '',
				arrayBuffer: new ArrayBuffer(0),
				headers: {}
			});

			const options: QuizGenerationOptions = {
				selectedNotes: [],
				questionCount: 10,
				difficulty: 'medium' as DifficultyLevel,
				includeMultipleChoice: true,
				includeTrueFalse: true,
				modelOverride: 'llama3.1:8b'
			};

			const result = await orchestrator.generateQuizWithFallback(
				[mockNoteContent],
				options,
				'ollama'
			);

			expect(result.success).toBe(true);
			expect(result.quiz).toBeDefined();
			expect(result.quiz?.title).toBe('JavaScript Fundamentals Quiz');
			expect(result.quiz?.questions).toHaveLength(2);
			expect(result.provider).toBe('ollama');
		});

		it('should handle provider fallback when primary fails', async () => {
			// Mock model validation returning empty (model not found)
			vi.mocked(requestUrl).mockResolvedValueOnce({
				status: 200,
				json: { models: [] },
				text: '',
				arrayBuffer: new ArrayBuffer(0),
				headers: {}
			});

			// Mock first generation attempt failure
			vi.mocked(requestUrl).mockResolvedValueOnce({
				status: 500,
				json: {},
				text: '',
				arrayBuffer: new ArrayBuffer(0),
				headers: {}
			});

			// Mock retry with model validation success
			vi.mocked(requestUrl).mockResolvedValueOnce({
				status: 200,
				json: { models: [{ name: 'llama3.1:8b' }] },
				text: '',
				arrayBuffer: new ArrayBuffer(0),
				headers: {}
			});

			// Mock successful generation on retry
			vi.mocked(requestUrl).mockResolvedValueOnce({
				status: 200,
				json: {
					response: JSON.stringify(mockQuizResponse)
				},
				text: '',
				arrayBuffer: new ArrayBuffer(0),
				headers: {}
			});

			await ollamaProvider.initialize({
				baseURL: 'http://localhost:11434',
				model: 'llama3.1:8b',
				maxRetries: 3
			});
			orchestrator.registerProvider(ollamaProvider);

			const options: QuizGenerationOptions = {
				selectedNotes: [],
				questionCount: 5,
				difficulty: 'easy' as DifficultyLevel,
				includeMultipleChoice: true,
				includeTrueFalse: false
			};

			const result = await orchestrator.generateQuizWithFallback(
				[mockNoteContent],
				options,
				'ollama'
			);

			expect(result.success).toBe(true);
			expect(result.provider).toBe('ollama');
			expect(result.attemptCount).toBeGreaterThan(1);
		});
	});

	describe('Content Processing', () => {
		beforeEach(async () => {
			await ollamaProvider.initialize({
				baseURL: 'http://localhost:11434',
				model: 'llama3.1:8b'
			});
			orchestrator.registerProvider(ollamaProvider);
		});

		it('should handle multiple notes concatenation', async () => {
			const note1 = '# Topic 1\nContent about topic 1';
			const note2 = '# Topic 2\nContent about topic 2';

			// Mock model validation and generation
			vi.mocked(requestUrl)
				.mockResolvedValueOnce({
					status: 200,
					json: { models: [{ name: 'llama3.1:8b' }] },
					text: '',
					arrayBuffer: new ArrayBuffer(0),
					headers: {}
				})
				.mockResolvedValueOnce({
					status: 200,
					json: {
						response: JSON.stringify(mockQuizResponse)
					},
					text: '',
					arrayBuffer: new ArrayBuffer(0),
					headers: {}
				});

			const options: QuizGenerationOptions = {
				selectedNotes: [],
				questionCount: 5,
				difficulty: 'medium' as DifficultyLevel,
				includeMultipleChoice: true,
				includeTrueFalse: true
			};

			const result = await orchestrator.generateQuizWithFallback(
				[note1, note2],
				options,
				'ollama'
			);

			expect(result.success).toBe(true);

			// Verify the request body contains both notes
			const requestCall = vi.mocked(requestUrl).mock.calls[1];
			const requestParams = typeof requestCall[0] === 'string' ? { body: '{}' } : requestCall[0];
			const requestBody = JSON.parse(requestParams.body as string);
			expect(requestBody.prompt).toContain('Topic 1');
			expect(requestBody.prompt).toContain('Topic 2');
		});

		it('should truncate excessively long content', async () => {
			const veryLongNote = 'a'.repeat(50000);

			// Mock model validation and generation
			vi.mocked(requestUrl)
				.mockResolvedValueOnce({
					status: 200,
					json: { models: [{ name: 'llama3.1:8b' }] },
					text: '',
					arrayBuffer: new ArrayBuffer(0),
					headers: {}
				})
				.mockResolvedValueOnce({
					status: 200,
					json: {
						response: JSON.stringify(mockQuizResponse)
					},
					text: '',
					arrayBuffer: new ArrayBuffer(0),
					headers: {}
				});

			const options: QuizGenerationOptions = {
				selectedNotes: [],
				questionCount: 10,
				difficulty: 'hard' as DifficultyLevel,
				includeMultipleChoice: true,
				includeTrueFalse: true
			};

			const result = await orchestrator.generateQuizWithFallback(
				[veryLongNote],
				options,
				'ollama'
			);

			expect(result.success).toBe(true);

			// Verify content was truncated
			const requestCall = vi.mocked(requestUrl).mock.calls[1];
			const requestParams = typeof requestCall[0] === 'string' ? { body: '{}' } : requestCall[0];
			const requestBody = JSON.parse(requestParams.body as string);
			expect(requestBody.prompt.length).toBeLessThan(50000);
		});

		it('should handle empty note content', async () => {
			// Mock model validation and generation
			vi.mocked(requestUrl)
				.mockResolvedValueOnce({
					status: 200,
					json: { models: [{ name: 'llama3.1:8b' }] },
					text: '',
					arrayBuffer: new ArrayBuffer(0),
					headers: {}
				})
				.mockResolvedValueOnce({
					status: 200,
					json: {
						response: JSON.stringify({
							title: 'Empty Content Quiz',
							description: 'No content provided',
							questions: []
						})
					},
					text: '',
					arrayBuffer: new ArrayBuffer(0),
					headers: {}
				});

			const options: QuizGenerationOptions = {
				selectedNotes: [],
				questionCount: 5,
				difficulty: 'easy' as DifficultyLevel,
				includeMultipleChoice: true,
				includeTrueFalse: true
			};

			const result = await orchestrator.generateQuizWithFallback(
				[''],
				options,
				'ollama'
			);

			expect(result.success).toBe(true);
			expect(result.quiz?.questions).toEqual([]);
		});
	});

	describe('Error Recovery', () => {
		beforeEach(async () => {
			await ollamaProvider.initialize({
				baseURL: 'http://localhost:11434',
				model: 'llama3.1:8b'
			});
			orchestrator.registerProvider(ollamaProvider);
		});

		it('should retry on transient network errors', async () => {
			// Mock model validation success
			vi.mocked(requestUrl).mockResolvedValueOnce({
				status: 200,
				json: { models: [{ name: 'llama3.1:8b' }] },
				text: '',
				arrayBuffer: new ArrayBuffer(0),
				headers: {}
			});

			// Mock first two generation attempts fail, third succeeds
			vi.mocked(requestUrl)
				.mockRejectedValueOnce(new Error('Network error'))
				.mockRejectedValueOnce(new Error('Timeout'))
				.mockResolvedValueOnce({
					status: 200,
					json: {
						response: JSON.stringify(mockQuizResponse)
					},
					text: '',
					arrayBuffer: new ArrayBuffer(0),
					headers: {}
				});

			const options: QuizGenerationOptions = {
				selectedNotes: [],
				questionCount: 5,
				difficulty: 'medium' as DifficultyLevel,
				includeMultipleChoice: true,
				includeTrueFalse: true
			};

			const result = await orchestrator.generateQuizWithFallback(
				[mockNoteContent],
				options,
				'ollama'
			);

			expect(result.success).toBe(true);
			// Should have tried multiple times
			expect(vi.mocked(requestUrl)).toHaveBeenCalledTimes(4); // 1 validation + 3 attempts
		});

		it('should handle malformed AI responses gracefully', async () => {
			// Mock model validation
			vi.mocked(requestUrl).mockResolvedValueOnce({
				status: 200,
				json: { models: [{ name: 'llama3.1:8b' }] },
				text: '',
				arrayBuffer: new ArrayBuffer(0),
				headers: {}
			});

			// Mock invalid JSON response
			vi.mocked(requestUrl).mockResolvedValueOnce({
				status: 200,
				json: {
					response: 'This is not valid JSON at all!'
				},
				text: '',
				arrayBuffer: new ArrayBuffer(0),
				headers: {}
			});

			const options: QuizGenerationOptions = {
				selectedNotes: [],
				questionCount: 5,
				difficulty: 'medium' as DifficultyLevel,
				includeMultipleChoice: true,
				includeTrueFalse: true
			};

			const result = await orchestrator.generateQuizWithFallback(
				[mockNoteContent],
				options,
				'ollama'
			);

			expect(result.success).toBe(false);
			expect(result.error).toBeDefined();
		});
	});

	describe('Performance Metrics', () => {
		beforeEach(async () => {
			await ollamaProvider.initialize({
				baseURL: 'http://localhost:11434',
				model: 'llama3.1:8b'
			});
			orchestrator.registerProvider(ollamaProvider);
		});

		it('should track generation duration', async () => {
			// Mock model validation and generation
			vi.mocked(requestUrl)
				.mockResolvedValueOnce({
					status: 200,
					json: { models: [{ name: 'llama3.1:8b' }] },
					text: '',
					arrayBuffer: new ArrayBuffer(0),
					headers: {}
				})
				.mockResolvedValueOnce({
					status: 200,
					json: {
						response: JSON.stringify(mockQuizResponse),
						eval_duration: 5000000000, // 5 seconds in nanoseconds
						prompt_eval_duration: 1000000000 // 1 second in nanoseconds
					},
					text: '',
					arrayBuffer: new ArrayBuffer(0),
					headers: {}
				});

			const options: QuizGenerationOptions = {
				selectedNotes: [],
				questionCount: 10,
				difficulty: 'medium' as DifficultyLevel,
				includeMultipleChoice: true,
				includeTrueFalse: true
			};

			const result = await orchestrator.generateQuizWithFallback(
				[mockNoteContent],
				options,
				'ollama'
			);

			expect(result.success).toBe(true);
			expect(result.duration).toBeGreaterThanOrEqual(0);
			expect(typeof result.duration).toBe('number');
		});
	});
});
