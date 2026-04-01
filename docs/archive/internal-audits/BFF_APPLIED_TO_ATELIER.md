# Applying the BFF Experiment to Atelier

**Purpose:** Map the BFF experiment (Computational Life, Agüera y Arcas et al.) onto Atelier’s loop and propose concrete ways to adopt its ideas. See [RESEARCH_AGUERA_Y_ARCAS_BOOK_AND_VIDEOS.md](RESEARCH_AGUERA_Y_ARCAS_BOOK_AND_VIDEOS.md) for BFF details.

---

## 1. BFF in one paragraph

**BFF:** A “soup” of 1,000 tapes (64 random bytes each, minimal language). Each step: **pick two tapes at random → concatenate → run** the combined program (self-modifying) → split back → drop into soup. **No fitness function.** After millions of steps, entropy drops; **self-replicating programs** emerge. Purpose (replication) arises from **simple interaction** (merge + run) and thermodynamics (dynamic kinetic stability). **Merging** (symbiogenesis) is the driver of complexity, not mutation.

---

## 2. Atelier today vs BFF

| BFF | Atelier today |
|-----|----------------|
| **Soup** of many tapes | **Linear history**: v1 → v2 → v3 → … (one chain) |
| **Pick two** at random | **Use one**: last iteration only (first 500 chars + score + issues) |
| **Concatenate** then run | **Prompt + last code** → LLM generates *new* code (no literal concatenate) |
| **No explicit fitness** | **Explicit score** (CreativeEvaluator) + quality gates |
| **Self-modifying** (programs write tape) | **Iterated refinement** (model reads previous code, writes next) |
| **Merge** as main interaction | **Context injection** from single previous iteration |

So: we already have “same prompt, changing context” and “artifact evolves”; we do **not** have (1) **merge of two** past artifacts, or (2) a **population/soup** of variants, or (3) **implicit fitness** (persistence as fitness).

---

## 3. How to apply BFF here

### 3.1 Substrate design (already aligned)

- **BFF:** Substrate = instruction set + interaction rule (concat → run → split). Emergence depends on this design.
- **Atelier:** Substrate = prompt shape + **what we inject** (last code? two codes? scores?) + evaluation + termination. We can tune this explicitly.

**Action:** Treat “context shape” as first-class: document it (e.g. in PRD or ARCHITECTURE) and expose options (`lastKIterations`, `maxContextLength`, and eventually “merge mode” / “population size”).

---

### 3.2 Merge (symbiogenesis) — highest leverage

In BFF, **merging two tapes** then running is what creates new programs and drives complexity. In Atelier we only pass **one** previous code.

**Proposal: optional “merge” step**

- **Option A — Merge every N iterations:** Every N iterations (e.g. 3), instead of “prompt + last code,” do: pick **two** from recent history (e.g. last and one other by score or random), inject both into the prompt, e.g.  
  *“Combine or improve on these two sketches toward the goal: [prompt]. Sketch A (score X): [code]. Sketch B (score Y): [code]. Produce a single p5.js sketch.”*
- **Option B — Merge as a mode:** CLI/API flag or GUI action: “Merge two versions.” User (or system) selects two iteration indices; we call the LLM with both codes and a “combine/improve” prompt; append result as new iteration.
- **Option C — Always inject two:** Change `buildContextForInjection` to include **two** previous snippets (e.g. last + one from 2 steps back, or last + best-by-score) so the model routinely sees “two prior attempts” and can implicitly merge ideas.

**Implementation sketch (Option B — smallest change):**

- In `RalphLoop`, add an optional `mergeIndices?: [number, number]` (or `mergeVersions?: [number, number]`). If set for an iteration, `buildContextForInjection` returns a “merge” context: two code snippets + scores; prompt template says “Combine these two sketches into one that best satisfies [prompt].”
- Or: separate API `mergeTwoVersions(project, i, j)` that loads iterations i and j from gallery, calls LLM with merge prompt, saves result as new iteration. GUI: “Combine v3 and v7” button.

