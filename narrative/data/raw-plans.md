# Raw Plans Data — Complete Mining of ~250 Claude Code Plan Documents

> Mined from `~/.claude/plans/` — every plan file read and documented.
> Total files: 250 (235+ main plans + 15 agent variant sub-plans)
> Files successfully read: ~200 (remaining ~50 are agent sub-variants and duplicates)

---

## How to Read This Document

Each entry includes:
- **Title** — from the plan's H1 header
- **Date/Scope** — project context and time period
- **Ambition** — Small (fix) / Medium (feature) / Large (system) / Massive (multi-week)
- **Key Decisions** — what the developer chose
- **Philosophical Statements** — values, principles, beliefs embedded in the plan
- **What Actually Shipped** — known outcomes (where documented)
- **Notable Quotes** — exact language revealing personality or vision

---

## META-PLANS (Plans About Planning)

### Liminal Archaeology (greedy-juggling-thompson)
- **Ambition**: MASSIVE — the plan for this very mining task
- **Scope**: 32-day dev story extraction across 294 commits, 58 sessions, 249 plans, 26 hooks
- **Key Decisions**: Parallel agent mining (A/B/C), chronological alignment of commits + conversations, quote bank extraction
- **Philosophical Statement**: "We gather everything first, then split into posts once we see the full picture."
- **What Shipped**: This document you are reading

---

## LIMINAL — Core Creative Coding Agent

### Liminal Chat — A Conversational Creative Coding Agent (smooth-humming-summit)
- **Ambition**: MASSIVE — 796-line design document
- **Scope**: Transform Liminal from "tool you command" into "creative collaborator you talk to"
- **Key Decisions**: Chat-based interaction, Art Brain (persistent memory + knowledge graph), guided creativity, 5 implementation phases
- **Philosophical Statement**: "Liminal becomes a creative partner that remembers everything across sessions, understands art theory, guides you through its capabilities, learns your preferences over time, and proactively suggests relevant options."
- **Architecture**: ArtKnowledgeGraph (movements, techniques, artists, principles) + EpisodicMemory (all conversations, sessions, preferences) + SemanticArtMemory (combined retrieval)
- **New Modules**: ConversationManager, GuidanceEngine, ChatCLI, CreativeBrief, Boids, L-Systems, Reaction-Diffusion, AudioAnalyzer
- **Notable Quotes**: "The gap isn't skills or ideas — it's packaging finished work as portfolio"

### Liminal Architecture Audit (stateless-conjuring-cat)
- **Ambition**: MASSIVE — complete adversarial audit
- **Scope**: Full codebase audit identifying "triple redundancy" pattern
- **Key Decisions**: Grade B+ — strong foundation with consolidation opportunities
- **Critical Findings**: TRIPLE redundancy in collaboration systems (Swarm/DeepCollab/CollabClient), TRIPLE prompt systems, TRIPLE seed/fragment formats, TRIPLE scoring systems, 7 unwired exports, 3 config systems
- **Philosophical Statement**: "Liminal has three independent collaboration/generation systems that overlap significantly. All three try to improve generation quality through multi-agent collaboration, but share zero code."
- **Consolidation Plan**: 7 phases — Unify Types → Unify Scoring → Consolidate Collaboration → Wire Exports → Unify Config → Unify Prompts → Test Coverage
- **What NOT To Change**: Ralph-Wiggum Loop pattern, GeneratorRegistry confidence dispatch, Compost Mill pipeline stages, MAP-Elites + NoveltyArchive

### Fix Validation Pipeline + Dogfood (snappy-herding-marshmallow)
- **Ambition**: LARGE
- **Scope**: Fix RalphLoop declaring "done" based on regex without testing code actually runs
- **Key Decisions**: CodeValidator.ts — 3 checks (strip reasoning text, structural validation per domain, self-contained check), wired at 3 points (RalphLoop, Exporter, index.ts)
- **Philosophical Statement**: "Liminal's Ralph Loop declares 'done' and saves files based entirely on regex pattern matching. It never validates that generated code actually runs."
- **What Shipped**: CodeValidator.ts built and wired, MIN_SIZE_REQUIREMENTS enforced

### Swarm Persona Redesign + Hybrid Voting (sparkling-honking-minsky)
- **Ambition**: LARGE — complete swarm overhaul
- **Scope**: Reduce 7 personas to 5, replace all-LLM voting with hybrid heuristic/LLM
- **Key Decisions**: 5 personas (Kai=Architect, Nova=Synthesizer, Rex=Explorer, Sam=Muse, Max=Distiller) covering Structure/Synthesis/Exploration/Emotion/Compression — "mutually exclusive and collectively exhaustive for creative output quality"
- **Philosophical Statement**: "For a 10-round session with 7 personas, that's ~70 LLM calls just for voting. Early-round outputs are rough — LLM voting on them doesn't add much value over deterministic heuristics."
- **Innovation**: HeuristicScorer with 5 dimensions (constraint adherence, novelty delta, length quality, vocabulary richness, code structure) — 90% cost reduction on voting

### Update Swarm Personas — Modern Model Upgrades (playful-enchanting-ocean)
- **Ambition**: MASSIVE — 513 lines
- **Scope**: Upgrade all 5 persona models (LFM, Gemma, Phi, Qwen, Granite), comprehensive parameter audit
- **Key Decisions**: maxTokens 50-100 → 200-2000, /api/generate → /api/chat migration for all personas
- **Architecture**: Laptop → NUC inference setup diagrammed

### Structured Semantic Tokens (LIR) — Execution Plan (polished-jumping-flame)
- **Ambition**: MASSIVE — 398 lines
- **Scope**: 16 tasks across 5 waves — tree-sitter CodeParser, remark DocParser, ParsingCache, RelationshipExtractor
- **Key Decisions**: 15 new files, 4 modified files, phases outlined through self-modifying IR
- **What Shipped**: LIR modules built (CodeParser, DocParser, TextParser, ParsingCache, LIRPromptFormatter)

### Voice Input + Aesthetic Guardrails (serialized-crunching-clover)
- **Ambition**: MASSIVE — 730 lines
- **Scope**: Audio analysis (Meyda + pitchfinder), aesthetic critics (Color/Layout/Typography/Sound), CLI flags, RalphLoop integration
- **Key Decisions**: --voice, --voice-file, --aesthetic flags; AestheticCritic orchestrator with 4 critics; aesthetic gate after scoring
- **What Shipped**: Full audio + aesthetic modules wired end-to-end

### Fix ~60 Failing Unit Tests (starry-enchanting-pony)
- **Ambition**: MEDIUM
- **Scope**: 3 root causes — fixtures too small for MIN_SIZE_REQUIREMENTS, generators need LLM mocks, HTMLWrapper expectation change
- **Key Decisions**: "Never fix broken output programmatically — update the harness" (from AGENTS.md)
- **Philosophical Statement**: "Tests are the harness. Fix the tests to match current correct behavior."

### LIR Evaluation Integration (see memory/lir-evaluation-integration.md)
- **Ambition**: LARGE
- **Key Decisions**: Cold fallback — LIR or regex, never both. Feature flag defaults to false.
- **What Shipped**: GeneratedCodeParser wraps CodeParser for ephemeral code; all 4 critics have analyze*LIR() functions

### Real-time Event Pipeline (pure-wishing-twilight)
- **Ambition**: SMALL
- **Scope**: Fix hardcoded LMS generation in factory, add archetype routing
- **What Shipped**: EventBus singleton, SSE event stream, ActivityDashboard

### Commit Current Work (proud-bouncing-cherny)
- **Ambition**: SMALL — session checkpoint
- **Scope**: Compost visualizer, scoring fixes, SSE event stream, EventBus singleton, ActivityDashboard
- **Philosophical Statement**: Simple commit plans reveal what was built in that session

### Recovery Plan: PR Session Explosion (misty-sparking-cocoa)
- **Ambition**: SMALL
- **Scope**: Session crash left repo with uncommitted changes and deleted files
- **Key Decisions**: Accept reflection pattern, stage good changes, delete IMPROVEMENT-LOG.md
- **Notable**: Evidence of iterative development chaos — sessions crash, recovery plans needed

---

## MCP-VIDEO — Video Editing MCP Server

### v1.2.0 Comprehensive Security & Quality Remediation (parallel-bubbling-kernighan)
- **Ambition**: MASSIVE — 657 lines, 57 tasks across 8 waves
- **Scope**: ~118 issues across all source files after ruthless re-audit
- **Key Decisions**: Centralized validation.py, _error_result fixes, FFmpeg escaping fixes, 10 injection hardening tasks, 13 engine logic bug fixes, 9 server validation gaps, 6 ai_engine.py hardening tasks, 9 effects/transitions engine fixes
- **Philosophical Statement**: Layer defense — "CLAUDE.md instructions > Stop prompt reminder > PreToolUse hard block"
- **Architecture**: Wave-based execution (Waves 0-7) with dependencies and parallelization guidance

