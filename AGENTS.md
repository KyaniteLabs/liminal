# AGENTS.md - Liminal Meta-Harness

**Last Updated:** 2026-04-03

**Cross-agent rules:** See `~/.agents/rules/UNIVERSAL.md` for the 10 golden principles shared across all agents.

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

### Generate Dogfood Report

```bash
npm run dogfood:report
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
/run M2    # Fix GLSL shader validation
/run M3    # Fix Three.js domain routing
/run M4    # Fix thinking regex greedy match
/run M5    # Fix console.log in FailureLogger
/run M6    # Fix console.log in PatternDetector
/run M7    # Fix console.log in HarnessUpdater
/run M8    # Fix console.log in HarnessUpdater
```

---

## Development Workflow (Worktree Isolation Required)

**Rule:** All feature work MUST be done in isolated git worktrees. No exceptions.

### Why Worktrees?

- **Multi-Agent Safety:** Each agent has isolated workspace, no conflicts
- **Parallel Development:** Work on multiple branches simultaneously
- **Build Isolation:** `node_modules/`, build artifacts don't collide
- **Fast Context Switch:** `cd` between worktrees vs `git stash && checkout`

### Quick Commands

```bash
# Create and switch to new worktree
git wt feature-name

# Or use the worktree manager
git-worktree-manager create feature-name

# List all worktrees
git wtl
# or
git-worktree-manager list

# Clean up merged worktrees
git wtc
# or
git-worktree-manager clean
```

### Agent Worktree Pattern

When multiple agents work simultaneously:

```bash
# Agent A creates isolated worktree
git worktree add .worktrees/agent-a7b13158 feature-a
cd .worktrees/agent-a7b13158

# Agent B creates separate worktree
git worktree add .worktrees/agent-ab731eb7 feature-b
cd .worktrees/agent-ab731eb7

# Both agents work independently - no conflicts
```

### Setup (One-Time Per Project)

```bash
# From repo root
git-worktree-init

# Or manually:
mkdir -p .worktrees
echo ".worktrees/" >> .gitignore
```

### Safety Rules

1. **Stay in your worktree** - Don't modify files in other agents' worktrees
2. **Commit before switching** - Keeps each worktree clean
3. **Use descriptive names** - `PROJ-123-fix-login` not `fix-stuff`
4. **Clean up after merge** - `git wtr <worktree-name>` when done

### Full Documentation

See `docs/WORKTREE_SYSTEM.md` for complete guide.

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

### Available Tasks (M1-M8)

| Task | Title | Description |
|------|-------|-------------|
| M1 | Fix Tone.js Validation Gate | Tone.js validation only fires on 'unknown' domain, should also fire on 'music' |
| M2 | Fix GLSL Shader Validation | Allows function definitions in GLSL shaders |
| M3 | Fix Three.js Domain Routing | Handles '3d' domain alias for Three.js |
| M4 | Fix Thinking Extraction Regex | Documents global flag usage for thinking extraction |
| M5 | Add Logger Import | Ensure Logger imported in harness components |
| M6 | Fix Console.log Leaks in FailureLogger | Replace console.log with Logger.info in FailureLogger.ts |
| M7 | Fix Console.log Leaks in PatternDetector | Replace console.log with Logger.info in PatternDetector.ts |
| M8 | Fix Console.log Leaks in HarnessUpdater | Replace console.log with Logger.info in HarnessUpdater.ts |

### Task JSON Schema

```json
{
  "id": "M1",
  "title": "Human-readable title",
  "description": "Detailed description of the issue",
  "targetFile": "path/to/file.ts",
  "search": "exact string to find",
  "replace": "replacement string",
  "verifyCommand": "npm run build && npm test",
  "risk": "low|medium|high",
  "complexity": "low|medium|high",
  "files": 1,
  "approved": true
}
```

---

## Dog Food Testing

### Running Tests

```bash
# Full dog food test (all domains × all models)
npx tsx scripts/dogfood-all-domains.ts

# Generate report
npx tsx scripts/generate-dogfood-report.ts

# E2E test suite
npm run test:e2e
```

### Report Location

- JSON Report: `dogfood-report.json`
- Markdown Report: `dogfood-report.md`
- Failure Database: `~/.liminal/failures/`

### Success Criteria

- 9 domains tested (p5, glsl, three, strudel, hydra, tone, remotion, html, ascii)
- Multiple models validated
- All failures logged to harness
- Report generated with recommendations

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

## Thinking-Trace Feedback Loop

**CRITICAL ARCHITECTURE**: All generators now report their thinking to the harness.

### How It Works

1. **Generator Produces Thinking**
   ```typescript
   // In any of the 9 generators
   const response = await llm.generate(prompt);
   // response.thinking contains the model's reasoning
   ```

2. **TierBasedGenerator Reports to Harness**
   ```typescript
   await metaHarness.onGenerationComplete({
     success: response.success,
     model: this.llm.getConfig().model,
     domain: this.domain,
     prompt,
     code: response.code,
     thinking: response.thinking,  // ← KEY
     recoveredFromThinking: response.recoveredFromThinking,
   });
   ```

3. **Harness Analyzes with LLM**
   The harness prompts its LLM:
   ```
   GENERATOR'S THINKING:
   [full thinking trace]
   
   YOUR TASK:
   1. WHERE DID IT GO WRONG?
   2. HOW CAN I COMMUNICATE BETTER?
   3. SYSTEM IMPROVEMENT SUGGESTIONS
   ```

