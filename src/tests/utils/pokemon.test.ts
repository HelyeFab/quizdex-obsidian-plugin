/**
 * Unit tests for Pokemon utility functions
 *
 * Tests Pokemon API integration and caching
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { formatPokemonName, fetchPokemonById } from '../../utils/pokemon';

// Mock fetch for Pokemon API
global.fetch = vi.fn();

// Mock sessionStorage
const sessionStorageMock = (() => {
	let store: Record<string, string> = {};

	return {
		getItem: (key: string) => store[key] || null,
		setItem: (key: string, value: string) => {
			store[key] = value;
		},
		removeItem: (key: string) => {
			delete store[key];
		},
		clear: () => {
			store = {};
		}
	};
})();

Object.defineProperty(window, 'sessionStorage', {
	value: sessionStorageMock
});

describe('Pokemon Utilities', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		sessionStorage.clear();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('formatPokemonName', () => {
		it('should capitalize first letter', () => {
			expect(formatPokemonName('pikachu')).toBe('Pikachu');
		});

		it('should lowercase other letters', () => {
			expect(formatPokemonName('PIKACHU')).toBe('Pikachu');
			expect(formatPokemonName('PIkaChU')).toBe('Pikachu');
		});

		it('should handle single character names', () => {
			expect(formatPokemonName('a')).toBe('A');
		});

		it('should handle empty strings', () => {
			expect(formatPokemonName('')).toBe('');
		});

		it('should handle names with hyphens', () => {
			expect(formatPokemonName('mr-mime')).toBe('Mr-mime');
		});
	});

	describe('fetchPokemonById', () => {
		const mockPokemonData = {
			id: 25,
			name: 'pikachu',
			sprites: {
				front_default: 'https://example.com/pikachu.png',
				back_default: 'https://example.com/pikachu-back.png'
			},
			types: [
				{ type: { name: 'electric' } }
			],
			height: 4,
			weight: 60
		};

		it('should fetch Pokemon data successfully', async () => {
			vi.mocked(fetch).mockResolvedValueOnce({
				ok: true,
				json: async () => mockPokemonData
			} as Response);

			const pokemon = await fetchPokemonById(25);

			expect(pokemon).toBeDefined();
			expect(pokemon?.id).toBe(25);
			expect(pokemon?.name).toBe('pikachu');
			expect(pokemon?.types[0].type.name).toBe('electric');
			expect(fetch).toHaveBeenCalledWith('https://pokeapi.co/api/v2/pokemon/25');
		});

		it('should cache fetched Pokemon data', async () => {
			vi.mocked(fetch).mockResolvedValueOnce({
				ok: true,
				json: async () => mockPokemonData
			} as Response);

			// First call - should fetch
			const pokemon1 = await fetchPokemonById(25);
			expect(fetch).toHaveBeenCalledTimes(1);

			// Second call - should use cache
			const pokemon2 = await fetchPokemonById(25);
			expect(fetch).toHaveBeenCalledTimes(1); // Still 1, not 2

			expect(pokemon1).toEqual(pokemon2);
		});

		it('should use cached data on subsequent calls', async () => {
			// Pre-populate cache
			sessionStorage.setItem(
				'quizdex-pokemon-25',
				JSON.stringify({
					id: 25,
					name: 'pikachu',
					sprites: { front_default: 'cached.png' },
					types: [{ type: { name: 'electric' } }],
					height: 4,
					weight: 60
				})
			);

			const pokemon = await fetchPokemonById(25);

			expect(pokemon).toBeDefined();
			expect(pokemon?.sprites.front_default).toBe('cached.png');
			expect(fetch).not.toHaveBeenCalled();
		});

		it('should handle API errors gracefully', async () => {
			vi.mocked(fetch).mockResolvedValueOnce({
				ok: false,
				status: 404
			} as Response);

			const pokemon = await fetchPokemonById(999);

			expect(pokemon).toBeNull();
		});

		it('should handle network errors gracefully', async () => {
			vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

			const pokemon = await fetchPokemonById(25);

			expect(pokemon).toBeNull();
		});

		it('should handle malformed JSON responses', async () => {
			vi.mocked(fetch).mockResolvedValueOnce({
				ok: true,
				status: 200,
				statusText: 'OK',
				headers: new Headers(),
				redirected: false,
				type: 'basic' as ResponseType,
				url: '',
				clone: vi.fn(),
				body: null,
				bodyUsed: false,
				arrayBuffer: vi.fn(),
				blob: vi.fn(),
				formData: vi.fn(),
				text: vi.fn(),
				bytes: vi.fn(),
				json: async () => {
					throw new Error('Invalid JSON');
				}
			} as Response);

			const pokemon = await fetchPokemonById(25);

			expect(pokemon).toBeNull();
		});

		it('should fetch different Pokemon independently', async () => {
			const pikachuData = { ...mockPokemonData, id: 25, name: 'pikachu' };
			const bulbasaurData = { ...mockPokemonData, id: 1, name: 'bulbasaur' };

			vi.mocked(fetch)
				.mockResolvedValueOnce({
					ok: true,
					json: async () => pikachuData
				} as Response)
				.mockResolvedValueOnce({
					ok: true,
					json: async () => bulbasaurData
				} as Response);

			const pikachu = await fetchPokemonById(25);
			const bulbasaur = await fetchPokemonById(1);

			expect(pikachu?.name).toBe('pikachu');
			expect(bulbasaur?.name).toBe('bulbasaur');
			expect(fetch).toHaveBeenCalledTimes(2);
		});

		it('should handle Pokemon with multiple types', async () => {
			const charizardData = {
				...mockPokemonData,
				id: 6,
				name: 'charizard',
				types: [
					{ type: { name: 'fire' } },
					{ type: { name: 'flying' } }
				]
			};

			vi.mocked(fetch).mockResolvedValueOnce({
				ok: true,
				json: async () => charizardData
			} as Response);

			const pokemon = await fetchPokemonById(6);

			expect(pokemon?.types).toHaveLength(2);
			expect(pokemon?.types[0].type.name).toBe('fire');
			expect(pokemon?.types[1].type.name).toBe('flying');
		});

		it('should extract correct sprite data', async () => {
			const spriteData = {
				...mockPokemonData,
				sprites: {
					front_default: 'https://example.com/front.png',
					back_default: 'https://example.com/back.png',
					front_shiny: 'https://example.com/shiny.png'
				}
			};

			vi.mocked(fetch).mockResolvedValueOnce({
				ok: true,
				json: async () => spriteData
			} as Response);

			const pokemon = await fetchPokemonById(25);

			expect(pokemon?.sprites.front_default).toBe('https://example.com/front.png');
			expect(pokemon?.sprites.back_default).toBe('https://example.com/back.png');
			expect(pokemon?.sprites.front_shiny).toBe('https://example.com/shiny.png');
		});
	});
});
