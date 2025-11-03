/**
 * Storage Service - Manages local vault storage for QuizDex
 * Handles quiz persistence and Pokédex data storage
 */

import { App, TFolder, TFile, normalizePath } from 'obsidian';
import { Quiz, QuizResult } from '../types/quiz.types';

export interface SavedQuiz {
	quiz: Quiz;
	metadata: {
		createdAt: string;
		sourceNotes: string[];
		difficulty: string;
		provider: string;
	};
}

export interface QuizHistory {
	quizId: string;
	attempts: QuizResult[];
	lastAttempt: string;
	bestScore: number;
}

export interface PokedexCaughtPokemon {
	id: number;
	name: string;
	caughtAt: string;
	score: number;
	catchCount?: number;
}

export interface PokedexData {
	caughtPokemon: PokedexCaughtPokemon[];
	totalCaught: number;
	lastUpdated: string;
}

export class StorageService {
	private app: App;
	private readonly BASE_FOLDER = 'QuizDex';
	private readonly QUIZZES_FOLDER = 'QuizDex/Quizzes';
	private readonly POKEDEX_FILE = 'QuizDex/pokedex.json';
	private readonly HISTORY_FILE = 'QuizDex/history.json';

	constructor(app: App) {
		this.app = app;
	}

	/**
	 * Initialize QuizDex folder structure
	 */
	async initialize(): Promise<void> {
		await this.ensureFolderExists(this.BASE_FOLDER);
		await this.ensureFolderExists(this.QUIZZES_FOLDER);

		// Initialize pokedex.json if it doesn't exist
		if (!(await this.app.vault.adapter.exists(this.POKEDEX_FILE))) {
			const initialData: PokedexData = {
				caughtPokemon: [],
				totalCaught: 0,
				lastUpdated: new Date().toISOString()
			};
			await this.app.vault.adapter.write(
				this.POKEDEX_FILE,
				JSON.stringify(initialData, null, 2)
			);
		}

		// Initialize history.json if it doesn't exist
		if (!(await this.app.vault.adapter.exists(this.HISTORY_FILE))) {
			await this.app.vault.adapter.write(
				this.HISTORY_FILE,
				JSON.stringify([], null, 2)
			);
		}
	}

	/**
	 * Ensure a folder exists, create if it doesn't
	 */
	private async ensureFolderExists(path: string): Promise<void> {
		const normalizedPath = normalizePath(path);
		const exists = await this.app.vault.adapter.exists(normalizedPath);

		if (exists) {
			return;
		}

		try {
			await this.app.vault.createFolder(normalizedPath);
			console.log(`✅ Created folder: ${normalizedPath}`);
		} catch (error: any) {
			if (error?.message?.includes('Folder already exists')) {
				// Another process created it first; safe to ignore.
				return;
			}
			throw error;
		}
	}

	/**
	 * Save a quiz to the vault
	 */
	async saveQuiz(
		quiz: Quiz,
		sourceNotes: string[],
		difficulty: string,
		provider: string
	): Promise<string> {
		const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
		let fileName = `Quiz_${timestamp}.md`;
		let filePath = normalizePath(`${this.QUIZZES_FOLDER}/${fileName}`);

		let collisionCounter = 1;
		while (await this.app.vault.adapter.exists(filePath)) {
			fileName = `Quiz_${timestamp}_${collisionCounter}.md`;
			filePath = normalizePath(`${this.QUIZZES_FOLDER}/${fileName}`);
			collisionCounter++;
		}

		const savedQuiz: SavedQuiz = {
			quiz,
			metadata: {
				createdAt: new Date().toISOString(),
				sourceNotes,
				difficulty,
				provider
			}
		};

		// Create markdown format for the quiz
		const markdown = this.quizToMarkdown(savedQuiz);

		await this.app.vault.create(filePath, markdown);
		console.log(`✅ Saved quiz to: ${filePath}`);

		return filePath;
	}

