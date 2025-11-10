/**
 * Pokedex Component - Display caught Pokémon collection
 */

import { Notice, App } from 'obsidian';
import { StorageService } from '../services/StorageService';
import { Pokemon } from '../types/quiz.types';
import { fetchPokemonById, formatPokemonName } from '../utils/pokemon';
import { PokemonCardModal } from './PokemonCardModal';

interface CaughtPokemon {
	id: number;
	name: string;
	caughtAt: Date;
	quizScore: number;
	catchCount: number;
}

export class PokedexComponent {
	private containerEl: HTMLElement;
	private caughtPokemon: CaughtPokemon[] = [];
	private loading: boolean = false;
	private storageService: StorageService;
	private app: App;

	constructor(containerEl: HTMLElement, storageService: StorageService, app: App) {
		this.containerEl = containerEl;
		this.storageService = storageService;
		this.app = app;
	}

	/**
	 * Initialize the Pokédex component
	 */
	async init() {
		this.containerEl.empty();
		this.containerEl.addClass('pokedex-container');

		// Load caught Pokémon from vault
		await this.loadCaughtPokemon();

		// Render header
		this.renderHeader();

		// Render Pokémon grid
		await this.renderPokemonGrid();
	}

	/**
	 * Load caught Pokémon from vault
	 */
	private async loadCaughtPokemon() {
		try {
			const data = await this.storageService.loadPokedexData();
			this.caughtPokemon = data.caughtPokemon.map((p) => ({
				id: p.id,
				name: p.name,
				caughtAt: new Date(p.caughtAt),
				quizScore: typeof p.score === 'number' ? p.score : 0,
				catchCount: p.catchCount && p.catchCount > 0 ? p.catchCount : 1
			}));
		} catch (error) {
			console.error('Failed to load caught Pokémon:', error);
			this.caughtPokemon = [];
		}
	}

	/**
	 * Save caught Pokémon to vault
	 */
	private async saveCaughtPokemon() {
		try {
		await this.storageService.savePokedexData({
			caughtPokemon: this.caughtPokemon.map(p => ({
				id: p.id,
				name: p.name,
				caughtAt: p.caughtAt.toISOString(),
				score: p.quizScore,
				catchCount: p.catchCount ?? 1
			})),
			totalCaught: this.caughtPokemon.length,
			lastUpdated: new Date().toISOString()
		});
		} catch (error) {
			console.error('Failed to save caught Pokémon:', error);
		}
	}

	/**
	 * Catch a new Pokémon (called when scoring 100%)
	 */
	async catchPokemon(pokemonId: number, quizScore: number) {
	const existing = this.caughtPokemon.find(p => p.id === pokemonId);

	if (existing) {
		existing.catchCount = (existing.catchCount ?? 1) + 1;
		existing.caughtAt = new Date();
		existing.quizScore = Math.max(existing.quizScore, quizScore);
		await this.saveCaughtPokemon();
		return true;
	}

		// Check if already caught
		// (handled above)

		// Fetch Pokémon data
		const pokemonData = await fetchPokemonById(pokemonId);
		if (!pokemonData) {
			return false;
		}

		// Add to caught list
		this.caughtPokemon.push({
			id: pokemonId,
			name: pokemonData.name,
			caughtAt: new Date(),
			quizScore,
		catchCount: 1
	});

		await this.saveCaughtPokemon();
		return true;
	}

	/**
	 * Render Pokédex header
	 */
	private renderHeader() {
		const header = this.containerEl.createDiv('pokedex-header');

		header.createEl('h3', {
			text: 'Your Pokédex',
			attr: { style: 'margin: 0; color: var(--interactive-accent);' }
		});

		const stats = header.createDiv('pokedex-stats');
		stats.style.marginTop = '10px';

		const caught = this.caughtPokemon.length;
		const total = 151; // Gen 1 Pokémon

		const progressContainer = stats.createDiv('progress-container');
		const progressBar = progressContainer.createDiv('progress-bar');
		const progressFill = progressBar.createDiv('progress-fill');
		const progressPercent = total > 0 ? (caught / total) * 100 : 0;
		progressFill.style.width = `${progressPercent}%`;

		const statsText = stats.createDiv();
		statsText.style.display = 'flex';
		statsText.style.justifyContent = 'space-between';
		statsText.style.marginTop = '8px';
		statsText.style.fontSize = '0.9em';

		statsText.createDiv({
			text: `Caught: ${caught} / ${total}`,
			cls: 'stat-item'
		});

		statsText.createDiv({
			text: `${progressPercent.toFixed(1)}% Complete`,
			cls: 'stat-item',
			attr: { style: 'color: var(--interactive-accent);' }
		});
	}

