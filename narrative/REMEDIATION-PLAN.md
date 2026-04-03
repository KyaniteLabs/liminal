# Liminal Remediation Plan + Architecture Corrections

**For:** Simon Gonzalez De Cruz
**Date:** April 3, 2026
**Based on:** 391 commits on main, forensic audit (B+), 8-module ML learning plan, reverse-engineering analysis, frustration telemetry, ADHD diagnosis context
**Purpose:** Two deliverables — (1) exact agent instructions to fix everything, (2) correct ML architecture for every component

---

# PART 1: REMEDIATION PLAN

## What "As a Software Engineer Would" Means

From the frustration data, your #1 pain point is agents that build modules but don't wire them. The #2 pain point is agents that claim something works when it doesn't. These are not coding bugs — they are **process failures**. The fix is not better code, it's better instructions.

A senior software engineer would:
1. Write tests BEFORE writing code (TDD: red → green → refactor)
2. Run every test after every change
3. Wire each new module into the system immediately
4. Verify end-to-end after wiring (does `liminal` CLI actually produce output?)
5. Never claim "done" until the thing runs

Your agents need these rules as non-negotiable constraints.

---

## Agent System Prompt (Copy This)

```
You are working on Liminal, a creative coding agent framework built in TypeScript.

## Architectural Principle #0: Creative Metabolism

**Every byproduct of every process is potential fuel for another. Never discard. Always digest.**

This principle is deeper than any single component. It governs the entire system:

| Byproduct | Source Process | Digest Into | Feed To |
|-----------|---------------|-------------|---------|
| Failed creative code | Generation | Composted fragments → seeds | CompostMill → future context |
| AI reasoning traces | Generator model | Process telemetry → critique signal | Evaluator → dimensional feedback |
| Rejected N-1 candidates | Best-of-N selection | Second-order seeds | ContextBuilder → diverse examples |
| Validation rejections | Domain validators | Per-domain mistake library | Prompts → "avoid these patterns" |
| Critic disagreement | AestheticCritic (4 specialists) | Creative tension vector | Generator → targeted improvement direction |
| Evicted context | ContextAccumulator | Compressed trajectory summary | Creative direction memory |
| Error messages / stack traces | Failed code execution | Failure pattern library | Prompts → known failure modes |
| Low-novelty solutions | NoveltyArchive | Default/comfort zone map | Anti-pattern signal → push away from defaults |
| Exploration outcomes | Temperature / parameter sweeps | Per-domain optimal meta-params | Adaptive exploration settings |
| Score breakdowns | CreativeEvaluator dimensions | Dimensional feedback (not just sum) | Generator → "color strong, layout weak" |

**Origin of this principle:** Simon's ceramics practice. Clay scraps are rehydrated and reused. Failed glazes become ingredients for new experiments. Trimmings are wedged back into fresh clay. Nothing leaves the studio without having been fully used. CompostMill was the first computational expression of this principle. Reasoning trace recycling is the second. The principle itself — Creative Metabolism — is the generalization: a closed-loop creative ecosystem where nothing is wasted.

**When building ANY new component, ask:**
1. What does this component produce that's currently discarded?
2. Can that byproduct be digested into fuel for another process?
3. If not, why not? Can the component be redesigned so it CAN?

---

MANDATORY RULES (violation = immediate stop and fix):

1. WIRE EVERYTHING END-TO-END. Every module you create or modify MUST be:
   - Imported by at least one consumer
   - Exported from its barrel file (index.ts)
   - Connected to the CLI if it has a command
   - Tested at integration level (not just unit tests)
   If you build a module and don't wire it, you have NOT completed the task.

2. TEST FIRST, THEN IMPLEMENT. For every change:
   - Write a failing test that describes the expected behavior (RED)
   - Write the minimum code to make it pass (GREEN)
   - Refactor if needed, tests must still pass (REFACTOR)
   - Run `npx vitest run` after every change. All tests must pass.

3. VERIFY BY EXECUTION, NOT BY INSPECTION. After any change:
   - Run `npx tsc --noEmit` to check types
   - Run `npx vitest run` to check tests
   - Run `node dist/index.js` (or `liminal`) to check the CLI actually works
   - Never say "this should work" — prove it works

4. NEVER CLAIM DONE UNLESS:
   - TypeScript compiles without errors
   - All tests pass
   - The CLI command for the feature runs and produces expected output
   - The new module is imported by at least one other module
   - No "TODO", "FIXME", or "not yet implemented" in the code you wrote

5. FOLLOW EXISTING PATTERNS:
   - Check how similar modules are structured before building new ones
   - Use the same patterns (barrel exports, constructor injection, etc.)
   - If 3 similar modules already exist, CONSOLIDATE rather than add a 4th

6. FOR EVERY FILE YOU WRITE:
   - Check if a similar file already exists that could be extended instead
   - Check the AUDIT-REPORT.md for known issues in the area you're modifying
   - Check the triple-redundancy list below — do NOT create a 4th of anything
```

---

## Triple Redundancy Map (DO NOT ADD MORE OF THESE)

Before creating ANY new module, check this list. If a module already exists for this purpose, extend it instead:

| Category | Existing Modules | KEEP | Remove/Consolidate |
|----------|-----------------|------|-------------------|
| Collaboration | SwarmOrchestrator, DeepCollaboration, CollabClient | SwarmOrchestrator | Merge others into it |
| Scoring | CreativeEvaluator, ScoringEngine, AestheticCritic | ScoringEngine (plugin host) | CreativeEvaluator + AestheticCritic become scoring strategies |
| Prompts | PromptStore, PromptLibrary, ContextBuilder | PromptLibrary + ContextBuilder | Remove PromptStore |
| Memory | HarnessMemory, EpisodicMemory, SemanticArtMemory | HarnessMemory | Archive others |
| Generator Base | TierBasedGenerator, BaseGenerator, Generator | Single Generator interface | Strategy pattern for tiers |
| UI | gui/, gallery/, ui/ | TUI only | Remove web UIs unless used |

---

## Priority Fix Order (What to Fix First)

### Tier 0: Make It Run At All (Day 1)

These are the blocking issues that prevent Liminal from producing ANY output:

**Fix 1: Wire All Generators to ModelRouter**
- File: `src/generators/*.ts` — 8 generators return "No LLM configured"
- Only P5Generator is wired. The other 8 need the same wiring pattern.
- Agent instruction: "Open P5Generator.ts. Find how it initializes the LLM client. Apply the EXACT same pattern to every other generator. After wiring each one, run the generator with `liminal generate --domain <domain> --prompt 'test'` and verify it produces output (not an error). Do not proceed to the next generator until the current one produces output."

