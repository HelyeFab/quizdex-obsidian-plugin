/**
 * Quiz Load Modal - Browse and load saved quizzes
 */

import { App, Modal, TFile, ButtonComponent, Notice } from 'obsidian';
import { StorageService } from '../services/StorageService';
import { Quiz } from '../types/quiz.types';

export class QuizLoadModal extends Modal {
	private storageService: StorageService;
	private onLoad: (quiz: Quiz) => Promise<void>;
	private quizFiles: TFile[] = [];

	constructor(
		app: App,
		storageService: StorageService,
		onLoad: (quiz: Quiz) => Promise<void>
	) {
		super(app);
		this.storageService = storageService;
		this.onLoad = onLoad;
	}

	async onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		this.setTitle('Load Saved Quiz');

		// Load quiz list
		new Notice('📂 Loading saved quizzes...', 2000);
		this.quizFiles = await this.storageService.listQuizzes();

		if (this.quizFiles.length === 0) {
			contentEl.createEl('p', {
				text: '📭 No saved quizzes found. Generate your first quiz to get started!',
				cls: 'mod-warning'
			});

			const closeBtn = new ButtonComponent(contentEl);
			closeBtn.setButtonText('Close');
			closeBtn.onClick(() => this.close());
			return;
		}

		// Stats header
		const statsDiv = contentEl.createDiv('quiz-stats');
		statsDiv.style.padding = '10px';
		statsDiv.style.marginBottom = '15px';
		statsDiv.style.backgroundColor = 'var(--background-secondary)';
		statsDiv.style.borderRadius = '4px';
		statsDiv.createEl('p', {
			text: `📚 You have ${this.quizFiles.length} saved quiz${this.quizFiles.length !== 1 ? 'zes' : ''}`
		});

		// Quiz list container
		const listContainer = contentEl.createDiv('quiz-list');
		listContainer.style.maxHeight = '400px';
		listContainer.style.overflowY = 'auto';
		listContainer.style.border = '1px solid var(--background-modifier-border)';
		listContainer.style.borderRadius = '4px';
		listContainer.style.padding = '10px';

		// Render each quiz
		for (const file of this.quizFiles) {
			await this.renderQuizItem(listContainer, file);
		}

		// Footer buttons
		const footer = contentEl.createDiv('modal-footer');
		footer.style.marginTop = '20px';
		footer.style.display = 'flex';
		footer.style.justifyContent = 'flex-end';

		const closeBtn = new ButtonComponent(footer);
		closeBtn.setButtonText('Close');
		closeBtn.onClick(() => this.close());
	}

	private async renderQuizItem(container: HTMLElement, file: TFile) {
		const itemDiv = container.createDiv('quiz-item');
		itemDiv.style.padding = '12px';
		itemDiv.style.marginBottom = '10px';
		itemDiv.style.border = '1px solid var(--background-modifier-border)';
		itemDiv.style.borderRadius = '4px';
		itemDiv.style.cursor = 'pointer';
		itemDiv.style.transition = 'background-color 0.2s';

		// Hover effect
		itemDiv.addEventListener('mouseenter', () => {
			itemDiv.style.backgroundColor = 'var(--background-modifier-hover)';
		});
		itemDiv.addEventListener('mouseleave', () => {
			itemDiv.style.backgroundColor = '';
		});

		// Load quiz metadata
		const savedQuiz = await this.storageService.loadQuiz(file.path);

		if (!savedQuiz) {
			itemDiv.createEl('p', { text: '⚠️ Failed to load quiz metadata', cls: 'mod-warning' });
			return;
		}

		const { quiz, metadata } = savedQuiz;

		// Title
		const titleEl = itemDiv.createEl('h3', { text: quiz.title });
		titleEl.style.marginBottom = '8px';
		titleEl.style.color = 'var(--text-accent)';

		// Metadata
		const metaContainer = itemDiv.createDiv('quiz-metadata');
		metaContainer.style.fontSize = '0.9em';
		metaContainer.style.color = 'var(--text-muted)';

		const createdDate = new Date(metadata.createdAt);
		const dateStr = createdDate.toLocaleDateString() + ' ' + createdDate.toLocaleTimeString();

		metaContainer.createEl('div', { text: `📅 Created: ${dateStr}` });
		metaContainer.createEl('div', { text: `🎯 Difficulty: ${metadata.difficulty}` });
		metaContainer.createEl('div', { text: `❓ Questions: ${quiz.questions.length}` });
		metaContainer.createEl('div', { text: `🤖 Provider: ${metadata.provider}` });

		if (metadata.sourceNotes && metadata.sourceNotes.length > 0) {
			const notesDiv = metaContainer.createDiv();
			notesDiv.style.marginTop = '5px';
			notesDiv.createEl('span', { text: '📝 Sources: ' });
			const notesSpan = notesDiv.createEl('span');
			notesSpan.style.fontStyle = 'italic';
			notesSpan.textContent = metadata.sourceNotes
				.map(path => path.split('/').pop()?.replace('.md', '') || path)
				.join(', ');
		}

		// Load button
		const btnContainer = itemDiv.createDiv();
		btnContainer.style.marginTop = '10px';

		const loadBtn = new ButtonComponent(btnContainer);
		loadBtn.setButtonText('Load Quiz');
		loadBtn.setCta();
		loadBtn.onClick(async () => {
			try {
				await this.onLoad(quiz);
				this.close();
			} catch (error) {
				console.error('Failed to load quiz:', error);
				new Notice('❌ Failed to load quiz');
			}
		});

		// Delete button
		const deleteBtn = new ButtonComponent(btnContainer);
		deleteBtn.setButtonText('Delete');
		deleteBtn.setWarning();
		deleteBtn.onClick(async () => {
			const confirmed = confirm(`Are you sure you want to delete "${quiz.title}"?`);
			if (confirmed) {
				try {
					await this.app.vault.delete(file);
					new Notice('✅ Quiz deleted');
					// Refresh the modal
					this.close();
					new QuizLoadModal(this.app, this.storageService, this.onLoad).open();
				} catch (error) {
					console.error('Failed to delete quiz:', error);
					new Notice('❌ Failed to delete quiz');
				}
			}
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
