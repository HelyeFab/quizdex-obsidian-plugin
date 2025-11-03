/**
 * Quiz Generation Modal - Configure and generate quizzes
 */

import { App, Modal, Setting, ButtonComponent, Notice } from 'obsidian';
import QuizDexPlugin from '../main';
import { QuizGenerationOptions, DifficultyLevel } from '../types/quiz.types';

export class QuizGenerationModal extends Modal {
	private plugin: QuizDexPlugin;
	private options: QuizGenerationOptions;
	private onGenerate: (options: QuizGenerationOptions) => Promise<void>;

	// UI elements for validation
	private multipleChoiceToggle: HTMLElement | null = null;
	private trueFalseToggle: HTMLElement | null = null;

	constructor(
		app: App,
		plugin: QuizDexPlugin,
		selectedNotes: any[],
		onGenerate: (options: QuizGenerationOptions) => Promise<void>
	) {
		super(app);
		this.plugin = plugin;
		this.onGenerate = onGenerate;

		this.options = {
			selectedNotes,
			questionCount: plugin.settings.defaultQuestions,
			difficulty: plugin.settings.defaultDifficulty as DifficultyLevel,
			includeMultipleChoice: plugin.settings.includeMultipleChoice,
			includeTrueFalse: plugin.settings.includeTrueFalse,
			provider: plugin.settings.provider
		};
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		this.setTitle('Generate Quiz');

		// Selected Note Section
		const notesSection = contentEl.createDiv('notes-summary');
		notesSection.createEl('h3', { text: 'Source Note' });

		const noteDisplay = notesSection.createDiv();
		noteDisplay.style.border = '1px solid var(--background-modifier-border)';
		noteDisplay.style.borderRadius = '4px';
		noteDisplay.style.padding = '15px';
		noteDisplay.style.marginBottom = '20px';
		noteDisplay.style.backgroundColor = 'var(--background-secondary)';

		// Show the single note (should only be one by design)
		if (this.options.selectedNotes.length > 0) {
			const note = this.options.selectedNotes[0];

			const noteIcon = noteDisplay.createSpan({ text: '📄 ' });
			noteIcon.style.fontSize = '1.2em';
			noteIcon.style.marginRight = '8px';

			const noteName = noteDisplay.createSpan({ text: note.basename, cls: 'note-name' });
			noteName.style.fontWeight = '600';
			noteName.style.fontSize = '1.05em';

			noteDisplay.createEl('br');

			const notePath = noteDisplay.createSpan({ text: note.path, cls: 'note-path' });
			notePath.style.fontSize = '0.9em';
			notePath.style.color = 'var(--text-muted)';
			notePath.style.marginLeft = '28px';
		}

		// Quiz Configuration Section
		const configSection = contentEl.createDiv('quiz-config');
		configSection.createEl('h3', { text: 'Quiz Configuration' });

		// Number of Questions
		new Setting(configSection)
			.setName('Number of Questions')
			.setDesc('How many questions to generate')
			.addSlider(slider => slider
				.setLimits(5, 50, 5)
				.setValue(this.options.questionCount)
				.setDynamicTooltip()
				.onChange(value => {
					this.options.questionCount = value;
				})
			);

		// Difficulty Level
		new Setting(configSection)
			.setName('Difficulty Level')
			.setDesc('The difficulty level of the questions')
			.addDropdown(dropdown => dropdown
				.addOption('easy', 'Easy')
				.addOption('medium', 'Medium')
				.addOption('hard', 'Hard')
				.setValue(this.options.difficulty)
				.onChange((value) => {
					this.options.difficulty = value as DifficultyLevel;
				})
			);

		// Question Types Section
		const typesSection = contentEl.createDiv('question-types');
		typesSection.createEl('h3', { text: 'Question Types' });

		new Setting(typesSection)
			.setName('Multiple Choice Questions')
			.setDesc('Include multiple choice questions with 4 options')
			.addToggle(toggle => {
				this.multipleChoiceToggle = toggle.toggleEl;
				toggle
					.setValue(this.options.includeMultipleChoice)
					.onChange(value => {
						this.options.includeMultipleChoice = value;
						this.validateQuestionTypes();
					});
			});

		new Setting(typesSection)
			.setName('True/False Questions')
			.setDesc('Include true/false questions')
			.addToggle(toggle => {
				this.trueFalseToggle = toggle.toggleEl;
				toggle
					.setValue(this.options.includeTrueFalse)
					.onChange(value => {
						this.options.includeTrueFalse = value;
						this.validateQuestionTypes();
					});
			});

		// Provider Selection Section
		const providerSection = contentEl.createDiv('provider-selection');
		providerSection.style.marginTop = '15px';
		providerSection.style.padding = '15px';
		providerSection.style.border = '1px solid var(--background-modifier-border)';
		providerSection.style.borderRadius = '4px';
		providerSection.style.backgroundColor = 'var(--background-secondary-alt)';

		providerSection.createEl('h4', { text: 'AI Provider' });

		const availableProviders = this.plugin.orchestrator.listProviders();

		if (availableProviders.length > 0) {
			// Show which model will be used for the selected provider
			const modelInfoDiv = providerSection.createDiv('model-info');
			modelInfoDiv.style.marginBottom = '10px';
			modelInfoDiv.style.padding = '8px';
			modelInfoDiv.style.backgroundColor = 'var(--background-secondary)';
		modelInfoDiv.style.borderRadius = '4px';
		modelInfoDiv.style.fontSize = '0.9em';

		const updateModelInfo = (provider: string) => {
			const modelKey = `${provider}TextGenModel`;
			const selectedModel = (this.plugin.settings as any)[modelKey] || '(not configured)';
			const tip = provider === 'ollama'
				? ' • Tip: choose a capable instruct-tuned model (e.g., llama3, mistral, qwen2.5) for best quiz results. Avoid very small models (<4B parameters).'
				: '';
			modelInfoDiv.textContent = `📝 Model: ${selectedModel}${tip}`;
		};

		// Model selection dropdown (will be populated after provider selection)
		const modelSelectionContainer = providerSection.createDiv('model-selection-container');

		const createModelSelector = async (provider: string) => {
			modelSelectionContainer.empty();

			if (provider === 'ollama') {
				const ollamaProvider = this.plugin.orchestrator.getProvider('ollama');
				if (ollamaProvider) {
					try {
						const models = await ollamaProvider.getAvailableModels();
						if (models.length > 0) {
							new Setting(modelSelectionContainer)
								.setName('Model')
								.setDesc('Select which Ollama model to use for this quiz')
								.addDropdown(dropdown => {
									models.forEach(model => {
										dropdown.addOption(model, model);
									});

									// Set current model or default
									const currentModel = (this.plugin.settings as any).ollamaTextGenModel || models[0];
									dropdown.setValue(currentModel);

									// Store selection in modelOverride
									this.options.modelOverride = currentModel;
									console.log(`🔧 [QuizModal] Initial model set to: ${currentModel}`);

									dropdown.onChange(value => {
										this.options.modelOverride = value;
										console.log(`🔧 [QuizModal] Model changed to: ${value}`);
									});
								});
						}
					} catch (error) {
						console.error('Failed to fetch Ollama models:', error);
					}
				}
			}
		};

			new Setting(providerSection)
				.setName('Provider')
				.setDesc('Select AI provider for quiz generation')
				.addDropdown(dropdown => {
					availableProviders.forEach(provider => {
						const displayName = provider === 'ollama' ? 'Ollama (Local)' :
							provider === 'openai' ? 'OpenAI' : provider;
						dropdown.addOption(provider, displayName);
					});
					const initialProvider = this.options.provider || availableProviders[0];
					dropdown.setValue(initialProvider);
					updateModelInfo(initialProvider);

					dropdown.onChange(async (value) => {
						this.options.provider = value;
						updateModelInfo(value);
						await createModelSelector(value);
					});
				});

			// Load initial model selector
			createModelSelector(this.options.provider || availableProviders[0]);

			// Connection Test Section
			const connectionSection = contentEl.createDiv('connection-test');
			connectionSection.style.marginTop = '20px';
			connectionSection.style.padding = '15px';
			connectionSection.style.border = '1px solid var(--background-modifier-border)';
			connectionSection.style.borderRadius = '4px';
			connectionSection.style.backgroundColor = 'var(--background-secondary)';

			connectionSection.createEl('h4', { text: 'Connection Test' });

			const connectionStatus = connectionSection.createDiv('connection-status');
			connectionStatus.style.marginBottom = '10px';

			const testBtn = new ButtonComponent(connectionSection);
			testBtn.setButtonText('Test Connection');
			testBtn.setTooltip('Verify AI provider is accessible');
			testBtn.onClick(async () => {
				testBtn.setDisabled(true);
				testBtn.setButtonText('Testing...');

				try {
					const currentProvider = this.options.provider || availableProviders[0];
					const provider = this.plugin.orchestrator.getProvider(currentProvider);

					if (!provider) {
						connectionStatus.empty();
						connectionStatus.createEl('div', {
							text: '❌ Provider not found',
							cls: 'connection-error'
						}).style.color = 'var(--text-error)';
						return;
					}

					const isConnected = await provider.testConnection();

					connectionStatus.empty();
					if (isConnected) {
						connectionStatus.createEl('div', {
							text: '✅ Connection successful!',
							cls: 'connection-success'
						}).style.color = 'var(--text-success)';

						// If Ollama, also show available models
						if (currentProvider === 'ollama') {
							const models = await provider.getAvailableModels();
							if (models.length > 0) {
								const modelsDiv = connectionStatus.createDiv();
								modelsDiv.style.marginTop = '8px';
								modelsDiv.style.fontSize = '0.9em';
								modelsDiv.style.color = 'var(--text-muted)';
								modelsDiv.textContent = `Available models: ${models.join(', ')}`;
							}
						}
					} else {
						connectionStatus.createEl('div', {
							text: '❌ Connection failed. Please check settings.',
							cls: 'connection-error'
						}).style.color = 'var(--text-error)';
					}
				} catch (error) {
					console.error('Connection test failed:', error);
					connectionStatus.empty();
					connectionStatus.createEl('div', {
						text: `❌ Error: ${error.message}`,
						cls: 'connection-error'
					}).style.color = 'var(--text-error)';
				} finally {
					testBtn.setDisabled(false);
					testBtn.setButtonText('Test Connection');
				}
			});
		} else {
			providerSection.createEl('p', {
				text: '⚠️ No AI providers configured. Please configure a provider in settings.',
				cls: 'mod-warning'
			}).style.color = 'var(--text-error)';
		}

		// Action Buttons
		const actionContainer = contentEl.createDiv('action-container');
		actionContainer.style.display = 'flex';
		actionContainer.style.justifyContent = 'flex-end';
		actionContainer.style.gap = '10px';
		actionContainer.style.marginTop = '20px';

		const cancelBtn = new ButtonComponent(actionContainer);
		cancelBtn.setButtonText('Cancel');
		cancelBtn.onClick(() => {
			this.close();
		});

		const generateBtn = new ButtonComponent(actionContainer);
		generateBtn.setButtonText('Generate Quiz');
		generateBtn.setCta();
		generateBtn.onClick(async () => {
			if (!this.validateInputs()) {
				return;
			}

			generateBtn.setDisabled(true);
			generateBtn.setButtonText('Generating...');

			try {
				console.log('🔧 [QuizModal] Generating quiz with options:', {
					provider: this.options.provider,
					modelOverride: this.options.modelOverride,
					questionCount: this.options.questionCount,
					difficulty: this.options.difficulty
				});
				await this.onGenerate(this.options);
				this.close();
			} catch (error) {
				console.error('Quiz generation failed:', error);
				new Notice('❌ Failed to generate quiz. Please try again.');
			} finally {
				generateBtn.setDisabled(false);
				generateBtn.setButtonText('Generate Quiz');
			}
		});
	}

