# SYNTHESIS: Liminal -- Three Experiments That Converged

**Author:** Simon Gonzalez de Cruz
**Date:** April 1, 2026
**Span:** 32 days, 303 commits, 299 source files, 61,132 lines of TypeScript
**Agents involved:** Kai (scaffolding), Cursor IDE (expansion), Claude Code (development partner)

---

## The Three-Source Convergence

Liminal was not built from scratch. It was assembled from three independent creative experiments that converged on a single day -- March 19, 2026 -- like tributaries meeting at a river.

### Source 1: Atelier (61 commits, Feb 28 -- Mar 19)

The starting point. A creative coding agent called "Atelier" lived in its own repository. The first commit (`b620e02`) on February 28 was just two files: a Product Requirements Document and an activity log. Then an AI agent named Kai was unleashed, and Kai built the entire scaffolding in a single evening -- 29 task-jobs implementing PromiseDetector, PromptStore, ContextAccumulation, CreativeEvaluator, P5Generator, ParticleSystem, CellularAutomata, PreviewServer, Renderer, Gallery, SeedArchive, Exporter, and the RalphLoop iteration engine. Test coverage exceeded 92%.

After Kai finished, the human developer took over. The first human-authored commits added real LLM integration: "Fix Atelier LLM integration - WORKING" (March 1), and an ink/React TUI. Then: silence. One commit on March 7. Twelve days of dormancy.

The atelier repo accumulated 61 commits total: 42 in the initial Kai burst on Feb 28, 8 more on Mar 1, 1 on Mar 7, and 18 more on March 19 -- the day everything changed.

### Source 2: hydra-creative-agent (52 commits, all on Mar 19)

A separate Python project -- a multi-model collaborative AI system. On March 19, the entire 52-commit history of hydra-creative-agent was ported from Python to TypeScript and merged into the newly renamed Liminal. The commit message is explicit: "feat: Merge Hydra intelligence layer into Liminal (Phases 2-6)."

This is the swarm intelligence layer. The multi-agent voting system. The persona-based generation. The entire Python codebase was transpiled, rewritten, adapted, and integrated in a single day. Hydra contributed the "intelligence" -- the ability for multiple AI personas to collaborate, vote, and improve creative output through consensus.

### Source 3: The Original Liminal Shell (created Mar 19, 9:30 PM)

On March 19 at 9:30 PM, the atelier repository was renamed to "Liminal." Two commits handle this: "chore: Rename Atelier to Liminal" (21:30:56) and "chore: Complete rename from Atelier to Liminal" (21:41:42). This was the moment the project found its identity -- no longer an "atelier" (a workshop) but something liminal (a threshold, an in-between space).

The merge happened 32 minutes later: "feat: Merge Hydra intelligence layer into Liminal (Phases 2-6)" at 22:13:52.

### The Merge Timeline

```
Feb 28  ──── Kai builds atelier (34 commits in one evening)
Mar 1   ──── Human takes over (8 commits: LLM integration, TUI)
Mar 7   ──── One commit (workspace config)
         ═══ 12 DAYS OF SILENCE ═══
Mar 19  ──── THE EXPLOSION (23 commits)
           00:29  Cursor IDE agent: 15 commits in 6 minutes
           02:28  Security fix (flatted DoS)
           10:26  4 new generators (noise, GLSL, Three.js, music)
           11:32  34-item codebase audit
           13:59  Phase 1 merge cleanup
           14:35  Provider fixes
           21:30  ★ RENAME: Atelier → Liminal
           21:41  ★ Rename complete
           22:13  ★ HYDRA MERGED (Python → TypeScript, 52 commits)
           22:21  Inbox folder created
           22:40  Archive added
```

Three independent creative experiments. One identity crisis. One convergence point. After March 19, there was only Liminal.

---

## The Development Eras

After the three-source merger, the project's history unfolds in distinct eras, each with its own character and tempo.

### ERA 1: THE SEED (Feb 28 -- Mar 1)

**43 commits. Author: Pastorsimon1798 (earlier git identity).**

