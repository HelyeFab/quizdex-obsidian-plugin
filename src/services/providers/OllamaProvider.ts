/**
 * Ollama AI Provider Implementation
 *
 * Implements the IAIProvider interface for Ollama local LLM server
 */

import { requestUrl } from 'obsidian';
import { IAIProvider } from '../AIProvider.interface';
import {
	Quiz,
	QuizGenerationOptions,
	AIProviderConfig,
	AIProviderError,
	ErrorCode
} from '../../types/quiz.types';

export class OllamaProvider implements IAIProvider {
	readonly name = 'ollama';
	readonly displayName = 'Ollama (Local)';

	private config: AIProviderConfig | null = null;

	async initialize(config: AIProviderConfig): Promise<void> {
		this.config = config;
		console.log(`✅ Ollama provider initialized: ${config.baseURL}`);
	}

	async testConnection(): Promise<boolean> {
		if (!this.config) return false;

		try {
			const baseEndpoint = this.config.baseURL.replace(/\/$/, '');
			const response = await requestUrl({
				url: `${baseEndpoint}/api/tags`,
				method: 'GET',
				throw: false
			});

			return response.status === 200;
		} catch (error) {
			console.error('Ollama connection test failed:', error);
			return false;
		}
	}

	async getAvailableModels(): Promise<string[]> {
		if (!this.config) return [];

		try {
			const baseEndpoint = this.config.baseURL.replace(/\/$/, '');
			const response = await requestUrl({
				url: `${baseEndpoint}/api/tags`,
				method: 'GET'
			});

			if (response.status === 200) {
				const data = response.json;
				if (data.models && Array.isArray(data.models)) {
					return data.models
						.map((model: any) => model.name || model.model || '')
						.filter((name: string) => name.length > 0);
				}
			}

			return [];
		} catch (error) {
			console.error('Failed to fetch Ollama models:', error);
			return [];
		}
	}

	async generateQuiz(
		noteContents: string[],
		options: QuizGenerationOptions
	): Promise<Quiz> {
		if (!this.config) {
			throw this.createError(
				ErrorCode.PROVIDER_ERROR,
				'Ollama provider not initialized'
			);
		}

		const combinedContent = noteContents.join('\n\n---\n\n');
		const prompt = this.buildPrompt(
			combinedContent,
			options.questionCount,
			options.difficulty,
			options.includeMultipleChoice,
			options.includeTrueFalse
		);

		const modelToUse = await this.validateModelName(
			options.modelOverride || this.config.model
		);

		try {
			const baseEndpoint = this.config.baseURL.replace(/\/$/, '');
			const response = await requestUrl({
				url: `${baseEndpoint}/api/generate`,
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					model: modelToUse,
					prompt,
					stream: false,
					options: {
						temperature: 0.7,
						top_p: 0.9
					}
				})
			});

			if (response.status !== 200) {
				throw this.createError(
					ErrorCode.PROVIDER_ERROR,
					`Ollama API error: ${response.status}`,
					response.status
				);
			}

			const result = response.json;
			if (!result || !result.response) {
				throw this.createError(
					ErrorCode.INVALID_RESPONSE,
					'Invalid response format from Ollama'
				);
			}

