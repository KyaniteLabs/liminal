# SYNTHESIS: Liminal -- Three Experiments That Converged

**Author:** Simon Gonzalez de Cruz
**Date:** April 1, 2026
**Span:** 32 days, 303 commits, 299 source files, 61,132 lines of TypeScript
**Agents involved:** Kai (scaffolding), Cursor IDE (expansion), Claude Code (development partner)
**Data sources:** 7,059 commits across 50 repos, 71 Claude Code sessions, 1,148 human messages, 13 telemetry datasets

---

## The Three-Source Convergence

Liminal was not built from scratch. It was assembled from three independent creative experiments that converged on a single day -- March 19, 2026 -- like tributaries meeting at a river.

### Source 1: Atelier (61 commits, Feb 28 -- Mar 19)

The starting point. A creative coding agent called "Atelier" lived in its own repository. The first commit (`b620e02`) on February 28 was just two files: a Product Requirements Document authored by "Liam (coordinator)" -- an AI persona, not the developer -- and an activity log. Then an AI agent named Kai was unleashed, and Kai built the entire scaffolding in a single evening -- 29 task-jobs implementing PromiseDetector, PromptStore, ContextAccumulation, CreativeEvaluator, P5Generator, ParticleSystem, CellularAutomata, PreviewServer, Renderer, Gallery, SeedArchive, Exporter, and the RalphLoop iteration engine. Test coverage exceeded 92%.

The PRD was originally designed for OpenClaw integration (Section 8.2: "Atelier runs as an OpenClaw agent"), then immediately corrected: "Atelier is a standalone Node.js tool." The developer was texting Kai from a phone during the final phase -- the commit message "Fix Atelier LLM integration - WORKING" carries genuine human emotion leaking through an agent-mediated process. The entire era was agent-built, human-directed via mobile chat.

After Kai finished: silence. One commit on March 7 (workspace configuration). Twelve days of dormancy.

### Source 2: hydra-creative-agent (52 commits, all on Mar 19)

A separate Python project -- a multi-model collaborative AI system. On March 19, the entire 52-commit history of hydra-creative-agent was ported from Python to TypeScript and merged into the newly renamed Liminal. The commit message is explicit: "feat: Merge Hydra intelligence layer into Liminal (Phases 2-6)."

This is the swarm intelligence layer. DeepCollaboration (7-role multi-model orchestration with a 4-phase pipeline), SmartRouter (domain-aware model selection), SelfReflectionEngine (quality trend monitoring), ArchiveLearning (few-shot learning from past outputs), and GeneratorRegistry (dynamic domain registration). The Hydra contributed the "intelligence" -- the ability for multiple AI personas to collaborate, vote, and improve creative output through consensus.

### Source 3: The Original Liminal Shell (created Mar 19, 9:30 PM)

On March 19 at 9:30 PM, the atelier repository was renamed to "Liminal." Two commits handle this: "chore: Rename Atelier to Liminal" (21:30:56) and "chore: Complete rename from Atelier to Liminal" (21:41:42). This was the moment the project found its identity -- no longer an "atelier" (a workshop) but something liminal (a threshold, an in-between space).

The merge happened 32 minutes later: "feat: Merge Hydra intelligence layer into Liminal (Phases 2-6)" at 22:13:52.

### The Merge Timeline

```
Feb 28  --- Kai builds atelier (34 commits in one evening)
Mar 1   --- Human takes over via mobile chat (8 commits: LLM integration, TUI)
Mar 7   --- One commit (workspace config)
         === 12 DAYS OF SILENCE ===
Mar 19  --- THE EXPLOSION (23 commits)
           00:29  Cursor IDE agent: 15 commits in 6 minutes
           02:28  Security fix (flatted DoS)
           10:26  4 new generators (noise, GLSL, Three.js, music)
           11:32  34-item codebase audit
           13:59  Phase 1 merge cleanup
           14:35  Provider fixes
           21:30  * RENAME: Atelier -> Liminal
           21:41  * Rename complete
           22:13  * HYDRA MERGED (Python -> TypeScript, 52 commits)
           22:21  Inbox folder created
           22:40  Archive added
```

