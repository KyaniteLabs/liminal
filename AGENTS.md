# AGENTS.md - Liminal Meta-Harness

**Last Updated:** 2026-04-01

---

## Overview

Liminal is a creative coding agent with a **Meta-Harness** - a self-improving outer loop that fixes the system itself. The harness observes failures, detects patterns, and applies targeted fixes.

### Architecture Philosophy

```
┌─────────────────────────────────────────────────────────────┐
│                         HARNESS                              │
│  (Self-improving, observability, pattern detection)         │
│                                                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐  │
│  │ FailureLogger│◄───│ PatternDet  │◄───│   Evaluators    │  │
│  └─────────────┘    └─────────────┘    └─────────────────┘  │
│         │                                               ▲   │
│         ▼                                               │   │
│  ┌─────────────┐    ┌─────────────┐                     │   │
│  │ HarnessAgent│───►│  LLMClient  │─────────────────────┘   │
│  │ (7 tools)   │    └─────────────┘                         │
│  └─────────────┘                                            │
└────────────────────────────────────┬────────────────────────┘
                                     │ Reports failures
                                     ▼
┌─────────────────────────────────────────────────────────────┐
│                      GENERATORS (DUMB)                       │
│  (No self-improvement - just generate code)                 │
│                                                              │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────────────┐ │
│  │ P5 LLM  │  │ Shader  │  │  Three  │  │   Tone/Hydra    │ │
│  └─────────┘  └─────────┘  └─────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

**Key Principle:** Only the harness improves. Generators are dumb and stateless.

---

## Quick Start

### Run the Harness TUI

```bash
npm run tui
```

### TUI Commands

```
/help                Show available commands
/status              Check harness status and providers
/tasks               List pending tasks
/run <task-id>       Execute a task (e.g., /run M1)
/preview <file>      Preview file (auto-routes terminal/browser)
/play <audio>        Play audio file
/stop                Stop audio playback
/browser             Reopen last browser preview
/clear               Clear screen
/exit                Exit TUI
```

### Execute a Task

```bash
# In TUI:
/run M1    # Fix Tone.js validation gate
/run M4    # Fix thinking regex greedy match
/run M6    # Fix console.log in FailureLogger
/run M7    # Fix console.log in PatternDetector
/run M8    # Fix console.log in HarnessUpdater
```

---

## Meta-Harness Components

### 1. FailureLogger
Logs generation failures with metadata for pattern analysis.

**Location:** `src/harness/FailureLogger.ts`

### 2. PatternDetector
Analyzes failures to detect known error patterns.

**Location:** `src/harness/PatternDetector.ts`

### 3. HarnessUpdater
Applies adaptations based on detected patterns.

**Location:** `src/harness/HarnessUpdater.ts`

### 4. HarnessAgent
Executes tasks using 7 tools with rollback capability.

**Location:** `src/harness/agent/HarnessAgent.ts`

**Tools:**
- `readFile` - Read file contents
- `writeFile` - Write entire file
- `applyEdit` - Targeted string replacement (preferred)
- `runBuild` - Run `npm run build`
- `runTests` - Run test suite
- `createBackup` - Create file backup
- `restoreBackup` - Restore from backup

### 5. ValidationGuard
Safety checks before applying changes.

**Location:** `src/harness/tools/ValidationGuard.ts`

**Checks:**
- Path validation (only src/, test/, docs/, scripts/)
- File size limits (max 1000 lines)
- Change size limits (max 50 lines per edit)
- Forbidden patterns (no eval, new Function, child_process)

### 6. RateLimiter
Prevents API abuse.

**Location:** `src/harness/tools/RateLimiter.ts`

**Limits:**
- LLM calls: 5 per minute
- File writes: 10 per minute
- Build runs: 12 per minute

---

## Task System

### Task Format

Tasks are JSON files in `harness-tasks/`:

```json
{
  "id": "M1",
  "title": "Fix Tone.js Validation Gate",
  "description": "Tone.js validation only fires on domain 'unknown'",
  "targetFile": "src/core/CodeValidator.ts",
  "search": "const toneJSErrors = detectedDomain === 'unknown' && /Tone\\./.test(cleaned)",
  "replace": "const toneJSErrors = (detectedDomain === 'music' || detectedDomain === 'unknown') && /Tone\\./.test(cleaned)",
  "verifyCommand": "npm run build",
  "risk": "low",
  "complexity": "low",
  "files": 1,
  "approved": true
}
```

### Creating New Tasks

1. Create JSON file in `harness-tasks/`
2. Set `approved: false` initially
3. Test with `/run <id>` in TUI
4. Set `approved: true` when ready

### Task Execution Flow

```
1. Read target file
2. Apply edit (search/replace)
3. Run build to verify
4. Run verifyCommand if provided
5. Success → Done
6. Failure → Rollback → Report
```

---

## Multi-Provider Support

The harness can use different LLM providers:

### Supported Providers

| Provider | Config | Use Case |
|----------|--------|----------|
| LM Studio | Local | Default, fast |
| Ollama | Local | Open source models |
| MiniMax | Cloud | High quality |
| OpenRouter | Cloud | Model variety |
| GLM | Cloud | Chinese models |

### Configuration

```bash
# Environment variables
LIMINAL_LLM_PROVIDER=lmstudio
LIMINAL_LLM_BASE_URL=http://localhost:1234/v1
LIMINAL_LLM_MODEL=qwen2.5-coder-7b-instruct
LIMINAL_LLM_API_KEY=optional

