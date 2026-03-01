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
│   ├── ralph-loop.test.js
│   ├── prompt-store.test.js
│   ├── creative-evaluator.test.js
│   ├── context-accumulation.test.js
│   ├── promise-detector.test.js
│   └── gallery.test.js
├── integration/
│   ├── full-loop.test.js
│   ├── generator-renderer.test.js
│   └── evaluator-gallery.test.js
└── generators/
    ├── p5-generator.test.js
    └── p5-particle-system.test.js
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

- [ ] Internal Ralph-Wiggum Loop (completely independent)
- [ ] p5.js generator (particle systems, basic CA)
- [ ] Preview server (localhost)
- [ ] Gallery (save/load iterations)
- [ ] TDD (> 80% coverage)
- [ ] Super-testing passed (Liam verified)

### 10.2 Should Have (Phase 1)

- [ ] Genetic algorithm variations
- [ ] Creative evaluator (aesthetic scoring)
- [ ] Export (HTML, JS, ZIP)
- [ ] Iteration history visualization

### 10.3 Could Have (Future)

- [ ] Three.js support
- [ ] GLSL shaders
- [ ] Neural CA
- [ ] Self-modifying code (sandboxed)
- [ ] Music-to-visual (FFT reactive)

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

- **Emergent Garden:** Artificial life, emergence, "weird programs"
- **Blaise Agüera y Arcas:** "Computational Life" paper (2024)
- **Geoffrey Huntley:** Ralph-Wiggum Loop pattern
- **Google Research:** Growing Neural Cellular Automata

### 12.2 Related Work

- Claude Code Ralph-Wiggum plugin
- p5.js / Processing ecosystem
- Lenia continuous CA framework
- GA.js / genetic-js libraries

---

**Status:** ✅ Ready for ClawLoop  
**Next:** Kai queues implementation with TDD  
**Verification:** Liam super-tests after build

—Liam [kimi-for-coding]