**Fix 2: Fix CreativeEvaluator Dead Zone**
- File: `src/evaluators/CreativeEvaluator.ts`
- Every score is exactly 0.68 because the formula produces a constant
- Agent instruction: "The CreativeEvaluator always returns 0.68 because technicalScore defaults to 4/5 and creativeScore defaults to 3/6 regardless of input. Fix: (1) Make technicalScore proportional to actual code features found (not a constant), (2) Make creativeScore proportional to actual creative complexity (variety of functions, use of randomness, animation, interaction), (3) Verify that a 160-byte stub scores significantly lower than a 2000+ byte implementation. Write a test first: generate two pieces of code of different sizes, assert they get different scores."

**Fix 3: Fix RalphLoop to Actually Iterate**
- File: `src/loop/RalphLoop.ts`
- The loop stops at iteration 1 when maxIterations allows more
- Agent instruction: "The RalphLoop should iterate until quality threshold is met OR maxIterations is reached. Fix: (1) Ensure the loop continues when score < threshold AND iteration < maxIterations, (2) Add convergence detection: if score hasn't improved by >0.01 in 3 consecutive iterations, stop, (3) Write a test with maxIterations=5 that verifies the loop actually runs multiple iterations, (4) Write a test that verifies the loop stops when score exceeds threshold."

### Tier 1: Make It Work Correctly (Days 2-3)

**Fix 4: Fix Domain-Specific Validators**
- File: `src/validators/CodeValidator.ts`
- p5.js validation rules applied to Three.js, GLSL, etc.
- Agent instruction: "The CodeValidator applies p5-specific rules (checking for setup/draw/functions) to all domains. Fix: Create a domain-specific validation registry. Each domain (p5, threejs, glsl, strudel, hydra, tone, remotion, html, ascii) gets its own validation function that checks for domain-appropriate patterns. Three.js should check for scene/camera/renderer. GLSL should check for void main(). Strudel should check for sound-generation patterns. Write a test for each domain validator with known-good and known-bad code samples."

**Fix 5: Fix Cache Defeat in RalphLoop**
- File: `src/llm/LLMClient.ts` and `src/loop/RalphLoop.ts`
- Same prompt produces same output across iterations (LLM caching)
- Agent instruction: "The RalphLoop sends the same prompt each iteration, so caching returns identical output. Fix: (1) Include the iteration number in the prompt, (2) Include the hash of the previous iteration's output in the prompt, (3) Include a timestamp or random seed, (4) Verify with a test that consecutive iterations produce different output for the same creative prompt."

**Fix 6: Wire Archives to Generation Context**
- Files: `src/evolution/MapElites.ts`, `src/evolution/NoveltyArchive.ts`, `src/compost/SeedBank.ts`
- All three archives are write-only (data goes in, never comes out)
- Agent instruction: "MapElites, NoveltyArchive, and SeedBank all store data but never feed it back into the generation context. Fix: (1) Add a method to each archive that retrieves relevant entries given a creative prompt, (2) Wire the retrieval into the ContextBuilder so that when RalphLoop generates, it receives seeds/elites/novel examples from the archives, (3) Write a test: populate an archive, generate code, verify the generation context includes archived examples."

### Tier 2: Make It Good (Days 4-5)

**Fix 7: Fix SwarmOrchestrator Ensemble Quality**
- File: `src/swarm/SwarmOrchestrator.ts`
- 5 models, all small (350M-4B), low diversity, voting without calibration
- Agent instruction: "The swarm uses temperature as personality differentiation (wrong — temperature controls randomness, not creativity). Fix: (1) Replace temperature-based differentiation with system-prompt-based differentiation, (2) Each persona should have a distinct creative PHILOSOPHY in its system prompt (not just a temperature), (3) Calibrate the VotingEngine: track which personas produce higher-quality output and weight their votes accordingly, (4) Test: run the same prompt through all 5 personas and verify they produce genuinely different creative approaches (not just different random variations of the same template)."

**Fix 8: Consolidate Triple Redundancy**
- Follow the table above — consolidate 3 collaboration systems, 3 scoring systems, 3 memory systems
- Agent instruction: "There are 3 collaboration systems (SwarmOrchestrator, DeepCollaboration, CollabClient), 3 scoring systems (CreativeEvaluator, ScoringEngine, AestheticCritic), and 3 memory systems (HarnessMemory, EpisodicMemory, SemanticArtMemory). Fix: (1) Keep SwarmOrchestrator as THE collaboration system, extract useful code from the other two, delete the rest, (2) Make ScoringEngine a plugin host with Strategy pattern, convert CreativeEvaluator and AestheticCritic into scoring strategies that plug into it, (3) Keep HarnessMemory as THE memory system, archive the others. After consolidation, run all tests to verify nothing broke."

### Tier 3: Make It Smart (Days 5-7)

**Fix 9: Add Best-of-N Multi-Candidate Generation to RalphLoop**
- File: `src/loop/RalphLoop.ts`
- Currently generates exactly 1 candidate per iteration. The entire rejection sampling architecture requires N.
- Agent instruction: "RalphLoop generates 1 candidate per iteration. The architecture assumes N candidates (rejection sampling, quality thresholds). Fix: (1) Add `numCandidates` parameter (default 3) to RalphLoop constructor, (2) Generate N candidates per iteration, (3) Score all N, keep the best, (4) Feed the best back into context for next iteration. Write a test first: set numCandidates=3, verify 3 candidates are generated and the highest-scored one is selected."

**Fix 10: Implement Sparse Routing in SwarmOrchestrator**
- File: `src/swarm/SwarmOrchestrator.ts`
- All 5 personas always generate for every input (dense). Should be sparse — route to 2-3 relevant experts.
- Agent instruction: "SwarmOrchestrator runs all 5 personas for every prompt. Fix: (1) Create a routing function that computes relevance of each persona's specialty to the current prompt, (2) Select top-K personas (default K=3) based on relevance, (3) Only invoke selected personas, (4) Track which personas were selected for later calibration. Write a test: given a music prompt, verify the audio specialist is selected and the typography specialist is not."

**Fix 11: Replace Deterministic ModelRouter with Thompson Sampling**
- File: `src/routing/ModelRouter.ts` or `src/routing/SmartRouter.ts`
- Current routing has no learning — same model always selected for same task type.
- Agent instruction: "ModelRouter selects models deterministically with no learning from past performance. Fix: (1) Track per-model performance history (model, domain, score, timestamp) in HarnessMemory, (2) Implement Thompson Sampling: each model gets a Beta(alpha, beta) distribution, sample from each, pick highest sample, (3) After each generation, update alpha (success) or beta (failure) based on quality score vs threshold, (4) Add exploration boost when RalphLoop detects stagnation. Write a test: after 10 generations where Model A consistently scores higher than Model B, verify Model A is selected more often."

