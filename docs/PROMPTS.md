# Prompt System Reference

## Overview

Liminal uses a centralized `PromptLibrary` registry for all LLM prompts. Prompts are registered at module load time via side-effect imports in `src/prompts/index.ts`. Every prompt follows a structured format with role, constraints, output format, and domain rules.

## Architecture

```
src/prompts/
├── PromptLibrary.ts      # Core registry with register/render/stats/validate/exportAll
├── index.ts              # Side-effect imports that trigger registration
├── p5.ts                 # p5.js generation + improvement prompts
├── three.ts              # Three.js 3D scene generation prompt
├── glsl.ts               # GLSL fragment shader generation prompt
├── music.ts              # Strudel + p5-webaudio music prompts
├── hydra.ts              # Hydra live-coding visual prompt
├── swarm.ts              # Swarm voting prompt
├── collaboration.ts      # DOMAIN_GUIDANCE + role prompt constants
├── collab-internal.ts    # Registered collab role/internal prompts
└── personas.ts           # Registered swarm persona prompts
```

## All Registered Prompts (27 total)

### Generator Prompts

| ID | Category | Template Variables | Description |
|---|---|---|---|
| `p5.generate` | p5 | `${prompt}` | Generate p5.js sketches from natural language |
| `p5.improve` | p5 | `${code}` | Improve existing p5.js sketch code |
| `three.generate` | generator | `${prompt}`, `${threeVersion}` | Generate Three.js 3D scenes (CDN v0.172.0) |
| `glsl.generate` | generator | `${prompt}` | Generate GLSL fragment shaders |
| `music.strudel` | generator | `${prompt}`, `${bpm}` | Generate Strudel mini-notation music |
| `music.p5-webaudio` | generator | `${prompt}`, `${bpm}` | Generate p5.js + Web Audio sketches |
| `hydra.generate` | generator | `${prompt}`, `${platform}`, `${audioContext}` | Generate Hydra live-coding visuals |
| `swarm.voting` | swarm | `${displayName}`, `${voice}`, `${votingBias}`, `${candidates}` | Swarm persona voting (JSON output) |

### Collaboration Role Prompts

| ID | Phase | Template Variables | Description |
|---|---|---|---|
| `collab.role.creator` | Divergence | `${prompt}`, `${domain}` | Practical, technically sound output |
| `collab.role.visionary` | Divergence | `${prompt}`, `${domain}` | Ambitious, creative output |
| `collab.role.technical-critic` | Analysis | `${prompt}`, `${domain}`, `${output}` | Technical quality analysis (1-5 scale) |
| `collab.role.artistic-critic` | Analysis | `${prompt}`, `${domain}`, `${output}` | Aesthetic quality analysis (1-5 scale) |
| `collab.role.domain-expert` | Analysis | `${prompt}`, `${domain}`, `${output}`, `${guidance}` | Domain-specific analysis (1-5 scale) |
| `collab.role.integrator` | Synthesis | `${prompt}`, `${domain}`, `${currentOutput}`, `${feedback}` | Synthesize feedback into improved version |
| `collab.role.refiner` | Synthesis | `${prompt}`, `${domain}`, `${integratedOutput}` | Final polish (no new features) |

### Collaboration Internal Prompts

| ID | Template Variables | Description |
|---|---|---|
| `collab.synthesis` | `${creatorOutput}`, `${visionaryOutput}`, `${prompt}` | Synthesize two divergent outputs |
| `collab.scoring` | `${output}` | Rate output quality (JSON: score + reasoning) |
| `collab.analysis` | `${author}`, `${originalPrompt}`, `${output}`, `${domainGuidance}` | Analyze another model's output |
| `collab.refine` | `${originalPrompt}`, `${currentOutput}`, `${feedback}` | Refine based on feedback |
| `collab.generation` | `${prompt}` | Generate creative response |
| `collab.generation.alternative` | `${prompt}` | Generate alternative creative response |

### Swarm Persona Prompts

| ID | Persona | Description |
|---|---|---|
| `swarm.persona.kai` | The Architect | Structural clarity, systems thinking |
| `swarm.persona.nova` | The Synthesizer | Cross-domain synthesis, coherence |
| `swarm.persona.rex` | The Explorer | Originality, surprise, boundary-pushing |
| `swarm.persona.sam` | The Muse | Emotional resonance, sensory vividness |
| `swarm.persona.max` | The Distiller | Economy of language, precision |

### Evaluation Prompts

| ID | Description |
|---|---|
| `eval.heuristic-persona` | Default persona for EvaluationFramework heuristic strategy |

## Domain Coverage Matrix

