# Liminal — Creative Coding Agent

> "The code evolves. You curate."

A generative art system with an internal Ralph-Wiggum Loop for self-recursive iteration and improvement. Supports p5.js visuals, live music coding (Strudel/Hydra), multi-model swarm generation, deep collaboration, and a living Compost Mill for digesting creative material.

## Quick Start

```bash
npm install

# Configure an LLM backend (required for generation)
liminal --configure          # Sets up LM Studio at localhost:1234

# Or set env vars directly
export LIMINAL_LLM_PROVIDER=ollama
export LIMINAL_LLM_MODEL=llama3.2

# Generate
liminal --prompt "Create a calming blue particle system"
```

## What is Liminal?

Liminal generates emergent generative art through self-recursive iteration. The same prompt runs repeatedly, but the "world" (files, context, history) changes each time, creating a feedback loop where the agent critiques and improves its own previous output.

### Core Loop

```
while iterations < max:
  generate(prompt, context)    # LLM creates code
  evaluate(output)             # Quality gate (aesthetic + technical)
  accumulate(state)            # Save iteration, build context
  if promise detected: break   # <promise>COMPLETE</promise>
```

Safety mechanisms: max-iterations limit, timeout protection, quality gates, graceful error handling.

## Architecture

Liminal uses a unified architecture with three key consolidation points:

- **GeneratorRegistry** — Single dispatch point for all generators, with smart model routing (local/cloud/hybrid) merged from SmartRouter. Detects domain from prompt keywords and routes to the optimal model based on A/B test data.
- **CollaborationEngine** — Unified collaboration with configurable strategies: `swarm` (7-persona parallel), `phases` (specialist pipeline), `simple` (2-model ping-pong).
- **Compost Mill** — Living digestion pipeline: heap → extract → shred → collide → score → promote → seed bank → inject into generation loop.

Key integrations:
- **DNA feedback**: CompostMill extracts ProjectDNA from promoted seeds and registers it with GeneratorRegistry for improved routing.
- **Archive learning**: RalphLoop uses ArchiveLearning to inject high-quality examples from past runs into generation prompts.
- **Aesthetic model**: Predicts quality based on behavior vectors when MAP-Elites is enabled.

## Features

### Generation Modes

| Mode | Flag | Description |
|------|------|-------------|
| **Single LLM** | default | One model generates, evaluates, iterates |
| **Swarm** | `--use-swarm` | 7 Ollama personas generate in parallel, vote on best |
| **Deep Collab** | `useDeepCollab` option | 3-phase: Diverge (2 models) → Analyze (3 critics) → Synthesize |
| **Collab Engine** | `collabMode` option | Unified engine: swarm / phases / simple strategies |
| **Live Music** | `--mode live-music` | Generate Strudel + Hydra code, write to disk |
| **Organism** | `mode: 'organism'` option | Music-to-visual pipeline per iteration |

### Swarm Generation

7 creative personas run via Ollama in parallel, each with a distinct voice:

| Persona | Role | Default Model |
|---------|------|---------------|
| Kai (Architect) | Structural, analytical | `llama3.2:1b` |
| Nova (Synthesizer) | Connective, integrative | `gemma2:2b` |
| Rex (Explorer) | Provocative, boundary-pushing | `phi3:mini` |
| Sam (Muse) | Sensory, evocative | `qwen2.5:3b` |
| Max (Distiller) | Precise, compressed | `qwen2.5:0.5b` |

Modes: `competitive` (winner seeds next round), `hybrid` (top 2 combined, default), `ring` (sequential pass), `mesh` (all woven together).

### Deep Collaboration

Multi-model collaboration with specialized roles across local and cloud models:

1. **Divergence**: Creator (local) + Visionary (cloud) generate alternatives
2. **Analysis**: Technical Critic + Artistic Critic + Domain Expert evaluate
3. **Synthesis**: Integrator (cloud) + Refiner (local) combine best elements

Repeats until convergence (threshold 0.90) or max phases (default 4). Supports domains: `p5`, `glsl`, `three`, `ascii`, `music`, `code`.

