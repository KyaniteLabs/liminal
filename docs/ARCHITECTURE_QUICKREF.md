# Liminal Architecture Quick Reference

**Generated:** 2026-04-01  
**Full Diagram:** Open `docs/architecture.html` in browser

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

## System Layers

### 1. Meta-Harness (Self-Improvement) 🟢

**Status:** ACTIVE - Recently wired to RalphLoop

```
┌─────────────────────────────────────────────────────────────┐
│  MetaHarnessIntegration 🟢    (Receives failure reports)   │
│  ├── FailureLogger 🟢                                       │
│  ├── PatternDetector 🟢                                     │
│  ├── HarnessUpdater 🟡     (Creates tasks, no auto-exec)   │
│  ├── HarnessAgent 🟢       (7 tools, rollback)             │
│  ├── ValidationGuard 🟢                                     │
│  └── RateLimiter 🟢                                         │
└─────────────────────────────────────────────────────────────┘
```

**Recently Fixed:**
- ✅ RalphLoop reports failures via `onGenerationComplete()`
- ✅ E2E tests report to harness
- ✅ Harness-specific LLM config (temp: 0.2 for code fixes)

**Task Queue:** M1, M4, M6, M7, M8 (all approved)

---

### 2. Core Engine (RalphLoop) 🟢

**Status:** CORE - WIRED TO HARNESS

| Component | Status | Notes |
|-----------|--------|-------|
| RalphLoop | 🟢 | Now reports to harness |
| CodeValidator | 🟢 | Includes Tone.js validation (M1 fix needed) |
| CreativeEvaluator | 🟢 | 5 dimensions, 0.7 threshold |
| GenerationOrchestrator | 🟢 | Swarm, Collab, Standard modes |
| SafetyGuardrails | 🟢 | Budget, circuit breaker, rate limit |
| PromiseDetector | 🟢 | "COMPLETE" detection |
| ScoringEngine | 🟢 | Multiple strategies |
| LIR | 🟣 | Parser exists, full integration WIP |

---

### 3. Generators ("Dumb" by Design) 🟡

**Status:** INTENTIONALLY NOT SELF-IMPROVING

| Generator | Status | Type |
|-----------|--------|------|
| P5GeneratorLLM | 🟡 | Main p5 generator (NO TEMPLATES) |
| ShaderGenerator | 🟡 | GLSL shaders |
| ThreeGenerator | 🟡 | Three.js 3D |
| HydraGenerator | 🟡 | Video synthesis |
| ToneGenerator | 🟡 | Audio synthesis |
| StrudelGenerator | 🟡 | Live coding music |
| RemotionGenerator | 🟡 | Video components |
| HTMLWebGenerator | 🟡 | Web pages |
| ASCIIArtGenerator | 🟡 | ASCII art |

**⚠️ Design Principle:** Generators stay dumb. Harness improves the SYSTEM around them.

---

### 4. TUI & Preview 🟢

**Status:** ACTIVE

| Component | Status | Function |
|-----------|--------|----------|
| HarnessTUI | 🟢 | Ink-based terminal UI |
| Commands | 🟢 | 10+ commands (/run, /preview, etc.) |
| PreviewRouter | 🟢 | Auto-routes terminal/browser |
| BrowserLauncher | 🟢 | Cross-platform browser open |
| AudioPlayer | 🟢 | System audio playback |

---

### 5. Collaboration & Swarm 🟢/🟡

| Component | Status | Notes |
|-----------|--------|-------|
| SwarmOrchestrator | 🟢 | 7-persona swarm |
| CreativeBoard | 🟢 | 3-critic evaluation |
| DeepCollaboration | 🟡 | Built, rarely used |
| Consensus | ⚪ | Discussed, not prioritized |

---

### 6. Evolution & Learning 🟢/🟡

| Component | Status | Notes |
|-----------|--------|-------|
| MapElites | 🟢 | Quality diversity |
| NoveltyArchive | 🟢 | Behavior tracking |
| AestheticModel | 🟡 | Built, slow learning |
| ArchiveLearning | 🟡 | Built, underutilized |

---

### 7. Compost System 🟢

| Component | Status | Notes |
|-----------|--------|-------|
| CompostHeap | 🟢 | Code fragment accumulation |
| CompostMill | 🟢 | Auto-digest at capacity |
| SeedBank | 🟣 | Exists, partial integration |

---

## Wiring Status

### ✅ Recently Fixed (Critical)

```
RalphLoop ──reports failures──► Meta-Harness
    │                              │
    └── onGenerationComplete()     ├── FailureLogger
                                   ├── PatternDetector
                                   └── HarnessAgent

E2E Tests ──reports results──► Meta-Harness
    └── success/failure logged
```

### ⚠️ Intentionally Not Wired

```
Generators ──NO guardrails──► X
    │                          │
    └── By design              └── Harness handles safety

HarnessUpdater ──NO auto-exec──► X
    │                              │
    └── Creates tasks              └── Requires manual approval
```

---

## Task List

| ID | Title | Status |
|----|-------|--------|
| M1 | Fix Tone.js Validation Gate | ✅ Ready |
| M4 | Fix Thinking Regex | ✅ Ready |
| M6 | Fix Console.log (FailureLogger) | ✅ Ready |
| M7 | Fix Console.log (PatternDetector) | ✅ Ready |
| M8 | Fix Console.log (HarnessUpdater) | ✅ Ready |

---

## Architecture Principles

1. **Harness Improves, Generators Don't:** Only the meta-harness self-improves
2. **Observe, Then Fix:** Harness watches failures, applies fixes to system
3. **Generators Stay Dumb:** No self-improvement in generators
4. **Manual Approval:** Tasks require approval (auto-execution planned)
5. **Safety First:** ValidationGuard ensures safe changes only

---

## Environment Variables

```bash
# Standard LLM
LIMINAL_LLM_BASE_URL=http://localhost:1234/v1
LIMINAL_LLM_MODEL=qwen2.5-coder-7b-instruct

# Harness-specific (NEW)
LIMINAL_HARNESS_TEMPERATURE=0.2      # Low for precise fixes
LIMINAL_HARNESS_MAX_TOKENS=4096
LIMINAL_HARNESS_TIMEOUT=60000
LIMINAL_HARNESS_MAX_RETRIES=3
```

---

## Quick Commands

```bash
# Start TUI
npm run tui

# In TUI:
/status          # Check harness status
/tasks           # List available tasks
/run M1          # Execute task M1
/run M4          # Execute task M4
/run M6          # Execute task M6
/run M7          # Execute task M7
/run M8          # Execute task M8
```

---

## Abandoned Components

| Component | Reason |
|-----------|--------|
| Template-based Generators | Violates NO TEMPLATES rule |
| ParticleSystem (template) | Now handled by LLM |
| CellularAutomata (template) | Now handled by LLM |
| SelfReflection | Merged into HarnessAgent |
| React GUI | Deprecated for TUI |

---

**Full Visual Diagram:** `docs/architecture.html` (open in browser)
