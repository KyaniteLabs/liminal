# Atelier — Creative Coding Agent PRD

**Status:** Ready for Implementation  
**Author:** Liam (coordinator)  
**Date:** 2026-03-01  
**Version:** 1.0  

---

## 1. Executive Summary

Atelier is a **single-purpose creative coding agent** with an **internal Ralph-Wiggum Loop**. It generates emergent generative art through self-recursive iteration — the same prompt runs repeatedly, but the "world" (files, context, history) changes each time.

**Core Philosophy:** *"The code evolves. You curate."*

**Key Constraint:** Strict TDD (Red-Green-Refactor). Kai implements. Liam super-tests.

---

## 2. Ralph-Wiggum Loop (Internal)

### 2.1 Core Mechanism

```
while true:
  atelier.generate(prompt)      # Same prompt every iteration
  atelier.render()              # Preview output
  atelier.evaluate()            # Creative quality check
  atelier.accumulate()          # Save state, update context
  if "<promise>COMPLETE</promise>" in output: break
  # World changed, loop continues
```

### 2.2 Key Insight

> "The prompt never changes, but the world does."

Each iteration, the agent sees:
- Previous work (files in workspace)
- Git history of changes
- Test results, render output, error messages
- Iteration history (v1, v2, v3...)

This creates a **self-referential feedback loop** — the agent critiques and improves its own previous output.

### 2.3 Completion Criteria

**Promise Tag:** `<promise>COMPLETE</promise>`

- Exact string matching to stop loop
- Agent only outputs this when **actually complete**
- False promises defeat the purpose

**Safety Nets:**
- `--max-iterations 20` (hard stop)
- Quality gates (creative evaluator must pass)
- Timeout protection (30 min per iteration max)

### 2.4 Independence from BrainLoop

| | Ralph-Wiggum (Atelier Internal) | BrainLoop (External Tool) |
|---|---|---|
| **Prompt** | Same every iteration | Changes (diverge→critique→synthesize) |
| **Agents** | Single agent, recursive | Multiple perspectives (Liam/Kai/Teo) |
| **Decision** | Self-evaluation | Structured synthesis |
| **Integration** | Internal to Atelier | External tool |
| **Purpose** | Iterative refinement | Multi-perspective analysis |

**Critical:** Atelier has **zero dependency** on BrainLoop. Completely independent implementation.

---

## 3. Architecture

### 3.0 Substrate

Atelier's substrate = prompt (optional {{context}}) + context injection + evaluation (CreativeEvaluator) + termination (promise, max-iterations, quality gate).

### 3.1 System Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  USER INPUT                                                │
│  "Make something that feels like Kid A"                     │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  ATELIER RALPH-WIGGUM LOOP (INTERNAL)                      │
│                                                             │
│  while iterations < max_iterations:                        │
│    ├─ PromptStore.load(prompt)                             │
│    ├─ Generator.create(prompt, context)                    │
│    ├─ Renderer.preview(output)                             │
│    ├─ CreativeEvaluator.assess(output)                     │
│    ├─ ContextAccumulation.save(state)                      │
│    └─ if PromiseDetector.found(output): break              │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│  OUTPUT                                                     │
│  • Final code (p5.js / Three.js / GLSL)                    │
│  • Iteration history (v1, v2, v3... vN)                    │
│  • Creative explanation ("Why this mutation worked")       │
│  • Gallery entry (seed, parameters, ancestry)              │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Core Modules

| Module | Responsibility | Test File |
|--------|----------------|-----------|
| **RalphLoop** | Self-recursive iteration engine, termination logic | `ralph-loop.test.js` |
| **PromptStore** | Same prompt every iteration, injects context | `prompt-store.test.js` |
| **ContextAccumulation** | Saves state, builds iteration history | `context-accumulation.test.js` |
| **CreativeEvaluator** | "Is this good?" aesthetic + technical check | `creative-evaluator.test.js` |
| **PromiseDetector** | Exact string matching for `<promise>COMPLETE</promise>` | `promise-detector.test.js` |
| **p5Generator** | p5.js sketch code generation | `generators/p5-generator.test.js` |
| **Renderer** | Preview server, screenshot capture | `renderer.test.js` |
| **Gallery** | Save/load iterations, seed archive | `gallery.test.js` |
| **Exporter** | Export final code (HTML, JS, ZIP) | `exporter.test.js` |