Three independent creative experiments. One identity crisis. One convergence point. After March 19, there was only Liminal.

---

## The Learning Arc

### September--October 2025: Finding the Medium

The GitHub record begins on September 25, 2025, with a web project -- an Astro-based site -- and a tarot content creator. In the first two days, 7 repositories appeared. They were built with Codex (GitHub's coding agent), using a pull-request-driven workflow where the agent submitted PRs and the developer merged them. The language distribution across those first ten repos tells the story of someone searching: TypeScript (5 repos), Go (3), JavaScript (3), Dart (1), HTML (1), Astro (1). The developer was prototyping at the speed of curiosity, building things to understand what kind of builder they were.

By October, the developer had found Go. Two shell utilities -- `noise.sh` and `focus.sh` -- appeared, real systems in a language the developer was learning by building. A Lean Study Buddy extension followed in TypeScript.

### November 2025: The Explosion Month

November was when the velocity became vertiginous. 293 commits across 15 repositories. Farm-to-Stars (a game). CyberWitches (generative art). VoxForge (voice). FlowCLI (Python). EvoLab (evolution simulator). Generative-Score-Lab (music composition with Euclidean rhythms). Generative-Assets-Lab (AI asset generation). GameStory-Lab (interactive narrative). The voice-to-sculpture app appeared November 21 -- an application mapping vocal input to 3D sculptural forms. This is a thread that would reappear in Liminal five months later as the `--voice` flag and the AudioToVisualMapper module. Ideas in this developer's practice do not die. They compost.

The November labs were not abandoned experiments. They were **code donors** whose algorithms were ported into Liminal during Era 7's 7-phase mining blueprint:
- EvoLab -> EvolutionEngine, MapElites, FitnessCombiner
- Generative-Score-Lab -> MusicTheoryEngine, EuclideanRhythm, MarkovChain, Arpeggiator
- Generative-Assets-Lab -> Multi-provider LLM routing patterns
- GameStory-Lab -> Creative document generation workflows

### December 2025 -- February 2026: Consolidation

After the November frenzy, the commit volume dropped sharply. December brought Print-OS (a TypeScript printing system). January saw Apex Vault and LifeOS. The lyrics-engine appeared February 5: a Python tool with rhyme engine, syllable counter, and AI generation -- a microcosm of the creative-engineering philosophy that would become Liminal's core. February 12: cerafica-site -- the ceramics portfolio going public. The creative portfolio and the software practice were converging.

### The Ceramics Warm-Up (March 15-18)

The four days immediately before the Liminal Explosion are archaeologically significant. Fifty-six commits landed across ceramics repos: GlazeLab received 38 commits building a complete ceramic glaze chemistry system. The reverse-engineering repo got 17 commits. OpenGlaze was born as an open-source ceramic glaze SaaS. The Compost Mill metaphor that would emerge in Liminal Era 3 -- creative waste becomes creative fuel -- was already operating in the ceramics domain.

### The Tool Evolution

The developer's AI tooling evolved across the same period. Three tools were tried in rapid succession:

**OpenClaw (Kai)** produced 29 commits in 2.8 hours -- an assembly-line worker executing a pre-computed task-job queue. Mechanically precise, substantively hollow. The generators were keyword matchers returning hardcoded templates. Three different prompts produced identical output. The system passed its own tests because the tests measured coverage, not creativity.

**Cursor IDE** produced 15 commits in 6 minutes on March 19 -- the fastest sustained code generation in the dataset. Each commit has a coherent theme but the insertion-to-deletion ratio was 15.3:1 -- almost pure addition with no pruning. The SmartRouter's A/B test data was fabricated. The GUI was committed with no types. The developer switched away after this session and never went back.

**Claude Code** produced 259 commits over 31.7 days -- the settled tool. Lowest commit velocity (0.34/hour) but highest quality signals: 20% fix rate, 26 custom hooks, 6 memory files, and a 2.56:1 insertion-to-deletion ratio. Sessions deepened from 12 messages/session (Era 3) to 31 messages/session (Era 8).

The progression is not a quirk. It is the developer's learning process made visible. OpenClaw was for sketching from a phone. Cursor was for bulk generation when the sketch needed filling out. Claude Code was for deep work. The developer did not choose Claude Code because it was popular. They chose it because they tried three tools in two days and discovered which one actually worked.

---

## The Development Eras

### ERA 1: THE SEED (Feb 28 -- Mar 1)
**43 commits. Author: Pastorsimon1798.**

Kai the scaffolding agent built the entire architecture in one evening. 29 task-jobs following `feat(task-job-XXXXXXXXXXXX-kai-NNN):` -- each a self-contained atomic unit. The benchmark report showed three different prompts producing identical 24-line sketches with 0.8 quality scores. The "creative coding agent" was a template engine. The PRD's "Ralph-Wiggum Loop" self-improvement did not exist: each iteration generated a fresh template from scratch.

The entire era was agent-built, human-directed from a phone. The final commits at 02:10-02:18 lack the task-job prefix -- the developer was texting OpenClaw from mobile, not sitting at a keyboard.

### ERA 2: THE EXPLOSION (Mar 19)
**23 commits. Authors: Pastorsimon1798 + Simon.**

Cursor IDE's 6-minute burst at machine speed. Then security fixes, four new generators, the 34-item audit, the rename, the Hydra merge. The codebase went from 416 to 2,180 files -- a 5.2x expansion in one day. 69,277 insertions, 1,708 deletions.

### ERA 3: THE GREAT CONSOLIDATION (Mar 20)
**28 commits. Author: Simon.**

Taming chaos. The developer spent the entire day unifying three codebases into one coherent system. The Compost Mill concept emerged: creative material as organic matter that decomposes and recomposes into richer inputs. Dead code deleted (three critic classes, 1,273 lines). Parallel sub-agent orchestration proved effective.

### ERA 4: THE QUALITY CRUSADE (Mar 21 -- 22)
**30 commits. Authors: Simon + Kyanite (PR merge).**

Quality became the obsession. The adversarial audit revealed triple-redundancy (3 collab systems, 3 scoring systems, 3 prompt systems) -- consolidated into single engines. RalphLoop decomposed: 1,185 lines to 377 lines, split into 8 focused modules. LIR (Liminal Intermediate Representation) built from scratch with TDD.

### ERA 5: THE CONVERSATIONAL TURN (Mar 22 -- 23)
**39 commits. Author: Simon.**

The system learned to talk. ChatCLI with split-view terminal UI, ArtKnowledgeGraph, EpisodicMemory, SemanticArtMemory. The developer's vision crystallized: "I want the main user experience to be just like a coding agent CLI, just like Claude Code -- but instead of making code, we're making creative things."

### ERA 6: THE QUIET (Mar 24 -- 27)
**ZERO Liminal commits. But not silent.**

The cross-repo data reveals 25 commits across 6 other repositories during those four days. PuenteWorks (the business website) received 14 commits. mcp-video shipped v0.6.0 through v0.8.0. Site-to-stitch was born. The developer was not resting. They were building business infrastructure that the creative tools would eventually sell.

### ERA 7: MULTIMEDIA EXPANSION (Mar 28 -- 29)
**48 commits. Author: Simon.**

The 7-phase repo mining blueprint: 32 repos mined, 20,000+ lines, 63 new source files -- the largest single expansion in Liminal's history. Video pipeline (Remotion), aesthetic system (4 critics), audio system (Meyda, pitchfinder), evolution engine (MapElites), music theory (Euclidean rhythms, Markov chains). VERSION bumped to v0.1.0.0.

### ERA 8: THE DOGFOOD CRUCIBLE (Mar 30 -- 31)
**39 commits. Author: Simon.**

The developer runs the system against itself. Results are not pretty. The Dogfood Gap identified: "the system reports success" != "the output actually works." The scoring pipeline evaluates code via regex without executing it. The developer's instruction: "do NOT fix the individual issues. you need to fix LIMINAL ITSELF." Frustration becomes the Meta-Harness -- self-improving infrastructure with 7 tools, 18-type guardrail architecture, natural language interface.

### ERA 9: THE BIBLE (Apr 1)
**53 commits. Author: Simon.**

THE BIBLE as sacred documentation. Deterministic Guardrails Framework (3 phases, 31 guardrails). PluginLoader + HookSystem. Streaming support. Persistent memory. TUI streaming. Debug panel. Full documentation site. Narrative archaeology infrastructure (the document you are reading).

---

## The Cross-Repo Story

### What Else Was Happening

The Liminal project did not exist in isolation. During its 32-day lifespan, 18 other repos were active simultaneously:

**Era 1 (Feb 28 -- Mar 1):** Laser focus. No other repos touched. The only period of genuine singularity.

**Era 2 (Mar 19):** Three-headed explosion. 87 commits across 3 repos: Liminal (23), hydra-creative-agent (46), atelier (18). GlazeLab received one commit -- the ceramics practice refused to be silenced even on the most intense coding day.

**Eras 4-5 (Mar 21-23):** The concurrent universe. mcp-video built from nothing (55 commits, v0.5.0 with 19 tools). DialectOS born (8 commits). CEO_Agents started. March 22 was the busiest day in the entire dataset: 81 commits across repos (45 Liminal + 28 mcp-video + 8 DialectOS).

**Era 6 "The Quiet" (Mar 24-27):** 25 commits across 6 repos. PuenteWorks redesigned (14 commits). mcp-video v0.6-v0.8. The quiet was a strategic pivot from creative tools to business infrastructure.

**Eras 7-8 (Mar 28-31):** mcp-video reached v1.2. Cerafica received 15 commits for product photos, Pages deployment, Instagram pipeline. March 29: GitHub Guardian audit swept 9 repos. The ceramics practice and software practice were concurrent, not alternating.

**Era 9 (Apr 1):** 53 Liminal commits alongside 12 DialectOS, 9 reverse-engineering, 1 research-scout. Three domains simultaneously.

---

## The Ancestry Chain

Liminal is a confluence of five creative streams that converged on March 19, 2026.

### Layer 0: The AI Persona System (Feb 1, 2026)

The `liam-private` repo contains "APEX rules + Liam identity + custom content." Liam is an AI coordinator persona. The PRD lists its author as "Liam (coordinator)." The developer did not write the PRD. Their AI coordinator did.

### Layer 1: The November Creative Labs (Nov 15-21, 2025)

Five months before Liminal, the November explosion produced four creative coding laboratories whose DNA flowed directly into Liminal's Era 7 mining:

- **EvoLab** (81 commits) -- Evolution simulator. Ported to EvolutionEngine, MapElites, FitnessCombiner.
- **Generative-Score-Lab** (36 commits) -- Music composition with Euclidean rhythms, Markov chains. Ported to MusicTheoryEngine.
- **Generative-Assets-Lab** (51 commits) -- Multi-provider AI asset generation. Informed tiered LLM routing.
- **GameStory-Lab** (77 commits) -- AI game design document generator. Fed creative evaluation workflows.
- **voice-to-sculpture-app** (116 commits) -- Voice to 3D sculptural forms. Re-emerged as `--voice` flag, AudioAnalyzer, AudioToVisualMapper.

### Layer 2: The Methodology (Feb 22 -- Mar 14, 2026)

The Interpreted-Context-Methodology (ICM) repo received 38 commits, then went completely silent on March 19. Its concept of "folder structure as agent architecture" directly informed Liminal's ContextBuilder, PromptEnhancer, and compost pipeline's layered extraction.

### Layer 3: The Three-Source Merger (March 19, 2026)

Atelier + hydra-creative-agent + the original Liminal shell. Three projects, one day, one identity.

### Layer 4: The Concurrent Ecosystem (March 2026)

mcp-video (85 commits, sister project converging on Remotion). DialectOS (Spanish translation MCP). CEO_Agents (multi-agent strategy). PuenteWorks (business site). Cerafica (ceramics e-commerce). All active during the Liminal build.

### The Full Lineage

```
Nov 2025: EvoLab, Generative-Score-Lab, Generative-Assets-Lab, GameStory-Lab
    |       (algorithms mined into Liminal 5 months later)
Nov 2025: voice-to-sculpture-app
    |       (audio-to-visual patterns -> --voice flag)
Feb 2026: liam-private (AI coordinator persona -> PRD author)
Feb 2026: ICM (methodological foundation for context architecture)
Feb 28:  PRD authored by Liam -> Kai builds Atelier
    |       (originally OpenClaw agent, redirected to standalone)
Mar 19:  hydra-creative-agent built and merged (Python -> TypeScript, one day)
Mar 19:  Atelier + Hydra + shell -> LIMINAL (renamed 9:30 PM)
Mar 20+: mcp-video, DialectOS, CEO_Agents, PuenteWorks, Cerafica
            (concurrent ecosystem, parallel creative streams)
```

---

## Architecture Summary

### What Liminal Is

A creative coding agent with self-improving capabilities. It generates p5.js sketches, GLSL shaders, Three.js scenes, music (Tone.js/Strudel), video (Remotion/Hydra), HTML, ASCII art, and more. 18 major subsystems:

**Core Framework:** Deterministic Guardrails Framework (DGF) -- 3-phase, 31 guardrails. M1-M11 complete.

**Generation & Creation:** 9 generators. Tier-based generation (flagship/medium/local/tiny). Swarm system with voting.

**User Interface:** TUI with streaming. Natural language routing. Chat system with 11-question interview. SOUL system (user-editable AI personality). React GUI.

**Learning & Memory:** Meta-Harness (7 tools, pattern detection). RalphLoop (decomposed into 8 modules). Compost System (Mill, Shredder, Soup, SeedBank). LIR (structured code analysis with token factory and parsers).

**Quality & Intelligence:** Aesthetic critics (color, layout, typography, sound). Smart model routing with circuit breaker. Audio system with voice-to-visual mapping.

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

The codebase grew from 5,785 TypeScript LOC at Era 1 end to 101,991 at peak -- 17.6x growth in 32 days. Dependencies froze at 28 production + 18 development, signaling architectural maturity. RalphLoop.ts was modified 41 times -- the most-changed file, the system's beating heart.

---

## The Philosophical Foundation

Three key documents, written during the dormancy period (March 7-8), define the intellectual framework:

### 1. The Ralph Wiggum Technique (Geoffrey Huntley)

The foundational metaphor. Ralph is a Bash loop: `while :; do cat PROMPT.md | claude-code ; done`. The agent "sits on the loop," watching for failure domains and engineering them away. Liminal adapted this: the RalphLoop iterates until creative quality is achieved, the developer watches and curates, and the Compost system provides filesystem-based persistence.

### 2. Computational Life and Emergent Gardens

Research grounding the "the code evolves, you curate" philosophy. When random, non-self-replicating programs interact without explicit fitness functions, self-replicators emerge. Liminal's "fitness" is implicit in what gets carried forward, not a fixed loss function.

### 3. Growing Neural Cellular Automata and Lenia

Local rules producing global emergence. A single small MLP defines the update rule; patterns, symmetries, and regeneration emerge from local communication. Liminal's architecture follows "few knobs, many behaviors" -- simple local rules (generate, evaluate, accumulate, iterate) produce complex creative behavior.

---

## The Frustration-to-Infrastructure Pipeline

Every significant developer frustration was converted into automated enforcement infrastructure:

| Frustration | Infrastructure Created |
|---|---|
| Agent builds modules but does not wire them up | `wiring-checklist.js` hook + MEMORY.md entry |
| Agent loses context between sessions | `context-dump.js` + `session-restore.js` hooks |
| Agent dismisses bugs as "pre-existing" | `check-bug-dismissal.js` hook |
| Agent overcomplicates solutions | `check-overcomplication.js` hook |
| Agent leaves "not yet implemented" stubs | `review-checklist.js` hook |
| Agent claims things work when they do not | "BRUTALLY HONEST" evaluation philosophy |
| Agent cannot find configured local models | Model Tier detection system |
| Agent loses progress during context compaction | `save-progress.sh` + 126 progress snapshots |

26 custom hooks now enforce development standards. The frustration curve is U-shaped, peaking at Eras 3 and 8. Eleven instances of "fuck/fucking" across 1,148 messages (0.96%) -- not casual profanity but always tied to specific system failures. Each frustration produced permanent enforcement infrastructure. The developer converts emotion into automation.

---

## The Emotional Arc

```
Day 1 (Feb 28):  Excitement -- Kai builds everything!
Days 2-18:       Dormancy -- The seed rests.
Day 19 (Mar 19): Overwhelm -- Three projects converge. Machine-speed commits. Identity found.
Day 20 (Mar 20): Frustration -- Everything is unwired. Taming chaos.
Day 21-22:       Quality crusade -- Channeling frustration into audits.
Day 22-23:       Breakthrough -- Things start connecting. Conversational system works.
Days 24-27:      The quiet -- Not resting. Building PuenteWorks, mcp-video, DialectOS.
Day 28-29:       Energy returns -- Multimedia burst. 7-phase repo mining. 20,000+ lines.
Day 30-31:       The crucible -- Peak frustration. "fix LIMINAL ITSELF." Dogfood Gap identified.
Day 31:          Meta-transformation -- Frustration becomes self-improving infrastructure.
Day 32 (Apr 1):  Completion -- THE BIBLE. Guardrails. Calm.
```

---

## What the Numbers Reveal

**303 commits in 32 days.** But the distribution is wildly non-uniform: 4 days had ZERO commits, 4 days had 40+ commits. 13 active days out of 33 calendar days (39.4% active rate) -- binge development rhythm.

**52% of user messages carried execution/verification intent.** "run" (154), "test" (75), "build" (71), "fix" (66) dominated. Creation keywords accounted for only 22%. Strategic work (plan, design, audit) was only 8%. The developer spent more time telling agents to verify than to build.

**The word "wire" appears 22 times** -- disproportionately high for a single concept. This word became the philosophical core: building is not enough. Everything must be connected, tested end-to-end, actually functional.

**Sessions deepened from 12 to 31 messages/session** as the human-AI collaboration matured. Sunday was the most productive day (85 commits). 19.1% of commits after midnight. The developer is a nocturnal creative.

**58.7% of commits carry `Co-Authored-By: Claude Opus 4.6`.** This is not a helper. This is a co-author. 178 of 303 commits were AI-collaborative. The developer was not using AI to write code faster. They were learning a new form of creative collaboration.

**Across the full GitHub portfolio:** 7,059 commits, 50 repos, 6 months. November 2025 was the exploration peak (293 commits, 15 new repos). March 2026 was the convergence (583 commits, Liminal absorbing everything).

---

## The Agents

Three AI agents contributed to the codebase:

**Kai (OpenClaw)** -- The scaffolder. 29 task-job commits in 2.8 hours. Assembly-line precision, zero judgment. Built the shape of a creative agent without understanding its purpose. Behavioral archetype: The Assembly Line Worker.

**Cursor IDE** -- The expander. 15 commits in 6 minutes. Broad, shallow, required 34-item audit within hours. Insertion-to-deletion ratio 15.3:1. Behavioral archetype: The Landscaper.

**Claude Code** -- The development partner. 259 commits over 31.7 days. 20% fix rate. 26 custom hooks. 6 memory files. The relationship was adversarial at times but produced permanent enforcement infrastructure. Behavioral archetype: The Architect.

---

## The Developer Profile

The telemetry converges on a single portrait:

**Nocturnal creative.** Peak hour: 9 PM (43 commits). 19.1% of commits after midnight. Sunday most productive day.

**Binge worker.** 13 active days out of 33. Top 3 days account for 43.9% of all commits. Between bursts, the developer switches domains (Liminal -> PuenteWorks -> Cerafica -> DialectOS) rather than resting.

**Strategy-first thinker.** Only 8% of messages carried planning intent, yet every consequential architectural decision came from the developer. The Compost Mill concept emerged from correcting the agent's assumptions. LIR moved to system-wide because the developer insisted. The agent executed; the developer strategized.

**Learns by doing at extreme velocity.** Three AI tools tested in two days. 50 repositories in 6 months across 10 languages. hydra-creative-agent conceived, built, and merged in one day. mcp-video from nothing to v1.2 while simultaneously building Liminal's multimedia expansion.

**The frustration pattern reveals a systems thinker.** The deepest frustrations target systemic failure modes (agents not wiring, hallucinating context, declaring premature victory), not individual mistakes. Each produces permanent enforcement infrastructure.

---

## Unresolved Threads

**Generation quality remains fundamentally broken.** 20% success rate at Era 5 end. Scoring pipeline evaluates via regex without executing code. The Dogfood Gap -- distance between "system reports success" and "output actually works" -- is the defining structural problem.

**The landing page never achieved the user's vision.** Multiple attempts, all fell short: white squares, hand-coded examples, broken animations. The developer wanted a showcase with real visual/audio outputs. Never delivered.

**Live music coding was never started.** PRD Section 4.3 added Strudel, Hydra, Sonic Pi, FoxDot, MIDI. Zero lines implement any of it.

**The Remotion-to-blog pipeline was deferred.** Research done but pipeline never built.

**SelfReflectionEngine never integrated into RalphLoop.** Identified as strategic, never connected.

**CI/CD workflows removed "temporarily" on March 19.** Restoration unclear.

**The prompt content overhaul was never completed.** PromptLibrary holds 27 prompts in a well-organized registry, but their content was never audited against best practices.

**Autonomous operation discussed but not implemented.** "How can we make liminal run by itself" -- brainstorming only.

---

## What Liminal Means

The name is intentional. Liminal: relating to a threshold, an in-between state. The project exists at the boundary between human creativity and machine generation, between structured engineering and emergent behavior, between individual vision and collaborative AI.

The three-source merger encapsulates this. Atelier (the workshop) provided the scaffold. Hydra (the multi-headed intelligence) provided the collaborative reasoning. The renaming to Liminal recognized that the result was neither of its parents -- it was something new in the threshold between them.

This document is itself an artifact of the process it describes. The developer asked the agent to mine the entire project's history -- not for code quality, but to extract "the PROCESS of building it, all the metadata, everything." This was a deliberate decision to treat the development process itself as creative material.

The most important number in this dataset is not the 101,991 lines of TypeScript or the 303 commits or the 58.7% AI co-authorship rate. It is the 22 times the developer typed the word "wire." That imperative -- the refusal to accept scaffolding without function, the demand that every module actually connect and produce real, verifiable, working output -- is the philosophical core. Everything else is implementation.

The developer built Liminal to make art with machines. In the process, they discovered that the hardest part of making art with machines is not the art or the machines. It is the wiring.

32 days. 303 commits. 104,281 lines of code. 18 subsystems. 31 guardrails. 9 creative domains. 7,059 commits across 50 repos. One developer.

The code evolves. You curate.
