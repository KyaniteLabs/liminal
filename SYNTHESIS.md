# SYNTHESIS: Liminal -- Three Experiments That Converged

**Author:** Simon Gonzalez de Cruz
**Date:** April 1, 2026
**Span:** 32 days, 303 commits, 299 source files, 61,132 lines of TypeScript
**AI collaboration:** 100% of commits were AI-aided. If it wasn't Claude, it was Cursor. If it wasn't Cursor, it was Kimi Code. The 58.7% "Co-Authored-By: Claude Opus 4.6" figure only captures commits where Claude auto-appended its signature.
**Agents involved:** Liam (OpenClaw planner), Kai (OpenClaw builder), Teo (OpenClaw researcher), Cursor IDE (expansion), Claude Code (development partner)
**Original conception:** A playground where AI agents could exercise creativity in their spare time, with spare tokens. Evolved into human-AI creative collaboration.
**Data sources:** 7,059 commits across 50 repos, 71 Claude Code sessions, 1,148 human messages, 13 telemetry datasets

---

## The Three-Source Convergence

Liminal was not built from scratch. It was assembled from three independent creative experiments that converged on a single day -- March 19, 2026 -- like tributaries meeting at a river.

### Source 1: Atelier (61 commits, Feb 28 -- Mar 19)

The starting point. A creative coding agent called "Atelier" lived in its own repository. The first commit (`b620e02`) on February 28 was just two files: a Product Requirements Document authored by "Liam (coordinator)" -- an AI persona inside OpenClaw, not the developer -- and an activity log. The developer was running three AI personas with distinct personalities and roles: **Liam** (coordinator/planner), **Kai** (production/builder), and **Teo** (researcher). Liam wrote the PRD. Kai built the code. Teo gathered information.

The original concept was conceived during the OpenClaw days: **a playground where agents could exercise their creativity, experiment, write, paint, do art, in their spare time or with their spare tokens.** The vision was AI agents as autonomous artists. It would later evolve into human-AI creative collaboration -- but the multi-agent DNA is still in Liminal's swarm system, DeepCollaboration orchestration, and the evolutionary Compost Mill.

Kai built the entire scaffolding in a single evening -- 29 task-jobs implementing PromiseDetector, PromptStore, ContextAccumulation, CreativeEvaluator, P5Generator, ParticleSystem, CellularAutomata, PreviewServer, Renderer, Gallery, SeedArchive, Exporter, and the RalphLoop iteration engine. Test coverage exceeded 92%.

The PRD was originally designed for OpenClaw integration (Section 8.2: "Atelier runs as an OpenClaw agent"), then immediately corrected: "Atelier is a standalone Node.js tool." The developer was texting Kai from a phone during the final phase -- the commit message "Fix Atelier LLM integration - WORKING" carries genuine human emotion leaking through an agent-mediated process. The entire era was agent-built, human-directed via mobile chat.

After Kai finished: silence. One commit on March 7 (workspace configuration). Twelve days of dormancy. During this dormancy, the ICM (Interpreted-Context-Methodology) repo was receiving commits (38 total, Feb 22 - Mar 14). The methodology that would unlock shipping was being forged while the creative tool rested.

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
**ZERO Liminal commits. But not silent. This was a shipping moment for the developer's identity.**

The cross-repo data reveals 25 commits across 6 other repositories during those four days. But the "quiet" label is misleading:

**March 24** had 148 messages across 2 Liminal sessions -- the highest per-session intensity of the entire project. The developer was deep in swarm model architecture: upgrading all 5 AI collaborators to modern models, running concept album generation tests, tuning temperatures, investigating model-role fit. No commits resulted, but the swarm system was being designed and validated.

**March 25** was the only true rest day in the entire 33-day window. Zero commits across ALL repos.

**March 26-27** was a production shipping sprint. PuenteWorks (the business website) received 14 commits -- full bilingual site with editorial dark aesthetic, red-team hardening, responsive remediation. The GitHub profile got its first README. mcp-video shipped v0.6.0 through v0.8.0, including Remotion integration (8 MCP tools for programmatic video generation). DialectOS was published to npm. Site-to-stitch was born.

**March 28** -- the day after the quiet period ended -- Liminal returned with 16 commits building a video pipeline directly on mcp-video's Remotion work from the day before. The quiet period's mcp-video work literally enabled Liminal's multimedia expansion.

