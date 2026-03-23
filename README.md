# Liminal — Creative Coding Agent

> "The code evolves. You curate. The system learns."

A sophisticated generative art system with an internal Ralph-Wiggum Loop for self-recursive iteration, comprehensive artistic knowledge, and intelligent guidance. Supports p5.js visuals, live music coding (Strudel/Hydra), multi-model swarm generation, deep collaboration, chat-based creative sessions, and a living Compost Mill for digesting creative material.

## Quick Start

```bash
pnpm install

# Configure an LLM backend (required for generation)
liminal --configure          # Sets up LM Studio at 100.66.225.85:1234

# Or set env vars directly
export LIMINAL_LLM_PROVIDER=lmstudio
export LIMINAL_LLM_MODEL=qwen2.5-coder-7b-instruct

# Generate art
liminal --prompt "Create a calming blue particle system"

# Start creative chat session
liminal chat
```

## How Liminal Works

Liminal generates emergent generative art through self-recursive iteration with intelligent context enhancement. The same prompt runs repeatedly, but the "world" (files, context, artistic knowledge, guidance) changes each time, creating a sophisticated feedback loop where the agent critiques and improves its own output.

### The Creative Loop

```
┌─────────────────────────────────────────────────────────────────────┐
│                     RALPH-WIGGUM LOOP                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. GENERATE   → LLM creates code based on prompt + enhanced context  │
│  2. EVALUATE   → Quality gate (aesthetic + technical dimensions)   │
│  3. ACCUMULATE → Save iteration, build context, learn from output    │
│  4. GUIDANCE   → Proactive suggestions based on current state       │
│  5. ENHANCE    → Inject compost DNA, archive examples, aesthetic hints │
│  6. CHECK      → Stagnation detection? Promise detected?          │
│                                                                     │
│  Repeat until: promise detected OR max-iterations OR timeout       │
└─────────────────────────────────────────────────────────────────────┘
```

### Context Enhancement Pipeline

Every generation is enhanced with multiple layers of intelligence:

```
Base Prompt
    ↓
┌──────────────────────────────────────────────────────┐
│              ARTISTIC KNOWLEDGE BASE                │
│  • 100+ techniques across p5, shader, three, music    │
│  • 30+ notable artists with their contributions       │
│  • Art movements, design principles, color theory      │
│  • Domain-specific vocabulary and terminology          │
└──────────────────────────────────────────────────────┘
    ↓
┌──────────────────────────────────────────────────────┐
│              COMPOST SEED INJECTION                  │
│  • Quality DNA from past successful generations       │
│  • Multi-domain fragments (code, docs, textures)     │
│  • Style patterns and technique signatures           │
└──────────────────────────────────────────────────────┘
    ↓
┌──────────────────────────────────────────────────────┐
│              ARCHIVE LEARNING                      │
│  • Semantic few-shot examples from high-quality     │
│  • Keyword overlap matching                        │
│  • Budget-conscious injection (2000 chars)          │
└──────────────────────────────────────────────────────┘
    ↓
┌──────────────────────────────────────────────────────┐
│              EVOLUTION SUBSYSTEMS                   │
│  • MAP-Elites: Performance archive with diversity    │
│  • Novelty Archive: Tracks novel behaviors            │
│  • AestheticModel: Quality prediction              │
└──────────────────────────────────────────────────────┘
    ↓
Enhanced Prompt → Better Generation → Improved Quality
```

### Chat Mode with Intelligent Guidance

The chat mode (`liminal chat`) provides an interview-driven creative session:

1. **Interview Phase** (7 questions)
   - What do you want to create?
   - What's the context or inspiration?
   - What mood should it have?
   - Any references or inspirations?
   - Any constraints or requirements?
   - Confirmation of creative brief
   - Generation begins

2. **Real-time Guidance**
   - **Thought Emission**: "Starting iteration 1...", "Loading prompt...", "Generating code..."
   - **Proactive Suggestions**:
     - "I can explore 7 artistic approaches - want me to?" (swarm)
     - "I have 15 quality seeds from your past work. Want me to inject them?" (compost)
     - "Scores are plateauing. MAP-Elites can help break through." (evolution)
     - "Try Flow Fields technique for organic movement" (technique)
     - "I have 8 high-quality examples - use archive learning?" (archive)
   - **Progress Updates**: Iteration progress, scores, promise detection
   - **Live Preview**: Render output in real-time during generation