	/**
	 * Convert quiz to markdown format
	 */
	private quizToMarkdown(savedQuiz: SavedQuiz): string {
		const { quiz, metadata } = savedQuiz;
		const lines: string[] = [];

		// Frontmatter
		lines.push('---');
		lines.push(`quiz-id: ${quiz.id}`);
		lines.push(`title: ${quiz.title}`);
		lines.push(`created: ${metadata.createdAt}`);
		lines.push(`difficulty: ${metadata.difficulty}`);
		lines.push(`provider: ${metadata.provider}`);
		lines.push(`source-notes:`);
		metadata.sourceNotes.forEach(note => lines.push(`  - ${note}`));
		lines.push('---');
		lines.push('');

		// Quiz Header
		lines.push(`# ${quiz.title}`);
		lines.push('');
		lines.push(`**Difficulty:** ${metadata.difficulty}`);
		lines.push(`**Questions:** ${quiz.questions.length}`);
		lines.push(`**Provider:** ${metadata.provider}`);
		lines.push('');

		// Quiz Data (JSON for easy loading)
		lines.push('## Quiz Data');
		lines.push('```json');
		lines.push(JSON.stringify(savedQuiz, null, 2));
		lines.push('```');

		// Human-readable questions
		lines.push('');
		lines.push('## Questions');
		lines.push('');

		quiz.questions.forEach((q, index) => {
			lines.push(`### Question ${index + 1}`);
			lines.push('');
			lines.push(q.question);
			lines.push('');

			if (q.type === 'multiple-choice' && q.options) {
				lines.push('**Options:**');
				q.options.forEach((opt, i) => {
					const letter = String.fromCharCode(65 + i);
					const isCorrect = opt === q.correctAnswer ? ' ✓' : '';
					lines.push(`- ${letter}. ${opt}${isCorrect}`);
				});
			} else {
				lines.push(`**Answer:** ${q.correctAnswer}`);
			}

			if (q.explanation) {
				lines.push('');
				lines.push(`**Explanation:** ${q.explanation}`);
			}

			lines.push('');
		});

		return lines.join('\n');
	}

	/**
	 * Load a quiz from a file
	 */
	async loadQuiz(filePath: string): Promise<SavedQuiz | null> {
		try {
			const file = this.app.vault.getAbstractFileByPath(filePath);
			if (!(file instanceof TFile)) {
				return null;
			}

			const content = await this.app.vault.read(file);

			// Extract JSON from markdown code block
			const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
			if (!jsonMatch) {
				console.error('No JSON data found in quiz file');
				return null;
			}

			const savedQuiz = JSON.parse(jsonMatch[1]) as SavedQuiz;
			return savedQuiz;
		} catch (error) {
			console.error('Error loading quiz:', error);
			return null;
		}
	}

	/**
	 * List all saved quizzes
	 */
	async listQuizzes(): Promise<TFile[]> {
		const folder = this.app.vault.getAbstractFileByPath(this.QUIZZES_FOLDER);
		if (!(folder instanceof TFolder)) {
			return [];
		}

		const quizFiles: TFile[] = [];
		for (const file of folder.children) {
			if (file instanceof TFile && file.extension === 'md') {
				quizFiles.push(file);
			}
		}

		// Sort by creation time (newest first)
		quizFiles.sort((a, b) => b.stat.ctime - a.stat.ctime);

		return quizFiles;
	}

	/**
	 * Save Pokédex data
	 */
	async savePokedexData(data: PokedexData): Promise<void> {
		data.lastUpdated = new Date().toISOString();
		await this.app.vault.adapter.write(
			this.POKEDEX_FILE,
			JSON.stringify(data, null, 2)
		);
	}