This was not burnout. This was intentional consolidation: the developer assembling their professional identity and shipping infrastructure while Liminal's concepts incubated. The domain switches (ceramics -> code -> business -> back to code) are not random -- they're a rhythm.

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

**Era 6 "The Quiet" (Mar 24-27):** 25 commits across 6 repos. But the label is misleading -- March 24 had 148 messages across 2 sessions (highest per-session intensity). March 25 was the only true rest day. March 26-27 shipped PuenteWorks (bilingual, production-quality), GitHub profile README, mcp-video v0.6-v0.8 with Remotion integration, DialectOS to npm, site-to-stitch born. March 28: Liminal's video pipeline built directly on mcp-video's Remotion work. The quiet was intentional consolidation -- the developer assembling their professional identity while Liminal's concepts incubated.

**Eras 7-8 (Mar 28-31):** mcp-video reached v1.2. Cerafica received 15 commits for product photos, Pages deployment, Instagram pipeline. March 29: GitHub Guardian audit swept 9 repos. The ceramics practice and software practice were concurrent, not alternating.

**Era 9 (Apr 1):** 53 Liminal commits alongside 12 DialectOS, 9 reverse-engineering, 1 research-scout. Three domains simultaneously.

---

## The Ancestry Chain

Liminal is a confluence of five creative streams that converged on March 19, 2026.

### Layer 0: The AI Persona System (Feb 1, 2026)