# Harness-specific (low temp for code fixes)
LIMINAL_HARNESS_TEMPERATURE=0.2
LIMINAL_HARNESS_MAX_TOKENS=4096
```

---

## Design Rule: No Template Fallbacks

All generators route through the LLM. Template fallbacks are not used because they mask real problems. If the LLM fails, the correct fix is to improve the harness, routing, or validation — not to fall back to static code.

| Problem | Solution |
|---------|----------|
| LLM not configured | Throw error, require configuration |
| LLM returns empty | Throw error, log the issue |
| LLM call fails | Throw error, fix the harness |
| Timeout | Increase timeout or mark as slow |
| Invalid output | Fix validation, not the generator |

---

## Safety Rules

### File Access
- Only modify files in: `src/`, `test/`, `docs/`, `scripts/`
- Never use absolute paths
- No path traversal (`..` not allowed)

### Code Changes
- Max 50 lines changed per edit
- Max 1000 lines per file
- No `eval()` or `new Function()`
- No `child_process`

### Verification
- Build must pass after changes
- Tests must pass if provided
- Auto-rollback on failure

---

## Available Tasks

Tasks are defined in `harness-tasks/*.json`. Use the TUI or CLI to view and run them:

```bash
liminal tui       # Launch TUI, type "tasks"
liminal tui       # Then "run M6" to execute a task
```

---

## Debugging

### Check Harness Status
```bash
npm run tui
/status
```

### View Recent Failures
```bash
cat logs/failures-*.jsonl | tail -20
```

### Test Pattern Detection
```typescript
import { patternDetector } from './src/harness/index.js';

const patterns = patternDetector.analyze(failureRecord);
console.log(patterns);
```

### Run Single Task
```bash
# In TUI
/run M1
```

---

## Integration Points

### RalphLoop → Harness
- RalphLoop reports each iteration result to harness
- Validation failures are logged
- Final result is reported

### E2E Tests → Harness
- E2E tests report results to harness
- Failures are logged for pattern detection

### Harness → Generators
- Harness does NOT modify generators directly
- Harness fixes validation, prompts, routing
- Generators remain dumb and stateless

---

## File Structure

```
src/harness/
├── index.ts                    # Exports
├── MetaHarnessIntegration.ts   # Main coordinator
├── FailureLogger.ts            # Failure logging
├── PatternDetector.ts          # Pattern detection
├── HarnessUpdater.ts           # Adaptation application
├── MultiProviderConfig.ts      # Provider configuration
├── agent/
│   ├── HarnessAgent.ts         # Task execution agent
│   └── index.ts
├── tools/
│   ├── ReadFileTool.ts
│   ├── WriteFileTool.ts
│   ├── ApplyEditTool.ts
│   ├── RunBuildTool.ts
│   ├── RunTestsTool.ts
│   ├── BackupTools.ts
│   ├── RateLimiter.ts
│   └── ValidationGuard.ts
└── prompts/
    └── self-improve.ts         # System prompt

harness-tasks/
├── M1.json                     # Tone.js fix
├── M4.json                     # Regex fix
├── M6.json                     # Logger fix (FailureLogger)
├── M7.json                     # Logger fix (PatternDetector)
└── M8.json                     # Logger fix (HarnessUpdater)
```

---

## References

- See `README.md` for project overview
- See `DOGFOOD_QUEUES.md` for test procedures
- See `src/harness/prompts/self-improve.ts` for system prompt
- See `plan.md` for implementation plan
