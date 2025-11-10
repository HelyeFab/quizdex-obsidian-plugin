# QuizDex v2.0 Implementation Guide

## 🎯 Addressing All Four Critical Gaps

This guide explains how to implement the solutions for all identified gaps in the QuizDex plugin.

---

## 📋 Table of Contents

1. [Gap 1: API Key Security](#gap-1-api-key-security)
2. [Gap 2: Architecture & Maintainability](#gap-2-architecture--maintainability)
3. [Gap 3: Error Resilience](#gap-3-error-resilience)
4. [Gap 4: Testing Infrastructure](#gap-4-testing-infrastructure)

---

## 🔐 Gap 1: API Key Security

### Problem
API keys stored in plaintext in `data.json`, accessible to anyone with filesystem access.

### Solution: CredentialManager with AES-256-GCM Encryption

#### Architecture

```
┌─────────────────────────────────────────────────┐
│              CredentialManager                  │
├─────────────────────────────────────────────────┤
│                                                 │
│  User Passphrase                                │
│       ↓                                         │
│  PBKDF2 (100k iterations)                       │
│       ↓                                         │
│  Master Key (AES-256)                           │
│       ↓                                         │
│  Encrypt/Decrypt API Keys                       │
│       ↓                                         │
│  Memory Cache (15min TTL)                       │
│                                                 │
└─────────────────────────────────────────────────┘
```

#### Implementation Steps

**1. Add CredentialManager to Plugin**

```typescript
// main.ts
import { CredentialManager } from './security/CredentialManager';

export default class QuizGeneratorPlugin extends Plugin {
  credentialManager: CredentialManager;

  async onload() {
    await this.loadSettings();

    // Initialize credential manager
    this.credentialManager = new CredentialManager(this);

    // Check for migration need
    await this.checkAndMigrate();

    // Initialize with passphrase
    const passphrase = await this.getOrPromptPassphrase();
    if (passphrase) {
      await this.credentialManager.initialize(passphrase);
    }

    // Rest of plugin initialization...
  }

  onunload() {
    // Clear sensitive data from memory
    this.credentialManager.destroy();
  }
}
```

**2. Create Passphrase Prompt Modal**

```typescript
// modals/PassphraseModal.ts
import { Modal, App, Setting } from 'obsidian';

export class PassphraseModal extends Modal {
  private passphrase: string = '';
  private onSubmit: (passphrase: string) => void;

  constructor(app: App, onSubmit: (passphrase: string) => void) {
    super(app);
    this.onSubmit = onSubmit;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl('h2', { text: '🔐 Enter Passphrase' });
    contentEl.createEl('p', {
      text: 'This passphrase encrypts your API keys. Keep it safe!'
    });

    new Setting(contentEl)
      .setName('Passphrase')
      .setDesc('Minimum 12 characters recommended')
      .addText(text => text
        .setPlaceholder('Enter passphrase')
        .onChange(value => this.passphrase = value)
        .inputEl.setAttribute('type', 'password')
      );

    new Setting(contentEl)
      .addButton(btn => btn
        .setButtonText('Cancel')
        .onClick(() => this.close())
      )
      .addButton(btn => btn
        .setButtonText('Unlock')
        .setCta()
        .onClick(() => {
          if (this.passphrase.length >= 8) {
            this.onSubmit(this.passphrase);
            this.close();
          } else {
            new Notice('⚠️ Passphrase too short');
          }
        })
      );
  }
}
```

**3. Update Settings Tab**

```typescript
// settings.ts
class QuizGeneratorSettingTab extends PluginSettingTab {
  display() {
    const { containerEl } = this;
    containerEl.empty();

    // Security Section
    containerEl.createEl('h2', { text: '🔐 Security' });

    // Security audit display
    this.displaySecurityAudit(containerEl);

    // Passphrase management
    new Setting(containerEl)
      .setName('Change Passphrase')
      .setDesc('Update your encryption passphrase')
      .addButton(btn => btn
        .setButtonText('Change')
        .onClick(() => this.changePassphrase())
      );

    // API Key Settings
    containerEl.createEl('h2', { text: '🤖 AI Providers' });

    this.addProviderSetting(containerEl, 'OpenAI', 'openai');
    this.addProviderSetting(containerEl, 'Anthropic', 'anthropic');
    this.addProviderSetting(containerEl, 'Google', 'google');
    // ... more providers
  }

  private async displaySecurityAudit(containerEl: HTMLElement) {
    const audit = await this.plugin.credentialManager.auditSecurity();

    const auditDiv = containerEl.createDiv('security-audit');
    auditDiv.style.padding = '15px';
    auditDiv.style.marginBottom = '20px';
    auditDiv.style.borderRadius = '8px';

    if (audit.insecure > 0) {
      auditDiv.style.backgroundColor = 'var(--background-modifier-error)';
      auditDiv.innerHTML = `
        <strong>⚠️ Security Warning</strong><br>
        ${audit.insecure} API key(s) stored in plaintext<br>
        <button class="mod-warning">Migrate Now</button>
      `;

      auditDiv.querySelector('button')?.addEventListener('click', async () => {
        await this.migrateToEncrypted();
      });
    } else {
      auditDiv.style.backgroundColor = 'var(--background-modifier-success)';
      auditDiv.innerHTML = `
        <strong>✅ All API keys encrypted</strong><br>
        ${audit.secure} secure credential(s)
      `;
    }
  }

  private addProviderSetting(
    containerEl: HTMLElement,
    displayName: string,
    provider: string
  ) {
    new Setting(containerEl)
      .setName(`${displayName} API Key`)
      .setDesc('Encrypted with your passphrase')
      .addText(text => {
        text
          .setPlaceholder('Enter API key')
          .inputEl.setAttribute('type', 'password');

        // Show if key exists
        this.plugin.credentialManager.hasCredential(provider).then(has => {
          if (has) {
            text.setPlaceholder('••••••••••••••••');
          }
        });

        return text;
      })
      .addButton(btn => btn
        .setButtonText('Save')
        .onClick(async () => {
          const input = containerEl.querySelector(`input[placeholder*="${displayName}"]`) as HTMLInputElement;
          const apiKey = input?.value;

          if (apiKey && apiKey.trim()) {
            const passphrase = await this.promptPassphrase();
            if (passphrase) {
              await this.plugin.credentialManager.setCredential(
                provider,
                apiKey.trim(),
                passphrase
              );
              input.value = '';
              input.placeholder = '••••••••••••••••';
            }
          }
        })
      )
      .addButton(btn => btn
        .setButtonText('Remove')
        .setWarning()
        .onClick(async () => {
          await this.plugin.credentialManager.removeCredential(provider);
        })
      );
  }

  private async migrateToEncrypted() {
    const passphrase = await this.promptPassphrase(true);
    if (!passphrase) return;

    const settings = await this.plugin.loadData();
    await this.plugin.credentialManager.migrateToEncrypted(
      passphrase,
      settings
    );

    // Refresh display
    this.display();
  }

  private async promptPassphrase(isNew: boolean = false): Promise<string | null> {
    return new Promise(resolve => {
      new PassphraseModal(this.app, resolve).open();
    });
  }
}
```

**4. Update Quiz Generation to Use Encrypted Keys**

```typescript
async generateQuiz(options: QuizGenerationOptions) {
  // Get provider from settings
  const providerName = this.settings.provider || 'ollama';

  // Retrieve encrypted API key
  const apiKey = await this.credentialManager.getCredential(providerName);

  if (!apiKey && providerName !== 'ollama') {
    new Notice(`❌ No API key configured for ${providerName}`);
    return;
  }

  // Initialize provider with decrypted key
  const provider = this.orchestrator.getProvider(providerName);
  if (!provider) {
    new Notice(`❌ Provider ${providerName} not available`);
    return;
  }

  await provider.initialize({
    baseURL: this.settings[`${providerName}BaseURL`],
    apiKey: apiKey || undefined,
    model: this.settings[`${providerName}TextGenModel`]
  });

  // Generate quiz with fallback
  const result = await this.orchestrator.generateQuizWithFallback(
    noteContents,
    options,
    providerName
  );

  if (result.success) {
    // Success!
  }
}
```

### Migration Path for Existing Users

```typescript
async checkAndMigrate() {
  const audit = await this.credentialManager.auditSecurity();

  if (audit.insecure > 0) {
    // Show migration dialog
    new Notice(
      `⚠️ Found ${audit.insecure} unencrypted API keys. ` +
      `Please migrate to secure storage.`,
      10000
    );

    // Auto-open migration modal after 2 seconds
    setTimeout(() => {
      new MigrationModal(this.app, async (passphrase) => {
        if (passphrase) {
          const settings = await this.loadData();
          await this.credentialManager.migrateToEncrypted(
            passphrase,
            settings
          );

          // Clear plaintext keys
          delete settings.openAIApiKey;
          delete settings.googleApiKey;
          delete settings.anthropicApiKey;
          delete settings.perplexityApiKey;
          delete settings.mistralApiKey;
          delete settings.cohereApiKey;

          await this.saveData(settings);
          new Notice('✅ Migration complete!');
        }
      }).open();
    }, 2000);
  }
}
```

---

## 🏗️ Gap 2: Architecture & Maintainability

### Problem
- Only bundled JavaScript available (no TypeScript source)
- No clear provider abstraction
- Hard to maintain and extend

### Solution: Provider Interface + Orchestration Layer

#### Architecture

```
┌─────────────────────────────────────────────────┐
│          AIProviderOrchestrator                 │
│  ┌───────────────────────────────────────────┐  │
│  │  Circuit Breaker  │  Retry Logic │ Cache │  │
│  └───────────────────────────────────────────┘  │
├─────────────────────────────────────────────────┤
│              IAIProvider Interface              │
├─────────────────────────────────────────────────┤
│  OllamaProvider │ OpenAIProvider │ ...         │
└─────────────────────────────────────────────────┘
```

#### Implementation Steps

**1. Create New Provider**

```typescript
// services/providers/OpenAIProvider.ts
import { requestUrl } from 'obsidian';
import { IAIProvider } from '../AIProvider.interface';

export class OpenAIProvider implements IAIProvider {
  readonly name = 'openai';
  readonly displayName = 'OpenAI';

  private config: AIProviderConfig | null = null;

  async initialize(config: AIProviderConfig): Promise<void> {
    this.config = config;
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await requestUrl({
        url: `${this.config!.baseURL}/models`,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.config!.apiKey}`
        }
      });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  async generateQuiz(
    noteContents: string[],
    options: QuizGenerationOptions
  ): Promise<Quiz> {
    // OpenAI-specific implementation
    const response = await requestUrl({
      url: `${this.config!.baseURL}/chat/completions`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config!.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: this.config!.model,
        messages: [
          { role: 'system', content: 'You are a quiz generator...' },
          { role: 'user', content: this.buildPrompt(noteContents, options) }
        ]
      })
    });

    return this.parseResponse(response.json);
  }

  // ... implement other interface methods
}
```

**2. Register All Providers**

```typescript
// main.ts
async onload() {
  // ... initialization

  // Create orchestrator
  this.orchestrator = new AIProviderOrchestrator();

  // Register all providers
  this.orchestrator.registerProvider(new OllamaProvider());
  this.orchestrator.registerProvider(new OpenAIProvider());
  this.orchestrator.registerProvider(new AnthropicProvider());
  this.orchestrator.registerProvider(new GoogleProvider());
  this.orchestrator.registerProvider(new PerplexityProvider());
  this.orchestrator.registerProvider(new MistralProvider());
  this.orchestrator.registerProvider(new CohereProvider());

  console.log(`✅ Registered ${this.orchestrator.listProviders().length} AI providers`);
}
```

**3. Build System Setup**

```bash
# Install dependencies
npm install

