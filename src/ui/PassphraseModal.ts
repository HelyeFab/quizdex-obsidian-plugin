/**
 * Passphrase Modal - Secure passphrase input for credential encryption
 */

import { Modal, App, Setting, Notice } from 'obsidian';

export class PassphraseModal extends Modal {
	private passphrase: string = '';
	private confirmPassphrase: string = '';
	private onSubmit: (passphrase: string | null) => void;
	private isNewPassphrase: boolean;

	constructor(app: App, onSubmit: (passphrase: string | null) => void, isNewPassphrase: boolean = false) {
		super(app);
		this.onSubmit = onSubmit;
		this.isNewPassphrase = isNewPassphrase;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: '🔐 Encryption Passphrase' });

		if (this.isNewPassphrase) {
			contentEl.createDiv({
				text: 'Create a passphrase to encrypt your API keys. Keep it safe - you\'ll need it to access your keys!',
				cls: 'setting-item-description'
			}).style.marginBottom = '20px';
		} else {
			contentEl.createDiv({
				text: 'Enter your passphrase to unlock encrypted API keys.',
				cls: 'setting-item-description'
			}).style.marginBottom = '20px';
		}

		// Passphrase input
		new Setting(contentEl)
			.setName('Passphrase')
			.setDesc(this.isNewPassphrase ? 'Minimum 8 characters (12+ recommended)' : 'Enter your passphrase')
			.addText(text => {
				text
					.setPlaceholder('Enter passphrase')
					.onChange(value => this.passphrase = value);
				text.inputEl.type = 'password';
				text.inputEl.addEventListener('keypress', (e) => {
					if (e.key === 'Enter' && !this.isNewPassphrase) {
						this.submit();
					}
				});
			});

		// Confirmation input (only for new passphrases)
		if (this.isNewPassphrase) {
			new Setting(contentEl)
				.setName('Confirm Passphrase')
				.setDesc('Re-enter to confirm')
				.addText(text => {
					text
						.setPlaceholder('Confirm passphrase')
						.onChange(value => this.confirmPassphrase = value);
					text.inputEl.type = 'password';
					text.inputEl.addEventListener('keypress', (e) => {
						if (e.key === 'Enter') {
							this.submit();
						}
					});
				});
		}

		// Security tips
		if (this.isNewPassphrase) {
			const tipsDiv = contentEl.createDiv('passphrase-tips');
			tipsDiv.style.padding = '15px';
			tipsDiv.style.marginTop = '20px';
			tipsDiv.style.backgroundColor = 'var(--background-secondary)';
			tipsDiv.style.borderRadius = '8px';

			tipsDiv.createEl('strong', { text: '💡 Security Tips:' });
			const tipsList = tipsDiv.createEl('ul');
			tipsList.style.marginTop = '10px';
			tipsList.style.marginLeft = '20px';

			const tips = [
				'Use a unique passphrase (don\'t reuse your vault password)',
				'Store it in a password manager',
				'If forgotten, you\'ll need to re-enter all API keys'
			];

			tips.forEach(tip => {
				tipsList.createEl('li', { text: tip });
			});
		}

		// Buttons
		const buttonContainer = contentEl.createDiv('button-container');
		buttonContainer.style.display = 'flex';
		buttonContainer.style.justifyContent = 'flex-end';
		buttonContainer.style.gap = '10px';
		buttonContainer.style.marginTop = '20px';

		new Setting(buttonContainer)
			.addButton(btn => btn
				.setButtonText('Cancel')
				.onClick(() => {
					this.onSubmit(null);
					this.close();
				})
			)
			.addButton(btn => btn
				.setButtonText(this.isNewPassphrase ? 'Create' : 'Unlock')
				.setCta()
				.onClick(() => this.submit())
			);
	}

	private submit() {
		// Validation
		if (this.passphrase.length < 8) {
			new Notice('⚠️ Passphrase must be at least 8 characters');
			return;
		}

		if (this.isNewPassphrase) {
			if (this.passphrase !== this.confirmPassphrase) {
				new Notice('⚠️ Passphrases do not match');
				return;
			}

			if (this.passphrase.length < 12) {
				new Notice('⚠️ Warning: Passphrase should be at least 12 characters for better security');
			}
		}

		this.onSubmit(this.passphrase);
		this.close();
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
		// Clear sensitive data
		this.passphrase = '';
		this.confirmPassphrase = '';
	}
}

/**
 * Migration Modal - Guide users through encrypting existing API keys
 */
export class MigrationModal extends Modal {
	private onMigrate: (passphrase: string | null) => Promise<void>;
	private insecureCount: number;

	constructor(app: App, insecureCount: number, onMigrate: (passphrase: string | null) => Promise<void>) {
		super(app);
		this.insecureCount = insecureCount;
		this.onMigrate = onMigrate;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: '⚠️ Security Warning' });

		const warningDiv = contentEl.createDiv('security-warning');
		warningDiv.style.padding = '15px';
		warningDiv.style.marginBottom = '20px';
		warningDiv.style.backgroundColor = 'var(--background-modifier-error)';
		warningDiv.style.borderRadius = '8px';
		warningDiv.style.border = '2px solid var(--text-error)';

		warningDiv.createEl('p', {
			text: `⚠️ Found ${this.insecureCount} API key(s) stored in PLAINTEXT!`
		}).style.fontWeight = 'bold';

		warningDiv.createEl('p', {
			text: 'Anyone with access to your file system can read these keys. This is a serious security risk.'
		});

		const infoDiv = contentEl.createDiv('migration-info');
		infoDiv.style.padding = '15px';
		infoDiv.style.marginBottom = '20px';
		infoDiv.style.backgroundColor = 'var(--background-secondary)';
		infoDiv.style.borderRadius = '8px';

		infoDiv.createEl('h3', { text: '🔐 Migrate to Encrypted Storage' });
		infoDiv.createEl('p', {
			text: 'QuizDex v2.0 can encrypt your API keys with AES-256-GCM encryption.'
		});

		const stepsList = infoDiv.createEl('ol');
		stepsList.style.marginLeft = '20px';
		stepsList.style.marginTop = '10px';

		[
			'Create a secure passphrase',
			'All API keys will be encrypted automatically',
			'Plaintext keys will be removed from settings',
			'You\'ll need the passphrase to use the plugin'
		].forEach(step => {
			stepsList.createEl('li', { text: step });
		});

		// Buttons
		const buttonContainer = contentEl.createDiv('button-container');
		buttonContainer.style.display = 'flex';
		buttonContainer.style.justifyContent = 'space-between';
		buttonContainer.style.marginTop = '20px';

		new Setting(buttonContainer)
			.addButton(btn => btn
				.setButtonText('Remind Me Later')
				.onClick(() => {
					new Notice('⚠️ Your API keys remain UNENCRYPTED. Please migrate soon!');
					this.close();
				})
			)
			.addButton(btn => btn
				.setButtonText('Migrate Now')
				.setCta()
				.onClick(async () => {
					this.close();

					// Open passphrase modal
					new PassphraseModal(this.app, async (passphrase) => {
						if (passphrase) {
							await this.onMigrate(passphrase);
						}
					}, true).open();
				})
			);
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