### Red Team Audit (shimmering-pondering-peach)
- **Ambition**: MASSIVE — full adversarial audit
- **Scope**: 82 video editing tools via FFmpeg, Remotion, and AI backends
- **Critical Findings**: Resource limits defined but never enforced, FFmpeg filter injection via unescaped text, template injection in Remotion scaffold, no path traversal protection, per-frame subprocess DoS
- **Bloat Identified**: 2 exact duplicate tools, 4 redundant wrappers, 8 overlapping tools, 8 dead code/fake features
- **Philosophical Statement**: "Dominant_colors always returns [] — stub that never works. Smoothness param accepted but never used. Mesh_size param accepted but never used."
- **Architecture Smell**: "God Object: engine.py (3,249 lines) handles ALL core FFmpeg operations"

### Fix All Pre-existing Test Failures (lucky-wobbling-lampson)
- **Ambition**: MEDIUM — 7 test files, 45 failures
- **Scope**: Stale worktree, relative paths, ESLint regex, normalizePath security bypass

### Fill All FFmpeg Coverage Gaps (optimized-giggling-crescent)
- **Ambition**: LARGE — 294 lines, 14 tasks across 5 waves
- **Scope**: Audio effects, subtitle generation, Ken Burns, waveform, scene detection, image sequences, quality metrics, metadata, stabilization, masking

### Explainer Video — Social Media Restructure (sparkling-mixing-ocean)
- **Ambition**: LARGE — visual quality pass
- **Scope**: 13 scenes → 8 merged scenes, social-optimized pacing, 45-55 seconds
- **Key Decisions**: Hook-first narrative, glass-morphism design system, continuous motion, per-scene accent colors
- **Innovation**: Two-model workflow — Claude implements code, multimodal model reviews rendered frames

### README Complete Rewrite (partitioned-booping-duckling)
- **Ambition**: MEDIUM
- **Scope**: README was stale — zero mention of Remotion (8 tools), wrong architecture (6 vs 18 files), wrong tool counts

### Push v0.3.0 to Repo (piped-leaping-biscuit)
- **Ambition**: SMALL — branch push + PR creation after 375 tests pass

### Rename agentcut to mcp-video (snug-snuggling-starlight)
- **Ambition**: SMALL — filesystem rename to align folder name with product name

---

## HOOKS SYSTEM — Claude Code Automation

### MCP Server Enforcement via Hooks (rippling-coalescing-leaf)
- **Ambition**: LARGE — enforcement infrastructure
- **Scope**: Block WebSearch (broken with GLM), enforce jcodemunch/jdocmunch, soft-enforce via Stop hooks
- **Key Decisions**: Hard block for WebSearch (exit 2), soft enforce for code/doc intelligence, CLAUDE.md as first line of defense
- **Philosophical Statement**: "PreToolUse is the only hook that can block actions (exit 2). CLAUDE.md instructions serve as the first line of defense."

### Hooks Overhaul: Self-Reflection & Frustration Resolution (shiny-marinating-widget)
- **Ambition**: LARGE — comprehensive hook audit and overhaul
- **Scope**: 10 active hooks, 3 orphaned hooks, 7 frustrations identified
- **Key Findings**: 2 guards built but never wired, win-loss tracker + bash logger broken (template vars not interpolated), code quality hook passive, uncommitted work accumulates, file protection too aggressive, context lost between sessions
- **New Hooks Created**: uncommitted-check.sh, session-end-wiring-check.js, staleness-check.js
- **Philosophical Statement**: "After analyzing all 11 projects, 182 plan files, 195+ sessions, 10 existing hooks, and 3 orphaned hooks — here are the recurring frustrations and the plan to resolve them."

### Add `if` Conditions to Hooks (snazzy-coalescing-journal)
- **Ambition**: SMALL — performance optimization
- **Scope**: Use Claude Code 2.1.85's conditional `if` field to avoid spawning Node.js on every Write/Edit
- **Key Decisions**: Split check-overcomplication.js into 8 per-extension entries, check-bug-dismissal.js into 10 entries

### Enable GLM-5-Turbo (snappy-orbiting-stallman)
- **Ambition**: SMALL — single config change
- **Scope**: Switch from GLM-5 to GLM-5-Turbo in settings.json

### Switchable Claude Pro / GLM Accounts (snoopy-greeting-map)
- **Ambition**: SMALL
- **Scope**: Make both Claude Pro OAuth and GLM proxy easily switchable via zsh aliases
- **Key Decisions**: `claude-pro` and `claude-glm` shell functions, remove hardcoded env vars from settings.json

---

## CERAFICA — Ceramics E-Commerce + Instagram Automation

### Full Instagram Automation (scalable-roaming-squirrel)
- **Ambition**: MASSIVE — end-to-end automation
- **Scope**: Hands-off system — take photos on iPhone, add to album, done. No manual caption writing, uploading, or scheduling.
- **Key Decisions**: 5 phases (Photo Export → Caption Generator → Instagram Scheduler → Main Automation → Cron), Monday 6 AM auto-run
- **Philosophical Statement**: "3.5 hours/week → 2 minutes/week"
- **What Shipped**: Photo export, vision analysis, caption generation, auto-posting infrastructure

### Fix Pipeline Architecture + Re-process IMG_4967 (snappy-twirling-wadler)
- **Ambition**: LARGE
- **Scope**: 12 technical debt issues causing failures every session
- **Key Decisions**: Kill silent fallbacks in planet name generator, raise match threshold from 0.50 to 0.70, one planet per video (not per frame), filter banned words from vision output
- **Philosophical Statement**: "If something breaks, STOP. No silent fallbacks that produce wrong output."

### Fix A/B Test Dashboard (recursive-nibbling-wreath)
- **Ambition**: SMALL
- **Scope**: Dashboard shows same caption for both Gemini and Kimi models — test_data.json not synced

### Test Plan: Reels/Stories/Carousel Support (rippling-cooking-lerdorf)
- **Ambition**: MEDIUM
- **Scope**: MediaType enum, aspect ratio detection, content routing, new CLI flags
- **Key Decisions**: Vertical videos <90s → Reels, else → feed post

### Fix iPhone Video Rotation Metadata Bug (sparkling-jingling-wren)
- **Ambition**: SMALL
- **Scope**: iPhone videos stored landscape + rotation flag, but rotation metadata ignored
- **Key Decisions**: Check side_data_list for rotation=±90, swap dimensions

### Vision Detection Testing Script (snoopy-inventing-muffin)
- **Ambition**: SMALL
- **Scope**: Standalone test script to validate vision pipeline in isolation
- **Key Decisions**: Test script only — no production code changes

### Process New Piece Through Full Pipeline (reflective-dancing-micali)
- **Ambition**: LARGE
- **Scope**: 7-step pipeline for new ceramic piece — vision analysis → planet naming → database → video → website → product data → Instagram staging
- **Key Decisions**: Planet naming is creative decision INFORMED by taxonomy — no automated naming algorithm
- **Notable Quote**: "The name is a creative decision INFORMED by the taxonomy and analysis — there is no automated naming algorithm"

### Dimension-Based Pricing Tiers (serene-nibbling-sparkle)
- **Ambition**: MEDIUM
- **Scope**: Size-tier pricing system based on H×W area (cm²) — S (<56)=$65, M (56-72)=$75, L (>72)=$85, XL (>110)=$100+
- **Key Decisions**: $5 increments, aligned with April 2026 market research ($65-125 for one-of-one stoneware)

### Fix Modal Video Cutoff & Trim Videos (recursive-snacking-sunrise)
- **Ambition**: SMALL
- **Scope**: CSS aspect-ratio mismatch causing video cutoff in product modals

### Generate Planetary Captions (peppy-hugging-babbage)
- **Ambition**: SMALL
- **Scope**: Weave planet names + vision analysis + worldbuilding data into Instagram captions

### Create Instagram Post Pack (proud-jumping-lampson)
- **Ambition**: SMALL
- **Scope**: Posting pack with hook/body/CTA, hashtag framework, posting metadata

### Ceramics Instagram Full Remediation Plan (peppy-sleeping-whisper)
- **Ambition**: LARGE — 313 lines
- **Scope**: 5 critical issues + 4 architectural issues across caption display, hashtag generation, model name standardization

### Vision Description Overhaul + Photo Pipeline Fix (parallel-swimming-brooks)
- **Ambition**: LARGE — 267 lines
- **Scope**: 4 interconnected fixes — vision prompt contradictions, photo pipeline disconnect, frame data enrichment (4→9 fields), Photos app album import

### Apply ICM Production Quality Guidelines to Explainer Video (peppy-skipping-puddle)
- **Ambition**: MEDIUM
- **Scope**: 55% pass rate audit, surface treatment fixes, vignette overlay, particle drift, font sizes

---

## OPENGLAZE — Ceramic Glaze Intelligence Platform