**Fix 12: Replace CompostMill Domain-Tag Retrieval with Semantic Search**
- File: `src/compost/CompostMill.ts`, `src/compost/SeedBank.ts`
- Seeds retrieved by keyword tags, not by meaning. Two seeds about "generative animation" but tagged differently never match.
- Agent instruction: "SeedBank retrieves seeds by domain tag matching. Fix: (1) Add `@xenova/transformers` dependency for local sentence embeddings, (2) Add `embed()` method to SeedBank that converts seed content to a vector, (3) Add `retrieveSimilar(promptEmbedding, topK)` method that returns seeds by cosine similarity, not tag match, (4) Wire into ContextBuilder so generations receive semantically relevant seeds. Write a test: add a seed about 'flowing particle systems', generate with prompt about 'fluid dynamics', verify the seed is retrieved even without matching tags."

**Fix 13: Add Tournament Selection to MapElites, SeedBank, CompostSoup**
- Files: `src/evolution/MapElites.ts`, `src/compost/SeedBank.ts`, `src/compost/CompostSoup.ts`
- All three use uniform random selection for choosing parents. Tournament selection is a 5-line fix per file.
- Agent instruction: "MapElites.getRandomElite(), SeedBank.getRandomSeed(), and CompostSoup.selectParent() all use uniform random selection. Fix: Replace each with tournament selection: (1) Pick K random candidates (default K=3), (2) Return the one with the highest fitness score. This takes 5 lines per file. Write a test: populate an archive with scores [0.1, 0.5, 0.9], run selection 100 times, verify the 0.9-scored candidate is selected significantly more often than 0.1."

### Tier 4: Make It Real (Days 8-14)

**Fix 14: Implement Render-and-Score Aesthetic Pipeline**
- File: `src/aesthetic/AestheticCritic.ts` + new `src/aesthetic/VisualRenderer.ts`
- Critics analyze source code text only. "White square" failures are never caught because code is never rendered.
- Agent instruction: "AestheticCritic reads source code but never renders it. A p5.js sketch that produces a white square passes the same text-based checks as one producing a complex animation. Fix: (1) Create VisualRenderer that executes p5.js/Three.js code in a headless browser (Puppeteer) and captures a screenshot, (2) Feed screenshot to a vision model or extract pixel-level features (color histogram, edge density, entropy), (3) Add visual quality score as a new evaluation dimension. Write a test: verify that a white-square sketch scores lower than a multi-colored animation on the visual dimension."

**Fix 15: Add 1/5th Success Rule and Stagnation Temperature Spike**
- File: `src/loop/RalphLoop.ts`
- No formal convergence detection and no escape from local optima.
- Agent instruction: "RalphLoop has no formal (1+1)-ES convergence rule and no mechanism to escape local optima. Fix: (1) Implement the 1/5th success rule: track success rate over last 5 iterations (did score improve?), if success rate > 1/5 increase mutation/exploration, if < 1/5 decrease, (2) Add stagnation detection: if score hasn't improved by >0.01 in 5 iterations, inject a temperature spike (force creative divergence), (3) After spike, resume normal convergence. Write a test: simulate a scenario where scores plateau at 0.75 for 5 iterations, verify temperature spike occurs."

**Fix 16: Correct All Data Accuracy Issues**
- Files: All files in `narrative/data/` that contain audited figures
- 20 data accuracy corrections from forensic audit: sessions 58 (not 71), messages 920 (not 1148), dogfood rate 11.1%/21.2% (not 7.4%), lifespan 33 (not 32), model dates, commit counts.
- Agent instruction: "The archaeology data files contain 20 verified inaccuracies from the forensic audit. Fix each one: (1) Session count: 71→58 in telemetry-sessions.json, (2) Message count: 1148→920, (3) Dogfood rate: 7.4%→split into Agent A 11.1% and Agent B 21.2%, (4) Lifespan: 32→33, (5) Claude Code CLI date: Feb 1→Feb 24, (6) All other audit corrections from AUDIT-REPORT.md. After corrections, verify all derived calculations (tokens, percentages) still sum correctly."

**Fix 17: Convert Scoring Components to Pluggable Strategy Pattern**
- Files: `src/evaluators/CreativeEvaluator.ts`, `src/aesthetic/AestheticCritic.ts`, `src/scoring/ScoringEngine.ts`
- Part of triple-redundancy consolidation. Needed before domain-adaptive weights.
- Agent instruction: "CreativeEvaluator and AestheticCritic are hardcoded into the scoring pipeline. Fix: (1) Define a ScoringStrategy interface with `evaluate(code, domain) → Score`, (2) Convert CreativeEvaluator to implement ScoringStrategy, (3) Convert AestheticCritic to implement ScoringStrategy, (4) Make ScoringEngine accept multiple strategies with configurable weights, (5) Wire through RalphLoop. Write a test: register two strategies with different weights, verify the combined score is the weighted average."

**Fix 18: Replace Babel with Tree-Sitter for Multi-Language LIR**
- Files: `src/lir/parsers/CodeParser.ts`, `src/lir/parsers/` (new language parsers)
- LIR only parses JavaScript/TypeScript. The other 7 domains have no structural analysis.
- Agent instruction: "LIR's CodeParser uses Babel which only handles JavaScript/TypeScript. The other 7 domains (GLSL, Strudel, Hydra, Tone.js, Three.js, Remotion, HTML) have no structural parsing. Fix: (1) Add tree-sitter dependency with grammar packages for glsl, python, html, etc., (2) Create a ParserRegistry that selects the correct parser based on domain, (3) Implement domain-specific parsers that extract structural features (GLSL: uniforms, functions, main; Strudel: patterns, stacks; Hydra: sources, outputs), (4) Fallback to regex for unsupported languages. Write a test: parse a GLSL shader, verify uniforms and void main() are extracted as LIR tokens."

**Fix 19: Add Incremental Context Checkpointing**
- File: `src/context/ContextAccumulator.ts`
- Stores 50 full snapshots. Consumes context window with redundant data.
- Agent instruction: "ContextAccumulator stores full state snapshots. After 50 iterations, this consumes massive context window space with mostly redundant data. Fix: (1) Switch to delta-based checkpointing: store only the diff between iterations, (2) Keep full snapshot only at iteration 0 and the latest, (3) Reconstruct any intermediate state by applying deltas from iteration 0, (4) Add a compression pass that summarizes old deltas into a single summary paragraph. Write a test: run 10 iterations, verify that context size grows sub-linearly (not linearly)."

**Fix 20: Add Domain-Adaptive Scoring Weights**
- File: `src/scoring/ScoringEngine.ts`
- CreativeEvaluator has no learning mechanism. Same weights regardless of domain.
- Agent instruction: "ScoringEngine applies the same weight to every scoring dimension regardless of domain. But typography matters more for HTML than for audio, and sound harmony matters only for Tone.js/Strudel. Fix: (1) Define per-domain weight profiles (p5: {technical: 0.3, creative: 0.3, aesthetic: 0.2, novelty: 0.2}, strudel: {technical: 0.2, creative: 0.2, aesthetic: 0.1, novelty: 0.2, sound: 0.3}), (2) Load weights based on domain parameter, (3) Track which weight profiles produce higher scores over time, (4) Add a learning mode that adjusts weights based on promoted/rejected history. Write a test: score the same code with p5 weights and strudel weights, verify they produce different scores."