Kai the scaffolding agent built the entire architecture in one evening. The work pattern is extraordinary: 29 commits following `feat(task-job-XXXXXXXXXXXX-kai-NNN):` -- each a self-contained atomic unit implementing one component. The naming convention reveals a task queue system: each job ID (`1772343681762`) maps to a batch, each Kai number (`kai-001` through `kai-027`) maps to a subtask.

What Kai built:
- PromiseDetector with exact string matching (the completion signal)
- PromptStore with context injection
- ContextAccumulation state management
- CreativeEvaluator quality gates
- P5Generator, ParticleSystem, CellularAutomata generators
- PreviewServer (Express-based live preview)
- Renderer with screenshot capture
- Gallery save/load
- SeedArchive
- Exporter (ZIP output)
- RalphLoop iteration engine (the heart of the system)
- Full test coverage >92%

The first human commits added what Kai could not: real LLM integration. "Fix Atelier LLM integration - WORKING" is the first sign that the scaffold was becoming a living system.

**Then: silence.** 12 days. One commit on March 7.

### ERA 2: THE EXPLOSION (Mar 19)

**23 commits. Author: Pastorsimon1798 + Simon.**

The day begins at midnight with 15 `[A]`-tagged commits from Cursor IDE arriving in a 6-minute window (00:29 -- 00:35). These commits add self-improvement loops, new feature modules, enhanced TUI, additional generators, comprehensive test suites, documentation updates, utility scripts, generated gallery outputs, Cursor IDE configuration, a standalone GUI web application, and temporary workflow removal.

The pace is machine speed. The timestamps tell the story:

```
00:29:09  [A] Enhance core system with self-improvement loops
00:29:49  [A] Add new feature modules
00:30:21  [A] Enhance TUI with timeline and utilities
00:30:25  [A] Enhance generators, gallery, and preview server
00:31:03  [A] Add comprehensive test suite
00:31:23  [A] Update documentation and architecture
00:31:52  [A] Update configuration and tooling
00:32:29  [A] Add utility scripts
00:32:58  [A] Add generated gallery and output files
00:33:33  [A] Add Cursor IDE configuration
00:34:35  [A] Add standalone GUI web application
00:35:16  [A] Temporarily remove GitHub workflows
```

Then the human returns: security fixes, four new creative coding generators (noise/flow fields, GLSL shaders, Three.js scenes, LLM music), a 34-item codebase audit. Then the rename. Then the Hydra merge.

This single day transforms everything. The project finds its name, absorbs an entire intelligence layer from a different codebase, and emerges as something new.

### ERA 3: THE GREAT CONSOLIDATION (Mar 20)

**28 commits. Author: Simon.**

The day after the merger was about taming chaos. The developer spent the entire day unifying the three codebases into one coherent system.

Key events:
- Removed inception/anthropic providers, migrated to `LIMINAL_*` environment variables
- Swarm personas redesigned from 7 to 5 with hybrid heuristic voting
- Prompt system overhauled to 27 registered prompts (v2.0.0)
- EvaluationFramework wired into RalphLoop, dead code deleted
- TokenMill renamed to Swarm
- Compost Mill design document written
- Compost Mill implemented
- Compost CLI, LLM integration, and seed injection wired end-to-end

The Compost Mill is the key metaphor to emerge from this era. The developer treats code and creative material as organic matter: add to the heap, digest (extract key features), shred (break into components), collide (combine fragments), score (evaluate quality), promote (save the best as seeds). Seeds inject into future generation prompts as "DNA." The metaphor is not superficial -- it defines the architecture.

28 commits in one day. Every single one is about making the merged system cohere.

### ERA 4: THE QUALITY CRUSADE (Mar 21 -- 22)

**30 commits. Authors: Simon + Kyanite (PR merge).**

Quality became the obsession. This era produced two major audits and a new structured analysis system.

