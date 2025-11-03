/**
 * Secure Credential Manager for QuizDex Plugin
 *
 * SECURITY FEATURES:
 * 1. AES-256-GCM encryption for API keys at rest
 * 2. Derived encryption key from user passphrase (PBKDF2)
 * 3. Separation of encrypted data and encryption metadata
 * 4. Memory-safe credential handling (cleared after use)
 * 5. Optional OS keychain integration (future)
 */

import { Notice } from 'obsidian';

interface EncryptedCredential {
	provider: string;
	encryptedKey: string;
	iv: string; // Initialization vector
	salt: string; // For key derivation
	iterations: number; // PBKDF2 iterations
	timestamp: number;
}

interface CredentialStore {
	version: number;
	credentials: EncryptedCredential[];
	// Master key hash for verification (NOT the key itself)
	keyHash?: string;
}

export class CredentialManager {
	private static readonly ITERATIONS = 100000; // PBKDF2 iterations
	private static readonly KEY_SIZE = 256; // AES-256
	private static readonly STORAGE_KEY = 'encrypted_credentials';

	private masterKey: CryptoKey | null = null;
	private keyCache: Map<string, { key: string; expires: number }> = new Map();
	private readonly CACHE_TTL = 15 * 60 * 1000; // 15 minutes

	constructor(private plugin: any) {}

	/**
	 * Initialize the credential manager with a master passphrase
	 * This passphrase is NEVER stored - only used to derive encryption keys
	 */
	async initialize(passphrase?: string): Promise<boolean> {
		if (!passphrase) {
			// Check if we're in "open" mode (no encryption - show warning)
			return await this.initializeOpenMode();
		}

		try {
			const stored = await this.getStoredCredentials();

			if (stored.keyHash) {
				// Verify passphrase matches stored hash
				const isValid = await this.verifyPassphrase(passphrase, stored.keyHash);
				if (!isValid) {
					new Notice('❌ Invalid passphrase');
					return false;
				}
			}

			// Derive master key from passphrase
			this.masterKey = await this.deriveMasterKey(passphrase);
			return true;

		} catch (error) {
			console.error('Failed to initialize credential manager:', error);
			new Notice('❌ Failed to initialize secure storage');
			return false;
		}
	}

	/**
	 * Initialize in open mode (legacy compatibility - NOT RECOMMENDED)
	 * Shows prominent warning to user
	 */
	private async initializeOpenMode(): Promise<boolean> {
		new Notice('⚠️ WARNING: API keys stored in PLAINTEXT. Enable encryption in settings!', 10000);
		console.warn('QuizDex: Running in INSECURE mode - API keys not encrypted');
		return true;
	}

	/**
	 * Store an API key securely with encryption
	 */
	async setCredential(provider: string, apiKey: string, passphrase?: string): Promise<boolean> {
		try {
			if (!passphrase && !this.masterKey) {
				// Fallback to insecure storage (legacy mode)
				return await this.setCredentialInsecure(provider, apiKey);
			}

			const key = passphrase ? await this.deriveMasterKey(passphrase) : this.masterKey;
			if (!key) {
				throw new Error('No encryption key available');
			}

			// Generate random salt and IV for this credential
			const salt = crypto.getRandomValues(new Uint8Array(16));
			const iv = crypto.getRandomValues(new Uint8Array(12));

			// Encrypt the API key
			const encoder = new TextEncoder();
			const data = encoder.encode(apiKey);

			const encryptedData = await crypto.subtle.encrypt(
				{ name: 'AES-GCM', iv },
				key,
				data.buffer
			);

			// Store encrypted credential
			const stored = await this.getStoredCredentials();

			const encryptedCredential: EncryptedCredential = {
				provider,
				encryptedKey: this.arrayBufferToBase64(encryptedData),
				iv: this.arrayBufferToBase64(iv.buffer),
				salt: this.arrayBufferToBase64(salt.buffer),
				iterations: CredentialManager.ITERATIONS,
				timestamp: Date.now()
			};

			// Replace or add credential
			const index = stored.credentials.findIndex(c => c.provider === provider);
			if (index >= 0) {
				stored.credentials[index] = encryptedCredential;
			} else {
				stored.credentials.push(encryptedCredential);
			}

			// Store key hash if not present (for passphrase verification)
			if (!stored.keyHash && passphrase) {
				stored.keyHash = await this.hashPassphrase(passphrase);
			}

			await this.saveStoredCredentials(stored);

			// Clear from memory cache
			this.keyCache.delete(provider);

			new Notice(`✅ API key for ${provider} encrypted and saved`);
			return true;

		} catch (error) {
			console.error('Failed to set credential:', error);
			new Notice(`❌ Failed to save API key for ${provider}`);
			return false;
		}
	}

