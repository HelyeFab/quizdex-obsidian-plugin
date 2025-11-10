/**
 * Core type definitions for QuizDex plugin
 */

export interface Quiz {
	id: string;
	title: string;
	description: string;
	questions: Question[];
	createdAt: Date;
	sourceNotes: string[];
	pokemonChallenge?: PokemonChallenge;
}

export interface Question {
	id: string;
	type: QuestionType;
	question: string;
	options?: string[];
	correctAnswer: string | string[];
	explanation?: string;
}

export type QuestionType =
	| 'multiple-choice'
	| 'true-false'
	| 'select-all'
	| 'fill-blank'
	| 'matching'
	| 'short-answer'
	| 'long-answer';

export type DifficultyLevel = 'easy' | 'medium' | 'hard';

export interface QuizGenerationOptions {
	selectedNotes: any[];
	questionCount: number;
	difficulty: DifficultyLevel;
	includeMultipleChoice: boolean;
	includeTrueFalse: boolean;
	modelOverride?: string;
	provider?: string;
	timeout?: number;
}

export interface PokemonChallenge {
	pokemon: Pokemon;
	requiredScore: number;
	generatedAt: Date;
}

export interface Pokemon {
	id: number;
	name: string;
	sprites: {
		front_default: string;
		[key: string]: string;
	};
	types: Array<{ type: { name: string } }>;
	height: number;
	weight: number;
}

export interface QuizResult {
	quizId: string;
	score: number;
	correctCount: number;
	totalQuestions: number;
	timeTaken: number;
	completedAt: string;
	answers: Map<string, string>;
}

// AI Provider Types

export interface AIProviderConfig {
	baseURL: string;
	apiKey?: string;
	model: string;
	embeddingModel?: string;
	timeout?: number;
	maxRetries?: number;
}

export interface GenerationResult {
	success: boolean;
	quiz?: Quiz;
	error?: AIProviderError;
	provider: string;
	attemptCount: number;
	duration: number;
}

export interface AIProviderError {
	code: string;
	message: string;
	provider: string;
	retryable: boolean;
	statusCode?: number;
}

export enum ErrorCode {
	// Network errors
	TIMEOUT = 'TIMEOUT',
	NETWORK_ERROR = 'NETWORK_ERROR',
	CONNECTION_REFUSED = 'CONNECTION_REFUSED',

	// Authentication errors
	INVALID_API_KEY = 'INVALID_API_KEY',
	UNAUTHORIZED = 'UNAUTHORIZED',
	FORBIDDEN = 'FORBIDDEN',

	// Rate limiting
	RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
	QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',

	// Provider-specific
	MODEL_NOT_FOUND = 'MODEL_NOT_FOUND',
	INVALID_REQUEST = 'INVALID_REQUEST',
	PROVIDER_ERROR = 'PROVIDER_ERROR',

	// Parsing errors
	INVALID_RESPONSE = 'INVALID_RESPONSE',
	PARSING_ERROR = 'PARSING_ERROR',

	// Unknown
	UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}