---

# PART 2: ARCHITECTURE + ML CORRECTIONS

For each Liminal component: what it is, what it should be, and the specific fix.

---

## Component 1: RalphLoop

**ATTRIBUTION:** The core loop technique (agent loop → LLM → error feedback → iterate) was created by **Geoffrey Huntley** as the "Ralph Wiggum Loop" in mid-2025. Simon learned directly from Huntley's published materials and adapted the technique for creative coding. Simon's additions: evolutionary scoring, quality thresholds, compost seed injection, multi-candidate generation. The loop itself is Huntley's.

**What you built:** Iterative loop that generates code, scores it, accumulates context, and repeats until quality threshold or max iterations.

**What you thought it was:** (1+1) Evolution Strategy — one parent generates one offspring, better one survives.

**What it actually is:** A single-pass template generator with a broken stopping criterion. The audit found: stops at iteration 1 (maxIterations harness bug), scores are constant (0.68 dead zone), caching prevents genuine iteration.

**What it SHOULD be — Formal ML: Rejection Sampling with Best-of-N and Convergence Detection**

```
Correct implementation:
1. Generate N candidates (not 1) per iteration
2. Score each candidate with a calibrated reward model
3. Keep the best one
4. If best score > threshold: accept and stop
5. If rolling-average improvement < epsilon for 3 consecutive iterations: stop (converged)
6. If iteration >= maxIterations: stop (budget exhausted)
7. Feed the best candidate's features back into the next generation prompt
```

**Specific code changes:**
- `RalphLoop.ts`: Add `numCandidates` parameter (default 3-5)
- `RalphLoop.ts`: Add convergence detection (rolling average of last 3 scores)
- `RalphLoop.ts`: Include previous output hash in prompt to defeat caching
- `CreativeEvaluator.ts`: Replace constant formula with variable scoring (Fix 2 above)

**From the ML learning plan (Module 4: RLHF):**
- Study: Rejection sampling, best-of-N sampling, reward model calibration
- The key concept: your "reward model" (CreativeEvaluator) must be CALIBRATED — scores should correlate with actual quality, not just structural features
- Paper: Stiennon et al., "Learning to Summarize with Human Feedback" (NeurIPS 2020)

---

## Component 2: CompostMill

**What you built:** 7-stage pipeline (heap → extract → shred → collide → score → promote → seed bank) that decomposes failed creative work into fragments and recombines them.

**What you thought it was:** Variational Autoencoder (encoder → latent space → sampling).

**What it actually is:** A batch ETL pipeline with keyword-based retrieval. No encoder network, no latent distribution, no reconstruction loss, no KL-divergence. Seeds are selected by domain tags, not by semantic similarity to the creative intent.

**What it SHOULD be — Formal ML: Retrieval-Augmented Generation (RAG) with Semantic Embeddings**

```
Correct implementation:
1. Embed each compost fragment using Sentence-BERT or similar
2. Store embeddings in a vector database (ChromaDB or FAISS)
3. When generating, embed the current creative prompt
4. Retrieve top-K semantically similar fragments
5. Inject retrieved fragments as in-context examples
6. Order examples by relevance (research shows ordering matters)
```

**Specific code changes:**
- New dependency: `chromadb` or `faiss` for vector storage
- New dependency: `@xenova/transformers` for local sentence embeddings (or use an embedding API)
- `CompostMill.ts`: Replace `domainTags` matching with vector similarity search
- `SeedBank.ts`: Add `embed()` method that converts seed content to vectors
- `SeedBank.ts`: Add `retrieveSimilar(promptEmbedding, topK)` method
- `ContextBuilder.ts`: Inject retrieved seeds in relevance order

**From the ML learning plan (Module 3: Embeddings & RAG):**
- Study: Word2Vec → Sentence-BERT → CodeBERT, vector databases, RAG pipeline
- The key concept: discrete token matching (what you have) vs. continuous vector similarity (what you need)
- Papers: Lewis et al., "Retrieval-Augmented Generation" (NeurIPS 2020); Liu et al., "What Makes Good In-Context Examples" (arXiv 2022)

---

## Component 3: SwarmOrchestrator

**What you built:** 5 AI personas with different models/temperatures that generate outputs, then vote on the best via Borda count.

**What you thought it was:** Mixture of Experts — specialized agents with dynamic routing.

**What it actually is:** A dense ensemble (all personas always generate for every input) with uncalibrated voting and temperature-misused-as-personality.

**What it SHOULD be — Formal ML: Sparse Mixture of Experts with Learned Routing**

```
Correct implementation:
1. Define expert SPECIALTIES via system prompts (not temperatures):
   - Expert 1: Minimalist/geometric visual art
   - Expert 2: Organic/nature-inspired patterns
   - Expert 3: Mathematical/fractal structures
   - Expert 4: Interactive/physical simulation
   - Expert 5: Audio-driven visualization
2. ROUTE each prompt to the 2-3 most relevant experts (sparse, not dense)
   - Use prompt embedding similarity to expert descriptions
   - This is the "gating network" in formal MoE
3. CALIBRATE voting weights based on historical accuracy per domain
4. Track per-expert quality metrics over time
```

**Specific code changes:**
- `SwarmOrchestrator.ts`: Add routing logic (which experts to invoke for a given prompt)
- `SwarmOrchestrator.ts`: Replace temperature differentiation with system-prompt specialization
- `VotingEngine.ts`: Add calibration (weight votes by per-expert historical accuracy)
- New: Track expert performance per domain in HarnessMemory

**From the ML learning plan (Module 1: LLM Fundamentals + Module 5: QD & Ensembles):**
- Key concept: Temperature ≠ personality. Personality comes from system prompts.
- Key concept: Dense ensembles (all experts always run) are wasteful. Sparse routing (only relevant experts run) is more efficient AND produces better results.
- Paper: Shazeer et al., "Outrageously Large Neural Networks: The Sparsely-Gated Mixture-of-Experts Layer" (ICLR 2017)

---

## Component 4: MapElites + NoveltyArchive

**What you built:** N-dimensional quality-diversity grid + k-NN novelty scoring.

**What you thought it was:** MAP-Elites quality-diversity optimization with novelty search.

**What it actually is:** Correct algorithms at the implementation level (verified by audit) but: (1) write-only archives (nobody retrieves from them), (2) regex-based behavior descriptors (noisy and meaningless), (3) uniform random selection instead of tournament selection.

