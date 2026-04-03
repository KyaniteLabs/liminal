# Test Configuration Hygiene Analysis

## Summary
- **41 deletions** of env vars
- **63 assignments** to env vars
- **33 without restoration** (14 deletions + 19 assignments)
- **Proper isolation examples:** 6 files

## Classification

### HIGH RISK: No Restoration (Scripts)
**Scripts (affect user's shell after run):**
| Script | Line | Action | Impact |
|--------|------|--------|--------|
| run-agent-a.ts | 125 | assign LIMINAL_LLM_BASE_URL | User's env modified |
| run-agent-a.ts | 127 | delete LIMINAL_LLM_BASE_URL | User's env modified |
| run-agent-a.ts | 129 | assign LIMINAL_LLM_MODEL | User's env modified |
| run-agent-b.ts | 120 | assign LIMINAL_LLM_BASE_URL | User's env modified |
| run-agent-b.ts | 121 | assign LIMINAL_LLM_API_KEY | User's env modified |
| run-agent-b.ts | 123 | assign LIMINAL_LLM_BASE_URL | User's env modified |
| run-agent-b.ts | 124 | delete LIMINAL_LLM_API_KEY | User's env modified |
| run-agent-b.ts | 126 | assign LIMINAL_LLM_MODEL | User's env modified |
| run-agent-b-batched.ts | 81 | assign LIMINAL_LLM_BASE_URL | User's env modified |
| run-agent-b-batched.ts | 82 | assign LIMINAL_LLM_MODEL | User's env modified |
| run-agent-b-batched.ts | 83 | delete LIMINAL_LLM_API_KEY | User's env modified |
| run-single-test.ts | 61 | assign LIMINAL_LLM_BASE_URL | User's env modified |
| run-single-test.ts | 63 | delete LIMINAL_LLM_BASE_URL | User's env modified |
| run-single-test.ts | 65 | assign LIMINAL_LLM_MODEL | User's env modified |
| run-agent-b-quick.ts | 57 | assign LIMINAL_LLM_BASE_URL | User's env modified |
| run-agent-b-quick.ts | 58 | assign LIMINAL_LLM_MODEL | User's env modified |
| run-agent-b-quick.ts | 59 | delete LIMINAL_LLM_API_KEY | User's env modified |
| agent-b-test-runner.ts | 43 | assign LIMINAL_LLM_BASE_URL | User's env modified |
| agent-b-test-runner.ts | 44 | assign LIMINAL_LLM_MODEL | User's env modified |
| agent-b-batch.ts | 56 | assign LIMINAL_LLM_BASE_URL | User's env modified |
| agent-b-batch.ts | 57 | assign LIMINAL_LLM_MODEL | User's env modified |
| run-local-only.ts | 83 | assign LIMINAL_LLM_BASE_URL | User's env modified |
| run-local-only.ts | 84 | assign LIMINAL_LLM_MODEL | User's env modified |
| generate-single.ts | 151 | assign LIMINAL_LLM_BASE_URL | User's env modified |
| generate-single.ts | 152 | assign LIMINAL_LLM_API_KEY | User's env modified |
| generate-single.ts | 153 | assign LIMINAL_LLM_MODEL | User's env modified |

**Impact:** Running these scripts pollutes the user's shell environment persistently. These are CLI entry points that run in the user's shell context.

### MEDIUM RISK: Test Cross-Pollution
**Tests without proper restoration:**
| Test File | Pattern | Risk |
|-----------|---------|------|
| e2e/models/minimax-m2-5.test.ts | beforeAll sets, no afterAll | Subsequent tests see modified env |
| e2e/models/qwen3-5-9b.test.ts | beforeAll sets, no afterAll | Subsequent tests see modified env |
| e2e/models/qwen3-coder-40b.test.ts | beforeAll sets, no afterAll | Subsequent tests see modified env |
| e2e/models/minimax-m2-7-highspeed.test.ts | beforeAll sets, no afterAll | Subsequent tests see modified env |
| e2e/models/minimax-m2-7.test.ts | beforeAll sets, no afterAll | Subsequent tests see modified env |
| e2e/model-comparison.test.ts | Sets env in test loop (lines 119-122) | Each test affects next |
| unit/ralph-loop.test.ts | Clears API keys in beforeEach (596-597) | No restoration, affects subsequent tests |

**Impact:** Test order becomes significant; flaky tests likely. Test isolation is compromised.

### LOW RISK: Intentional but Unclear
| Test File | Pattern | Risk |
|-----------|---------|------|
| integration/gui-config-api.test.js | Deletes ATELIER_* vars in beforeAll (31-34) | Comment says intentional but no explicit restore |

**Impact:** Low immediate risk but unclear intent makes maintenance difficult.

### GOOD EXAMPLES: Proper Isolation
| File | Pattern | Why It Works |
|------|---------|--------------|
| test/setup.ts | Backup/restore in beforeAll/afterAll | Clean state guaranteed, clears 9 LLM env vars |
| e2e/full-loop-local.test.ts | `backupEnv()`/`restoreEnv()` functions | Explicit, readable, per-test isolation |
| e2e/full-loop-cloud.test.ts | `backupEnv()`/`restoreEnv()` functions | Explicit, readable, per-test isolation |
| integration/dual-llm.test.ts | `backupEnv()`/`restoreEnv()` functions | Handles both cloud and local provider configs |
| security/sandbox-config.test.ts | Full env replacement (`process.env = originalEnv`) | Complete isolation, simple pattern |
| security/url-validator.test.ts | Full env replacement (`process.env = originalEnv`) | Complete isolation, simple pattern |

## April 2026 Best Practices Gap

| Practice | Current State | Gap |
|----------|---------------|-----|
| Env isolation helpers | 3 different patterns (backup/restore, full replacement, manual cleanup) | Need single standard |
| Automatic restoration | Manual in most tests | Should be framework-level |
| Parallel test safety | Unknown | Env changes not thread-safe |
| Test environment docs | None | Need "Testing with Config" guide |
| Script isolation | No pattern used | Scripts affect user's shell |

## Recommended Fix: withEnv() Helper

```typescript
// test/helpers/env.ts
export async function withEnv<T>(
  envVars: Record<string, string | undefined>,
  fn: () => Promise<T>
): Promise<T> {
  const original: Record<string, string | undefined> = {};
  
  // Backup original values
  for (const key of Object.keys(envVars)) {
    original[key] = process.env[key];
  }
  
  // Set new values
  for (const [key, value] of Object.entries(envVars)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  
  try {
    return await fn();
  } finally {
    // Restore original values
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

// For scripts - wrap entire execution
export function runWithEnv<T>(
  envVars: Record<string, string | undefined>,
  fn: () => T
): T {
  const original = { ...process.env };
  
  for (const [key, value] of Object.entries(envVars)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  
  try {
    return fn();
  } finally {
    Object.keys(process.env).forEach(key => delete process.env[key]);
    Object.assign(process.env, original);
  }
}

// Usage in tests:
test('uses custom model', async () => {
  await withEnv({ LIMINAL_LLM_MODEL: 'gpt-4' }, async () => {
    // Test code here
    // Env automatically restored after
  });
});

// Usage in scripts:
runWithEnv({ LIMINAL_LLM_MODEL: 'llama3.2' }, () => {
  // Script logic here
  // Env automatically restored after
});
```

## Alternative: Subprocess Isolation for Scripts

For scripts that don't need to run in the user's shell:

```typescript
// scripts/lib/run-isolated.ts
import { spawn } from 'child_process';

export async function runIsolated(
  scriptPath: string,
  envVars: Record<string, string>
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('tsx', [scriptPath], {
      env: { ...process.env, ...envVars },
      stdio: 'inherit'
    });
    
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Script exited with code ${code}`));
    });
  });
}

