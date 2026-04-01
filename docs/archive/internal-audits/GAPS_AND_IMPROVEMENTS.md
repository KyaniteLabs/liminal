# Gaps, Blind Spots, and Research-Aligned Improvements

**Date:** 2026-03-07 (updated 2026-03-21)
**Context:** Comparison of PRD + preliminary research (docs/PRELIMINARY_RESEARCH.md and linked reports) to the current codebase. This document lists every identified gap, blind spot, missed opportunity, and research-aligned improvement.

---

## Remediation status (2026-04-01)

After the **Meta-Harness Implementation** and **Template Removal**, the following additional items were **addressed**:

| § | Gap | Remediation |
|---|-----|-------------|
| **3.1** | Template generators removed | **ParticleSystem, CellularAutomata, FlowField templates removed** — All p5 generation now uses LLM exclusively via P5GeneratorLLM. Meta-Harness learns from failures instead of falling back to templates. |
| **MH.1** | No failure pattern detection | **Meta-Harness implemented** — FailureLogger captures rich context; PatternDetector identifies 6 known patterns (Qwen thinking trap, GLSL undefined functions, Tone.js hallucinations, Strudel/Tidal confusion, ASCII timeout, HTML 404); HarnessUpdater applies adaptations. |
| **MH.2** | Qwen models timeout consistently | **Qwen detection and simplified prompts** — Auto-detects Qwen models, uses simplified system/user prompts to avoid "thinking trap", extracts code from thinking field if response empty. |
| **MH.3** | GLSL uses undefined functions | **GLSL semantic validation** — Detects undefined functions (noise, fbm, hash), invalid operators (`%` instead of mod()), validates function definitions. |
| **MH.4** | Tone.js hallucinates APIs | **Tone.js API whitelist** — Validates Tone.* classes against known API, catches hallucinations (Reverberator, DrivingPattern, ReverbNode), suggests closest valid class. |
| **MH.5** | Strudel confused with TidalCycles | **Strudel anti-patterns** — Prompt includes explicit "NEVER DO" section: never use Haskell `$`, never write `d1 $`, never bare `s("bd")`. Working examples show correct syntax. |

---

## Remediation status (2026-03-07)

After the **Full Remediation to Launch** (Waves 0–7), the following items from this document were **addressed**:

| § | Gap | Remediation |
|---|-----|-------------|
| **1.1** | Context never reaches the LLM | RalphLoop now **always** injects context: if the prompt has no `{{context}}` placeholder, context is **appended** so the generator always sees previous iterations. |
| **1.2** | Quality score not used as backpressure | **Quality gate** in RalphLoop: when `evaluation.score < minQualityScore`, loop breaks with reason "quality threshold not met". |
| **3.1** | Rich generators not in the loop | **Generator routing**: prompts containing "particle"/"galaxy" → ParticleSystem; "cellular"/"automata"/"lenia" → CellularAutomata; else P5GeneratorLLM. `promptToGeneratorParams` derives palette/speed from prompt. |
| **4.1** | CreativeEvaluator as fitness | **getFitness(code, options)** added; IGA **generateFiveVariations()** uses it. |
| **5.3** | tolerateErrors not in run() | **tolerateErrors** added to run() and Atelier.run() options; passed through to RalphLoop. |
| **Path traversal (audit)** | output, project, gallery, SeedArchive, export path | **normalizePath(baseDir, subPath)** and **assertSafeSegment(name)** in `src/utils/normalizePath.ts`; used in run(), Gallery, SeedArchive, POST /api/export. |
| **ESLint / coverage (audit)** | No project ESLint; coverage from dist | **.eslintrc.cjs** added; **collectCoverageFrom** switched to **src/**; **test/unit/lint.test.ts** asserts lint runs. |
| **Live Music (5.2)** | generateMusic/generateVisuals documented but not implemented | **Implemented**: generateMusic, generateVisuals, generateMusicToVisual; CLI **--mode live-music**; config **live** (midiOutput, oscHost, etc.). |

---

## Deep Audit Remediation (2026-03-21)

A comprehensive adversarial audit identified unification gaps, synergy failures, and broken feedback loops across the three consolidated subsystems. All critical items have been resolved:

| # | Gap | Fix | Files |
|---|-----|-----|-------|
| 1 | GUI exposes ~30% of capability | Extended `/api/run` with all LoopOptions | `gui/server.js` |
| 2 | GUI merge concatenates code | Now uses `mergeSketchCode()` | `gui/server.js` |
| 3 | `/api/compost/status` returns 500 | Changed `status()` → `statusAsync()` | `gui/server.js` |
| 4 | Context bleeds between GUI runs | `RalphLoop.reset()` called before each run | `gui/server.js` |
| 5 | Compost DNA registered but never read | DNA injected into generation context when domain matches | `RalphLoop.ts` |
| 6 | MAP-Elites write-only | Diversity hints injected when coverage < 30% | `RalphLoop.ts` |
| 7 | Novelty score computed but unused | High novelty resets stagnation counter | `RalphLoop.ts` |
| 8 | Swarm fragments discarded | MiningEngine fragments feed into archive learning | `RalphLoop.ts` |
| 9 | Few-shot examples random | Keyword-overlap ranking + 2000-char budget | `ArchiveLearning.ts` |
| 10 | Loop outputs never feed compost | `autoCompost` option with auto-digest | `RalphLoop.ts` |
| 11 | Collision scores hardcoded 7/10 | FragmentScorer.score() on collision results | `CompostMill.ts` |
| 12 | Soup produces garbage (no LLM) | LLM reference stored and passed to soup | `CompostMill.ts` |
| 13 | MAP-Elites/AestheticModel per-run only | Persist to `~/.liminal/*.json` across runs | `MapElites.ts`, `RalphLoop.ts` |
| 14 | Aesthetic predictions unused | Low/high prediction hints in generation context | `RalphLoop.ts` |
| 15 | Routing data static | Rolling averages from real generation outcomes | `RoutingData.ts` |
| 16 | Organism mode is a blind loop | Context accumulation, seed injection, evaluation, stagnation | `RalphLoop.ts` |
| 17 | No compost dashboard | `/api/compost/dashboard` + `/api/compost/add` endpoints | `gui/server.js` |
| 18 | Gallery grows indefinitely | `cleanupOldProjects()` auto-archives to `_archived/` | `Gallery.ts` |

**Still open:**

- **5.1** config/atelier.json: ConfigLoader has `loadProjectConfig()`; project config path may not be passed from bin/atelier in all code paths.
- **2.2** Evaluation criteria configurable: PRD lists evaluationCriteria; CreativeEvaluator may not read it from config.
- **3.3, 4.1** GA phase: IGA generateFiveVariations exists; full "5 variations → user selects → mutate/crossover" UI or flow may be partial.
- **Integration test failures:** RESOLVED — Migrated from Jest to Vitest. `vitest` installed, `vitest.config.ts` created, Jest artifacts removed. 129/130 suites passing (1 requires running LM Studio server).

---

## 1. Ralph-Wiggum Loop alignment

### 1.1 Context never reaches the LLM (critical)

**Research:** Huntley and the playbook say the “world” (files, previous code, history) must be visible each iteration; persistence lives in the world, and each iteration can use a fresh context that *includes* that world.

**Code:** `RalphLoop.buildContextForInjection()` builds a rich context string (iteration, previous score, issues, code snippet, trend). `PromptStore.injectContext(loadedPrompt, contextForInjection)` replaces only `{{context}}`, `{context}`, or `<context>` in the prompt. The **default user prompt** (e.g. `"blue particles"`) has **no placeholder**, so the context is **never injected** and the LLM **never sees** previous code, scores, or issues.

**Gap:** The “world that changes” is computed but not shown to the model. The loop is same-prompt but not same-prompt-**with-context**.

**Improvement:**

- **Option A (minimal):** Always append context to the prompt sent to the generator (e.g. `usedPrompt = loadedPrompt + "\n\n---\nContext from previous iterations:\n" + contextForInjection`), so every run gets iteration history even without placeholders.
- **Option B (research-aligned):** Provide a **default prompt template** that includes `{{context}}` and is used when the user prompt has no placeholder; document that users can add `{{context}}` for explicit injection.
- **Option C:** In `P5GeneratorLLM.generate(prompt)`, treat `prompt` as potentially already containing context, and have RalphLoop always pass `usedPrompt` (with context appended if not replaced). Prefer Option A or B so the substrate (prompt + context shape) is guaranteed to expose the changing world.

### 1.2 Quality score is not used as backpressure

**Research:** Ralph’s “backpressure” is tests, build, linters; Atelier’s is creative quality. PRD and research say quality gates should stop or steer the loop.

**Code:** `minQualityScore` is in `LoopOptions` and passed through, but **RalphLoop never uses it**. The loop does not exit when `evaluation.score < minQualityScore`, does not retry, and does not reject an iteration. CreativeEvaluator.assess() returns `passed` and `score`, but the loop ignores `passed`.

**Gap:** Quality gate is computed but has no effect. “Garbage output” mitigation (PRD Risks) is only partial.

**Improvement:**

- If `evaluation.score < minQualityScore`: either (a) **break** the loop with reason "quality threshold not met", or (b) **retry** the same iteration (e.g. once) with context that includes "Previous attempt scored X; address: [issues]". Option (a) is simpler and aligns with “sit on the loop” (human adjusts prompt/expectations and reruns).
- Optionally: after N consecutive iterations below threshold, break early instead of running to max-iterations.

### 1.3 No “fresh context” discipline for the generator

**Research:** Ralph favours a fresh context window per iteration; main context as scheduler; don’t allocate everything to the primary context.

**Code:** Each iteration calls `P5GeneratorLLM.generate(usedPrompt)` once; the LLM client has no notion of “this is iteration N, previous was X”. Context that is injected is only the string we send in the user message. So we *do* send a bounded summary per iteration if we fix 1.1. We do **not** truncate or summarize history to avoid context bloat (PRD: “Context bloat → Truncation strategy”).

**Gap:** No explicit truncation strategy; `buildContextForInjection` uses only the last iteration in detail (plus aggregate trend). For long runs, history could grow in the accumulation, but we only pass the last snippet (500 chars). So bloat is partly limited, but not documented or configurable.

**Improvement:**

- Document that context is intentionally bounded (last iteration + trend). Add a configurable limit (e.g. “include last K iterations’ summaries” or “max context length”) and a short comment in code referencing PRD “Context bloat / Truncation strategy”.
- If we ever add “full history” mode, add truncation (e.g. keep last N iterations, or summarize older ones to one line each).

---

## 2. Computational Life & Emergent Garden alignment

### 2.1 “Substrate” design is under-specified

**Research:** Computational Life: the **substrate** (prompt structure, context injection, evaluation, termination) determines whether improvement emerges. Design it so “simple interaction” (same prompt + changing context) tends to yield better code.

**Code:** Substrate is implicit: prompt (no default template with context), context (built but not always sent), evaluation (CreativeEvaluator), termination (promise or max-iterations). There is no single place that defines “the Atelier substrate” or tunes it for emergence.

**Gap:** We don’t explicitly document or configure the substrate. The research suggests making it a first-class design concept.

**Improvement:**

- Add a short **substrate** section to the PRD or docs: “Atelier’s computational substrate = prompt (optional {{context}}) + context injection (iteration history, last code snippet, score, issues, trend) + evaluation (CreativeEvaluator) + termination (promise, max-iterations, optional quality gate).” Then implement so context is always included (see 1.1).
- Consider a small config or doc listing “substrate knobs”: context length, whether to include full last code or snippet, quality threshold, max-iterations. This makes it easier to experiment so that “simple interaction” yields improvement.

### 2.2 No explicit “no single fitness” guarantee

**Research:** Emergence without a global fitness function; local, contextual feedback and repeated interaction can suffice.

**Code:** CreativeEvaluator is a single scalar score (plus issues). We don’t claim multiple objectives or lexicase-style selection. So we’re already “one score” rather than many-objective. The research suggests we *could* support multiple criteria (aesthetic, technical, novelty) and combine them in a configurable way, or document that the single score is a deliberate simplification.

**Improvement:**

- Document that the current design uses one composite score as a **deliberate simplification** of “local, contextual feedback,” and that future work could add many-objective or IGA-style fitness (see §4). No code change required for MVP.
- PRD already lists `evaluationCriteria: ["aesthetic", "technical", "novelty"]` in config; CreativeEvaluator does not read that. Optionally: make evaluation criteria configurable so “substrate” includes which dimensions we score on.

---

## 3. Generators and Lenia/GNCA alignment

### 3.1 Rich generators are not in the loop

**Research:** Lenia-style continuous CA (smooth, organic) and ParticleSystem (attraction/repulsion, decay, color mapping) are the Phase 1 generators. Research and PRD say the loop should use them.

**Code:** The loop uses **only** `P5GeneratorLLM`. `P5Generator`, `ParticleSystem`, and `CellularAutomata` exist and are exported but **are never called** by RalphLoop. P5GeneratorLLM has its own small templates (particle, galaxy, cellular, fractal, basic) that are **not** the same as `ParticleSystem.generate()` or `CellularAutomata.generate()`. So the rich, parameterised generators are unused in the main loop.

**Gap:** Large blind spot: the codebase that best matches the research (Lenia-style CA, particle systems with forces) is not part of the agent loop.

**Improvement:**

- **Use the real generators in the loop.** For example:
  - If the prompt suggests particles (e.g. “particle”, “galaxy”), call `ParticleSystem.generate(params)` and optionally allow the LLM to refine or wrap it, or use it as the “previous code” in context.
  - If the prompt suggests CA (e.g. “cellular”, “automata”, “lenia”), call `CellularAutomata.generate(params)` similarly.
  - Alternatively, keep P5GeneratorLLM as the primary generator but **seed it** with code from ParticleSystem/CellularAutomata when the prompt matches (e.g. “Here is a base implementation; improve it to better match: [prompt]. Previous feedback: [context]”).
- **Parameterise from prompt or context:** Allow params for ParticleSystem/CellularAutomata to be derived from the prompt (e.g. “calm blue particles” → palette cool, low speed) or from a future GA phase (genotype = params). This aligns with research (parameters as genotype).

### 3.2 Lenia update equation and kernel fidelity

**Research:** Lenia uses A(t+Δt) = [A + Δt·G(K∗A)]₀¹; kernels and growth function G are central; 400+ species.

**Code:** CellularAutomata generates p5.js code that implements a continuous CA with `computeNeighborhood`, `applyGrowthFunction`, `kernelWeight`, and smoothing. It is Lenia-**style** but not a direct port of Chan’s equation (e.g. convolution is discrete over a grid, not continuous space). Research suggests “smooth rules, kernel/radius, emergence.”

**Gap:** Minor: the generated code is already in the right spirit (continuous state, kernel, growth function). The main gap is that this generator is not invoked in the loop (3.1). Optionally, add a note in code or docs that the generated CA aims for Lenia-like behaviour and cite Chan’s formulation.

**Improvement:**

- (Already largely done.) Ensure CellularAutomata is used when the prompt matches (see 3.1). Optionally add a comment or doc string referencing Lenia’s update equation and that we approximate it in discrete grid form.
- Expose **kernel type** and **growth function** (e.g. G(μ, σ)) as prompt- or config-driven so we can explore “species” without code changes.

### 3.3 No evolutionary discovery of parameters

**Research:** Lenia uses evolutionary search (QD, IMGEP) for new patterns; PRD Phase 1 includes “Genetic Algorithms: 5 variations, user selects, mutate/crossover.”

**Code:** No GA, no parameter evolution, no “5 variations” UI or API. CellularAutomata has `mutationRate`/`mutationStrength` in the *generated* CA code, not in the discovery loop. ParticleSystem and CellularAutomata have many parameters that would make a good genotype.

**Gap:** Missed opportunity: the research and PRD both point to evolving parameters (and optionally user-in-the-loop selection). None of that exists.

**Improvement:**

- **Phase 1 GA (research-aligned):** Add a mode or separate entry point: generate 5 variations (e.g. 5 parameter sets for ParticleSystem or CellularAutomata), score them (CreativeEvaluator or user), select one or more, mutate/crossover parameters, repeat. Use genetic-js or GeneticsJS (see RESEARCH_P5_GA_ECOSYSTEM.md). Chromosome = parameter vector for a chosen generator.
- **Integration with RalphLoop:** Either (a) RalphLoop can call a “GA step” that produces one candidate code per generation and injects the best into context, or (b) a separate “evolution mode” that only does GA over parameters and uses CreativeEvaluator (and optionally user) as fitness. (b) is simpler and matches “5 variations → user selects → mutate/crossover” literally.

---

## 4. p5.js and IGA alignment

### 4.1 CreativeEvaluator as fitness

**Research:** CreativeEvaluator can act as or supplement the fitness function; IGA “user selects” or “auto-fitness” reduces fatigue.

**Code:** CreativeEvaluator is used only inside the loop to score each iteration; the score is not used for selection or backpressure (see 1.2). There is no GA, so no fitness API.

**Gap:** Evaluator is underused: no quality gate, no fitness callback for evolution.

**Improvement:**

- Use CreativeEvaluator as the **fitness function** for any auto-fitness GA (see 3.3). Expose something like `getFitness(code: string): number` that returns the assessment score, and optionally the issues list for “address these” in the next variation.
- When we add “5 variations,” allow fitness to be either (a) user selection (click/rank) or (b) CreativeEvaluator score, or (c) weighted combination. Document in PRD/docs.

### 4.2 Default prompt template and “algorithmic philosophy”

**Research:** p5.js + agent workflows (e.g. Claude Skills) suggest defining an “algorithmic philosophy” and implementing with seeded randomness and parametric controls.

**Code:** No notion of “algorithmic philosophy” or default prompt template. User must know to add `{{context}}` to get context.

**Improvement:**

- Add a **default system prompt or template** that (a) includes `{{context}}` so context is always used, and (b) optionally mentions “algorithmic philosophy” or “creative coding iteration: improve on the previous attempt using the feedback below.” This improves emergence (substrate) and matches p5/creative-coding practice.
- Document in README: “For best results, use a prompt that describes the aesthetic (e.g. ‘calm blue particles’); the system will inject previous iteration feedback automatically.” If we keep a user-visible template, document it.

---

## 5. PRD and docs vs code

### 5.1 config/atelier.json never loaded

**Already in DOCS_VS_CODE.md and audit:** README and PRD describe project-wide config in `config/atelier.json`. Code only reads `~/.atelier/config.json` (LLM) and in-code defaults for loop/creative/gallery/renderer.

**Improvement:**

- Either **implement** loading of `config/atelier.json` (e.g. from cwd or a config path option) and merge with defaults, or **remove** the claim from README/PRD and document that only `~/.atelier/config.json` (and env) are used for LLM, and loop/creative/gallery/renderer are in-code or constructor options.
- Research does not require project config; this is a consistency fix.

### 5.2 Live Music Coding and generateMusic/generateVisuals

**PRD and README:** Describe Strudel, Hydra, Sonic Pi, FoxDot, p5.js + Web Audio, and APIs like `atelier.generateMusic()` / `atelier.generateVisuals()`. None of this exists in code.

**Improvement:**

- Mark Live Music and these APIs as **future/planned** in README and PRD (or move to a “Roadmap” section) until implemented. No need to remove; just avoid implying they are available now.
- Research supports “emergent generative art” and creative coding; it does not require music APIs for the MVP. Prioritise loop + context + quality gate + use of ParticleSystem/CellularAutomata first.

### 5.3 tolerateErrors not exposed in run()

**Already in DOCS_VS_CODE.md:** README shows `tolerateErrors: true` in programmatic usage; `run()` in index.ts does not accept it and always passes `false` to RalphLoop.

**Improvement:**

- Add `tolerateErrors?: boolean` to the `run()` options type and pass it through to RalphLoop. Default `false` to preserve current behaviour.
- Aligns with research (backpressure and error handling are part of “sit on the loop”).

---

## 6. Blind spots and missed opportunities (summary)

| Area | Blind spot / missed opportunity | Research / PRD |
|------|----------------------------------|----------------|
| **Loop context** | Context is built but not sent to LLM unless user adds `{{context}}`. | Ralph: “world” must be visible each iteration. Computational Life: substrate = prompt + context + evaluation. |
| **Quality gate** | minQualityScore is never used; no exit or retry on low quality. | Ralph: backpressure. PRD: “Garbage output → Creative evaluator quality gates.” |
| **Generators** | ~~ParticleSystem and CellularAutomata~~ **REMOVED** — Templates removed in favor of LLM-only generation with Meta-Harness learning. See §3.1 update above. | PRD Phase 1: particle systems, Lenia-style CA. **Replaced by:** Meta-Harness pattern detection and adaptation. |
| **GA / evolution** | No “5 variations,” no parameter evolution, no IGA. | PRD: Genetic Algorithms phase. Research: genetic-js, IGA, CreativeEvaluator as fitness. |
| **Substrate** | No explicit substrate design or documentation. | Computational Life: substrate design enables emergence. |
| **Config** | config/atelier.json documented but not loaded. | Doc/code consistency. |
| **API/docs** | Live Music, generateMusic/generateVisuals documented as if present. | Mark as planned. tolerateErrors not in run() options. | Doc/code consistency. |

---

## 7. Recommended order of improvements

1. **Context always in prompt (1.1)** — Ensure the “world that changes” is always sent to the LLM (append context if no placeholder). Highest impact for a “bare MVP that was never successful.”
2. **Quality gate (1.2)** — Use minQualityScore to break (or retry) when score is below threshold. Makes the loop respect creative backpressure.
3. **~~Use ParticleSystem and CellularAutomata in the loop (3.1)~~** — **SUPERSEDED by Meta-Harness** — Templates removed. All generation uses LLM with Meta-Harness observing failures and updating prompts/validators.
4. **Default prompt template (4.2)** — Include `{{context}}` and short iteration instructions so default runs get context and a clear “improve on previous” instruction.
5. **Substrate doc (2.1)** — Document prompt + context + evaluation + termination as the “Atelier substrate” and tune so improvement can emerge.
6. **tolerateErrors in run() (5.3)** — Small API fix; improves doc/code alignment.
7. **config/atelier.json (5.1)** — Either implement load or update docs.
8. **GA phase (3.3, 4.1)** — Add “5 variations → select → mutate/crossover” with CreativeEvaluator as optional fitness; genetic-js or GeneticsJS.
9. **Live Music / generateMusic (5.2)** — Mark as planned in docs until implemented.

---

## 8. Jcodemunch index

Re-ran `index_folder` with `incremental: true`; the index reported “No changes detected,” so the existing index is up to date. New markdown docs under `docs/` may not be parsed for symbols (jcodemunch typically indexes code). For future “find where X is used” queries, the current index is sufficient; for searching inside the new research docs, use grep or file read.

---

*End of gap and improvement document. Each item above can be turned into a concrete task (e.g. “Append context to prompt when no {{context}} in RalphLoop” or “Enforce minQualityScore in RalphLoop”).*