3. **Session Memory**
   - Full conversation history
   - Artwork snapshots per iteration
   - Learned preferences for future sessions

## Architecture Overview

Liminal uses a sophisticated multi-layered architecture:

```
┌─────────────────────────────────────────────────────────────────────┐
│                          CHAT INTERFACE                              │
│  • Interview phase with 7-question creative brief                             │
│  • Real-time guidance with proactive suggestions                                   │
│  • Live preview rendering                                                               │
│  • Session history and memory                                                               │
└─────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│                      GUIDANCE ENGINE                                   │
│  • Context-aware suggestion system                                                      │
│  • Analyzes: iteration count, score trends, stagnation detection                        │
│  • Suggests: swarm, compost, techniques, evolution, archive                           │
│  • Priority ordering: high → medium → low                                               │
└─────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│                    ARTISTIC KNOWLEDGE BASE                            │
│  • 100+ techniques: p5 (25), shader (20), three (25), strudel (18), hydra (20) │
│  • 30+ notable artists with domains and contributions                                   │
│  • Art movements: Generative, Algorithmic, Op Art, Minimalism, etc.                     │
│  • Design principles: Balance, Contrast, Emphasis, Movement, etc.                          │
│  • Color theory: Complementary, Analogous, Triadic, Warm/Cool, etc.                      │
│  • Composition: Golden Ratio, Rule of Thirds, Symmetry, Leading Lines, etc.                │
└─────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│                    PROMPT ENHANCER                                    │
│  • Domain-specific vocabulary injection                                                   │
│  • Mood-based enhancements (calm → Balance, Unity, Harmony)                              │
│  • Intent-based technique suggestions (flow → Flow Fields, Perlin Noise)                   │
│  • Artist reference suggestions based on domain/context                                   │
│  • Artistic terminology and modifiers                                                      │
└─────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│                      RALPH-WIGGUM LOOP                                  │
│  • Generation orchestrator (swarm/collab/generator)                                    │
│  • Scoring engine (detailed/strategic evaluation)                                         │
│  • Evolution integration (MAP-Elites, Novelty, AestheticModel)                             │
│  • Persistence (gallery save, merge-every-N)                                                 │
│  • Stagnation detection with self-reflection                                              │
└─────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│                    SUBSYSTEMS                                        │
│  • GeneratorRegistry (smart routing by domain)                                           │
│  • CollabEngine (swarm/phases/simple strategies)                                         │
│  • CompostMill (heap → extract → shred → collide → score → promote → digest)                  │
│  • ArchiveLearning (few-shot learning from quality outputs)                                │
│  • SafetyGuardrails (quality thresholds, API limits)                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Generation Modes

| Mode | Flag | Description |
|------|------|-------------|
| **Single LLM** | default | One model generates, evaluates, iterates |
| **Swarm** | `--use-swarm` | 7 Ollama personas generate in parallel, vote on best |
| **Deep Collab** | `useDeepCollab` option | 3-phase: Diverge → Analyze → Synthesize |
| **Collab Engine** | `collabMode` option | Unified: swarm / phases / simple strategies |
| **Live Music** | `--mode live-music` | Generate Strudel + Hydra code, write to disk |
| **Organism** | `mode: 'organism'` option | Music-to-visual pipeline with context accumulation |

## Swarm Generation

7 creative personas run via Ollama in parallel, each with a distinct voice:

| Persona | Role | Model |
|---------|------|-------|
| Kai (Architect) | Structural, analytical | `llama3.2:1b` |
| Nova (Synthesizer) | Connective, integrative | `gemma2:2b` |
| Rex (Explorer) | Provocative, boundary-ping | `phi3:mini` |
| Sam (Muse) | Sensory, evocative | `qwen2.5:3b` |
| Max (Distiller) | Precise, compressed | `qwen2.5:0.5b` |

**Modes:**
- `competitive` (winner seeds next round)
- `hybrid` (top 2 combined, default)
- `ring` (sequential pass)
- `mesh` (all woven together)

## Deep Collaboration

Multi-model collaboration with specialized roles:

1. **Divergence**: Creator (local) + Visionary (cloud) generate alternatives
2. **Analysis**: Technical Critic + Artistic Critic + Domain Expert evaluate
3. **Synthesis**: Integrator (cloud) + Refiner (local) combine best elements

Repeats until convergence (threshold 0.90) or max phases (default 4). Supports domains: `p5`, `glsl`, `three`, `ascii`, `music`, `code`.

## Compost Mill

A living digestion system for creative material. Feed it files, directories, or previous Liminal outputs — it extracts, shreds, scores, and evolves fragments into reusable seeds.

**Pipeline:** Feed → Extract (3 layers) → Shred → Mix (cross-domain collisions) → Mine (score + promote) → Digest → Prune

### Key Concepts

- **Heap**: staging area for material awaiting digestion
- **Fragments**: extracted pieces with multi-dimensional scores (novelty, density, cross-domain)
- **Seed Bank**: persistent store of high-scoring promoted fragments — seeds are injected into every generation loop
- **Soup**: continuous evolutionary loop — merge random fragments, score offspring, replace worst
- **DNA Extraction**: ProjectDNA (domain, style patterns, techniques) extracted from promoted seeds

### LIR (Liminal Intermediate Representation)

Structured metadata for all seeds:
- `[code]` badges for code fragments
- `[doc]` badges for documentation
- `[text]` badges for raw text
- Signatures, metrics, headings
- Type-safe conversion between string and structured formats

### Compost CLI

```bash
liminal compost add <path>        # Add material to heap
liminal compost digest             # Run digestion pipeline
liminal compost soup start         # Start evolutionary soup loop
liminal compost soup stop          # Stop soup loop
liminal compost soup status        # Check soup status
liminal compost seeds list         # List promoted seeds (with LIR badges)
liminal compost seeds show <id>    # Show full seed details (with LIR structure)
liminal compost status             # Heap/seed/soup overview
```

## Chat Mode Commands

### Interactive Session

```bash
liminal chat
```

**Interview Questions:**
1. What do you want to create? (intent)
2. What's the context or inspiration? (context)
3. What mood should it have? (mood)
4. Any references or inspirations? (references)
5. Any constraints or requirements? (constraints)
6. Confirm creative brief? (confirmation)
7. Generation begins automatically

**During Generation:**
- Real-time thought emission shows what's happening
- Proactive suggestions appear for:
  - **Swarm**: "I can explore 7 artistic approaches"
  - **Compost**: "I have quality seeds from your past work"
  - **Evolution**: "Scores plateauing - enable MAP-Elites"
  - **Technique**: "Try Flow Fields for organic movement"
  - **Archive**: "Use high-quality examples for few-shot learning"
- Live preview renders each iteration
- Progress shows iteration count, score, completion reason

**Session Memory:**
- Conversation history preserved
- Artwork snapshots saved per iteration
- Learned preferences influence future sessions

## Artistic Knowledge Base

### Comprehensive Techniques by Domain

**p5.js (25 techniques):**
- Coordinate Systems, Shape Primitives, Color Modes
- Animation Basics, Interaction Events, Image Processing
- Typography, WebGL, Sound, Camera
- Particle Systems, Flow Fields, Cellular Automata
- L-Systems, Recursion, Physics, Data Visualization
- Terrain Generation, Grid Systems, Mathematical Patterns

**Shader/GLSL (20 techniques):**
- Raymarching, Signed Distance Functions (SDFs)
- Noise Functions (Perlin, Simplex, Worley, FBM)
- Domain Warping, Color Palettes
- Post-Processing (Bloom, Chromatic Aberration)
- Normal Mapping, Shadow Mapping
- Procedural Textures, Math Functions

**Three.js (25 techniques):**
- Scene Graph, Geometries, Materials
- Lighting, Cameras, Loaders (GLTF, OBJ)
- Animation, Tweening, Post-Processing
- InstancedMesh, LOD (Level of Detail)
- Physics, Particles, VR/AR support
- Custom Shaders, Video Textures
- Audio Integration

**Strudel/Music (18 techniques):**
- Pattern Sequencing, Temporal Modulation
- Polyrhythms, Metric Modulation
- Melody Generation, Harmonic Progression
- Timbre Design, Spatial Audio
- Microtiming, Sample Manipulation
- Probability and Chance, State Machines
- Pattern Algebra, Iterative Processes

**Hydra/Visuals (20 techniques):**
- Source Creation (osc, src, noise, s0-s3)
- Texture Modulation (mod, scroll, kaleid, pixel)
- Color Manipulation (color, colorama, saturate)
- Blending (blend, layer, mult, diff, add)
- Feedback and Recursion
- Audio Reactivity (a.show, fft[])
- Glitch and Distortion effects

### Notable Artists

**P5.js/Creative Coding:**
- Casey Reas, Ben Fry (Processing co-founders)
- Daniel Shiffet (Coding Train)
- Tyler Hobbs (Quil, generative art educator)
- Golan Levin, Zach Lieberman (interactive art)
- Vera Molnar, Manfred Mohr (generative art pioneers)

**Shader/WebGL:**
- Inigo Quilez (raymarching, SDFs, Shadertoy)
- Simon Green, Patricio Gonzalez Vivo (The Book of Shaders)
- Martijn Steinrucken (shader techniques)

**Three.js/3D:**
- Ricardo Cabello (Three.js creator)
- Bruno Simon, Joshua Koo (creative coding educators)

**Music/Live Coding:**
- Timothy Heckmann (Strudel creator)
- Alex McLean (TidalCycles)
- Ellen Band, Mikael Jazuli, Claude Heiland-Allen

**Generative Art Pioneers:**
- Sol LeWitt (minimalism, conceptual art)
- Bridget Riley (Op Art, perception)
- M.C. Escher (tessellations, impossible geometry)
- John Whitney Sr., Lillian Schwartz (computer art pioneers)
- Refik Anadol, TeamLab (contemporary digital art)

### Design Principles

**Fundamental:**
- Balance, Contrast, Emphasis, Movement, Pattern, Rhythm, Unity, Variety

**Advanced:**
- Negative Space, Golden Ratio, Rule of Thirds
- Symmetry, Asymmetry, Depth, Scale, Proximity
- Closure, Continuity, Figure-Ground, Gestalt

### Art Movements

Generative Art, Algorithmic Art, Computational Art, Op Art, Minimalism, Abstract Expressionism, Kinetic Art, Digital Art, Interactive Art, Installation Art, Sound Art, Data Art, Glitch Art, AI Art, Creative Coding, Live Coding, Procedural Generation

### Color Theory

Complementary, Analogous, Triadic, Split-Complementary, Tetradic, Warm/Cool Colors, Saturation, Value, Hue, HSB/HSL, CMYK, Grayscale, Gradient, Palettes

### Composition

Golden Ratio, Rule of Thirds, Symmetry, Asymmetry, Leading Lines, Framing, Perspective, Depth, Scale, Point of View, Cropping, Negative Space, Visual Hierarchy, Focal Point

## Smart Model Routing

GeneratorRegistry includes intelligent routing based on domain detection and performance data:

```javascript
const registry = generatorRegistry;
const decision = registry.routeByPrompt("create a particle system");
// → { model: 'local', reason: 'p5 domain with particle techniques', confidence: 0.92 }
```

Routes between:
- **Local models**: Qwen 3.5-4B (LM Studio)
- **Cloud models**: Minimax, Inference, etc.
- **Hybrid mode**: Combines multiple models for optimal results

**Dynamic Learning**: Routing updates from actual generation outcomes via `recordRoutingOutcome()` and `getRollingPerformance()`.

## Live Music Coding

Generate live code for Strudel (TidalCycles), Hydra (audio-reactive visuals), and more.

```bash
liminal --prompt "ambient glitch set" --mode live-music --output ./set
# Writes: ./set/strudel.js, ./set/hydra.js
```

Music-to-visual bridge: `generateMusicToVisual()` extracts BPM/FFT from music output and passes it to visual generation.

## GUI & Web Interface

The web GUI has full support for all features:

- **`/api/run`** — All LoopOptions including swarm, collab, MAP-Elites, archive learning, aesthetic model, auto-compost
- **`/api/compost/dashboard`** — Compost statistics with top seeds displayed
- **`/api/compost/add`** — Feed gallery outputs to compost heap
- **Archive Integration** — Gallery projects auto-fed to compost
- **Real-time Updates** — SSE event streaming for live progress
- **Chat Mode** — Full interview-driven creative sessions with guidance

## CLI Commands

```bash
# Generation
liminal --prompt "Create a particle system"              # Basic generation
liminal -p "sketch" -m 10 -o ./output                    # Short flags
liminal --prompt "idea" --use-swarm --swarm-mode hybrid   # Swarm mode
liminal --prompt "music" --mode live-music                # Live music

