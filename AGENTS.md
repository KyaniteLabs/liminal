# AGENTS.md — Liminal Agent Instructions

**Last Updated:** 2026-04-15

**Cross-agent rules:** See `~/.agents/rules/UNIVERSAL.md` for the 12 golden principles shared across all agents.

## Mandatory Coding Skill

All agents working in this repo must follow `karpathy-guidelines` for coding, review, and refactor work.

If the runtime supports local skills, load and apply `karpathy-guidelines` directly. If it does not, still follow the same rules:
- think before coding and surface assumptions/tradeoffs
- prefer the simplest sufficient change
- make surgical edits only
- define concrete verification criteria before claiming success

---

## Agent skills

### Active Matt Pocock skill surface

Codex should use only the active Matt Pocock subset: `setup-matt-pocock-skills`, `diagnose`, `grill-with-docs`, `improve-codebase-architecture`, and `zoom-out`. Do not use quarantined Matt Pocock skills unless they are explicitly re-enabled.

### Issue tracker

Issues are tracked in GitHub Issues for `Pastorsimon1798/liminal`; see `docs/agents/issue-tracker.md`.

### Triage labels

Canonical triage labels are documented conservatively; most are not present in GitHub yet, so do not invent mappings to unrelated labels. See `docs/agents/triage-labels.md`.

### Domain docs

Liminal is configured as a single-context repo; read available domain docs opportunistically and let `grill-with-docs` create missing glossary/ADR artifacts lazily. See `docs/agents/domain.md`.

---

## Overview

Liminal is a creative coding agent with a **Meta-Harness** — a self-improving outer loop that observes failures, detects patterns, and applies targeted fixes. Agents operate inside this loop, using tools to generate, evaluate, and improve creative code.

### Architecture

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
│  │ (21 tools)  │    └─────────────┘                         │
│  └─────────────┘                                            │
└────────────────────────────────────────┬────────────────────┘
                                         │ Reports failures
                                         ▼
┌─────────────────────────────────────────────────────────────┐
│                      GENERATORS (stateless)                  │
│  p5.js │ GLSL │ Three.js │ Strudel │ Hydra │ Tone.js │ ... │
└─────────────────────────────────────────────────────────────┘
```

**Key Principle:** Only the harness improves. Generators are stateless.

---

## Quick Start

### Run the Bubble Tea TUI

```bash
pnpm run tui
# or directly:
liminal bubbletea
```

### Generate from CLI

```bash
liminal -p "Create a calming blue particle system"
liminal chat                    # Conversational session
liminal compost status          # Check compost pipeline
liminal ledger list             # List self-hosting tasks
```

### TUI Commands (inside Bubble Tea)

```
/help                Show available commands
/status              Check harness status and providers
/tasks               List pending tasks
/run <task-id>       Execute a task
/preview <file>      Preview file
/clear               Clear screen
/exit                Exit TUI
```

---

## Development Workflow (Worktree Isolation Required)

**Rule:** All feature work MUST be done in isolated git worktrees. No exceptions.

### Start-of-Day Hygiene

Before new work, run from the repo root:

```bash
git fetch --all --prune
git status --short --branch
git worktree list
git branch -vv
```

### Why Worktrees?

- **Multi-Agent Safety:** Each agent has isolated workspace, no conflicts
- **Parallel Development:** Work on multiple branches simultaneously
- **Build Isolation:** `node_modules/`, build artifacts don't collide

### Quick Commands

```bash
# Create and switch to new worktree
git worktree add .claude/worktrees/<name> -b <branch-name>

# List all worktrees
git worktree list