Key events:
- Deep audit unification -- wire all feedback loops, persist state, unify GUI
- Red team audit -- migrate to Vitest, fix 47+ code defects
- PR #2 merged: forensic audit (6 critical bugs, eliminate all `any` types, structured logging)
- RalphLoop decomposed: 1,185 lines to 377 lines, split into 8 focused modules
- LIR (Liminal Intermediate Representation) system built from scratch with TDD
  - Error classes, core types, JSON schema
  - Token factory, TextParser, DocParser, CodeParser (TypeScript Compiler API)
  - ParsingCache (file-hash-keyed)
  - CompostParser dispatcher with file-type routing
- GLM-powered PR review CI workflow added
- Dual-model architecture with cascade/specialized routing

The RalphLoop decomposition is emblematic: the core loop was too large to reason about, so it was split into 8 focused modules. The LIR system was built entirely test-first, with each parser type implemented in isolation before being composed.

### ERA 5: THE CONVERSATIONAL TURN (Mar 22 -- 23)

**39 commits. Author: Simon.**

The system learned to talk.

Key events:
- Chat types, CreativeBrief builder, InterviewPhase with question definitions
- ConversationManager with session state
- ChatCLI with split-view terminal UI
- ArtKnowledgeGraph for concept storage
- EpisodicMemory for session storage
- SemanticArtMemory combining knowledge graph and episodic memory
- Phase 3 Guidance & Proactive Help
- Phase 4 Comprehensive Creative Capabilities
- Documentation blitz (README, landing page)
- IP liability fix (removed real artist names from prompts)

The conversation system implements an 11-question creative interview that discovers user preferences, building a creative brief that guides generation. This was the moment Liminal stopped being a tool and became a creative partner.

Then the landing page work begins -- real examples, honest evaluation, and a telling moment: the developer removes real artist names from prompts to avoid IP liability. The system is being prepared for public visibility.

### ERA 6: THE QUIET (Mar 24 -- 27)

**ZERO commits.**

Four days of absolute silence. No code. No commits. No session logs.

The project had just reached 2,878 files. The conversational system was complete. The quality crusade had stabilized the codebase. And then: nothing.

Interpretation: the seed was germinating in darkness. The developer was processing the rapid accumulation of 240+ commits over five days. The next burst would be the largest yet.

### ERA 7: MULTIMEDIA EXPANSION (Mar 28 -- 29)

**48 commits. Author: Simon.**

The quiet broke with a torrent of new capabilities.

Key events:
- **Video pipeline:** Remotion types, templates, generator, renderer, VideoExporter (FFmpeg), Compositor, CanvasRecorder
- **Aesthetic system:** Color harmony, layout, typography, sound harmony critics -- each with static analysis
- **Audio system:** Meyda feature extractor, pitchfinder integration, timbre extractor, pitch utility functions
- **Voice-to-visual parameter mapping:** Audio features drive visual generation parameters
- **CLI flags:** `--voice`, `--voice-file`, `--aesthetic`, `--aesthetic-config`
- **Evolution engine:** FitnessCombiner, N-dim MapElites, PerlinNoise exploration
- **Music theory engine:** Euclidean rhythms, Markov chains, scale detection
- **Multi-agent creative critique board**
- **Phase 6+7:** Smart routing, circuit breaker, color theory, glitch effects
- **VERSION bumped to v0.1.0.0** (Mar 29, 11:59 AM)

This is the era where the system explodes into full multimedia. Video, audio, aesthetic criticism, music theory, evolutionary computation -- all appear simultaneously over two days. The codebase grows from 2,878 to 3,103 files.

The aesthetic critics are notable: each one performs static analysis on generated code (not on rendered output) -- parsing color values from p5.js code, measuring layout balance, checking typography choices, analyzing sound harmony from Tone.js code. This means the system can evaluate quality without executing the code.

### ERA 8: THE DOGFOOD CRUCIBLE (Mar 30 -- 31)

**39 commits. Author: Simon.**

The developer runs the system against itself, and the results are not pretty.

