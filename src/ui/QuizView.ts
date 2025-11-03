/**
 * QuizView - Main view for displaying and taking quizzes
 */

import { ItemView, WorkspaceLeaf, ButtonComponent, Notice } from 'obsidian';
import { Quiz, Question } from '../types/quiz.types';
import { PokedexComponent } from './PokedexComponent';
import { PokedexModal } from './PokedexModal';
import { PokemonCardModal } from './PokemonCardModal';
import type QuizDexPlugin from '../main';

export const QUIZ_VIEW_TYPE = 'quizdex-quiz-view';

interface QuizSession {
	quiz: Quiz;
	currentQuestionIndex: number;
	answers: Map<string, string>;
	showingResults: boolean;
	startTime: Date;
	pokemonId: number; // The Pokémon to catch for this quiz session
}

export class QuizView extends ItemView {
	private session: QuizSession | null = null;
	private pokedexComponent: PokedexComponent | null = null;
	private plugin: QuizDexPlugin;

	constructor(leaf: WorkspaceLeaf, plugin: QuizDexPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return QUIZ_VIEW_TYPE;
	}

	getDisplayText(): string {
		return 'QuizDex';
	}

	getIcon(): string {
		return 'help-circle';
	}

	async onOpen() {
		this.containerEl.empty();
		this.renderWelcomeScreen();
	}

	async onClose() {
		// Cleanup if needed
	}

	/**
	 * Load a quiz and start the session
	 */
	async loadQuiz(quiz: Quiz) {
		// Generate ONE random Pokémon for this entire quiz session
		const randomPokemonId = Math.floor(Math.random() * 151) + 1;

		this.session = {
			quiz,
			currentQuestionIndex: 0,
			answers: new Map(),
			showingResults: false,
			startTime: new Date(),
			pokemonId: randomPokemonId
		};

		new Notice(`Quiz loaded: ${quiz.title}`);
		this.renderQuiz();
	}

	/**
	 * Add top button bar with pizza button (left) and exit button (right)
	 */
	private addTopButtonBar(container: HTMLElement, showExitButton: boolean = false) {
		const topButtonBar = container.createDiv('top-button-bar');
		topButtonBar.style.position = 'absolute';
		topButtonBar.style.top = '10px';
		topButtonBar.style.left = '10px';
		topButtonBar.style.right = '10px';
		topButtonBar.style.display = 'flex';
		topButtonBar.style.justifyContent = 'space-between';
		topButtonBar.style.alignItems = 'center';
		topButtonBar.style.zIndex = '1000';
		topButtonBar.style.gap = '10px';

		// Pizza button (left side)
		const pizzaBtn = topButtonBar.createEl('a', {
			href: 'https://www.buymeacoffee.com/YbEwc5qvHT',
			attr: {
				target: '_blank',
				'aria-label': 'Support QuizDex - Buy me a pizza'
			}
		});
		pizzaBtn.style.padding = '8px 12px';
		pizzaBtn.style.backgroundColor = 'var(--interactive-accent)';
		pizzaBtn.style.color = 'var(--text-on-accent)';
		pizzaBtn.style.borderRadius = '6px';
		pizzaBtn.style.textDecoration = 'none';
		pizzaBtn.style.fontSize = '0.9em';
		pizzaBtn.style.fontWeight = '500';
		pizzaBtn.style.transition = 'opacity 0.2s ease';
		pizzaBtn.style.flexShrink = '0';
		pizzaBtn.textContent = '🍕 Buy me a pizza';
		pizzaBtn.addEventListener('mouseenter', () => {
			pizzaBtn.style.opacity = '0.8';
		});
		pizzaBtn.addEventListener('mouseleave', () => {
			pizzaBtn.style.opacity = '1';
		});

		// Exit button (right side) - only show if requested
		if (showExitButton) {
			const exitBtnContainer = topButtonBar.createDiv('top-exit-btn-container');
			exitBtnContainer.style.flexShrink = '0';
			const exitBtn = new ButtonComponent(exitBtnContainer);
			exitBtn.setButtonText('✕ Exit Quiz');
			exitBtn.setClass('mod-warning');
			exitBtn.setTooltip('Exit quiz and return to welcome screen');
			exitBtn.buttonEl.style.fontSize = '0.9em';
			exitBtn.buttonEl.style.padding = '8px 14px';
			exitBtn.buttonEl.style.whiteSpace = 'nowrap';
			exitBtn.onClick(() => {
				const confirmExit = confirm('Are you sure you want to exit this quiz? Your progress will be lost.');
				if (confirmExit) {
					this.session = null;
					this.renderWelcomeScreen();
				}
			});
		} else {
			// Empty div to maintain flex layout
			topButtonBar.createDiv();
		}
	}

