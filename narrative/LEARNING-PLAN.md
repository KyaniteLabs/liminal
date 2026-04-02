# Accelerated Learning Plan: Software Engineering for AI-Native Builders

**For:** Simon Gonzalez De Cruz — creative technologist, first code September 2025, 104K LOC built with AI
**Based on:** 12 diagnosed knowledge gaps from 32-day telemetry analysis
**Method:** Build something real → wire it end-to-end → teach the agent via hooks
**Duration:** 8-10 weeks, one phase at a time, burst-compatible

---

## How Simon Learns (from telemetry data)

1. **By wiring, not by building** — the act of connecting things end-to-end IS the learning. Each wiring failure produces a hook.
2. **By switching domains** — ceramics warms up, code bursts, business cools down. Each domain brings a different lens.
3. **By teaching agents** — every prompt, hook, and memory file is a crystallized lesson. The act of articulating constraints IS learning.
4. **By verification** — 52% of messages are execution/verification. Understanding comes from checking, not creating.
5. **At burst velocity** — binge patterns, not steady rhythm. Design for 6-hour deep sessions, not daily 1-hour practice.
6. **Through ICM** — the Interpreted-Context-Methodology was the shipping unlock. Structure context so agents can execute.

---

## Phase 1: Vocabulary of Integration (1-2 weeks)

**Target gap:** #1 Wiring problem (22 mentions, 3 hooks, most-changed files)
**Learning style:** Wire something real, crystallize into a hook

**Study:**
- Dependency injection: what it means, why it matters, how to do it in TypeScript
- Module boundaries: public API vs. internal implementation
- Interface contracts: defining what a module exports and what it imports
- The dependency graph: visualizing how modules connect

**Exercise:**
1. Map Liminal's actual dependency graph — which module imports from which
2. Rewrite the `wiring-checklist.js` hook using precise SE vocabulary:
   - "Verify all exports from new module are imported by at least one consumer"
   - "Verify all imports in new module resolve to existing exports"
   - "Verify constructor parameters match registered dependencies"
3. Run the hook against the current codebase. Find unwired modules.

**Deliverable:** A dependency graph of Liminal + updated wiring hook using precise SE terms.

---

## Phase 2: Specification Writing for AI Direction (1-2 weeks)

**Target gap:** #5 Precise instruction (every multi-turn session) + #12 Prompt engineering (27 unaudited prompts)
**Learning style:** Write specs, see agents execute, verify output

**Study:**
- Given/When/Then specifications (from BDD/TDD)
- Structured prompt engineering: Role → Task → Constraints → Output Format → Examples
- The art of decomposition: breaking "make it beautiful" into 10 testable requirements

**Exercise:**
1. Pick 5 prompts from the PromptLibrary
2. For each, decompose the vision into a structured specification:
   ```
   Given: [input state]
   When: [action]
   Then: [expected output]
   Constraints: [what must be true]
   Anti-patterns: [what must NOT happen]
   ```
3. Run both versions (original + structured) and compare output quality

**Deliverable:** 5 rewritten PromptLibrary templates with measurable quality improvements.

---

## Phase 3: Debugging Methodology (1 week)

**Target gap:** #6 Root cause analysis ("refactor" appears 2 times in 1,148 messages)
**Learning style:** Fix a real bug systematically, document the process

**Study:**
- Binary search debugging: bisect the problem space
- Layer isolation: generation → extraction → wrapping → rendering → display
- The 5 Whys technique applied to software failures
- Systematic vs. random debugging

**Exercise:**
1. Take the Dogfood Gap (20% success rate) and decompose it:
   - Is the LLM generating valid code? (Check: parse rate)
   - Is the code extraction clean? (Check: no reasoning text in output)
   - Is the HTML wrapper correct? (Check: renders in browser)
   - Is the rendering pipeline working? (Check: no CORS/iframe issues)
   - Is the scorer accurate? (Check: score correlates with visual quality)
2. For each layer, write a single test that verifies correctness
3. Document which layer(s) are actually broken

**Deliverable:** Systematic diagnosis of the Dogfood Gap with per-layer test results.

---

## Phase 4: Test Design and Verification (1-2 weeks)

**Target gap:** #11 Test value (92% coverage, broken system) + #2 Quality verification (regex vs. execution)
**Learning style:** Write tests that catch real failures

**Study:**
- Behavioral testing vs. structural testing
- The testing pyramid: unit → integration → end-to-end
- Execution-based verification: running the code, not just checking it exists
- Property-based testing: what should ALWAYS be true about creative output

