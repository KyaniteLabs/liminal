# Contributing to Liminal

Thank you for your interest in contributing to Liminal!

## Development Setup

```bash
# Clone and install
git clone https://github.com/Pastorsimon1798/liminal.git
cd liminal
pnpm install

# Build
pnpm run build

# Run tests
pnpm test

# Fast PR-gating suite (coverage + stable tests)
pnpm run test:ci:fast

# Slow browser / render / e2e / provider suite
pnpm run test:ci:slow
```

### Requirements

- Node.js >= 18.0.0
- pnpm (preferred) or npm
- An LLM provider (MiniMax, OpenAI, Ollama, LM Studio, or any OpenAI-compatible API)

## Code Style

- **TypeScript strict mode** is enabled. All code must pass `tsc --noEmit`.
- **ESLint** with `@typescript-eslint/recommended` rules. Run `pnpm run lint` before submitting.
- **2-space indentation**, single quotes, trailing commas.
- No `any` types without justification. Prefer explicit types.
- No `console.log` in production code — use the `Logger` utility.

## Commit Conventions

Use conventional commit format:

```
feat: add Hydra visual generator
fix: correct Tone.js validation domain check
docs: update architecture quick reference
refactor: extract scoring into separate module
test: add integration tests for compost pipeline
chore: update dependencies
```

## Pull Request Process

1. Create a feature branch from `main`
2. Make your changes with tests
3. Ensure all checks pass:
   - `pnpm run lint` — zero warnings
   - `pnpm run build` — compile + typecheck succeeds
   - `pnpm run test:ci:fast` — PR-gating coverage suite passes
   - `pnpm run test:ci:slow` — browser / render / e2e / provider suite passes before landing changes that touch those surfaces
   - `pnpm run test:quality` — assertion hygiene stays within policy
4. Open a PR with a clear description of the change and motivation

### Test Coverage

The project maintains a **70% coverage threshold** across lines, branches, functions, and statements. New code must include corresponding tests. The fast CI suite owns the coverage gate; the slow suite exists to exercise browser, render, e2e, and provider-dependent paths without turning every PR into a long-running full-system burn. See [CLAUDE.md](./CLAUDE.md#coverage-target-mandatory--all-agents) for current metrics.

## Architecture

See [Architecture & Philosophy](./docs/ARCHITECTURE_AND_PHILOSOPHY.md) for the system design and [Architecture Quick Reference](./docs/ARCHITECTURE_QUICKREF.md) for a visual overview. Key directories:

| Directory | Purpose |
|-----------|---------|
| `src/core/` | Loop engine, validation, domain detection, LIR |
| `src/generators/` | p5.js, GLSL, Three.js, Strudel, Hydra, Tone.js, Remotion, HTML, ASCII, Kinetic, TextGen |
| `src/harness/` | Meta-harness: failure logging, pattern detection, self-improvement, tools |
| `src/llm/` | LLM client, provider adapters, circuit breaker, capability registry |
| `src/brain/` | Artistic knowledge, prompt enhancement, creative preferences |
| `src/compost/` | Compost Mill digestion pipeline |
| `src/evolution/` | MAP-Elites, novelty archive, fitness combining |
| `src/music/` | Music theory engine, rhythm, melody generation |
| `src/audio/` | Audio analysis, pitch detection, visual mapping |
| `src/aesthetic/` | Color theory, design tiers, aesthetic critics |
| `src/guardrails/` | Multi-layer guardrail system (correctness, hygiene, compliance, remediation) |
| `src/ledger/` | Self-hosting task ledger (corpus, runner, verifier) |
| `src/fs/` | LiminalFS — unified filesystem substrate (ProjectStore, EventStore, AssetStore) |
| `src/chat/` | Interview-driven creative sessions |
| `src/collab/` | Multi-agent board, swarm, deep collaboration |
| `src/config/` | Configuration loading, role-based model selection |
| `src/tui/` | Terminal UI |
| `src/tui-bridge/` | HTTP/SSE bridge for Bubble Tea runtime |
| `src/security/` | SSRF protection, rate limiting, sandbox |
| `src/render/` | Rendering pipeline |
| `src/plugins/` | Plugin system |

## Questions?

Open an issue with the "question" label and we'll help you get started.
