# Liminal Documentation

**The complete source of truth for the Liminal creative coding agent.**

---

## 📖 THE BIBLE (Start Here)

**[THE_BIBLE.md](./THE_BIBLE.md)** - Comprehensive system documentation covering:
- Complete architecture overview
- All subsystems (Meta-Harness, Ralph Loop, Generators, Guardrails)
- Current test/status snapshot
- Recent fixes and cleanup
- API exports
- Configuration

---

## Quick Navigation

### Core Documentation
| Document | Purpose |
|----------|---------|
| [THE_BIBLE.md](./THE_BIBLE.md) | **Complete system reference** |
| [ARCHITECTURE_QUICKREF.md](./ARCHITECTURE_QUICKREF.md) | Quick visual overview |
| [GENERATOR_ARCHITECTURE_V2.md](./GENERATOR_ARCHITECTURE_V2.md) | Generator design |

### Guardrails & Safety
| Document | Purpose |
|----------|---------|
| [GUARDRAIL_TAXONOMY.md](./GUARDRAIL_TAXONOMY.md) | M1-M18 definitions |
| [GUARDRAIL_EXHAUSTIVE.md](./GUARDRAIL_EXHAUSTIVE.md) | Complete analysis |
| [SECURITY.md](./SECURITY.md) | Security considerations |

### Meta-Harness
| Document | Purpose |
|----------|---------|
| [HARNESS_PREFLIGHT.md](./HARNESS_PREFLIGHT.md) | Task queue M1-M11 |
| [WHAT_TO_EXPECT.md](./WHAT_TO_EXPECT.md) | Test outcomes |
| [READY_TO_LAUNCH.md](./READY_TO_LAUNCH.md) | Launch checklist |

### Philosophy & Research
| Document | Purpose |
|----------|---------|
| [ARCHITECTURE_AND_PHILOSOPHY.md](./ARCHITECTURE_AND_PHILOSOPHY.md) | Design principles |
| [AGENT_GENERATOR_ARCHITECTURE.md](./AGENT_GENERATOR_ARCHITECTURE.md) | Generator vs Harness |
| [PROJECT_RULES.md](./PROJECT_RULES.md) | Development rules |

---

## System Status

```
Tests:      See THE_BIBLE.md for live counts
Files:      See THE_BIBLE.md for live counts
Guardrails: See THE_BIBLE.md / Visual Bible for current status
Memory:     Persistent (HarnessMemory)
Generators: Model-aware (TierBasedGenerator)
```

---

## What's New

### 2026-04-09
- ✅ **Launch-readiness docs added** - legal, brand, and launch planning docs now reflect the live repo/package state
- ⚠️ **Commercial review active** - `pitchfinder`, Remotion, and `p5` remain explicit launch review areas

### 2026-04-01
- ✅ **THE BIBLE** - Complete system documentation
- ✅ **Test Suite Fixed** - historical milestone entry; check THE_BIBLE for current live counts
- ✅ **All Generators Migrated** - TierBasedGenerator base class
- ✅ **M9-M11 Guardrails** - Semantic, Runtime Health, Accessibility
- ✅ **Persistent Memory** - HarnessMemory with auto-save
- ✅ **Model Tiers** - Flagship/Medium/Local/Tiny detection

---

## Important Rules

**From PROJECT_RULES.md:**

1. **NO DUPLICATION** - Check existing code before writing new
2. **THE BIBLE IS SOURCE OF TRUTH** - Update docs before code
3. **Tests Must Pass** - verify against the current live repo state, not stale historical counts

---

## Directory Structure

```
docs/
├── THE_BIBLE.md                  ← START HERE
├── README.md                     ← This file
├── ARCHITECTURE_QUICKREF.md      ← Visual overview
├── GENERATOR_ARCHITECTURE_V2.md  ← Generator design
├── GUARDRAIL_*.md                ← Guardrail docs
├── HARNESS_*.md                  ← Meta-harness docs
├── *RESEARCH*.md                ← Background research
└── archive/                      ← Old docs
```

---

**For complete information, see [THE_BIBLE.md](./THE_BIBLE.md)**
