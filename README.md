# Liminal — Creative Coding Agent

[![CI](https://github.com/Pastorsimon1798/liminal/actions/workflows/ci.yml/badge.svg)](https://github.com/Pastorsimon1798/liminal/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node](https://img.shields.io/node/v/liminal-ai)](https://nodejs.org/)

> "The code evolves. You curate. The system learns."

A sophisticated generative art system with an internal Ralph-Wiggum Loop for self-recursive iteration, comprehensive artistic knowledge, and intelligent guidance. Supports p5.js visuals, live music coding (Strudel/Hydra), multi-model swarm generation, deep collaboration, chat-based creative sessions, and a living Compost Mill for digesting creative material.

## 🧠 Unique Innovations

Liminal is not just another code generator. It pioneers two unique approaches to working with LLMs:

### 1. Compost Mill — Evolutionary Code Synthesis

**What it does**: Digests previous generations (working and broken) into nutrient-rich seeds for future evolution.

**ML Concept**: Genetic programming with neural guidance

**Why it matters**: Your past work continuously improves your future output. The system learns *what* to generate.

### 2. Thinking-Trace Feedback Loop — Meta-Learning from Reasoning

> **Unique to Liminal**: Unlike any other creative coding tool, we capture and learn from the model's *reasoning process*, not just its output.

**What it does**: Extracts `<think>` tags and reasoning traces, analyzes patterns in model behavior, and adapts prompts automatically.

**ML Concepts**: 
- **Reasoning Distillation** — Extracting intent from model monologues
- **Adversarial Failure Mining** — Learning from empty outputs with rich thinking
- **Meta-Learning** — The harness learns how the generator thinks

**Why it matters**: When Minimax M2.7 returned "empty code," traditional systems would discard it. Liminal discovered it was putting code *inside* `<think>` tags and now recovers it automatically. The system learns *how* to prompt.

**The Philosophy**: *Nothing is waste. Model thinking is the richest training data you have.*

📖 **Learn more**: [Feature Documentation](./docs/features/README.md)

## Table of Contents

- [Quick Start](#quick-start)
- [Usage](#usage)
- [Architecture](#architecture)
- [Contributing](#contributing)
- [License](#license)

## Quick Start

```bash
pnpm install

# Configure an LLM backend (required for generation)
liminal --configure          # Sets up LM Studio at localhost:1234

# Or set env vars directly
export LIMINAL_LLM_PROVIDER=lmstudio
export LIMINAL_LLM_MODEL=qwen2.5-coder-7b-instruct

# Generate art
liminal --prompt "Create a calming blue particle system"

# Start creative chat session
liminal chat
```

## Security Configuration

Liminal uses environment variables for sensitive configuration. Copy `.env.example` to `.env` and customize:

```bash
cp .env.example .env
```

**Important Security Notes:**
- Never expose internal IP addresses or credentials in source code
- Only configure LLM base URLs pointing to trusted endpoints
- Keep your `.env` file out of version control (it's already in `.gitignore`)
- For production deployments, use proper secret management systems

📖 **Full Security Guide**: See [`docs/SECURITY.md`](docs/SECURITY.md) for comprehensive security documentation including:
- Production deployment checklist
- SSRF protection details
- Rate limiting configuration
- Sandbox security guidelines
- Incident response process

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
│  • 12+ artistic style categories and approaches       │
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
│  • 12+ artistic style categories by domain                                           │
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

## Meta-Harness (Self-Improving Infrastructure)

Liminal includes a **Meta-Harness** that observes failures, detects patterns, and updates the harness itself. It implements the principle: *"Never fix broken output programmatically — update the harness so the next output isn't broken."*

### How It Works

```
┌─────────────────────────────────────────────────────────────────────┐
│                      META-HARNESS (Outer Loop)                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  FailureLogger  →  PatternDetector  →  HarnessUpdater                │
│        │                  │                   │                      │
│        ▼                  ▼                   ▼                      │
│  ~/.liminal/         Known Patterns      Applied Adaptations        │
│  failures/           (6 patterns)        (logged + reported)        │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼ observes
┌─────────────────────────────────────────────────────────────────────┐
│                    GENERATOR LOOP (Inner Loop)                       │
│              (p5, GLSL, Tone.js, Strudel, etc.)                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Known Failure Patterns

| Pattern | Affected Models | Solution |
|---------|-----------------|----------|
| **Qwen Thinking Trap** | Qwen3.5 family | Simplified prompts, thinking field extraction |
| **GLSL Undefined Functions** | All models | Semantic validation, required function injection |
| **Tone.js API Hallucinations** | Smaller models | API whitelist validation |
| **Strudel/Tidal Confusion** | All models | Anti-patterns section, syntax distinction |
| **ASCII Timeout** | Larger prompts | Reduced default dimensions |
| **HTML 404 Errors** | Endpoint routing | Native Ollama API support |

### Usage

```typescript
import { failureLogger, patternDetector, harnessUpdater } from 'liminal';

// Log a failure
failureLogger.log({
  model: 'qwen3.5:14b',
  domain: 'p5',
  prompt: 'complex particle system',
  error: 'Request timed out',
  errorType: 'timeout',
  thinking: modelResponse.thinking,
  duration: 30000
});

// Analyze patterns
const patterns = patternDetector.analyze(failure);
for (const pattern of patterns) {
  await harnessUpdater.applyAdaptation(pattern);
}

// Generate report
console.log(harnessUpdater.generateReport());
```

### Key Features

- **FailureLogger**: Auto-saves to `~/.liminal/failures/{id}.json` with rich context
- **PatternDetector**: 6 known patterns from dogfooding with configurable detectors
- **HarnessUpdater**: Automatic adaptation tracking and report generation
- **Model-Specific Adaptations**: Qwen detection, simplified prompts, Ollama native API
- **Domain Validation**: GLSL semantic checks, Tone.js API whitelist, Strudel anti-patterns

## Generation Modes

| Mode | Flag | Description |
|------|------|-------------|
| **Single LLM** | default | One model generates, evaluates, iterates |
| **Swarm** | `--use-swarm` | 5 Ollama personas generate in parallel, vote on best |
| **Deep Collab** | `useDeepCollab` option | 3-phase: Diverge → Analyze → Synthesize |
| **Collab Engine** | `collabMode` option | Unified: swarm / phases / simple strategies |
| **Live Music** | `--mode live-music` | Generate Strudel + Hydra code, write to disk |
| **Organism** | `mode: 'organism'` option | Music-to-visual pipeline with context accumulation |

## Swarm Generation

5 creative personas run via Ollama in parallel, each with a distinct voice:

| Persona | Role | Model | Family |
|---------|------|-------|--------|
| Kai (Architect) | Structural, analytical | `lfm2.5-thinking:1.2b` | LFM |
| Nova (Synthesizer) | Connective, integrative | `gemma3:4b` | Gemma |
| Rex (Explorer) | Provocative, boundary-ping | `phi4-mini` | Phi |
| Sam (Muse) | Sensory, evocative | `qwen3.5:2b` | Qwen |
| Max (Distiller) | Precise, compressed | `granite4:350m` | Granite |

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
  - "Starting iteration 1..."
  - "Loading enhanced prompt with artistic context..."
  - "Generating code with local model..."
  - "Evaluating output..."
  - "Saving to gallery..."
- Proactive suggestions appear for:
  - **Swarm**: "I can explore 7 artistic approaches - want me to?"
  - **Compost**: "I have 15 quality seeds from your past work. Want me to inject them?"
  - **Evolution**: "Scores are plateauing. MAP-Elites can help break through."
  - **Technique**: "Try Flow Fields technique for organic movement"
  - **Archive**: "I have 8 high-quality examples - use archive learning?"
- Live preview renders each iteration
  - Automatic HTML rendering with live preview
  - Shows iteration number, score, and completion reason
  - Progress updates during generation
- Progress shows iteration count, score, completion reason

**Session Memory:**
- Conversation history preserved
- Artwork snapshots saved per iteration
- Learned preferences influence future sessions
- Continuous learning from your creative choices

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

### Artistic Style Categories

**P5.js/Creative Coding Styles:**
- Generative and algorithmic art approaches
- Interactive installation and responsive systems
- Data visualization and information aesthetics
- Educational and exploratory coding practices

**Shader/WebGL Styles:**
- Raymarching and SDF-based rendering
- Procedural texture generation
- Physically-based rendering techniques
- GLSL optimization patterns

**Three.js/3D Styles:**
- Interactive 3D environments
- WebGL-based creative coding
- Shader integration techniques
- Performance optimization strategies

**Music/Live Coding Styles:**
- Pattern-based algorithmic composition
- Real-time improvisational coding
- Networked collaborative performance
- Visual music and audio-reactivity

**Historical Art Styles:**
- Minimalist conceptual approaches
- Optical pattern and perception-based art
- Mathematical and geometric art
- Early computer and plotter-based art
- Contemporary ML-generated and immersive styles

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
- **Local models**: LM Studio (Qwen 2.5-Coder-7B-Instruct, etc.)
- **Cloud models**: Minimax, OpenAI, Anthropic, etc.
- **Hybrid mode**: Combines multiple models for optimal results

**Dynamic Learning**: Routing updates from actual generation outcomes via `recordRoutingOutcome()` and `getRollingPerformance()`.

**Dual-Model Router**: Intelligently chooses between models based on:
- Domain detection (p5 → local, GLSL → local, music → cloud, etc.)
- Performance history (success rates, average scores)
- Cost considerations (local vs cloud pricing)
- Latency requirements (real-time vs batch)

## Preview Rendering

Every generation includes live HTML preview rendering:

```javascript
// Automatic preview during generation
{
  previewHtml: `<html>...</html>`,  // Full HTML document
  previewUrl: `file:///path/to/preview.html`
}
```

**Features:**
- Auto-generated HTML with embedded p5.js/sketch.js
- Live reload in browser
- Shows iteration number and score
- Clean shutdown on completion or error
- Works with all generation modes (single, swarm, collab, live-music)

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
- **Promise Detection**: Terminates when `<promise>COMPLETE</promise>` found in code
- **Timeout Protection**: Configurable time limits per generation
- **Graceful Degradation**: Tolerant of failures when enabled

## Performance Features

- **Concurrent Processing**: Parallel model execution in swarm and collab modes
- **Caching**: Compost parsing cached, semantic search results cached
- **Lazy Loading**: Knowledge base loaded on first use
- **Batch Processing**: Efficient handling of multiple generations

## Voice & Audio Pipeline

Voice and audio input drives visual parameter generation through signal processing:

```
Audio Input → AudioAnalyzer → Features (RMS, spectral, MFCC)
                ↓
         PitchDetector → F0 with autocorrelation + Hann window
         TimbreExtractor → Spectral centroid, flatness, rolloff
                ↓
         AudioToVisualMapper → VisualMappingParams
              ├── PitchColorMapper → 12 pitch classes → chromatic-circle hues
              ├── FormantAnalyzer → MFCC F1/F2 → shape complexity
              ├── BPMKeyDetector → tempo + musical key detection
              └── VoiceToShapeMapper → energy→radius, pitch→height, onset→bump
```

**CLI flags**: `--voice` (microphone), `--voice-file <path>` (WAV/MP3), `--aesthetic <preset>`, `--aesthetic-config <path>`

### Aesthetic Guardrails

4 static critics evaluate generated code before it passes the quality gate:

| Critic | What it checks |
|--------|----------------|
| **ColorHarmonyCritic** | Hex/RGB/HSL color extraction, palette harmony analysis |
| **LayoutCritic** | Canvas dimensions, position validation, centering detection |
| **TypographyCritic** | Font size bounds, unloaded font detection |
| **SoundHarmonyCritic** | Frequency extraction, interval consonance, gain warnings |

5 presets: `minimalist`, `vibrant`, `cinematic`, `playful`, `free`

## Music Theory Engine

Full music theory system for algorithmic composition:

| Module | Purpose |
|--------|---------|
| **TheoryEngine** | 14 scales, 7 chord types, MIDI conversion, quantization |
| **EuclideanRhythm** | Bjorklund's algorithm for polyrhythmic patterns |
| **MarkovChain** | Order 1-4 transition matrix melody generation |
| **Arpeggiator** | 5 modes (up/down/upDown/downUp/random) |
| **RhymeEngine** | Vowel-group-based rhyme classification |
| **SyllableCounter** | Syllable constraint validation for lyrics |
| **StructureTemplates** | 5 song structures (pop/rap/ballad/punk/singer-songwriter) |

```javascript
import { MusicTheory } from './dist/music/generateMusic.js';

// Generate a Euclidean rhythm pattern
const pattern = MusicTheory.generateEuclideanPattern(8, 5); // [1,0,1,0,1,0,1,1]

// Build a Markov chain from a seed melody and generate new melodies
const chain = MusicTheory.buildTransitionMatrix([60, 64, 67, 72, 67, 64], 2);
const melody = MusicTheory.generateMarkovMelody(chain, 16, 60);

// Get scale notes and generate a chord progression
const notes = MusicTheory.getScaleNotes('C', 'major');
const progression = MusicTheory.generateProgression('C', 'major', 4);
```

## Creative Intelligence

### Ambiguity Detection

Before generation begins, prompts are analyzed for ambiguity:

```javascript
import { AmbiguityDetector } from './dist/core/AmbiguityDetector.js';

const detector = new AmbiguityDetector();
const issues = detector.detect("make something cool with particles");
// → [{ type: 'vague_terms', severity: 'high', description: '..."cool" is vague' },
//    { type: 'missing_context', severity: 'medium', description: 'No domain specified' }]
```

4 detection strategies: vague terms, missing context, contradictions, multiple approaches.

### Creative Preference Extraction

Automatically discovers user style preferences from prompts and conversations:

```javascript
import { CreativePreferenceExtractor } from './dist/brain/CreativePreferenceExtractor.js';

const extractor = new CreativePreferenceExtractor();
const profile = extractor.extractFromPrompt(
  "I love dark moody glitch art with neon accents and organic flow"
);
// → { styles: ['glitch', 'dark', 'moody'], colors: ['neon'], confidence: 0.8 }
```

### Cross-Domain Crossover

Bidirectional technique transfer between creative domains:

```javascript
import { CrossDomainCrossover } from './dist/evolution/CrossDomainCrossover.js';

const crossover = new CrossDomainCrossover();
const adapted = crossover.crossoverReasoning('visual', 'music', 'particle system');
// → Maps visual particle concepts to musical grain-cloud techniques
```

### Symbolic Creative Language

Emergent vocabulary that evolves based on creative effectiveness:

```javascript
import { SymbolicCreativeLanguage } from './dist/brain/SymbolicCreativeLanguage.js';

const lang = new SymbolicCreativeLanguage();
lang.discoverSymbols("Flowing particles with organic noise patterns");
const composition = lang.composeFromSymbols(lang.getActiveSymbols());
```

## Multi-Agent Creative Critique

The CreativeBoard runs 3 heuristic critics in deliberation:

| Agent | Philosophy | Temperature |
|-------|-----------|-------------|
| **The Minimalist** | Simplicity, restraint, negative space | 0.3 |
| **The Expressionist** | Surprise, bold choices, variety | 0.8 |
| **The Technician** | Correctness, performance, standards | 0.2 |

Each agent produces a stance (for/against/neutral), then the board synthesizes tensions, consensus, risks, and recommendations into a weighted aggregate score.

```javascript
import { CreativeBoard } from './dist/collab/CreativeBoard.js';

const board = new CreativeBoard();
const result = board.deliberate(code, 'p5', { technical: 0.8, creative: 0.7 });
// → { stances, tensions, consensusPoints, risks, recommendedActions,
//     overallVerdict: 'approve'|'revise'|'reject', aggregateScore: 0.0-1.0 }
```

Blended with baseline evaluation: `finalScore = baseline * 0.6 + boardScore * 0.4`

## Smart Routing & Circuit Breaker

### QualityPredictor

Routes prompts to optimal models based on complexity and history:

```javascript
import { QualityPredictor } from './dist/routing/QualityPredictor.js';

const predictor = new QualityPredictor();
const recommendation = predictor.recommend('glsl', 'complex', { fast: true });
// → { provider: 'local', confidence: 0.85, reasoning: '...' }
```

### CircuitBreaker

Provider failover with state machine (closed → open → half-open):

```javascript
import { CircuitBreaker } from './dist/llm/CircuitBreaker.js';

const breaker = new CircuitBreaker({ failureThreshold: 3, resetTimeoutMs: 30000 });
if (breaker.canExecute()) {
  try { await callLLM(); breaker.recordSuccess(); }
  catch { breaker.recordFailure(); }
}
```

## Color Theory & Design

### ColorTheoryEngine

7 harmony rules with hue offset generation:

```javascript
import { ColorTheoryEngine } from './dist/aesthetic/ColorTheoryEngine.js';

const engine = new ColorTheoryEngine();
const palette = engine.generateHarmony(0.6, 'triadic');
// → { base: 0.6, hues: [0.6, 0.933, 0.267], rule: 'triadic' }
```

Supports: monochromatic, analogous, complementary, split-complementary, triadic, tetradic, square.

### Progressive Design Tiers

5-tier quality progression for iterative refinement:

| Tier | Score Threshold | Description |
|------|----------------|-------------|
| Glitch | 0.0 | Raw output, may be broken |
| Basic | 0.3 | Minimal viable visual |
| Functional | 0.5 | Complete and interactive |
| Refined | 0.7 | Polished with good aesthetics |
| Perfect | 0.9 | Gallery-quality output |

### Glitch Effects

Code generation for p5.js glitch aesthetics:

```javascript
import { GlitchEffects } from './dist/generators/effects/GlitchEffects.js';

const code = GlitchEffects.generate({ scanlines: true, chromaticAberration: true, distortion: 0.5 });
```

## Testing

- **2500+ tests passing** (Vitest) — Full coverage across all systems
- **Test coverage**: Core systems, brain modules, chat system, compost pipeline, LIR system, audio pipeline, music theory, aesthetic critics, multi-agent critique
- **Integration tests**: End-to-end flows verified
- **Unit tests**: Individual component testing with mocks
- **Test suites**: 170+ test files covering every subsystem

## What Liminal Can Do

### 🎨 Generate Art
- **p5.js sketches**: Particle systems, flow fields, fractals, cellular automata, terrain generation
- **GLSL shaders**: Raymarching, SDFs, noise, domain warping, post-processing effects
- **Three.js scenes**: 3D compositions, animations, interactive experiences
- **Live music**: Strudel patterns, Hydra visuals with audio reactivity
- **Hybrid works**: Music-to-visual pipelines, cross-domain compositions

### 🧠 Think Like An Artist
- **100+ techniques** across all creative domains
- **12+ artistic style categories** representing diverse approaches
- **Design principles** automatically applied (balance, contrast, emphasis, movement, unity, variety)
- **Color theory** integration (complementary, analogous, triadic palettes)
- **Composition rules** (golden ratio, rule of thirds, leading lines, symmetry)
- **Mood enhancement** (calm, energetic, mysterious, playful, melancholic, abstract)

### 🔄 Improve Iteratively
- **Self-critique**: Each iteration evaluated on aesthetic and technical dimensions
- **Stagnation detection**: Recognizes when stuck and suggests alternatives
- **Quality gates**: Poor outputs filtered out automatically
- **Promise detection**: Stops when code signals completion
- **Progressive refinement**: Each build builds on previous successes

### 👥 Collaborate With You
- **Interview mode**: 7-question creative brief to understand your vision
- **Proactive guidance**: Suggests techniques, compost seeds, swarm exploration at right moments
- **Real-time feedback**: Shows what it's thinking, why it's making choices
- **Interactive suggestions**: Accept or decline guidance during generation
- **Session memory**: Remembers your preferences across sessions

### 🌱 Learn From Experience
- **Compost Mill**: Digests your past work into reusable creative DNA
- **Seed bank**: Quality fragments automatically injected into future generations
- **Evolutionary soup**: Continuous improvement of seed population
- **Archive learning**: Few-shot learning from high-quality examples
- **Semantic search**: Find relevant past work by concept, mood, technique

### 🎭 Multiple Creative Personas
- **Kai (Architect)**: Structural, analytical approach
- **Nova (Synthesizer)**: Connective, integrative thinking
- **Rex (Explorer)**: Provocative, boundary-pushing ideas
- **Sam (Muse)**: Sensory, evocative descriptions
- **Max (Distiller)**: Precise, compressed solutions
- **7-persona swarm**: Parallel generation with voting or hybrid synthesis

### 🎵 Make Live Music & Visuals
- **Strudel patterns**: Rhythmic, harmonic, textural compositions
- **Hydra visuals**: Audio-reactive graphics in real-time
- **Pattern algebra**: Mathematical approaches to music
- **Temporal modulation**: Time-based evolution
- **Microtiming & polyrhythms**: Advanced rhythmic techniques

### 📊 Track & Optimize
- **MAP-Elites**: Performance archive with behavioral diversity
- **Novelty archive**: Tracks unique behaviors for exploration
- **Aesthetic model**: Predicts quality before generation
- **Score tracking**: Iteration-by-iteration progress
- **Performance metrics**: Model routing optimization

## Why Liminal Is Different

**Not just another AI art tool:**

1. **Self-Recursive**: The system critiques its own output and improves iteratively
2. **Knowledge-Rich**: 100+ techniques, 12+ style categories, design principles, color theory embedded
3. **Context-Aware**: Understands mood, intent, domain, and adjusts accordingly
4. **Guidance-Driven**: Proactively suggests next actions based on current state
5. **Memory-Enhanced**: Learns from your past work via Compost Mill
6. **Multi-Modal**: p5, shaders, Three.js, Strudel, Hydra — all integrated
7. **Collaborative**: Swarm of personas, deep collaboration with specialized roles
8. **Transparent**: Shows thoughts, suggestions, and reasoning in real-time

**The difference:**

Most AI art tools generate once. Liminal generates, evaluates, critiques, learns, and improves — until the work is complete or it discovers something new.

## Development Status

### Implemented

**Phase 1: Core Loop** — Ralph-Wiggum iteration engine
- Generate → Evaluate → Accumulate → Enhance → Check
- Quality gates, stagnation detection, promise detection
- Swarm mode, deep collaboration, live music mode
- Multi-model routing and performance tracking

**Phase 2: Brain & Memory** — SemanticArtMemory, EpisodicMemory, ArtKnowledgeGraph
- Semantic search across artworks, techniques, styles
- Episodic memory for learning from user preferences
- Rich knowledge graph with relationships between concepts
- Compost Mill for digesting creative material

**Phase 3: Chat & Guidance** — Interview flow, proactive suggestions, real-time updates
- 7-question creative brief interview
- Proactive suggestions (swarm, compost, techniques, evolution, archive)
- Real-time thought emission and progress updates
- Live preview rendering during generation
- Session history and memory

**Phase 4: Creative Knowledge** — 100+ techniques, 12+ style categories, comprehensive artistic taxonomies
- Comprehensive artistic knowledge base
- Prompt enhancement with domain-specific vocabulary
- Mood-based artistic context injection
- Intent-based technique suggestions
- Artist reference recommendations

**Phase 5: Voice & Audio Pipeline** — Signal processing to visual parameter mapping
- AudioAnalyzer with Meyda + pitchfinder integration
- Pitch-to-color mapping via chromatic circle (12 pitch classes)
- Formant analysis for phoneme-to-geometry mapping
- BPM and key detection for composition guidance
- Voice-to-shape mapping (energy, pitch, onset)
- Aesthetic guardrails with 4 static critics + 5 presets

**Phase 6: Music Theory Engine** — Algorithmic composition toolkit
- 14 scales, 7 chord types, diatonic progressions
- Euclidean rhythm generation (Bjorklund's algorithm)
- Markov chain melody generation (order 1-4)
- Arpeggiator with 5 modes
- Rhyme classification and syllable counting
- Song structure templates (5 genres)

**Phase 7: Creative Intelligence** — Prompt analysis and preference learning
- Ambiguity detection (4 strategies)
- Creative preference extraction from prompts
- Cross-domain technique crossover
- Symbolic creative language with effectiveness tracking
- Specialized prompt templates (evaluation, chat, design)

**Phase 8: Multi-Agent Critique** — Deliberative creative evaluation
- 3-agent CreativeBoard (Minimalist/Expressionist/Technician)
- Heuristic stance analysis with tension/consensus extraction
- Evaluation memos with builder pattern
- Board-blended scoring (60% baseline + 40% board)

**Phase 9: Smart Infrastructure** — Routing, resilience, and creative tools
- CircuitBreaker for provider failover
- QualityPredictor for model routing
- BatchProcessor for concurrent operations
- ColorTheoryEngine with 7 harmony rules
- GlitchEffects, ProgressiveDesignTiers, StyleBlender
- CreativeConstraints and CreativeWorkflow

**Phase 10: LIR Integration** — Structured code analysis in evaluation
- GeneratedCodeParser for ephemeral LIR token extraction
- Dual-path critics (LIR-aware when tokens available, regex fallback)
- CreativeEvaluator.assessWithLIR() with metric overlay
- Feature-flagged (lirEnabled) with cold fallback

## Contributing

This is an active creative coding project. See `/docs` for architecture details and development roadmap.

## License

MIT

---

**Liminal v1.0** — "The code evolves. You curate. The system learns."