	/**
	 * Load Pokédex data
	 */
	async loadPokedexData(): Promise<PokedexData> {
		try {
			const exists = await this.app.vault.adapter.exists(this.POKEDEX_FILE);
			if (!exists) {
				return {
					caughtPokemon: [],
					totalCaught: 0,
					lastUpdated: new Date().toISOString()
				};
			}

			const content = await this.app.vault.adapter.read(this.POKEDEX_FILE);
			const parsed = JSON.parse(content) as PokedexData;
			parsed.caughtPokemon = (parsed.caughtPokemon || []).map((p: any) => ({
				id: p.id,
				name: p.name,
				caughtAt: p.caughtAt,
				score: typeof p.score === 'number' ? p.score : 0,
				catchCount: p.catchCount && p.catchCount > 0 ? p.catchCount : 1
			}));
			parsed.totalCaught = parsed.caughtPokemon.length;
			return parsed;
		} catch (error) {
			console.error('Error loading Pokédex data:', error);
			return {
				caughtPokemon: [],
				totalCaught: 0,
				lastUpdated: new Date().toISOString()
			};
		}
	}

	/**
	 * Migrate Pokédex data from localStorage to vault
	 */
	async migratePokedexFromLocalStorage(): Promise<boolean> {
		try {
			const stored = localStorage.getItem('quizdex-caught-pokemon');
			if (!stored) {
				return false; // Nothing to migrate
			}

			const localData = JSON.parse(stored);
			if (!Array.isArray(localData) || localData.length === 0) {
				return false;
			}

			// Load current vault data
			const vaultData = await this.loadPokedexData();

			// Merge with vault data (increment catch counts when necessary)
			for (const pokemon of localData) {
				const existing = vaultData.caughtPokemon.find(p => p.id === pokemon.id);
			if (existing) {
				existing.catchCount = (existing.catchCount ?? 1) + 1;
					existing.caughtAt = pokemon.caughtAt || existing.caughtAt;
					if (typeof pokemon.score === 'number') {
						existing.score = Math.max(existing.score, pokemon.score);
					}
				} else {
					vaultData.caughtPokemon.push({
						id: pokemon.id,
						name: pokemon.name,
						caughtAt: pokemon.caughtAt || new Date().toISOString(),
						score: typeof pokemon.score === 'number' ? pokemon.score : 0,
						catchCount: 1
					});
				}
			}

			vaultData.totalCaught = vaultData.caughtPokemon.length;

			// Save to vault
			await this.savePokedexData(vaultData);

			// Clear localStorage
			localStorage.removeItem('quizdex-caught-pokemon');

			console.log(`✅ Migrated ${localData.length} Pokémon from localStorage to vault`);
			return true;
		} catch (error) {
			console.error('Error migrating Pokédex data:', error);
			return false;
		}
	}

	/**
	 * Save quiz history
	 */
	async saveQuizHistory(history: QuizHistory[]): Promise<void> {
		await this.app.vault.adapter.write(
			this.HISTORY_FILE,
			JSON.stringify(history, null, 2)
		);
	}

	/**
	 * Load quiz history
	 */
	async loadQuizHistory(): Promise<QuizHistory[]> {
		try {
			const exists = await this.app.vault.adapter.exists(this.HISTORY_FILE);
			if (!exists) {
				return [];
			}

			const content = await this.app.vault.adapter.read(this.HISTORY_FILE);
			return JSON.parse(content);
		} catch (error) {
			console.error('Error loading quiz history:', error);
			return [];
		}
	}

	/**
	 * Record a quiz attempt
	 */
	async recordQuizAttempt(quizId: string, result: QuizResult): Promise<void> {
		const history = await this.loadQuizHistory();

		let quizHistory = history.find(h => h.quizId === quizId);

		if (!quizHistory) {
			quizHistory = {
				quizId,
				attempts: [],
				lastAttempt: new Date().toISOString(),
				bestScore: 0
			};
			history.push(quizHistory);
		}

		quizHistory.attempts.push(result);
		quizHistory.lastAttempt = new Date().toISOString();
		quizHistory.bestScore = Math.max(quizHistory.bestScore, result.score);

		await this.saveQuizHistory(history);
	}
}
