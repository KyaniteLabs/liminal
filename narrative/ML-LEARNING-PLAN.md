# ML-Specific Accelerated Learning Plan for Simon Gonzalez De Cruz

**Derived from:** 10 patterns correlating Liminal subsystems to ML techniques the developer was attempting without knowing it
**Date:** April 1, 2026
**Prerequisite:** First line of code September 2025. 6 months AI-native development. Zero ML coursework.

---

## The Key Insight

Simon intuitively reinvented the architecture of modern ML systems for creative AI. Every subsystem in Liminal maps to a legitimate ML technique — but built with hand-crafted heuristics instead of learned components:

| Liminal Component | ML Technique He Built | What's Missing |
|---|---|---|
| RalphLoop | RLHF / Iterated Refinement | Reliable reward model |
| SwarmOrchestrator | Ensemble Methods | Diversity calibration |
| LIR | Representation Learning | Learned embeddings |
| MapElites | Quality-Diversity Optimization | Accurate behavior descriptors |
| Compost Mill | Few-Shot Learning / RAG | Semantic retrieval |
| ScoringEngine | Evaluation Metrics | Execution-based evaluation |
| DeepCollaboration | Multi-Agent Systems | Coordination theory |
| SmartRouter | Mixture of Experts | Real benchmarks |
| AudioPipeline | Cross-Modal Learning | Learned cross-modal encoders |
| PromptLibrary | Prompt Engineering | DSPy-style optimization |

What Simon needs is not more code but conceptual understanding of why each technique works, what its failure modes are, and how to evaluate whether it is working.

---

## Module 1: LLM Fundamentals

**Why this first:** Would have prevented ~40% of all frustration events. Temperature, sampling, context windows, and model APIs are the plumbing of everything Simon built.

### What Simon Already Built (Proof of Readiness)
- Multi-provider LLM client (`LLMClient.ts`) supporting 7 providers
- Local model hosting (LM Studio, Ollama) on AMD NUC with 96GB RAM
- 5-model swarm with per-model temperature settings
- Context window management (compaction, session restore)

### What Went Wrong (The Gap)
1. **Temperature is a sampling parameter, not a personality knob.** Simon set different temperatures per swarm persona (0.2 for "Technician", 0.8 for "Expressionist") thinking this created different personalities. Temperature controls the entropy of the output distribution — it makes output more or less random, not more or less "creative." The actual personality comes from the system prompt.
2. **Instruct vs. base model confusion.** The developer noted "there is an instruct version of lfm" — he did not understand that base models produce continuations while instruct models follow structured prompts.
3. **Model capacity mismatch.** A 350M parameter model (granite4) cannot meaningfully participate in a creative writing ensemble alongside a 4B model (gemma3). It's like having an expert panel where one member is a toddler.

### What to Study

**Core concepts:**
- Tokenization (BPE, SentencePiece) — how text becomes numbers
- Transformer attention mechanism — why context windows exist
- Sampling: temperature, top-k, top-p (nucleus), beam search
- KV cache and memory management during inference
- Instruct vs. base vs. chat models — when to use each

**Papers:**
- Vaswani et al., "Attention Is All You Need" (NeurIPS 2017) — the transformer paper
- Holtzman et al., "The Curious Case of Neural Text Degeneration" (ICLR 2020) — why nucleus sampling works
- Radford et al., "Language Models are Unsupervised Multitask Learners" (GPT-2, 2019) — instruct vs. base

**Exercise using Liminal:** Fix the SwarmOrchestrator. Replace temperature-based personality with system-prompt-based personality. Evaluate: do the 5 personas now produce genuinely different creative output?

---

## Module 2: Evaluation Fundamentals

**Why this second:** The Dogfood Gap — "system reports success" != "output actually works" — is the defining structural problem. 20% generation success rate. 22 landing page iterations. This module fixes the core quality problem.

### What Simon Already Built (Proof of Readiness)
- Three scoring systems (CreativeEvaluator, quickScore, HeuristicScorer)
- Four aesthetic critics (ColorHarmony, Layout, Typography, SoundHarmony)
- A "brutally honest" evaluation philosophy
- The Meta-Harness for self-improvement

