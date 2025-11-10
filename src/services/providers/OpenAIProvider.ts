/**
 * OpenAI Provider Implementation
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

export class OpenAIProvider implements IAIProvider {
	readonly name = 'openai';
	readonly displayName = 'OpenAI';

	private config: AIProviderConfig | null = null;

	async initialize(config: AIProviderConfig): Promise<void> {
		this.config = config;
	}

	async testConnection(): Promise<boolean> {
		if (!this.config || !this.config.apiKey) return false;

		try {
			const response = await requestUrl({
				url: `${this.config.baseURL}/models`,
				method: 'GET',
				headers: {
					'Authorization': `Bearer ${this.config.apiKey}`
				},
				throw: false
			});

			return response.status === 200;
		} catch (error) {
			return false;
		}
	}

	async getAvailableModels(): Promise<string[]> {
		if (!this.config || !this.config.apiKey) return [];

		try {
			const response = await requestUrl({
				url: `${this.config.baseURL}/models`,
				method: 'GET',
				headers: {
					'Authorization': `Bearer ${this.config.apiKey}`
				}
			});

			if (response.status === 200) {
				const data = response.json;
				return data.data
					.filter((model: any) => model.id.includes('gpt'))
					.map((model: any) => model.id);
			}

			return [];
		} catch (error) {
			return [];
		}
	}

	async generateQuiz(
		noteContents: string[],
		options: QuizGenerationOptions
	): Promise<Quiz> {
		if (!this.config || !this.config.apiKey) {
			throw this.createError(ErrorCode.INVALID_API_KEY, 'OpenAI API key not configured');
		}

		const combinedContent = noteContents.join('\n\n---\n\n');
		const prompt = this.buildPrompt(combinedContent, options);

		try {
			const response = await requestUrl({
				url: `${this.config.baseURL}/chat/completions`,
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${this.config.apiKey}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					model: options.modelOverride || this.config.model,
					messages: [
						{ role: 'system', content: 'You are an expert quiz generator. Generate quizzes in JSON format.' },
						{ role: 'user', content: prompt }
					],
					temperature: 0.7,
					response_format: { type: 'json_object' }
				})
			});

			if (response.status !== 200) {
				throw this.createError(
					this.statusToErrorCode(response.status),
					`OpenAI API error: ${response.status}`,
					response.status
				);
			}

			const result = response.json;
			if (!result.choices || !result.choices[0]?.message?.content) {
				throw this.createError(ErrorCode.INVALID_RESPONSE, 'Invalid response from OpenAI');
			}

			return this.parseQuizResponse(result.choices[0].message.content, options);

		} catch (error: any) {
			if (error.provider) throw error;
			throw this.createError(ErrorCode.PROVIDER_ERROR, error.message || 'OpenAI request failed');
		}
	}

	async validateModelName(modelName: string): Promise<string> {
		const availableModels = await this.getAvailableModels();
		if (availableModels.includes(modelName)) {
			return modelName;
		}
		return modelName; // OpenAI will handle invalid model names
	}

	isRetryableError(error: AIProviderError): boolean {
		return error.retryable && error.code !== ErrorCode.INVALID_API_KEY;
	}

	getRetryDelay(attemptNumber: number): number {
		return Math.min(1000 * Math.pow(2, attemptNumber), 10000);
	}

	async healthCheck(): Promise<{ healthy: boolean; latency?: number; message?: string }> {
		const startTime = Date.now();
		const isHealthy = await this.testConnection();
		const latency = Date.now() - startTime;

		return {
			healthy: isHealthy,
			latency,
			message: isHealthy ? 'OpenAI API responding' : 'OpenAI API unreachable'
		};
	}

	private buildPrompt(content: string, options: QuizGenerationOptions): string {
		const questionTypes: string[] = [];
		if (options.includeMultipleChoice) {
			questionTypes.push('multiple-choice');
		}
		if (options.includeTrueFalse) {
			questionTypes.push('true-false');
		}

		return `Generate a quiz with ${options.questionCount} questions at ${options.difficulty} difficulty level.

Question types: ${questionTypes.join(', ')}

Study material:
${content}

Return ONLY valid JSON in this exact format:
{
  "title": "Quiz Title",
  "description": "Brief description",
  "questions": [
    {
      "id": "q1",
      "type": "multiple-choice",
      "question": "Question text?",
      "options": ["A) Option 1", "B) Option 2", "C) Option 3", "D) Option 4"],
      "correctAnswer": "A",
      "explanation": "Why this is correct"
    }
  ]
}`;
	}

	private parseQuizResponse(content: string, options: QuizGenerationOptions): Quiz {
		try {
			const quizData = JSON.parse(content);

			return {
				id: this.generateId(),
				title: quizData.title || 'Generated Quiz',
				description: quizData.description || 'AI-generated quiz',
				questions: quizData.questions.map((q: any, index: number) => ({
					id: q.id || `q${index + 1}`,
					type: q.type,
					question: q.question,
					options: q.options,
					correctAnswer: q.correctAnswer,
					explanation: q.explanation
				})),
				createdAt: new Date(),
				sourceNotes: options.selectedNotes.map((note: any) => note.basename || note.name)
			};
		} catch (error) {
			throw this.createError(ErrorCode.PARSING_ERROR, 'Failed to parse OpenAI response');
		}
	}

	private generateId(): string {
		return Date.now().toString(36) + Math.random().toString(36).substr(2);
	}

	private statusToErrorCode(status: number): ErrorCode {
		if (status === 401) return ErrorCode.INVALID_API_KEY;
		if (status === 429) return ErrorCode.RATE_LIMIT_EXCEEDED;
		if (status === 404) return ErrorCode.MODEL_NOT_FOUND;
		if (status >= 500) return ErrorCode.PROVIDER_ERROR;
		return ErrorCode.UNKNOWN_ERROR;
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
