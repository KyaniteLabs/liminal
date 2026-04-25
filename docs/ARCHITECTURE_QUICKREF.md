# Liminal Architecture Quick Reference

> ⚠️ **OUTDATED — 2026-04-01 Snapshot.** This document is retained for historical context. For current system status, run the test suite (`pnpm test`) and see `.omx/proof/` for latest evidence.

**Generated:** 2026-04-01
**Version:** 2.0 - Release Candidate
**Tests:** ~9,900 passing, 0 failures (as of 2026-04-24)
**Status:** Operational

> This is a point-in-time architecture reference, not a launch-readiness declaration.
> For current launch status, see `.omx/proof/launch-readiness-scorecard-2026-04-19.md`.

---

## Legend

| Symbol | Meaning |
|--------|---------|
| 🟢 | Built & Wired |
| 🟡 | Built but Not Wired |
| 🟣 | Planned/Implemented |
| ⚪ | Discussed/Documented |
| 🔴 | Abandoned |

---

## Test Status: ✅ ALL PASSING

```
Test Files: ~630
Tests:      ~9,900 passing
Failures:   0
```

### Recent Test Fixes (Complete)

**Bucket A - Fixture Sizes:**
- `test/unit/exporter.test.ts` - ~16 fixtures enlarged to >500 bytes
- `test/unit/gui-export-selected.test.js` - 2 fixtures enlarged

**Bucket B - Generator LLM Mocks:**
- `test/unit/shader-generator.test.ts` - Added vi.mock for LLMClient
- `test/unit/three-generator.test.ts` - Added vi.mock for LLMClient
- `test/unit/generators/RemotionGenerator.test.ts` - Added vi.mock
- `test/generators/p5-generator.test.js` - vi.mock + async fixes

**Bucket C - Ralph-loop + Misc:**
- `test/integration/evaluator-gallery.test.js` - Fixed Promise mock
- `test/unit/core/CodeValidator.test.ts` - 11 fixtures rewritten
- `test/integration/preview-server-api.test.js` - sampleCode enlarged
- `src/generators/hydra/HydraGenerator.ts` - Regex escape fixes
- `src/utils/htmlWrapper.ts` - RegExp() conversion
- Guardrails - @ts-ignore → @ts-expect-error fixes

---

## System Layers

### 1. Meta-Harness (Self-Improvement) 🟢

```
┌─────────────────────────────────────────────────────────────────────┐
│  MetaHarnessIntegration 🟢    (Receives failure reports)           │
│  ├── FailureLogger 🟢         (Persistent to ~/.liminal/failures/) │
│  ├── PatternDetector 🟢                                            │
│  ├── HarnessUpdater 🟡        (Creates tasks, no auto-exec)        │
│  ├── HarnessAgent 🟢          (21 tools, rollback)                 │
│  ├── HarnessMemory 🟢         (NEW: Persistent memory)             │
│  ├── ValidationGuard 🟢                                            │
│  └── RateLimiter 🟢                                                │
└─────────────────────────────────────────────────────────────────────┘
```

**HarnessMemory (NEW):**
```
~/.liminal/memory/harness-memory.json
├── Tasks: M1-M11 status, outcomes
├── Adaptations: Fixes applied with success/failure
├── Episodes: Conversations, generations
└── Patterns: Failure pattern history

Auto-saves: Every 30s + on shutdown
```

**Task Queue:**
- M1-M8: ✅ Core guardrails (complete)
- M9: ✅ Semantic Validation (complete)
- M10: ✅ Runtime Health (complete)
- M11: ✅ Accessibility (complete)

---

### 2. Core Engine (RalphLoop) 🟢

| Component | Status | Notes |
|-----------|--------|-------|
| RalphLoop | 🟢 | Main orchestration |
| CodeValidator | 🟢 | M1-M8 validated, all fixtures fixed |
| CreativeEvaluator | 🟢 | 5 dimensions, 0.7 threshold |
| GenerationOrchestrator | 🟢 | Swarm, Collab, Standard modes |
| SafetyGuardrails | 🟢 | M1-M8 implemented |
| PromiseDetector | 🟢 | "COMPLETE" detection |
| ScoringEngine | 🟢 | Multiple strategies |
| SemanticValidator | 🟢 | **M9** - Intent matching |
| RuntimeHealthMonitor | 🟢 | **M10** - Memory/FPS monitoring |
| AccessibilityGuardrails | 🟢 | **M11** - Photosensitivity, a11y |

---

### 3. Generators (Model-Aware) 🟢

**Base Class:** `TierBasedGenerator`