# Chat Mode
liminal chat                                            # Interview-driven creative session

# Compost System
liminal compost add <path>                                # Add material to heap
liminal compost digest                                   # Run digestion pipeline
liminal compost soup start                                # Start evolutionary soup loop
liminal compost soup stop                                 # Stop soup loop
liminal compost soup status                               # Check soup status
liminal compost seeds list                                # List promoted seeds (with LIR badges)
liminal compost seeds show <id>                           # Show seed details
liminal compost status                                    # Heap/seed/soup overview

# Project Management
liminal list                                               # List saved sketches
liminal serve 3456                                        # Preview server
liminal --recent 10                                        # Recent prompts
liminal --interactive                                      # TUI mode
liminal --configure                                        # Setup config
liminal --favorites                                        # List favorites
```

## Programmatic API

```javascript
import { run, generatorRegistry } from './dist/index.js';
import { SemanticArtMemory } from './dist/brain/SemanticMemory.js';
import { PromptEnhancer } from './dist/brain/PromptEnhancer.js';

// Basic generation
const result = await run("Create a particle system", {
  maxIterations: 10,
  timeoutMinutes: 5,
  project: 'particle-test',
  galleryDir: 'gallery'
});

// With art brain and prompt enhancement
const artMemory = new SemanticArtMemory();
const enhancer = new PromptEnhancer(artMemory);