	/**
	 * Render welcome screen
	 */
	private renderWelcomeScreen() {
		this.containerEl.empty();

		const container = this.containerEl.createDiv('quiz-welcome');
		container.addClass('quiz-container');
		container.style.position = 'relative';

		// Add top button bar with just pizza button
		this.addTopButtonBar(container, false);

		// Title
		const titleDiv = container.createDiv('welcome-title');
		titleDiv.style.textAlign = 'center';
		titleDiv.style.marginBottom = '20px';
		titleDiv.style.paddingTop = '60px'; // Space for pizza button above

		const mainTitle = titleDiv.createEl('h2', { text: '🎮 QuizDex' });
		mainTitle.style.fontSize = '2.2em';
		mainTitle.style.margin = '0 0 10px 0';
		mainTitle.style.color = 'var(--interactive-accent)';
		mainTitle.style.fontWeight = 'bold';

		const subtitle = titleDiv.createEl('p', {
			text: 'Gotta Learn \'Em All! ⚡'
		});
		subtitle.style.fontSize = '1.1em';
		subtitle.style.margin = '0 0 15px 0';
		subtitle.style.color = 'var(--text-muted)';
		subtitle.style.fontStyle = 'italic';

		container.createEl('p', {
			text: 'Generate AI-powered quizzes from your notes and master your knowledge!'
		});

		// Actions
		const actionsContainer = container.createDiv('welcome-actions');
		actionsContainer.style.display = 'flex';
		actionsContainer.style.flexDirection = 'column';
		actionsContainer.style.gap = '12px';
		actionsContainer.style.margin = '25px 0';
		actionsContainer.style.padding = '20px';
		actionsContainer.style.backgroundColor = 'var(--background-secondary)';
		actionsContainer.style.borderRadius = '8px';

		const generateBtn = new ButtonComponent(actionsContainer);
		generateBtn.setButtonText('🎯 Generate New Quiz');
		generateBtn.setCta();
		generateBtn.setTooltip('Generate a quiz from your notes');
		generateBtn.buttonEl.style.width = '100%';
		generateBtn.buttonEl.style.padding = '12px';
		generateBtn.buttonEl.style.fontSize = '1.1em';
		generateBtn.buttonEl.style.marginBottom = '10px';
		generateBtn.onClick(() => {
			// @ts-ignore - commands property exists at runtime
			this.app.commands.executeCommandById('quizdex:generate-quiz');
		});

		const loadBtn = new ButtonComponent(actionsContainer);
		loadBtn.setButtonText('📂 Load Saved Quiz');
		loadBtn.setTooltip('Browse and load previously saved quizzes');
		loadBtn.buttonEl.style.width = '100%';
		loadBtn.buttonEl.style.padding = '12px';
		loadBtn.buttonEl.style.fontSize = '1.1em';
		loadBtn.onClick(() => {
			// @ts-ignore - commands property exists at runtime
			this.app.commands.executeCommandById('quizdex:load-saved-quiz');
		});

		// Instructions
		const instructionsDiv = container.createDiv('instructions');
		instructionsDiv.createEl('h3', { text: 'How to use:' });

		const instructionsList = instructionsDiv.createEl('ul');
		instructionsList.createEl('li', { text: '1. Click "Generate New Quiz" to create a quiz from your notes' });
		instructionsList.createEl('li', { text: '2. Select notes and configure quiz options' });
		instructionsList.createEl('li', { text: '3. Take the quiz and view detailed results' });
		instructionsList.createEl('li', { text: '4. Score 100% to catch Pokémon!' });

		const speedTips = instructionsDiv.createDiv('speed-tips');
		speedTips.addClass('setting-item-description');
		speedTips.style.marginTop = '12px';
		speedTips.textContent = '⚡ Using Ollama? Adjust the prompt limit and keep-alive in Settings → QuizDex → Ollama, and try a lightweight instruct model like phi3:mini or gemma2:2b-instruct for faster quiz generation.';

		// Pokédex Section
		const pokedexSection = container.createDiv('pokedex-section');
		pokedexSection.style.marginTop = '30px';

		this.pokedexComponent = new PokedexComponent(pokedexSection, this.plugin.storageService, this.app);
		this.pokedexComponent.init();

		const pokedexModalBtn = pokedexSection.createDiv('pokedex-open-icon');
		pokedexModalBtn.tabIndex = 0;
		pokedexModalBtn.setAttr('role', 'button');
		pokedexModalBtn.setAttr('aria-label', 'Open full Pokédex');
		const iconPath = this.plugin.getPokemonIconPath();
		if (iconPath) {
			pokedexModalBtn.createEl('img', {
				attr: {
					src: iconPath,
					alt: 'Open Pokédex'
				}
			});
		} else {
			pokedexModalBtn.innerHTML = '<span class="pokedex-open-icon-symbol">📘</span>';
		}
		pokedexModalBtn.addEventListener('click', () => {
			new PokedexModal(this.app, this.plugin.storageService).open();
		});
		pokedexModalBtn.addEventListener('keypress', (event) => {
			if (event.key === 'Enter' || event.key === ' ') {
				event.preventDefault();
				new PokedexModal(this.app, this.plugin.storageService).open();
			}
		});
	}

