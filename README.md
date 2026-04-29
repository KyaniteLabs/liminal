# Liminal

[![CI](https://github.com/Pastorsimon1798/liminal/actions/workflows/ci.yml/badge.svg)](https://github.com/Pastorsimon1798/liminal/actions/workflows/ci.yml)
[![License: BSL 1.1](https://img.shields.io/badge/License-BSL%201.1-blue.svg)](./LICENSE)

> A creative coding agent that generates art, music, and shaders through iterative LLM-powered evolution.
>
> **Finish-line contract:** Liminal is a creative cognitive system, not a narrowed proof wedge. See [docs/FINISH_LINE.md](docs/FINISH_LINE.md) for the domain, cognitive-organ, self-improvement, and model-assimilation contract.

Liminal is a model-agnostic creative coding system. You give it a prompt — "a calming blue particle system" or "glitch techno beats with feedback loops" — and it generates, evaluates, and iteratively improves p5.js sketches, GLSL shaders, Three.js scenes, Strudel live-coding music, Hydra visuals, and more. It works with any OpenAI-compatible API, Ollama, LM Studio, or Anthropic.

Liminal Studio is the GUI-first creative workbench for live preview, streamed generation phases, and reviewable self-healing proposals. The self-healing loop has three jobs: repair failing behavior, harden green systems by finding blind spots, and propose measurable improvements or optimizations when the current gates are already green. Bubble Tea remains the terminal operator cockpit.

---

## Quick Start

```bash
# Install
pnpm install

# Configure (first time) — sets up ~/.liminal/config.json
liminal --configure

# Or use environment variables:
export LLM_API_KEY=your-key
export LLM_MODEL=minimax/M2.7-0716
export LLM_BASE_URL=https://api.minimaxi.chat/v1

# Generate
liminal --prompt "Create a calming blue particle system"

# Chat-driven creative session
liminal chat

# Studio — GUI workbench with live preview
pnpm gui
# or: liminal studio

# Bubble Tea operator cockpit (requires Go >= 1.21)
pnpm tui
# or: liminal tui

# Read-only self-healing opportunity scan
liminal improve scan
```

---

## Ready-to-show market path

Use this path when you want to try Liminal as a product instead of asking an agent to babysit a proof run. It keeps the full creative surface in scope: p5, GLSL, Three.js, SVG, Hydra, Strudel, Tone.js, Revideo, ASCII, Kinetic, and TextGen.

```bash
# 1. Install and build
pnpm install
pnpm build

# 2. Configure a provider (or run liminal --configure)
export LIMINAL_LLM_PROVIDER=glm
export GLM_API_KEY=your-key

# 3. Generate from natural language
liminal "a luminous blue-green particle garden"

# 4. Launch Studio for live preview, phases, artifacts, and learning receipts
pnpm gui

# 5. Refresh the live provider receipt used by the market gate
pnpm run proof:live-provider-smoke -- --provider=glm --timeout-ms=120000

# 6. Sweep every creative domain with the active live provider
pnpm exec tsx scripts/proof/creative-copilot-proof.ts --provider=glm --all --timeout-ms=120000 --max-tokens=4096 --out=.omx/proof/market-all-domain-sweep

# 7. Ask the app for the plain answer
liminal market status
```

Expected current result: `liminal market status` prints `Market readiness: READY` after the live smoke receipt exists. The all-domain sweep should report 11 pass, 0 fail, 0 blocked for the current GLM path. Strudel patterns are saved with an external playback link, Tone.js saves playable HTML, and Revideo code artifacts are generated; native rendered video/still capture is a separate follow-up.

---

## What It Does

**Core loop:** Generate → Evaluate → Iterate → Improve

Each iteration, Liminal:
1. Builds an enhanced prompt from artistic knowledge, compost seeds, and archive examples
2. Generates creative code in your chosen domain
3. Evaluates output on technical and aesthetic dimensions
4. Detects stagnation and adapts strategy
5. Stops when quality threshold is met or max iterations reached

**Key capabilities:**

- **12 creative domains** — SVG, p5.js, GLSL, Three.js, Strudel, Hydra, Tone.js, Revideo, HTML, ASCII, Kinetic, TextGen
- **Multi-agent critique** — 3-agent board (Minimalist / Expressionist / Technician) deliberates on output
- **Compost Mill** — Digests past work into reusable creative seeds that improve every generation
- **Self-healing harness** — Observes failures, detects patterns, and proposes repair, hardening, and optimization work with verification targets
- **Music theory engine** — Euclidean rhythms, Markov chains, scales, chord progressions
- **Voice/audio pipeline** — Maps audio features to visual parameters in real time
- **Aesthetic guardrails** — Color harmony, layout, typography, and sound quality critics
- **Liminal Studio** — GUI workbench with live preview, provider/model visibility, streamed phases, artifacts, and an Improve lane
- **LiminalCortex** — Background executive that perceives system events, manages goals, and proposes improvements
- **Emergence evaluation** — Novelty scoring, temporal structure analysis, perturbation probes, weighted ensemble critic
- **Taste learning + dreaming** — Preference-informed generation, cross-modal dream recombinations, motif rehydration
- **Autonomous Gardener** — Background creative steward that manages taste, dreaming, and emergence automatically
- **Model-agnostic** — Works with any provider: MiniMax, OpenAI, Anthropic, Ollama, LM Studio, OpenRouter, GLM
- **Model Assimilation Protocol** — Auditions new models by role/domain before promotion; see [docs/MODEL_ASSIMILATION_PROTOCOL.md](docs/MODEL_ASSIMILATION_PROTOCOL.md)
- **Circuit breaker** — Automatic provider failover with smart routing

---

## Generation Modes

| Mode | Flag | Description |
|------|------|-------------|
| **Single** | default | One model generates, evaluates, iterates |
| **Swarm** | `--use-swarm` | Multiple personas generate in parallel, vote on best |
| **Deep Collab** | `--routing-mode` | Dual-model routing (fast + powerful) |
| **Live Music** | `--mode live-music` | Generate Strudel + Hydra code |
| **Studio** | `liminal studio` | GUI workbench with live preview and Improve lane |
| **Cortex** | (in Studio) | Background executive manages goals and improvements |

---

## CLI Reference

```bash
# Generation
liminal -p "Create a particle system"              # Generate with prompt
liminal -p "sketch" -m 10 -o ./output              # Custom iterations + output dir
liminal -p "idea" --use-swarm --swarm-mode hybrid  # Swarm generation
liminal -p "ambient glitch set" --mode live-music  # Music mode

# Interactive
pnpm gui                                            # GUI workbench
liminal chat                                        # Conversational creative session
pnpm tui                                            # Bubble Tea operator cockpit
liminal improve scan                                # Read-only repair/hardening/optimization proposals
liminal improve run <proposal-id>                   # Run one proposal from an isolated worktree

# Emergence + Evaluation
liminal emergence score <file>                      # Score emergence dimensions
liminal emergence probe <file>                      # Run perturbation probes
liminal report provenance <file>                    # Trace creative lineage
liminal report archive                              # Archive overview
liminal report garden                               # Autonomous Gardener status
liminal report cognition                            # Creative body + cognitive architecture atlas
pnpm proof:cognitive-loop -- --out=.omx/proof/cognitive-loop-dev
pnpm proof:cognitive-loop -- --live --out=.omx/proof/cognitive-loop-live-dev
pnpm proof:model-assimilation -- --out=.omx/proof/model-assimilation-dev

# Compost Mill — creative material digestion
liminal compost add <path>                          # Feed material to heap
liminal compost digest                              # Run digestion pipeline
liminal compost soup start                          # Start evolutionary soup
liminal compost soup stop                           # Stop soup
liminal compost seeds list                          # Browse promoted seeds
liminal compost status                              # Overview

# Self-hosting task ledger
liminal ledger list                                 # List tasks
liminal ledger show <id>                            # Show task details
liminal ledger run <id>                             # Execute a task
liminal ledger verify <id>                          # Verify task result
liminal ledger status                               # Ledger overview

# Utilities
liminal list                                        # List saved sketches
liminal serve 3456                                  # Preview server
liminal fix <file|description>                      # Auto-fix code with LLM
liminal consolidate                                 # Memory consolidation
liminal --configure                                 # Setup config
```

### Flags

| Flag | Description |
|------|-------------|
| `-p, --prompt <text>` | Generation prompt |
| `-m, --max-iterations <n>` | Max iterations (default: 3) |
| `-o, --output <path>` | Output directory |
| `--mode <mode>` | Mode: `live-music` |
| `--use-swarm` | Enable swarm generation |
| `--swarm-mode <mode>` | Swarm strategy: `competitive`, `hybrid`, `ring`, `mesh` |
| `--voice` | Use microphone for audio input |
| `--voice-file <path>` | Use audio file for input |
| `--aesthetic <preset>` | Guardrail preset: `lenient`, `moderate`, `strict` |
| `--intuition` | Enable intuition scoring |
| `-v, --verbose` | Verbose output |

### Provider Configuration

Liminal reads from `~/.liminal/config.json`, environment variables, or `--configure`:

```bash
# Environment variables
LLM_API_KEY=your-key
LLM_MODEL=minimax/M2.7-0716
LLM_BASE_URL=https://api.minimaxi.chat/v1

# Or swap models on the fly
LIMINAL_LLM_MODEL='google/gemini-3.1-pro-preview' liminal bubbletea
```

---

## Architecture

```
src/
├── core/           Loop engine, validation, domain detection
├── generators/     p5.js, GLSL, Three.js, Strudel, Hydra, Tone.js, etc.
├── harness/        Meta-harness: failure logging, pattern detection, self-improvement
├── llm/            LLM client, provider adapters, circuit breaker
├── brain/          Artistic knowledge, prompt enhancement, creative preferences
├── compost/        Compost Mill pipeline (digest, collide, score, promote, rehydrate)
├── evolution/      MAP-Elites, novelty archive, cross-domain crossover
├── music/          Theory engine, Euclidean rhythms, Markov chains
├── audio/          Audio analysis, pitch detection, visual mapping
├── aesthetic/      Color theory, design tiers, aesthetic critics
├── guardrails/     Multi-layer guardrail system (correctness, hygiene, compliance)
├── ledger/         Self-hosting task ledger (corpus, runner, verifier)
├── chat/           Interview-driven creative sessions
├── collab/         Multi-agent board, swarm, deep collaboration
├── config/         Configuration loading, role-based model selection
├── agent/          StudioAgent — intent routing, autonomy modes, response composition
├── cortex/         LiminalCortex — background executive, perception bus, goal management
├── emergence/      Emergence evaluation — novelty, temporal structure, perturbation probes
├── learning/       Taste learning — preference dataset, model training, runtime scoring
├── dreaming/       Dream recombinations — queue planning, cross-modal transfer
├── autonomy/       Autonomous Gardener — garden health, stagnation detection, policies
├── evaluation/     Evaluation fabric — hybrid judges, holdout critics, scoring engines
├── tui/            Terminal UI utilities, text sanitization, preview safety
├── tui-bridge/     HTTP/SSE bridge for Bubble Tea runtime
├── render/         Rendering pipeline
├── security/       SSRF protection, rate limiting, sandbox
├── sandbox/        Sandboxed code execution
├── embeddings/     Local embedding service (SBERT)
├── quality/        Quality gates and checks
├── product/        Product mode definitions and registry
├── plugins/        Plugin system
└── export/         Output export (files, galleries)
```

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup, code style, and PR process.

## Security

See [docs/SECURITY.md](./docs/SECURITY.md) for the security model.

## License

Business Source License 1.1. Source code is available for viewing, learning, and non-commercial use. Commercial use requires a separate license. Converts to MIT on April 15, 2029. See [LICENSE](./LICENSE) for details.

---

**Liminal** — The code evolves. You curate. The system learns.