| Domain | DOMAIN_GUIDANCE | Generator Prompt | Collab Role Support |
|---|---|---|---|
| p5 | Yes (5 dimensions) | `p5.generate`, `p5.improve` | Yes |
| three | Yes (5 dimensions) | `three.generate` | Yes |
| glsl | Yes (5 dimensions) | `glsl.generate` | Yes |
| music | Yes (5 dimensions) | `music.strudel`, `music.p5-webaudio` | Yes |
| hydra | Yes (5 dimensions) | `hydra.generate` | Yes |
| strudel | Yes (5 dimensions) | `music.strudel` | Yes |
| webaudio | Yes (5 dimensions) | `music.p5-webaudio` | Yes |
| ascii | Yes (5 dimensions) | — | Via code domain |
| code | Yes (5 dimensions) | — | Yes |

## Adding a New Prompt

1. Choose the appropriate file (or create a new one in `src/prompts/`)
2. Import `PromptLibrary` from `./PromptLibrary.js`
3. Call `PromptLibrary.register()` with:
   - `id`: Dot-separated identifier (e.g., `category.name`)
   - `version`: Semver string (e.g., `'2.0.0'`)
   - `category`: Category string for grouping
   - `systemPrompt`: The system prompt text
   - `userPromptTemplate`: Optional user prompt with `${variable}` placeholders
   - `tags`: Array of cross-cutting tags (e.g., `['code-only', 'no-markdown']`)
   - `created` / `updated`: ISO date strings
   - `metadata`: Arbitrary key-value pairs
4. Add the side-effect import to `src/prompts/index.ts`
5. Add tests to `test/prompts/prompt-validation.test.ts`
6. Run `npm run build && npm test` to verify

## Versioning Policy

Prompts follow semver:
- **Major (X.0.0)**: Breaking changes to template variables or output format
- **Minor (x.Y.0)**: New template variables (backward compatible)
- **Patch (x.y.Z)**: Text improvements, constraint additions

All prompts are currently at version `2.0.0` following the March 2026 prompt engineering overhaul.

## Model-Specific Adaptations

Liminal adapts prompts based on the target model to handle known failure patterns:

### Qwen Models (Thinking Trap)

Qwen models can get stuck in "thinking mode," consuming all tokens without outputting code. The system detects Qwen models and applies simplified prompts:

```typescript
// Detected via: model.toLowerCase().includes('qwen')
// Simplified prompt structure:
const simplifiedSystem = 'You are a creative coder. Generate p5.js sketches.';
const simplifiedUser = `Create a p5.js sketch: ${prompt}\n\nOutput ONLY JavaScript code (no explanations):`;
```

**Fallback**: If the response is empty but the `thinking` field contains code, the system extracts code from there.

### Strudel Anti-Patterns

The `music.strudel` prompt includes explicit anti-patterns to prevent TidalCycles Haskell syntax confusion:

```
ANTI-PATTERNS (NEVER DO):
- NEVER use Haskell $ or # operators — these don't exist in Strudel
- NEVER write "d1 $" — Strudel doesn't use d1, d2, etc.
- NEVER use bare s("bd") without $: prefix
- NEVER write patterns like "s1 [c4, c3]" — this is not valid syntax

CORRECT:
$: s("bd*4, sd*2, hh*8")
stack(
  $: s("bd*4"),
  $: s("~ sd ~ sd")
)
```

### GLSL Semantic Validation

GLSL prompts include required function definitions to prevent undefined function errors:

```glsl
// Required definitions that must be included:
float hash(float n) { return fract(sin(n) * 43758.5453123); }
float noise(vec3 x) { /* ... */ }
float fbm(vec3 x) { /* ... */ }
```

The validator catches:
- Undefined functions (noise, fbm, hash without definitions)
- Invalid operators (`%` instead of `mod()`)

### Tone.js API Whitelist

Tone.js generation uses an API whitelist to catch hallucinated classes:

```typescript
const validToneClasses = [
  'Synth', 'AMSynth', 'FMSynth', 'PolySynth', 'MembraneSynth', 'MetalSynth',
  'Reverb', 'Delay', 'Distortion', 'Chorus', 'Phaser', 'Tremolo',
  'Pattern', 'Sequence', 'Transport', 'Master', 'Gain', 
  'Oscillator', 'Noise', 'Filter', 'Envelope', 'LFO'
];
// Catches: Tone.Reverberator, Tone.DrivingPattern, Tone.ReverbNode (hallucinations)
```

## Usage

```typescript
import { PromptLibrary } from './prompts/index.js';

// Render a prompt with variables
const { system, user } = PromptLibrary.render('p5.generate', {
  prompt: 'flowing particle system',
});

// Get raw template
const template = PromptLibrary.get('p5.generate');

// Validate all prompts
const issues = PromptLibrary.validate().filter(r => !r.valid);

// Get stats
const stats = PromptLibrary.stats();
// { total: 27, byCategory: { p5: 2, generator: 4, ... }, ids: [...] }
```