Key events:
- CodeValidator pipeline prevents broken code from being saved as success
- REAL CreativeEvaluator scores for all dogfood examples
- BRUTALLY HONEST dogfood page showing only working examples
- Honest landing page audit -- replacing pre-baked screenshots with real outputs
- HTML/ASCII generators added
- Comprehensive security hardening -- red team audit remediation
- Model-agnostic architecture + comprehensive test coverage
- HydraGenerator and expansion to 8 creative domains

The frustration analysis from session logs reveals the emotional arc of this era. The developer discovers the system is not working as intended. The Ralph Loop -- the core mechanism that should iterate until quality is achieved -- is stopping prematurely. Generated code is broken. The landing page shows fake examples.

The response is characteristically honest: "BRUTALLY HONEST dogfood page showing only working examples." The developer refuses to pretend things work when they do not. This honesty principle becomes the Meta-Harness:

- HarnessMemory for persistent meta-harness state
- Model Tier detection and tier-based prompt building
- Meta-Harness self-improving infrastructure with 7 tools
- Harness TUI following "Claw Code pattern" (Claw = Claude)
- 18-type guardrail architecture (M1-M18)
- Full LLM Mode implementation
- Natural language interface -- "Claude Code style"

The Meta-Harness implements the Ralph Wiggum Principle: the harness "sits on the loop" and learns from failures, while generators run "in the loop" creating code. The core idea: never fix broken output programmatically -- update the harness so the next output is not broken.

### ERA 9: THE BIBLE (Apr 1)

**53 commits. Author: Simon.**

The final day. 53 commits. The project reaches its current form.

Key events:
- PROJECT_RULES.md -- "Documentation is the Bible"
- NO DUPLICATION rule -- prevent wheel reinvention
- DOCUMENTATION_WARNING.txt -- prevent duplicate creation
- HarnessMemory for persistent meta-harness state
- Model Tier detection (flagship/medium/local/tiny) and tier-based prompt building
- M9-M11 Guardrails implementation
- TierBasedGenerator base class migration (all generators)
- PluginLoader + HookSystem for pre/post generation customization
- ContextCompactor for auto-summarizing conversation history
- Streaming support in LLMClient
- Meta-Harness Self-Evaluation and Self-Correction (arXiv:2603.28052)
- TUI streaming with elegant think tag handling
- Rich activity monitoring with phase indicators
- Debug panel with Ctrl+D toggle
- Deterministic Guardrails Framework (DGF) -- 3 phases:
  - Phase 1: Foundation (4 catastrophic guardrails)
  - Phase 2: Validation, Remediation, Correctness, Hygiene
  - Phase 3: Self-Healing & Evolution (Constitution)
- Full documentation site with cross-linked pages
- Public repo cleanup for professional release
- Narrative archaeology infrastructure (the document you are reading)

The Deterministic Guardrails Framework is the final architectural statement. Three phases of protection, four tiers of enforcement (SHADOW, ADVISORY, ENFORCING, AUTONOMOUS), a Constitution that learns from failures, and a Self-Healing guardrail that pattern-matches against known failure modes.

The last substantive commit on this day is `feat(narrative): deep session mining with chunked parallel agents` -- the infrastructure that produced this synthesis.

---

## Architecture Summary

### What Liminal Is

A creative coding agent with self-improving capabilities. It generates p5.js sketches, GLSL shaders, Three.js scenes, music (Tone.js/Strudel), video (Remotion/Hydra), HTML, ASCII art, and more. The system features 18 major subsystems:

**Core Framework:**
- Deterministic Guardrails Framework (DGF) -- 3-phase multi-layer protection, 31 total guardrails
- M1-M11 Complete -- Traditional guardrails + DGF

**Generation & Creation:**
- 9 Generators -- p5.js, GLSL, Three.js, Hydra, Strudel, Tone, Remotion, HTML, ASCII
- Tier-Based Generation -- Model-aware prompts (flagship/medium/local/tiny)
- Swarm System -- Multi-agent generation with voting

**User Interface:**
- TUI (Terminal UI) -- Hybrid terminal + browser interface with streaming
- Natural Interface -- Natural language command routing
- Chat System -- Conversational creative collaboration with 11-question interview
- SOUL System -- User-editable AI personality
- GUI -- React-based web dashboard with compost visualization, activity monitoring, guardrail dashboard