**Exercise:**
1. Replace the CreativeEvaluator's regex scoring with execution-based evaluation:
   - Render generated p5.js in a headless browser (Puppeteer)
   - Capture a screenshot
   - Check that the canvas is not blank (pixel analysis)
   - Check that it contains color (not just black/white)
   - Check that something is animated (compare frames)
2. Run the new evaluator against 50 generated sketches
3. Compare results with the old regex scorer

**Deliverable:** Working execution-based quality gate for p5.js output.

---

## Phase 5: DevOps Fundamentals (1 week)

**Target gap:** #7 CI/CD (removed workflows) + #10 Git (branch chaos)
**Learning style:** Set up real infrastructure

**Study:**
- CI/CD pipelines: what each step does and why
- GitHub Actions: workflow syntax, secrets, matrix builds
- Git branching strategies: trunk-based, feature branches, release branches
- Environment management: dev, staging, production

**Exercise:**
1. Restore the CI/CD workflows removed on March 19
2. Add: lint step, type-check step, test step, build step
3. Configure GitHub secrets for API keys
4. Set up branch protection on main
5. Document why each step exists

**Deliverable:** Working CI/CD pipeline with documentation of each step's purpose.

---

## Phase 6: Caching, State & Performance (1 week)

**Target gap:** #3 Caching (RalphLoop defeated by cache hits)
**Learning style:** Fix a real caching bug, understand why it happened

**Study:**
- Cache invalidation strategies: time-based, version-based, content-hash-based
- LLM response caching: when it helps, when it hurts
- State management patterns: immutable state, event sourcing
- "There are only two hard problems in CS: naming and cache invalidation"

**Exercise:**
1. Audit all cache usage in Liminal (LLMClient, ParsingCache, CompostSeed)
2. Fix the RalphLoop cache defeat:
   - Include iteration number in cache key
   - Include previous output hash in cache key
   - Verify each iteration produces genuinely different output
3. Add cache-aware tests

**Deliverable:** Cache-aware RalphLoop that guarantees unique iterations.

---

## Phase 7: Architecture and DRY (ongoing)

**Target gap:** #8 Abstraction (triple redundancy) + #4 Context management (session continuity)
**Learning style:** Audit, consolidate, document

**Study:**
- DRY principle and when to violate it
- Abstraction layers: when to add, when to remove
- Interface design: defining contracts between modules
- Architectural decision records: why decisions were made

**Exercise:**
1. Run an architectural audit of Liminal:
   - Map all modules and their dependencies
   - Identify remaining redundancy (similar patterns in different modules)
   - Identify missing abstractions (shared code that should be extracted)
2. Create an architectural map showing module boundaries
3. Write ADRs for the top 5 architectural decisions

**Deliverable:** Architectural map of Liminal with module boundaries and dependency graph.

---

## Phase 8: Context Management & Precision Instruction (NEW — 1 week)

**Target gap:** #4 Context management (context dump files, compaction events, session re-statements)
**Based on:** `narrative/data/context-management-analysis.json` — full telemetry mining of context skills
**Learning style:** Study your own trajectory, then practice the next level

### What the Data Shows

Your context management improved in three non-linear phases:

| Phase | Eras | Messages/Commit | What Happened |
|-------|------|-----------------|---------------|
| Context Chaos | 1-3 | 3.86 → 9.90 | Treated context as the AI's job. 208 "context" mentions. Built first hooks reactively. |
| Hypercorrection | 4-5 | 9.90 → 8.92 | Overcompensated — 80 micromanagement msgs vs 21 trust msgs (3.8:1). Fragmented sessions. |
| Delegation Mastery | 7-9 | 0.85 → 1.53 | Learned to need LESS context. 5-word instructions producing 13-file features. Near-zero context loss. |

**The Key Insight:** You improved NOT by managing context better, but by learning to NEED less of it. The shift from "tell the AI everything" to "describe what you want precisely and trust execution" is the hallmark of experienced AI collaborators.

### What You're Already Good At

- **Infrastructure-based context persistence** — hooks, memory files, plans. This is your primary strategy and it works.
- **Session continuity** — context-dump.js + session-restore.js eliminated context loss by Era 7
- **Meta-cognition** — 135 meta-cognitive messages. You actively recognize and name patterns (the hook system IS this)

### What to Practice Next

**Study:**
- Precision instruction writing: how to say more with fewer words
- The "intent signal-to-noise ratio" — every word in your prompt should carry unique information
- Task decomposition vs. context dumping — when to split tasks vs. when to provide background
- The "trust but verify" pattern — give clear intent, then check output, not process

