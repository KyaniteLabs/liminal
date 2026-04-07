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
   - `pnpm run typecheck` — zero errors
   - `pnpm run lint` — zero warnings
   - `pnpm test` — all tests pass
   - `pnpm run test:coverage` — coverage not decreased
4. Open a PR with a clear description of the change and motivation

### Test Coverage

The project maintains a **70% coverage threshold** across lines, branches, functions, and statements. New code must include corresponding tests. See [CLAUDE.md](./CLAUDE.md#coverage-target-mandatory--all-agents) for current metrics.

## Architecture

See [Architecture & Philosophy](./docs/ARCHITECTURE_AND_PHILOSOPHY.md) for the system design. Key directories:

| Directory | Purpose |
|-----------|---------|
| `src/core/` | Main loop, validation, domain detection |
| `src/generators/` | p5.js, GLSL, Three.js, Strudel, Hydra, Tone.js generators |
| `src/harness/` | Meta-harness self-improvement (failure logging, pattern detection) |
| `src/llm/` | LLM client, provider adapters, circuit breaker |
| `src/brain/` | Artistic knowledge, prompt enhancement, creative preferences |
| `src/compost/` | Compost Mill digestion pipeline |
| `src/evolution/` | MAP-Elites, novelty archive, fitness combining |
| `src/music/` | Music theory engine, rhythm, melody generation |
| `src/audio/` | Audio analysis, pitch detection, visual mapping |
| `src/aesthetic/` | Color theory, design tiers, aesthetic critics |
| `src/chat/` | Interview-driven creative sessions |
| `src/collab/` | Multi-agent board, swarm, deep collaboration |
| `src/config/` | Configuration loading, role-based model selection |
| `src/tui/` | Terminal UI |

## Questions?

Open an issue with the "question" label and we'll help you get started.
