# Liminal Cognitive Finish Line Implementation Plan

**Goal:** Turn Liminal from a collection of impressive subsystems into a visibly self-improving creative cognition system whose domains, cognitive organs, and self-improvement loops are tracked, exposed, and verified.

**Architecture:** Start with a source-controlled finish-line contract and a machine-readable cognitive architecture atlas. Then wire Studio/CLI reporting, capability maturity gates, model-assimilation gates, and proof scripts so every creative domain and cognitive organ must prove its role in the closed loop: perception -> memory -> compost -> dreaming -> intuition -> creation -> evaluation -> self-improvement.

**Tech Stack:** TypeScript, Vitest, existing `bin/liminal` CLI, existing `src/reporting`, existing cognitive subsystems under `src/compost`, `src/brain`, `src/intuition`, `src/dreaming`, `src/cortex`, `src/autonomy`, `src/learning`, `src/evolution`, and docs under `docs/`.

---

## Non-negotiable Product Contract

Liminal V1 is not a four-generator proof. It is a creative cognitive system with:

1. **Creative body:** SVG, p5.js, GLSL, Hydra, Three.js, Tone.js, Strudel, Revideo, HTML, ASCII, Kinetic Typography, TextGen.
2. **Cognitive organs:** perception, memory, compost, dreaming, intuition, cortex, garden/evolution, immune/truth system, model assimilation.
3. **Visible loops:** creative loop, self-improvement loop, model-assimilation loop.
4. **Honest maturity:** every domain and organ is `gold`, `beta`, `scaffold`, or `paused`; nothing is silently deleted.

## Executed Phase 0

### Task 0.1: Create finish-line contract document

**Files:** `docs/FINISH_LINE.md`, `README.md`

**Verification:** `rg -n "FINISH_LINE|creative cognitive system|SVG|Strudel|Tone.js|Revideo" docs/FINISH_LINE.md README.md`

### Task 0.2: Add machine-readable cognitive architecture atlas

**Files:** `src/reporting/CognitiveArchitectureAtlas.ts`, `src/reporting/index.ts`, `test/unit/reporting/CognitiveArchitectureAtlas.test.ts`

**Verification:** `pnpm vitest run test/unit/reporting/CognitiveArchitectureAtlas.test.ts --coverage=false`

### Task 0.3: Expose atlas through CLI

**Files:** `bin/liminal`, `test/integration/cognitive-architecture-cli-contract.test.ts`

**Verification:** `pnpm build && node bin/liminal report cognition`

### Task 0.4: Add deterministic cognitive-loop proof

**Files:** `scripts/proof/cognitive-loop-proof.ts`, `package.json`, `test/scripts/cognitive-loop-proof-script.test.ts`

**Verification:** `pnpm proof:cognitive-loop -- --out=.omx/proof/cognitive-loop-dev`; `pnpm proof:cognitive-loop -- --live --out=.omx/proof/cognitive-loop-live-dev`

## Remaining Execution Plan

1. Studio receipts: show intent, route, generation, preview/export, evaluation, memory/compost note, and domain maturity. **Partially executed:** Studio generation now retrieves prior domain memory before generation and writes completed artifacts into HarnessMemory, the compost heap, and DreamQueue receipts.
2. Live cognitive-loop proof: upgrade deterministic proof to optional `--live` mode with exact provider failures and no fallback artifacts. **Partially executed:** `pnpm proof:cognitive-loop -- --live` now drives the real post-generation cognitive writer through prepare/write-back receipts, proof memory, compost copy, and DreamQueue evidence without provider fallback artifacts.
3. Self-improvement repair: bound the Bubble Tea/Studio first planning prompt and preserve structured provider errors. **Partially executed:** `LLMModeAgent` now caps planning context before `complete()` calls, preserves newest planning context under budget, and keeps provider/model/status/retry/body metadata in planning diagnostics.
4. Model assimilation runner: audition models by role/domain and persist promotion/demotion evidence. **Partially executed:** `pnpm proof:model-assimilation` now emits a deterministic `liminal-model-assimilation-v1` report with assignments and fallback provenance for all 12 finish-line domains.
5. Domain gates: raise SVG/p5 first, then GLSL/Hydra/Three, then Tone/Strudel/Revideo, then remaining domains.

## Completion Definition

This program is across the finish line only when Studio, CLI reports, docs, proof bundles, self-improvement runs, and model-assimilation reports all use the same contract and no domain or organ is silently omitted.