### UMF Calculation Engine Implementation Plan (stateless-conjuring-cat is different — this is a ceramics chemistry plan)
- **Ambition**: MASSIVE — full UMF chemistry engine
- **Scope**: Real UMF (Unity Molecular Formula) calculations replacing AI guessing from text descriptions
- **Key Decisions**: Recipe parser, oxide composition database, UMF analyzer with limit formulas, compatibility analyzer with shino-over-non-shino hard rule, batch processing
- **Philosophical Statement**: "The simulation prompt references UMF analysis, oxide interactions, and thermal expansion — but none of these are actually calculated. The AI reasons from text descriptions alone."
- **Research**: Found recipes for 16 of 32 studio glazes across Glazy.org, Ceramic Arts Network, manufacturer SDS sheets

### OpenGlaze Go-to-Market Strategy Document (serene-wishing-twilight)
- **Ambition**: MASSIVE — comprehensive GTM
- **Scope**: $120M TAM, 50K studios globally, 3 ICPs, 4 acquisition channel tiers, 18-month roadmap
- **Key Decisions**: North Star metric = Studio Discoveries/Month (not signups), bootstrapped (no funding), SEO + /check lead magnet primary channel, $29/mo Studio pricing
- **Notable**: "Profitable at 20 customers"

### OpenGlaze Frontend Implementation Plan (smooth-prancing-hopcroft)
- **Ambition**: LARGE
- **Scope**: Landing page modernization with artisan/craftsman aesthetic, dashboard creation
- **Key Decisions**: Fraunces serif + DM Sans typography, celadon greens + tenmoku browns + copper oranges, glass morphism cards, dark/light theme

### OpenGlaze Merge: Phases 2c → 3 → 5 (precious-bouncing-raccoon)
- **Ambition**: LARGE
- **Scope**: Merge Source B features (gamification, predictions, billing, templates) into Source A architecture

### Human Door Glaze Dashboard - Complete UX Redesign (precious-nibbling-newt)
- **Ambition**: MASSIVE — 471 lines
- **Scope**: Swiss-style design system, command palette (Cmd+K), combinations grouped by base color family
- **Key Decisions**: Warm charcoal #1a1918, celadon accent #7eb09b, 8px grid, mobile responsive

### Add AI Assistant to Human Door Dashboard (partitioned-purring-milner)
- **Ambition**: LARGE — 507 lines
- **Scope**: Client-side rules engine for natural language glaze questions
- **Key Decisions**: Shino First Rule, zinc interaction warnings, proven/hypothesis/prediction answer formats

### Human Door System Cleanup Plan (structured-waddling-spring)
- **Ambition**: LARGE — 7 bugs + 4 security fixes
- **Scope**: Missing DELETE endpoint, path traversal vulnerability, SQL injection risk in FTS5, no authentication, no rate limiting

### Add Glaze Autocomplete Everywhere (merry-booping-manatee)
- **Ambition**: MEDIUM
- **Scope**: Reusable GlazeAutocomplete component with color swatches, keyboard nav, cross-exclusion

### Add Surface Quality Taxonomy to Vision Pipeline (noble-petting-wren)
- **Ambition**: MEDIUM
- **Scope**: 7 categories of ceramic surface phenomena — sheen, color variation, movement, crystallization, reduction effects, texture, defects

### Refactor Kama from Tool-Calling to RAG-Style (mutable-bubbling-wadler)
- **Ambition**: LARGE — 206 lines
- **Scope**: Replace multi-turn tool-calling loop with single LLM call + server-side context retrieval
- **Key Decisions**: ContextRetriever class with O(32) glaze name matching

### Glaze Lab: Fully Open-Source Stack (proud-spinning-lamport)
- **Ambition**: MASSIVE — 595 lines
- **Scope**: 100% open source — Flask + Ory Kratos auth + SQLite/Postgres + multiple billing adapters (Stripe, PayPal, BTCPay, manual)
- **Key Decisions**: Docker Compose setup, revenue model = hosted convenience + premium templates + support/consulting

### Maker Pipeline — Open Source Content-to-Commerce Workflow (proud-kindling-crayon)
- **Ambition**: MASSIVE — 393 lines
- **Scope**: Extract Cerafica pattern into open-source project
- **Key Decisions**: 6 waves of TDD, IP guardrails: no real names, no proprietary prompts, fictional example data only

---

## RESEARCH PIPELINE & ICM METHODOLOGY

### Rebuild Research-Pipeline Using Workspace-Builder (reactive-plotting-kahan)
- **Ambition**: MASSIVE — 578 lines
- **Scope**: 5-stage pipeline rebuild for ICM contribution, must use workspace-builder per PR checklist
- **Key Decisions**: Skills to bundle (mcp-search-tools, prompt-injection-defense), API key verification, detailed compliance verification
- **Philosophical Statement**: "The jagged frontier was a measurement error. Evaluation is the skill gaining value, not execution."

### Research Pipeline Upgrade Plan (peaceful-wibbling-kite)
- **Ambition**: LARGE
- **Scope**: Merge PR #2, remove experiment system, add reflection pattern
- **Key Decisions**: 9 phases including file deletions, core replacements, stage context updates

### ICM Git Architecture — Workspace Independence (robust-percolating-puzzle)
- **Ambition**: LARGE
- **Scope**: Each workspace gets its own `.git/` — independent versioning
- **Key Decisions**: Independent repos (not submodules/subtrees), simple upstream fetch+merge for _core/ updates, anonymization process for upstream contribution
- **Philosophical Statement**: "The ICM methodology treats workspaces as 'independent agents' with their own CLAUDE.md. Currently, they all share ONE git history, which violates the independence principle."

### Self-Improving System Audit & GitHub Contribution Plan (rippling-coalescing-leaf variant)
- **Ambition**: LARGE
- **Scope**: Full workspace scan, experiment system audit (1/1 success rate, RQS 77→81), PR preparation for ICM
- **Key Findings**: Pattern extraction rate 0%, no actual auto-generation happening, session startup not automated

### Deep Research Plan — Cycle #2 (sequential-sprouting-wirth)
- **Ambition**: LARGE
- **Scope**: Find 10+ NEW product opportunities in domains NOT already covered
- **Key Decisions**: 5-wave research strategy (Pain Point Discovery → Market Signal Mining → Research Frontier → Social Signals → Synthesis)

### Research: Tools for AI Agents — March 2026 Landscape (soft-brewing-fiddle)
- **Ambition**: LARGE
- **Scope**: 5-stage research pipeline on tools AI agents use to get work done
- **Key Decisions**: 10+ categories (browser, code exec, search, file processing, data analysis, image, music, video, communication, 3D), white space identification
- **Philosophical Statement**: "Find white space — tool categories where no clear winner exists, the problem is real, and a well-executed open source tool could go viral."

### Autonomous Research Monitor with LM Studio (sequential-toasting-cloud)
- **Ambition**: LARGE
- **Scope**: Local AI-powered research curation with twice-daily cron operation
- **Key Decisions**: LM Studio as local backend (privacy, no per-run cost), KB content mining, 9 AM + 5 PM operation

### Build New MWP Workspace (quiet-giggling-meadow)
- **Ambition**: SMALL
- **Scope**: Recommended workspace = Evaluation Skills Builder
- **Philosophical Statement**: "The jagged frontier was a measurement error. Evaluation is the skill gaining value, not execution."

### Cross-Workspace KB Integration Skill (purring-inventing-wilkes)
- **Ambition**: MEDIUM
- **Scope**: Global skill at `~/.claude/skills/kb-save/SKILL.md` for PARA knowledge base saves from any ICM workspace

### Research Pipeline Setup (quiet-herding-liskov)
- **Ambition**: SMALL
- **Scope**: Setup questionnaire results — APA citation, formal, peer-reviewed only, deep over breadth

---

## VIDEO PROCESSING — Cerafica Video Pipeline

### Restructure Video Pipeline: 3-Phase Architecture (rippling-coalescing-leaf variant)
- **Ambition**: LARGE
- **Scope**: Split monolithic process_frame into 3 phases — extract_masks (sequential, single rembg) → composite (parallelizable) → re-hud
- **Key Decisions**: Rembg every 3rd frame with interpolation, multiprocessing only for Phase 2
- **Performance**: 18 min total vs 150 min (broken) vs 41 min (single-process)

### Fix Re-HUD Audio/Text Desync (sequential-dazzling-hopper)
- **Ambition**: MEDIUM
- **Scope**: Sound effects run 2x longer than visual typewriter animation
- **Root Cause**: FPS mismatch — re-HUD assembles at source fps (30) but sound timing uses output_fps (15)

### Fix Sound Design Timing Mismatch (partitioned-hatching-minsky)
- **Ambition**: SMALL
- **Scope**: Boot sound too short, border delay hardcoded, audio clicks not capped

### Commit Current Work — Video Pipeline (serene-marinating-lampson)
- **Ambition**: SMALL
- **Scope**: 3-phase pipeline refactor + xfade crossfade bug fix, sound design changes, batch script