# Clean up merged worktrees
git worktree remove .claude/worktrees/<name>
git branch -d <branch-name>
```

---

## Meta-Harness Components

| Component | Location | Purpose |
|-----------|----------|---------|
| FailureLogger | `src/harness/FailureLogger.ts` | Logs failures with metadata for pattern analysis |
| PatternDetector | `src/harness/PatternDetector.ts` | Analyzes failures to detect recurring patterns |
| HarnessUpdater | `src/harness/HarnessUpdater.ts` | Applies adaptations based on detected patterns |
| HarnessAgent | `src/harness/agent/HarnessAgent.ts` | Executes tasks with rollback capability |
| ValidationGuard | `src/harness/tools/ValidationGuard.ts` | Safety checks before applying changes |
| RateLimiter | `src/harness/tools/RateLimiter.ts` | Prevents API abuse |

### HarnessAgent Tools

`readFile`, `writeFile`, `applyEdit`, `runBuild`, `runTests`, `executeSkill`, `searchCode`, `searchDocs`, `runLint`, `runFocusedTests`, `createBackup`, `restoreBackup`

---

## Self-Hosting Task Ledger

The task ledger (`src/ledger/`) provides a complete task management system:

- **Corpus:** Curated task definitions in `src/ledger/corpus/`
- **TaskRunner:** Executes tasks with shell-free security
- **TaskVerifier:** Validates results with metacharacter guard + prefix whitelist

### CLI

```bash
liminal ledger list                 # List tasks
liminal ledger show <id>            # Show task details
liminal ledger run <id>             # Execute a task
liminal ledger verify <id>          # Verify task result
liminal ledger accept <id>          # Accept verified result
liminal ledger reject <id>          # Reject and roll back
liminal ledger status               # Overview
```

---

## Multi-Provider Support

| Provider | Config | Use Case |
|----------|--------|----------|
| MiniMax | Cloud | Default, high quality |
| OpenAI | Cloud | GPT models |
| Anthropic | Cloud | Claude models |
| OpenRouter | Cloud | Model variety |
| GLM | Cloud | ZhipuAI models |
| LM Studio | Local | Default for offline |
| Ollama | Local | Open source models |

Configuration via `~/.liminal/config.json`, environment variables, or `liminal --configure`.

---

## Design Rules

### No Template Fallbacks

All generators route through the LLM. If the LLM fails, the fix is to improve the harness, routing, or validation — not to fall back to static code.

### Integration-First

No new module may be created without a specific call site in the existing CLI or loop. Every task must end with a verifiable CLI command or test run.

---

## Safety Rules

### File Access
- Only modify files in: `src/`, `test/`, `docs/`, `scripts/`
- No path traversal (`..` not allowed in harness edits)

### Code Changes
- Max 50 lines changed per edit
- No `eval()` or `new Function()`
- No `child_process` in harness

### Verification
- Build must pass after changes
- Tests must pass if provided
- Auto-rollback on failure

---

## Thinking-Trace Feedback Loop

All generators report their thinking to the harness:

1. **Generator** produces thinking trace
2. **TierBasedGenerator** reports to MetaHarnessIntegration
3. **Harness** analyzes: "Where did it go wrong? How to communicate better?"
4. **Insights** stored and used to improve prompts

Thinking traces are separated:
- **Generator thinking** (`~/.liminal/thinking-traces/generator/`) — "How do I create this code?"
- **Harness thinking** (`~/.liminal/thinking-traces/harness/`) — "How do I fix this system?"

**Never mixed** — they serve different purposes.

---

## File Structure

```
src/
├── core/           RalphLoop, validation, domain detection, LIR
├── harness/        Meta-harness (FailureLogger, PatternDetector, HarnessAgent)
│   ├── agent/      Task execution agent
│   ├── tools/      ReadFile, WriteFile, ApplyEdit, RunBuild, etc.
│   ├── prompts/    System prompts
│   └── skills/     Skill loading
├── ledger/         Self-hosting task ledger
│   └── corpus/     Task definitions
├── generators/     p5, GLSL, Three.js, Strudel, Hydra, Tone.js, etc.
├── llm/            LLMClient, provider adapters, circuit breaker
├── brain/          Artistic knowledge, prompt enhancement
├── compost/        Compost Mill pipeline
├── evolution/      MAP-Elites, novelty archive
├── music/          Theory engine, rhythms, melody
├── audio/          Audio analysis, pitch detection
├── aesthetic/      Color theory, critics
├── guardrails/     Multi-layer guardrail system
├── fs/             LiminalFS filesystem substrate
├── chat/           Interview-driven sessions
├── collab/         Multi-agent board, swarm
├── config/         Configuration, role-based models
├── tui/            Terminal UI
├── tui-bridge/     HTTP/SSE bridge for Bubble Tea
├── render/         Rendering pipeline
├── security/       SSRF protection, rate limiting
└── plugins/        Plugin system
```

---

## References

- [README.md](./README.md) — Project overview and quick start
- [CONTRIBUTING.md](./CONTRIBUTING.md) — Development setup and PR process
- [CLAUDE.md](./CLAUDE.md) — Agent rules, test standards, git hygiene
- [docs/ARCHITECTURE_AND_PHILOSOPHY.md](./docs/ARCHITECTURE_AND_PHILOSOPHY.md) — System design
- [docs/ARCHITECTURE_QUICKREF.md](./docs/ARCHITECTURE_QUICKREF.md) — Quick visual overview

---

**Last Updated:** 2026-04-15