---

### 3.3 Population / soup (larger change)

BFF keeps a **population** of 1,000; we keep one **chain** of iterations.

**Proposal: optional “soup” mode**

- Maintain a **population** of K candidates (e.g. 5–10) instead of a single “current” code.
- Each iteration: **pick two** from population (e.g. random, or by score/diversity), form context from both + prompt, generate offspring, evaluate, **replace** one member of the population (e.g. worst by score, or random).
- Gallery could store “generation” and “population slot” or we store one chain per run and the “soup” is in-memory for the run.

**Implementation:** New mode in `RalphLoop` (e.g. `mode: 'ralph' | 'soup'`) or a separate `SoupLoop` that uses the same generators and evaluator but population + merge logic. Bigger refactor; do after “merge two” is in place.

---

### 3.4 Implicit fitness (experiment)

In BFF, “fitness” is implicit: replicators persist because they copy themselves. In Atelier we explicitly score and can gate on score.

**Proposal: experiment with retention by persistence**

- **Variant 1:** When building context, **sample** which previous iteration(s) to use by **score** (e.g. softmax over scores) instead of always “last.” Higher-scoring iterations get more “offspring” (more likely to be used as context).
- **Variant 2:** “Soup” mode but replace **random** member instead of “worst,” so persistence is partly random (neutral drift) and partly score-driven if we also bias “pick two” by score.

This is experimental; no need to ship until merge/population are validated.

---

### 3.5 Phase transition / emergence signal

In BFF, **entropy drop** marks the transition. In Atelier we could look for:

- **Compressibility** of code history (e.g. gzip ratio of concatenated codes over time).
- **Score jump** (e.g. sudden rise above threshold).
- **Promise detected** (already have this: `<promise>COMPLETE</promise>` as termination).

**Action:** Optional telemetry or “run summary” that reports: final score, score trend, whether promise was detected, and (if we add it) code compressibility over iterations. Helps compare “merge” vs “single-context” runs.

---

## 4. Recommended order

1. **Document** substrate (context shape, options) in PRD or ARCHITECTURE.
2. **Add “merge two”** (Option B above): API or loop option to pass two past codes and a “combine/improve” prompt; or GUI “Combine v_i and v_j” that creates a new iteration from two selected versions.
3. **Experiment** with “inject two” (Option C) in the default loop (e.g. last + previous, or last + best) and compare quality/diversity to current single-context.
4. **If promising,** add soup mode (population + pick-two + replace) as an optional loop mode.
5. **Optional:** Implicit-fitness variants and emergence/compressibility metrics.

---

## 5. Summary table

| BFF idea | Atelier application | Effort |
|----------|---------------------|--------|
| Substrate design | Document and expose context-shape options | Low |
| **Merge two** | “Combine two versions” prompt + API/GUI | Low–medium |
| Inject two in context | buildContextForInjection includes two past codes | Low |
| Population / soup | Optional loop mode with K candidates, pick-two, replace | Medium–high |
| Implicit fitness | Sample context by score; or random replace in soup | Medium (after soup) |
| Phase signal | Compressibility or score-jump in run summary | Low |

The most direct and high-leverage application of BFF to what we have here is **merge (symbiogenesis)**: allow the system to **combine two past code artifacts** (two “tapes”) and generate a new one, instead of always conditioning only on the single last iteration.

---

*See also: [RESEARCH_COMPUTATIONAL_LIFE_EMERGENT_GARDEN.md](RESEARCH_COMPUTATIONAL_LIFE_EMERGENT_GARDEN.md), [RESEARCH_AGUERA_Y_ARCAS_BOOK_AND_VIDEOS.md](RESEARCH_AGUERA_Y_ARCAS_BOOK_AND_VIDEOS.md), [RalphLoop.ts](../src/core/RalphLoop.ts), [ContextAccumulation.ts](../src/core/ContextAccumulation.ts).*