### What Went Wrong (The Gap)
1. **Static analysis cannot evaluate dynamic behavior.** The CreativeEvaluator checks for regex patterns (`/setup|draw/`, `/fill|stroke|background/`) but never executes the code. A p5.js sketch producing a beautiful animation and one producing a blank white square both score 0.8.
2. **No automated metrics for creative quality exist.** This is an open research problem. CLIPScore measures image-text alignment. FID measures distributional distance. BLEU measures n-gram overlap. None capture "is this aesthetically pleasing?"
3. **The evaluation gap compounds.** Because RalphLoop uses the scorer as its stopping criterion, an inaccurate scorer means the loop stops too early (false success) or too late (wasted iterations).

### What to Study

**Core concepts:**
- Execution-based evaluation vs. static analysis
- Automated metrics: BLEU, ROUGE, FID, CLIPScore, BERTScore
- Human evaluation protocols: Likert scales, pairwise comparison, A/B testing
- The evaluation pyramid: unit tests → integration tests → execution tests → human judgment
- Reward model calibration (why "score >= 0.90" is meaningless without calibration)

**Papers:**
- Chen et al., "Evaluating Large Language Models Trained on Code" (2021) — HumanEval and `pass@k`
- Heusel et al., "GANs Trained by a Two Time-Scale Update Rule" (NeurIPS 2017) — FID
- Radford et al., "Learning Transferable Visual Models" (CLIP, ICML 2021) — CLIPScore
- Karpinska & Iyyer, "Large Language Models Effectively Leverage Document-Level Context" (2023) — human eval protocols

**Exercise using Liminal:** Build an execution-based quality gate for p5.js output using Puppeteer. Render generated code in a headless browser, capture a screenshot, use CLIP to score visual quality. Replace the regex scorer.

---

## Module 3: Embeddings and RAG (Retrieval-Augmented Generation)

**Why this third:** The Compost Mill is a RAG system built without retrieval. LIR is a representation system built without learning. This module would transform both from keyword matching to meaningful creative retrieval.

### What Simon Already Built (Proof of Readiness)
- LIR (Liminal Intermediate Representation) — structured tokens from AST parsing
- Compost Mill — 7-stage pipeline (heap → extract → shred → collide → score → promote → seed bank)
- SeedBank with domain tags and collision scores
- PromptEnhancer injecting compost seeds into generation prompts

### What Went Wrong (The Gap)
1. **Discrete tokens are not embeddings.** LIR produces structured symbolic representations from AST parsing. Real embeddings map inputs to continuous vector spaces where semantic similarity is preserved through distance metrics. LIR tokens can only match on structural patterns — they cannot measure "creative similarity."
2. **RAG without vector search.** Seeds are selected by domain tags and collision scores, not by embedding similarity to the current creative intent. A seed about particle systems injected into a GLSL shader prompt hurts rather than helps.
3. **Example ordering matters.** Research shows the ORDER of in-context examples significantly affects LLM output. The compost system has no principled ordering.

### What to Study

**Core concepts:**
- Word embeddings: Word2Vec, GloVe, FastText — how meaning becomes vectors
- Sentence/paragraph embeddings: Sentence-BERT, E5, Instructor
- Code embeddings: CodeBERT, GraphCodeBERT — learned representations of code
- Vector databases: FAISS, ChromaDB, pgvector — storing and searching embeddings
- RAG pipeline: query → embed → retrieve → inject → generate
- Contrastive learning: how encoders learn to map similar things nearby

**Papers:**
- Mikolov et al., "Efficient Estimation of Word Representations in Vector Space" (ICLR 2013)
- Feng et al., "CodeBERT: A Pre-Trained Model for Programming and Natural Languages" (EMNLP 2020)
- Lewis et al., "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks" (NeurIPS 2020)
- Liu et al., "What Makes Good In-Context Examples for GPT-3?" (arXiv 2022)
- Lu et al., "Fantastically Ordered Prompts and Where to Find Them" (ACL 2022)

**Exercise using Liminal:** Replace the Compost Mill's keyword-based seed retrieval with a ChromaDB vector store. Embed compost fragments using Sentence-BERT. Retrieve seeds by semantic similarity to the current creative prompt. Measure: does generation quality improve?

---

## Module 4: RLHF and Alignment

**Why this fourth:** The RalphLoop is a broken RLHF system. Understanding reward model design, human preference learning, and alignment would fix its fundamental flaw — the unreliable reward signal.

### What Simon Already Built (Proof of Readiness)
- RalphLoop — iterative refinement until quality threshold (RLHF-style)
- Quality gate with score-based stopping (reward model)
- Stagnation detection (exploration-exploitation signal)
- 26 enforcement hooks encoding "human preferences" as infrastructure