	/**
	 * Retrieve and decrypt an API key
	 * Caches decrypted key in memory for TTL duration
	 */
	async getCredential(provider: string): Promise<string | null> {
		try {
			// Check memory cache first
			const cached = this.keyCache.get(provider);
			if (cached && cached.expires > Date.now()) {
				return cached.key;
			}

			// Try encrypted storage
			if (this.masterKey) {
				const stored = await this.getStoredCredentials();
				const credential = stored.credentials.find(c => c.provider === provider);

				if (credential) {
					const decrypted = await this.decryptCredential(credential);

					// Cache in memory
					this.keyCache.set(provider, {
						key: decrypted,
						expires: Date.now() + this.CACHE_TTL
					});

					return decrypted;
				}
			}

			// Fallback to insecure storage (legacy mode)
			return await this.getCredentialInsecure(provider);

		} catch (error) {
			console.error('Failed to get credential:', error);
			return null;
		}
	}

	/**
	 * Decrypt a credential using the master key
	 */
	private async decryptCredential(credential: EncryptedCredential): Promise<string> {
		if (!this.masterKey) {
			throw new Error('No master key available');
		}

		const encryptedData = this.base64ToArrayBuffer(credential.encryptedKey);
		const iv = this.base64ToArrayBuffer(credential.iv);

		const decryptedData = await crypto.subtle.decrypt(
			{ name: 'AES-GCM', iv },
			this.masterKey,
			encryptedData
		);

		const decoder = new TextDecoder();
		return decoder.decode(decryptedData);
	}

	/**
	 * Remove a credential
	 */
	async removeCredential(provider: string): Promise<boolean> {
		try {
			const stored = await this.getStoredCredentials();
			stored.credentials = stored.credentials.filter(c => c.provider !== provider);
			await this.saveStoredCredentials(stored);
			this.keyCache.delete(provider);
			new Notice(`✅ API key for ${provider} removed`);
			return true;
		} catch (error) {
			console.error('Failed to remove credential:', error);
			return false;
		}
	}

	/**
	 * Check if a credential exists (without decrypting)
	 */
	async hasCredential(provider: string): Promise<boolean> {
		const stored = await this.getStoredCredentials();
		const hasEncrypted = stored.credentials.some(c => c.provider === provider);

		if (hasEncrypted) return true;

		// Check legacy storage
		return await this.hasCredentialInsecure(provider);
	}

	/**
	 * List all providers that have credentials
	 */
	async listProviders(): Promise<string[]> {
		const stored = await this.getStoredCredentials();
		return stored.credentials.map(c => c.provider);
	}

	/**
	 * Clear all credentials and memory cache
	 */
	async clearAll(): Promise<void> {
		await this.saveStoredCredentials({ version: 1, credentials: [] });
		this.keyCache.clear();
		this.masterKey = null;
		new Notice('✅ All credentials cleared');
	}

	/**
	 * Migrate from plaintext to encrypted storage
	 */
	async migrateToEncrypted(passphrase: string, plaintextSettings: any): Promise<boolean> {
		try {
			await this.initialize(passphrase);

			const providers = [
				{ key: 'openAIApiKey', provider: 'openai' },
				{ key: 'googleApiKey', provider: 'google' },
				{ key: 'anthropicApiKey', provider: 'anthropic' },
				{ key: 'perplexityApiKey', provider: 'perplexity' },
				{ key: 'mistralApiKey', provider: 'mistral' },
				{ key: 'cohereApiKey', provider: 'cohere' }
			];

			let migratedCount = 0;
			for (const { key, provider } of providers) {
				const apiKey = plaintextSettings[key];
				if (apiKey && apiKey.trim()) {
					await this.setCredential(provider, apiKey, passphrase);
					migratedCount++;
				}
			}

			new Notice(`✅ Migrated ${migratedCount} API keys to encrypted storage`);
			return true;

		} catch (error) {
			console.error('Migration failed:', error);
			new Notice('❌ Failed to migrate API keys');
			return false;
		}
	}