# Development mode (watch)
npm run dev

# Production build
npm run build

# Run tests
npm test

# Run with UI
npm run test:ui
```

---

## 🛡️ Gap 3: Error Resilience

### Problem
- Basic try-catch with popup notifications
- No fallback between providers
- No retry logic

### Solution: Orchestrator with Circuit Breaker

#### Features

1. **Automatic Fallback**: Try providers in order until success
2. **Retry Logic**: Exponential backoff for transient failures
3. **Circuit Breaker**: Temporarily disable failing providers
4. **Timeout Handling**: Prevent hanging requests

#### Implementation

**Circuit Breaker States**

```
CLOSED ──[3 failures]──> OPEN ──[60s timeout]──> HALF-OPEN
   ↑                                                   │
   └──────────────[success]────────────────────────────┘
```

**Usage in Quiz Generation**

```typescript
async generateQuiz(options: QuizGenerationOptions) {
  const noteContents = await this.loadNoteContents(options.selectedNotes);

  // Orchestrator handles everything:
  // - Try preferred provider
  // - Retry on failure
  // - Fallback to other providers
  // - Circuit breaker management
  const result = await this.orchestrator.generateQuizWithFallback(
    noteContents,
    options,
    this.settings.provider // preferred provider
  );

  if (result.success) {
    new Notice(`✅ Quiz generated with ${result.provider}`);
    return result.quiz;
  } else {
    new Notice(`❌ All providers failed: ${result.error?.message}`);
    // Show detailed error info
    this.showErrorModal(result.error, result.attemptCount);
  }
}
```

**Error Handling Modal**

```typescript
class ErrorDetailsModal extends Modal {
  constructor(app: App, error: AIProviderError, attempts: number) {
    super(app);
    this.error = error;
    this.attempts = attempts;
  }