```
┌─────────────────────────────────────────────────────────────┐
│  MODEL TIER DETECTION                                       │
├─────────────────────────────────────────────────────────────┤
│  FLAGSHIP (Claude 4, GPT-4)                                 │
│  ├── Context: 200k tokens                                   │
│  ├── Budget: 8000 tokens                                    │
│  └── Style: Concise, XML tags, few-shot                     │
├─────────────────────────────────────────────────────────────┤
│  MEDIUM (GPT-3.5, Claude Haiku)                             │
│  ├── Context: 100k tokens                                   │
│  ├── Budget: 4000 tokens                                    │
│  └── Style: Detailed instructions                           │
├─────────────────────────────────────────────────────────────┤
│  LOCAL (Qwen, Llama, Mistral) ← FIXED                       │
│  ├── Context: 16k tokens (was 32k)                          │
│  ├── Budget: 2000 tokens                                    │
│  └── Style: Explicit, few-shot required                     │
├─────────────────────────────────────────────────────────────┤
│  TINY (TinyLlama, Phi-2)                                    │
│  ├── Context: 8k tokens                                     │
│  ├── Budget: 1000 tokens                                    │
│  └── Style: Minimal, plain text                             │
└─────────────────────────────────────────────────────────────┘
```

**All Generators (Migrated to TierBasedGenerator):**

| Generator | Domain | Context Loading | Validation |
|-----------|--------|-----------------|------------|
| P5GeneratorV2 | p5.js | SOUL.md, PROJECT_RULES.md, domain docs | setup/draw check |
| ShaderGenerator | GLSL | Context + memory | truncation, main() check |
| ThreeGenerator | Three.js | Context + memory | THREE import check |
| HydraGenerator | Video | Context + memory | Hydra syntax check |
| StrudelGenerator | Music | Context + memory | Pattern validation |
| ToneGenerator | Audio | Context + memory | Tone.js check |
| RemotionGenerator | Video | Context + memory | React component check |
| HTMLWebGenerator | Web | Context + memory | HTML structure check |
| ASCIIArtGenerator | ASCII | Context + memory | Character validation |

**Context Assembly:**
1. Load `SOUL.md` → personality
2. Load `PROJECT_RULES.md` → constraints
3. Load `docs/domains/{domain}.md` → technical knowledge
4. Query `HarnessMemory` → recent adaptations
5. Query `HarnessMemory` → user preferences
6. Trim to token budget
7. Format for detected tier

---

### 4. Guardrails (M1-M18)

| # | Guardrail | Status | Implementation | Notes |
|---|-----------|--------|----------------|-------|
| M1 | Prompt Validation | 🟢 | `CodeValidator` | Size, toxicity |
| M2 | Domain Routing | 🟢 | `GeneratorRegistry` | Keyword-based |
| M3 | Budget/Rate Limit | 🟢 | `SafetyGuardrails` | Cost protection |
| M4 | Syntax Validation | 🟢 | `CodeValidator` | Domain parsing |
| M5 | Safety (execution) | 🟢 | `SandboxRunner` | Sandboxed |
| M6 | Anti-Hallucination | 🟢 | `CodeValidator` | API validation |
| M7 | Aesthetic Quality | 🟢 | `AestheticScorer` | 5 dimensions |
| M8 | Output Size | 🟢 | `CodeValidator` | Min 500 bytes |
| **M9** | **Semantic Alignment** | 🟢 | `SemanticValidator` | **Intent matching** |
| **M10** | **Runtime Health** | 🟢 | `RuntimeHealthMonitor` | **Memory, FPS** |
| **M11** | **Accessibility** | 🟢 | `AccessibilityGuardrails` | **Photosensitivity** |
| M12 | Version Compatibility | ⚪ | - | Planned |
| M13 | Dependency Health | ⚪ | - | Planned |
| M14 | Resource Prediction | ⚪ | - | Planned |
| M15 | Consistency | ⚪ | - | Planned |
| M16 | Code Clarity | ⚪ | - | Planned |
| M17 | Thermal/Power | ⚪ | - | Planned |
| M18 | Telemetry | ⚪ | - | Planned |

---

### 5. Memory Systems

| System | Location | Persistence | Content |
|--------|----------|-------------|---------|
| HarnessMemory | `src/harness/` | ✅ ~/.liminal/memory/ | Tasks, adaptations, episodes |
| EpisodicMemory | `src/brain/` | ✅ Via HarnessMemory | Conversations, generations |
| CompostHeap | `src/compost/` | ✅ File-based | Failed generations |
| NoveltyArchive | `src/learning/` | ✅ File-based | Pattern diversity |
| QualityArchive | `src/learning/` | ✅ File-based | High-quality examples |