---

## 4. Creative Techniques (Phase 1)

### 4.1 Primary: p5.js Generators

Start with p5.js — fast iteration, beginner-friendly, perfect for generative art.

**Generator Types:**

1. **Particle Systems** — Radiohead anxiety energy
   - Attraction/repulsion forces
   - Decay/lifespan parameters
   - Color based on velocity/position

2. **Cellular Automata** — Lenia-style continuous CA
   - Smooth rules (not just on/off)
   - Organic-looking patterns
   - Growth, movement, reproduction

3. **Genetic Algorithms** — Evolve parameters
   - Generate 5 variations
   - User selects favorite (or auto-fitness)
   - Mutate/crossover into 5 children
   - Iterate until export-ready

### 4.2 Phase 2 (Future)

- Three.js for 3D scenes
- GLSL shaders for GPU effects
- Neural CA (train on aesthetic preferences)
- Self-modifying code (sandboxed quines)

### 4.3 Live Music Coding (NEW)

Atelier generates **live code for music** — not just visuals. Real-time, performative, algorithmic.

**Supported Platforms:**

| Platform | Type | Integration | Use Case |
|----------|------|-------------|----------|
| **Strudel** | Web (TidalCycles) | Browser + REPL | Live coding patterns, browser-native |
| **Hydra** | Visuals + Audio | WebGL + Web Audio | Audio-reactive visuals, synesthesia |
| **Sonic Pi** | Ruby-based | OSC + MIDI | Hardware integration, live performance |
| **FoxDot** | Python-based | OSC | Algorithmic composition |
| **p5.js + Web Audio** | Canvas + DSP | Browser native | Generative soundscapes |

#### Strudel Integration (Primary)

```javascript
// Generated by Atelier
// "Kid A vibes" → glitchy, anxious, minimal

const drums = await loadSamples("github:tidalcycles/dirt-samples")

stack(
  drums.bd.seq("x - - x - x - -"),
  drums.hh.seq("- x - x - x - x"),
  drum.sn.seq("- - x - - - x -"),
  note("<c2 g2 c3 e3>".slow(4))
    .s("sawtooth")
    .cutoff(sine.slow(8).range(200, 2000))
    .resonance(10)
    .delay(0.5)
    .delaytime("1/8")
    .room(0.8)
)
.out()
```

**Atelier generates:**
- Strudel patterns (TidalCycles mini-notation)
- Sample selections from Dirt-Samples
- Effect chains (delay, reverb, filters)
- Pattern variations for live manipulation

#### Hydra Integration (Visuals + Audio)

```javascript
// Audio-reactive visuals
osc(20, 0.1, 0.8)
  .color(0.9, 0.4, 0.7)
  .kaleid(4)
  .scale(0.5)
  .modulate(noise(3))
  .modulate(o0, () => a.fft[0] * 2)  // React to bass
  .out()
```

**Atelier generates:**
- Hydra chains (osc, noise, src, gradient)
- FFT-reactive modulation (`a.fft[0-3]`)
- Color palettes (emotional mapping)
- Camera feedback loops

#### Live Performance Mode

```bash
# Generate + serve live
atelier --prompt "ambient glitch set, 20 min" --mode live-music --output ./set

# Outputs:
# ./set/strudel.tidal    → Load in strudel.repl.co
# ./set/hydra.js         → Load in hydra.ojack.xyz
# ./set/sync.json        → BPM, key, tempo changes
```

#### Music-to-Visual Bridge

```javascript
// Ralph-Wiggum loop with audio sync

const musicOutput = await atelier.generateMusic({
  prompt: "anxious post-rock build",
  bpm: 120,
  duration: "4m",
  platform: "strudel"
});

const visualOutput = await atelier.generateVisuals({
  prompt: "same mood, audio reactive",
  audioInput: musicOutput.analyze(),  // FFT data, BPM, energy
  platform: "hydra"
});

// Both run in sync via Web MIDI / OSC
```

#### Hardware Integration

```javascript
// config/atelier.json
{
  "live": {
    "midiOutput": "IAC Driver Bus 1",
    "oscHost": "localhost",
    "oscPort": 57120,
    "syncMode": "ableton"  // or "jack", "link"
  }
}
```