**Learning & Memory:**
- Meta-Harness -- Self-improvement system (7 tools, pattern detection, harness updates)
- Ralph Loop -- Iterative refinement engine (decomposed into 8 focused modules)
- Compost System -- Living digestion pipeline (Mill, Shredder, Soup, SeedBank)
- Memory Systems -- HarnessMemory, EpisodicMemory, ArtKnowledgeGraph, SemanticArtMemory, 5+ archives
- LIR (Liminal Intermediate Representation) -- Structured code analysis with token factory and parsers

**Quality & Intelligence:**
- Aesthetic System -- Multi-dimension quality evaluation (color, layout, typography, sound)
- Routing System -- Smart model and task routing with circuit breaker
- Scavenger System -- DNA extraction from code
- Audio System -- Voice-to-visual parameter mapping, pitch detection, timbre analysis

### Codebase Stats

```
Source files:     299 TypeScript files (src/)
Test files:       228 test files (test/)
Source lines:     61,132 lines of TypeScript
Test lines:       43,149 lines of tests
Total:            104,281 lines of code
Commits:          303
Contributors:     292 of 303 commits by one developer (Simon/Pastorsimon1798)
Peak hours:       9 PM -- 1 AM (nocturnal creative push)
```

---

## The Philosophical Foundation

Liminal is grounded in research that predates the code. Three key documents, all written on March 7-8 (during the dormancy period), define the intellectual framework:

### 1. The Ralph Wiggum Technique (Geoffrey Huntley)

The foundational metaphor. Ralph is a Bash loop: `while :; do cat PROMPT.md | claude-code ; done`. The agent "sits on the loop," watching for failure domains and engineering them away. Memory persists only through the filesystem. The primary context window operates as a scheduler, spawning subagents for actual work.

Liminal adapted this: the RalphLoop iterates until creative quality is achieved, the developer watches and curates, and the Compost system provides filesystem-based persistence.

### 2. Computational Life and Emergent Gardens

Research grounding the "the code evolves, you curate" philosophy in computational life science. The key finding: when random, non-self-replicating programs interact without explicit fitness functions, self-replicators emerge. Liminal's "fitness" is implicit in what gets carried forward and improved, not a fixed loss function.

### 3. Growing Neural Cellular Automata and Lenia

Research on local rules producing global emergence. A single small MLP defines the update rule; patterns, symmetries, and regeneration emerge from local communication. The design principle: "few knobs, many behaviors." Liminal's architecture follows this -- simple local rules (generate, evaluate, accumulate, iterate) produce complex creative behavior.

---

## The Frustration-to-Infrastructure Pipeline

A defining pattern of the project: every significant developer frustration was converted into automated enforcement infrastructure. The session logs reveal this clearly.

| Frustration | Infrastructure Created |
|---|---|
| Agent builds modules but does not wire them up | `wiring-checklist.js` hook + MEMORY.md entry |
| Agent loses context between sessions | `context-dump.js` + `session-restore.js` hooks |
| Agent dismisses bugs as "pre-existing" or "out of scope" | `check-bug-dismissal.js` hook |
| Agent overcomplicates solutions | `check-overcomplication.js` hook |
| Agent leaves "not yet implemented" stubs | `review-checklist.js` hook |
| Agent claims things work when they do not | "BRUTALLY HONEST" evaluation philosophy |
| Agent cannot find configured local models | Model Tier detection system |
| Agent loses progress during context compaction | `save-progress.sh` + 126 progress snapshots |

26 custom hooks now enforce development standards. 50 context dumps preserve session state. 58 JSONL session files capture the complete human-agent dialogue.

The core instruction in MEMORY.md reads: "Always wire everything up end-to-end. When building features, the job is not done until every component is connected, every CLI command works, every config is read, every LLM call goes through."

---

## The Emotional Arc

