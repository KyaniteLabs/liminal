# Liminal Architecture Quick Reference

**Generated:** 2026-04-01  
**Version:** 2.0 - Now with Persistent Memory & M9-M11 Guardrails

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
┌─────────────────────────────────────────────────────────────────────┐
│  MetaHarnessIntegration 🟢    (Receives failure reports)           │
│  ├── FailureLogger 🟢         (Persistent to ~/.liminal/failures/) │
│  ├── PatternDetector 🟢                                            │
│  ├── HarnessUpdater 🟡        (Creates tasks, no auto-exec)        │
│  ├── HarnessAgent 🟢          (7 tools, rollback)                  │
│  ├── HarnessMemory 🟢         (NEW: Persistent task/adapt memory)  │
│  ├── ValidationGuard 🟢                                            │
│  └── RateLimiter 🟢                                                │
└─────────────────────────────────────────────────────────────────────┘
```

**Recently Added:**
- ✅ **HarnessMemory** - Persistent storage for tasks, adaptations, episodes
  - Location: `~/.liminal/memory/harness-memory.json`
  - Tracks: M1-M8 tasks, applied fixes, conversations, patterns
- ✅ Auto-save every 30s + on shutdown
- ✅ Survives restarts - harness remembers what it did

**Recently Fixed:**
- ✅ RalphLoop reports failures via `onGenerationComplete()`
- ✅ E2E tests report to harness
- ✅ Harness-specific LLM config (temp: 0.2 for code fixes)

**Task Queue:** M1-M11 (M9-M11 now implemented)

---

### 2. Core Engine (RalphLoop) 🟢

**Status:** CORE - WIRED TO HARNESS

| Component | Status | Notes |
|-----------|--------|-------|
| RalphLoop | 🟢 | Now reports to harness |
| CodeValidator | 🟢 | M1-M8 validated |
| CreativeEvaluator | 🟢 | 5 dimensions, 0.7 threshold |
| GenerationOrchestrator | 🟢 | Swarm, Collab, Standard modes |
| SafetyGuardrails | 🟢 | M1-M8 implemented |
| PromiseDetector | 🟢 | "COMPLETE" detection |
| ScoringEngine | 🟢 | Multiple strategies |
| SemanticValidator | 🟢 | **NEW M9** - Intent matching |
| RuntimeHealthMonitor | 🟢 | **NEW M10** - Memory/FPS monitoring |
| AccessibilityGuardrails | 🟢 | **NEW M11** - Photosensitivity, a11y |
| LIR | 🟣 | Parser exists, full integration WIP |

---

### 3. Generators ("Dumb" by Design + Model Tiers) 🟡

**Status:** INTENTIONALLY NOT SELF-IMPROVING + **NEW: Model-Aware**

| Generator | Status | Type | Model Tier Support |
|-----------|--------|------|-------------------|
| P5GeneratorLLM | 🟡 | p5.js | 🆕 V2 with tier detection |
| ShaderGenerator | 🟡 | GLSL | Planned |
| ThreeGenerator | 🟡 | Three.js | Planned |
| HydraGenerator | 🟡 | Video synth | Planned |
| ToneGenerator | 🟡 | Audio | Planned |
| StrudelGenerator | 🟡 | Music | Planned |

**🆕 Model Tier System:**
```
┌─────────────────────────────────────────────────────────────┐
│  Model Detection → Tier Selection → Prompt Format           │
├─────────────────────────────────────────────────────────────┤
│  FLAGSHIP (Claude 4, GPT-4)                                 │
│  ├── 200k context, 8k budget                                │
│  └── Concise prompts, XML tags, few-shot examples           │
├─────────────────────────────────────────────────────────────┤
│  MEDIUM (GPT-3.5, Claude Haiku)                             │
│  ├── 100k context, 4k budget                                │
│  └── Detailed instructions, markdown format                 │
├─────────────────────────────────────────────────────────────┤
│  LOCAL (Qwen, Llama, etc.)                                  │
│  ├── 16k context, 2k budget ← FIXED                         │
│  └── Explicit instructions, few-shot required               │
├─────────────────────────────────────────────────────────────┤
│  TINY (TinyLlama, Phi-2)                                    │
│  ├── 8k context, 1k budget                                  │
│  └── Minimal prompts, plain text, no examples               │
└─────────────────────────────────────────────────────────────┘
```

**⚠️ Design Principle:** Generators stay dumb but become **context-aware**. The Harness improves the SYSTEM around them.

---

### 4. Guardrails (M1-M18 Status)

| # | Guardrail | Status | Implementation |
|---|-----------|--------|----------------|
| M1 | Prompt Validation | 🟢 | `CodeValidator` |
| M2 | Domain Routing | 🟢 | `GeneratorRegistry` |
| M3 | Budget/Rate Limit | 🟢 | `SafetyGuardrails` |
| M4 | Syntax Validation | 🟢 | `CodeValidator` |
| M5 | Safety (execution) | 🟢 | `SandboxRunner` |
| M6 | Anti-Hallucination | 🟢 | `APIValidator` |
| M7 | Aesthetic Quality | 🟢 | `AestheticScorer` |
| M8 | Output Size | 🟢 | `CodeValidator.checkSize()` |
| **M9** | **Semantic Alignment** | 🟢 **NEW** | `SemanticValidator` |
| **M10** | **Runtime Health** | 🟢 **NEW** | `RuntimeHealthMonitor` |
| **M11** | **Accessibility** | 🟢 **NEW** | `AccessibilityGuardrails` |
| M12-M18 | (Various) | ⚪ | Planned/Future |

**🆕 M9: SemanticValidator**
- LLM-based intent matching
- Quick static checks (colors, animation, particles)
- Question: "Does the output match what the user asked for?"

**🆕 M10: RuntimeHealthMonitor**
- Memory leak detection (growing heap)
- FPS monitoring (degradation detection)
- Console error tracking
- Object accumulation detection
- Uses Puppeteer for runtime analysis

**🆕 M11: AccessibilityGuardrails**
- Photosensitivity: No flashing > 3Hz (seizure prevention)
- Color blindness: Red/green safety
- Contrast: WCAG AA checks
- Motion: Respects prefers-reduced-motion
- Audio: Sudden loud noise detection

---

### 5. Memory Systems 🟢

```
┌────────────────────────────────────────────────────────────────┐
│  PERSISTENT STORAGE (~/.liminal/)                              │
├────────────────────────────────────────────────────────────────┤
│  config.json              → Provider configuration             │
│  history.json             → Prompt history                     │
│  memory/harness-memory.json → 🆕 Tasks, adaptations, episodes │
│  failures/                → Failure logs for pattern detection │
│  output/                  → Generated outputs                  │
│  routing/                 → Routing data                       │
└────────────────────────────────────────────────────────────────┘
```

**Memory Types:**
- **EpisodicMemory** - Conversations, generations, feedback (now persisted)
- **HarnessMemory** - Tasks M1-M11, adaptations, pattern history
- **FailureLogger** - Structured failure records
- **Compost Heap** - Failed generations for learning

---

### 6. Prompt System (Context Engineering) 🟢

**New Architecture V2:**

```
User Prompt
    ↓