const enhanced = enhancer.enhancePrompt("Create organic flow patterns", {
  domain: 'p5',
  intent: 'flow',
  mood: 'calm',
  complexity: 'medium'
});

// Run with enhanced prompt
const result = await run(enhanced.prompt, {
  chatMode: true,
  onThought: (thought) => console.log(`[Thought] ${thought}`),
  onIteration: (ctx) => console.log(`[${ctx.iteration}] Score: ${ctx.evaluation.score}`),
  onSuggestion: (sugg) => console.log(`[Suggestion] ${sugg.title}: ${sugg.description}`)
});
```

## Safety & Quality

- **Quality Gates**: Minimum quality thresholds prevent poor outputs from continuing
- **Safety Guardrails**: API call limits, resource constraints
- **Stagnation Detection**: Prevents infinite loops with score trend analysis
- **Promise Detection`: Terminates when `<promise>COMPLETE</promise>` found in code
- **Timeout Protection**: Configurable time limits per generation
- **Graceful Degradation**: Tolerant of failures when enabled

## Performance Features

- **Concurrent Processing**: Parallel model execution in swarm and collab modes
- **Caching**: Compost parsing cached, semantic search results cached
- **Lazy Loading**: Knowledge base loaded on first use
- **Batch Processing**: Efficient handling of multiple generations

## Testing

- **2218 tests passing** (Vitest)
- **Test coverage**: Core systems, brain modules, chat system, compost pipeline
- **Integration tests**: End-to-end flows verified
- **Unit tests**: Individual component testing with mocks

## Development Status

### ✅ Implemented (Phases 1-4)

**Phase 1: Core Loop** - Ralph-Wiggum iteration engine
**Phase 2: Brain & Memory** - SemanticArtMemory, EpisodicMemory, ArtKnowledgeGraph
**Phase 3: Chat & Guidance** - Interview flow, proactive suggestions, real-time updates
**Phase 4: Creative Knowledge** - 100+ techniques, 30+ artists, comprehensive artistic taxonomies

### 🚧 In Progress

**Phase 5**: Advanced features and integrations

### 📋 Planned

- Additional interview questions (expand from 7 to 11)
- Enhanced persistent memory across sessions
- GUI improvements and additional features

## Contributing

This is an active creative coding project. See `/docs` for architecture details and development roadmap.

## License

MIT

---

**Liminal v1.0** — "The code evolves. You curate. The system learns."
