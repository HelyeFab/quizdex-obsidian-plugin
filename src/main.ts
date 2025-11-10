/**
 * QuizDex v2.0 - Main Plugin Entry Point
 *
 * Features:
 * - Secure API key storage with AES-256-GCM encryption
 * - Multi-provider AI support with automatic fallback
 * - Circuit breaker pattern for resilience
 * - Comprehensive error handling
 */

import { Plugin, Notice } from 'obsidian';
import { CredentialManager } from './security/CredentialManager';
import { AIProviderOrchestrator } from './services/AIProviderOrchestrator';
import { ProviderFactory } from './services/ProviderFactory';
import { StorageService } from './services/StorageService';
import { PassphraseModal, MigrationModal } from './ui/PassphraseModal';
import { QuizDexSettingTab } from './ui/SettingsTab';
import { AIProviderConfig } from './types/quiz.types';

interface QuizDexSettings {
	// Provider configuration
	provider: string;

	// Provider base URLs
	ollamaBaseURL: string;
	openAIBaseURL: string;
	anthropicBaseURL: string;
	googleBaseURL: string;
	perplexityBaseURL: string;
	mistralBaseURL: string;
	cohereBaseURL: string;

	// Models
	ollamaTextGenModel: string;
	openAITextGenModel: string;
	anthropicTextGenModel: string;
	googleTextGenModel: string;
	perplexityTextGenModel: string;
	mistralTextGenModel: string;
	cohereTextGenModel: string;

	// Quiz settings
	defaultQuestions: number;
	defaultDifficulty: string;
	includeMultipleChoice: boolean;
	includeTrueFalse: boolean;

	// Legacy plaintext keys (for migration detection)
	openAIApiKey?: string;
	anthropicApiKey?: string;
	googleApiKey?: string;
	perplexityApiKey?: string;
	mistralApiKey?: string;
	cohereApiKey?: string;

	// Migration status
	hasMigrated?: boolean;
	passphraseSet?: boolean;
}

const DEFAULT_SETTINGS: QuizDexSettings = {
	provider: 'ollama',

	ollamaBaseURL: 'http://localhost:11434',
	openAIBaseURL: 'https://api.openai.com/v1',
	anthropicBaseURL: 'https://api.anthropic.com',
	googleBaseURL: 'https://generativelanguage.googleapis.com',
	perplexityBaseURL: 'https://api.perplexity.ai',
	mistralBaseURL: 'https://api.mistral.ai',
	cohereBaseURL: 'https://api.cohere.com',

	ollamaTextGenModel: 'llama3.1:8b',
	openAITextGenModel: 'gpt-4o-mini',
	anthropicTextGenModel: 'claude-3-haiku-20240307',
	googleTextGenModel: 'gemini-1.5-flash',
	perplexityTextGenModel: 'llama-3.1-sonar-small-128k-chat',
	mistralTextGenModel: 'open-mistral-nemo',
	cohereTextGenModel: 'command-r-08-2024',

	defaultQuestions: 10,
	defaultDifficulty: 'medium',
	includeMultipleChoice: true,
	includeTrueFalse: true
};

export default class QuizDexPlugin extends Plugin {
	settings!: QuizDexSettings;
	credentialManager!: CredentialManager;
	orchestrator!: AIProviderOrchestrator;
	storageService!: StorageService;
	private passphraseCache: string | null = null;

	async onload() {
		console.log('Loading QuizDex v2.0...');

		// Load settings
		await this.loadSettings();

		// Initialize storage service
		this.storageService = new StorageService(this.app);
		await this.storageService.initialize();

		// Initialize credential manager
		this.credentialManager = new CredentialManager(this);

		// Initialize AI provider orchestrator
		this.orchestrator = new AIProviderOrchestrator();

		// Check for migration needs
		await this.checkAndMigrate();

		// Prompt for passphrase if needed
		await this.ensurePassphraseUnlocked();

		// Initialize providers
		await this.initializeProviders();

		// Add ribbon icon for quick quiz generation
		const ribbonIconEl = this.addRibbonIcon('graduation-cap', 'QuizDex: Generate Quiz from Active Note', () => {
			this.generateQuizFromActiveFile();
		});

		// Add custom "QD" text styling
		ribbonIconEl.addClass('quizdex-ribbon-icon');
		ribbonIconEl.setAttribute('aria-label', 'QuizDex: Generate Quiz');

		// Add commands
		this.addCommand({
			id: 'generate-quiz',
			name: 'Generate Quiz from Notes',
			callback: () => this.generateQuizCommand()
		});

		this.addCommand({
			id: 'generate-quiz-active',
			name: 'Generate Quiz from Active Note',
			callback: () => this.generateQuizFromActiveFile()
		});

		this.addCommand({
			id: 'security-audit',
			name: 'Run Security Audit',
			callback: () => this.runSecurityAudit()
		});

		this.addCommand({
			id: 'provider-status',
			name: 'Show AI Provider Status',
			callback: () => this.showProviderStatus()
		});

		// Add settings tab
		this.addSettingTab(new QuizDexSettingTab(this.app, this));

		console.log('✅ QuizDex v2.0 loaded successfully');
	}