**Use Cases:**
- Algorave performances
- Ambient generative sets
- Audio-reactive installations
- Collaborative live coding (multi-user)
- Music + ceramics (sonify the wheel)

---

---

## 5. TDD Requirements (Strict)

### 5.1 Red-Green-Refactor Only

**No exceptions.** Every feature:

1. **Red:** Write failing test first
2. **Green:** Implement minimum to pass test
3. **Refactor:** Clean up, optimize
4. **Repeat:** Until all tests pass

### 5.2 Test Coverage Goals

| Module | Minimum Coverage |
|--------|------------------|
| RalphLoop | 95% (termination logic critical) |
| CreativeEvaluator | 90% (quality gates essential) |
| PromiseDetector | 100% (exact string matching) |
| ContextAccumulation | 85% (state management) |
| All Generators | 80% (output validation) |
| **Overall** | **> 80%** |

### 5.3 Test Structure

```
test/
├── unit/
│   ├── ralph-loop.test.ts
│   ├── config-loader.test.ts
│   ├── path-sanitization.test.js
│   ├── creative-evaluator.test.js
│   ├── context-accumulation.test.js
│   ├── promise-detector.test.js
│   ├── gallery.test.ts
│   ├── lint.test.ts
│   └── ...
├── integration/
│   ├── full-loop.test.js
│   ├── ralph-loop.test.js
│   ├── dual-llm.test.ts
│   ├── preview-server*.test.js
│   └── ...
├── generators/
│   ├── p5-generator.test.js
│   ├── p5-generator-llm.test.js
│   ├── particle-system.test.js
│   └── cellular-automata.test.js
└── e2e/
    ├── full-loop-cloud.test.ts
    ├── full-loop-local.test.ts
    ├── seed-and-quality.test.js
    ├── gui.e2e.test.js
    └── sandbox-self-improve.e2e.test.ts
```

### 5.4 Critical Test Cases

**RalphLoop:**
- Loop terminates on promise detection
- Loop terminates on max-iterations
- Loop never runs infinite (timeout protection)
- Context correctly passes between iterations

**CreativeEvaluator:**
- Rejects broken/non-running code
- Accepts valid creative output
- Scores improve with iteration (regression test)

**PromiseDetector:**
- Exact string matching `<promise>COMPLETE</promise>`
- No false positives (partial matches rejected)
- Case sensitive

---

## 6. Super-Testing Checklist (Liam)

After Kai builds, I verify:

### 6.1 Core Loop

- [ ] Loop always terminates (never infinite)
- [ ] Context correctly accumulates between iterations
- [ ] Promise detection works (exact string match)
- [ ] Max-iterations safety net functions
- [ ] Timeout protection works (30 min/iteration)

### 6.2 Creative Quality

- [ ] Output is actually creative (not broken/garbage)
- [ ] p5.js sketches run without errors
- [ ] Visual output matches description
- [ ] Iteration history shows improvement
- [ ] Creative explanation makes sense

### 6.3 Code Quality

- [ ] Test coverage > 80%
- [ ] All tests pass
- [ ] No hardcoded secrets
- [ ] Clean separation of concerns
- [ ] Proper error handling

### 6.4 Performance

- [ ] Iterations run efficiently (< 5 min each)
- [ ] Memory usage reasonable (< 500MB)
- [ ] Gallery loads quickly
- [ ] Preview server responsive

---

## 7. File Structure

```
~/atelier-workspace/
├── src/
│   ├── core/
│   │   ├── RalphLoop.js
│   │   ├── PromptStore.js
│   │   ├── ContextAccumulation.js
│   │   ├── CreativeEvaluator.js
│   │   └── PromiseDetector.js
│   ├── generators/
│   │   ├── p5/
│   │   │   ├── P5Generator.js
│   │   │   ├── ParticleSystem.js
│   │   │   └── CellularAutomata.js
│   │   └── index.js
│   ├── render/
│   │   ├── Renderer.js
│   │   └── PreviewServer.js
│   ├── gallery/
│   │   ├── Gallery.js
│   │   └── SeedArchive.js
│   ├── export/
│   │   └── Exporter.js
│   └── index.js
├── test/
│   ├── unit/
│   ├── integration/
│   └── generators/
├── gallery/                    # Saved iterations
│   ├── 2026-03-01--kid-a/
│   │   ├── v1.js
│   │   ├── v2.js
│   │   ├── v3.js
│   │   └── final.js
│   └── index.json             # Gallery metadata
├── output/                     # Export directory
├── config/
│   └── atelier.json           # Agent configuration
├── package.json
└── README.md
```

