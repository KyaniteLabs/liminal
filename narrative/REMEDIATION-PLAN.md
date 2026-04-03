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

---

# PART 2: ARCHITECTURE + ML CORRECTIONS

For each Liminal component: what it is, what it should be, and the specific fix.

---

## Component 1: RalphLoop

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

### Week 3: Make It Good (Tier 2 + ML Upgrades)
8. Fix SwarmOrchestrator ensemble quality (Fix 7)
9. Consolidate triple redundancy (Fix 8)
10. Begin ML upgrades: embedding-based compost retrieval (Component 2)

### Week 4+: Make It Smart (ML Architecture)
11. Implement Thompson Sampling for ModelRouter (Component 6)
12. Add embedding-based behavior descriptors for MapElites (Component 4)
13. Begin cross-modal learning integration for AudioPipeline (Component 8)
14. Set up DSPy for prompt optimization (Component 10)

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