4. **Insights Stored**
   - Stored in harness memory
   - Used to improve prompts
   - High-confidence suggestions trigger adaptations

### Key Files

| File | Purpose |
|------|---------|
| `src/generators/TierBasedGenerator.ts` | Captures & reports thinking |
| `src/harness/MetaHarnessIntegration.ts` | Receives & analyzes thinking |
| `src/harness/ThinkingSeparation.ts` | Separates generator/harness thinking |
| `src/emergent/ModelBehaviorPatterns.ts` | Long-term pattern detection |

### Separation of Concerns

**Generator Thinking** (`~/.liminal/thinking-traces/generator/`):
- "How do I create this code?"
- Mined for: code_in_thinking, confusion, over_engineering

**Harness Thinking** (`~/.liminal/thinking-traces/harness/`):
- "How do I fix this system?"
- Mined for: architectural insights, tool suggestions

**NEVER MIXED** - They serve different purposes.

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

---

## 📚 DOCUMENTATION BIBLE RULE

**CRITICAL:** The documentation site at `docs/` is the single source of truth.

### Golden Rule
> **NEVER** let code and documentation diverge. The docs site IS the project bible.

### Requirements for ALL Agents
1. **Check visual-bible.html** before starting work
2. **Update relevant docs** when making code changes
3. **Update visual-bible.html** status on EVERY commit
4. **Expand docs** to include new features/discussions

### Pages That Must Be Maintained
| Page | Purpose | Update When... |
|------|---------|----------------|
| `visual-bible.html` | Project status | Every commit |
| `features.html` | Feature docs | New features |
| `cli-reference.html` | CLI docs | New commands |
| `harness-tasks.html` | Task docs | Task changes |
| `architecture*.html` | Architecture | System changes |
| `soul-system.html` | SOUL docs | Personality changes |
| `THE_BIBLE.md` | Source of truth | ANY system change |

### THE_BIBLE.md Sections (1513 lines)

**Core Documentation:**
- Executive Summary
- Test Status
- System Architecture
- DGF (3 phases)
- 18 Subsystem Details
- File Structure
- API Exports
- Configuration

**Engineering Best Practices (NEW):**
- Glossary (terms defined)
- Troubleshooting Guide (debugging)
- Contributing Guide (how to update)
- API Quick Reference (common functions)
- Decision Log (ADRs)
- Runbooks (operational procedures)
- Changelog (version history)
- Getting Started (onboarding)
- Observability (health checks)
- Security Runbook (incidents)
- Migrations Guide (breaking changes)
- Index (quick find)

### Violation Policy
- Code commits without doc updates are **BLOCKED**
- Docs must be updated **BEFORE** or **WITH** code changes
- Dashboard must reflect **REALITY** at all times

---

## 🎯 THE ONE VISUAL BIBLE

**CRITICAL:** There is only ONE official development dashboard for this entire project. It is called the **Visual Bible** to distinguish it from THE_BIBLE.md (text format).

### Visual vs Text Bible
| Format | File | Purpose |
|--------|------|---------|
| **Visual Bible** | `docs/visual-bible.html` | Interactive dashboard, Kanban, metrics |
| **Text Bible** | `docs/THE_BIBLE.md` | Source of truth, complete documentation |

### The Correct Dashboard
```
Name: Visual Bible
Location: docs/visual-bible.html
URL: http://localhost:8080/visual-bible.html
Format: Original style with Kanban board, Feature Status table, System Status
Content: Mirrors THE_BIBLE.md (937 lines, 18 subsystems)
```

### What the Dashboard Contains
- Overview metrics cards (4 cards)
- Feature Status table (all 18 subsystems)
- Task Board Kanban (4 columns: Complete, In Progress, Planned, Blocked)
- System Status section
- Recent Commits table
- Next Steps list

### ❌ NEVER TOUCH THESE
| File | Reason |
|------|--------|
| `gui/src/components/GuardrailDashboard.tsx` | ARCHIVED - Old GUI component |
| `gui/src/App.tsx` | ARCHIVED GUI - Don't add dashboard tab |
| `gui/src/gui/liveOrganismState.ts` | ARCHIVED GUI - Don't add 'guardrails' tab |
| `dev-dashboard.html` | DELETED - Wrongly created |
| Any new `*dashboard*.html` | WRONG - Always update existing |

### ✅ WHEN USER SAYS "DASHBOARD" OR "VISUAL BIBLE"
1. Ask: "Do you mean docs/visual-bible.html?"
2. Confirm before ANY edits
3. Update `docs/visual-bible.html` ONLY
4. Never create new dashboard files
5. Never touch archived GUI components

### Prevention Checklist
Before ANY dashboard work:
- [ ] Confirmed `docs/visual-bible.html` is the target
- [ ] Verified `gui/` files are NOT being modified
- [ ] No new dashboard files created
- [ ] Original format preserved (Kanban, sections)
- [ ] Content matches current THE_BIBLE.md

**Remember:** There is ONE dashboard. It is called **Visual Bible**. It lives at `docs/visual-bible.html`. Everything else is wrong.

---

**Last Updated:** 2026-04-03  
**Rule Status:** BINDING