### What Went Wrong (The Gap)
1. **Reward hacking / specification gaming.** The regex-based scorer was gamed — code containing `setup()` and `draw()` scored 0.8 while producing blank white squares. The system optimized for the metric, not the outcome.
2. **No exploration mechanism.** The loop had no way to try fundamentally different approaches when stagnation occurred. It kept generating variations of the same template.
3. **Cache defeat = local optimum.** LLM response caching meant the same prompt produced identical output across iterations. The "self-improving loop" was not actually iterating.

### What to Study

**Core concepts:**
- Reward model design: what makes a good reward signal
- Reward hacking and specification gaming: when the metric becomes the target
- Human preference learning: collecting and aggregating human judgments
- Iterated refinement vs. rejection sampling (best-of-N) vs. guided generation
- Exploration vs. exploitation in creative search

**Papers:**
- Christiano et al., "Deep Reinforcement Learning from Human Preferences" (NeurIPS 2017)
- Stiennon et al., "Learning to Summarize with Human Feedback" (NeurIPS 2020)
- Bai et al., "Training a Helpful and Harmless Assistant with RLHF" (Anthropic 2022)
- Ouyang et al., "Training Language Models to Follow Instructions" (InstructGPT, NeurIPS 2022)

**Exercise using Liminal:** Redesign the RalphLoop's reward model. Replace the regex scorer with a two-level system: (1) execution-based structural check (does the code run?), (2) CLIPScore aesthetic check (is the output visually interesting?). Implement stagnation detection that switches to exploration mode (temperature increase, prompt mutation).

---

## Module 5: Quality-Diversity Optimization and Ensemble Methods

**Why this fifth:** The MapElites engine and SwarmOrchestrator are sophisticated systems built without understanding their failure modes. This module makes them actually work.

### What Simon Already Built (Proof of Readiness)
- MapElites (upgraded from 2D to N-dimensional) — quality-diversity grid
- NoveltyArchive (k=5, capacity 1000) — novelty search
- FitnessCombiner (novelty 40%, quality 30%, technical 20%, diversity 10%) — multi-objective
- SwarmOrchestrator with 7 personas and voting engine

### What Went Wrong (The Gap)
1. **MapElites requires accurate behavior descriptors.** The behavioral dimensions were regex feature vectors — noisy and meaningless for capturing creative behavior. The grid was populated randomly.
2. **Novelty is not quality.** A novel piece of broken code is still broken. The quality signal was the same flawed regex scorer.
3. **Ensemble without diversity.** Five small local models (350M-4B parameters) with low diversity and high individual error. The ensemble paradox: five mediocre opinions produce a mediocre consensus.

### What to Study

**Core concepts:**
- Quality-Diversity algorithms: MAP-Elites, CMA-MAP-Elites, QDHF
- Behavior descriptors: how to characterize solutions for grid placement
- Novelty search: when to explore vs. exploit
- Ensemble diversity: why diverse models beat individually better models
- Multi-objective optimization: Pareto fronts vs. scalarization

**Papers:**
- Mouret & Clune, "Illuminating Search Spaces by Mapping Elites" (arXiv 2015)
- Lehman & Stanley, "Abandoning Objectives: Evolution Through the Search for Novelty Alone" (2011)
- Fontaine et al., "Covariance Matrix Adaptation for the Rapid Illumination of Behavior Space" (GECCO 2020)
- Krogh & Vedelsby, "Neural Network Ensembles, Cross Validation, and Active Learning" (1995)
- Jiang et al., "LLM-Blender: Ensembling Large Language Models with Pairwise Ranking" (ACL 2023)

**Exercise using Liminal:** Fix the MapElites behavior descriptors. Replace regex feature vectors with embedding-based descriptors (using the embeddings from Module 3). Measure: does the quality-diversity grid now produce genuinely diverse, high-quality creative outputs?

---

## Module 6: Multi-Agent Systems and Coordination

**Why this sixth:** DeepCollaboration and the swarm are multi-agent systems without coordination theory. Understanding when to use sequential pipelines vs. parallel generation vs. debate would make these systems effective.

### What to Study

**Papers:**
- Du et al., "Improving Factuality and Reasoning in Language Models through Multiagent Debate" (ICML 2024)
- Park et al., "Generative Agents: Interactive Simulacra of Human Behavior" (UIST 2023)
- Liang et al., "Encouraging Divergent Thinking in Large Language Models through Multi-Agent Debate" (EMNLP 2023)
- Shazeer et al., "Outrageously Large Neural Networks: The Sparsely-Gated Mixture-of-Experts Layer" (ICLR 2017)

