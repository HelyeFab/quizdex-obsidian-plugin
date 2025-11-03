/**
 * Unit tests for CredentialManager
 *
 * Run with: npm test
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CredentialManager } from '../security/CredentialManager';

// Mock Obsidian Notice
vi.mock('obsidian', () => ({
	Notice: vi.fn()
}));

// Mock plugin with loadData/saveData
const createMockPlugin = () => {
	const storage: Record<string, any> = {};
	return {
		loadData: vi.fn(async () => storage),
		saveData: vi.fn(async (data: any) => {
			Object.assign(storage, data);
		})
	};
};

describe('CredentialManager', () => {
	let credManager: CredentialManager;
	let mockPlugin: any;

	beforeEach(() => {
		mockPlugin = createMockPlugin();
		credManager = new CredentialManager(mockPlugin);
	});

	describe('Initialization', () => {
		it('should initialize with a passphrase', async () => {
			const result = await credManager.initialize('test-passphrase-123');
			expect(result).toBe(true);
		});

		it('should initialize in open mode without passphrase', async () => {
			const result = await credManager.initialize();
			expect(result).toBe(true);
		});

		it('should reject wrong passphrase for existing credentials', async () => {
			// Set up with first passphrase
			await credManager.initialize('correct-passphrase');
			await credManager.setCredential('openai', 'sk-test-key', 'correct-passphrase');

			// Try to initialize with wrong passphrase
			const newManager = new CredentialManager(mockPlugin);
			const result = await newManager.initialize('wrong-passphrase');
			expect(result).toBe(false);
		});
	});

	describe('Credential Storage', () => {
		beforeEach(async () => {
			await credManager.initialize('test-passphrase-123');
		});

		it('should store and retrieve credentials', async () => {
			const testKey = 'sk-test-api-key-12345';
			await credManager.setCredential('openai', testKey, 'test-passphrase-123');

			const retrieved = await credManager.getCredential('openai');
			expect(retrieved).toBe(testKey);
		});

		it('should encrypt stored credentials', async () => {
			const testKey = 'sk-secret-key-67890';
			await credManager.setCredential('google', testKey, 'test-passphrase-123');

			// Check that raw storage doesn't contain the key in plaintext
			const stored = await mockPlugin.loadData();
			const rawJson = JSON.stringify(stored);
			expect(rawJson).not.toContain(testKey);
		});

		it('should handle multiple providers', async () => {
			await credManager.setCredential('openai', 'sk-openai-key', 'test-passphrase-123');
			await credManager.setCredential('anthropic', 'sk-anthropic-key', 'test-passphrase-123');
			await credManager.setCredential('google', 'google-api-key', 'test-passphrase-123');

			expect(await credManager.getCredential('openai')).toBe('sk-openai-key');
			expect(await credManager.getCredential('anthropic')).toBe('sk-anthropic-key');
			expect(await credManager.getCredential('google')).toBe('google-api-key');
		});

		it('should update existing credentials', async () => {
			await credManager.setCredential('openai', 'old-key', 'test-passphrase-123');
			await credManager.setCredential('openai', 'new-key', 'test-passphrase-123');

			const retrieved = await credManager.getCredential('openai');
			expect(retrieved).toBe('new-key');
		});

		it('should return null for non-existent credentials', async () => {
			const retrieved = await credManager.getCredential('non-existent');
			expect(retrieved).toBeNull();
		});
	});

	describe('Credential Removal', () => {
		beforeEach(async () => {
			await credManager.initialize('test-passphrase-123');
			await credManager.setCredential('openai', 'sk-test-key', 'test-passphrase-123');
		});

		it('should remove credentials', async () => {
			const removed = await credManager.removeCredential('openai');
			expect(removed).toBe(true);

			const retrieved = await credManager.getCredential('openai');
			expect(retrieved).toBeNull();
		});
	});

	describe('Security Features', () => {
		beforeEach(async () => {
			await credManager.initialize('test-passphrase-123');
		});

		it('should use different IVs for different credentials', async () => {
			await credManager.setCredential('openai', 'key1', 'test-passphrase-123');
			await credManager.setCredential('google', 'key2', 'test-passphrase-123');

			const stored = await mockPlugin.loadData();
			const credentials = stored.encrypted_credentials?.credentials || [];

			const openaiCred = credentials.find((c: any) => c.provider === 'openai');
			const googleCred = credentials.find((c: any) => c.provider === 'google');

			expect(openaiCred.iv).not.toBe(googleCred.iv);
			expect(openaiCred.encryptedKey).not.toBe(googleCred.encryptedKey);
		});

		it('should clear all credentials', async () => {
			await credManager.setCredential('openai', 'key1', 'test-passphrase-123');
			await credManager.setCredential('google', 'key2', 'test-passphrase-123');

			await credManager.clearAll();

			expect(await credManager.getCredential('openai')).toBeNull();
			expect(await credManager.getCredential('google')).toBeNull();
		});
	});

	describe('Provider Management', () => {
		beforeEach(async () => {
			await credManager.initialize('test-passphrase-123');
		});

		it('should list all providers with credentials', async () => {
			await credManager.setCredential('openai', 'key1', 'test-passphrase-123');
			await credManager.setCredential('google', 'key2', 'test-passphrase-123');

			const providers = await credManager.listProviders();
			expect(providers).toContain('openai');
			expect(providers).toContain('google');
			expect(providers).toHaveLength(2);
		});

		it('should check if credential exists', async () => {
			await credManager.setCredential('openai', 'key1', 'test-passphrase-123');

			expect(await credManager.hasCredential('openai')).toBe(true);
			expect(await credManager.hasCredential('google')).toBe(false);
		});
	});

	describe('Security Audit', () => {
		it('should audit secure vs insecure credentials', async () => {
			// Add encrypted credentials
			await credManager.initialize('test-passphrase-123');
			await credManager.setCredential('openai', 'key1', 'test-passphrase-123');

			// Add insecure credential (simulate legacy storage)
			const data = await mockPlugin.loadData();
			data.googleApiKey = 'insecure-key';
			await mockPlugin.saveData(data);

			const audit = await credManager.auditSecurity();
			expect(audit.secure).toBe(1); // openai encrypted
			expect(audit.insecure).toBeGreaterThanOrEqual(1); // google plaintext
		});
	});

	describe('Migration', () => {
		it('should migrate plaintext keys to encrypted storage', async () => {
			// Set up plaintext keys (legacy format)
			const plaintextSettings = {
				openAIApiKey: 'sk-openai-plaintext',
				googleApiKey: 'google-plaintext',
				anthropicApiKey: 'anthropic-plaintext'
			};

			await mockPlugin.saveData(plaintextSettings);

			// Migrate
			const success = await credManager.migrateToEncrypted('migration-passphrase', plaintextSettings);
			expect(success).toBe(true);

			// Verify encrypted keys are accessible
			await credManager.initialize('migration-passphrase');
			expect(await credManager.getCredential('openai')).toBe('sk-openai-plaintext');
			expect(await credManager.getCredential('google')).toBe('google-plaintext');
		});
	});

	describe('Memory Management', () => {
		it('should clear sensitive data on destroy', async () => {
			await credManager.initialize('test-passphrase-123');
			await credManager.setCredential('openai', 'key1', 'test-passphrase-123');

			credManager.destroy();

			// After destroy, should not be able to get credentials without re-init
			const retrieved = await credManager.getCredential('openai');
			// Should fall back to insecure storage (returns null if not in legacy format)
			expect(retrieved).toBeNull();
		});
	});
});