	/**
	 * Render the active quiz
	 */
	private renderQuiz() {
		if (!this.session) return;

		this.containerEl.empty();

		const container = this.containerEl.createDiv('quiz-active');
		container.addClass('quiz-container');
		container.style.height = '100%';
		container.style.display = 'flex';
		container.style.flexDirection = 'column';
		container.style.position = 'relative';

		// Add top button bar with pizza button and exit button for quiz
		if (!this.session.showingResults) {
			this.addTopButtonBar(container, true);
		}

		if (this.session.showingResults) {
			this.renderResults(container);
		} else {
			this.renderQuestion(container);
		}
	}

	/**
	 * Render current question
	 */
	private renderQuestion(container: HTMLElement) {
		if (!this.session) return;

		const { quiz, currentQuestionIndex, answers } = this.session;
		const question = quiz.questions[currentQuestionIndex];

		// Scrollable container
		const scrollableContainer = container.createDiv('quiz-scrollable-container');
		scrollableContainer.style.flex = '1';
		scrollableContainer.style.overflowY = 'auto';
		scrollableContainer.style.paddingRight = '8px';
		scrollableContainer.style.paddingBottom = '20px';

		// Header with proper spacing for top button bar
		const header = scrollableContainer.createDiv('quiz-header');
		header.style.position = 'relative';
		header.style.paddingTop = '60px'; // Space for top button bar
		
		// Quiz title (centered)
		const titleEl = header.createEl('h2', { text: quiz.title });
		titleEl.style.textAlign = 'center';
		titleEl.style.margin = '0 0 10px 0';
		titleEl.style.color = 'var(--interactive-accent)';
		
		// Quiz description (centered)
		const descriptionEl = header.createEl('p', { text: quiz.description });
		descriptionEl.style.textAlign = 'center';
		descriptionEl.style.margin = '0 0 20px 0';
		descriptionEl.style.color = 'var(--text-muted)';

		// Progress bar
		const progressContainer = header.createDiv('progress-container');
		const progressBar = progressContainer.createDiv('progress-bar');
		const progressFill = progressBar.createDiv('progress-fill');
		const progress = ((currentQuestionIndex + 1) / quiz.questions.length) * 100;
		progressFill.style.width = `${progress}%`;

		const progressText = progressContainer.createDiv('progress-text');
		progressText.textContent = `Question ${currentQuestionIndex + 1} of ${quiz.questions.length}`;

		// Question
		const questionContainer = scrollableContainer.createDiv('question-container');
		questionContainer.style.marginTop = '16px';
		questionContainer.style.margin = '20px 0';

		questionContainer.createEl('h3', {
			text: `${currentQuestionIndex + 1}. ${question.question}`,
			cls: 'question-text'
		});

		// Options
		const optionsContainer = questionContainer.createDiv('options-container');
		const currentAnswer = answers.get(question.id) || '';

		this.renderOptions(optionsContainer, question, currentAnswer);

		// Pokémon Challenge Image (shows which Pokémon you're trying to catch)
		const pokemonSection = scrollableContainer.createDiv('pokemon-challenge');
		pokemonSection.style.marginTop = '30px';
		pokemonSection.style.padding = '20px';
		pokemonSection.style.backgroundColor = 'var(--background-secondary)';
		pokemonSection.style.borderRadius = '8px';
		pokemonSection.style.textAlign = 'center';
		pokemonSection.setAttr('role', 'button');
		pokemonSection.setAttr('aria-label', 'View Pokémon details');

		// Use the pokemonId from session - stays the same for entire quiz!
		const pokemonId = this.session.pokemonId;

		pokemonSection.createEl('h4', {
			text: '🎯 Pokémon Challenge',
			attr: { style: 'margin: 0 0 10px 0; color: var(--interactive-accent);' }
		});

		pokemonSection.createEl('p', {
			text: 'Score 100% to catch this Pokémon!',
			attr: { style: 'margin: 0 0 15px 0; font-size: 0.9em; color: var(--text-muted);' }
		});

		pokemonSection.createEl('img', {
			attr: {
				src: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pokemonId}.png`,
				alt: `Pokémon #${pokemonId}`,
				style: 'width: 200px; height: 200px; object-fit: contain;'
			}
		});
		pokemonSection.createDiv({ text: 'Tap for Pokédex card' }).addClass('pokemon-challenge-hint');

