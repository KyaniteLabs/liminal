# Contributing to Liminal

Thank you for your interest in contributing to Liminal! This guide covers the essentials.

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
- An LLM provider (Ollama, LM Studio, or OpenAI-compatible API)

## Code Style

- **TypeScript strict mode** is enabled. All code must pass `tsc --noEmit`.
- **ESLint** with `@typescript-eslint/recommended` rules. Run `pnpm run lint` before submitting.
- **2-space indentation**, single quotes, trailing commas.
- No `any` types without justification. Prefer explicit types.
- No `console.log` in production code — use the `Logger` utility.

## Commit Conventions

Use conventional commit format:

```
feat: Add Hydra visual generator
fix: Correct Tone.js validation domain check
docs: Update architecture quick reference
refactor: Extract scoring into separate module
test: Add integration tests for compost pipeline
chore: Update dependencies
```

## Pull Request Process

1. Create a feature branch from `main`
2. Make your changes with tests
3. Ensure all checks pass:
   - `pnpm run typecheck` — zero errors
   - `pnpm run lint` — zero warnings
   - `pnpm test` — all tests pass
4. Open a PR with a clear description of the change and motivation

### Test Coverage

The project maintains an 80% coverage threshold across lines, branches, functions, and statements. New code should include corresponding tests.

## Architecture

See [docs/ARCHITECTURE_AND_PHILOSOPHY.md](docs/ARCHITECTURE_AND_PHILOSOPHY.md) for the system design and module organization. Key directories:

- `src/core/` — main loop, validation, domain detection
- `src/generators/` — p5.js, GLSL, Three.js, music generators
- `src/harness/` — meta-harness self-improvement system
- `src/llm/` — LLM client with retry and circuit breaker
- `src/tui/` — terminal UI and natural language interface

## Questions?

Open an issue with the "question" label and we'll help you get started.