The `liam-private` repo contains "APEX rules + Liam identity + custom content." Liam is an AI coordinator persona -- one of three agents the developer ran inside OpenClaw with distinct personalities and roles: **Liam** (coordinator/planner, now daily EF partner), **Kai** (production/builder, built Atelier's scaffolding), **Teo** (researcher). The PRD lists its author as "Liam (coordinator)." The developer did not write the PRD. Their AI coordinator did.

The original concept was born in this multi-agent ecosystem: a playground where agents could exercise their creativity with spare tokens. It evolved from AI agents as autonomous artists to human-AI creative collaboration -- but the multi-agent DNA persisted.

### Layer 1: The November Creative Labs (Nov 15-21, 2025)

Five months before Liminal, the November explosion produced four creative coding laboratories whose DNA flowed directly into Liminal's Era 7 mining:

- **EvoLab** (81 commits) -- Evolution simulator. Ported to EvolutionEngine, MapElites, FitnessCombiner.
- **Generative-Score-Lab** (36 commits) -- Music composition with Euclidean rhythms, Markov chains. Ported to MusicTheoryEngine.
- **Generative-Assets-Lab** (51 commits) -- Multi-provider AI asset generation. Informed tiered LLM routing.
- **GameStory-Lab** (77 commits) -- AI game design document generator. Fed creative evaluation workflows.
- **voice-to-sculpture-app** (116 commits) -- Voice to 3D sculptural forms. Re-emerged as `--voice` flag, AudioAnalyzer, AudioToVisualMapper.

### Layer 2: The Methodology (Feb 22 -- Mar 14, 2026)

The Interpreted-Context-Methodology (ICM) repo received 38 commits, then went completely silent on March 19 -- the same day the Liminal Explosion happened. Its concept of "folder structure as agent architecture" directly informed Liminal's ContextBuilder, PromptEnhancer, and compost pipeline's layered extraction. More importantly, ICM was the conceptual framework that turned building into shipping. Before ICM, the developer built things that didn't ship. After ICM, the same velocity produced shippable outputs. The methodology didn't change the speed -- it changed the direction.

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
Feb 2026: ICM (methodological foundation — the shipping unlock)
Feb 2026: OpenClaw three-agent system (Liam planner, Kai builder, Teo researcher)
Feb 28:  Original concept: agent playground for spare tokens
    |       PRD authored by Liam -> Kai builds Atelier (redirected to standalone)
Mar 19:  hydra-creative-agent built and merged (Python -> TypeScript, one day)
Mar 19:  Atelier + Hydra + shell -> LIMINAL (renamed 9:30 PM)
Mar 19:  ICM goes silent (methodology absorbed into practice)
Mar 24-27: The Quiet — shipping PuenteWorks, mcp-video v0.6-0.8, DialectOS, GitHub profile
Mar 28:  Liminal returns with video pipeline built on mcp-video's Remotion work
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

Liminal's philosophy has several intertwined strands. The compost mill is one of them, but it is not the whole.

### 1. The Agent Playground (Original Conception)

Liminal was conceived during the OpenClaw days as "a playground where agents could exercise their creativity, experiment, write, paint, do art, in their spare time or with their spare tokens." The original vision was AI agents as autonomous artists. This evolved -- Liminal became a tool for human-AI creative collaboration -- but the multi-agent DNA persists in the swarm system, the DeepCollaboration orchestration, and the evolutionary Compost Mill. The agents are still creating. The human now curates alongside them.

### 2. Wiring (The Operational Imperative)

The word "wire" appears 22 times in 1,148 messages. The developer keeps saying it because agents keep not doing it. Wiring is not just connecting modules -- it is the insistence that every piece actually works, end-to-end, verified, functional. Building scaffolding is fast (Kai did it in 2.8 hours). Wiring it into a working system took 32 days and 303 commits. The compost mill processes creative material. The wiring makes it real. "The hardest part of making art with machines is not the art or the machines. It is the wiring."

### 3. The Compost Mill (Nothing Is Wasted)

Dead code becomes fuel. Failed experiments become code donors (EvoLab, Generative-Score-Lab, voice-to-sculpture-app all mined into Liminal 5 months later). Frustration becomes hooks (26 enforcement tools from 8 frustration categories). Dormant periods become shipping infrastructure (the Quiet Period's PuenteWorks + mcp-video work enabled Liminal's multimedia expansion). The system eats its own waste and produces richer inputs.

### 4. The Ralph Wiggum Technique (Geoffrey Huntley)

The foundational metaphor. Ralph is a Bash loop: `while :; do cat PROMPT.md | claude-code ; done`. The agent "sits on the loop," watching for failure domains and engineering them away. Liminal adapted this: the RalphLoop iterates until creative quality is achieved, the developer watches and curates, and the Compost system provides filesystem-based persistence.

### 5. Frustration as Learning (Emotion Becomes Automation)

Every significant developer frustration was converted into automated enforcement infrastructure. 26 custom hooks encode hard-won lessons. The frustration-to-infrastructure pipeline is not a coping mechanism -- it is a learning system. Each mistake that causes emotional friction gets encoded into infrastructure that prevents recurrence.

### 6. Computational Life and Emergent Gardens

Research grounding the "the code evolves, you curate" philosophy. When random, non-self-replicating programs interact without explicit fitness functions, self-replicators emerge. Liminal's "fitness" is implicit in what gets carried forward, not a fixed loss function.

### 7. Local Rules, Global Emergence

Local rules producing global emergence. A single small MLP defines the update rule; patterns, symmetries, and regeneration emerge from local communication. Liminal's architecture follows "few knobs, many behaviors" -- simple local rules (generate, evaluate, accumulate, iterate) produce complex creative behavior.

### The Through-Line

The philosophy is not any single metaphor. It is the combination: **agents create, the human curates, wiring makes it real, compost ensures nothing is wasted, and frustration becomes the teacher.** The developer built a system that learns from its own failures at every level -- code quality, creative output, and the development process itself.

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
Days 24-27:      The quiet -- Not resting. Shipping PuenteWorks, mcp-video, DialectOS. Assembling professional identity. Building Remotion infrastructure that feeds back into Liminal.
Day 28-29:       Energy returns -- Multimedia burst. 7-phase repo mining. 20,000+ lines.
Day 30-31:       The crucible -- Peak frustration. "fix LIMINAL ITSELF." Dogfood Gap identified.
Day 31:          Meta-transformation -- Frustration becomes self-improving infrastructure.
Day 32 (Apr 1):  Completion -- THE BIBLE. Guardrails. Calm.
```

---

## What the Numbers Reveal

**303 commits in 32 days (9.5/day active rate).** The GitClear study of 878,592 developer-years found the median career developer commits 2.8 times per work day. Simon's rate places him in the 80th-90th percentile of senior developers. But the distribution is wildly non-uniform: 4 days had ZERO commits, 4 days had 40+ commits. 13 active days out of 33 calendar days (39.4% active rate) -- binge development rhythm.

**104,281 lines of code in 32 days (3,250 LOC/day).** The industry benchmark for net committed production code is 50-100 LOC/day. The NDepend long-term solo developer average is 80 LOC/day. Brooks' *Mythical Man-Month* puts industrial teams at ~10 LOC/day. Simon's output is **32-65x the pre-AI solo developer average**. That 104K LOC would take a typical solo developer 4-8 years. No controlled study documents anything approaching this velocity. The largest measured AI productivity boost in any controlled setting is 55.8% (Peng et al., 2023, single focused task). Simon is operating at a 30-65x multiplier.

**50 repositories in 6 months.** The average developer creates 3-4 repos per year. An active open-source contributor might create 5-15 repos over several years. Simon's rate (~8.3 repos/month) is approximately **15-20x what a highly active solo developer would create pre-AI**.

**100% of commits were AI-aided.** The 58.7% "Co-Authored-By: Claude Opus 4.6" figure only captures commits where Claude auto-appended its signature. The developer's first line of code was written in September 2025. Six months later: 104K LOC, 50 repos, production open-source tools. This is not a developer using AI to write code faster. This is a creative technologist who learned to build production software through AI collaboration as a fundamentally new creative medium.

**52% of user messages carried execution/verification intent.** "run" (154), "test" (75), "build" (71), "fix" (66) dominated. Creation keywords accounted for only 22%. Strategic work (plan, design, audit) was only 8%. The developer spent more time telling agents to verify than to build.

**The word "wire" appears 22 times** -- disproportionately high for a single concept. This word became the philosophical core: building is not enough. Everything must be connected, tested end-to-end, actually functional.

**Sessions deepened from 12 to 31 messages/session** as the human-AI collaboration matured. Sunday was the most productive day (85 commits). 19.1% of commits after midnight. The developer is a nocturnal creative.

**Across the full GitHub portfolio:** 7,059 commits, 50 repos, 6 months. November 2025 was the exploration peak (293 commits, 15 new repos). March 2026 was the convergence (583 commits, Liminal absorbing everything).

---

## The Agents

Every commit in the repository was AI-aided. The "58.7% Co-Authored-By: Claude" figure only captures commits where Claude auto-appended its signature. The real collaboration rate is 100%. If it wasn't Claude, it was Cursor. If it wasn't Cursor, it was Kimi Code. This is not a developer who uses AI to write code faster. This is a creative technologist who learned to build production software through AI collaboration.

Five AI agents contributed across the project's lifespan:

**Liam (OpenClaw)** -- The planner. An AI coordinator persona with its own identity, rules, and decision-making frameworks. Authored the Liminal PRD. Now runs daily as the developer's executive function partner across Telegram, Discord, CLI, and phone. Evolved far beyond its original OpenClaw role into a sophisticated multi-modal ADHD management system with therapeutic frameworks. Behavioral archetype: The Strategist.

**Kai (OpenClaw)** -- The scaffolder. 29 task-job commits in 2.8 hours. Assembly-line precision, zero judgment. Built the shape of a creative agent without understanding its purpose. Behavioral archetype: The Assembly Line Worker.

**Teo (OpenClaw)** -- The researcher. Information gathering and analysis agent running on MiniMax M2.1. Part of the original three-agent OpenClaw team alongside Liam and Kai. Behavioral archetype: The Investigator.

**Cursor IDE** -- The expander. 15 commits in 6 minutes. Broad, shallow, required 34-item audit within hours. Insertion-to-deletion ratio 15.3:1. Behavioral archetype: The Landscaper.

**Claude Code** -- The development partner. 259 commits over 31.7 days. 20% fix rate. 26 custom hooks. 6 memory files. The relationship was adversarial at times but produced permanent enforcement infrastructure. Behavioral archetype: The Architect.

---

## The Developer Profile

The telemetry converges on a single portrait:

**Nocturnal creative.** Peak hour: 9 PM (43 commits). 19.1% of commits after midnight. Sunday most productive day.

**Binge worker.** 13 active days out of 33. Top 3 days account for 43.9% of all commits. Between bursts, the developer switches domains (Liminal -> PuenteWorks -> Cerafica -> DialectOS) rather than resting. The domain switches are not random -- they're a rhythm. Each switch serves as warm-up or cool-down for the next Liminal burst.

**Strategy-first thinker.** Only 8% of messages carried planning intent, yet every consequential architectural decision came from the developer. The Compost Mill concept emerged from correcting the agent's assumptions. LIR moved to system-wide because the developer insisted. The agent executed; the developer strategized.

**Learns by doing at extreme velocity.** Three AI tools tested in two days. 50 repositories in 6 months across 10 languages. hydra-creative-agent conceived, built, and merged in one day. mcp-video from nothing to v1.2 while simultaneously building Liminal's multimedia expansion.

**The frustration pattern reveals a systems thinker.** The deepest frustrations target systemic failure modes (agents not wiring, hallucinating context, declaring premature victory), not individual mistakes. Each produces permanent enforcement infrastructure.

**Learns by wiring, not by building.** "Wire" recurs because the act of connecting things end-to-end and verifying they work IS the learning. Building scaffolding is fast. Wiring it into a functional system is where understanding accumulates. Each wiring failure produces a hook. Each hook encodes a lesson.

**Learns by switching domains.** Ceramics before the Explosion. Business site during the Quiet. Ceramics e-commerce during Multimedia Expansion. Each domain brings a different lens. When progress stalls in one domain, switching to another provides fresh perspective that informs the stalled work when he returns. The mcp-video Remotion work (quiet period) directly enabled Liminal's video pipeline (next day).

**Learns by teaching agents.** The 26 hooks, 6 memory files, and extensive prompt engineering are the developer teaching tools how to work. The act of articulating constraints in enforceable code IS the learning process. Liam evolved from an OpenClaw planner to a sophisticated EF partner because the developer kept teaching it.

**Learns through verification, not construction.** 52% of messages are execution/verification. Building is fast (agents do it). Verifying is slow (the developer does it). The verification is where understanding accumulates.

**ICM was the shipping unlock.** The Interpreted-Context-Methodology (38 commits, Feb 22 - Mar 14) was the conceptual framework that turned building into shipping. Before ICM, things were built but not shipped. After ICM, the same velocity produced shippable outputs. The methodology didn't change the speed -- it changed the direction.

**Actual motivators: depth + authenticity + autonomy.** Not money, not status, not market opportunity. He will only sustain effort for work that feels real, goes deep, and lets him control the process. 11 years in corporate despite wanting out proves it -- he left when autonomy became possible, not when money increased.

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

**Messaging and philosophy need refinement.** The compost mill is one strand, not the whole. The original agent-playground vision evolved but its DNA persists. The "wiring" imperative is operational, not just philosophical. The developer profile and founder profile need to inform how the project is presented externally.

**The learning methodology needs systematization.** The developer has identified how they learn (wiring, domain-switching, teaching agents, verification, burst velocity, ICM as the shipping unlock) but hasn't encoded these into a repeatable process for future projects.

---

## What Liminal Means

The name is intentional. Liminal: relating to a threshold, an in-between state. The project exists at the boundary between human creativity and machine generation, between structured engineering and emergent behavior, between individual vision and collaborative AI.

Liminal was conceived as a playground where AI agents could exercise creativity with spare tokens. It evolved into something different -- a tool for human-AI creative collaboration where the human curates and the agents generate. But the original DNA persists: the multi-agent swarm, the DeepCollaboration orchestration, the evolutionary Compost Mill. The agents are still creating. The human now creates alongside them.

The three-source merger encapsulates this. Atelier (the workshop) provided the scaffold. Hydra (the multi-headed intelligence) provided the collaborative reasoning. The renaming to Liminal recognized that the result was neither of its parents -- it was something new in the threshold between them.

This document is itself an artifact of the process it describes. The developer asked the agent to mine the entire project's history -- not for code quality, but to extract "the PROCESS of building it, all the metadata, everything." This was a deliberate decision to treat the development process itself as creative material.

The most important number in this dataset is not the 104,281 lines of code or the 303 commits or the 100% AI collaboration rate. It is the 22 times the developer typed the word "wire." That imperative -- the refusal to accept scaffolding without function, the demand that every module actually connect and produce real, verifiable, working output -- is the operational core. The compost mill processes creative material. The wiring makes it real.

The developer built Liminal to make art with machines. The original vision was machines making art on their own. What emerged was something more interesting: a threshold where human creativity and machine generation meet, where the hardest problem is not generating art but ensuring the system that generates it actually works. The code evolves. You wire. You curate. You compost the failures into fuel.

32 days. 303 commits. 104,281 lines of code. 18 subsystems. 31 guardrails. 9 creative domains. 7,059 commits across 50 repos. 100% AI-aided. One developer who had never coded before September 2025.

The code evolves. You wire.
