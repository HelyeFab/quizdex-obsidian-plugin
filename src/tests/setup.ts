/**
 * Test setup file - runs before all tests
 */

import { vi } from 'vitest';

// Mock Web Crypto API for Node.js environment
if (typeof crypto === 'undefined') {
	import('crypto').then(({ webcrypto }) => {
		(global as any).crypto = webcrypto;
	});
}

// Mock Obsidian Notice globally
vi.mock('obsidian', () => ({
	Notice: vi.fn((message: string) => {
		console.log('Notice:', message);
	}),
	Plugin: class MockPlugin {},
	PluginSettingTab: class MockPluginSettingTab {},
	ItemView: class MockItemView {},
	Modal: class MockModal {},
	Setting: class MockSetting {},
	requestUrl: vi.fn()
}));
