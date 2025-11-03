# 🧪 QuizDex Testing Guide

## Quick Start

```bash
# Run all tests
npm test

# Run tests in watch mode (auto-rerun on file changes)
npm test -- --watch

# Run with coverage report
npm run test:coverage

# Run tests with interactive UI
npm run test:ui
```

## Test Organization

```
src/tests/
├── setup.ts                                    # Global test setup
├── CredentialManager.test.ts                   # Security & encryption
├── AIProviderOrchestrator.test.ts              # AI orchestration
├── OllamaProvider.test.ts                      # Ollama integration
├── StorageService.test.ts                      # Vault storage
├── ProviderFactory.test.ts                     # Provider management
├── integration/
│   └── QuizGeneration.integration.test.ts      # E2E quiz generation
└── utils/
    └── pokemon.test.ts                         # Pokemon utilities
```

## Test Coverage

- **7 test files** with **150+ test cases**
- **~75-80% coverage** of critical paths
- **Zero production code changes** required

See [TEST_COVERAGE_REPORT.md](./TEST_COVERAGE_REPORT.md) for detailed coverage breakdown.

## Running Specific Tests

### Run single test file
```bash
npm test OllamaProvider.test.ts
```

### Run tests matching pattern
```bash
npm test -- --grep "quiz generation"
```

### Run only integration tests
```bash
npm test -- integration
```

### Run only unit tests
```bash
npm test -- --exclude integration
```

## Viewing Coverage

### Generate HTML coverage report
```bash
npm run test:coverage
```

Coverage report will be in `coverage/index.html`. Open in browser:
```bash
# Linux
xdg-open coverage/index.html

# macOS
open coverage/index.html

# Windows
start coverage/index.html
```

### Coverage breakdown
```bash
npm test -- --coverage --reporter=json
```

## Test Output Formats

### Verbose output
```bash
npm test -- --reporter=verbose
```

### JSON output (for CI/CD)
```bash
npm test -- --reporter=json > test-results.json
```

### JUnit XML (for Jenkins/GitLab CI)
```bash
npm test -- --reporter=junit > junit.xml
```

## Debugging Tests

### Run tests in debug mode
```bash
npm test -- --inspect-brk
```

Then attach debugger in VS Code or Chrome DevTools.

### Log output during tests
Tests use `console.log` for debugging. Run with:
```bash
npm test -- --reporter=verbose
```

### Run single test with debugging
```typescript
it.only('should do something', () => {
  // This test will run in isolation
});
```

## Writing New Tests

### Test file structure
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('ComponentName', () => {
  beforeEach(() => {
    // Reset state before each test
    vi.clearAllMocks();
  });

  describe('Feature Group', () => {
    it('should do something specific', () => {
      // Arrange
      const input = 'test';

      // Act
      const result = functionUnderTest(input);

      // Assert
      expect(result).toBe('expected');
    });
  });
});
```

### Mocking Obsidian APIs
```typescript
import { requestUrl } from 'obsidian';

vi.mock('obsidian', () => ({
  requestUrl: vi.fn(),
  Notice: vi.fn()
}));

// In test
vi.mocked(requestUrl).mockResolvedValueOnce({
  status: 200,
  json: { data: 'mock' }
});
```

### Testing async functions
```typescript
it('should handle async operations', async () => {
  const result = await asyncFunction();
  expect(result).toBeDefined();
});
```

### Testing error cases
```typescript
it('should throw on invalid input', () => {
  expect(() => {
    functionThatThrows();
  }).toThrow('Expected error message');
});

it('should handle async errors', async () => {
  await expect(asyncFunctionThatFails()).rejects.toThrow();
});
```

## CI/CD Integration

### GitHub Actions
```yaml
name: Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm test
      - run: npm run test:coverage
      - uses: codecov/codecov-action@v3
```

### GitLab CI
```yaml
test:
  image: node:20
  script:
    - npm ci
    - npm test -- --reporter=junit --outputFile=junit.xml
    - npm run test:coverage
  artifacts:
    reports:
      junit: junit.xml
      coverage_report:
        coverage_format: cobertura
        path: coverage/cobertura-coverage.xml
```

## Troubleshooting

### Tests fail with "crypto is undefined"
The test setup should handle this, but if it fails:
```typescript
// In setup.ts
import { webcrypto } from 'crypto';
global.crypto = webcrypto as any;
```

### Tests timeout
Increase timeout:
```typescript
it('slow test', async () => {
  // test code
}, 10000); // 10 second timeout
```

Or in config:
```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    testTimeout: 10000
  }
});
```

### Mock not working
Ensure mocks are cleared between tests:
```typescript
beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});
```

### Coverage not accurate
Exclude test files and config from coverage:
```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      exclude: [
        'node_modules/',
        'src/tests/',
        '*.config.*'
      ]
    }
  }
});
```

## Best Practices

### ✅ DO
- Write tests for new features before implementing (TDD)
- Keep tests fast (< 5 seconds total)
- Use descriptive test names (`it('should X when Y')`)
- Test edge cases and error paths
- Mock external dependencies (APIs, file system)
- Clean up mocks between tests

### ❌ DON'T
- Modify production code to make tests easier
- Test implementation details (test behavior, not internals)
- Share state between tests
- Use real APIs or file system in unit tests
- Ignore failing tests (fix or remove them)
- Write overly complex test helpers

## Test Metrics

### Current Status
- **Total Tests**: 150+
- **Pass Rate**: 100% (target)
- **Coverage**: ~75-80%
- **Execution Time**: < 10 seconds

### Quality Gates
- All tests must pass before merge
- No decrease in coverage percentage
- New features must include tests
- Critical bugs must have regression tests

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [Test Coverage Report](./TEST_COVERAGE_REPORT.md)
- [Obsidian Plugin API](https://docs.obsidian.md/Reference/TypeScript+API)

---

**Happy Testing! 🧪**