	onunload() {
		// Clean up sensitive data
		this.credentialManager.destroy();
		this.orchestrator.destroy();
		this.passphraseCache = null;
		console.log('QuizDex unloaded');
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	/**
	 * Check for insecure API keys and prompt migration
	 */
	private async checkAndMigrate() {
		// Skip if already migrated
		if (this.settings.hasMigrated) {
			return;
		}

		const audit = await this.credentialManager.auditSecurity();

		if (audit.insecure > 0) {
			new Notice(`⚠️ Found ${audit.insecure} unencrypted API key(s)`, 5000);

			// Show migration modal after short delay
			setTimeout(() => {
				new MigrationModal(
					this.app,
					audit.insecure,
					async (passphrase) => {
						if (passphrase) {
							await this.performMigration(passphrase);
						}
					}
				).open();
			}, 2000);
		}
	}

	/**
	 * Perform migration from plaintext to encrypted storage
	 */
	private async performMigration(passphrase: string) {
		try {
			// Initialize credential manager with passphrase
			const initialized = await this.credentialManager.initialize(passphrase);
			if (!initialized) {
				new Notice('❌ Failed to initialize encryption');
				return;
			}

			// Migrate all plaintext keys
			const success = await this.credentialManager.migrateToEncrypted(
				passphrase,
				this.settings
			);

			if (success) {
				// Clear plaintext keys from settings
				delete this.settings.openAIApiKey;
				delete this.settings.anthropicApiKey;
				delete this.settings.googleApiKey;
				delete this.settings.perplexityApiKey;
				delete this.settings.mistralApiKey;
				delete this.settings.cohereApiKey;

				// Mark as migrated
				this.settings.hasMigrated = true;
				this.settings.passphraseSet = true;

				await this.saveSettings();

				// Cache passphrase for this session
				this.passphraseCache = passphrase;

				new Notice('✅ Migration complete! Your API keys are now encrypted.');

				// Reinitialize providers with encrypted keys
				await this.initializeProviders();
			}
		} catch (error) {
			console.error('Migration failed:', error);
			new Notice('❌ Migration failed. Please try again.');
		}
	}

	/**
	 * Ensure user has unlocked encrypted credentials
	 */
	private async ensurePassphraseUnlocked(): Promise<boolean> {
		// Check if we have encrypted credentials
		const audit = await this.credentialManager.auditSecurity();
		if (audit.secure === 0) {
			// No encrypted credentials yet
			return true;
		}

		// Check if already unlocked in this session
		if (this.passphraseCache) {
			const initialized = await this.credentialManager.initialize(this.passphraseCache);
			if (initialized) {
				return true;
			}
		}

		// Prompt for passphrase
		return new Promise((resolve) => {
			new PassphraseModal(
				this.app,
				async (passphrase) => {
					if (passphrase) {
						const initialized = await this.credentialManager.initialize(passphrase);
						if (initialized) {
							this.passphraseCache = passphrase;
							resolve(true);
						} else {
							new Notice('❌ Invalid passphrase');
							resolve(false);
						}
					} else {
						resolve(false);
					}
				},
				false
			).open();
		});
	}

	/**
	 * Initialize all AI providers
	 */
	async initializeProviders() {
		await ProviderFactory.initializeAll(
			this.orchestrator,
			async (provider) => this.getProviderConfig(provider)
		);

		const registeredProviders = this.orchestrator.listProviders();
		console.log(`✅ Registered ${registeredProviders.length} AI providers:`, registeredProviders);
	}

	/**
	 * Get configuration for a specific provider
	 */
	private async getProviderConfig(provider: string): Promise<AIProviderConfig | null> {
		const baseURLKey = `${provider}BaseURL` as keyof QuizDexSettings;
		const modelKey = `${provider}TextGenModel` as keyof QuizDexSettings;

		const baseURL = this.settings[baseURLKey] as string;
		const model = this.settings[modelKey] as string;

		if (!baseURL || !model) {
			return null;
		}

		// Get API key from credential manager (if required)
		let apiKey: string | undefined;
		if (ProviderFactory.requiresApiKey(provider)) {
			apiKey = await this.credentialManager.getCredential(provider) || undefined;
		}

		return {
			baseURL,
			model,
			apiKey,
			timeout: 60000,
			maxRetries: 3
		};
	}

	/**
	 * Generate quiz from active file (ribbon icon / command)
	 */
	private async generateQuizFromActiveFile() {
		const activeFile = this.app.workspace.getActiveFile();

		if (!activeFile) {
			new Notice('⚠️ No active file open');
			return;
		}

		// Ensure passphrase is unlocked
		const unlocked = await this.ensurePassphraseUnlocked();
		if (!unlocked) {
			new Notice('❌ Cannot generate quiz without unlocking encrypted credentials');
			return;
		}

		new Notice(`🎮 Generating quiz from "${activeFile.basename}"...`);
		// TODO: Implement quiz generation flow using orchestrator
		// const content = await this.app.vault.read(activeFile);
		// const result = await this.orchestrator.generateQuizWithFallback([content], {
		//     selectedNotes: [activeFile.path],
		//     questionCount: this.settings.defaultQuestions,
		//     difficulty: this.settings.defaultDifficulty as DifficultyLevel,
		//     includeMultipleChoice: this.settings.includeMultipleChoice,
		//     includeTrueFalse: this.settings.includeTrueFalse
		// });
	}

	/**
	 * Generate quiz command (select notes)
	 */
	private async generateQuizCommand() {
		// Ensure passphrase is unlocked
		const unlocked = await this.ensurePassphraseUnlocked();
		if (!unlocked) {
			new Notice('❌ Cannot generate quiz without unlocking encrypted credentials');
			return;
		}

		new Notice('🎮 Quiz generation from selected notes coming soon!');
		// TODO: Implement note selection UI + quiz generation flow
	}

	/**
	 * Run security audit command
	 */
	private async runSecurityAudit() {
		const audit = await this.credentialManager.auditSecurity();

		const message = [
			'🔐 Security Audit Results:',
			``,
			`✅ Encrypted API keys: ${audit.secure}`,
			`⚠️ Plaintext API keys: ${audit.insecure}`,
			``,
			audit.secure > 0 ? `Providers with encrypted keys: ${audit.providers.join(', ')}` : '',
			audit.insecure > 0 ? `⚠️ Please migrate to encrypted storage!` : ''
		].filter(Boolean).join('\n');

		new Notice(message, 10000);
		console.log('Security Audit:', audit);
	}

	/**
	 * Show provider status command
	 */
	private async showProviderStatus() {
		const status = this.orchestrator.getCircuitBreakerStatus();
		const providers = this.orchestrator.listProviders();

		const statusMessages = [];
		statusMessages.push('🔌 AI Provider Status:\n');

		if (providers.length === 0) {
			statusMessages.push('⚠️ No providers registered');
		} else {
			for (const provider of providers) {
				const breaker = status.get(provider);
				const stateIcon = {
					'closed': '✅',
					'open': '❌',
					'half-open': '⚠️'
				}[breaker?.state || 'closed'];

				const failures = breaker?.failures || 0;
				statusMessages.push(`${stateIcon} ${provider}: ${breaker?.state || 'unknown'} (${failures} failures)`);
			}
		}

		new Notice(statusMessages.join('\n'), 8000);
		console.log('Provider Status:', Object.fromEntries(status));
	}

	/**
	 * Get the path to the Pokemon icon asset
	 */
	getPokemonIconPath(): string | null {
		const adapter = this.app.vault.adapter;
		const pluginDir = (adapter as any).getBasePath?.() || '';
		const iconPath = `${pluginDir}/.obsidian/plugins/quizdex/assets/icons/pokemon-go.png`;
		return iconPath;
	}
}