	/**
	 * Render Pokémon grid
	 */
	private async renderPokemonGrid() {
		const gridContainer = this.containerEl.createDiv('pokemon-grid-container');

		// Loading state
		if (this.loading) {
			const loadingDiv = gridContainer.createDiv('pokedex-loading');
			loadingDiv.createDiv({
				text: '⚡',
				cls: 'loading-spinner'
			});
			loadingDiv.createEl('p', { text: 'Loading your Pokédex...' });
			return;
		}

		// Scrollable area
		const scrollArea = gridContainer.createDiv('pokemon-scroll-area');

		// Grid
		const grid = scrollArea.createDiv('pokemon-grid');

		// Show ALL 151 Gen 1 Pokémon (in order)
		const totalPokemon = 151;

		for (let id = 1; id <= totalPokemon; id++) {
			const caught = this.caughtPokemon.find(p => p.id === id);
			const pokemonData = await fetchPokemonById(id);

			if (pokemonData) {
				this.renderPokemonEntry(
					grid,
					pokemonData,
					caught
				);
			}
		}
	}

/**
 * Render individual Pokémon entry
 */
	private renderPokemonEntry(
		container: HTMLElement,
		pokemon: Pokemon,
		caught?: CaughtPokemon
	) {
		const entry = container.createDiv('pokemon-entry');
		const isCaught = Boolean(caught);
		entry.addClass(isCaught ? 'caught' : 'uncaught');

		// Pokémon number
		const number = entry.createDiv('pokemon-number');
		number.textContent = `#${pokemon.id.toString().padStart(3, '0')}`;

		// Sprite container
		const spriteContainer = entry.createDiv('pokemon-sprite-container');
		if (pokemon.sprites.front_default) {
			spriteContainer.createEl('img', {
				cls: 'pokemon-sprite',
				attr: {
					src: pokemon.sprites.front_default,
					alt: pokemon.name
				}
			});
		} else {
			spriteContainer.createDiv({
				text: '❓',
				cls: 'missing-sprite'
			});
		}

		// Pokémon name
		const name = entry.createDiv('pokemon-name');
		name.textContent = formatPokemonName(pokemon.name);

		// Caught indicator / count badge
		if (caught) {
			const indicator = entry.createDiv('caught-indicator');
			indicator.textContent = caught.catchCount > 1 ? `×${caught.catchCount}` : '✓';
		}

		// Click to show details
		entry.addEventListener('click', () => {
			this.showPokemonDetails(pokemon, caught);
		});
	}

/**
 * Show Pokémon details modal
 */
	private showPokemonDetails(pokemon: Pokemon, caught?: CaughtPokemon) {
		try {
			new PokemonCardModal(this.app, pokemon.id, this.storageService).open();
		} catch (error) {
			console.error('Failed to open Pokemon card modal:', error);
			// Fallback to simple notice
			const details = [
				`**ID:** #${pokemon.id}`,
				`**Name:** ${formatPokemonName(pokemon.name)}`,
				`**Types:** ${pokemon.types.map(t => formatPokemonName(t.type.name)).join(', ')}`,
			];

			if (caught) {
				details.push(`**Caught:** ${caught.caughtAt.toLocaleDateString()}`);
				details.push(`**Catch Count:** ${caught.catchCount}`);
			}

			new Notice(details.join('\n'), 5000);
		}
	}

	/**
	 * Get total caught count
	 */
	getCaughtCount(): number {
		return this.caughtPokemon.length;
	}

	/**
	 * Check if Pokémon is caught
	 */
	isCaught(pokemonId: number): boolean {
		return this.caughtPokemon.some(p => p.id === pokemonId);
	}
}