  onOpen() {
    const { contentEl } = this;

    contentEl.createEl('h2', { text: '❌ Quiz Generation Failed' });

    contentEl.createEl('p', { text: `Error: ${this.error.message}` });
    contentEl.createEl('p', { text: `Provider: ${this.error.provider}` });
    contentEl.createEl('p', { text: `Attempts: ${this.attempts}` });
    contentEl.createEl('p', { text: `Error Code: ${this.error.code}` });

    if (this.error.retryable) {
      contentEl.createEl('p', {
        text: '💡 This error is temporary. Try again in a moment.',
        cls: 'setting-item-description'
      });
    }

    // Suggestions based on error code
    switch (this.error.code) {
      case ErrorCode.INVALID_API_KEY:
        contentEl.createEl('p', {
          text: '🔑 Please check your API key in settings.'
        });
        break;
      case ErrorCode.RATE_LIMIT_EXCEEDED:
        contentEl.createEl('p', {
          text: '⏱️ Rate limit reached. Wait a few minutes or use another provider.'
        });
        break;
      case ErrorCode.TIMEOUT:
        contentEl.createEl('p', {
          text: '⏰ Request timed out. Try reducing the number of questions.'
        });
        break;
    }

    new Setting(contentEl)
      .addButton(btn => btn
        .setButtonText('Open Settings')
        .onClick(() => {
          this.close();
          // Open plugin settings
        })
      )
      .addButton(btn => btn
        .setButtonText('Close')
        .onClick(() => this.close())
      );
  }
}
```

**Monitoring Circuit Breakers**

```typescript
// Add to status bar or settings
this.addCommand({
  id: 'show-provider-status',
  name: 'Show AI Provider Status',
  callback: () => {
    const status = this.orchestrator.getCircuitBreakerStatus();

    const statusModal = new Modal(this.app);
    statusModal.titleEl.setText('🔌 Provider Status');

    for (const [provider, state] of status) {
      const stateIcon = {
        'closed': '✅',
        'open': '❌',
        'half-open': '⚠️'
      }[state.state];

      statusModal.contentEl.createDiv({
        text: `${stateIcon} ${provider}: ${state.state} (${state.failures} failures)`
      });
    }

    statusModal.open();
  }
});
```

---

## 🧪 Gap 4: Testing Infrastructure

### Problem
- No tests
- Hard to verify functionality
- No regression detection

### Solution: Vitest + Comprehensive Test Suite

#### Test Structure

```
src/tests/
├── setup.ts                         # Test configuration
├── CredentialManager.test.ts        # Security tests
├── AIProviderOrchestrator.test.ts   # Orchestration tests
├── providers/
│   ├── OllamaProvider.test.ts
│   └── OpenAIProvider.test.ts
└── integration/
    └── quiz-generation.test.ts
