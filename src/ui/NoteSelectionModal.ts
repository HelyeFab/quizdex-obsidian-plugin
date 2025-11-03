/**
 * Note Selection Modal - Select notes for quiz generation
 */

import { App, Modal, TFile, Setting } from 'obsidian';

export class NoteSelectionModal extends Modal {
	private selectedNote: TFile | null = null;
	private onSelect: (notes: TFile[]) => void;
	private searchQuery: string = '';

	constructor(app: App, onSelect: (notes: TFile[]) => void) {
		super(app);
		this.onSelect = onSelect;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		this.setTitle('Select Note for Quiz');

		// Info text
		const infoText = contentEl.createDiv();
		infoText.style.marginBottom = '15px';
		infoText.style.padding = '12px';
		infoText.style.backgroundColor = 'var(--background-secondary)';
		infoText.style.borderRadius = '4px';
		infoText.style.border = '2px solid var(--interactive-accent)';

		const infoIcon = infoText.createSpan({ text: '💡 ' });
		infoIcon.style.fontSize = '1.2em';

		const infoMessage = infoText.createSpan({
			text: 'Select one note to generate quiz questions from. QuizDex works best with focused, single-topic content.',
			cls: 'setting-item-description'
		});
		infoMessage.style.fontWeight = '500';

		// Search input
		const searchContainer = contentEl.createDiv('search-container');
		searchContainer.style.marginBottom = '15px';

		const searchInput = searchContainer.createEl('input', {
			type: 'text',
			placeholder: 'Search notes...',
			cls: 'search-input'
		});
		searchInput.style.width = '100%';
		searchInput.style.padding = '8px 12px';
		searchInput.style.border = '1px solid var(--background-modifier-border)';
		searchInput.style.borderRadius = '4px';
		searchInput.style.backgroundColor = 'var(--background-primary)';
		searchInput.style.color = 'var(--text-normal)';

		searchInput.addEventListener('input', (e) => {
			this.searchQuery = (e.target as HTMLInputElement).value.toLowerCase();
			this.renderNotesList(notesListContainer);
		});

		// Selected note display
		const selectedDiv = contentEl.createDiv('selected-note');
		selectedDiv.style.marginBottom = '10px';
		selectedDiv.style.padding = '10px';
		selectedDiv.style.backgroundColor = 'var(--background-secondary)';
		selectedDiv.style.borderRadius = '4px';
		selectedDiv.style.textAlign = 'center';
		selectedDiv.style.minHeight = '40px';
		selectedDiv.style.display = 'flex';
		selectedDiv.style.alignItems = 'center';
		selectedDiv.style.justifyContent = 'center';

		const updateSelectedDisplay = () => {
			selectedDiv.empty();
			if (this.selectedNote) {
				const selectedIcon = selectedDiv.createSpan({ text: '✓ ' });
				selectedIcon.style.color = 'var(--interactive-accent)';
				selectedIcon.style.fontWeight = 'bold';
				selectedIcon.style.marginRight = '8px';

				selectedDiv.createSpan({ text: `Selected: ${this.selectedNote.basename}` });
			} else {
				selectedDiv.createSpan({
					text: 'No note selected',
					cls: 'setting-item-description'
				});
			}
		};
		updateSelectedDisplay();

		// Notes list container
		const notesListContainer = contentEl.createDiv('notes-list');
		notesListContainer.style.maxHeight = '400px';
		notesListContainer.style.overflowY = 'auto';
		notesListContainer.style.border = '1px solid var(--background-modifier-border)';
		notesListContainer.style.borderRadius = '4px';
		notesListContainer.style.marginBottom = '15px';

		this.renderNotesList(notesListContainer);

		// Action buttons
		const actionContainer = contentEl.createDiv('action-container');
		actionContainer.style.display = 'flex';
		actionContainer.style.justifyContent = 'space-between';
		actionContainer.style.gap = '10px';

		// Clear Selection button
		const selectionBtns = actionContainer.createDiv();
		selectionBtns.style.display = 'flex';
		selectionBtns.style.gap = '5px';

		new Setting(selectionBtns)
			.addButton(btn => btn
				.setButtonText('Clear Selection')
				.onClick(() => {
					this.selectedNote = null;
					this.renderNotesList(notesListContainer);
					updateSelectedDisplay();
				})
			);

		// Cancel / Continue
		const mainBtns = actionContainer.createDiv();
		mainBtns.style.display = 'flex';
		mainBtns.style.gap = '10px';

		new Setting(mainBtns)
			.addButton(btn => btn
				.setButtonText('Cancel')
				.onClick(() => {
					this.close();
				})
			)
			.addButton(btn => btn
				.setButtonText('Continue')
				.setCta()
				.onClick(() => {
					if (!this.selectedNote) {
						// Auto-select current file if nothing selected
						const activeFile = this.app.workspace.getActiveFile();
						if (activeFile) {
							this.selectedNote = activeFile;
						}
					}

					if (this.selectedNote) {
						this.onSelect([this.selectedNote]);
						this.close();
					}
				})
			);

		// Store reference for display updates
		(this as any).updateSelectedDisplay = updateSelectedDisplay;
	}