	/**
	 * Derive encryption key from passphrase using PBKDF2
	 */
	private async deriveMasterKey(passphrase: string, salt?: Uint8Array): Promise<CryptoKey> {
		const encoder = new TextEncoder();
		const passphraseKey = await crypto.subtle.importKey(
			'raw',
			encoder.encode(passphrase),
			'PBKDF2',
			false,
			['deriveBits', 'deriveKey']
		);

		const actualSalt = salt ? salt : crypto.getRandomValues(new Uint8Array(16));

		return await crypto.subtle.deriveKey(
			{
				name: 'PBKDF2',
				salt: actualSalt as BufferSource,
				iterations: CredentialManager.ITERATIONS,
				hash: 'SHA-256'
			},
			passphraseKey,
			{ name: 'AES-GCM', length: CredentialManager.KEY_SIZE },
			false,
			['encrypt', 'decrypt']
		);
	}

	/**
	 * Hash passphrase for verification (NOT for encryption)
	 */
	private async hashPassphrase(passphrase: string): Promise<string> {
		const encoder = new TextEncoder();
		const data = encoder.encode(passphrase);
		const hash = await crypto.subtle.digest('SHA-256', data);
		return this.arrayBufferToBase64(hash);
	}

	/**
	 * Verify passphrase against stored hash
	 */
	private async verifyPassphrase(passphrase: string, storedHash: string): Promise<boolean> {
		const hash = await this.hashPassphrase(passphrase);
		return hash === storedHash;
	}

	// === LEGACY INSECURE STORAGE (for backward compatibility) ===

	private async setCredentialInsecure(provider: string, apiKey: string): Promise<boolean> {
		const settings = await this.plugin.loadData() || {};
		const keyMap: Record<string, string> = {
			'openai': 'openAIApiKey',
			'google': 'googleApiKey',
			'anthropic': 'anthropicApiKey',
			'perplexity': 'perplexityApiKey',
			'mistral': 'mistralApiKey',
			'cohere': 'cohereApiKey'
		};

		const settingKey = keyMap[provider];
		if (settingKey) {
			settings[settingKey] = apiKey;
			await this.plugin.saveData(settings);
			return true;
		}
		return false;
	}

	private async getCredentialInsecure(provider: string): Promise<string | null> {
		const settings = await this.plugin.loadData() || {};
		const keyMap: Record<string, string> = {
			'openai': 'openAIApiKey',
			'google': 'googleApiKey',
			'anthropic': 'anthropicApiKey',
			'perplexity': 'perplexityApiKey',
			'mistral': 'mistralApiKey',
			'cohere': 'cohereApiKey'
		};

		const settingKey = keyMap[provider];
		return settingKey ? (settings[settingKey] || null) : null;
	}

	private async hasCredentialInsecure(provider: string): Promise<boolean> {
		const key = await this.getCredentialInsecure(provider);
		return key !== null && key.trim().length > 0;
	}

	// === STORAGE HELPERS ===

	private async getStoredCredentials(): Promise<CredentialStore> {
		const data = await this.plugin.loadData() || {};
		return data[CredentialManager.STORAGE_KEY] || { version: 1, credentials: [] };
	}

	private async saveStoredCredentials(store: CredentialStore): Promise<void> {
		const data = await this.plugin.loadData() || {};
		data[CredentialManager.STORAGE_KEY] = store;
		await this.plugin.saveData(data);
	}

	// === ENCODING HELPERS ===

	private arrayBufferToBase64(buffer: ArrayBuffer): string {
		const bytes = new Uint8Array(buffer);
		let binary = '';
		for (let i = 0; i < bytes.byteLength; i++) {
			binary += String.fromCharCode(bytes[i]);
		}
		return btoa(binary);
	}

	private base64ToArrayBuffer(base64: string): ArrayBuffer {
		const binary = atob(base64);
		const bytes = new Uint8Array(binary.length);
		for (let i = 0; i < binary.length; i++) {
			bytes[i] = binary.charCodeAt(i);
		}
		return bytes.buffer;
	}

	/**
	 * Security audit - check for insecure keys
	 */
	async auditSecurity(): Promise<{ secure: number; insecure: number; providers: string[] }> {
		const stored = await this.getStoredCredentials();
		const secure = stored.credentials.length;

		const settings = await this.plugin.loadData() || {};
		const insecureKeys = [
			'openAIApiKey', 'googleApiKey', 'anthropicApiKey',
			'perplexityApiKey', 'mistralApiKey', 'cohereApiKey'
		];

		const insecure = insecureKeys.filter(key => settings[key] && settings[key].trim()).length;

		return {
			secure,
			insecure,
			providers: stored.credentials.map(c => c.provider)
		};
	}

	/**
	 * Clean up on plugin unload
	 */
	destroy(): void {
		// Clear sensitive data from memory
		this.keyCache.clear();
		this.masterKey = null;
	}
}