		pokemonSection.addEventListener('click', () => {
			new PokemonCardModal(this.app, pokemonId, this.plugin.storageService).open();
		});

		// Navigation
		const navigation = container.createDiv('navigation-container');
		navigation.style.padding = '20px';
		navigation.style.borderTop = '2px solid var(--background-modifier-border)';
		navigation.style.display = 'flex';
		navigation.style.justifyContent = 'space-between';
		navigation.style.alignItems = 'center';
		navigation.style.gap = '10px';

		// Left side - Previous button
		const leftNav = navigation.createDiv('nav-left');
		leftNav.style.display = 'flex';
		leftNav.style.gap = '10px';

		const prevBtn = new ButtonComponent(leftNav);
		prevBtn.setButtonText('← Previous');
		prevBtn.setClass('nav-btn');
		prevBtn.setDisabled(currentQuestionIndex === 0);
		prevBtn.onClick(() => {
			if (this.session && currentQuestionIndex > 0) {
				this.session.currentQuestionIndex--;
				this.renderQuiz();
			}
		});

		// Center - Question counter
		const counterDiv = navigation.createDiv('nav-center');
		counterDiv.style.textAlign = 'center';
		counterDiv.style.flex = '1';

		const questionCounter = counterDiv.createDiv('question-counter');
		questionCounter.textContent = `${currentQuestionIndex + 1} / ${quiz.questions.length}`;

		const answerStatus = counterDiv.createDiv('answer-status');
		answerStatus.textContent = currentAnswer ? '✓ Answered' : 'Not answered';
		answerStatus.addClass(currentAnswer ? 'answered' : 'unanswered');