			return this.parseQuizResponse(result.response, options);

		} catch (error: any) {
			if (error.provider) {
				throw error; // Already an AIProviderError
			}

			// Convert to AIProviderError
			throw this.createError(
				ErrorCode.PROVIDER_ERROR,
				error.message || 'Failed to generate quiz'
			);
		}
	}

	async validateModelName(modelName: string): Promise<string> {
		try {
			const availableModels = await this.getAvailableModels();

			// Exact match
			if (availableModels.includes(modelName)) {
				return modelName;
			}

			// Partial match with tag
			const matchingModel = availableModels.find(
				model => model.startsWith(modelName + ':') || model === modelName
			);

			if (matchingModel) {
				console.log(`Model name corrected: ${modelName} -> ${matchingModel}`);
				return matchingModel;
			}

			// Base name match
			const baseModelName = modelName.split(':')[0];
			const baseMatchingModel = availableModels.find(
				model => model.split(':')[0] === baseModelName
			);

			if (baseMatchingModel) {
				console.log(`Model name corrected: ${modelName} -> ${baseMatchingModel}`);
				return baseMatchingModel;
			}

			console.warn(`Model '${modelName}' not found. Available:`, availableModels);
			return modelName; // Use as-is and let API handle error

		} catch (error) {
			console.error('Failed to validate model name:', error);
			return modelName;
		}
	}

	isRetryableError(error: AIProviderError): boolean {
		return error.retryable && error.code !== ErrorCode.INVALID_API_KEY;
	}

	getRetryDelay(attemptNumber: number): number {
		// Exponential backoff: 1s, 2s, 4s, 8s, ...
		return Math.min(1000 * Math.pow(2, attemptNumber), 10000);
	}

	async healthCheck(): Promise<{ healthy: boolean; latency?: number; message?: string }> {
		const startTime = Date.now();
		const isHealthy = await this.testConnection();
		const latency = Date.now() - startTime;

		return {
			healthy: isHealthy,
			latency,
			message: isHealthy ? 'Ollama server responding' : 'Ollama server unreachable'
		};
	}

	// === PRIVATE HELPERS ===

	private buildPrompt(
		content: string,
		questionCount: number,
		difficulty: string,
		includeMultipleChoice: boolean,
		includeTrueFalse: boolean
	): string {
		const questionTypes: string[] = [];
		if (includeMultipleChoice) {
			questionTypes.push('Multiple Choice: Provide 4 options (A, B, C, D) with only one correct answer.');
		}
		if (includeTrueFalse) {
			questionTypes.push('True/False: Provide a statement that is either true or false.');
		}

		const typeInstructions = questionTypes.join(' ');

		return `You are an expert quiz generator. Based on the following study material, create ${questionCount} ${difficulty} level questions.

QUESTION TYPES TO INCLUDE: ${typeInstructions}

STUDY MATERIAL:
${content}

INSTRUCTIONS:
1. Create exactly ${questionCount} questions total
2. Mix the question types as requested
3. Questions should be ${difficulty} level
4. Focus on key concepts, facts, and understanding
5. Provide clear explanations for correct answers

REQUIRED OUTPUT FORMAT (JSON):
{
  "title": "Quiz Title",
  "description": "Brief description of quiz content",
  "questions": [
    {
      "id": "q1",
      "type": "multiple-choice",
      "question": "What is...?",
      "options": ["A) Option 1", "B) Option 2", "C) Option 3", "D) Option 4"],
      "correctAnswer": "A",
      "explanation": "Explanation of why this is correct"
    },
    {
      "id": "q2",
      "type": "true-false",
      "question": "Statement to evaluate",
      "correctAnswer": "true",
      "explanation": "Explanation"
    }
  ]
}

Generate the quiz now:`;
	}

	private parseQuizResponse(response: string, options: QuizGenerationOptions): Quiz {
		try {
			// Extract JSON from response
			const jsonMatch = response.match(/\{[\s\S]*\}/);
			if (!jsonMatch) {
				throw this.createError(
					ErrorCode.PARSING_ERROR,
					'No JSON found in response'
				);
			}

			const quizData = JSON.parse(jsonMatch[0]);

			return {
				id: this.generateId(),
				title: quizData.title || 'Generated Quiz',
				description: quizData.description || 'AI-generated quiz from your notes',
				questions: quizData.questions.map((q: any, index: number) => ({
					id: q.id || `q${index + 1}`,
					type: q.type,
					question: q.question,
					options: q.options || undefined,
					correctAnswer: q.correctAnswer,
					explanation: q.explanation || undefined
				})),
				createdAt: new Date(),
				sourceNotes: options.selectedNotes.map((note: any) => note.basename || note.name)
			};

		} catch (error: any) {
			console.error('Failed to parse quiz response:', error);
			console.error('Raw response:', response);
			throw this.createError(
				ErrorCode.PARSING_ERROR,
				'Failed to parse AI response. Please try again.'
			);
		}
	}

	private generateId(): string {
		return Date.now().toString(36) + Math.random().toString(36).substr(2);
	}

	private createError(code: ErrorCode, message: string, statusCode?: number): AIProviderError {
		return {
			code,
			message,
			provider: this.name,
			retryable: this.isErrorCodeRetryable(code),
			statusCode
		};
	}

	private isErrorCodeRetryable(code: ErrorCode): boolean {
		const retryableCodes = [
			ErrorCode.TIMEOUT,
			ErrorCode.NETWORK_ERROR,
			ErrorCode.RATE_LIMIT_EXCEEDED,
			ErrorCode.PROVIDER_ERROR
		];

		return retryableCodes.includes(code);
	}
}
