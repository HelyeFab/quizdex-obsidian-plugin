/**
 * Unit tests for StorageService
 *
 * Tests vault-based storage, quiz persistence, and Pokédex management
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StorageService, PokedexData } from '../services/StorageService';
import { Quiz } from '../types/quiz.types';

// Mock Obsidian vault API
const createMockApp = () => {
	const files = new Map<string, string>();
	const folders = new Set<string>();

	return {
		vault: {
			adapter: {
				exists: vi.fn(async (path: string) => {
					return files.has(path) || folders.has(path);
				}),
				read: vi.fn(async (path: string) => {
					const content = files.get(path);
					if (!content) throw new Error(`File not found: ${path}`);
					return content;
				}),
				write: vi.fn(async (path: string, content: string) => {
					files.set(path, content);
				})
			},
			createFolder: vi.fn(async (path: string) => {
				folders.add(path);
			}),
			create: vi.fn(async (path: string, content: string) => {
				files.set(path, content);
				return { path, stat: { ctime: Date.now(), mtime: Date.now() } };
			}),
			getAbstractFileByPath: vi.fn((path: string) => {
				if (folders.has(path)) {
					return {
						children: Array.from(files.keys())
							.filter(p => p.startsWith(path + '/'))
							.map(p => ({
								path: p,
								extension: p.split('.').pop(),
								stat: { ctime: Date.now(), mtime: Date.now() }
							}))
					};
				}
				if (files.has(path)) {
					return {
						path,
						extension: path.split('.').pop(),
						stat: { ctime: Date.now(), mtime: Date.now() }
					};
				}
				return null;
			})
		}
	};
};

describe('StorageService', () => {
	let storageService: StorageService;
	let mockApp: any;
	let mockQuiz: Quiz;

	beforeEach(async () => {
		mockApp = createMockApp();
		storageService = new StorageService(mockApp);

		mockQuiz = {
			id: 'test-quiz-123',
			title: 'Test Quiz',
			description: 'A test quiz about testing',
			questions: [
				{
					id: 'q1',
					type: 'multiple-choice',
					question: 'What is testing?',
					options: ['A) Quality assurance', 'B) Random guessing', 'C) Bug creation', 'D) Coffee break'],
					correctAnswer: 'A',
					explanation: 'Testing ensures quality'
				},
				{
					id: 'q2',
					type: 'true-false',
					question: 'Tests are important',
					correctAnswer: 'true',
					explanation: 'Tests prevent bugs'
				}
			],
			createdAt: new Date('2025-01-01T00:00:00Z'),
			sourceNotes: ['test-note.md']
		};

		vi.clearAllMocks();
	});

	describe('Initialization', () => {
		it('should create QuizDex folder structure', async () => {
			await storageService.initialize();

			expect(mockApp.vault.createFolder).toHaveBeenCalledWith('QuizDex');
			expect(mockApp.vault.createFolder).toHaveBeenCalledWith('QuizDex/Quizzes');
		});

		it('should create pokedex.json on first run', async () => {
			await storageService.initialize();

			expect(mockApp.vault.adapter.write).toHaveBeenCalledWith(
				'QuizDex/pokedex.json',
				expect.stringContaining('caughtPokemon')
			);
		});

		it('should create history.json on first run', async () => {
			await storageService.initialize();

			expect(mockApp.vault.adapter.write).toHaveBeenCalledWith(
				'QuizDex/history.json',
				expect.stringContaining('[')
			);
		});

		it('should not recreate existing folders', async () => {
			// Simulate existing folders
			mockApp.vault.adapter.exists.mockResolvedValue(true);

			await storageService.initialize();

			expect(mockApp.vault.createFolder).not.toHaveBeenCalled();
		});
	});

	describe('Quiz Persistence', () => {
		beforeEach(async () => {
			await storageService.initialize();
			vi.clearAllMocks();
		});

		it('should save quiz to vault', async () => {
			const path = await storageService.saveQuiz(
				mockQuiz,
				['test-note.md'],
				'medium',
				'ollama'
			);

			expect(path).toMatch(/QuizDex\/Quizzes\/Quiz_.*\.md/);
			expect(mockApp.vault.create).toHaveBeenCalled();
		});

		it('should include quiz metadata in saved file', async () => {
			await storageService.saveQuiz(
				mockQuiz,
				['test-note.md'],
				'hard',
				'openai'
			);

			const savedContent = mockApp.vault.create.mock.calls[0][1];
			expect(savedContent).toContain('difficulty: hard');
			expect(savedContent).toContain('provider: openai');
			expect(savedContent).toContain('source-notes:');
			expect(savedContent).toContain('- test-note.md');
		});

		it('should include JSON data in code block', async () => {
			await storageService.saveQuiz(
				mockQuiz,
				['test-note.md'],
				'easy',
				'ollama'
			);

			const savedContent = mockApp.vault.create.mock.calls[0][1];
			expect(savedContent).toContain('```json');
			expect(savedContent).toContain('"title": "Test Quiz"');
			expect(savedContent).toContain('"questions"');
		});

		it('should include human-readable questions', async () => {
			await storageService.saveQuiz(
				mockQuiz,
				['test-note.md'],
				'medium',
				'ollama'
			);

			const savedContent = mockApp.vault.create.mock.calls[0][1];
			expect(savedContent).toContain('### Question 1');
			expect(savedContent).toContain('What is testing?');
			expect(savedContent).toContain('**Options:**');
			expect(savedContent).toContain('**Explanation:**');
		});

		it('should handle file name collisions', async () => {
			// Mock existing file
			mockApp.vault.adapter.exists
				.mockResolvedValueOnce(false) // folder exists
				.mockResolvedValueOnce(false) // folder exists
				.mockResolvedValueOnce(true)  // first filename exists
				.mockResolvedValueOnce(false); // second filename doesn't

			const path = await storageService.saveQuiz(
				mockQuiz,
				['note.md'],
				'medium',
				'ollama'
			);

			expect(path).toMatch(/_1\.md$/);
		});

		it('should load saved quiz', async () => {
			// Save quiz first
			await storageService.saveQuiz(mockQuiz, ['test.md'], 'medium', 'ollama');
			const savedContent = mockApp.vault.create.mock.calls[0][1];
			const savedPath = mockApp.vault.create.mock.calls[0][0];

			// Mock file retrieval
			mockApp.vault.adapter.read.mockResolvedValueOnce(savedContent);
			mockApp.vault.getAbstractFileByPath.mockReturnValueOnce({
				path: savedPath,
				extension: 'md'
			});

			const loaded = await storageService.loadQuiz(savedPath);

			expect(loaded).toBeDefined();
			expect(loaded?.quiz.id).toBe(mockQuiz.id);
			expect(loaded?.quiz.title).toBe(mockQuiz.title);
			expect(loaded?.metadata.difficulty).toBe('medium');
			expect(loaded?.metadata.provider).toBe('ollama');
		});

		it('should return null for non-existent quiz', async () => {
			mockApp.vault.getAbstractFileByPath.mockReturnValueOnce(null);

			const loaded = await storageService.loadQuiz('non-existent.md');
			expect(loaded).toBeNull();
		});

		it('should handle malformed quiz files', async () => {
			const badContent = '# Bad Quiz\nNo JSON here';

			mockApp.vault.adapter.read.mockResolvedValueOnce(badContent);
			mockApp.vault.getAbstractFileByPath.mockReturnValueOnce({
				path: 'bad.md',
				extension: 'md'
			});

			const loaded = await storageService.loadQuiz('bad.md');
			expect(loaded).toBeNull();
		});
	});

	describe('Pokédex Management', () => {
		beforeEach(async () => {
			await storageService.initialize();
			vi.clearAllMocks();
		});

		it('should save Pokédex data', async () => {
			const pokedexData: PokedexData = {
				caughtPokemon: [
					{ id: 25, name: 'Pikachu', caughtAt: '2025-01-01', score: 100 },
					{ id: 1, name: 'Bulbasaur', caughtAt: '2025-01-02', score: 100 }
				],
				totalCaught: 2,
				lastUpdated: '2025-01-02'
			};

			await storageService.savePokedexData(pokedexData);

			expect(mockApp.vault.adapter.write).toHaveBeenCalledWith(
				'QuizDex/pokedex.json',
				expect.stringContaining('Pikachu')
			);
		});

		it('should load Pokédex data', async () => {
			const mockData: PokedexData = {
				caughtPokemon: [
					{ id: 25, name: 'Pikachu', caughtAt: '2025-01-01', score: 100 }
				],
				totalCaught: 1,
				lastUpdated: '2025-01-01'
			};

			mockApp.vault.adapter.read.mockResolvedValueOnce(JSON.stringify(mockData));
			mockApp.vault.adapter.exists.mockResolvedValueOnce(true);

			const loaded = await storageService.loadPokedexData();

			expect(loaded.caughtPokemon).toHaveLength(1);
			expect(loaded.caughtPokemon[0].name).toBe('Pikachu');
			expect(loaded.totalCaught).toBe(1);
		});

		it('should return empty Pokédex if file does not exist', async () => {
			mockApp.vault.adapter.exists.mockResolvedValueOnce(false);

			const loaded = await storageService.loadPokedexData();

			expect(loaded.caughtPokemon).toEqual([]);
			expect(loaded.totalCaught).toBe(0);
		});

		it('should handle corrupted Pokédex file', async () => {
			mockApp.vault.adapter.exists.mockResolvedValueOnce(true);
			mockApp.vault.adapter.read.mockResolvedValueOnce('invalid json {{{');

			const loaded = await storageService.loadPokedexData();

			expect(loaded.caughtPokemon).toEqual([]);
		});
	});

	describe('LocalStorage Migration', () => {
		beforeEach(async () => {
			await storageService.initialize();
			vi.clearAllMocks();

			// Mock localStorage
			global.localStorage = {
				getItem: vi.fn(),
				setItem: vi.fn(),
				removeItem: vi.fn(),
				clear: vi.fn(),
				length: 0,
				key: vi.fn()
			} as any;
		});

		it('should migrate Pokédex from localStorage to vault', async () => {
			const localData = [
				{ id: 25, name: 'Pikachu', caughtAt: '2025-01-01', score: 100 }
			];

			(localStorage.getItem as any).mockReturnValueOnce(JSON.stringify(localData));

			mockApp.vault.adapter.read.mockResolvedValueOnce(JSON.stringify({
				caughtPokemon: [],
				totalCaught: 0,
				lastUpdated: '2025-01-01'
			}));

			const migrated = await storageService.migratePokedexFromLocalStorage();

			expect(migrated).toBe(true);
			expect(mockApp.vault.adapter.write).toHaveBeenCalled();
			expect(localStorage.removeItem).toHaveBeenCalledWith('quizdex-caught-pokemon');
		});

		it('should not duplicate Pokémon during migration', async () => {
			const localData = [
				{ id: 25, name: 'Pikachu', caughtAt: '2025-01-01', score: 100 }
			];

			const vaultData = {
				caughtPokemon: [
					{ id: 25, name: 'Pikachu', caughtAt: '2025-01-01', score: 100 }
				],
				totalCaught: 1,
				lastUpdated: '2025-01-01'
			};

			(localStorage.getItem as any).mockReturnValueOnce(JSON.stringify(localData));
			mockApp.vault.adapter.read.mockResolvedValueOnce(JSON.stringify(vaultData));

			await storageService.migratePokedexFromLocalStorage();

			const writeCall = mockApp.vault.adapter.write.mock.calls[0];
			const savedData = JSON.parse(writeCall[1]);
			expect(savedData.caughtPokemon).toHaveLength(1);
		});

		it('should return false when no localStorage data exists', async () => {
			(localStorage.getItem as any).mockReturnValueOnce(null);

			const migrated = await storageService.migratePokedexFromLocalStorage();
			expect(migrated).toBe(false);
		});

		it('should handle migration errors gracefully', async () => {
			(localStorage.getItem as any).mockImplementationOnce(() => {
				throw new Error('localStorage error');
			});

			const migrated = await storageService.migratePokedexFromLocalStorage();
			expect(migrated).toBe(false);
		});
	});

	describe('Quiz History', () => {
		beforeEach(async () => {
			await storageService.initialize();
			vi.clearAllMocks();
		});

		it('should save quiz history', async () => {
			const history = [
				{
					quizId: 'quiz-1',
					attempts: [],
					lastAttempt: '2025-01-01',
					bestScore: 90
				}
			];

			await storageService.saveQuizHistory(history);

			expect(mockApp.vault.adapter.write).toHaveBeenCalledWith(
				'QuizDex/history.json',
				expect.stringContaining('quiz-1')
			);
		});

		it('should load quiz history', async () => {
			const mockHistory = [
				{
					quizId: 'quiz-1',
					attempts: [],
					lastAttempt: '2025-01-01',
					bestScore: 85
				}
			];

			mockApp.vault.adapter.exists.mockResolvedValueOnce(true);
			mockApp.vault.adapter.read.mockResolvedValueOnce(JSON.stringify(mockHistory));

			const loaded = await storageService.loadQuizHistory();

			expect(loaded).toHaveLength(1);
			expect(loaded[0].quizId).toBe('quiz-1');
			expect(loaded[0].bestScore).toBe(85);
		});

		it('should record quiz attempt', async () => {
			const result = {
				quizId: 'quiz-1',
				score: 80,
				totalQuestions: 10,
				correctCount: 8,
				completedAt: '2025-01-01',
				timeTaken: 120,
				answers: new Map()
			};

			mockApp.vault.adapter.exists.mockResolvedValueOnce(true);
			mockApp.vault.adapter.read.mockResolvedValueOnce('[]');

			await storageService.recordQuizAttempt('quiz-1', result);

			const writeCall = mockApp.vault.adapter.write.mock.calls[0];
			const savedHistory = JSON.parse(writeCall[1]);

			expect(savedHistory).toHaveLength(1);
			expect(savedHistory[0].quizId).toBe('quiz-1');
			expect(savedHistory[0].attempts).toHaveLength(1);
			expect(savedHistory[0].bestScore).toBe(80);
		});

		it('should update best score on new attempt', async () => {
			const existingHistory = [
				{
					quizId: 'quiz-1',
					attempts: [],
					lastAttempt: '2025-01-01',
					bestScore: 70
				}
			];

			const newResult = {
				quizId: 'quiz-1',
				score: 90,
				totalQuestions: 10,
				correctCount: 9,
				completedAt: '2025-01-02',
				timeTaken: 100,
				answers: new Map()
			};

			mockApp.vault.adapter.exists.mockResolvedValueOnce(true);
			mockApp.vault.adapter.read.mockResolvedValueOnce(JSON.stringify(existingHistory));

			await storageService.recordQuizAttempt('quiz-1', newResult);

			const writeCall = mockApp.vault.adapter.write.mock.calls[0];
			const savedHistory = JSON.parse(writeCall[1]);

			expect(savedHistory[0].bestScore).toBe(90);
		});
	});
});