**Exercise:** Consolidate the three redundant multi-agent systems into one with configurable coordination modes (sequential pipeline, parallel generation with voting, debate).

---

## Module 7: Cross-Modal Learning

**Why this seventh:** The audio pipeline maps voice to visuals through heuristic rules. Real cross-modal learning uses trained encoders.

### What to Study

**Papers:**
- Radford et al., "Learning Transferable Visual Models From Natural Language Supervision" (CLIP, ICML 2021)
- Wu et al., "Large-Scale Contrastive Language-Audio Pretraining" (CLAP, ICASSP 2023)
- Dieleman, "Music Generating Neural Networks"

**Exercise:** Replace the heuristic pitch-to-color mapping with CLAP embeddings. Audio features go through a trained audio encoder, visual parameters come from a trained mapping layer. The system learns what sounds correspond to what visuals from data, not rules.

---

## Module 8: Prompt Engineering as Optimization

**Why this eighth:** 27 unaudited prompts, manual iteration, no A/B testing infrastructure. This module introduces systematic prompt optimization.

### What to Study

**Papers:**
- Khattab et al., "DSPy: Compiling Declarative Language Model Calls into Self-Improving Pipelines" (NeurIPS 2023)
- Zhou et al., "Large Language Models Are Human-Level Prompt Engineers" (APE, ICLR 2023)
- White et al., "A Prompt Pattern Catalog to Enhance Prompt Engineering with ChatGPT" (2023)

**Exercise:** Audit the 27 PromptLibrary templates using DSPy. Define metrics for each prompt (does the output run? is it visually interesting?). Optimize prompts programmatically rather than manually.

---

## Learning Path Summary

| Module | Duration | Prerequisite | Deliverable |
|--------|----------|-------------|-------------|
| 1. LLM Fundamentals | 1-2 weeks | None | Fixed swarm personas, working model discovery |
| 2. Evaluation | 1-2 weeks | Module 1 | Execution-based quality gate for p5.js |
| 3. Embeddings & RAG | 2 weeks | Module 1 | Vector-based compost seed retrieval |
| 4. RLHF & Alignment | 2 weeks | Module 2 | Redesigned RalphLoop reward model |
| 5. QD & Ensembles | 1-2 weeks | Module 3 | Fixed MapElites behavior descriptors |
| 6. Multi-Agent | 1 week | Module 5 | Consolidated agent architecture |
| 7. Cross-Modal | 1-2 weeks | Module 3 | Learned audio-to-visual mapping |
| 8. Prompt Optimization | 1 week | Module 2 | DSPy-optimized PromptLibrary |

**Format for each module:**
- Build something real in Liminal (not a tutorial exercise)
- Wire it end-to-end (verification through doing)
- Teach the agent via prompts and hooks (crystallize the learning)
- Domain-switch friendly (each module is 1-2 weeks, can be interleaved)
- Burst-compatible (deep sessions with cool-down periods)

---

## Context Management Skill Trajectory (from telemetry mining)

**Source:** `narrative/data/context-management-analysis.json`

Your context management evolved through three distinct phases during the 32-day build:

### Phase 1: Context Chaos (Eras 1-3) — 3.86 msg/commit
- 208 mentions of "context" — highest density in the project
- Hallucination frustration took **24 hours** to produce session-restore system
- Zero context management hooks existed before Era 3
- Context dumps contained raw task notifications (not curated context)
- **Skill level:** Beginner — "context is the AI's problem"

### Phase 2: Hypercorrection (Eras 4-5) — 9.90 msg/commit (PEAK)
- 80 micromanagement messages vs 21 trust-delegation (3.8:1 ratio)
- Built 5 hooks rapidly (wiring, review, bug-dismissal, overcomplication, context-dump)
- Session count spiked to 27 (fragmented, short sessions)
- 72 "compact" mentions — actively wrestling with context windows
- **Skill level:** Intermediate — "I'll give the AI SO MUCH context it can't fail"

### Phase 3: Delegation Mastery (Eras 7-9) — 0.85 msg/commit
- **11.6x reduction** from Era 4 peak
- Session bytes/session peaked at 24,735 — RICHER sessions with FEWER messages
- Only 2 context-loss events in the entire project, both in early eras
- Meta-cognition: 135 messages actively recognizing patterns
- Built self-improving Meta-Harness (Era 8)
- **Skill level:** Advanced — "5 words, 13 files, trust the agent"

