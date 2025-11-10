import type { Pokemon } from '../types/quiz.types';

const CACHE_PREFIX = 'quizdex-pokemon-';

export function formatPokemonName(name: string): string {
	return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

export async function fetchPokemonById(id: number): Promise<Pokemon | null> {
	try {
		const cacheKey = `${CACHE_PREFIX}${id}`;
		if (typeof sessionStorage !== 'undefined') {
			const cached = sessionStorage.getItem(cacheKey);
			if (cached) {
				return JSON.parse(cached) as Pokemon;
			}
		}

		const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
		if (!response.ok) {
			throw new Error(`HTTP ${response.status}`);
		}

		const data = await response.json();
		const pokemon: Pokemon = {
			id: data.id,
			name: data.name,
			sprites: data.sprites,
			types: data.types,
			height: data.height,
			weight: data.weight
		};

		if (typeof sessionStorage !== 'undefined') {
			sessionStorage.setItem(cacheKey, JSON.stringify(pokemon));
		}

		return pokemon;
	} catch (error) {
		console.error(`Failed to fetch Pokémon ${id}:`, error);
		return null;
	}
}
