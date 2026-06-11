# Sinter

*To sinter:* to fire many separate particles into one solid, durable form — the way a kiln fuses grains of clay into a single vessel. That's the idea: generate across many creative-coding domains, then fuse them into one layered work.

[![CI](https://github.com/KyaniteLabs/liminal/actions/workflows/ci.yml/badge.svg)](https://github.com/KyaniteLabs/liminal/actions/workflows/ci.yml)
Primary development now happens on Forgejo; this CI badge reflects the GitHub mirror.
[![License: BSL 1.1](https://img.shields.io/badge/License-BSL%201.1-blue.svg)](./LICENSE)

[Public landing page](https://kyanitelabs.github.io/liminal/) | [GitHub repository](https://github.com/KyaniteLabs/liminal) | [AI discovery file](llms.txt)

> Codex for creative coding: a chat-first Studio that helps you turn natural language, sound, and iteration into sketches, shaders, music, video compositions, and other creative-code artifacts.
>
> **Finish-line contract:** Sinter is a creative cognitive system, not a narrowed proof wedge. See [docs/FINISH_LINE.md](docs/FINISH_LINE.md) for the domain, cognitive-organ, self-improvement, and model-assimilation contract.

Sinter is a model-agnostic creative coding system. You describe what you want — "a quiet moonlit garden with blue-green fireflies" or "glitch techno beats with feedback loops" — and Sinter helps choose a medium, generates the artifact, shows an inline/side-panel preview, and keeps the conversation open for revision. It works with any OpenAI-compatible API, Ollama, LM Studio, Anthropic-style providers, and GLM.

Sinter Studio is the artist-facing workbench: clean chat on the left, live preview on the right, and advanced receipts hidden until you ask for them. Bubble Tea remains the keyboard-first operator cockpit for deeper diagnostics and review actions.

---


## Public Discovery

**Sinter** is a model-agnostic creative coding studio for AI-assisted art, music, shaders, sketches, video compositions, and iterative creative systems. It combines a chat-first Studio, CLI, TUI, multi-agent critique, taste learning, creative-code generation, and self-improvement loops.

**Public URL:** [kyanitelabs.github.io/liminal](https://kyanitelabs.github.io/liminal/) is the front door for search engines, AI assistants, and people evaluating the project before cloning it.

**AI discovery:** [`llms.txt`](llms.txt) provides a compact project summary for AI assistants and search crawlers.

**Best-fit searches:** AI creative coding studio, generative art agent, creative coding CLI, model-agnostic art generator, p5 GLSL Three.js AI tool, AI music coding, autonomous creative coding system, LLM art workbench.

## Quick Start

```bash
# Install
pnpm install

# Configure (first time) — sets up ~/.liminal/config.json
sinter --configure

# Or use environment variables:
export LLM_API_KEY=your-key
export LLM_MODEL=MiniMax-M2.7
export LLM_BASE_URL=https://api.minimax.io/anthropic

# Generate
sinter --prompt "Create a calming blue particle system"

# Chat-driven creative session
sinter chat

# Studio — chat-first GUI workbench with same-screen preview
pnpm gui
# or: sinter studio

# Desktop Studio — Electron shell around the same local Studio
pnpm desktop
# package a local macOS app: pnpm desktop:package:mac

# Bubble Tea operator cockpit (requires Go >= 1.21)
pnpm tui
# or: sinter tui

# Read-only self-healing opportunity scan
sinter improve scan
```

---

## Ready-to-show market path

Use this path when you want to try Sinter as a product instead of asking an agent to babysit a proof run. It keeps the full creative surface in scope: p5, SVG, GLSL, Three.js, Hydra, Strudel, Tone.js, Revideo, HyperFrames, ASCII, Kinetic, and TextGen.

```bash
# 1. Install and build
pnpm install
pnpm build

# 2. Configure a provider (or run sinter --configure)
export SINTER_LLM_PROVIDER=glm
export GLM_API_KEY=your-key

# 3. Generate from natural language
sinter "a luminous blue-green particle garden"

# 4. Launch Studio for chat, same-screen preview, revision, and optional details
pnpm gui

# 5. Refresh the live provider receipt used by the market gate
pnpm run proof:live-provider-smoke -- --provider=glm --timeout-ms=120000

# 6. Sweep every creative domain with the active live provider
pnpm exec tsx scripts/proof/creative-copilot-proof.ts --provider=glm --all --timeout-ms=120000 --max-tokens=4096 --out=.omx/proof/market-all-domain-sweep

# 7. Ask the app for the plain answer
sinter market status
```

Expected current result: `sinter market status` prints `Market readiness: READY` after the live smoke receipt exists. The current launch-candidate proof also includes Studio p5 generation, same-screen preview, revision, microphone preview smoke, and permission-denied UX receipts summarized in `docs/launch/launch-candidate-2026-04-30.md`. Strudel patterns are saved with an external playback link, Tone.js saves playable HTML, HyperFrames saves HTML/GSAP composition artifacts, and Revideo code artifacts are generated; native rendered video/still capture is a separate follow-up.

---

## What It Does

**Core loop:** Generate → Evaluate → Iterate → Improve

Each iteration, Sinter:
1. Builds an enhanced prompt from artistic knowledge, compost seeds, and archive examples
2. Generates creative code in your chosen domain
3. Evaluates output on technical and aesthetic dimensions
4. Detects stagnation and adapts strategy
5. Stops when quality threshold is met or max iterations reached

**Key capabilities:**

- **12 creative domains** — p5.js, SVG, GLSL, Three.js, Hydra, Strudel, Tone.js, Revideo, HyperFrames, ASCII, Kinetic, TextGen
- **CreativeBoard critique** — 3-agent board (Minimalist / Expressionist / Technician) deliberates on output
- **Swarm generation** — 5 default runtime personas (Kai / Nova / Rex / Sam / Max) generate in parallel and vote on best
- **Compost Mill** — Digests past work into reusable creative seeds that improve every generation
- **Self-healing harness** — Observes failures, detects patterns, and proposes repair, hardening, and optimization work with verification targets
- **Music theory engine** — Euclidean rhythms, Markov chains, scales, chord progressions
- **Voice/audio pipeline** — Maps microphone/audio features to visual parameters in real time, with explicit permission-denied UX
- **Aesthetic guardrails** — Color harmony, layout, typography, and sound quality critics
- **Sinter Studio** — Chat-first GUI with same-screen preview, revision, optional detail receipts, and an Improve lane tucked behind disclosures
- **LiminalCortex** — Background executive that perceives system events, manages goals, and proposes improvements
- **Emergence evaluation** — Novelty scoring, temporal structure analysis, perturbation probes, weighted ensemble critic
- **Taste learning + dreaming** — Preference-informed generation, cross-modal dream recombinations, motif rehydration
- **Autonomous Gardener** — Background creative steward that manages taste, dreaming, and emergence automatically
- **Model-agnostic** — Works with any provider: MiniMax, OpenAI, Anthropic-style endpoints, Ollama, LM Studio, OpenRouter, GLM, Kimi, Moonshot, or a custom OpenAI-compatible endpoint
- **Model Assimilation Protocol** — Auditions new models by role/domain before promotion; see [docs/MODEL_ASSIMILATION_PROTOCOL.md](docs/MODEL_ASSIMILATION_PROTOCOL.md)
- **Circuit breaker** — Automatic provider failover with smart routing

---

## Generation Modes

| Mode | Flag | Description |
|------|------|-------------|
| **Single** | default | One model generates, evaluates, iterates |
| **Swarm** | `--use-swarm` | Five default personas (Kai, Nova, Rex, Sam, Max) generate in parallel and vote on best |
| **Deep Collab** | `--routing-mode` | Dual-model routing (fast + powerful) |
| **Live AV** | `--mode live-music` | Generate Strudel music + Hydra video-synth code |
| **Studio** | `sinter studio` | Chat-first GUI with same-screen preview, revision, and optional Improve/details drawers |
| **Cortex** | (in Studio) | Background executive manages goals and improvements |

---

## CLI Reference

```bash
# Generation
sinter -p "Create a particle system"              # Generate with prompt
sinter -p "sketch" -m 10 -o ./output              # Custom iterations + output dir
sinter -p "idea" --use-swarm --swarm-mode hybrid  # Swarm generation
sinter -p "ambient glitch set" --mode live-music  # Live AV mode

# Interactive
pnpm gui                                            # GUI workbench
sinter chat                                        # Conversational creative session
pnpm tui                                            # Bubble Tea operator cockpit
sinter improve scan                                # Read-only repair/hardening/optimization proposals
sinter improve run <proposal-id>                   # Run one proposal from an isolated worktree

# Emergence + Evaluation
sinter emergence score <file>                      # Score emergence dimensions
sinter emergence probe <file>                      # Run perturbation probes
sinter report provenance <file>                    # Trace creative lineage
sinter report archive                              # Archive overview
sinter report garden                               # Autonomous Gardener status
sinter report cognition                            # Creative body + cognitive architecture atlas
pnpm proof:cognitive-loop -- --out=.omx/proof/cognitive-loop-dev
pnpm proof:cognitive-loop -- --live --out=.omx/proof/cognitive-loop-live-dev
pnpm proof:model-assimilation -- --out=.omx/proof/model-assimilation-dev

# Compost Mill — creative material digestion
sinter compost add <path>                          # Feed material to heap
sinter compost digest                              # Run digestion pipeline
sinter compost soup start                          # Start evolutionary soup
sinter compost soup stop                           # Stop soup
sinter compost seeds list                          # Browse promoted seeds
sinter compost status                              # Overview

# Self-hosting task ledger
sinter ledger list                                 # List tasks
sinter ledger show <id>                            # Show task details
sinter ledger run <id>                             # Execute a task
sinter ledger verify <id>                          # Verify task result
sinter ledger status                               # Ledger overview

# Utilities
sinter list                                        # List saved sketches
sinter serve 3456                                  # Preview server
sinter fix <file|description>                      # Auto-fix code with LLM
sinter consolidate                                 # Memory consolidation
sinter --configure                                 # Setup config
```

### Flags

| Flag | Description |
|------|-------------|
| `-p, --prompt <text>` | Generation prompt |
| `-m, --max-iterations <n>` | Max iterations (default: 3) |
| `-o, --output <path>` | Output directory |
| `--mode <mode>` | Mode: `live-music` (Live AV Strudel + Hydra) |
| `--use-swarm` | Enable swarm generation |
| `--swarm-mode <mode>` | Swarm strategy: `competitive`, `hybrid`, `ring`, `mesh` |
| `--voice` | Use microphone for audio input |
| `--voice-file <path>` | Use audio file for input |
| `--aesthetic <preset>` | Guardrail preset: `lenient`, `moderate`, `strict` |
| `--intuition` | Enable intuition scoring |
| `-v, --verbose` | Verbose output |

### Provider Configuration

Sinter reads from `~/.liminal/config.json`, environment variables, or `--configure`:

```bash
# Environment variables
LLM_API_KEY=your-key
LLM_MODEL=MiniMax-M2.7
LLM_BASE_URL=https://api.minimax.io/anthropic

# Or swap models on the fly
SINTER_LLM_MODEL='google/gemini-3.1-pro-preview' sinter bubbletea
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

**Sinter** — The code evolves. You curate. The system learns.

---

## Part of KyaniteLabs

More from [KyaniteLabs](https://kyanitelabs.tech). Related projects:

- **[liminal-sites](https://github.com/KyaniteLabs/liminal-sites)** — living website-evolution engine
- **[Elixis](https://github.com/KyaniteLabs/Elixis)** — local-first AI pattern-synthesis engine for ideas
- **[Innerscape](https://github.com/KyaniteLabs/Innerscape)** — personal-growth OS: journaling & reflection

→ More at **[kyanitelabs.tech](https://kyanitelabs.tech)**