---

## 8. Configuration

### 8.1 Agent Config (`atelier.json`)

```json
{
  "name": "atelier",
  "version": "1.0.0",
  "loop": {
    "maxIterations": 20,
    "timeoutMinutes": 30,
    "completionPromise": "COMPLETE"
  },
  "llm": {
    "provider": "inception",
    "apiKey": "${INCEPTION_API_KEY}",
    "baseUrl": "https://api.inceptionlabs.ai/v1",
    "model": "inception-001",
    "temperature": 0.7,
    "maxTokens": 4096,
    "localFallback": true
  },
  "creative": {
    "defaultFramework": "p5.js",
    "evaluationCriteria": ["aesthetic", "technical", "novelty"],
    "minQualityScore": 0.7
  },
  "gallery": {
    "autoSave": true,
    "maxHistoryPerProject": 50
  },
  "renderer": {
    "port": 3456,
    "screenshotOnIteration": true
  }
}
```

**Environment Variables:**
- `INCEPTION_API_KEY` — Required for cloud mode
- `OPENAI_API_KEY` — Optional fallback
- `OLLAMA_HOST` — Optional (default: localhost:11434)

### 8.2 Deployment Model (Standalone)

**Atelier is a standalone Node.js tool.** It does NOT run as an OpenClaw agent. It has zero dependencies on OpenClaw-specific tools.

Think of it like **BrainLoop** — a separate tool that agents (or humans, or scripts) can invoke.

#### Architecture

```
┌─────────────┐     API/CLI      ┌─────────────────────────────┐
│   OpenClaw  │ ────────────────▶│        ATELIER              │
│    Agent    │   (HTTP/stdio)   │  ┌─────────────────────┐    │
│  (optional) │                  │  │  Ralph-Wiggum Loop  │    │
└─────────────┘                  │  │  ├─ fs (Node.js)    │    │
                                 │  │  ├─ child_process   │    │
┌─────────────┐     API/CLI      │  │  ├─ http server     │    │
│     CLI     │ ────────────────▶│  │  └─ preview server  │    │
│   (human)   │                  │  └─────────────────────┘    │
└─────────────┘                  └─────────────────────────────┘
```

#### Standard Node.js APIs Only

| Function | Implementation | NOT |
|----------|---------------|-----|
| File I/O | `fs.promises` | OpenClaw `file_write` |
| Execute code | `child_process.spawn` | OpenClaw `exec` |
| Preview server | Express + Puppeteer | OpenClaw `browser` |
| Web requests | `fetch` / `axios` | OpenClaw `web_search` |

#### Interface

**Programmatic (Node.js):**
```javascript
const atelier = require('atelier');

const result = await atelier.run({
  prompt: "Make something that feels like Kid A",
  maxIterations: 20,
  framework: 'p5.js'
});

// Returns: { code, iterations, galleryPath, qualityScore }
```

**CLI:**
```bash
atelier --prompt "Kid A vibes" --max-iterations 20
```

**HTTP API (optional):**
```bash
POST /api/generate
{ "prompt": "Kid A vibes", "maxIterations": 20 }
```

#### Integration with OpenClaw

OpenClaw agents invoke Atelier like any other tool:

```javascript
// Inside an OpenClaw agent
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

// Invoke Atelier via CLI
const { stdout } = await execAsync(
  `atelier --prompt "${prompt}" --max-iterations 20 --output ./output`
);

const result = JSON.parse(stdout);
// result.code, result.galleryPath, etc.
```

**Key point:** Atelier is completely independent. It can run:
- As a CLI tool
- As a Node.js library
- As an HTTP service
- Invoked by OpenClaw, Cursor, humans, scripts, etc.

No OpenClaw-specific tools. No agent runtime. Just Node.js.

---

## 8.3 LLM Backend Architecture

Atelier uses a **pluggable LLM backend** — swap between cloud (Inception) and local (OSS) without changing code.