```

#### Running Tests

```bash
# Run all tests
npm test

# Watch mode
npm test -- --watch

# With UI
npm run test:ui

# Coverage report
npm run test:coverage
```

#### Example Test

```typescript
describe('Quiz Generation Integration', () => {
  it('should generate quiz with fallback', async () => {
    const orchestrator = new AIProviderOrchestrator();

    const failingProvider = createMockProvider('provider1', false);
    const successProvider = createMockProvider('provider2', true);

    orchestrator.registerProvider(failingProvider);
    orchestrator.registerProvider(successProvider);

    const result = await orchestrator.generateQuizWithFallback(
      ['test content'],
      mockOptions
    );

    expect(result.success).toBe(true);
    expect(result.provider).toBe('provider2');
  });
});
```

---

## 📊 Summary: Before & After

### Before (v1.0)

| Aspect | Status |
|--------|--------|
| **Security** | ❌ Plaintext API keys |
| **Architecture** | ❌ Bundled code only |
| **Resilience** | ❌ Basic error handling |
| **Testing** | ❌ No tests |

### After (v2.0)

| Aspect | Status |
|--------|--------|
| **Security** | ✅ AES-256-GCM encrypted keys |
| **Architecture** | ✅ TypeScript source + abstraction layers |
| **Resilience** | ✅ Fallback + retry + circuit breaker |
| **Testing** | ✅ Comprehensive test suite |

---

## 🚀 Getting Started

### For New Development

```bash
# 1. Install dependencies
npm install

# 2. Start development server
npm run dev

# 3. Make changes in src/

# 4. Run tests
npm test

# 5. Build for production
npm run build
```

### For Migration from v1.0

```bash
# 1. Back up existing data.json
cp data.json data.json.backup

# 2. Install v2.0

# 3. Plugin will auto-detect insecure keys

# 4. Follow migration prompt

# 5. Verify all providers work

# 6. Delete backup once confirmed
```

---

## 📚 Additional Resources

- [SECURITY.md](./SECURITY.md) - Detailed security documentation
- [API.md](./API.md) - Provider API reference
- [CONTRIBUTING.md](./CONTRIBUTING.md) - Development guidelines