**Exercise:**
1. Take 10 of your longest messages from the human-messages.json (by character count)
2. Rewrite each to be ≤50% of original length while preserving intent
3. Run both versions through Claude Code on the same task
4. Compare output quality — if the shorter version produces equal or better results, you've found wasted context
5. Track your messages/commit ratio over your next project — target ≤2.0

**Deliverable:** 10 before/after prompt pairs with output quality comparison.

---

## Tool Bloat Audit (from context-management-analysis.json)

### Core Tools (KEEP — actively used)
| Tool | Evidence | Why It's Core |
|------|----------|---------------|
| Hooks system | 26 hooks, 9 still active | Primary meta-cognitive instrument |
| Plan files | 249 plans across 71 sessions | Context management before execution |
| Memory files | 5 files, heavily referenced | Persistent cross-session memory |
| Context dumps | 109 messages, session-restore hook | Session continuity (costly but works) |
| Compost Mill | 21 files, active | Niche but useful for creative workflows |

### Likely Bloat (AUDIT → likely remove)
| Tool | Files | Why It's Bloat |
|------|-------|----------------|
| Triple collab systems | 18+ files | 3 overlapping agent coordination systems |
| Triple scoring engines | ? files | CreativeEvaluator active, others may be redundant |
| Triple prompt systems | 19+ files | PromptStore + PromptLibrary + ContextBuilder from different eras |
| Triple memory stores | ? files | HarnessMemory active, art memories may not be exercised |
| Multiple generator bases | 22 files | TierBasedGenerator + BaseGenerator + Generator |
| Multiple UI systems | 7 files | gui/ + gallery/ + ui/ when TUI is primary |
| 13 tiny modules | ≤3 files each | Some legitimate (constants), some stubs (learning, improvement) |

**Recommendation:** Before adding ANY new module, audit whether an existing one already solves the problem. The triple-redundancy pattern (3 of everything) is your #1 architectural smell.

---

## What This Plan Does NOT Cover

The ML-specific learning plan is in `narrative/ML-LEARNING-PLAN.md`. It covers:
- LLM fundamentals (tokenization, sampling, temperature, context windows)
- Evaluation metrics (CLIPScore, FID, execution-based testing)
- Embeddings and RAG (vector databases, semantic retrieval)
- RLHF and alignment (reward model design)
- Quality-diversity optimization and ensemble methods

---

## Tracking Progress

Each phase produces a commit-able deliverable. Use the existing hook system:
- `wiring-checklist.js` fires after each phase to verify integration
- `review-checklist.js` fires after edits to catch stubs and TODOs
- Create a new hook `learning-phase-check.js` that verifies each phase's deliverable exists

The plan is designed for Simon's natural rhythm: burst through a phase in 1-3 deep sessions, switch domains for cool-down, return with fresh perspective. Each phase is independent — they can be done in any order, though the recommended sequence maximizes compounding knowledge.

---

## Cross-Repo Archaeology Findings (from 7,059 commits, 50 repos)

**Source:** `narrative/data/cross-repo-analysis.json`, `narrative/data/model-adoption-analysis.json`

Your full GitHub history (not just Liminal) reveals a broader pattern:

| Metric | Value |
|--------|-------|
| Total commits | 7,059 across 50 repos |
| Peak month | March 2026 (1,396 commits, 19 repos) |
| Explosion point | November 2025 (979 commits, 25 repos — up from 187/6 in October) |
| Primary language shift | "none" (curated lists) → TypeScript (Nov 2025) |
| Nocturnal ratio (all repos) | Strong evening/early-morning pattern (04:00 and 16:00 peaks) |
| Most productive day | Friday (1,198 commits) |
| Top repo by commits | awesome-mcp-servers (4,649 commits — curated content, not code) |

**The November 2025 inflection:** Your local-first shift (Ollama + LM Studio) removed the API cost barrier. In the same month you also adopted Qwen and OpenRouter. Repo count went from 6 to 25. This wasn't just trying more tools — it was the beginning of understanding that different models have different strengths.

**Model adoption lag:** You adopt actively-researched tools within 0-3 months of release (vs 6-12 month industry average). MiniMax-M2.7 was adopted in the same month. GLM-5 within 1 month.

---

*Sources: GAP-ANALYSIS.md (12 diagnosed gaps), DEVELOPER-PROFILE.md (6 learning patterns), telemetry-sessions.json (1,148 messages), telemetry-git.json (303 commits), github-commits.csv (7,059 commits), github-repos.csv (50 repos), model-adoption-analysis.json, token-efficiency-plan.md.*
