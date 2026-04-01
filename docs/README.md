# Liminal Documentation (THE BIBLE)

**Last Updated:** 2026-04-01  
**Version:** 2.0 with Persistent Memory & M9-M11

---

## 🆕 Recent Major Updates

### 1. Persistent Memory (NEW)
The Meta-Harness now has **persistent memory** across restarts:
- **Location:** `~/.liminal/memory/harness-memory.json`
- **Stores:** Tasks (M1-M11), adaptations, episodes, patterns
- **Auto-saves:** Every 30s + on shutdown
- **Survives:** Process restarts, crashes, system reboots

```typescript
import { harnessMemory } from 'liminal';

// Record a task
const taskId = harnessMemory.startTask({ type: 'M9', description: 'Add semantic validation' });

// Complete it
harnessMemory.completeTask(taskId, { status: 'completed', outcome: 'Implemented' });

// On next restart - memory is automatically loaded
```

### 2. Model Tier Detection (NEW)
Generators are now **model-aware** with 4 capability tiers:

| Tier | Models | Context | Prompt Style |
|------|--------|---------|--------------|
| **Flagship** | Claude 4, GPT-4 | 200k | Concise, XML tags |
| **Medium** | GPT-3.5, Claude Haiku | 100k | Detailed instructions |
| **Local** | Qwen, Llama, Mistral | **16k** | Explicit, few-shot |
| **Tiny** | TinyLlama, Phi-2 | 8k | Minimal, direct |

```typescript
import { detectModelTier, PromptBuilder } from 'liminal';

const tier = detectModelTier(config);  // 'flagship' | 'medium' | 'local' | 'tiny'
const prompt = new PromptBuilder(config).build(context);
```

### 3. M9-M11 Guardrails (NEW)
The final critical guardrails are now implemented:

- **M9: SemanticValidator** - Does output match user intent?
- **M10: RuntimeHealthMonitor** - Memory leaks, FPS, health over time
- **M11: AccessibilityGuardrails** - Photosensitivity, color blindness, motion

```typescript
import { SemanticValidator, RuntimeHealthMonitor, AccessibilityGuardrails } from 'liminal';

// M9: Intent matching
const semantic = await new SemanticValidator().validate(prompt, code, 'p5');

// M10: Runtime health
const health = await new RuntimeHealthMonitor().monitor(code, 'p5');

// M11: Accessibility
const a11y = await new AccessibilityGuardrails().check(code, 'p5');
```

---

## Documentation Index

### Core Architecture
| Document | Description |
|----------|-------------|
| [ARCHITECTURE_QUICKREF.md](./ARCHITECTURE_QUICKREF.md) | **START HERE** - System overview with status |
| [GENERATOR_ARCHITECTURE_V2.md](./GENERATOR_ARCHITECTURE_V2.md) | New model-aware generator design |
| [ARCHITECTURE_AND_PHILOSOPHY.md](./ARCHITECTURE_AND_PHILOSOPHY.md) | Design principles & philosophy |

### Guardrails & Safety
| Document | Description |
|----------|-------------|
| [GUARDRAIL_TAXONOMY.md](./GUARDRAIL_TAXONOMY.md) | M1-M18 guardrail definitions |
| [GUARDRAIL_EXHAUSTIVE.md](./GUARDRAIL_EXHAUSTIVE.md) | Complete analysis of all 18 guardrails |
| [SECURITY.md](./SECURITY.md) | Security considerations |

### Meta-Harness
| Document | Description |
|----------|-------------|
| [HARNESS_PREFLIGHT.md](./HARNESS_PREFLIGHT.md) | Task queue M1-M11 status |
| [WHAT_TO_EXPECT.md](./WHAT_TO_EXPECT.md) | Test outcomes & expectations |
| [READY_TO_LAUNCH.md](./READY_TO_LAUNCH.md) | Launch checklist |

### Research & Background
| Document | Description |
|----------|-------------|
| [AGENT_GENERATOR_ARCHITECTURE.md](./AGENT_GENERATOR_ARCHITECTURE.md) | Generator vs Harness discussion |
| [RALPH_WIGGUM_RESEARCH.md](./RALPH_WIGGUM_RESEARCH.md) | Loop research |
| [CREATIVE_DOMAIN_TYPES.md](./CREATIVE_DOMAIN_TYPES.md) | Domain classification |
| [PROMPTS.md](./PROMPTS.md) | Prompt system documentation |

---

## Quick Reference

### All 18 Guardrails Status

```
M1-M8:  ✅ IMPLEMENTED (Code Quality through Output Size)
M9:     ✅ IMPLEMENTED (Semantic Alignment)
M10:    ✅ IMPLEMENTED (Runtime Health)
M11:    ✅ IMPLEMENTED (Accessibility)
M12-18: ⚪ PLANNED/FUTURE
```

### File Structure

```
~/.liminal/
├── config.json              # Provider config
├── history.json             # Prompt history
├── memory/                  # 🆕 NEW: Persistent memory
│   └── harness-memory.json  # Tasks, adaptations, episodes
├── failures/                # Failure logs
├── output/                  # Generated outputs
└── routing/                 # Routing data
```

### Key Exports

```typescript
// Memory
export { harnessMemory, HarnessMemory } from 'liminal';

// Model Tiers
export { detectModelTier, PromptBuilder } from 'liminal';

// Guardrails M9-M11
export { 
  SemanticValidator,      // M9
  RuntimeHealthMonitor,   // M10
  AccessibilityGuardrails // M11
} from 'liminal';
```

---

## Development Status

**Current Branch:** `feature/persistent-memory`  
**Last Commit:** M9-M11 Guardrails + Model Tier system  
**Tests:** All passing

### Active Work
1. ✅ Persistent Memory (COMPLETE)
2. ✅ Model Tier Detection (COMPLETE)
3. ✅ M9-M11 Guardrails (COMPLETE)
4. 🔄 Documentation Site Update (IN PROGRESS)

---

## Philosophy Reminder

> "The Generator is not 'just an LLM wrapper.' It's a **context assembly and formatting engine** that detects the target model's preferred format, gathers relevant context from markdown files and memory, constructs model-optimized prompts, and integrates with Ralph Loop for iterative improvement."

— [GENERATOR_ARCHITECTURE_V2.md](./GENERATOR_ARCHITECTURE_V2.md)