### The Meta-Insight

You improved NOT by learning to manage context better, but by learning to NEED less of it. The trajectory from 9.90 → 0.85 messages/commit is a shift from "tell the AI everything" to "describe intent precisely and trust execution."

Evidence:
- Era 3: *"Anything that is not wired up needs to be wired up"* — vague, 11 words
- Era 5: *"ChatCLI with split-view terminal UI"* — specific, 7 words
- Era 7: *"Voice-to-visual parameter mapping"* — precise, 5 words → 13 files created
- Era 9: *"THE_BIBLE documentation"* — naming convention IS the instruction

### Implication for ML Learning

This pattern is exactly how prompt engineering matures. Module 8 (Prompt Optimization) is the natural extension of your context management trajectory. You've already discovered the key insight empirically — the DSPy framework will give you the formal framework to systematize it.

---

## Tool Bloat Analysis (which modules you actually use)

### Core (KEEP)
| Tool | Why |
|------|-----|
| Hooks system (26 hooks) | Primary meta-cognitive instrument |
| Plan files (249 plans) | Context before execution |
| Memory files (5 files) | Persistent cross-session state |
| Context dumps + session-restore | Session continuity |

### Likely Bloat (AUDIT before keeping)
| Redundant Set | Files | Recommendation |
|---------------|-------|----------------|
| collab + swarm + deep-collaboration | 18+ | Consolidate to harness pattern |
| CreativeEvaluator + ScoringEngine + AestheticCritic | ? | Keep active one, audit hot path |
| PromptStore + PromptLibrary + ContextBuilder | 19+ | Keep PromptLibrary + ContextBuilder |
| HarnessMemory + EpisodicMemory + SemanticArtMemory | ? | Keep HarnessMemory |
| TierBasedGenerator + BaseGenerator + Generator | 22 | Single interface + strategy |
| gui/ + gallery/ + ui/ | 7 | Keep TUI only |
| 13 tiny modules (≤3 files) | varies | Audit: some stubs (learning, improvement) |

**Rule of thumb from your data:** Before adding a new module, check if an existing one already solves the problem. Your #1 architectural pattern is "build 3 of everything" — this is efficient for exploration but costly for maintenance.

---

## Model Release Correlation (from cross-repo archaeology)

Your model adoption speed vs. release dates reveals an **early adopter pattern** that accelerated after the local-first shift (Nov 2025):

| Model/Tool | Release | First Use | Lag | Notes |
|-----------|---------|-----------|-----|-------|
| MiniMax-M2.7 | Mar 2026 | Mar 2026 | **0 months** | Same-month adoption |
| GLM-5 | Feb 2026 | Mar 2026 | **1 month** | Immediate integration into Liminal |
| Claude 3.5 Haiku | Oct 2024 | Dec 2024 | **2 months** | Fast adoption — became primary tool |
| Qwen 3 Coder | Jul 2025 | Nov 2025 | **4 months** | Adopted with local-first shift |
| Gemini 2.5 | Mar 2025 | Aug 2025 | **5 months** | |
| Cursor IDE | Mar 2023 | Apr 2025 | **25 months** | Late discovery — didn't research |
| Ollama | Jun 2023 | Nov 2025 | **29 months** | Late discovery — adopted with local shift |

**Average lag for actively-researched tools: ~2 months** (vs 6-12 months industry average).

**Key inflection point:** November 2025 — when you adopted Ollama + LM Studio + Qwen simultaneously, your repo count exploded from 2 to 25. Local model hosting removed the API cost barrier, enabling rapid experimentation. This is why Liminal ended up with a 6-provider routing architecture.

**Token efficiency plan:** See `narrative/data/token-efficiency-plan.md` for the full actionable plan (7 rules, context hygiene, budget targets).

---

*Sources: human-messages.json (1,148 messages), telemetry-sessions.json (frustration_analysis, emotional_arc), telemetry-git.json (commit patterns), telemetry-agents.json (agent profiles), context-management-analysis.json (context skill trajectory), github-commits.csv (7,059 commits across 50 repos), model-adoption-analysis.json, token-efficiency-plan.md. ML correlations derived from systematic analysis of how each Liminal subsystem maps to established ML techniques.*