```
Day 1 (Feb 28):  Excitement -- Kai builds everything!
Days 2-18:       Dormancy -- The seed rests.
Day 19 (Mar 19): Overwhelm -- Three projects converge. Machine-speed commits. Identity found.
Day 20 (Mar 20): Frustration -- Everything is unwired. Taming chaos.
Day 21-22:       Quality crusade -- Channeling frustration into audits.
Day 22-23:       Breakthrough -- Things start connecting. Conversational system works.
Days 24-27:      The quiet -- Processing. The seed germinates in darkness.
Day 28-29:       Energy returns -- Multimedia burst. Video, audio, aesthetics, music.
Day 30-31:       The crucible -- Peak frustration. System does not work. Brutal honesty.
Day 31:          Meta-transformation -- Frustration becomes self-improving infrastructure.
Day 32 (Apr 1):  Completion -- THE BIBLE. Documentation. Deterministic guardrails. Calm.
```

The pattern: frustration spikes on Day 20 and Day 30. Each spike produces permanent infrastructure. The developer converts emotion into automation. By Day 32, every frustration has a corresponding enforcement mechanism.

---

## What the Numbers Reveal

**303 commits in 32 days.** But the distribution is wildly non-uniform:

- 4 days had ZERO commits (Mar 24-27)
- 4 days had 40+ commits (Mar 22: 45, Apr 1: 53, Feb 28: 34, Mar 29: 32)
- Peak working hours: 9 PM -- 1 AM
- Secondary session: 8 AM -- 12 PM
- Evening sessions build features; mornings fix, test, and document

**292 of 303 commits by one developer.** The git identities `Simon` and `Pastorsimon1798` are the same person (the rename happened mid-project). Kai (1 commit) is a GitHub Guardian audit bot. Kyanite (1 commit) is a PR merge. This is a solo project amplified by AI agents.

**61,132 lines of source code.** 43,149 lines of tests. A 1:0.7 source-to-test ratio. The quality crusade era produced this -- the forensic audit eliminated all `any` types and mandated structured logging.

**37 top-level source directories.** The architecture is broad, not deep: `aesthetic/`, `audio/`, `brain/`, `chat/`, `collab/`, `composite/`, `compost/`, `config/`, `core/`, `evolution/`, `export/`, `gallery/`, `generators/`, `guardrails/`, `gui/`, `harness/`, `improvement/`, `learning/`, `llm/`, `music/`, `musicToVisual/`, `narrative/`, `plugins/`, `prompts/`, `render/`, `routing/`, `sandbox/`, `scavenger/`, `security/`, `swarm/`, `tui/`, `ui/`, `utils/`. Each directory represents a distinct subsystem.

---

## The Agents

Three AI agents contributed to the codebase, each with a distinct character:

**Kai** -- The scaffolder. 29 task-job commits in one evening. Built the entire architecture from a PRD. Atomic, methodical, comprehensive. Left behind a working system with >92% test coverage. Never returned.

**Cursor IDE** -- The expander. 15 commits in 6 minutes on March 19. Tagged with `[A]` prefix. Added self-improvement loops, new modules, enhanced TUI, generators, tests, documentation, utility scripts, gallery outputs, IDE configuration, GUI. Speed without judgment.

**Claude Code** -- The development partner. 58 JSONL session files. 249 plan documents. 26 custom hooks. 5 memory files. Present throughout eras 3-9. The relationship was adversarial at times (the frustration analysis documents this), but the enforcement infrastructure that emerged from the conflict produced a better system.

---

## What Liminal Means

The name is intentional. Liminal: relating to a threshold, an in-between state. The project exists at the boundary between human creativity and machine generation, between structured engineering and emergent behavior, between individual vision and collaborative AI.

The three-source merger encapsulates this. Atelier (the workshop) provided the scaffold. Hydra (the multi-headed intelligence) provided the collaborative reasoning. The renaming to Liminal recognized that the result was neither of its parents -- it was something new in the threshold between them.

32 days. 303 commits. 104,281 lines of code. 18 major subsystems. 31 guardrails. 9 creative domains. One developer.

The code evolves. You curate.
