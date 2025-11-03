/**
 * PokedexModal - Fullscreen Pokédex view
 */

import { Modal, App } from 'obsidian';
import { PokedexComponent } from './PokedexComponent';
import { StorageService } from '../services/StorageService';

export class PokedexModal extends Modal {
	constructor(
		app: App,
		private readonly storageService: StorageService
	) {
		super(app);
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('pokedex-modal');

		const header = contentEl.createDiv('pokedex-modal-header');
		header.createEl('h2', { text: 'Your Pokédex' });
		header.createDiv({
			text: 'Tap any Pokémon to view details. Catch more by acing quizzes!',
			cls: 'setting-item-description'
		});

		const scrollContainer = contentEl.createDiv('pokedex-modal-content');

		const component = new PokedexComponent(scrollContainer, this.storageService, this.app);
		await component.init();
	}

	onClose() {
		this.contentEl.empty();
	}
}