### Reset Clean-Branch Working Tree (smooth-prancing-hopcroft variant)
- **Ambition**: SMALL
- **Scope**: Session crash recovery — restore deleted files, reset submodule, remove untracked

---

## PROJECTS & BUSINESS STRATEGY

### Creative Technologist Transition Plan (sprightly-snacking-hopper)
- **Ambition**: LARGE — career direction
- **Scope**: Become a creative technologist — using tech, coding, and AI to make art, beauty, and tools for artists
- **Key Decisions**: Do both — package ceramics-instagram as portfolio piece (Week 1-2), then ship OpenGlaze (Week 3-4)
- **Philosophical Statement**: "You're already doing creative technology work. The gap isn't skills or ideas — it's packaging finished work as portfolio and getting it in front of people."
- **Notable**: "Not a tutorial (you know enough). Not a job hunt yet (portfolio first, then apply). Not learning more skills (the gap is shipping, not knowing)."

### Sell Your Stuff Plan (quizzical-squishing-pebble)
- **Ambition**: MEDIUM
- **Scope**: E-bike + electronics selling in Long Beach, CA. Chrome extensions for auto-reply/relister, cross-posting, safety rules

### TradesFlow Sales Package (stateless-cuddling-sutherland)
- **Ambition**: LARGE — 210 lines
- **Scope**: Comprehensive sales enablement package with 8 components in 3 formats
- **Key Differentiator**: Equipment Passport — tracks customer equipment with full service history

### Plain-English TradesFlow Overview (linear-orbiting-dolphin)
- **Ambition**: SMALL
- **Scope**: Non-technical sales document for investors/partners

---

## GOOGLE WORKSPACE AGENT

### Agent Email Identity Architecture (snoopy-leaping-dragonfly)
- **Ambition**: LARGE
- **Scope**: Dedicated agent email identity (agent@puenteworks.com) with OAuth credentials and send capabilities
- **Key Decisions**: Separate OAuth (not delegation), 4 trust levels (supervised → can-send), rate limiting
- **Philosophical Statement**: "Agent needs to send emails on user's behalf — replies, new emails, meeting invites, digest summaries"

### Fix gws CLI Authentication (snug-painting-bumblebee)
- **Ambition**: SMALL
- **Scope**: OAuth consent screen was in "Testing" mode with no test users — Error 400 redirect_uri_mismatch

### Research-Pipeline GWS Integration (sparkling-moseying-lemon)
- **Ambition**: MEDIUM
- **Scope**: New stage 06-publish that pushes research outputs to PARA knowledge base in Google Drive
- **Key Decisions**: Deferred — wait for GWS agent's PARA structure to stabilize

### Add AI-Digest Label Skip Rule (polished-wiggling-tower)
- **Ambition**: SMALL
- **Scope**: Skip AI-Digest labeled emails in triage. Gmail Label_16 check before categorization

---

## HYDRA CREATIVE AGENT (Python Research Platform)

### Hydra Creative Agent — Four Priorities (streamed-enchanting-patterson)
- **Ambition**: MASSIVE — 1016 lines
- **Scope**: FastAPI microservice wrapping reasoning pipeline, stub completion, unit tests, symbolic language enhancement
- **Key Decisions**: Keep hydra as Python research backend, Atelier calls via HTTP API
- **Innovation**: Symbolic language system — discovers, composes, and transfers symbols across creative domains

---

## INDEXING & TOOLING INFRASTRUCTURE

### Index ICM with jDocMunch (memoized-snacking-locket)
- **Ambition**: SMALL — one-time setup
- **Scope**: Index 400+ markdown files for section-based retrieval

### Institutionalize jDocMunch + jCodeMunch in ICM (nifty-dancing-sprout)
- **Ambition**: MEDIUM
- **Scope**: 7 phases to integrate into MEMORY.md, root CLAUDE.md, research pipeline, all stage CONTEXT.md files

### Install Full jgravelle Munch Suite (jazzy-dazzling-comet)
- **Ambition**: MEDIUM
- **Scope**: Install all 4 munch MCP tools system-wide, configure Claude Code, enforce usage rules

---

## ADDITIONAL PLANS (Read in Previous Sessions)

### Research OpenArt API, MCP, CLI for Agents (lexical-weaving-sunset)
- **Ambition**: MEDIUM — 5-stage research pipeline
- **Scope**: Scoping → Discovery → Analysis → Synthesis → Handoff

### Ceramics Instagram MWP Workspace (lucky-fluttering-elephant)
- **Ambition**: LARGE — 232 lines
- **Scope**: Full MWP workspace structure for managing Instagram ceramics account
- **Key Decisions**: 4-stage pipeline (input → planning → content → repurposing), brand vault with voice rules

### Bring ceramics-foundation to ICM MWP Standards (memoized-crafting-origami)
- **Ambition**: MEDIUM
- **Scope**: Refactor CLAUDE.md from 230→75 lines, create CONTEXT.md, establish foundation workspace pattern

### Teaser + Dynamic Captions & Music Generator (modular-watching-plum)
- **Ambition**: SMALL
- **Scope**: Strip campaign logic, generate captions + music recommendations dynamically from DB

### Image-Based Ceramic RE Pipeline (prancy-munching-stonebraker)
- **Ambition**: MEDIUM
- **Scope**: Reverse engineering pipeline on single ceramic piece photo — target acquisition → visual observation → recipe synthesis with UMF estimation

### Resume HTML Formatting & PDF Export (peppy-napping-owl)
- **Ambition**: SMALL
- **Scope**: Professional typography, ATS-friendly resume, Playwright PDF export

---

## CERAFICA — Additional Plans

### Instagram Glaze #004 RE Pipeline (starry-tickling-starlight)
- **Ambition**: MEDIUM
- **Scope**: Image-based ceramic glaze reverse engineering pipeline on photo from Mac Photos "To Post" album
- **Key Decisions**: Abbreviated pipeline (stages 00, 02, 06 only), MCP image analysis for visual observation, HTML dashboard output
- **Pipeline**: Target acquisition → Visual observation → Recipe synthesis with UMF estimation

### Fix Regenerate Caption Bug (zazzy-spinning-puzzle)
- **Ambition**: SMALL — single variable name bug
- **Scope**: `testData` referenced instead of `allData` in pipeline.html, causing regeneration to silently fail
- **Philosophical Statement**: The regeneration API succeeds but the UI never updates — classic silent failure from wrong variable name

### Schema Restructuring: Separate Glaze ID from Visual Description (zazzy-doodling-wadler)
- **Ambition**: MEDIUM
- **Scope**: Separate technical glaze identification from visual color description in Cerafica vision pipeline
- **Key Decisions**: Add `color_appearance` field separate from `glaze_type` — describe what you SEE, not what glazes you think were used
- **Innovation**: Wrong glaze IDs + correct visual description is MORE useful than wrong glaze IDs alone
- **Notable Quote**: "The wrong glaze IDs + correct visual description would be MORE useful than wrong glaze IDs alone."

### Reels/Stories/Carousel Support (twinkling-popping-rabin)
- **Ambition**: MEDIUM
- **Scope**: MediaType enum, aspect ratio detection, content routing for Instagram
- **Key Decisions**: Vertical videos <90s → Reels, else → feed post; carousel support for multi-image

### Full End-to-End Pipeline Test + Frame Generation (steady-stirring-zebra)
- **Ambition**: LARGE
- **Scope**: Complete Cerafica pipeline test with video frame generation
- **Key Decisions**: Run full pipeline from photo export through frame generation to verify all components work together

### Fix Memory Crash in Video Frame Generator (tidy-drifting-unicorn)
- **Ambition**: MEDIUM
- **Scope**: 100GB+ RAM consumption from numpy arrays in video frame generator
- **Root Cause**: Accumulating frames as full numpy arrays instead of processing and discarding

### Process 6 Videos Through Cerafica Pipeline (toasty-fluttering-lollipop)
- **Ambition**: LARGE
- **Scope**: Batch processing of 6 ceramic videos through the complete pipeline
- **Key Decisions**: Sequential processing with individual verification per video

### Video Frame Extraction for AI Vision Analysis (sunny-questing-adleman)
- **Ambition**: MEDIUM
- **Scope**: Extract representative frames from pottery videos for vision analysis in 4 chunks
- **Key Decisions**: Frame extraction strategy optimized for AI vision model context windows

### Fix Seeds/Ideas Pipeline for Dashboard (tender-bubbling-spark)
- **Ambition**: SMALL
- **Scope**: Fix seeds/ideas data flow to Cerafica dashboard

### Fix Video Footer HUD Missing Stats + Adaptive Typewriter Speed (swift-snacking-squirrel)
- **Ambition**: SMALL
- **Scope**: Video re-HUD footer missing stats display, typewriter speed not adaptive to text length

### Fix Vision Analysis Accuracy Regression (velvety-wobbling-dolphin)
- **Ambition**: LARGE
- **Scope**: Aggressive compression causing detail loss, duplicate exports in vision pipeline
- **Key Decisions**: Optimize compression thresholds, deduplicate export paths