// Usage: env vars are only in subprocess, never pollute parent
await runIsolated('./actual-script.ts', { LIMINAL_LLM_MODEL: 'llama3.2' });
```

## Migration Strategy

### Phase 1: Create Helper (High Priority)
- Create `test/helpers/env.ts`
- Export `withEnv()` function for tests
- Export `runWithEnv()` function for scripts
- Add to `test/setup.ts` global

### Phase 2: Fix Scripts (High Priority)
- Wrap all 10 scripts with `runWithEnv()` or use subprocess isolation
- Priority: `run-agent-a.ts`, `run-agent-b.ts`, `generate-single.ts`
- Alternative: Use `try/finally` blocks for simple scripts

### Phase 3: Fix Tests (Medium Priority)
- Add `afterAll` restoration to 5 E2E model test files
- Fix `model-comparison.test.ts` - backup before loop, restore after
- Fix `ralph-loop.test.ts` - add `afterEach` restoration
- Refactor to use `withEnv()` where appropriate

### Phase 4: Add Enforcement
- ESLint rule: no direct `process.env` assignment in tests
- Require `withEnv()` or proper lifecycle hooks
- Add pre-commit hook to check for env manipulation without restoration

## Files to Modify (Wave 3)

### Create
- `test/helpers/env.ts` - New helper module

### Update Scripts (10 files)
- `scripts/run-agent-a.ts`
- `scripts/run-agent-b.ts`
- `scripts/run-agent-b-quick.ts`
- `scripts/run-agent-b-batched.ts`
- `scripts/run-single-test.ts`
- `scripts/agent-b-test-runner.ts`
- `scripts/agent-b-batch.ts`
- `scripts/run-local-only.ts`
- `scripts/generate-single.ts`

### Update Tests (7 files)
- `test/e2e/models/minimax-m2-5.test.ts`
- `test/e2e/models/qwen3-5-9b.test.ts`
- `test/e2e/models/qwen3-coder-40b.test.ts`
- `test/e2e/models/minimax-m2-7-highspeed.test.ts`
- `test/e2e/models/minimax-m2-7.test.ts`
- `test/e2e/model-comparison.test.ts`
- `test/unit/ralph-loop.test.ts`

### Optional
- `test/integration/gui-config-api.test.js` - Add explicit restoration for clarity

## Statistics Summary

| Metric | Count |
|--------|-------|
| Total env deletions | 41 |
| Total env assignments | 63 |
| Deletions with restoration | 18 |
| Deletions without restoration | 14 |
| Assignments with restoration | 30 |
| Assignments without restoration | 19 |
| Files with proper isolation | 6 |
| Files with missing restoration | 17 |
| Scripts requiring fixes | 10 |
| Test files requiring fixes | 7 |

## Risk Matrix

| Risk Level | Count | Description |
|------------|-------|-------------|
| HIGH | 24 | Scripts modifying env without restoration |
| MEDIUM | 11 | Tests with cross-pollution risk |
| LOW | 4 | Intentional but unclear patterns |
| GOOD | 48 | Properly isolated patterns |
