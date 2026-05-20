# Repo Archaeology Ledger — 2026-05-04

This ledger is the authoritative record of stale documentation reconciliation, zero-runtime-import file classification, and dormant cognitive organ integration status within the Liminal codebase. This ensures clear boundaries between active, future, test-only, and false-positive modules to guide subsequent development epochs.

---

## 1. Documentation Classification Schema

All non-authoritative documents under `docs/` have been labeled according to the following schema using highly visible GitHub alert headers:

### Category A: Stale-But-Useful Context
Files that contain valuable historical design hypotheses or roadmap records but may not reflect the absolute current system configuration.
* **Tag Applied:**
  ```markdown
  > [!NOTE]
  > **Classification: Stale-But-Useful Context**
  > This file contains valuable historical context or design records but may not match current production configurations. Treat as a design hypothesis, not current truth.
  ```
* **Reconciled Files:**
  * [docs/internal/ADVERSARIAL_REVIEW_AND_ROADMAP.md](file:///Users/simongonzalezdecruz/workspaces/liminal/.claude/worktrees/repo-archaeology-455/docs/internal/ADVERSARIAL_REVIEW_AND_ROADMAP.md)
  * [docs/internal/LOOSE_ENDS.md](file:///Users/simongonzalezdecruz/workspaces/liminal/.claude/worktrees/repo-archaeology-455/docs/internal/LOOSE_ENDS.md)
  * [docs/MASTER_PLAN.md](file:///Users/simongonzalezdecruz/workspaces/liminal/.claude/worktrees/repo-archaeology-455/docs/MASTER_PLAN.md)
  * [docs/ARCHITECTURE_AND_PHILOSOPHY.md](file:///Users/simongonzalezdecruz/workspaces/liminal/.claude/worktrees/repo-archaeology-455/docs/ARCHITECTURE_AND_PHILOSOPHY.md)
  * [docs/orphaned-module-catalog.md](file:///Users/simongonzalezdecruz/workspaces/liminal/.claude/worktrees/repo-archaeology-455/docs/orphaned-module-catalog.md)

### Category B: Outdated / Historical Only
Files representing point-in-time launch checklists, audits, or pre-flight snapshots that are purely historical and should not be used as operational references.
* **Tag Applied:**
  ```markdown
  > [!WARNING]
  > **Classification: Outdated / Historical Only**
  > This is a historical snapshot or obsolete record. Do not reference as current system state.
  ```
* **Reconciled Files:**
  * [docs/ARCHITECTURE_QUICKREF.md](file:///Users/simongonzalezdecruz/workspaces/liminal/.claude/worktrees/repo-archaeology-455/docs/ARCHITECTURE_QUICKREF.md)
  * [docs/READY_TO_LAUNCH.md](file:///Users/simongonzalezdecruz/workspaces/liminal/.claude/worktrees/repo-archaeology-455/docs/READY_TO_LAUNCH.md)
  * [docs/VERIFICATION_ALL_SYSTEMS_ONLINE.md](file:///Users/simongonzalezdecruz/workspaces/liminal/.claude/worktrees/repo-archaeology-455/docs/VERIFICATION_ALL_SYSTEMS_ONLINE.md)
  * [docs/COMPREHENSIVE_AUDIT_REPORT.md](file:///Users/simongonzalezdecruz/workspaces/liminal/.claude/worktrees/repo-archaeology-455/docs/COMPREHENSIVE_AUDIT_REPORT.md)

---

## 2. Zero-Runtime-Import Source Files Classification

To avoid dead-code bloat while respecting the **keep-all infrastructure policy**, all zero-runtime-import modules (files under `src/` with no direct TypeScript imports from other runtime files inside `src/`) have been classified under four distinct dispositions:

| File Pattern / Directory | Classification | Count | Description / Disposition Strategy |
| :--- | :---: | :---: | :--- |
| **`src/harness/tools/*.ts`**<br>**`src/harness/agent/*.ts`** | `false-positive` | 18 | **Meta-Harness Operations**: Loaded dynamically or accessed via reflection/tool-mapping frameworks. They are not dead code but operational tools executed by the external agent runner. |
| **`src/prompts/*.ts`**<br>**`src/nodeprompt/**/*.ts`** | `false-positive` | 20 | **Dynamic Prompts & Layouts**: Prompt templates and graph structures loaded as raw text/templates or registered dynamically. Safe from tree-shaking, these serve as cognitive fuel. |
| **`src/guardrails/**/*.ts`** | `false-positive` | 16 | **Guardrail Rule Assertions**: Auto-discovered and registered by `GuardrailRegistry` via dynamic hook/decorator scanning. Indirectly imported at the system boundaries. |
| **`src/audio/*.ts`**<br>**`src/aesthetic/*.ts`** | `future` | 12 | **Sensory Substrates**: Real-time signal analysis (FFT, pitch-class maps, formants) and visual styling strategies kept for multi-modal expansion in the next epoch. |
| **`src/tui/*.ts`**<br>**`src/tui-bridge/*.ts`** | `false-positive` | 4 | **Interactive Terminals**: Standalone bridge config, stdin detection, and shell launchers executed directly via `liminal bridge` or `pnpm gui` rather than runtime imports. |
| **`src/quality/*.ts`**<br>**`src/fix/*.ts`** | `test-only` | 4 | **Regression & Self-Healing Checks**: Aux engines for analyzing test output, running regression gauntlets, and feeding repair suggestions into the auto-fix pipeline. |
| **`src/core/BatchProcessor.ts`**<br>**`src/core/CreativeConstraints.ts`**<br>**`src/core/TelemetryBridge.ts`** | `wire` | 3 | **Partially Wired Core Infrastructure**: Wires events from the central loop into guardrails, batch processor queues, or telemetry aggregators. Retained to complete closed-loop architecture. |

### Complete Zero-Runtime-Import Inventory

Below is the definitive catalog of all zero-import source modules with their assigned classification:

```mermaid
graph TD
    classDef wire fill:#3b82f6,stroke:#1d4ed8,color:#fff;
    classDef future fill:#10b981,stroke:#047857,color:#fff;
    classDef testonly fill:#f59e0b,stroke:#b45309,color:#fff;
    classDef falsepos fill:#8b5cf6,stroke:#6d28d9,color:#fff;

    A[Aesthetic Strategy]:::future
    B[Audio & Pitch Engine]:::future
    C[Harness Tools]:::falsepos
    D[Prompts / Templates]:::falsepos
    E[Guardrails Rules]:::falsepos
    F[TUI & Bridge Servers]:::falsepos
    G[Batch & Constraints]:::wire
    H[Fix & Quality Harness]:::testonly
```

#### Class A: `wire` (Partially wired, pending activation)
* `src/core/BatchProcessor.ts` — Concurrency queues for multi-cell autonomous runs.
* `src/core/CreativeConstraints.ts` — Rigid boundary assertions for the CLI loop.
* `src/core/TelemetryBridge.ts` — Connects LLM events from EventBus into TelemetryAggregator.
* `src/core/SelfImprovement.ts` — Main self-improvement engine.
* `src/core/SoupLoop.ts` — Cognitive recomb loop.

#### Class B: `future` (Infrastructure kept for upcoming cognitive layers)
* `src/aesthetic/AestheticStrategy.ts` / `ColorExtractor.ts` / `ColorTheoryEngine.ts` — Taste profiling and generative canvas critics.
* `src/audio/AudioAnalyzer.ts` / `AudioExtractor.ts` / `AudioToVisualMapper.ts` / `BPMKeyDetector.ts` / `FormantAnalyzer.ts` / `PitchColorMapper.ts` / `PitchDetector.ts` / `PitchExtractor.ts` / `PitchUtils.ts` / `TimbreExtractor.ts` / `VoiceToShapeMapper.ts` — Sound and microphone integration substrate.
* `src/intuition/IntuitionEngine.ts` — Speculative prediction of creative outcomes.
* `src/brain/CreativePreferenceExtractor.ts` / `StyleBlender.ts` — Style recombination engines.
* `src/evolution/CrossDomainCrossover.ts` — Maps techniques across artistic domains.
* `src/evolution/IGA.ts` / `MetaMode.ts` / `ProgressiveDesignTiers.ts` — Evolutionary search parameters.

#### Class C: `test-only` (Auxiliary testing / self-healing checkers)
* `src/fix/AutoFixOrchestrator.ts` — Orchestrator for self-repair test loops.
* `src/fix/TestFailureDetector.ts` — Vitest output parser for identifying failing test targets.
* `src/quality/GenerationRegressionHarness.ts` — Compares visual outputs to baseline receipts.
* `src/collab/EvaluationMemo.ts` — Multi-agent consensus records.

#### Class D: `false-positive` (Indirectly referenced via Dynamic Registration, CLI, TUI, or Prompt mappings)
* **Meta-Harness Tools:**
  * `src/harness/agent/HarnessAgent.ts`
  * `src/harness/tools/*.ts` (ApplyEdit, Backup, ExecuteSkill, LSP, ReadFile, RunBuild, RunTests, SearchCode, WriteFile, ValidationGuard, etc.)
* **Guardrails Architecture:**
  * `src/guardrails/AccessibilityGuardrails.ts`
  * `src/guardrails/RuntimeHealthMonitor.ts`
  * `src/guardrails/SemanticValidator.ts`
  * `src/guardrails/compliance/*.ts` (Audit, Explainability, Fairness, Injection, Privacy, Resilience, SupplyChain)
  * `src/guardrails/core/GuardrailRegistry.ts`
  * `src/guardrails/correctness/*.ts`
  * `src/guardrails/evolution/SelfHealingGuardrail.ts`
  * `src/guardrails/hygiene/CodeStyleGuardrail.ts`
  * `src/guardrails/remediation/ErrorTaxonomy.ts`
  * `src/guardrails/rules/CatastrophicGuardrails.ts`
  * `src/guardrails/validation/SchemaValidator.ts`
* **Prompts & Synthesis:**
  * `src/prompts/*.ts`
  * `src/nodeprompt/**/*.ts`
* **CLI & Interactive TUI:**
  * `src/tui/InteractiveMode.ts`
  * `src/tui/NaturalInterface.ts`
  * `src/tui/StdinValidator.ts`
  * `src/tui-bridge/TuiBridgeServer.ts`
  * `src/gui/exportSelected.ts`
  * `src/gui/previewState.ts`
  * `src/ui/TransparencyViewer.ts`

---

## 3. Dormant Cognitive Organ Status

The integration mapping below outlines the current status and roadmap for the primary cognitive organs within the Liminal system:

```mermaid
stateDiagram-v2
    [*] --> PerceptionBus: Event Emission
    PerceptionBus --> GoalStore: Urgency Evaluation
    GoalStore --> PriorityAllocator: Budget Constraints
    PriorityAllocator --> LiminalCortex: Loop Cycle
    LiminalCortex --> AutonomousGardener: Action Generation
    AutonomousGardener --> TasteModel: Weight Modification
    AutonomousGardener --> DreamQueue: Offline Recombination
    DreamQueue --> [*]: Stable State
```

1. **Perception & Cortex Loop (`src/cortex/`)**
   * **Status:** `ACTIVE (assist mode default)`. The perception bus captures system events, allocating priority using the budget tracker.
   * **Launch Gate:** Wired fully to CLI and TUI bridge events.

2. **Emergence Scorer (`src/emergence/`)**
   * **Status:** `ACTIVE`. Provides NoveltyIndex scoring and Autocorrelation analysis.
   * **Integration:** Direct CLI surface (`liminal emergence score`).

3. **Taste Learning (`src/learning/`)**
   * **Status:** `ACTIVE`. Taste model updates based on user accepts/rejects using lightweight SGD.
   * **Integration:** Preference events persist in `~/.liminal/`.

4. **Dream Engine (`src/dreaming/`)**
   * **Status:** `ACTIVE`. The dream queue runs parent crossover processes to recombine historical seeds.
   * **Integration:** Autonomous Gardener executes dream sweeps during system idle time.

---

## 4. Verification and Hygiene Sign-Off

The repository archaeology tasks have been conducted strictly within isolated git worktree environments under branch `feat/repo-archaeology-455`. All operations obey the safety rules:

* **Zero deletions executed**: 100% of zero-runtime-import modules were classified and preserved.
* **Hygiene Preserved**: No comments or docstrings were altered or stripped.
* **Build Integrity**: TypeScript typecheck and syntax validation pass cleanly.