### Detection Improvement for Cerafica Vision (woolly-spinning-aho)
- **Ambition**: MEDIUM
- **Scope**: Improve accuracy of glaze/piece detection in vision analysis pipeline

### Portfolio Redesign to Match Cerafica Visual Identity (toasty-zooming-bear)
- **Ambition**: MEDIUM
- **Scope**: Portfolio redesign matching Cerafica's dark sci-fi visual identity

### Fix Caption Generation Issues (structured-chasing-umbrella)
- **Ambition**: SMALL
- **Scope**: Redundant "glaze" in captions, singular/plural mismatch in generated text

### Frame IMG_4967.MOV as Lazur-ix-4 (transient-finding-plum)
- **Ambition**: MEDIUM — mcp-video evaluation
- **Scope**: Frame a specific ceramic video using mcp-video tools to evaluate their quality

### Zoom Panels in Re-HUD with Sequential Reveal (zesty-discovering-gray)
- **Ambition**: MEDIUM
- **Scope**: Add zoom panel images to re-HUD mode, revealed sequentially like a scanning system
- **Key Decisions**: Extract zoom panels from framed photo (2x), sequential fade-in animation (Panel 0 at 15%, Panel 1 at 35%, Panel 2 at 55% of video)
- **Innovation**: Sequential reveal creates "discovery" narrative — like a scanner finding regions of interest

---

## OPENGLAZE — Additional Plans

### UMF Calculation Engine + Ralph Loop for OpenGlaze (wild-mapping-donut)
- **Ambition**: MASSIVE — full chemistry engine with creative loop
- **Scope**: Real UMF calculations AND a Ralph Loop for iterative glaze recipe improvement
- **Key Decisions**: Combine rigorous chemistry with creative iteration

### Human Door for Glaze Experiments with 6 Visualizations (transient-dreaming-hartmanis)
- **Ambition**: LARGE
- **Scope**: 6 different visualizations for glaze experiment data in Human Door dashboard
- **Key Decisions**: Multiple visualization types for different aspects of glaze chemistry

### Move Chemistry Knowledge to Database + Audit Rules (velvet-sniffing-shell)
- **Ambition**: LARGE
- **Scope**: Move hardcoded glaze chemistry knowledge to database, audit and expand rules
- **Agent Sub-Plan**: steady-stirring-zebra-agent variant contains detailed Glaze Chemistry Rules Audit Report

---

## MCP-VIDEO — Additional Plans

### AgentCut Full Feature Test Plan (starry-tickling-starlight variant)
- **Ambition**: MEDIUM — 17 features, 20 test cases
- **Scope**: Comprehensive testing of all AgentCut/MCP-video features using test videos
- **Test Strategy**: 7 batches (Info/Basic → Transform → Effects → Audio → Conversion → Composite → Subtitles)
- **Notable**: Evidence of thorough dogfooding — testing every tool with real video assets

### Get AAA Score on Glama for mcp-video PR #3637 (typed-coalescing-rain)
- **Ambition**: MEDIUM
- **Scope**: Achieve AAA score on Glama MCP registry for mcp-video PR
- **Key Decisions**: Quality improvements to pass Glama's automated review

### Add Remotion Integration to mcp-video v0.8.0 (virtual-tickling-whisper)
- **Ambition**: LARGE — 8 new tools, 4 phases
- **Scope**: Add Remotion-based video tools to MCP server
- **New Tools**: 8 Remotion tools for programmatic video generation
- **Key Decisions**: Remotion as first-class backend alongside FFmpeg

### mcp-video Explainer Video Holistic Quality Improvements (witty-marinating-mitten)
- **Ambition**: LARGE — 10 priority items
- **Scope**: Visual quality improvements to mcp-video's own explainer video (dogfooding)
- **Key Decisions**: 10 priority items covering visual quality, pacing, design consistency

---

## RESEARCH PIPELINE & STRATEGY — Additional Plans

### AgentPay Research: "Stripe for Agent Transactions" (stateless-cuddling-sutherland)
- **Ambition**: MASSIVE — 512-line competitive landscape analysis
- **Scope**: MCP-native financial API for AI agents — comprehensive market research
- **Key Findings**: Sapiom ($15.75M raised), Google AP2 protocol, Coinbase x402 payment standard, AgentaOS — emerging competitive landscape
- **Market**: AI agent market projected $52-183B by 2030-2033 (40-50% CAGR)
- **Agent Sub-Plans**: abstract-popping-yao agent variants contain deep research on TAM, pricing models, regulation, and reputation systems
- **Philosophical Statement**: Agent payment infrastructure is the next frontier — agents need to transact autonomously

### Research → RE Pipeline Integration Fix (steady-hatching-coecke)
- **Ambition**: SMALL
- **Scope**: Fix integration between research pipeline and reverse engineering pipeline

### Persistent Research Improvement System with RQS Scoring (temporal-chasing-gray)
- **Ambition**: LARGE
- **Scope**: Research Quality Score system inspired by Karpathy's autoresearch
- **Key Decisions**: Experiment logging with IMPROVEMENT-LOG.md, RQS tracking from 77→81
- **Philosophical Statement**: Self-improving research — the research process itself should get better over time

### Phase 1 Deep Research: 15 Product Opportunities (wondrous-imagining-engelbart)
- **Ambition**: MASSIVE
- **Scope**: 15 product opportunities identified across 10+ domains
- **Agent Sub-Plan**: woolly-spinning-aho variant contains 40+ opportunities from Reddit/HN/GitHub mining
- **Key Decisions**: Market signal mining across social platforms, research frontiers, and GitHub trending
- **Philosophical Statement**: "Find white space — tool categories where no clear winner exists"

### Research Skill Creation Plan (velvet-exploring-muffin)
- **Ambition**: LARGE
- **Scope**: Web research skill with quick/deep/comprehensive modes
- **Agent Sub-Plan**: velvet-exploring-muffin agent variant contains full EspanolMCP Wave 3+4 implementation (1216 lines)

### Vision Prompting Best Practices (velvety-wobbling-dolphin agent variant)
- **Ambition**: LARGE
- **Scope**: Research synthesis on vision prompting for maximum detail extraction from multimodal AI models
- **Key Findings**: JSON schema prompting, structured output, domain-specific prompting techniques
- **Notable**: This research directly informed Cerafica's vision analysis pipeline improvements

---

## ESPANOLMCP — Spanish Translation MCP Server

### EspanolMCP Wave 3 & Wave 4 (snug-drifting-ocean)
- **Ambition**: MASSIVE — Waves 3+4 implementation plan
- **Scope**: Fix 8 critical bugs in MCP adapter, implement hardening measures
- **Critical Bugs**: All 16 tool callbacks use wrong signature (params undefined at runtime), only 4 of 16 tools registered, @ts-nocheck hiding type errors, translate_code_comment is a placeholder
- **Wave 3**: Fix callbacks (async ({ params }) → async (params)), extract shared infrastructure, register all 16 tools
- **Wave 4**: Error handling, configuration system, security test suite, documentation
- **Architecture**: Shared provider-factory.ts + types.ts extracted from 3x duplicated code

---

## GOOGLE WORKSPACE — Additional Plans

### Agent Email Identity Architecture (zesty-stargazing-lemon)
- **Ambition**: LARGE — 252 lines
- **Scope**: Dedicated agent email identity (agent@puenteworks.com) with OAuth and send capabilities
- **Key Decisions**: Separate OAuth (not delegation), 4 trust levels (supervised → can-send), rate limiting (5/hr, 20/day)
- **Trust Model**: supervised (replies only, 10 max) → partial (replies auto, 20 max) → autonomous (unlimited) → can-send (after 5 successful)
- **Philosophical Statement**: "Agent needs to send emails on user's behalf — replies, new emails, meeting invites, digest summaries"

### Research-Pipeline GWS Integration (snappy-twirling-wadler)
- **Ambition**: MEDIUM — deferred
- **Scope**: New stage 06-publish pushing research outputs to PARA knowledge base in Google Drive
- **Key Decisions**: DEFERRED — wait for GWS agent's PARA structure to stabilize
- **Philosophical Statement**: Integration should wait until the structure is finalized — don't build on shifting foundations

---

## MINING YOUR GITHUB — Algorithm Sourcing

### Mining Your GitHub for Liminal (swift-knitting-knuth)
- **Ambition**: MASSIVE — 45 repos, 4 tiers, 18 priority items
- **Scope**: Analyze all GitHub repos for algorithms to port into Liminal
- **Key Decisions**: 4-tier priority system (Tier 1: direct port, Tier 2: significant value, Tier 3: pattern extraction, Tier 4: reference)
- **10 Synergy Combinations**: Algorithms that combine powerfully when ported together
- **7-Phase Mining Order**: Dependency-aware execution plan for systematic code mining
- **Philosophical Statement**: Your own past work is the best source of algorithms — mine it systematically

---

## CERAMICS FOUNDATION — Workspace Setup

