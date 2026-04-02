# Liminal — Session Handoff

## Who You're Working With
Simon Gonzalez de Cruz. Creative technologist, ex-Capital Group, building at PuenteWorks. Nocturnal, binge-worker, strategy-first systems thinker. Learns by doing at extreme velocity. Has zero patience for agents that build modules without wiring them end-to-end. If you build something, wire it up, test it, verify it actually works.

## Current Branch
`narrative/liminal-archaeology` — a narrative/ archaeology branch where all the session mining happened. The DEV agent also did GuardrailDashboard work here. Main branch is `main`.

## What Liminal Is
A creative coding CLI tool that generates p5.js, GLSL, Three.js, music (Tone.js/Strudel), video (Remotion), HTML, ASCII art through iterative self-improvement (the RalphLoop). Features 18 subsystems including Compost Mill (creative waste → seeds), aesthetic critics (color/layout/typography/sound), LIR (structured code analysis), chat interface, swarm generation, and a 3-phase Deterministic Guardrails Framework.

Liminal is a merger of three projects: Atelier (creative coding scaffold), hydra-creative-agent (multi-model collaborative AI), and an original shell. All converged on March 19, 2026.

**Stats:** 303 commits, 104K LOC TypeScript, 299 source files, 228 test files. Built in 32 days (Feb 28 – Apr 1, 2026). 58.7% of commits co-authored with Claude Opus 4.6.

## What Was Just Completed
Full narrative archaeology of the project:

**Data files produced (all in `narrative/data/`):**
- `deep-era1.md` through `deep-era7-8.md` — deep analysis of each development era
- `commit-eras.json` — canonical 9-era periodization
- `telemetry-git.json` — git velocity, hourly patterns, hotspots, diffs
- `telemetry-sessions.json` — 1,148 human messages, frustration markers, intent analysis
- `telemetry-agents.json` — Kai vs Cursor vs Claude Code profiles
- `telemetry-codebase.json` — file growth, module emergence, LOC timeline
- `telemetry-cross-repo.json` — what else was happening during each Liminal era
- `telemetry-visualizations.json` — 9 chart-ready datasets
- `telemetry-github-full.json` — full commit history across all 50 repos
- `telemetry-repo-depth.json` — 50 repos classified by relationship to Liminal
- `github-commits.csv` — 7,059 commits across 50 repos
- `github-repos.csv` — 50 repos with metadata
- `human-messages.json` — 1,148 extracted user messages
- Plus raw narrative data (sessions, philosophy, hooks, plans, Remotion research)

**Root-level deliverable:**
- `SYNTHESIS.md` — the single definitive document merging everything (580 lines, ~50KB)

**Key findings from the archaeology:**
- Liminal has 5 ancestry layers: Liam AI persona (PRD author) → Nov 2025 creative labs (code donors) → voice-to-sculpture-app (audio DNA) → Atelier+Hydra+shell merger → concurrent ecosystem
- The "Quiet" (Mar 24-27, zero Liminal commits) had 25 commits across 6 other repos
- 52% of user messages were execution/verification, not creation
- "wire" appears 22 times — the philosophical core of the project
- Developer profile: nocturnal creative, binge worker, converts frustration into automation (26 hooks from 8 frustration categories)
- The Dogfood Gap — "system reports success" != "output actually works" — is the defining structural problem

## Unresolved / Natural Next Steps
- Generation quality is fundamentally broken (20% success rate, scoring via regex without executing code)
- Landing page never achieved the vision (white squares, fake examples, broken animations)
- Live music coding (PRD Section 4.3) never started
- Remotion-to-blog pipeline researched but never built
- SelfReflectionEngine never integrated into RalphLoop
- CI/CD workflows removed "temporarily" on Mar 19
- Prompt content never audited against best practices
- Autonomous operation brainstormed but not implemented
- The narrative data could be turned into blog posts, a video, or a presentation

## Critical Rules
- ALWAYS wire everything end-to-end. No stubs. No "not yet implemented."
- The repo has jcodemunch and jdocmunch indexed — use them for code/doc navigation, not raw Grep/Glob
- Subagents run on glm-5.1 (text-only). Never assign vision tasks to subagents.
- Use firecrawl_search, exa, or brave_web_search — WebSearch is blocked by hook
- Use firecrawl_scrape, web-reader, or ref_read_url — WebFetch is blocked by hook
- Never push without explicit permission
- RalphLoop.ts is the heart of the system (modified 41 times)

## Memory Location
`~/.claude/projects/-Users-simongonzalezdecruz-workspaces-liminal/memory/MEMORY.md`