---

### 6. File Structure

```
liminal/
├── src/
│   ├── brain/           # Memory & knowledge (EpisodicMemory, ArtKnowledgeGraph)
│   ├── collab/          # Collaborative generation
│   ├── compost/         # Failure learning (CompostHeap)
│   ├── core/            # Ralph Loop (RalphLoop, CodeValidator, SafetyGuardrails)
│   ├── evolution/       # Evolutionary algorithms
│   ├── gallery/         # Output gallery
│   ├── generators/      # All generators (TierBasedGenerator base)
│   │   ├── TierBasedGenerator.ts  ← NEW base class
│   │   ├── p5/P5GeneratorV2.ts
│   │   ├── glsl/ShaderGenerator.ts
│   │   ├── three/ThreeGenerator.ts
│   │   ├── hydra/HydraGenerator.ts
│   │   ├── strudel/StrudelGenerator.ts
│   │   ├── tone/ToneGenerator.ts
│   │   ├── remotion/RemotionGenerator.ts
│   │   ├── html/HTMLWebGenerator.ts
│   │   └── ascii/ASCIIArtGenerator.ts
│   ├── guardrails/      # M9-M11 (NEW)
│   │   ├── SemanticValidator.ts      ← M9
│   │   ├── RuntimeHealthMonitor.ts   ← M10
│   │   └── AccessibilityGuardrails.ts ← M11
│   ├── harness/         # Meta-harness
│   │   ├── HarnessMemory.ts          ← NEW
│   │   ├── MetaHarnessIntegration.ts
│   │   ├── FailureLogger.ts
│   │   ├── PatternDetector.ts
│   │   ├── HarnessUpdater.ts
│   │   └── agent/       # HarnessAgent with 21 tools
│   ├── learning/        # Quality/Novelty archives
│   ├── llm/             # LLM infrastructure
│   │   ├── LLMClient.ts
│   │   ├── ModelTier.ts              ← NEW
│   │   └── PromptBuilder.ts          ← NEW
│   ├── prompts/         # Prompt library
│   ├── routing/         # Model routing
│   ├── sandbox/         # Code execution
│   ├── scavenger/       # DNA extraction
│   ├── security/        # Security config
│   ├── swarm/           # Swarm mode
│   ├── tui/             # Terminal UI
│   └── utils/           # Utilities
├── test/                # ~630 test files, ~9,900 tests
├── docs/                # Documentation
│   ├── THE_BIBLE.md     ← COMPLETE SYSTEM REFERENCE
│   ├── ARCHITECTURE_QUICKREF.md
│   ├── GENERATOR_ARCHITECTURE_V2.md
│   └── ...
├── harness-tasks/       # M1-M11 task definitions
└── ~/.liminal/          # User data (runtime)
    ├── memory/
    │   └── harness-memory.json
    ├── failures/
    ├── config.json
    └── history.json
```

---

## Key Exports

```typescript
// Core
export { RalphLoop };

// Tier-Based Generators
export { TierBasedGenerator };
export { P5GeneratorV2, ShaderGenerator, ThreeGenerator };
export { HydraGenerator, StrudelGenerator, ToneGenerator };
export { RemotionGenerator, HTMLWebGenerator, ASCIIArtGenerator };

// Model Tiers
export { detectModelTier, getModelProfile, getModelInfo };
export type { ModelTier, ModelProfile };
export { PromptBuilder };

// Guardrails M9-M11
export { SemanticValidator };
export { RuntimeHealthMonitor };
export { AccessibilityGuardrails };

// Meta-Harness
export { metaHarness, harnessMemory };
export type { HarnessTask, HarnessMemoryState };
```

---

## Quick Commands

```bash
# Run TUI
npm run tui

# Check status
/status

# List tasks
/tasks

# Run task
/run M1

# Build
npm run build

# Test
npm test
```

---

## Status Summary

| Category | Status | Count |
|----------|--------|-------|
| Source Files | 🟢 | 262 |
| Test Files | 🟢 | 224 |
| Tests Passing | 🟢 | ~9,900 |
| Tests Failing | 🟢 | 0 |
| Guardrails M1-M8 | 🟢 | 8/8 |
| Guardrails M9-M11 | 🟢 | 3/3 |
| Guardrails M12-M18 | ⚪ | 0/7 |
| Generators | 🟢 | 9/9 |
| Memory Systems | 🟢 | 5/5 |

---

**All systems operational. Launch candidate — not yet declared production-ready.**