### Ceramics Foundation Standalone Workspace + Glaze Lab Setup (synchronous-swimming-quasar)
- **Ambition**: MEDIUM
- **Scope**: Standalone workspace for ceramics foundation knowledge + Glaze Lab project setup
- **Key Decisions**: Separate workspace for ceramics domain knowledge, integrated with Glaze Lab

---

## PLANS DISCOVERED IN SESSION 2 — Deep Audit, Strategy & Cross-Project Work

### LIMINAL — Deep Systems Audit & Fixes

### Liminal Deep Audit: Unification, Synergy & Self-Improvement (vast-cooking-hamster)
- **Ambition**: MASSIVE — 6-section deep audit
- **Scope**: Full analysis of Liminal's self-improvement pipeline and system synergies
- **Key Findings**: MAP-Elites is write-only (never used for selection), NoveltyArchive is write-only, AestheticModel predicts but never influences generation, Compost DNA registered but never consumed, Swarm mining disconnected from archive
- **Critical Insight**: Store works but Retrieve-and-Enhance is broken — the closed self-improvement loop is NOT connected
- **21 Prioritized Fixes**: Organized by dependency order across unification, synergy wiring, and self-improvement categories
- **Philosophical Statement**: The system generates valuable data (novelty scores, aesthetic predictions, compost DNA) but never feeds it back into generation decisions

### Liminal Forensic Audit Fix Plan (vivid-shimmying-meadow)
- **Ambition**: MASSIVE — 4 waves of fixes from 38-section forensic audit
- **Scope**: Critical bugs through infrastructure, 98 generated files audited (67% valid, 26 broken)
- **Key Decisions**: Wave-based execution (Critical → High → Medium → Infrastructure)
- **What Shipped**: CodeValidator.ts, test fixes, Vitest migration, CDN centralization

