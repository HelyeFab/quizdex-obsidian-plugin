/**
 * PokemonCardModal - Shows a collectible-style card for the current Pokémon
 */

import { App, Modal } from 'obsidian';
import { Pokemon } from '../types/quiz.types';
import { fetchPokemonById, formatPokemonName } from '../utils/pokemon';
import { StorageService } from '../services/StorageService';

export class PokemonCardModal extends Modal {
	constructor(
		app: App,
		private readonly pokemonId: number,
		private readonly storageService: StorageService
	) {
		super(app);
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('pokemon-card-modal');

		const cardContainer = contentEl.createDiv('pokemon-card');
		cardContainer.createDiv({ text: 'Loading Pokédex data...' }).addClass('pokemon-card-loading');

		const pokemon = await fetchPokemonById(this.pokemonId);

		cardContainer.empty();

		if (!pokemon) {
			cardContainer.createDiv({ text: 'Failed to load Pokémon data. Please check your connection.' })
				.addClass('pokemon-card-error');
			return;
		}

		this.renderPokemonCard(cardContainer, pokemon);
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}

	private async renderPokemonCard(container: HTMLElement, pokemon: Pokemon) {
		// Header with name and number
		const header = container.createDiv('pokemon-card-header');
		const title = header.createDiv('pokemon-card-title');
		title.textContent = formatPokemonName(pokemon.name);
		
		const number = header.createDiv('pokemon-card-number');
		number.textContent = `#${pokemon.id.toString().padStart(3, '0')}`;

		// Sprite section
		const spriteContainer = container.createDiv('pokemon-card-sprite');
		if (pokemon.sprites.front_default) {
			spriteContainer.createEl('img', {
				attr: {
					src: pokemon.sprites.front_default,
					alt: formatPokemonName(pokemon.name)
				}
			});
		} else {
			spriteContainer.createDiv({ text: 'No sprite available' });
		}

		// Types section
		const typesContainer = container.createDiv('pokemon-card-types');
		pokemon.types.forEach(typeInfo => {
			const typeChip = typesContainer.createDiv('pokemon-type-chip');
			typeChip.textContent = formatPokemonName(typeInfo.type.name);
			typeChip.addClass(`type-${typeInfo.type.name.toLowerCase()}`);
		});

		// Stats section
		const statsContainer = container.createDiv('pokemon-card-stats-container');
		const statsTitle = statsContainer.createDiv('pokemon-card-stats-title');
		statsTitle.textContent = 'Info';
		
		const statsList = statsContainer.createEl('ul', { cls: 'pokemon-card-stats' });
		statsList.createEl('li', { text: `Height: ${(pokemon.height / 10).toFixed(1)} m` });
		statsList.createEl('li', { text: `Weight: ${(pokemon.weight / 10).toFixed(1)} kg` });
		
		// Add type count info
		const typeCount = pokemon.types.length;
		const typeText = typeCount === 1 ? 'Single Type' : 'Dual Type';
		statsList.createEl('li', { text: `Classification: ${typeText}` });

		// Caught status
		const caughtInfo = container.createDiv('pokemon-card-status');
		const pokedexData = await this.storageService.loadPokedexData();
		const caughtEntry = pokedexData.caughtPokemon.find(p => p.id === pokemon.id);
		if (caughtEntry) {
			const timesLabel = caughtEntry.catchCount === 1 ? 'time' : 'times';
			caughtInfo.textContent = `✅ Already in your Pokédex! Caught ${caughtEntry.catchCount} ${timesLabel}.`;
			caughtInfo.addClass('caught-status');
		} else {
			caughtInfo.textContent = '🎯 Score 100% on this quiz to catch this Pokémon!';
			caughtInfo.addClass('uncaught-status');
		}

		// No footer needed - using default modal X button
	}
}
