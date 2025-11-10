# Security Implementation Guide for QuizDex

## 🔐 Overview

QuizDex v2.0 introduces **military-grade encryption** for API key storage, addressing the critical security vulnerability in v1.0 where keys were stored in plaintext.

## Critical Changes from v1.0

### ❌ Before (v1.0 - INSECURE)
```json
// data.json - PLAINTEXT API KEYS
{
  "openAIApiKey": "sk-proj-abc123...",
  "anthropicApiKey": "sk-ant-xyz789...",
  "googleApiKey": "AIzaSy..."
}
```

**Risk**: Anyone with filesystem access can steal API keys

### ✅ After (v2.0 - SECURE)
```json
// data.json - ENCRYPTED API KEYS
{
  "encrypted_credentials": {
    "version": 1,
    "keyHash": "a7f3b9c2...",
    "credentials": [
      {
        "provider": "openai",
        "encryptedKey": "xJ9pL2mK...",
        "iv": "r4T6u8Y1...",
        "salt": "q3W5e7R9...",
        "iterations": 100000,
        "timestamp": 1735574400000
      }
    ]
  }
}
```

**Protection**: AES-256-GCM encryption with unique IVs, PBKDF2 key derivation

---

## 🛡️ Security Features

### 1. AES-256-GCM Encryption
- **Algorithm**: AES-256-GCM (Galois/Counter Mode)
- **Key Size**: 256 bits
- **Authentication**: Built-in authenticated encryption
- **IV**: Unique 96-bit initialization vector per credential

### 2. PBKDF2 Key Derivation
- **Function**: PBKDF2 with SHA-256
- **Iterations**: 100,000 (OWASP recommended)
- **Salt**: Unique 128-bit random salt per credential
- **Purpose**: Derive encryption key from user passphrase

### 3. Memory Safety
- **Cache TTL**: 15-minute memory cache for decrypted keys
- **Auto-clear**: Sensitive data cleared on plugin unload
- **No logging**: API keys never written to console logs

### 4. Passphrase Protection
- **Storage**: Only hash stored (SHA-256), never plaintext
- **Verification**: Passphrase verified against hash before decryption
- **No recovery**: Forgotten passphrase = permanent key loss

---

## 📋 Implementation Guide

### Step 1: Initialize Credential Manager

```typescript
import { CredentialManager } from './security/CredentialManager';

class QuizGeneratorPlugin extends Plugin {
  credentialManager: CredentialManager;

  async onload() {
    this.credentialManager = new CredentialManager(this);

    // Prompt user for passphrase on first run
    const passphrase = await this.promptForPassphrase();
    await this.credentialManager.initialize(passphrase);
  }
}
```

### Step 2: Store API Keys Securely

```typescript
// In settings tab
async saveApiKey(provider: string, apiKey: string) {
  const passphrase = await this.promptForPassphrase();

  const success = await this.credentialManager.setCredential(
    provider,
    apiKey,
    passphrase
  );

  if (success) {
    new Notice(`✅ ${provider} API key encrypted and saved`);
  }
}
```

### Step 3: Retrieve API Keys

```typescript
// When generating quiz
async generateQuiz() {
  const provider = this.settings.provider; // 'openai', 'anthropic', etc.

  const apiKey = await this.credentialManager.getCredential(provider);

  if (!apiKey) {
    new Notice(`❌ No API key found for ${provider}`);
    return;
  }

  // Use apiKey for API call
  // Key is cached in memory for 15 minutes
}
```

### Step 4: Migrate Existing Users

```typescript
async migrateToEncrypted() {
  // Load existing plaintext settings
  const oldSettings = await this.loadData();

  // Prompt for new passphrase
  const passphrase = await this.promptForPassphrase(true);

  // Migrate
  const success = await this.credentialManager.migrateToEncrypted(
    passphrase,
    oldSettings
  );

  if (success) {
    // Clear plaintext keys from settings
    delete oldSettings.openAIApiKey;
    delete oldSettings.anthropicApiKey;
    // ... delete other keys

    await this.saveData(oldSettings);

    new Notice('✅ Migration complete! Your API keys are now encrypted.');
  }
}
```

---

## 🔍 Security Audit

Run security audit to check for insecure keys:

```typescript
const audit = await this.credentialManager.auditSecurity();

console.log(`Secure keys: ${audit.secure}`);
console.log(`Insecure keys: ${audit.insecure}`);
console.log(`Providers: ${audit.providers.join(', ')}`);

if (audit.insecure > 0) {
  new Notice(
    `⚠️ Warning: ${audit.insecure} API keys in plaintext. ` +
    `Migrate to encrypted storage in settings.`,
    10000
  );
}
```

---

## 🚨 Security Warnings

### User Notifications

The system automatically warns users about security issues:

1. **Open Mode Warning** (no passphrase)
   ```
   ⚠️ WARNING: API keys stored in PLAINTEXT.
   Enable encryption in settings!
   ```