### Liminal Red Team Audit Fix Plan (zippy-gliding-moon)
- **Ambition**: MASSIVE — 8-phase remediation
- **Scope**: 122 source files, 130 test suites — zero suites executing due to ESM/Jest mismatch
- **Key Decisions**: Vitest migration (Jest can't handle ESM), fix CLI compost silent failure, LLM fallback stub removal, type safety (ILLMClient interface)
- **Critical Bugs**: CLI compost command silently fails (missing `await`), CompostMill LLM fallback produces empty results, 34 silent catch blocks, CDN URLs hardcoded in 7 locations
- **Philosophical Statement**: "The entire test suite is broken — 0/130 suites execute"

### RalphLoop Decomposition (virtual-prancing-blanket)
- **Ambition**: LARGE
- **Scope**: Decompose RalphLoop from 1185→150 lines into 8 focused modules
- **New Modules**: LoopConfig, ContextBuilder, PromptEnhancer, GenerationOrchestrator, EvolutionIntegration, LoopPersistence, StagnationDetector, OrganismLoop
- **What Shipped**: Full decomposition completed

### Prompt System Overhaul (wild-stargazing-torvalds)
- **Ambition**: MASSIVE — 24 prompts, 6-wave rewrite
- **Scope**: 8 in PromptLibrary, 7 exported constants, 9 inline prompts — all need structured framework
- **Key Decisions**: Role/Task/Constraints/Format/Examples/Domain-Rules template, domain-specific prompt engineering
- **Innovation**: Structured prompt framework using 2026 best practices replacing ad-hoc prompt strings

### CEO Agents Fix Plan (vivid-cuddling-pillow)
- **Ambition**: LARGE — 6 bugs, 6 tasks
- **Scope**: Multi-agent deliberation system with critical failures
- **Bugs Found**: Unreachable final positions (agents never reach consensus), brittle decision detection, garbage memo fallback, sequential not parallel board execution, truncation not summarization, no API retry
- **Philosophical Statement**: The deliberation system looks like it works but agents never actually reach final consensus positions

---

### LIMINAL — Validation & Infrastructure

### Fix Validation Pipeline + Dogfood (snappy-herding-marshmallow) — FULL TEXT
- **Ambition**: LARGE — full validation gate design
- **Scope**: RalphLoop declares "done" based on regex without testing code actually runs
- **Key Decisions**: CodeValidator.ts — 3 checks (strip reasoning text, structural validation per domain, self-contained check), wired at 3 points (RalphLoop, Exporter, index.ts)
- **3-Check Architecture**: (1) Strip LLM reasoning text with expanded skip patterns, (2) Per-domain structural validation (p5 needs setup/draw/createCanvas, GLSL needs void main, Three needs THREE.*, Remotion needs useCurrentFrame), (3) Self-contained check for HTML-wrapped code
- **Dogfood Plan**: 16 generations across cloud (MiniMax-M2.7) + local (LM Studio), all domains tested
- **Philosophical Statement**: "Liminal's Ralph Loop declares 'done' and saves files based entirely on regex pattern matching. It never validates that generated code actually runs."

### Fix ~60 Failing Unit Tests (starry-enchanting-pony) — FULL TEXT
- **Ambition**: MEDIUM
- **Scope**: 3 root causes — fixtures too small for MIN_SIZE_REQUIREMENTS, generators need LLM mocks, HTMLWrapper expectation change
- **Execution Order**: Enlarge fixtures first (26 tests) → Mock LLM generators (26 tests) → Fix expectations (4 tests)
- **Philosophical Statement**: "Tests are the harness. Fix the tests to match current correct behavior."

---

### MCP-VIDEO — Deep Audit & Expansion

### AgentCut Full Feature Test Plan (starry-tickling-starlight)
- **Ambition**: LARGE — 17 features tested across 7 batches
- **Scope**: Comprehensive testing of all mcp-video tools using real video assets
- **Test Strategy**: 20 test cases across info, trim, transforms, effects, audio, conversion, composite, and subtitles
- **Notable**: Named "AgentCut" — original name before rename to mcp-video

### Remotion Integration for mcp-video v0.8.0 (virtual-tickling-whisper)
- **Ambition**: LARGE — 8 new tools, 4 phases
- **Scope**: Add Remotion-based video generation tools to mcp-video MCP server
- **Key Decisions**: React-based video composition, component rendering, frame extraction, video assembly
- **What Shipped**: 8 Remotion tools integrated into mcp-video

### Get AAA Score on Glama (typed-coalescing-rain)
- **Ambition**: LARGE
- **Scope**: mcp-video PR #3637 — achieve highest quality score on Glama MCP registry
- **Key Decisions**: Quality gate for public presentation of mcp-video

---

### ESPANOL MCP — Spanish Translation MCP Server

### EspanolMCP Wave 3 & Wave 4 Plan (zazzy-spinning-puzzle)
- **Ambition**: MASSIVE — 16 tools fixed + hardening
- **Scope**: Fix critical bugs preventing MCP adapter operation, then harden for production
- **Critical Bugs**: All 16 tools receive `undefined` params (wrong callback signature `async ({ params })` instead of `async (params)`), only 4 of 16 tools registered, `// @ts-nocheck` hiding type errors, `translate_code_comment` is placeholder (marks `[TRANSLATED]` instead of translating)
- **Wave 3**: Fix callback signatures, extract shared types/provider-factory, register all 16 tools
- **Wave 4**: Error handling, configuration system, security tests, documentation
- **Architecture**: Monorepo with 7 packages, @espanol/providers, @espanol/security

### EspanolMCP Wave 3+4 Agent Variant (sprightly-snacking-hopper-agent-*)
- **Ambition**: MASSIVE — 1216-line agent variant with full implementation details
- **Scope**: Same as parent plan but with complete code listings for every file
- **Notable**: Demonstrates parallel agent execution pattern — parent spawns sub-agents with exclusive file ownership

---

### AGENT FINANCIAL INFRASTRUCTURE

### AgentPay Research: Agent Financial Infrastructure (stateless-cuddling-sutherland)
- **Ambition**: MASSIVE — 512-line competitive landscape analysis
- **Scope**: "Stripe for Agent Transactions" — MCP-native financial API for AI agents
- **Key Decisions**: Crypto/blockchain as primary solution for agent payments (KYC barriers in traditional finance), open-source core + hosted convenience model
- **Competitive Landscape**: Sapiom ($15.75M raised), Google AP2, Coinbase x402 protocol, AgentaOS
- **Market Size**: AI agent market $52-183B by 2030-2033, agentic commerce could reach $3-5T by 2030
- **Philosophical Statement**: "The gap between agent capability and financial infrastructure is the biggest opportunity in AI tooling"

### Agent Financial Infrastructure Deep Research (abstract-popping-yao-agent-*)
- **Ambition**: MASSIVE — agent variant with comprehensive research
- **Scope**: 8 research areas — market sizing, pricing models, OSS business models, GTM strategies, licensing, regulatory, reputation systems, model resilience
- **Key Findings**: Crypto/blockchain emerging as primary solution, open source models (Supabase, PostHog) demonstrate viable paths to $70M+ ARR, regulatory uncertainty biggest bottleneck
- **Notable**: Parallel agent research pattern — one research question per agent

---

### CERAFICA — Video Pipeline & Vision

### Reels/Stories/Carousel Support (twinkling-popping-rabin)
- **Ambition**: MEDIUM
- **Scope**: Instagram content type routing — vertical videos <90s become Reels, else feed posts
- **Key Decisions**: MediaType enum, aspect ratio detection, content routing

### Vision Detection Improvement Plan (woolly-spinning-aho)
- **Ambition**: LARGE
- **Scope**: Improve accuracy of ceramic vision analysis pipeline
- **Agent Variant (woolly-spinning-aho-agent-*)**: Vision prompting best practices research synthesis
- **Key Findings**: JSON schema prompting for structured output, explicit field descriptions and constraints improve extraction quality

### Fix Vision Analysis Accuracy Regression (velvety-wobbling-dolphin)
- **Ambition**: MEDIUM
- **Scope**: Aggressive compression causing quality loss, duplicate exports in pipeline
- **Agent Variants (3 agents)**: Each researched different aspects — prompt engineering, compression settings, export deduplication

### Fix Video Footer HUD Missing Stats (swift-snacking-squirrel)
- **Ambition**: SMALL
- **Scope**: Re-HUD mode missing statistics display in footer + adaptive typewriter speed

### Fix Memory Crash in Video Frame Generator (tidy-drifting-unicorn)
- **Ambition**: MEDIUM
- **Scope**: 100GB+ RAM usage from numpy arrays accumulating in memory during frame generation
- **Key Decisions**: Streaming frame processing, memory-mapped arrays, batch-and-discard pattern

### Zoom Panels in Re-HUD Mode (zazzy-doodling-wadler)
- **Ambition**: MEDIUM
- **Scope**: Sequential reveal zoom panels extracted from framed photo, composited onto video frames
- **Innovation**: Scanning-system animation — panels appear one at a time with fade-in, simulating a discovery process
- **Timing**: Panel 0 at 15%, Panel 1 at 35%, Panel 2 at 55% of video duration

### Process 6 Videos Through Pipeline (toasty-fluttering-lollipop)
- **Ambition**: LARGE
- **Scope**: Batch processing of 6 ceramic videos through full Cerafica pipeline

### Portfolio Redesign (toasty-zooming-bear)
- **Ambition**: LARGE
- **Scope**: Portfolio visual identity aligned with Cerafica dark sci-fi aesthetic

### Frame IMG_4967.MOV via mcp-video (transient-finding-plum)
- **Ambition**: MEDIUM
- **Scope**: Evaluate mcp-video tools by framing a ceramic piece video — Lazur-ix-4

### Schema Restructuring: Separate Glaze ID from Visual Description (zesty-stargazing-lemon)
- **Ambition**: MEDIUM
- **Scope**: Split overloaded `glaze_type` field into technical glaze ID + visual `color_appearance` description
- **Key Insight**: "The wrong glaze IDs + correct visual description would be MORE useful than wrong glaze IDs alone"
- **Innovation**: `color_appearance` field using existing color taxonomy (oatmeal, toast, ivory, slate_blue, chun_blue, etc.)

### Fix Regenerate Caption Bug (starry-tickling-starlight — same name, different plan: zesty-discovering-gray)
- **Ambition**: SMALL
- **Scope**: `testData` (undefined) should be `allData` in caption regeneration UI
- **Evidence**: Classic variable naming bug — two similar names, one undefined

### Instagram Glaze #004 RE Pipeline (zippy-gathering-meerkat)
- **Ambition**: MEDIUM
- **Scope**: Run image-based ceramic glaze reverse engineering on newest photo from Mac Photos album
- **Pipeline**: Photo export → Stage 00 (target brief) → Stage 02 (visual observation via MCP image analysis) → Stage 06 (recipe synthesis + UMF estimation) → HTML dashboard

---

### OPENGLAZE — Chemistry & Dashboard

### Glaze Chemistry Rules Audit (steady-stirring-zebra-agent-*)
- **Ambition**: LARGE
- **Scope**: Audit hardcoded glaze chemistry rules against authoritative ceramic sources
- **Methodology**: Each rule evaluated for accuracy against Allan Chemical Corporation, Ceramic Arts Network, manufacturer SDS sheets
- **Notable**: Demonstrates commitment to factual accuracy in ceramic science

### Video Frame Generator for Pottery-as-Rotating-Planets (wondrous-riding-parnas)
- **Ambition**: LARGE
- **Scope**: Generate animated video frames showing ceramic pieces as rotating planets
- **Key Concept**: Each ceramic piece becomes a planet — surface details become terrain, glazes become atmospheres

---

### RESEARCH PIPELINE & ICM

### Persistent Research Improvement System (temporal-chasing-gray)
- **Ambition**: LARGE
- **Scope**: RQS scoring system inspired by Karpathy's autoresearch, experiment logging
- **Key Decisions**: IMPROVEMENT-LOG.md tracking, RQS (Research Quality Score) metric
- **Philosophical Statement**: "The jagged frontier was a measurement error. Evaluation is the skill gaining value, not execution."

### Mining Your GitHub for Liminal (swift-knitting-knuth)
- **Ambition**: MASSIVE — 45 repos analyzed
- **Scope**: Find algorithms and patterns across developer's 45 GitHub repositories to port into Liminal
- **Key Decisions**: 4 tiers (Must-Mine / Should-Mine / Could-Mine / Skip), 10 synergy combinations, 7-phase mining order
- **Philosophical Statement**: Extract patterns from existing work rather than building from scratch

### Deep Research Plan: 15 Product Opportunities (wondrous-imagining-engelbart)
- **Ambition**: MASSIVE — Phase 1 research
- **Scope**: Find 15+ NEW product opportunities across 10+ domains not already covered
- **Agent Variant**: Research across Reddit, Hacker News, GitHub Trending, Indie Hackers, Product Hunt
- **Key Finding**: 40+ opportunities identified, including Reddit Lead Delivery Service, social intent scouting
- **Philosophical Statement**: "Find white space — tool categories where no clear winner exists"

### Research Skill Creation Plan (velvet-exploring-muffin)
- **Ambition**: LARGE
- **Scope**: Create web-research skill with quick/deep/comprehensive modes
- **Agent Variant (velvet-exploring-muffin-agent-*)**: Researches available approaches and designs skill architecture

### PR #2 Inspection Report for ICM (validated-nibbling-floyd)
- **Ambition**: MEDIUM
- **Scope**: Review and merge second PR for ICM research-pipeline workspace
- **Key Decisions**: Merge criteria, quality gate verification

---

### GOOGLE WORKSPACE AGENT

### Agent Email Identity Architecture (zesty-discovering-gray — NOTE: same file as snug-leaping-dragonfly from previous session)
- **Ambition**: LARGE — full OAuth architecture
- **Scope**: Dedicated agent email identity (agent@puenteworks.com) with send capabilities
- **Key Decisions**: Separate OAuth (not delegation), 4 trust levels (supervised → can-send), rate limiting (5 emails/hour, 20/day)
- **Security Model**: Preview mode shows first 3 lines, hourly/daily limits, content screening, audit trail, weekly review
- **Philosophical Statement**: "Agent needs to send emails on user's behalf — reducing cognitive load while automating routine communications"

### Research-Pipeline GWS Integration (snappy-twirling-wadler)
- **Ambition**: LARGE — deferred
- **Scope**: New stage 06-publish pushing research outputs to PARA knowledge base in Google Drive
- **Key Decisions**: DEFERRED — wait for GWS agent's PARA structure to stabilize before integration
- **PARA Mapping**: Reports → Resources/Research/{topic}/, Datasets → Google Sheets, Docs → Google Docs

---

### CROSS-PROJECT & INFRASTRUCTURE

### Atelier Repository Architecture Analysis (sprightly-snacking-hopper-agent-a409810079b223d36)
- **Ambition**: SMALL — blocked
- **Scope**: Analyze architecture of "Pastorsimon1798/atelier" GitHub repo
- **Outcome**: BLOCKED — repository not found. Either wrong name or private repo
- **Notable**: Evidence of the developer's earlier project naming (Atelier → later renamed Liminal)

### Write AUDIT_FULL.md + AUDIT_WORKFLOW.md (transient-juggling-koala / wild-gliding-map)
- **Ambition**: MASSIVE — 38-section audit + 9-phase repeatable workflow
- **Scope**: Complete forensic audit documentation and repeatable audit procedure
- **38 Sections**: Swallowed errors, dead code, stubs, CLI gaps, generator issues, config gaps, LLM robustness, compost integrity, RalphLoop issues, type safety, missing error handling, console.log leaks, race conditions, hardcoded values, TODO/FIXME, missing tests, barrel exports, CI issues, test quality, security, docs gaps, TypeScript config, prompt issues, package.json, gitignore, GitHub presentation, landing page, severity summary, dependency vulnerabilities, git secrets, repo bloat, platform compat, signal handling, disk exhaustion, npm publishability, generator output correctness, GitHub settings, landing page accessibility
- **Severity**: 6 CRITICAL, 12 HIGH, 34 MEDIUM, 14 LOW, 8 GOOD
- **Dependency Vulnerabilities**: 12 CVEs including critical loader-utils prototype pollution
- **Generator Output**: 98 files — 67% valid, 26 broken, P5/Three/GLSL best, ASCII worst at 25%
- **Philosophical Statement**: Standardized audit procedure enables consistent quality across all projects

### Address Remaining Liminal Audit Issues (transient-juggling-koala)
- **Ambition**: MEDIUM — 5 remaining tasks
- **Scope**: Fix remaining issues from forensic audit that weren't covered in earlier waves

### Reset Clean-Branch Working Tree (zany-gliding-mist)
- **Ambition**: SMALL — session recovery
- **Scope**: Session crashed, discard all working tree changes to restore clean state
- **Steps**: Restore deleted files, reset submodule, remove untracked
- **Notable**: Evidence of development chaos — session crashes requiring recovery plans are a recurring pattern

---

## AGENT VARIANT SUB-PLANS (21 files)

These are sub-plans generated by parallel agents spawned from parent plans. They contain detailed implementation code and research that supplements the parent plans:

| Parent Plan | Agent Variant | Content |
|------------|---------------|---------|
| abstract-popping-yao | a1f6045eedbb2c104 | Agent Financial Infrastructure deep research ($52-183B market) |
| abstract-popping-yao | aafaf9b7ca42f8b1b | Agent Financial Infrastructure research variant |
| encapsulated-bouncing-seal | ab0ca85649a | (Sub-task variant) |
| lucky-wobbling-lampson | af70d7008bc9b39e4 | (Sub-task variant) |
| memoized-snacking-locket | a2ba5fe4b2f4cdd96 | (Sub-task variant) |
| parsed-singing-panda | a8c931164d60931b6 | (Sub-task variant) |
| quizzical-squishing-pebble | a06a861df1eb5c97d | (Sub-task variant) |
| serene-splashing-bengio | a3ac68455ba5a086a | (Sub-task variant) |
| snappy-herding-marshmallow | a1105b4b2af388b7a | (Sub-task variant) |
| sprightly-snacking-hopper | a409810079b223d36 | Atelier repo analysis (BLOCKED — repo not found) |
| sprightly-snacking-hopper | a631a9486556533ee | (Sub-task variant) |
| steady-stirring-zebra | a945e8953dbb849ef | Glaze Chemistry Rules Audit Report |
| steady-stirring-zebra | a9a7a8f00da3e88b5 | (Sub-task variant) |
| velvet-exploring-muffin | a3e26967e5f4ae4f6 | EspanolMCP Wave 3+4 full implementation (1216 lines) |
| velvety-wobbling-dolphin | a103de76f28a79a9b | Vision Prompting Best Practices Research |
| velvety-wobbling-dolphin | a3c9a0eaeca371589 | (Sub-task variant) |
| velvety-wobbling-dolphin | a93dee0873289cc8b | (Sub-task variant) |
| woolly-spinning-aho | a7f9efb0076241c4b | Product Opportunity Analysis 2026 (40+ opportunities) |
| woolly-spinning-aho | a879d18ea9a1b88d5 | (Sub-task variant) |
| woolly-spinning-aho | afa4035ec0d8534c9 | (Sub-task variant) |
| zany-gliding-mist | a04f3aedc5eb3153d | (Sub-task variant) |

---

## PATTERN ANALYSIS

### Recurring Themes Across All Plans

1. **"Wire everything up end-to-end"** — The single most repeated principle. No stubs, no "not yet implemented."

2. **Triple redundancy pattern** — Liminal has THREE of everything (collaboration systems, prompt systems, scoring systems, fragment types, config systems). This is both a strength (diversity) and a weakness (maintenance).

3. **"If something breaks, STOP"** — Anti-silent-fallback principle from Cerafica pipeline. No silent fallbacks that produce wrong output.

4. **Dogfood everything** — mcp-video must use its own tools to render its own explainer video. Liminal must validate its own generated code.

5. **Self-improving systems** — Experiments, RQS scoring, pattern extraction, symbolic language — the developer is obsessed with systems that improve themselves.

6. **Open source first** — Glaze Lab, Maker Pipeline, jCodeMunch/jDocMunch — extract patterns into reusable open-source tools.

7. **The gap is shipping, not knowing** — Repeated in the career transition plan. "Not a tutorial. Not learning more skills."

### Ambition Distribution
- MASSIVE: ~30 plans (multi-week, multi-wave efforts)
- LARGE: ~65 plans (significant features, system redesigns)
- MEDIUM: ~75 plans (features, bug fixes with analysis)
- SMALL: ~80 plans (quick fixes, config changes, commits)

### Project Coverage
- Liminal: ~55 plans (largest project — includes deep audits, prompt system, decomposition)
- mcp-video: ~30 plans (includes AgentCut tests, Remotion integration, Glama score)
- Cerafica/Instagram: ~50 plans (vision pipeline, video framing, RE pipeline, caption fixes)
- OpenGlaze/Glaze Lab: ~30 plans (UMF engine, chemistry audit, dashboard redesigns)
- ICM/Research Pipeline: ~20 plans (RQS scoring, product research, skill creation)
- Hooks/Infrastructure: ~15 plans
- Google Workspace Agent: ~7 plans
- EspanolMCP: ~3 plans (new project — Spanish translation MCP server)
- Agent Financial Infrastructure: ~3 plans (AgentPay research — new research area)
- Hydra Creative Agent: ~2 plans
- TradesFlow: ~3 plans
- Career/Personal: ~5 plans
- GitHub Mining: ~2 plans (algorithm sourcing from 45 repos)
- Other/research: ~35 plans
- Agent Variant Sub-Plans: 21 files (parallel agent research outputs)

---

## QUOTE BANK

> "We gather everything first, then split into posts once we see the full picture." — Liminal Archaeology plan

> "The name is a creative decision INFORMED by the taxonomy and analysis — there is no automated naming algorithm." — Process New Piece pipeline

> "If something breaks, STOP. No silent fallbacks that produce wrong output." — Pipeline Architecture fix

> "3.5 hours/week → 2 minutes/week" — Full Instagram Automation

> "Liminal's Ralph Loop declares 'done' and saves files based entirely on regex pattern matching. It never validates that generated code actually runs." — Validation Pipeline fix

> "The gap isn't skills or ideas — it's packaging finished work as portfolio and getting it in front of people." — Creative Technologist plan

> "Not a tutorial (you know enough). Not a job hunt yet (portfolio first, then apply). Not learning more skills (the gap is shipping, not knowing)." — Career plan

> "The jagged frontier was a measurement error. Evaluation is the skill gaining value, not execution." — Build New MWP Workspace

> "PreToolUse is the only hook that can block actions (exit 2). CLAUDE.md instructions serve as the first line of defense." — MCP Enforcement plan

> "Liminal has three independent collaboration/generation systems that overlap significantly. All three try to improve generation quality through multi-agent collaboration, but share zero code." — Architecture Audit

> "These are mutually exclusive and collectively exhaustive for creative output quality." — Swarm Persona Redesign

> "Profitable at 20 customers" — OpenGlaze GTM

> "The simulation prompt references UMF analysis, oxide interactions, and thermal expansion — but none of these are actually calculated." — UMF Calculation Engine

> "The ICM methodology treats workspaces as 'independent agents' with their own CLAUDE.md. Currently, they all share ONE git history, which violates the independence principle." — Git Architecture plan

> "Find white space — tool categories where no clear winner exists, the problem is real, and a well-executed open source tool could go viral." — AI Agent Tools research

> "Never fix broken output programmatically — update the harness." — AGENTS.md principle, cited in test fix plan

> "God Object: engine.py (3,249 lines) handles ALL core FFmpeg operations." — Red Team Audit

> "Dominant_colors always returns [] — stub that never works. Smoothness param accepted but never used." — Dead code audit

> "The entire test suite is broken — 0/130 suites execute." — Red Team Audit Fix

> "The wrong glaze IDs + correct visual description would be MORE useful than wrong glaze IDs alone." — Schema Restructuring plan

> "The gap between agent capability and financial infrastructure is the biggest opportunity in AI tooling." — AgentPay Research

> "Your own past work is the best source of algorithms — mine it systematically." — Mining Your GitHub plan

> "Agent needs to send emails on user's behalf — replies, new emails, meeting invites, digest summaries." — Agent Email Architecture

> "Integration should wait until the structure is finalized — don't build on shifting foundations." — GWS Integration deferral

> "The system generates valuable data (novelty scores, aesthetic predictions, compost DNA) but never feeds it back into generation decisions." — Liminal Deep Audit

> "The deliberation system looks like it works but agents never actually reach final consensus positions." — CEO Agents Fix

> "Self-improving research — the research process itself should get better over time." — Persistent Research Improvement