### Backend Options

| Mode | Provider | Use Case | Speed | Quality |
|------|----------|----------|-------|---------|
| **Cloud** | Inception API | Production, complex prompts | Fastest | Frontier |
| **Local** | Ollama/Qwen/Llama | Offline, privacy, low cost | Medium | Good |
| **Hybrid** | Auto-fallback | Cloud primary, local backup | Varies | Varies |

### Inception API (Primary)

**Inception Labs** — diffusion LLMs (dLLMs) with OpenAI-compatible API.

```javascript
// config/atelier.json
{
  "llm": {
    "provider": "inception",
    "apiKey": "${INCEPTION_API_KEY}",
    "baseUrl": "https://api.inceptionlabs.ai/v1",
    "model": "inception-001",
    "temperature": 0.7,
    "maxTokens": 4096
  }
}
```

**Why Inception:**
- 5x faster than traditional LLMs
- OpenAI API compatible (drop-in replacement)
- Streaming support
- Good for rapid iteration in Ralph-Wiggum loop

### Local Mode (Lightweight)

Run fully offline with small OSS models via Ollama:

```javascript
// config/atelier.json
{
  "llm": {
    "provider": "ollama",
    "baseUrl": "http://localhost:11434",
    "model": "qwen2.5-coder:7b",
    "temperature": 0.7
  }
}
```

**Recommended Local Models:**
| Model | Size | Speed | Use Case |
|-------|------|-------|----------|
| Qwen 2.5 Coder | 7B | Fast | Code generation, simple prompts |
| Llama 3.2 | 3B | Fastest | Quick iterations, testing |
| CodeLlama | 7B | Medium | Complex p5.js sketches |
| DeepSeek Coder | 6.7B | Medium | Good balance quality/speed |

### Pluggable Interface

```typescript
// src/llm/LLMBackend.ts
interface LLMBackend {
  generate(prompt: string, context: Context): Promise<LLMResponse>;
  stream(prompt: string, context: Context): AsyncIterator<LLMChunk>;
}

// Implementations
class InceptionBackend implements LLMBackend { /* ... */ }
class OllamaBackend implements LLMBackend { /* ... */ }
class OpenAIBackend implements LLMBackend { /* ... */ } // Fallback
```

### Auto-Detection

```bash
# Atelier auto-detects available backends:
$ atelier --prompt "test"

✓ Inception API available (INCEPTION_API_KEY set)
✓ Ollama detected (qwen2.5-coder:7b)
⚠ OpenAI key not found

Using: Inception (cloud)
Override: --local or --provider ollama
```

### Resonance Integration (Future)

From the Resonance PRD — bring in:
- **Vibe coding patterns** — emotional/qualitative prompt engineering
- **Sensory metaphor system** — map creative concepts to sensory language
- **Mutation operators** — structured variation beyond pure LLM generation


---

## 9. Usage Example

### 9.1 User Interaction

```
User: "Make something that feels like Kid A"

Atelier:
├─ ITERATION 1: Generate v1 (particle system, gray palette)
├─ ITERATION 2: Context sees v1 → adds glitch effect
├─ ITERATION 3: Context sees v1, v2 → slows animation
├─ ITERATION 4: Refines color → more blue, less gray
├─ ITERATION 5: Adds decay → particles fade organically
├─ ...
└─ ITERATION 12: Evaluator passes → <promise>COMPLETE</promise>

Output:
✓ Final code (p5.js)
✓ Iteration history (v1-v12)
✓ Creative explanation
✓ Gallery entry saved
```

### 9.2 Prompt Patterns

**Simple:**
```
Generate a p5.js sketch with a glitch effect.
Output: <promise>COMPLETE</promise> when it runs without errors.
```

**With Quality Gates:**
```
Create a particle system.
Requirements:
- 100+ particles
- Respond to mouse
- Smooth 60fps animation

Output: <promise>COMPLETE</promise> only when all requirements met.
```

---

## 10. Success Criteria

### 10.1 Must Have (MVP)

- [x] Internal Ralph-Wiggum Loop (completely independent)
- [x] p5.js generator (particle systems, basic CA, P5GeneratorLLM)
- [x] Preview server (localhost)
- [x] Gallery (save/load iterations)
- [x] TDD (> 80% coverage target; coverage from src/)
- [x] Super-testing passed (Liam verified)

