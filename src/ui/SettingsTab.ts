/**
 * QuizDex Settings Tab - Secure credential management
 */

import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import QuizDexPlugin from '../main';
import { PassphraseModal } from './PassphraseModal';
import { ProviderFactory } from '../services/ProviderFactory';

export class QuizDexSettingTab extends PluginSettingTab {
	plugin: QuizDexPlugin;

	constructor(app: App, plugin: QuizDexPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	async display() {
		const { containerEl } = this;
		containerEl.empty();

		// Header
		containerEl.createEl('h1', { text: 'QuizDex Settings' });

		// Security Section
		await this.renderSecuritySection(containerEl);

		// AI Providers Section
		await this.renderProvidersSection(containerEl);

		// Quiz Settings Section
		this.renderQuizSettings(containerEl);
	}

	/**
	 * Render security section with audit and passphrase management
	 */
	private async renderSecuritySection(containerEl: HTMLElement) {
		containerEl.createEl('h2', { text: '🔐 Security' });

		// Security audit display
		const audit = await this.plugin.credentialManager.auditSecurity();

		const auditContainer = containerEl.createDiv('security-audit-container');
		auditContainer.style.padding = '15px';
		auditContainer.style.marginBottom = '20px';
		auditContainer.style.borderRadius = '8px';
		auditContainer.style.border = '2px solid';

		if (audit.insecure > 0) {
			// Warning state
			auditContainer.style.backgroundColor = 'var(--background-modifier-error)';
			auditContainer.style.borderColor = 'var(--text-error)';

			auditContainer.createEl('h3', {
				text: `⚠️ Security Warning`,
				attr: { style: 'margin: 0 0 10px 0; color: var(--text-error);' }
			});

			auditContainer.createEl('p', {
				text: `${audit.insecure} API key(s) stored in PLAINTEXT!`,
				attr: { style: 'margin: 5px 0; font-weight: bold;' }
			});

			auditContainer.createEl('p', {
				text: 'Anyone with access to your vault can read these keys.',
				attr: { style: 'margin: 5px 0;' }
			});

			// Migration button
			const migrateBtn = auditContainer.createEl('button', {
				text: 'Migrate to Encrypted Storage Now',
				cls: 'mod-cta'
			});
			migrateBtn.style.marginTop = '10px';
			migrateBtn.addEventListener('click', async () => {
				await this.promptMigration();
			});

		} else if (audit.secure > 0) {
			// Secure state
			auditContainer.style.backgroundColor = 'var(--background-modifier-success)';
			auditContainer.style.borderColor = 'var(--color-green)';

			auditContainer.createEl('h3', {
				text: '✅ All API Keys Encrypted',
				attr: { style: 'margin: 0 0 10px 0; color: var(--color-green);' }
			});

			auditContainer.createEl('p', {
				text: `${audit.secure} credential(s) protected with AES-256-GCM encryption`,
				attr: { style: 'margin: 5px 0;' }
			});

			if (audit.providers.length > 0) {
				auditContainer.createEl('p', {
					text: `Providers: ${audit.providers.map(p => ProviderFactory.getProviderDisplayName(p)).join(', ')}`,
					attr: { style: 'margin: 5px 0; font-size: 0.9em; color: var(--text-muted);' }
				});
			}
		} else {
			// No keys configured
			auditContainer.style.backgroundColor = 'var(--background-secondary)';
			auditContainer.style.borderColor = 'var(--background-modifier-border)';

			auditContainer.createEl('h3', {
				text: 'ℹ️ No API Keys Configured',
				attr: { style: 'margin: 0 0 10px 0;' }
			});

			auditContainer.createEl('p', {
				text: 'Add API keys below to use cloud AI providers. All keys will be encrypted automatically.',
				attr: { style: 'margin: 5px 0;' }
			});
		}

		// Passphrase management
		new Setting(containerEl)
			.setName('Change Encryption Passphrase')
			.setDesc('Update the passphrase used to encrypt your API keys')
			.addButton(btn => btn
				.setButtonText('Change Passphrase')
				.onClick(async () => {
					await this.changePassphrase();
				})
			);

		// Clear all credentials (dangerous operation)
		new Setting(containerEl)
			.setName('Clear All Encrypted Credentials')
			.setDesc('⚠️ Warning: This will permanently delete all encrypted API keys')
			.addButton(btn => btn
				.setButtonText('Clear All')
				.setWarning()
				.onClick(async () => {
					await this.clearAllCredentials();
				})
			);
	}

	/**
	 * Render AI providers section
	 */
	private async renderProvidersSection(containerEl: HTMLElement) {
		containerEl.createEl('h2', { text: '🤖 AI Providers' });

		containerEl.createEl('p', {
			text: 'Configure AI providers for quiz generation. API keys are encrypted with AES-256-GCM.',
			cls: 'setting-item-description'
		});

		// Active provider selection
		new Setting(containerEl)
			.setName('Active Provider')
			.setDesc('Default AI provider for quiz generation')
			.addDropdown(dropdown => {
				const providers = ProviderFactory.getSupportedProviders();
				providers.forEach(provider => {
					dropdown.addOption(provider, ProviderFactory.getProviderDisplayName(provider));
				});
				dropdown.setValue(this.plugin.settings.provider);
				dropdown.onChange(async (value) => {
					this.plugin.settings.provider = value;
					await this.plugin.saveSettings();
				});
			});

		// Individual provider settings
		const providers = ProviderFactory.getSupportedProviders();
		for (const provider of providers) {
			await this.renderProviderSettings(containerEl, provider);
		}
	}

	/**
	 * Render settings for individual provider
	 */
	private async renderProviderSettings(containerEl: HTMLElement, provider: string) {
		const displayName = ProviderFactory.getProviderDisplayName(provider);
		const requiresKey = ProviderFactory.requiresApiKey(provider);

		// Provider header
		containerEl.createEl('h3', { text: displayName });

		// Base URL
		new Setting(containerEl)
			.setName(`${displayName} Base URL`)
			.setDesc(provider === 'ollama' ? 'Local Ollama server endpoint' : 'API endpoint URL')
			.addText(text => {
				const key = `${provider}BaseURL` as keyof typeof this.plugin.settings;
				text
					.setPlaceholder(provider === 'ollama' ? 'http://localhost:11434' : 'https://api.example.com')
					.setValue(this.plugin.settings[key] as string || '')
					.onChange(async (value) => {
						(this.plugin.settings[key] as string) = value;
						await this.plugin.saveSettings();
					});
			});

		// Model selection
		new Setting(containerEl)
			.setName(`${displayName} Model`)
			.setDesc('Model to use for quiz generation')
			.addText(text => {
				const key = `${provider}TextGenModel` as keyof typeof this.plugin.settings;
				text
					.setPlaceholder(provider === 'ollama' ? 'llama3.1:8b' : 'model-name')
					.setValue(this.plugin.settings[key] as string || '')
					.onChange(async (value) => {
						(this.plugin.settings[key] as string) = value;
						await this.plugin.saveSettings();
					});
			});

		// Test connection button (for all providers)
		new Setting(containerEl)
			.setName(`Test ${displayName} Connection`)
			.setDesc(provider === 'ollama' ? 'Verify local Ollama server is running' : 'Verify API key and connection')
			.addButton(btn => btn
				.setButtonText('Test Connection')
				.onClick(async () => {
					await this.testProviderConnection(provider, displayName);
				})
			);

		// API Key (only if required - not for Ollama)
		if (requiresKey) {
			const hasKey = await this.plugin.credentialManager.hasCredential(provider);

			new Setting(containerEl)
				.setName(`${displayName} API Key`)
				.setDesc(hasKey ? '✅ Encrypted key stored' : 'Enter API key (will be encrypted)')
				.addText(text => {
					text.setPlaceholder(hasKey ? '••••••••••••••••' : 'Enter API key');
					text.inputEl.type = 'password';
					return text;
				})
				.addButton(btn => btn
					.setButtonText(hasKey ? 'Update' : 'Save')
					.onClick(async () => {
						await this.saveApiKey(provider, displayName);
					})
				)
				.addButton(btn => {
					if (hasKey) {
						btn
							.setButtonText('Remove')
							.setWarning()
							.onClick(async () => {
								await this.plugin.credentialManager.removeCredential(provider);
								this.display(); // Refresh
							});
					}
				});
		}
	}

	/**
	 * Render quiz settings section
	 */
	private renderQuizSettings(containerEl: HTMLElement) {
		containerEl.createEl('h2', { text: '📝 Quiz Settings' });

		new Setting(containerEl)
			.setName('Default Number of Questions')
			.setDesc('Default number of questions to generate')
			.addSlider(slider => slider
				.setLimits(5, 50, 5)
				.setValue(this.plugin.settings.defaultQuestions)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.defaultQuestions = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName('Default Difficulty')
			.setDesc('Default difficulty level')
			.addDropdown(dropdown => dropdown
				.addOption('easy', 'Easy')
				.addOption('medium', 'Medium')
				.addOption('hard', 'Hard')
				.setValue(this.plugin.settings.defaultDifficulty)
				.onChange(async (value) => {
					this.plugin.settings.defaultDifficulty = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName('Include Multiple Choice')
			.setDesc('Generate multiple choice questions')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.includeMultipleChoice)
				.onChange(async (value) => {
					this.plugin.settings.includeMultipleChoice = value;
					await this.plugin.saveSettings();
				})
			);

		new Setting(containerEl)
			.setName('Include True/False')
			.setDesc('Generate true/false questions')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.includeTrueFalse)
				.onChange(async (value) => {
					this.plugin.settings.includeTrueFalse = value;
					await this.plugin.saveSettings();
				})
			);
	}

	/**
	 * Save API key with encryption
	 */
	private async saveApiKey(provider: string, displayName: string) {
		// Find the input element
		const input = document.querySelector(`input[type="password"][placeholder*="${displayName}"], input[type="password"][placeholder*="Enter API key"]`) as HTMLInputElement;

		if (!input || !input.value.trim()) {
			new Notice('⚠️ Please enter an API key');
			return;
		}

		const apiKey = input.value.trim();

		// Prompt for passphrase
		new PassphraseModal(
			this.app,
			async (passphrase) => {
				if (!passphrase) return;

				// Initialize credential manager if needed
				const initialized = await this.plugin.credentialManager.initialize(passphrase);
				if (!initialized) {
					new Notice('❌ Invalid passphrase');
					return;
				}

				// Save credential
				const success = await this.plugin.credentialManager.setCredential(
					provider,
					apiKey,
					passphrase
				);

				if (success) {
					input.value = '';
					this.display(); // Refresh settings

					// Reinitialize providers
					await this.plugin.initializeProviders();
				}
			},
			!await this.plugin.credentialManager.hasCredential(provider)
		).open();
	}

	/**
	 * Test provider connection
	 */
	private async testProviderConnection(provider: string, displayName: string) {
		const providerInstance = this.plugin.orchestrator.getProvider(provider);

		if (!providerInstance) {
			new Notice(`❌ ${displayName} not configured`);
			return;
		}

		new Notice(`⏳ Testing ${displayName} connection...`);

		const health = await providerInstance.healthCheck();

		if (health.healthy) {
			new Notice(`✅ ${displayName} connection successful! (${health.latency}ms)`);
		} else {
			new Notice(`❌ ${displayName} connection failed: ${health.message || 'Unknown error'}`);
		}
	}

	/**
	 * Prompt migration from plaintext to encrypted
	 */
	private async promptMigration() {
		new PassphraseModal(
			this.app,
			async (passphrase) => {
				if (!passphrase) return;

				const initialized = await this.plugin.credentialManager.initialize(passphrase);
				if (!initialized) {
					new Notice('❌ Failed to initialize encryption');
					return;
				}

				const success = await this.plugin.credentialManager.migrateToEncrypted(
					passphrase,
					this.plugin.settings
				);

				if (success) {
					// Clear plaintext keys
					delete this.plugin.settings.openAIApiKey;
					delete this.plugin.settings.anthropicApiKey;
					delete this.plugin.settings.googleApiKey;
					delete this.plugin.settings.perplexityApiKey;
					delete this.plugin.settings.mistralApiKey;
					delete this.plugin.settings.cohereApiKey;

					this.plugin.settings.hasMigrated = true;
					await this.plugin.saveSettings();

					this.display(); // Refresh
				}
			},
			true
		).open();
	}

	/**
	 * Change encryption passphrase
	 */
	private async changePassphrase() {
		new Notice('⚠️ Changing passphrase is not yet implemented. You can clear all credentials and re-enter them with a new passphrase.');
		// TODO: Implement passphrase change (requires re-encryption of all keys)
	}

	/**
	 * Clear all encrypted credentials
	 */
	private async clearAllCredentials() {
		const confirmed = confirm(
			'⚠️ WARNING: This will permanently delete all encrypted API keys!\n\n' +
			'You will need to re-enter all API keys.\n\n' +
			'Are you sure you want to continue?'
		);

		if (confirmed) {
			await this.plugin.credentialManager.clearAll();
			this.display(); // Refresh
		}
	}
}