	validateQuestionTypes(): boolean {
		const hasValidTypes = this.options.includeMultipleChoice || this.options.includeTrueFalse;

		if (!hasValidTypes) {
			// Auto-enable at least one type
			if (!this.options.includeMultipleChoice && !this.options.includeTrueFalse) {
				this.options.includeMultipleChoice = true;
				if (this.multipleChoiceToggle) {
					(this.multipleChoiceToggle as HTMLInputElement).checked = true;
				}
			} else if (this.options.includeTrueFalse && this.trueFalseToggle) {
				// Ensure UI reflects state
				(this.trueFalseToggle as HTMLInputElement).checked = true;
			}
		}

		return hasValidTypes;
	}

	validateInputs(): boolean {
		if (!this.validateQuestionTypes()) {
			new Notice('⚠️ Please select at least one question type.');
			return false;
		}

		if (this.options.questionCount < 5 || this.options.questionCount > 50) {
			new Notice('⚠️ Number of questions must be between 5 and 50.');
			return false;
		}

		if (this.options.selectedNotes.length === 0) {
			new Notice('⚠️ No notes selected for quiz generation.');
			return false;
		}

		const availableProviders = this.plugin.orchestrator.listProviders();
		if (availableProviders.length === 0) {
			new Notice('⚠️ No AI providers configured. Please configure a provider in settings.');
			return false;
		}

		return true;
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