### 10.2 Should Have (Phase 1)

- [x] Genetic algorithm variations (IGA, generateFiveVariations, getFitness)
- [x] Creative evaluator (aesthetic scoring, quality gate)
- [x] Export (HTML, JS, ZIP)
- [x] Iteration history visualization (TUI timeline, GUI)

### 10.3 Could Have (Future)

- [ ] Three.js support
- [ ] GLSL shaders
- [ ] Neural CA
- [ ] Self-modifying code (sandboxed) — sandbox and SelfImprovement implemented; optional further hardening
- [x] Live Music Coding (Strudel, Hydra, CLI --mode live-music, generateMusic/generateVisuals/generateMusicToVisual)
- [x] Music-to-visual bridge
- [ ] Hardware MIDI/OSC integration (config placeholders in place)
- [ ] Collaborative live coding (multi-user)

---

## 11. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Infinite loops | Max-iterations + timeout protection |
| Garbage output | Creative evaluator quality gates |
| False promises | Exact string matching + evaluation |
| Context bloat | Truncation strategy for long histories |
| Performance degradation | Profiling + optimization iteration |

---

## 12. Appendices

### 12.1 Research Sources

Preliminary research has been completed and written up in the repo. See:

- **[docs/PRELIMINARY_RESEARCH.md](docs/PRELIMINARY_RESEARCH.md)** — Consolidated entry point: executive summary, synthesis table, and consolidated references. It summarizes and links to the four detailed reports below.

**Primary sources (expanded in the reports):**

- **Emergent Garden:** Artificial life, emergence, "weird programs" — see *Research: Computational Life, Emergent Garden* in docs.
- **Blaise Agüera y Arcas et al.:** "Computational Life" (2024) — arXiv:2406.19108; Google Research. Self-replicating programs from simple interaction without explicit fitness. See *Research: Computational Life, Emergent Garden* in docs. For the **book** (*What Is Intelligence?*, MIT Press, 2025), **cover** (abiogenesis scatterplot), and **YouTube/podcast** talks (e.g. MLST ALife 2025, BFF experiment), see *Research: Agüera y Arcas book and videos* in docs.
- **Geoffrey Huntley:** Ralph-Wiggum Loop pattern — ghuntley.com/ralph, ghuntley.com/loop, github.com/ghuntley/how-to-ralph-wiggum. See *RALPH_WIGGUM_RESEARCH.md* in docs.
- **Google Research:** Growing Neural Cellular Automata (Distill 2020) — distill.pub/2020/growing-ca. See *research_GNCA_Lenia.md* in docs.

### 12.2 Related Work

- **Claude Code Ralph-Wiggum plugin** — anthropics/claude-code, plugins/ralph-wiggum (see RALPH_WIGGUM_RESEARCH.md).
- **p5.js / Processing ecosystem** — generative art, AI+p5 tooling (p5js.ai); see RESEARCH_P5_GA_ECOSYSTEM.md in docs.
- **Lenia** — Continuous CA framework (Bert Chan); chakazul.github.io/lenia; see research_GNCA_Lenia.md in docs.
- **GA.js / genetic-js** — Evolutionary art, IGA; see RESEARCH_P5_GA_ECOSYSTEM.md in docs.

**Detailed reports (all in `docs/`):**

| Report | File |
|--------|------|
| Ralph-Wiggum Loop & Claude plugin | RALPH_WIGGUM_RESEARCH.md |
| Computational Life & Emergent Garden | RESEARCH_COMPUTATIONAL_LIFE_EMERGENT_GARDEN.md |
| **Agüera y Arcas: book, cover, videos (What Is Intelligence?; BFF/ALife)** | **RESEARCH_AGUERA_Y_ARCAS_BOOK_AND_VIDEOS.md** |
| Growing Neural CA & Lenia | research_GNCA_Lenia.md |
| p5.js & genetic/evolutionary creative coding | RESEARCH_P5_GA_ECOSYSTEM.md |

---

**Status:** ✅ Ready for ClawLoop  
**Next:** Kai queues implementation with TDD  
**Verification:** Liam super-tests after build

—Liam [kimi-for-coding]