		// Right side - Next/Submit button
		const rightNav = navigation.createDiv('nav-right');

		const nextBtn = new ButtonComponent(rightNav);
		if (currentQuestionIndex === quiz.questions.length - 1) {
			nextBtn.setButtonText('Submit Quiz →');
			nextBtn.setCta();
			nextBtn.onClick(() => this.submitQuiz());
		} else {
			nextBtn.setButtonText('Next →');
			nextBtn.setClass('nav-btn');
			nextBtn.onClick(() => {
				if (this.session) {
					this.session.currentQuestionIndex++;
					this.renderQuiz();
				}
			});
		}
	}

	/**
	 * Render answer options based on question type
	 */
	private renderOptions(container: HTMLElement, question: Question, currentAnswer: string) {
		if (question.type === 'multiple-choice' && question.options) {
			question.options.forEach(option => {
				const optionDiv = container.createDiv('option-item');
				const optionLetter = option.charAt(0);
				const isSelected = currentAnswer === optionLetter;

				if (isSelected) {
					optionDiv.addClass('selected');
				}

				optionDiv.textContent = option;

				optionDiv.addEventListener('click', () => {
					if (this.session) {
						this.session.answers.set(question.id, optionLetter);
						this.renderQuiz();
					}
				});
			});
		} else if (question.type === 'true-false') {
			['True', 'False'].forEach(option => {
				const optionDiv = container.createDiv('option-item');
				optionDiv.addClass('true-false');
				const isSelected = currentAnswer.toLowerCase() === option.toLowerCase();

				if (isSelected) {
					optionDiv.addClass('selected');
					optionDiv.addClass(option.toLowerCase());
				}

				optionDiv.textContent = option;

				optionDiv.addEventListener('click', () => {
					if (this.session) {
						this.session.answers.set(question.id, option.toLowerCase());
						this.renderQuiz();
					}
				});
			});
		}
	}

	/**
	 * Submit quiz and show results
	 */
	private submitQuiz() {
		if (!this.session) return;

		const unansweredCount = this.session.quiz.questions.length - this.session.answers.size;

		if (unansweredCount > 0) {
			const proceed = confirm(
				`You have ${unansweredCount} unanswered question${unansweredCount > 1 ? 's' : ''}.\n\nDo you want to submit anyway?`
			);

			if (!proceed) {
				return;
			}
		}

		this.session.showingResults = true;
		this.renderQuiz();
	}

	/**
	 * Render results screen
	 */
	private renderResults(container: HTMLElement) {
		if (!this.session) return;

		// Add top button bar to results screen
		this.addTopButtonBar(container, false);

		const { quiz, answers, startTime } = this.session;

		// Calculate score
		let correctCount = 0;
		quiz.questions.forEach(question => {
			const userAnswer = answers.get(question.id);
			const correctAnswer = Array.isArray(question.correctAnswer)
				? question.correctAnswer[0]
				: question.correctAnswer;

			if (userAnswer && this.normalizeAnswer(userAnswer) === this.normalizeAnswer(correctAnswer)) {
				correctCount++;
			}
		});

		const score = (correctCount / quiz.questions.length) * 100;
		const duration = Math.floor((Date.now() - startTime.getTime()) / 1000);
		const minutes = Math.floor(duration / 60);
		const seconds = duration % 60;

		// Close button (top right)
		const closeContainer = container.createDiv('results-close-container');
		closeContainer.style.display = 'flex';
		closeContainer.style.justifyContent = 'flex-end';
		closeContainer.style.padding = '12px 20px 0 20px';

		const closeBtnTop = new ButtonComponent(closeContainer);
		closeBtnTop.setButtonText('✕ Close');
		closeBtnTop.setClass('mod-warning');
		closeBtnTop.buttonEl.classList.add('results-close-btn');
		closeBtnTop.onClick(() => {
			this.session = null;
			this.renderWelcomeScreen();
		});

		// Scrollable results container
		const scrollContainer = container.createDiv('results-scrollable-container');

		// Header
		const header = scrollContainer.createDiv('results-header');
		header.createEl('h2', { text: 'Quiz Results' });

		// Score summary
		const scoreSummary = scrollContainer.createDiv('score-summary');
		const scoreText = scoreSummary.createDiv('score-text');
		scoreText.textContent = `${correctCount}/${quiz.questions.length}`;

		const percentageText = scoreSummary.createDiv('percentage-text');
		percentageText.textContent = `${score.toFixed(1)}%`;

		const timeText = scoreSummary.createDiv('time-text');
		timeText.textContent = `Completed in ${minutes}m ${seconds}s`;

		// Detailed results
		const details = scrollContainer.createDiv('results-details');
		details.createEl('h3', { text: 'Question Review' });

		const questionsContainer = details.createDiv('scrollable-questions');

		quiz.questions.forEach((question, index) => {
			const userAnswer = answers.get(question.id) || '';
			const correctAnswer = Array.isArray(question.correctAnswer)
				? question.correctAnswer[0]
				: question.correctAnswer;
			const isCorrect = userAnswer && this.normalizeAnswer(userAnswer) === this.normalizeAnswer(correctAnswer);

			const resultItem = questionsContainer.createDiv('result-item');
			resultItem.addClass(isCorrect ? 'correct' : 'incorrect');

			const questionDiv = resultItem.createDiv('result-question');
			questionDiv.textContent = `${index + 1}. ${question.question}`;

			const answersDiv = resultItem.createDiv('result-answers');

			const userAnswerDiv = answersDiv.createDiv('user-answer');
			userAnswerDiv.innerHTML = `<strong>Your answer:</strong> ${userAnswer || '<em>Not answered</em>'}`;

			if (!isCorrect) {
				const correctAnswerDiv = answersDiv.createDiv('correct-answer');
				correctAnswerDiv.innerHTML = `<strong>Correct answer:</strong> ${correctAnswer}`;
			}

			if (question.explanation) {
				const explanationDiv = resultItem.createDiv('explanation');
				explanationDiv.innerHTML = `<strong>Explanation:</strong><br>${question.explanation}`;
			}
		});

		// Actions (fixed at bottom, always visible)
		const actionsContainer = container.createDiv('results-actions');
		actionsContainer.style.padding = '20px';
		actionsContainer.style.borderTop = '2px solid var(--background-modifier-border)';
		actionsContainer.style.display = 'flex';
		actionsContainer.style.justifyContent = 'center';
		actionsContainer.style.gap = '10px';
		actionsContainer.style.backgroundColor = 'var(--background-primary)';
		actionsContainer.style.flexWrap = 'wrap';

		const retryBtn = new ButtonComponent(actionsContainer);
		retryBtn.setButtonText('🔄 Retry Quiz');
		retryBtn.onClick(() => {
			if (this.session) {
				// Keep the same Pokémon when retrying
				this.session.currentQuestionIndex = 0;
				this.session.answers.clear();
				this.session.showingResults = false;
				this.session.startTime = new Date();
				this.renderQuiz();
			}
		});

		const newQuizBtn = new ButtonComponent(actionsContainer);
		newQuizBtn.setButtonText('🎯 New Quiz');
		newQuizBtn.setCta();
		newQuizBtn.onClick(() => {
			// @ts-ignore - commands property exists at runtime
			this.app.commands.executeCommandById('quizdex:generate-quiz');
		});
	}

	/**
	 * Normalize answer for comparison
	 */
	private normalizeAnswer(answer: string | boolean | string[]): string {
		// Handle different answer types
		if (typeof answer === 'boolean') {
			return answer.toString().toLowerCase();
		}
		if (Array.isArray(answer)) {
			return answer[0]?.toString().toLowerCase().trim() || '';
		}
		if (typeof answer === 'string') {
			return answer.toLowerCase().trim();
		}
		return String(answer).toLowerCase().trim();
	}
}