┌─────────────────────────────────────────┐
│  Model Tier Detection                   │
│  (flagship/medium/local/tiny)           │
├─────────────────────────────────────────┤
│  Context Assembly                       │
│  • SOUL.md → personality                │
│  • PROJECT_RULES.md → constraints       │
│  • Domain docs → technical knowledge    │
│  • HarnessMemory → recent adaptations   │
├─────────────────────────────────────────┤
│  Prompt Format Selection                │
│  • XML tags (Claude)                    │
│  • Markdown (GPT)                       │
│  • Plain text (local)                   │
├─────────────────────────────────────────┤
│  Token Budget Management                │
│  (trim context to fit tier budget)      │
└─────────────────────────────────────────┘
    ↓
LLM Call
```

**Key Insight (2026 Best Practice):**
> "Context Engineering replaced Prompt Engineering" — Andrej Karpathy

---

## Quick Links

| Document | Purpose |
|----------|---------|
| `GENERATOR_ARCHITECTURE_V2.md` | Full generator redesign |
| `GUARDRAIL_EXHAUSTIVE.md` | All 18 guardrails analyzed |
| `HARNESS_PREFLIGHT.md` | Task queue & execution plan |
| `WHAT_TO_EXPECT.md` | Test outcomes & status |

---

## Recent Commits

1. **Persistent Memory** - HarnessMemory for cross-session state
2. **Model Tiers** - Flagship/Medium/Local/Tiny detection
3. **M9-M11** - Semantic, Runtime Health, Accessibility guardrails
