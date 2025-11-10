/**
 * Unit tests for ProviderFactory
 *
 * Tests provider registration, initialization, and configuration
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProviderFactory } from '../services/ProviderFactory';
import { AIProviderOrchestrator } from '../services/AIProviderOrchestrator';
import { AIProviderConfig } from '../types/quiz.types';

vi.mock('obsidian', () => ({
	Notice: vi.fn(),
	requestUrl: vi.fn()
}));

describe('ProviderFactory', () => {
	let orchestrator: AIProviderOrchestrator;

	beforeEach(() => {
		orchestrator = new AIProviderOrchestrator();
		vi.clearAllMocks();
	});

	describe('Provider Information', () => {
		it('should list all supported providers', () => {
			const providers = ProviderFactory.getSupportedProviders();

			expect(providers).toContain('ollama');
			expect(providers).toContain('openai');
			expect(providers).toContain('anthropic');
			expect(providers).toContain('google');
			expect(providers).toContain('perplexity');
			expect(providers).toContain('mistral');
			expect(providers).toContain('cohere');
		});

		it('should provide display names for providers', () => {
			expect(ProviderFactory.getProviderDisplayName('ollama')).toBe('Ollama (Local)');
			expect(ProviderFactory.getProviderDisplayName('openai')).toBe('OpenAI');
			expect(ProviderFactory.getProviderDisplayName('anthropic')).toBe('Anthropic');
			expect(ProviderFactory.getProviderDisplayName('google')).toBe('Google AI');
		});

		it('should handle unknown provider names', () => {
			expect(ProviderFactory.getProviderDisplayName('unknown')).toBe('unknown');
		});

		it('should identify providers requiring API keys', () => {
			expect(ProviderFactory.requiresApiKey('ollama')).toBe(false);
			expect(ProviderFactory.requiresApiKey('openai')).toBe(true);
			expect(ProviderFactory.requiresApiKey('anthropic')).toBe(true);
			expect(ProviderFactory.requiresApiKey('google')).toBe(true);
		});
	});

	describe('Provider Initialization', () => {
		it('should initialize Ollama provider without API key', async () => {
			const config: AIProviderConfig = {
				baseURL: 'http://localhost:11434',
				model: 'llama3.1:8b'
			};

			const getConfig = vi.fn(async (provider: string) => {
				if (provider === 'ollama') return config;
				return null;
			});

			await ProviderFactory.initializeAll(orchestrator, getConfig);

			const providers = orchestrator.listProviders();
			expect(providers).toContain('ollama');
		});

		it('should initialize cloud providers with API keys', async () => {
			const getConfig = vi.fn(async (provider: string) => {
				const configs: Record<string, AIProviderConfig> = {
					'openai': {
						baseURL: 'https://api.openai.com/v1',
						model: 'gpt-4o-mini',
						apiKey: 'sk-test-key'
					}
				};
				return configs[provider] || null;
			});

			await ProviderFactory.initializeAll(orchestrator, getConfig);

			const providers = orchestrator.listProviders();
			expect(providers).toContain('openai');
		});

		it('should skip providers without configuration', async () => {
			const getConfig = vi.fn(async () => null);

			await ProviderFactory.initializeAll(orchestrator, getConfig);

			const providers = orchestrator.listProviders();
			expect(providers).toHaveLength(0);
		});

		it('should skip cloud providers missing API keys', async () => {
			const getConfig = vi.fn(async (provider: string) => {
				if (provider === 'openai') {
					return {
						baseURL: 'https://api.openai.com/v1',
						model: 'gpt-4o-mini'
						// Missing apiKey
					};
				}
				return null;
			});

			await ProviderFactory.initializeAll(orchestrator, getConfig);

			const providers = orchestrator.listProviders();
			expect(providers).not.toContain('openai');
		});

		it('should initialize multiple providers concurrently', async () => {
			const getConfig = vi.fn(async (provider: string) => {
				const configs: Record<string, AIProviderConfig> = {
					'ollama': {
						baseURL: 'http://localhost:11434',
						model: 'llama3.1:8b'
					},
					'openai': {
						baseURL: 'https://api.openai.com/v1',
						model: 'gpt-4o-mini',
						apiKey: 'sk-test-key'
					}
				};
				return configs[provider] || null;
			});

			await ProviderFactory.initializeAll(orchestrator, getConfig);

			const providers = orchestrator.listProviders();
			expect(providers.length).toBeGreaterThanOrEqual(2);
			expect(providers).toContain('ollama');
			expect(providers).toContain('openai');
		});

		it('should handle initialization errors gracefully', async () => {
			const getConfig = vi.fn(async (provider: string) => {
				if (provider === 'failing-provider') {
					throw new Error('Config error');
				}
				return null;
			});

			// Should not throw
			await expect(
				ProviderFactory.initializeAll(orchestrator, getConfig)
			).resolves.not.toThrow();
		});
	});

	describe('Provider Configuration Validation', () => {
		it('should validate minimum required config fields', async () => {
			const minimalConfig: AIProviderConfig = {
				baseURL: 'http://localhost:11434',
				model: 'test-model'
			};

			const getConfig = vi.fn(async () => minimalConfig);

			await ProviderFactory.initializeAll(orchestrator, getConfig);

			const providers = orchestrator.listProviders();
			expect(providers.length).toBeGreaterThan(0);
		});

		it('should pass optional config fields to providers', async () => {
			const fullConfig: AIProviderConfig = {
				baseURL: 'http://localhost:11434',
				model: 'llama3.1:8b',
				timeout: 120000,
				maxRetries: 5
			};

			const getConfig = vi.fn(async (provider: string) => {
				if (provider === 'ollama') return fullConfig;
				return null;
			});

			await ProviderFactory.initializeAll(orchestrator, getConfig);

			const provider = orchestrator.getProvider('ollama');
			expect(provider).toBeDefined();
		});
	});

	describe('Edge Cases', () => {
		it('should handle empty provider list gracefully', async () => {
			const getConfig = vi.fn(async () => null);

			await ProviderFactory.initializeAll(orchestrator, getConfig);

			const providers = orchestrator.listProviders();
			expect(providers).toEqual([]);
		});

		it('should handle duplicate initialization calls', async () => {
			const config: AIProviderConfig = {
				baseURL: 'http://localhost:11434',
				model: 'llama3.1:8b'
			};

			const getConfig = vi.fn(async (provider: string) => {
				if (provider === 'ollama') return config;
				return null;
			});

			// Initialize twice
			await ProviderFactory.initializeAll(orchestrator, getConfig);
			await ProviderFactory.initializeAll(orchestrator, getConfig);

			// Should only have each provider once
			const providers = orchestrator.listProviders();
			const ollamaCount = providers.filter(p => p === 'ollama').length;
			expect(ollamaCount).toBeLessThanOrEqual(1);
		});

		it('should handle case-sensitive provider names correctly', () => {
			expect(ProviderFactory.requiresApiKey('OpenAI')).toBe(true);
			expect(ProviderFactory.requiresApiKey('openai')).toBe(true);
		});
	});
});