**What it SHOULD be — Formal ML: Quality-Diversity Optimization with Embedding-Based Descriptors**

```
Correct implementation:
1. Replace regex behavior descriptors with embedding-based descriptors
   - Use code embeddings (CodeBERT or similar) to characterize each solution
   - Map embeddings to grid dimensions using PCA or UMAP
2. Wire archive RETRIEVAL into generation context
   - When generating, retrieve diverse high-quality examples from the grid
   - Inject them as "inspiration" into the generation prompt
3. Use tournament selection (not uniform random) for retrieval
   - Select the best from a random subset of archive entries
4. Track whether grid coverage is increasing over time
```

**Specific code changes:**
- `MapElites.ts`: Replace `featureVector` (regex-based) with embedding-based descriptor
- `MapElites.ts`: Add `getDiverseElite(count)` method with tournament selection
- `NoveltyArchive.ts`: Replace linear scan with KD-tree for k-NN (current O(n*k) won't scale)
- Wire both into `ContextBuilder.ts` as generation context sources

**From the ML learning plan (Module 5: Quality-Diversity Optimization):**
- Papers: Mouret & Clune, "Illuminating Search Spaces" (2015); Lehman & Stanley, "Abandoning Objectives" (2011)
- Key concept: behavior descriptors must capture MEANINGFUL variation, not structural noise

---

## Component 5: AestheticCritic

**What you built:** 4 specialist critics (Color Harmony, Layout, Typography, Sound Harmony) that evaluate creative output using hand-coded rules.

**What you thought it was:** GAN discriminator — adversarial evaluator that learns to distinguish good from bad.

**What it actually is:** A static rule-based filter applied post-generation. No adversarial training, no learning from feedback, no gradients flowing back to the generator.

**What it SHOULD be — Formal ML: Multi-Objective Reward Model with Calibration**

```
Correct implementation:
1. Keep the 4 specialist critics (good architecture)
2. Add CALIBRATION: verify each critic's scores correlate with human judgment
   - Generate 20 outputs, have you rate them, compare with critic scores
   - Adjust critic weights until correlation is >0.7
3. Make critics PLUGGABLE (Strategy pattern) into ScoringEngine
4. Add a meta-critic that detects when critics disagree (uncertainty signal)
5. Feed uncertainty signal back to RalphLoop as exploration trigger
```

**Specific code changes:**
- `AestheticCritic.ts`: Convert to ScoringStrategy plugin
- `ScoringEngine.ts`: Accept multiple scoring strategies with configurable weights
- New: `CalibrationSuite.ts` — generates outputs, collects human ratings, adjusts weights
- New: Uncertainty detection when critic scores diverge significantly

**From the ML learning plan (Module 2: Evaluation + Module 4: RLHF):**
- Key concept: a reward model is only useful if it's CALIBRATED — scores must correlate with actual quality
- Paper: Chen et al., "Evaluating LLMs Trained on Code" (2021) — the `pass@k` metric concept

---

## Component 6: ModelRouter / SmartRouter

**What you built:** Routes between models based on confidence thresholds and task-type heuristics.

**What you thought it was:** Multi-Armed Bandit — balancing exploration vs. exploitation.

**What it actually is:** Deterministic routing with no learning, no exploration, no tracking of per-model performance over time.

**What it SHOULD be — Formal ML: Multi-Armed Bandit with Thompson Sampling**

```
Correct implementation:
1. Track per-model performance history: {model, domain, prompt, score, timestamp}
2. Use Thompson Sampling for routing:
   - Each model is an "arm" with a Beta distribution of success probability
   - Sample from each arm's distribution, pick the one with highest sample
   - This naturally balances exploration (try underused models) and exploitation (use proven models)
3. Update distributions after each generation based on quality score
4. Decay old observations (recent performance matters more)
```

**Specific code changes:**
- `ModelRouter.ts`: Add `performanceHistory` storage in HarnessMemory
- `ModelRouter.ts`: Implement Thompson Sampling (Beta distribution sampling)
- `ModelRouter.ts`: Add exploration mode (when stagnation detected in RalphLoop, increase exploration)
- Track: model × domain × score tuples over time

**From the ML learning plan (Module 1: LLM Fundamentals):**
- Key concept: routing without learning is just dispatch. Routing WITH learning is optimization.
- Paper: Auer et al., "Finite-Time Analysis of the Multiarmed Bandit Problem" (2002)

---

## Component 7: Hooks System (26 hooks)

**What you built:** Interceptor chain that runs before/after tool calls in Claude Code, enforcing rules like "always wire end-to-end."

**What you thought it was:** Aspect-Oriented Programming — cross-cutting concerns applied via pointcuts.

**What it actually is:** Structurally accurate AOP-like interceptor, verified by audit. This is the CLOSEST to a correct formal implementation of all 10 claims. The gap is minor: constrained to Claude Code lifecycle events rather than arbitrary join points.

**What it SHOULD be — Stay As-Is (with minor improvements)**

This is already the strongest component. Minor improvements:
1. Add a hook that validates ML model usage (e.g., "is temperature being used as personality?")
2. Add a hook that catches triple-redundancy before it happens ("a module like this already exists")
3. Add a hook that enforces calibration testing for new scoring components

---

## Component 8: Audio Pipeline (AudioAnalyzer + AudioToVisualMapper)

**What you built:** Meyda for feature extraction, pitchfinder for F0, heuristic rules mapping pitch → color, timbre → shape.

**What it should be — Formal ML: Cross-Modal Learning with CLAP**

```
Correct implementation:
1. Replace heuristic pitch-to-color rules with CLAP embeddings
2. Audio features → trained audio encoder → latent representation
3. Latent representation → trained mapping layer → visual parameters
4. The mapping LEARNS from data what sounds correspond to what visuals
```

**From the ML learning plan (Module 7: Cross-Modal Learning):**
- Papers: Wu et al., "Large-Scale Contrastive Language-Audio Pretraining" (CLAP, ICASSP 2023)
- Key concept: heuristic rules can capture obvious patterns (high pitch = bright colors) but miss the complex, learned associations that make cross-modal mapping feel "right"

---

## Component 9: LIR (Liminal Intermediate Representation)

**What you built:** Structured token system from AST parsing (CodeParser, DocParser, TextParser, CompostParser).

**What it should be — Formal ML: Representation Learning with Learned Embeddings**

```
Current: AST parsing → discrete structural tokens → keyword matching
Target:  Code input → CodeBERT encoder → continuous vector representation → semantic similarity
```

LIR tokens are not embeddings. They capture structure but not semantics. Two pieces of code that do the same thing differently would have completely different LIR representations but very similar embeddings. The fix: keep LIR for structural analysis, ADD embedding-based representation for semantic matching.

---

## Component 10: PromptLibrary (27 prompts)

**What you built:** 27 manually-written prompt templates, iterated through trial and error, no A/B testing.

**What it should be — Formal ML: DSPy-style Prompt Optimization**

```
Current:  Write prompt → run → tweak manually → repeat
Target:   Define metric → write prompt template → DSPy optimizes → evaluate → iterate automatically
```

**From the ML learning plan (Module 8: Prompt Optimization):**
- Paper: Khattab et al., "DSPy: Compiling Declarative Language Model Calls" (NeurIPS 2023)
- Key concept: treat prompts as programs that can be optimized, not text that must be manually crafted

---

# PART 2.5: IMPROVEMENT HORIZONS + ORIGINALITY MAP

## The "Make It BETTER" Table

Part 2 corrects each component to what it *should* be. This table asks: **what would push it beyond correction into genuine innovation?**

| # | Component | Current Fix (Part 2) | What Would Make It BETTER | Why It Would Be Better |
|---|-----------|---------------------|--------------------------|----------------------|
| 1 | RalphLoop | Rejection Sampling (Best-of-N) | **Tree-of-Thought (ToT) search with MCTS** — explore branching creative possibilities with backtracking instead of linear best-of-N | Best-of-N is a flat filter: generate N, keep best. ToT is an *exploration*: the model reasons through multiple creative paths, evaluates intermediate steps, backtracks from dead ends, and pursues the most promising branches. For creative work, this means discovering unexpected solutions that linear sampling would never find. Paper: Yao et al., "Tree of Thoughts" (NeurIPS 2023). |
| 2 | CompostMill | RAG with semantic embeddings | **Latent Diffusion for Creative Interpolation** — instead of just retrieving similar fragments, generate novel creative ideas by interpolating between seed embeddings in latent space | RAG retrieves what already exists. Latent diffusion *generates what could exist*. Instead of retrieving seeds similar to the prompt, interpolate between multiple seed embeddings to produce hybrid creative ideas that are genuinely new — combinations no human would think to make. This is how DALL-E and Stable Diffusion work for images; the same principle applies to creative code. Paper: Rombach et al., "High-Resolution Image Synthesis with Latent Diffusion Models" (CVPR 2022). |
| 3 | SwarmOrchestrator | Sparse MoE with learned routing | **Multi-Agent Debate with Constitutional AI** — experts critique each other's work through structured adversarial debate, not just vote | Voting averages out opinions (and averages out creativity). Debate *sharpens* ideas. Expert A generates, Expert B critiques, Expert A revises. The adversarial pressure produces better work than any single expert or any uncalibrated vote. This is how Constitutional AI works at Anthropic: the model critiques itself through structured dialogue. Papers: Irving et al., "AI Safety via Debate" (2018); Bai et al., "Constitutional AI" (2022). |
| 4 | MapElites | QD with embedding-based descriptors | **Bayesian Quality-Diversity (Bayesian QD)** — use surrogate models to predict which regions of the feature space will produce high-quality novel outputs | Current QD explores randomly. Bayesian QD says "based on what we've seen so far, *this unexplored region* is likely to produce high-quality novel work." It's the difference between random search and informed search. For Liminal, this means the grid fills with diverse high-quality work in fewer generations. Paper: Kent et al., "Bayesian Quality Diversity" (GECCO 2024). |
| 5 | AestheticCritic | Calibrated multi-objective reward model | **Learning-to-Rank with Pairwise Preferences (RLHF-style)** — train on "which piece do you prefer?" instead of "rate this piece 1-10" | Absolute scores (1-10) are noisy — the same person rates the same piece differently on different days. Pairwise comparisons ("I prefer A over B") are much more reliable signal. RLHF works on this principle: you don't need perfect scores, just consistent preferences. After 50-100 pairwise comparisons from Simon, the critic learns his aesthetic. Papers: Ouyang et al., "Training language models to follow instructions" (2022); Christiano et al., "Deep RL from Human Preferences" (2017). |
| 6 | ModelRouter | Thompson Sampling MAB | **Contextual Bandits with Neural Upper Confidence Bound (Neural UCB)** — consider prompt features (domain, complexity, style) for routing, not just historical model performance | Thompson Sampling treats each model as an arm with independent performance. But a model that's great at p5.js might be terrible at GLSL. Contextual bandits learn model × context interactions: "for Three.js shaders with interactive prompts, Model X is best." This is sample-efficient and adapts to new domains automatically. Paper: Zhou et al., "Neural Contextual Bandits with UCB-based Exploration" (NeurIPS 2020). |
| 7 | Hooks System | Already strongest (AOP-like interceptor) | **Meta-Learned Hook Policies** — automatically adjust hook sensitivity based on outcome data | Currently 26 hand-coded hooks with fixed thresholds. A meta-learner would track: "which hooks actually catch real bugs vs. which just slow development?" Over time, hooks that never catch anything get muted; hooks that catch critical issues get reinforced. The system *learns its own enforcement policy*. |
| 8 | Audio Pipeline | CLAP cross-modal embeddings | **Generative Audio-Visual Co-Embedding** — produce novel cross-modal mappings that feel "right" but no human would design | CLAP maps audio and text to the same space, but Liminal needs audio → *visual parameters*, not audio → text. A trained generative mapping would learn from data that "this kind of bass corresponds to these kinds of shapes and colors" — including mappings that are aesthetically powerful but non-obvious. The difference between a heuristic rule ("high pitch = bright colors") and a learned correspondence that captures the full richness of audio-visual aesthetics. |
| 9 | LIR | CodeBERT embeddings | **Structure-Aware Multimodal Program Representation** — combine AST structural information (what LIR captures) with semantic embeddings (what CodeBERT captures) | Pure embeddings lose structural information. Pure AST tokens lose semantic meaning. The future is *both*: a representation that knows "this is a for-loop" (structure) AND "this for-loop generates a spiral pattern" (semantics). Graph neural networks over ASTs + CodeBERT embeddings = the best of both worlds. Paper: Guo et al., "GraphCodeBERT" (ICLR 2021). |
| 10 | PromptLibrary | DSPy-style prompt optimization | **Self-Refine with Constitutional Prompts** — prompts that evolve during the generation session based on intermediate results | DSPy optimizes prompts offline. Self-Refine optimizes them *live*: the model generates, critiques its own output against the prompt, and revises the prompt for the next iteration. The prompt becomes a living document that adapts to what works. For creative work, this means the generation strategy evolves *within a single session*. Papers: Madaan et al., "Self-Refine" (NeurIPS 2023); Khattab et al., "DSPy" (NeurIPS 2023). |

---

## Originality Analysis: What Came From YouTube vs. What Is Genuinely Simon's

Cross-referencing the 10 component architectures with the YouTube correlation matrix (`youtube-transcript-analysis.json`, 30 explicit video→feature mappings, 22 module correlation entries, 1,481 videos over 3 years).

### Concepts With Confirmed Attribution (72%)

| Component | Source | Correlation Strength |
|-----------|--------|---------------------|
| **RalphLoop core technique** | **Geoffrey Huntley's Ralph Wiggum Loop** (created mid-2025, went viral Dec 2025). Simon directly adapted Huntley's technique — a bash loop feeding errors back into LLM prompts until the task completes. The Liminal version adds creative scoring, evolutionary iteration, and compost integration ON TOP of Huntley's core pattern. Huntley is the originator of the loop itself. | **Confirmed Attribution** — Simon learned directly from Huntley's published materials |
| RalphLoop evolutionary additions (ES scoring, convergence, quality thresholds) | Simon's own extensions to Huntley's base pattern. NOT from AI Warehouse — Simon confirms AI Warehouse was entertainment/visual art, not a source for RalphLoop concepts. The scoring, convergence, and quality threshold additions are Simon's original creative adaptations. | **Simon's original** — additions to Huntley's base |
| MCP integration | Matthew Berman "How to setup MCP servers" (Sep 16, 2025) | **Very Strong** — tool-use architecture shaped directly |
| ICM Methodology | Jake Van Clief "Folder System" (Mar 11, watched twice). User explicitly credits: "Jake Van Clief literally came up with ICM." | **Confirmed Attribution** — Simon names the source |
| Memory system | Brian Casel "Memory Problem" (Oct 11, 2025); Letta "Context Repositories" (Mar 6, 2026) | **Strong** |
| CreativeEvaluator | Nate B Jones "97.5% Failure" (Mar 21); MLOps "Build Real Evals" (Mar 31) | **Strong** — video title became design philosophy |
| LIR concept | Ray Fernando "Two MCPs That Save 97% of Context Window" (Nov 24, 2025) | **Strong** |
| CLI architecture | 200+ Claude Code CLI videos cumulatively | **Strong** (distributed) |
| Audio module concepts | Bijan Bowen voice chatbot (Sep 26, 2025); Nate Herk voice agents (Mar 28, 2026) | **Moderate** |
| Swarm multi-agent | AI Warehouse "AI Olympics" (Mar 21); IndyDevDan agent SDK (Sep 24, 2025) | **Moderate** — concept from video, specific application original |
| ModelRouter | Multi-model coding agent videos (Mario Zechner, AICodeKing) | **Moderate** — general concept from videos |

### Genuinely Original Ideas (32%) — NO Specific Video Precursor

These are the ideas where the YouTube correlation matrix shows only vague, generic connections ("data pipeline architecture", "creative AI workflows") or no connection at all. The specific concept, metaphor, or application cannot be traced to any watched video.

**1. The CompostMill Metaphor and 7-Stage Pipeline**

The idea that failed creative work should be *composted* — broken down into fragments, shredded, collided with other fragments, scored, and promoted as seeds for future generations — has no video precursor. The YouTube correlations for CompostMill are the weakest of all 22 modules: "creative AI workflows", "data pipeline architecture", "seed-based generation." These are generic enough to apply to any software project.

The metaphor traces instead to Simon's ceramics practice: clay scraps are never thrown away. They're rehydrated, wedged, and reused. Failed glazes become ingredients for new experiments. The entire pipeline (heap → extract → shred → collide → score → promote → seed bank) is a computational version of what happens on the pottery wheel.

**Originality: HIGH.** This is the single most original concept in Liminal. No YouTube video teaches "compost your creative failures." It came from clay.

---

**2. Multi-Domain Creative Generation from One CLI**

The idea of a single tool that generates creative output across p5.js, Three.js, GLSL, Strudel, Hydra, Tone.js, Remotion, HTML Canvas, and ASCII art — treating visual art, 3D scenes, music, video, and generative text as one unified creative space — has no video precursor. No YouTube video teaches "build a multi-domain creative coding agent." The coding agent videos focus on *software engineering* tasks (building apps, fixing bugs), not creative art generation.

The specific choice of 9 domains and the idea that the same evolutionary/composting/quality-diversity pipeline applies to all of them is a unique synthesis.

**Originality: HIGH.** The concept of a creative coding agent (as opposed to a software engineering agent) is itself original. The 9-domain unification is Simon's invention.

---

**3. The 4-Specialist AestheticCritic Architecture**

While evaluation videos influenced the *concept* of evaluation, the specific 4-critic architecture — Color Harmony, Layout Balance, Typography, Sound Harmony — is not taught in any video. The YouTube correlations for AestheticCritic are: "design quality assessment (UI Collective)" and "accessibility and readability (various)." These teach UI design principles, not a multi-specialist critic ensemble.

The 4-critic design is a synthesis of Simon's aesthetic sensibility (from ceramics, graphic design, and music) applied to code evaluation. The idea that a system should evaluate creative code through *four independent specialist lenses* rather than one monolithic score is original.

**Originality: HIGH.** Multi-critic evaluation ensembles exist in ML literature (e.g., GAN discriminator committees), but the specific 4-specialist creative code evaluation is Simon's design.

---

**4. MapElites for Creative Code Quality-Diversity**

The MAP-Elites algorithm itself is from the literature (Mouret & Clune, 2015). But the *application* to creative code — organizing generated sketches into an n-dimensional grid where each cell represents a different combination of creative features (colorfulness, animation, interactivity, complexity) — is not taught in any watched video. The YouTube correlations for MapElites are absent; the closest is "Evolution in Higher Dimensions" (Emergent Garden, Mar 1), which teaches the concept of fitness landscapes but not MAP-Elites specifically.

The specific feature dimensions chosen for the grid (and the regex-based behavior descriptors, flawed as they are) are Simon's design.

**Originality: MODERATE-HIGH.** The algorithm is from literature; the application to creative code is original.

---

**5. Creative Collisions (Fragment Recombination)**

The specific idea of taking fragments from different failed creative works and *colliding* them to produce novel combinations is not taught in any video. While genetic crossover is a well-known concept, the "collision" metaphor and the specific implementation (shred → score → promote) are unique. The YouTube correlation for collisions is only "seed-based generation (evolutionary simulators)" — generic.

**Originality: MODERATE-HIGH.** Genetic recombination is standard; the collision metaphor and multi-domain fragment mixing are original.

---

**6. Audio-to-Visual Cross-Modal Mapping for Creative Code**

While audio visualization is a well-explored field, the specific pipeline that maps audio features (pitch, timbre, amplitude via Meyda) to *creative code generation parameters* (not just visual output) is original. No video teaches "analyze audio → generate p5.js code that responds to the audio." The YouTube correlations are: "local voice chatbot" and "voice agents" — these teach voice interaction, not audio-driven creative generation.

The specific mapping (pitch → color, timbre → shape) may feel obvious, but embedding it into a creative code generation pipeline where the generated code *itself* responds to audio is a unique synthesis.

**Originality: MODERATE.** Audio visualization exists; embedding it in a generative creative coding pipeline is a novel synthesis.

---

**7. The "Liminal" Concept — AI as Creative In-Between**

The philosophical framing of Liminal as an entity that exists in the space between human creativity and machine generation — neither fully human nor fully AI, but something in the liminal space — has no video precursor. This is a creative/philosophical concept that emerged from Simon's practice of treating clay, code, music, and data as ONE creative discipline.

**Originality: HIGH.** The name and philosophical framing are entirely original.

---

### Originality Summary

| Category | Count | % |
|----------|-------|---|
| **Confirmed attribution to specific people** | RalphLoop → Geoffrey Huntley, ICM → Jake Van Clief | 2 named sources |
| **Traceable to specific videos** | ~7 components | 68% |
| **Genuinely original (no video precursor)** | ~5 components + 2 metaphors | 28% |
| **Of which: HIGH originality** | CompostMill, Multi-domain CLI, 4-critic architecture, "Liminal" concept | 4 ideas |

**The key finding:** Simon's genuinely original contributions are the *creative* ideas — the compost metaphor, the multi-domain unification, the specialist critic architecture, and the philosophical framing. The *technical* architecture came from three sources: (1) Geoffrey Huntley's Ralph Wiggum Loop, (2) Jake Van Clief's ICM methodology, and (3) 1,481 YouTube videos absorbed over 3 years. This is exactly the pattern you'd expect from a creative technologist: original vision expressed through learned technical patterns, with honest attribution.

**Critical attributions:**
- **Geoffrey Huntley** created the Ralph Wiggum Loop (mid-2025). Simon's RalphLoop adapts Huntley's technique for creative coding. The evolutionary scoring, compost integration, and quality thresholds are Simon's additions, but the core loop pattern is Huntley's.
- **Jake Van Clief** created the ICM (Infinite Context Machine) methodology. Simon explicitly credits: "Jake Van Clief literally came up with ICM."
- The CompostMill is the crown jewel of originality. It is the single most unique idea in Liminal, and it came from clay — not from a video.

**Note on AI Warehouse:** 14 AI Warehouse videos were watched during the RL Discovery era (Mar 15-20). Format: music and colored blocks trying, failing, iterating, gradually learning. No narration, no explanation — pure visual ML. Simon confirms: AI Warehouse taught him ML concepts *visually and intuitively* (evolution, selection pressure, fitness landscapes, convergence) that he absorbed without learning their formal names. These concepts ARE real influences on Liminal's evolutionary design — just not the RalphLoop specifically. The RalphLoop came from a separate stream: viral YouTube discussion → Geoffrey Huntley's published materials. Two independent learning streams converging in the same codebase during the same week.

**Simon's own words:** "AI Warehouse is machine learning, and I did learn visually and intuitively. I didn't know those by name in any way, and even the Ralph Loop I only know as the Ralph loop. I don't know exactly what it is in machine learning terms." This confirms the core insight: concepts arrived through visual observation and viral discussion, not through academic instruction. The vocabulary gap is real and expected.

---

# PART 3: THE EXECUTION PRIORITY

## What to tell building agents, in order:

### Week 1: Make It Run (Tier 0 Fixes)
1. Wire all 8 unwired generators to ModelRouter (Fix 1)
2. Fix CreativeEvaluator dead zone (Fix 2)
3. Fix RalphLoop iteration logic (Fix 3)
4. After each fix: run `npx vitest run` + `liminal generate --domain p5 --prompt 'circle'`

### Week 2: Make It Right (Tier 1 Fixes)
5. Fix domain-specific validators (Fix 4)
6. Fix cache defeat (Fix 5)
7. Wire archives to generation context (Fix 6)

### Week 2.5: Make It Good (Tier 2)
8. Fix SwarmOrchestrator ensemble quality (Fix 7)
9. Consolidate triple redundancy (Fix 8)

### Week 3: Make It Smart (Tier 3)
10. Add Best-of-N generation to RalphLoop (Fix 9)
11. Implement sparse routing in Swarm (Fix 10)
12. Replace ModelRouter with Thompson Sampling (Fix 11)
13. Replace tag matching with semantic search (Fix 12)
14. Add tournament selection to all archives (Fix 13)

### Week 4: Make It Real (Tier 4)
15. Implement render-and-score pipeline (Fix 14)
16. Add 1/5th success rule + stagnation spike (Fix 15)
17. Correct all data accuracy issues (Fix 16)
18. Convert scoring to Strategy pattern (Fix 17)
19. Replace Babel with tree-sitter (Fix 18)
20. Add incremental checkpointing (Fix 19)
21. Add domain-adaptive scoring (Fix 20)

---

# PART 4: CONTEXT FOR THE AGENTS

## Your Developer Profile (Agents Need This)

Simon is:
- A ceramicist and creative technologist (www.cerafica.com — Clay/Code/Computation)
- 12 years in Learning Operations (LMS administration, training design, data analytics)
- Self-taught developer, first code September 2025, 6 months experience
- Uses GLM models (4.5→5.1) inside Claude Code for primary development
- Learns by wiring things end-to-end (not by reading tutorials)
- Works in burst patterns (6-hour deep sessions, not daily 1-hour practice)
- Bilingual English/Spanish

## What "Working" Means

Liminal has NEVER been seen working end-to-end. The dogfood test showed 11.1% success rate on p5.js, 0% on all other domains. "Working" means:

```bash
# All of these must produce visible creative output:
liminal generate --domain p5 --prompt 'flowing river'        # p5.js animation
liminal generate --domain threejs --prompt 'crystal cave'     # Three.js 3D scene
liminal generate --domain glsl --prompt 'aurora borealis'     # GLSL shader
liminal generate --domain strudel --prompt 'ambient pulse'    # Strudel music
liminal generate --domain hydra --prompt 'feedback loops'     # Hydra visuals
liminal generate --domain tone --prompt 'percussion rain'     # Tone.js audio
liminal generate --domain html --prompt 'interactive grid'    # HTML canvas
liminal generate --domain remotion --prompt 'text reveal'     # Remotion video

# The loop should iterate:
liminal loop --domain p5 --prompt 'generative garden' --max-iterations 5
# This should produce 5 DIFFERENT iterations, not the same output 5 times

# The compost system should recycle:
liminal compost add failed_sketch.js
liminal compost digest
# Seeds should appear in subsequent generations
```

---

*Sources: AUDIT-REPORT.md (forensic audit), LEARNING-PLAN.md (8 learning phases), ML-LEARNING-PLAN.md (8 ML modules), reverse-engineering-plan.md (10 intuitive-to-formal mappings), frustration-analysis.md (6 frustration categories), developer-resume.md (career context), era10-assessment.md (current state), 391 commits on main.*