### Compost Mill

A living digestion system for creative material. Feed it files, directories, or previous Liminal outputs — it extracts, shreds, scores, and evolves fragments into reusable seeds.

**Pipeline:** Feed → Extract (3 layers) → Shred → Mix (cross-domain collisions) → Mine (score + promote) → Digest → Prune

Key concepts:
- **Heap**: staging area for material awaiting digestion
- **Fragments**: extracted pieces with multi-dimensional scores (novelty, density, cross-domain)
- **Seed Bank**: persistent store of high-scoring promoted fragments — seeds are injected into every generation loop iteration
- **Soup**: continuous evolutionary loop — merge random fragments, score offspring, replace worst

### Smart Model Routing

GeneratorRegistry includes unified model routing based on A/B test data per domain:

```javascript
const registry = generatorRegistry;
const decision = registry.routeByPrompt("create a particle system");
// → { model: 'local', reason: '...', confidence: 0.85, ... }
```

Routes between local models (Qwen 3.5-4B), cloud models (Minimax), and hybrid mode based on domain fitness scores.

### Live Music Coding

Generate live code for Strudel (TidalCycles), Hydra (audio-reactive visuals), and more.

```bash
liminal --prompt "ambient glitch set" --mode live-music --output ./set
# Writes: ./set/strudel.js, ./set/hydra.js
```

Music-to-visual bridge: `generateMusicToVisual()` extracts BPM/FFT from music output and passes it to visual generation.

## CLI

```bash
liminal --prompt "Create a particle system"              # Basic generation
liminal -p "sketch" -m 10 -o ./output                    # Short flags
liminal --prompt "idea" --use-swarm --swarm-mode hybrid   # Swarm mode
liminal --prompt "music" --mode live-music                # Live music
liminal compost add <path>                                # Add material to compost heap
liminal compost digest                                   # Run digestion pipeline
liminal compost soup start                                # Start evolutionary soup loop
liminal compost seeds list                                # List promoted seeds
liminal compost status                                    # Heap/seed/soup overview
liminal serve 3456                                        # Preview server
liminal list                                               # List saved sketches
liminal --recent 10                                        # Recent prompts
liminal --interactive                                      # TUI mode
liminal --configure                                        # Setup config
liminal --favorites                                        # List favorites
```

### Programmatic API

```javascript
import { run, generatorRegistry } from './dist/index.js';

// Basic
const result = await run('Create a particle system', {
  maxIterations: 10,
  output: './output'
});

// With swarm
const result = await run('Evolving organism', {
  maxIterations: 5,
  useSwarm: true,
  swarmMode: 'hybrid',
  swarmConfig: { maxRounds: 10 }
});

// With collaboration engine
const result = await run('Complex scene', {
  maxIterations: 5,
  collabMode: 'phases',
  collabConfig: { maxRounds: 4 }
});

// Dynamic domain registration
generatorRegistry.registerDomain({
  name: 'lyrics',
  keywords: ['lyrics', 'poem', 'verse'],
  confidence: 0.8,
  generate: async (prompt) => `Generated lyrics for: ${prompt}`,
});

// Smart model routing
const decision = generatorRegistry.routeByPrompt('create a shader');
// → { model: 'cloud', reason: 'GLSL domain — Cloud Minimax superior ...', ... }

// Music + Visuals
import { generateMusic, generateVisuals, generateMusicToVisual } from './dist/index.js';
const music = await generateMusic('anxious post-rock', { musicPlatform: 'strudel' });
const visual = await generateVisuals({ prompt: 'same mood', platform: 'hydra' });
const bridge = await generateMusicToVisual('ambient glitch');
```

## Configuration

Project config at `config/liminal.json`:

```json
{
  "loop": { "maxIterations": 20, "timeoutMinutes": 30 },
  "creative": { "minQualityScore": 0.7 },
  "gallery": { "autoSave": true, "maxHistoryPerProject": 50 },
  "renderer": { "port": 3456 }
}
```