	private getFilteredNotes(): TFile[] {
		const allNotes = this.app.vault.getMarkdownFiles();

		if (!this.searchQuery) {
			return allNotes;
		}

		return allNotes.filter(note => {
			const basename = note.basename.toLowerCase();
			const path = note.path.toLowerCase();
			return basename.includes(this.searchQuery) || path.includes(this.searchQuery);
		});
	}

	private renderNotesList(container: HTMLElement) {
		container.empty();

		const filteredNotes = this.getFilteredNotes();

		if (filteredNotes.length === 0) {
			const emptyDiv = container.createDiv();
			emptyDiv.style.padding = '40px';
			emptyDiv.style.textAlign = 'center';
			emptyDiv.style.color = 'var(--text-muted)';
			emptyDiv.textContent = 'No notes found';
			return;
		}

		filteredNotes.forEach(note => {
			const noteItem = container.createDiv('note-item');
			noteItem.style.padding = '12px 15px';
			noteItem.style.cursor = 'pointer';
			noteItem.style.borderBottom = '1px solid var(--background-modifier-border)';
			noteItem.style.display = 'flex';
			noteItem.style.alignItems = 'center';
			noteItem.style.gap = '10px';
			noteItem.style.transition = 'background-color 0.2s ease';

			const isSelected = this.selectedNote === note;

			// Radio button (single selection)
			const radio = noteItem.createEl('input', {
				type: 'radio'
			});
			radio.checked = isSelected;
			radio.style.cursor = 'pointer';
			radio.name = 'note-selection'; // Group radio buttons

			// Note info
			const noteInfo = noteItem.createDiv();
			noteInfo.style.flex = '1';

			const noteName = noteInfo.createDiv();
			noteName.textContent = note.basename;
			noteName.style.fontWeight = '500';
			noteName.style.marginBottom = '2px';

			const notePath = noteInfo.createDiv();
			notePath.textContent = note.path;
			notePath.style.fontSize = '0.85em';
			notePath.style.color = 'var(--text-muted)';

			// Highlight selected
			if (isSelected) {
				noteItem.style.backgroundColor = 'var(--interactive-accent-hover)';
				noteItem.style.borderLeft = '3px solid var(--interactive-accent)';
				noteItem.style.paddingLeft = '12px';
			}

			// Click handler - single selection
			const selectNote = () => {
				this.selectedNote = note;
				this.renderNotesList(container);
				if ((this as any).updateSelectedDisplay) {
					(this as any).updateSelectedDisplay();
				}
			};

			noteItem.addEventListener('click', selectNote);
			radio.addEventListener('click', (e) => {
				e.stopPropagation();
				selectNote();
			});

			noteItem.addEventListener('mouseenter', () => {
				if (!isSelected) {
					noteItem.style.backgroundColor = 'var(--background-modifier-hover)';
				}
			});

			noteItem.addEventListener('mouseleave', () => {
				if (!isSelected) {
					noteItem.style.backgroundColor = '';
				}
			});
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
