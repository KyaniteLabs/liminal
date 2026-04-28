# Adversarial Review & Improvement Roadmap

**Source:** 6-agent adversarial analysis against 1,703 commits, 1,148 messages, 58 sessions, full source code
**Date:** April 12, 2026
**Purpose:** Actionable findings to feed back into Liminal's development
**Companion:** Full analysis in `dev-archaeology` repo → `ADVERSARIAL-ANALYSIS.md`

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [What's Working — Keep Doing This](#whats-working--keep-doing-this)
3. [What's Broken — Fix Now](#whats-broken--fix-now)
4. [What's Hidden — Patterns You're Not Aware Of](#whats-hidden--patterns-youre-not-aware-of)
5. [Scoring Architecture: 4 Remaining Dead Zones](#scoring-architecture-4-remaining-dead-zones)
6. [4-Tier Improvement Roadmap](#4-tier-improvement-roadmap)
7. [New Guardrail Specifications](#new-guardrail-specifications)
8. [Code Decomposition Targets](#code-decomposition-targets)

---

## Executive Summary

Six specialized agents independently analyzed Liminal from adversarial perspectives. They converged on three root causes:

| Root Cause | Impact | Fix |
|------------|--------|-----|
| **Architecture without understanding** | Correct patterns built intuitively, maintained reactively | Decompose monoliths, add integration tests |
| **Scoring without execution** | Quality assessed by text analysis, not behavioral verification | Split evaluators, add render-based signals |
| **Process without specification** | Vision-driven development without atomic requirements | New guardrails enforcing spec completeness |

**The paradox:** Liminal's greatest strength (AI-native velocity at 26-52x normal) is also its greatest risk (errors propagate at the same speed). The fix isn't "learn CS" — it's **build verification systems that catch what intuition misses.**

---

## What's Working — Keep Doing This

These patterns are genuine strengths. Don't change them.

### 7 Confirmed Good Patterns

| Pattern | Evidence | Why It Works |
|---------|----------|-------------|
| **Modular domain architecture** | `src/domains/` with consistent generator + evaluator | Each domain evolves independently. Adding domain 10 won't touch domain 1. |
| **Result type error handling** | `src/core/Result.ts` — Railway-Oriented Programming | Errors are explicit values, not thrown exceptions. Forces handling at every boundary. |
| **EventBus decoupling** | `src/core/EventBus.ts` | Agents communicate without tight coupling. New subscribers don't change publishers. |
| **"Surface Everything" methodology** | Era 13: 103 commits exposing hidden failures | Systematic debugging by making all state visible. Novel and effective. |
| **Frustration-to-automation pipeline** | 26 enforcement hooks from 5 frustration cycles | Every recurring pain becomes permanent prevention. Compounding returns. |
| **Guardrail system** | 24 files across 7 categories in `src/guardrails/` | Compliance, correctness, evolution, hygiene, observation, remediation, validation. Layered defense. |
| **Formally correct ML reinvention** | MAP-Elites, Thompson Sampling, ensemble voting | Built without knowing the names, but the architectures are correct. Intuition is real. |

### What "Correct Reinvention" Means

The CompostMill is not exactly a VAE (0 exact matches in audit), but it captures the same architectural insight: encode → latent space → sample. The archive stores compressed representations of successful outputs. New generations draw from this archive. The evaluation loop feeds back into the archive. This IS evolutionary computation, just with agricultural names instead of academic ones.

**Don't rename these.** The vocabulary is part of the system's identity. But do formalize the algorithms so the implementations match the intuition.

---

## What's Broken — Fix Now

### 6 Critical Findings

#### 1. RalphLoop: 13 Levels of Nesting

**File:** `src/core/RalphLoop.ts` — touched 41 times (most-changed file)

**Problem:** The core iteration engine has 13 levels of nesting. This makes it:
- Unreadable — no human can hold 13 context levels
- Untestable — you can't unit test a function that does 13 things
- Unmaintainable — every change risks breaking 12 other things

**Fix:** Decompose into max 4 levels. Extract:
- `IterationStrategy` — decides what to change between iterations
- `QualityGate` — decides when to stop
- `OutputSelector` — picks the best output from the iteration history
- `IterationContext` — carries state between levels

**Effort:** 2-3 days
**Impact:** Unblocks testing, debugging, and future improvements to the core loop

---

#### 2. CreativeEvaluator: 1,597-Line Monolith

**File:** `src/core/CreativeEvaluator.ts` — scores all 9 domains in one file

**Problem:** One file scoring p5.js, Three.js, GLSL, Strudel, Hydra, Tone.js, Revideo, HTML, and ASCII art. Each domain has different quality criteria, but they share one scoring function with domain-specific branches.

**Fix:** Split into domain modules (~180 lines each):
```
src/evaluators/
  p5Evaluator.ts
  threejsEvaluator.ts
  glslEvaluator.ts
  strudelEvaluator.ts
  hydraEvaluator.ts
  tonejsEvaluator.ts
  revideoEvaluator.ts
  htmlEvaluator.ts
  asciiEvaluator.ts
  EvaluatorRegistry.ts  // shared interface
```

**Effort:** 3 days
**Impact:** Each domain can evolve its scoring independently. Fixes 4 remaining dead zones.

---

#### 3. Test Coverage Measures Structure, Not Behavior

**Problem:** 92% coverage with a fundamentally broken system. Tests verify `function setup exists` but not `function setup produces a canvas of the correct size`. The coverage ratchet enforces quantity, not quality.

**Evidence:** Three different prompts produced identical output with passing tests. The quality gate was inverted — tests passed while core logic was backwards.

**Fix:** Add behavioral test tier:
- **Unit tests** — verify individual functions return correct values (current state)
- **Behavioral tests** — verify modules produce correct outputs for given inputs (MISSING)
- **Integration tests** — verify modules work together end-to-end (MISSING)
- **Dogfood tests** — verify actual creative output quality (MISSING)

The `test-quality-check.mjs` already enforces assertion quality. Extend it to require at least 1 behavioral test per `src/` file.

**Effort:** Ongoing — add behavioral tests alongside every new feature
**Impact:** Prevents 0.68 dead zones. Catches quality gate inversions.

---

#### 4. Triple Redundancy in Core Systems

**Three collaboration systems:**
- `src/swarm/SwarmOrchestrator.ts` (928 lines)
- `src/swarm/DeepCollaboration.ts`
- `src/swarm/CollaborativeClient.ts`

**Three scoring systems:**
- `src/core/CreativeEvaluator.ts` (1,597 lines)
- Quick score functions in various generators
- `src/core/HeuristicScorer.ts`

**Three prompt systems:**
- `src/prompts/PromptLibrary.ts`
- `src/prompts/PromptLibraryBridge.ts`
- Hardcoded prompts in generators

**Fix:** Consolidate each trio into one system with a shared interface:
- One collaboration system with pluggable strategies (swarm, deep, simple)
- One scoring pipeline with pluggable evaluators (per-domain)
- One prompt system with template inheritance

**Effort:** 3-5 days
**Impact:** Eliminates divergent behavior. Reduces maintenance surface by ~60%.

---

#### 5. LLMClient: 1,368-Line God Object

**File:** `src/llm/LLMClient.ts` — touched 28 times (3rd most-changed file)

**Problem:** Manages ALL LLM interactions in one file: routing, retry, caching, streaming, tool calls, error handling. This is a god object — it knows too much and does too much.

**Fix:** Split by responsibility:
```
src/llm/
  LLMRouter.ts        // model selection and routing
  LLMRetry.ts         // retry logic with backoff
  LLMCache.ts         // response caching
  LLMStream.ts        // streaming responses
  LLMToolCall.ts      // tool/function calling
  LLMClient.ts        // thin orchestrator using the above
```

**Effort:** 2-3 days
**Impact:** Each concern can be tested and improved independently. Unblocks LLM provider improvements.

---

#### 6. No Performance Testing

**Problem:** Zero benchmarks. Zero profiling. Unknown performance envelope. The 1,597-line CreativeEvaluator runs on every RalphLoop iteration. The 928-line SwarmOrchestrator activates multiple LLM calls per generation. No one knows how fast or slow any of this is.

**Fix:** Add benchmark suite:
```
test/benchmarks/
  ralphLoop.bench.ts       // iterations per second
  evaluator.bench.ts       // scoring time per domain
  swarm.bench.ts           // overhead per agent
  endToEnd.bench.ts        // prompt → output latency
```

Use Vitest's `bench` mode or a dedicated benchmarking tool.

**Effort:** 2 days to set up, ongoing to maintain
**Impact:** Establishes performance envelope. Enables data-driven optimization.

---

## What's Hidden — Patterns You're Not Aware Of

These patterns emerged from the telemetry analysis. They're invisible in day-to-day work but shape the system's trajectory.

### 1. Fix Precedes Feature (87% of Sessions)

In 87% of sessions, the first action is a fix to previous work, not new feature development. This isn't a flaw — it's a verification cycle. You're checking that yesterday's work still works before building on top.

**Codify it:** Add a `session-start-verify` pattern to the Meta-Harness. Before generating new code, run the existing tests for the files you're about to modify.

### 2. Complexity Ceiling at ~200 Commits/Day

| Date | Commits | Type | Followed By |
|------|---------|------|-------------|
| Apr 9 | 207 | Building | Era 12 quality phase |
| Apr 8 | 182 | Building | Continued building |
| Apr 12 | 103 | Quality surfacing | — |

Above 200 commits/day, quality drops. 150 is sustainable. 103 (Era 13) was a deliberate quality-focused downshift.

**Plan around it:** Don't schedule 200+ commit days back-to-back. The build-quality oscillation is healthy — don't flatten it.

### 3. "Other" Commits (30%) Are Tool Transitions

492 commits (28.9%) are categorized as "other." These aren't random — they're tool transitions: switching between Claude Code, Cursor, Codex, and Liminal itself. Each tool switch incurs context rebuilding overhead.

**Optimize it:** Batch work by tool. Don't switch between Claude and Cursor mid-feature. Finish the feature in one tool, then switch.

### 4. Era Naming Tracks Psychological State

```
Seed → Explosion → Consolidation → Multimedia → Dogfood → Bible →
Harness → Refactor → Acceleration → Optimization → Threshold → Surface
```

The naming reveals the emotional arc: excitement → chaos → order → expansion → reckoning → documentation → control → cleanup → speed → polish → transition → revelation.

**Implication:** Development is psychologically driven, not schedule-driven. The system should anticipate emotional state transitions. When the developer enters "reckoning" mode, the system should prepare for honest evaluation.

### 5. The Build-Quality Oscillation Is Healthy

```
Era 8 (Refactor): 23% fix rate
Era 9 (Acceleration): 14% fix rate
Era 12 (Threshold): 35% fix rate
Era 13 (Surface): quality surfacing
```

The oscillation between building and quality is the system breathing. Don't try to maintain constant velocity. Plan for alternating build sprints and quality sprints.

---

## Scoring Architecture: 4 Remaining Dead Zones

Era 13 fixed 5 evaluators (ASCII, Strudel, Three.js, Tone.js, HTML). But the fundamental architecture — discrete bonuses creating attractor basins — remains.

### The Dead Zones

| Dead Zone | Score | Cause | Example |
|-----------|-------|-------|---------|
| **"Complete but Boring"** | ~0.50 | Code is structurally complete but produces no visual interest | p5.js sketch with setup/draw but static output |
| **"Animation Only"** | ~0.66 | Animation present but no compositional depth | Spinning cube with no lighting, texture, or scene |
| **"Maximum Checklist"** | 1.00 | Every scoring box checked but output is generic | Correct p5.js that looks like a tutorial example |
| **"Domain Blind Spots"** | Variable | Evaluator doesn't understand domain quality | Strudel code that compiles but isn't musically interesting |

### Root Cause: Discrete Bonuses

Current scoring uses discrete bonuses: "+0.1 if has setup(), +0.1 if has draw(), +0.1 if has animation." This creates **attractor basins** — score values that many different outputs converge on.

The 0.68 dead zone was the most visible (7 standard bonuses = 0.68). But the same mechanism creates all four dead zones above.

### The Fix: Continuous Metrics

Replace discrete bonuses with continuous measurements:

| Current (Discrete) | Proposed (Continuous) |
|--------------------|-----------------------|
| +0.1 if has animation | animation_complexity = animated_properties × temporal_variation |
| +0.1 if has 3D | spatial_complexity = vertex_count × transform_variety |
| +0.1 if has color | color_richness = unique_hues × saturation_spread |
| +0.1 if interactive | interaction_depth = event_handlers × state_transitions |

### Scoring Architecture Evolution

```
Phase 1 (Current):     Discrete bonuses → attractor basins
Phase 2 (Split):       9 domain evaluators, still discrete
Phase 3 (Continuous):  Continuous metrics replace discrete bonuses
Phase 4 (Render):      Execute code, measure visual/audio output directly
Phase 5 (Calibrated):  Platt scaling maps raw scores to human-judgment probability
```

**Target Phase 2 this month. Phase 3 next month. Phase 4-5 as research projects.**

---

## 4-Tier Improvement Roadmap

### Tier 0: Survival (This Week)

| # | Action | Why | Effort | Files |
|---|--------|-----|--------|-------|
| 1 | Verify CompostMill archive retrieval works | If retrieval is broken, evolution is random not guided | 1 day | `src/core/CompostMill.ts` |
| 2 | Add RalphLoop integration test | Most-changed file has no end-to-end test | 1 day | `src/core/RalphLoop.ts` |
| 3 | Start RalphLoop decomposition | 13 levels → max 4 | 2 days | `src/core/RalphLoop.ts` |
| 4 | Add `binary-search-debug` guardrail | Force layer decomposition before fixes | 0.5 day | `src/guardrails/correctness/` |

### Tier 1: Quality (Weeks 2-3)

| # | Action | Why | Effort | Files |
|---|--------|-----|--------|-------|
| 5 | Split CreativeEvaluator into 9 domain modules | 1,597-line monolith → 9 × ~180 lines | 3 days | `src/core/CreativeEvaluator.ts` → `src/evaluators/` |
| 6 | Consolidate triple redundancy (collaboration) | Three systems → one with pluggable strategies | 2 days | `src/swarm/` |
| 7 | Consolidate triple redundancy (scoring) | Three scoring systems → one pipeline | 2 days | `src/core/` |
| 8 | Add `execution-verification-gate` guardrail | No module without integration test | 1 day | `src/guardrails/correctness/` |
| 9 | Add `spec-completeness-check` guardrail | Require input/output/constraints/criteria before work | 1 day | `src/guardrails/correctness/` |

### Tier 2: Velocity (Weeks 4-6)

| # | Action | Why | Effort | Files |
|---|--------|-----|--------|-------|
| 10 | Split LLMClient god object | 1,368 lines → 6 focused modules | 3 days | `src/llm/LLMClient.ts` → `src/llm/` |
| 11 | Replace discrete bonuses with continuous metrics | Eliminates attractor basins | 3 days | `src/evaluators/` (post-split) |
| 12 | Add behavioral test suite | Test actual output, not just structure | 3 days | `test/behavioral/` |
| 13 | Add benchmark suite | Establish performance envelope | 2 days | `test/benchmarks/` |

### Tier 3: Intelligence (Weeks 7-12)

| # | Action | Why | Effort | Files |
|---|--------|-----|--------|-------|
| 14 | Formalize Thompson Sampling | Proper Beta distribution updates | 2 days | `src/intuition/ThompsonSampler.ts` |
| 15 | Render-and-score pipeline | Execute generated code, measure visual output | 5 days | New: `src/evaluators/render/` |
| 16 | Domain-adaptive scoring | Per-domain quality models | 3 days | `src/evaluators/` (post-split) |
| 17 | Multi-dimensional Pareto scoring | (novelty, quality, complexity) triple | 3 days | `src/core/` |
| 18 | Platt scaling calibration | Map scores to human judgment probability | 2 days | `src/evaluators/calibration/` |

---

## New Guardrail Specifications

8 new guardrails recommended by the process audit. Each extends the existing `src/guardrails/` architecture.

### Category: Correctness

#### 1. `BinarySearchDebugGuardrail`

**Trigger:** A fix commit is detected without a root-cause decomposition.

**Behavior:** Before allowing a fix, require the developer/agent to answer:
1. Is the problem in generation, extraction, wrapping, rendering, or display?
2. What layer does the fix target?
3. Does the fix address root cause or proximate symptom?

**Implementation:**
```typescript
// src/guardrails/correctness/BinarySearchDebugGuardrail.ts
export class BinarySearchDebugGuardrail extends BaseGuardrail {
  name = 'binary-search-debug';
  category = 'correctness';

  async check(context: FixContext): Promise<GuardrailResult> {
    const hasDecomposition = context.commitMessage.includes('root cause:')
      || context.commitMessage.includes('layer:')
      || context.diffDescription.length > 50; // meaningful analysis

    if (!hasDecomposition) {
      return {
        passed: false,
        message: 'Fix detected without root-cause decomposition. '
          + 'Which layer is broken? generation | extraction | wrapping | rendering | display',
        severity: 'warning'
      };
    }
    return { passed: true };
  }
}
```

**Target file:** `src/guardrails/correctness/BinarySearchDebugGuardrail.ts`

---

#### 2. `ExecutionVerificationGuardrail`

**Trigger:** A new module or file is added without a corresponding integration test.

**Behavior:** When a new source file is created, verify that an integration test exists in `test/integration/` that exercises this module with at least one other real module.

**Implementation:**
```typescript
// src/guardrails/correctness/ExecutionVerificationGuardrail.ts
export class ExecutionVerificationGuardrail extends BaseGuardrail {
  name = 'execution-verification-gate';
  category = 'correctness';

  async check(context: CommitContext): Promise<GuardrailResult> {
    const newSourceFiles = context.addedFiles.filter(f =>
      f.startsWith('src/') && f.endsWith('.ts') && !f.endsWith('.d.ts')
    );

    for (const srcFile of newSourceFiles) {
      const moduleName = path.basename(srcFile, '.ts');
      const hasIntegrationTest = context.allTestFiles.some(t =>
        t.includes('integration') && t.toLowerCase().includes(moduleName.toLowerCase())
      );
      const hasUnitTest = context.allTestFiles.some(t =>
        t.toLowerCase().includes(moduleName.toLowerCase())
      );

      if (!hasUnitTest && !hasIntegrationTest) {
        return {
          passed: false,
          message: `New module ${srcFile} has no test file. Add a unit test or integration test.`,
          severity: 'error'
        };
      }
      if (!hasIntegrationTest) {
        return {
          passed: false,
          message: `New module ${srcFile} has unit tests but no integration test. Wire it up.`,
          severity: 'warning'
        };
      }
    }
    return { passed: true };
  }
}
```

**Target file:** `src/guardrails/correctness/ExecutionVerificationGuardrail.ts`

---

#### 3. `SpecCompletenessGuardrail`

**Trigger:** A task or work item is started without clear specifications.

**Behavior:** Before generating code, verify the instruction contains:
- **Input:** What goes in
- **Output:** What comes out
- **Constraints:** What must be true
- **Success criteria:** How to know it worked

**Implementation:**
```typescript
// src/guardrails/correctness/SpecCompletenessGuardrail.ts
export class SpecCompletenessGuardrail extends BaseGuardrail {
  name = 'spec-completeness-check';
  category = 'correctness';

  private readonly requiredElements = [
    { pattern: /input:|given|when/i, name: 'Input specification' },
    { pattern: /output:|then|should (return|produce|generate)/i, name: 'Output specification' },
    { pattern: /constraint|must|require|always|never/i, name: 'Constraints' },
    { pattern: /success|criteria|verify|assert|expect/i, name: 'Success criteria' },
  ];

  async check(context: TaskContext): Promise<GuardrailResult> {
    const missing = this.requiredElements
      .filter(el => !el.pattern.test(context.taskDescription))
      .map(el => el.name);

    if (missing.length >= 3) {
      return {
        passed: false,
        message: `Task lacks specification. Missing: ${missing.join(', ')}. `
          + `Define input, output, constraints, and success criteria.`,
        severity: 'warning'
      };
    }
    return { passed: true };
  }
}
```

**Target file:** `src/guardrails/correctness/SpecCompletenessGuardrail.ts`

---

### Category: Hygiene

#### 4. `RefactorTimerGuardrail`

**Trigger:** A source file is modified for the 20th+ time.

**Behavior:** Suggest decomposition when a file has been touched excessively.

**Implementation:**
```typescript
// src/guardrails/hygiene/RefactorTimerGuardrail.ts
export class RefactorTimerGuardrail extends BaseGuardrail {
  name = 'refactor-timer';
  category = 'hygiene';
  private readonly TOUCH_THRESHOLD = 20;

  async check(context: FileChangeContext): Promise<GuardrailResult> {
    const touchCounts = await this.getTouchCounts(context.changedFiles);

    const overThreshold = Object.entries(touchCounts)
      .filter(([_, count]) => count >= this.TOUCH_THRESHOLD)
      .map(([file, count]) => ({ file, count }));

    if (overThreshold.length > 0) {
      return {
        passed: false,
        message: overThreshold.map(f =>
          `${f.file} touched ${f.count} times. Consider decomposing.`
        ).join(' | '),
        severity: 'info'
      };
    }
    return { passed: true };
  }
}
```

**Target file:** `src/guardrails/hygiene/RefactorTimerGuardrail.ts`

---

#### 5. `ContextBoundaryGuardrail`

**Trigger:** Session approaches context window limits.

**Behavior:** Alert when session length suggests compaction is imminent.

**Implementation:**
```typescript
// src/guardrails/hygiene/ContextBoundaryGuardrail.ts
export class ContextBoundaryGuardrail extends BaseGuardrail {
  name = 'context-boundary-warning';
  category = 'hygiene';
  private readonly MESSAGE_THRESHOLD = 40;

  async check(context: SessionContext): Promise<GuardrailResult> {
    if (context.messageCount >= this.MESSAGE_THRESHOLD) {
      return {
        passed: false,
        message: `Session has ${context.messageCount} messages. Context compaction likely imminent. `
          + `Save critical state to persistent files now.`,
        severity: 'warning'
      };
    }
    return { passed: true };
  }
}
```

**Target file:** `src/guardrails/hygiene/ContextBoundaryGuardrail.ts`

---

#### 6. `TripleRedundancyDetectorGuardrail`

**Trigger:** Similar files or functions are detected.

**Behavior:** Flag when multiple files implement overlapping functionality.

**Implementation:**
```typescript
// src/guardrails/hygiene/TripleRedundancyDetectorGuardrail.ts
export class TripleRedundancyDetectorGuardrail extends BaseGuardrail {
  name = 'triple-redundancy-detector';
  category = 'hygiene';

  // Known redundancy groups to check
  private readonly redundancyGroups = [
    {
      name: 'Collaboration',
      files: ['SwarmOrchestrator', 'DeepCollaboration', 'CollaborativeClient'],
      expected: 1
    },
    {
      name: 'Scoring',
      files: ['CreativeEvaluator', 'quickScore', 'HeuristicScorer'],
      expected: 1
    },
    {
      name: 'Prompts',
      files: ['PromptLibrary', 'PromptLibraryBridge'],
      expected: 1
    },
  ];

  async check(context: CodebaseContext): Promise<GuardrailResult> {
    const warnings: string[] = [];

    for (const group of this.redundancyGroups) {
      const existing = group.files.filter(f => context.fileExists(f));
      if (existing.length > group.expected) {
        warnings.push(`${group.name}: ${existing.length} systems found (${existing.join(', ')}). Expected: ${group.expected}.`);
      }
    }

    if (warnings.length > 0) {
      return {
        passed: false,
        message: `Redundancy detected: ${warnings.join(' ')}`,
        severity: 'warning'
      };
    }
    return { passed: true };
  }
}
```

**Target file:** `src/guardrails/hygiene/TripleRedundancyDetectorGuardrail.ts`

---

### Category: Evolution

#### 7. `EraCompletionGuardrail`

**Trigger:** Development pattern shifts (commit frequency, type distribution changes).

**Behavior:** When an "era" appears to be ending, require a review before starting the next phase.

**Implementation:**
```typescript
// src/guardrails/evolution/EraCompletionGuardrail.ts
export class EraCompletionGuardrail extends BaseGuardrail {
  name = 'era-completion-gate';
  category = 'evolution';

  async check(context: DevelopmentContext): Promise<GuardrailResult> {
    const recentCommits = context.getLastNCommits(10);
    const commitTypes = recentCommits.map(c => c.type);
    const fixRatio = commitTypes.filter(t => t === 'fix').length / commitTypes.length;

    // High fix ratio suggests era is winding down
    if (fixRatio > 0.5) {
      return {
        passed: false,
        message: `Fix ratio ${Math.round(fixRatio * 100)}% over last 10 commits. `
          + `Consider running full test suite and creating a review checkpoint before starting new features.`,
        severity: 'info'
      };
    }
    return { passed: true };
  }
}
```

**Target file:** `src/guardrails/evolution/EraCompletionGuardrail.ts`

---

#### 8. `BingeCoolDownGuardrail`

**Trigger:** Session exceeds 50 commits in a single session.

**Behavior:** Require a review before continuing.

**Implementation:**
```typescript
// src/guardrails/evolution/BingeCoolDownGuardrail.ts
export class BingeCoolDownGuardrail extends BaseGuardrail {
  name = 'binge-cool-down';
  category = 'evolution';
  private readonly COMMIT_THRESHOLD = 50;

  async check(context: SessionContext): Promise<GuardrailResult> {
    if (context.sessionCommitCount >= this.COMMIT_THRESHOLD) {
      return {
        passed: false,
        message: `${context.sessionCommitCount} commits this session. `
          + `Quality declines above 50 commits/session. Run tests and review before continuing.`,
        severity: 'warning'
      };
    }
    return { passed: true };
  }
}
```

**Target file:** `src/guardrails/evolution/BingeCoolDownGuardrail.ts`

---

## Code Decomposition Targets

### Priority Files for Decomposition

| File | Lines | Touches | Target Lines | Target Files |
|------|-------|---------|-------------|-------------|
| `src/core/CreativeEvaluator.ts` | 1,597 | High | ~180 each | 9 files in `src/evaluators/` |
| `src/llm/LLMClient.ts` | 1,368 | 28 | ~230 each | 6 files in `src/llm/` |
| `src/swarm/SwarmOrchestrator.ts` | 928 | High | ~230 each | 4 files in `src/swarm/` |
| `src/core/RalphLoop.ts` | ~800+ | 41 | ~200 each | 4 files in `src/core/loop/` |

### Decomposition Pattern

For each monolith, apply this pattern:

1. **Extract the interface** — What does this module promise to do?
2. **Identify the responsibilities** — List every distinct job the file does
3. **One file per responsibility** — Each job gets its own file
4. **Thin orchestrator** — The original file becomes a thin wrapper delegating to extracted modules
5. **Test each extracted module** — Behavioral tests for each new file
6. **Test the orchestrator** — Integration test proving delegation works

### Dependency Order

```
RalphLoop decomposition (unblocks everything)
  → CreativeEvaluator split (unblocks scoring fixes)
    → LLMClient split (unblocks LLM improvements)
      → SwarmOrchestrator split (unblocks collaboration consolidation)
```

RalphLoop first because it's the most-touched file and the core of the system. Everything else depends on the loop working correctly.

---

## Summary: What to Do This Week

1. **Verify CompostMill archive retrieval** — 1 day. If this is broken, evolution is random.
2. **Start RalphLoop decomposition** — 2 days. 13 levels → 4. Extract `IterationStrategy`, `QualityGate`, `OutputSelector`, `IterationContext`.
3. **Add `BinarySearchDebugGuardrail`** — 0.5 day. Forces layer decomposition before fixes.
4. **Add RalphLoop integration test** — 1 day. First end-to-end test for the most important file.

These four items address the highest-severity findings and create the foundation for all subsequent improvements.

---

*Generated from 6-agent adversarial analysis: Code Pattern Analyst, Process Auditor, Adversarial Weakness Hunter, Hidden Pattern Detector, Improvement Synthesizer, Scoring Architecture Analyst. Full cross-agent analysis available in `dev-archaeology` repo.*

*Last updated: April 12, 2026.*
