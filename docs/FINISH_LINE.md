# Liminal Finish Line: Creative Cognitive System

Liminal V1 is **not** a narrowed four-generator proof. Liminal V1 is a creative cognitive system: a Studio where artists create with code, plus a harness where every artifact, failure, preference, model, dream, and repair becomes part of the system's future intelligence.

## Product Contract

1. **Creative instrument:** a human can ask for art, music, shaders, motion, typography, or video and see usable artifacts with honest previews and receipts.
2. **Self-improving organism:** Liminal perceives experience, stores it, composts it, dreams from it, develops intuition from it, and repairs itself when evidence shows weakness.

Proof slices may be narrow. Product scope must not silently shrink.

## Creative Body

| Domain | V1 role | Maturity rule |
| --- | --- | --- |
| SVG | Inspectable vector art and agent-editable visual structure | Must remain core |
| p5.js | Browser-native generative sketches | Must remain core |
| GLSL | Shader and fragment-program visual generation | Beta until renderer/evaluator proof is strong |
| Hydra | Live-coded video synthesis | Beta until route/preview proof is strong |
| Three.js | 3D scenes and WebGL objects | Beta until preview/eval proof is strong |
| Tone.js | Programmatic audio and music logic | Beta; validate with audio/code receipts, not screenshots |
| Strudel | Pattern-based live music code | Beta; validate with pattern/code/audio-specific checks |
| Revideo | Timeline/video composition generation | Beta; validate with timeline/export proof |
| HTML | Self-contained browser artifacts | Beta |
| ASCII | Text-mode visual artifacts | Scaffold until evaluation is meaningful |
| Kinetic Typography | Animated typographic compositions | Scaffold until preview/export gates are explicit |
| TextGen | Generative text and poetic artifacts | Scaffold until taste/eval loops are clear |

## Cognitive Organs

| Organ | Responsibility | Existing surfaces |
| --- | --- | --- |
| Perception | Capture prompts, artifacts, previews, failures, user reactions, provider behavior, and repair attempts | `src/core/TelemetryBridge.ts`, `src/cortex/CortexPerceptionBus.ts`, `src/tui-bridge/` |
| Memory | Store episodic, semantic, taste, procedural, and model-role experience outside the context window | `src/brain/archive/`, `src/harness/HarnessMemory.ts`, `src/learning/` |
| Compost | Digest discarded or completed material into reusable seeds, motifs, warnings, and creative nutrients | `src/compost/` |
| Dreaming | Recombine prior work offline and transfer motifs across domains | `src/dreaming/`, `src/intuition/DreamEngine.ts` |
| Intuition | Provide fast learned guidance for domain choice, promising fragments, novelty, and explore/exploit tradeoffs | `src/intuition/` |
| Cortex | Allocate attention, goals, budget, stuck detection, and self-awareness | `src/cortex/` |
| Garden / Evolution | Maintain ecosystem health: diversity, novelty, lineage, stagnation, quality-diversity archive | `src/autonomy/`, `src/evolution/`, `src/emergence/` |
| Immune / Truth System | Keep failures visible with validation, guardrails, honest scoring, receipts, and no fake fallbacks | `src/core/validators/`, `src/guardrails/`, `src/harness/FailureLogger.ts` |
| Model Assimilation | Audition new models by role/domain, promote from evidence, preserve fallback provenance | `src/harness/MultiProviderConfig.ts`, proof scripts, role metadata |

## Required Loops

### Creative Loop

`intent -> route -> generate -> preview/export -> evaluate -> user reaction -> memory -> compost -> dream -> next creation`

### Self-Improvement Loop

`failure perceived -> weakness classified -> repair proposed -> isolated worktree patch -> verification -> procedural memory`

### Model Assimilation Loop

`new model added -> domain/role audition -> compare baseline -> promote or demote route -> show provenance -> reuse evidence`

## Forbidden Drift Patterns

- Do not turn a narrow proof exclusion into product deletion.
- Do not claim visual/audio/video quality from the wrong artifact type.
- Do not hide provider/model identity behind wrapper labels.
- Do not synthesize fallback artifacts when the generator failed.
- Do not mark an organ complete because files exist; prove it participates in the closed loop.
- Do not call Liminal finished until Studio, CLI reports, docs, proofs, and self-improvement runs use the same contract.

## Finish-Line Gates

1. `liminal studio` shows a creative session with cognitive-loop receipts, including honest memory retrieval plus post-generation memory, compost, and dream-queue write-back.
2. `node bin/liminal report cognition` lists every creative domain and cognitive organ.
3. A proof bundle shows creative memory influencing a later generation; the live writer proof must also show Studio's post-generation memory, compost, and dream-queue write-back receipts.
4. A self-improvement run fixes or improves one real weakness in an isolated worktree with verification.
5. A model-assimilation report can audition and assign a new model by evidence.
6. No domain or organ is silently omitted from launch truth.
