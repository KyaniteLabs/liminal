# Liminal

[![CI](https://github.com/Pastorsimon1798/liminal/actions/workflows/ci.yml/badge.svg)](https://github.com/Pastorsimon1798/liminal/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node](https://img.shields.io/node/v/liminal-ai)](https://nodejs.org/)

> The code evolves. You curate. The system learns.

A generative art system that creates p5.js sketches, GLSL shaders, Three.js scenes, live music (Strudel/Hydra), and more — through self-recursive iteration with LLM-powered evaluation and improvement.

<!-- TODO: Add screenshot or GIF demo here -->

## Table of Contents

- [Quick Start](#quick-start)
- [What It Does](#what-it-does)
- [Generation Modes](#generation-modes)
- [CLI Reference](#cli-reference)
- [Compost Mill](#compost-mill)
- [Architecture](#architecture)
- [Contributing](#contributing)
- [License](#license)

## Quick Start

```bash
pnpm install

# Configure an LLM provider (sets up ~/.liminal/config.json)
liminal --configure

# Or set environment variables directly:
export LLM_API_KEY=your-key
export LLM_MODEL=minimax/M2.7-0716
export LLM_BASE_URL=https://api.minimaxi.chat/v1

# Generate
liminal --prompt "Create a calming blue particle system"

# Chat-driven creative session
liminal chat

# Fast CI-equivalent validation
pnpm run lint && pnpm run build && pnpm run test:ci:fast

# Slow browser / render / provider / e2e validation
pnpm run test:ci:slow
```

Liminal is model-agnostic. It works with any OpenAI-compatible API (MiniMax, OpenAI, OpenRouter), Ollama, LM Studio, or Anthropic. Configure via `~/.liminal/config.json`, environment variables, or `liminal --configure`.

## What It Does

**Core loop**: Generate → Evaluate → Accumulate → Enhance → Repeat

Each iteration, Liminal:
1. Builds an enhanced prompt from artistic knowledge, compost seeds, and archive examples
2. Generates code (p5.js, GLSL, Three.js, Strudel, Hydra, Tone.js, HTML, ASCII)
3. Evaluates on technical + aesthetic dimensions
4. Detects stagnation and adapts strategy
5. Stops when quality threshold is met or max iterations reached

**Key capabilities:**
- **9 generators** — p5.js, GLSL, Three.js, Strudel, Hydra, Tone.js, Remotion, HTML, ASCII
- **Artistic knowledge** — 100+ techniques, design principles, color theory, composition rules
- **Thinking-trace feedback** — Captures model reasoning to improve future generations
- **Compost Mill** — Digests past work into reusable creative seeds
- **Multi-agent critique** — 3-agent board (Minimalist/Expressionist/Technician) deliberates on output
- **Voice/audio pipeline** — Maps audio features to visual parameters in real time
- **Music theory engine** — Euclidean rhythms, Markov chains, scales, chord progressions
- **Circuit breaker + smart routing** — Automatic provider failover and model selection

## Generation Modes

| Mode | Flag | Description |
|------|------|-------------|
| **Single** | default | One model generates, evaluates, iterates |
| **Swarm** | `--use-swarm` | 5 personas generate in parallel, vote on best |
| **Deep Collab** | `useDeepCollab` | 3-phase: Diverge → Analyze → Synthesize |
| **Live Music** | `--mode live-music` | Generate Strudel + Hydra code |
| **Organism** | `mode: 'organism'` | Music-to-visual pipeline with context accumulation |

Swarm supports 4 strategies: `competitive`, `hybrid` (default), `ring`, `mesh`.

## CLI Reference

```bash
# Generation
liminal --prompt "Create a particle system"
liminal -p "sketch" -m 10 -o ./output
liminal --prompt "idea" --use-swarm --swarm-mode hybrid
liminal --prompt "ambient glitch set" --mode live-music --output ./set

# Chat mode (interview-driven creative session)
liminal chat

# Compost system
liminal compost add <path>          # Feed material to heap
liminal compost digest              # Run digestion pipeline
liminal compost soup start          # Start evolutionary soup
liminal compost soup stop           # Stop soup
liminal compost seeds list          # Browse promoted seeds
liminal compost status              # Overview

# Project management
liminal list                        # List saved sketches
liminal serve 3456                  # Preview server
liminal --configure                 # Setup config
liminal --interactive               # TUI mode
```

### CLI Flags

| Flag | Description |
|------|-------------|
| `--prompt`, `-p` | Generation prompt |
| `--mode` | Generation mode (default, live-music) |
| `--use-swarm` | Enable swarm generation |
| `--swarm-mode` | Swarm strategy (competitive/hybrid/ring/mesh) |
| `-m`, `--max-iterations` | Max iterations (default: 5) |
| `-o`, `--output` | Output directory |
| `--voice` | Use microphone for audio input |
| `--voice-file <path>` | Use audio file for input |
| `--aesthetic <preset>` | Aesthetic guardrail preset (minimalist/vibrant/cinematic/playful/free) |

## Compost Mill

A living digestion system for creative material. Feed it files, previous outputs, or any creative content — it extracts fragments, scores them, and evolves them into reusable seeds injected into every generation.

**Pipeline:** Feed → Extract → Shred → Collide (cross-domain) → Score → Promote → Seed Bank

```bash
liminal compost add ./my-sketch.js     # Add material
liminal compost digest                 # Process heap into seeds
liminal compost soup start             # Start evolutionary loop
liminal compost seeds list             # Browse seeds
```

See [Compost Mill docs](./docs/ARCHITECTURE_AND_PHILOSOPHY.md) for full pipeline details.

## Architecture

```
src/
├── core/          Loop engine, validation, domain detection
├── generators/    p5.js, GLSL, Three.js, Strudel, Hydra, Tone.js, etc.
├── harness/       Meta-harness: failure logging, pattern detection, self-improvement
├── llm/           LLM client, provider adapters, circuit breaker
├── brain/         Artistic knowledge, prompt enhancement, creative preferences
├── compost/       Compost Mill pipeline
├── evolution/     MAP-Elites, novelty archive, cross-domain crossover
├── music/         Theory engine, Euclidean rhythms, Markov chains
├── audio/         Audio analysis, pitch detection, visual mapping
├── aesthetic/     Color theory, design tiers, aesthetic critics
├── chat/          Interview-driven creative sessions
├── collab/        Multi-agent board, swarm, deep collaboration
├── config/        Configuration loading, role-based model selection
├── tui/           Terminal UI
└── gui/           Web interface
```

For detailed architecture, see [Architecture & Philosophy](./docs/ARCHITECTURE_AND_PHILOSOPHY.md) and [Architecture Quick Reference](./docs/ARCHITECTURE_QUICKREF.md).

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup, code style, and PR process.

## Security

See [docs/SECURITY.md](./docs/SECURITY.md) for production deployment checklist, SSRF protection, rate limiting, and incident response.

## License

MIT — see [LICENSE](./LICENSE).

---

**Liminal v2.1.0** — The code evolves. You curate. The system learns.