User config at `~/.liminal/config.json`. LLM settings via environment variables:

- `LIMINAL_LLM_PROVIDER` — `openai-compatible` (default), `ollama`
- `LIMINAL_LLM_BASE_URL` — API base URL
- `LIMINAL_LLM_MODEL` — model name
- `LIMINAL_LLM_API_KEY` — API key (if required)

## Project Structure

```
liminal/
├── src/
│   ├── core/              # RalphLoop, EvaluationFramework, CreativeEvaluator, PromptStore, ContextAccumulation
│   ├── generators/        # GeneratorRegistry (unified dispatch + routing), P5, Shader, Three generators
│   ├── swarm/             # SwarmOrchestrator, VotingEngine, MiningEngine, HeuristicScorer, personas
│   ├── collab/            # CollaborationEngine, DeepCollaboration, CollaborativeClient, Scoring
│   ├── compost/           # CompostMill, CompostHeap, CompostShredder, CompostSoup, SeedBank, FragmentScorer
│   ├── scavenger/         # DNAExtractor, FragmentArchive
│   ├── evolution/         # MapElites, AestheticModel, NoveltyArchive, MetaMode
│   ├── learning/          # ArchiveLearning, QualityArchive
│   ├── music/             # generateMusic (Strudel, p5-webaudio)
│   ├── musicToVisual/     # generateMusicToVisual (organism mode)
│   ├── generateVisuals.ts # generateVisuals (Hydra, p5)
│   ├── llm/               # LLMClient, CacheManager, RetryManager
│   ├── config/            # ConfigLoader, PromptHistory
│   ├── gallery/           # Gallery, SeedArchive
│   ├── export/            # Exporter (HTML, JS, ZIP)
│   ├── render/            # PreviewServer, Renderer
│   ├── sandbox/           # SandboxRunner
│   ├── improvement/       # SelfReflection, requestImprovement
│   ├── tui/               # Interactive TUI
│   ├── gui/               # GUI state management
│   ├── prompts/           # Prompt templates (34 registered prompts)
│   ├── routing/           # RoutingData, SmartRouter (backward-compatible wrapper)
│   └── utils/             # Shared utilities
├── test/
│   ├── unit/              # ~50 suites
│   ├── integration/       # full-loop, ralph-loop, dual-llm, renderer, GUI
│   ├── generators/        # p5, particle-system, cellular-automata, registry
│   ├── collab/            # DeepCollaboration, CollaborationEngine
│   ├── compost/           # full compost pipeline tests
│   └── e2e/               # full-loop (cloud + local), seed/quality, GUI, sandbox
├── gui/                   # Full GUI (Vite + React + Express)
├── compost/               # Compost Mill runtime data
├── docs/                  # Documentation + archive
└── config/                # liminal.json (project config)
```

## Testing

```bash
npm test                    # All 1,589 tests
npm run test:integration    # Integration suites only
npm run test:e2e            # E2E (skips when backends unavailable)
npm run test:coverage       # Coverage from src/
npm run typecheck           # TypeScript strict check
npm run lint                # ESLint
```

**130 suites, 1,589 tests, all passing.** Integration tests skip gracefully when no LLM is configured. E2E tests skip when Ollama/cloud backend is unavailable.

## Development

```bash
npm run build               # TypeScript compilation
npm run gui                 # Start GUI + backend
npm run gui:dev             # GUI dev mode (Vite)
npm run tui                 # Interactive TUI
npm run benchmark           # Performance benchmarks
npm run docs                # Generate TypeDoc
```

### TDD Approach

All features follow strict Red-Green-Refactor. Tests first, implementation second.

## License

MIT

## Acknowledgments

- **Ralph-Wiggum Loop pattern**: Geoffrey Huntley
- **Emergent Garden**: Artificial life and emergence inspiration
- **Blaise Agüera y Arcas**: "Computational Life" research
- **p5.js**: Generative art framework
- **Lenia**: Continuous cellular automata
- **Hydra**: Live coding visual synth
- **Strudel**: TidalCycles in the browser