2. **Insecure Keys Detected**
   ```
   ⚠️ Found 3 unencrypted API keys.
   Migrate to secure storage in plugin settings.
   ```

3. **Wrong Passphrase**
   ```
   ❌ Invalid passphrase
   ```

### Migration Prompts

Show migration dialog on plugin load if insecure keys detected:

```typescript
async onload() {
  await this.loadSettings();

  const audit = await this.credentialManager.auditSecurity();

  if (audit.insecure > 0) {
    new MigrationModal(this.app, async (passphrase) => {
      await this.migrateToEncrypted(passphrase);
    }).open();
  }
}
```

---

## 🔒 Best Practices

### For Plugin Developers

1. **Never log API keys**
   ```typescript
   // ❌ BAD
   console.log('API Key:', apiKey);

   // ✅ GOOD
   console.log('API Key length:', apiKey?.length || 0);
   ```

2. **Clear sensitive data**
   ```typescript
   onunload() {
     this.credentialManager.destroy();
   }
   ```

3. **Use memory cache wisely**
   ```typescript
   // Keys cached for 15 minutes
   // No need to decrypt on every request
   const key = await credManager.getCredential('openai');
   ```

4. **Handle passphrase errors gracefully**
   ```typescript
   const initialized = await credManager.initialize(passphrase);
   if (!initialized) {
     // Show error, don't proceed
     return;
   }
   ```

### For End Users

1. **Use a strong passphrase**
   - Minimum 12 characters
   - Mix letters, numbers, symbols
   - Don't reuse vault password

2. **Back up your passphrase**
   - Store in password manager
   - Write on paper, store securely
   - No passphrase = no key recovery

3. **Migrate immediately**
   - Don't delay migration from v1.0
   - Old plaintext keys still accessible

4. **Regular security audits**
   - Check settings for warnings
   - Rotate API keys periodically

---

## 🔧 Troubleshooting

### "Invalid passphrase" error

**Cause**: Trying to decrypt with wrong passphrase

**Solution**:
- Use the same passphrase you set initially
- If forgotten, must clear credentials and re-enter keys

### "No encryption key available" error

**Cause**: CredentialManager not initialized

**Solution**:
```typescript
await credentialManager.initialize(passphrase);
```

### Migration fails

**Cause**: Corrupted settings or permission issues

**Solution**:
1. Back up `data.json`
2. Clear all credentials: `credManager.clearAll()`
3. Re-enter API keys manually

### Keys not persisting

**Cause**: Plugin not saving data properly

**Solution**:
```typescript
// Ensure data is saved
await this.credentialManager.setCredential(provider, key, passphrase);
// Check storage
const stored = await this.loadData();
console.log('Stored credentials:', stored.encrypted_credentials);
```

---

## 📊 Performance Impact

| Operation | Time | Notes |
|-----------|------|-------|
| First decrypt | ~100-200ms | PBKDF2 key derivation |
| Cached decrypt | <1ms | Memory cache hit |
| Encrypt new key | ~100-200ms | One-time cost |
| Initialize | ~50-100ms | Passphrase verification |

**Recommendation**: Keys cached in memory for 15 minutes, minimal impact on quiz generation.

---

## 🔐 Encryption Technical Details

### Key Derivation Flow

```
User Passphrase
    ↓
PBKDF2 (100,000 iterations, SHA-256)
    ↓
Master Key (256-bit AES-GCM key)
    ↓
Encrypt API Key
    ↓
Store: {encryptedKey, iv, salt}
```

### Decryption Flow

```
User Passphrase
    ↓
Verify against stored hash
    ↓
Derive Master Key (using stored salt)
    ↓
Decrypt API Key (using stored iv)
    ↓
Cache in memory (15 min TTL)
```

### Security Properties

- ✅ **Forward Secrecy**: Unique IV per encryption
- ✅ **Authentication**: AES-GCM provides AEAD
- ✅ **Key Stretching**: PBKDF2 slows brute-force
- ✅ **Salt**: Prevents rainbow table attacks
- ✅ **No Key Storage**: Master key derived, not stored

---

## 🎯 Compliance

This implementation follows:

- **OWASP Cryptographic Storage Cheat Sheet**
- **NIST SP 800-132** (PBKDF2 recommendations)
- **CWE-327** (Use of broken crypto) - Mitigation
- **CWE-798** (Hard-coded credentials) - Mitigation

---

## 📝 Changelog

### v2.0.0 - Security Overhaul
- ✅ AES-256-GCM encryption for API keys
- ✅ PBKDF2 key derivation from passphrase
- ✅ Memory-safe credential caching
- ✅ Migration tool from v1.0 plaintext
- ✅ Security audit functionality
- ✅ Comprehensive error handling

### v1.0.0 - Initial Release
- ❌ Plaintext API key storage (INSECURE)

---

## 🆘 Support

If you discover a security vulnerability, please report it to:
- **Email**: security@quizdex.example (replace with actual)
- **GitHub Security Advisory**: (private disclosure)

**Please do NOT open public issues for security vulnerabilities.**
