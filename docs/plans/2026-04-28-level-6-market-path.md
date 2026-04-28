# Level 6 Market Path Implementation Plan

**Goal:** Move Liminal from Level 3.5 self-improvement capability to Level 6: a human-usable, shippable Codex-for-Art product with reliable creative domains, visible learning, model assimilation, and installable runtime trust.

**Architecture:** Do not add another cockpit or proof island. Build one product spine: natural-language workbench -> domain runtime gauntlets -> cognitive learning receipts -> model assimilation -> package/release smoke. The existing Level 3.5 self-improvement gauntlet becomes the regression gate for autonomy; Level 6 adds human-facing product reliability and creative-domain completeness.

**Tech Stack:** TypeScript CLI/runtime, existing Liminal generators, `bin/liminal`, `src/runtime-core`, `src/reporting`, `src/generators`, `src/tui-bridge`, `gui/`, Vitest, pnpm build/lint, GitHub PR checks.

---

## Highest-Leverage Sequence

1. **Product spine first:** make the natural-language workbench the single real front door for create/improve/learn flows.
2. **Creative domain gauntlets:** lock all named domains with headless smoke contracts before polishing UI.
3. **Cognitive loop closure:** every run writes memory/compost/dreaming/intuition receipts that are usable by the next run.
4. **Model assimilation:** add a repeatable model audition command so new models can be compared by role/domain.
5. **Install/release trust:** package, docs, startup smoke, and clean failure messages.

This is the shortest path because it converts the existing architecture into a product loop rather than building more isolated systems.

---

## Phase 1: Real Workbench Spine

**Objective:** A normal human can open one surface, type a natural-language creative or self-improvement request, and see what Liminal did.

**Files:**
- Modify: `bin/liminal`
- Modify: `src/tui-bridge/TuiBridgeService.ts`
- Modify: `gui/` workbench routes/components as applicable
- Test: existing TUI/bridge/unit tests plus new focused workbench-routing tests

**Acceptance:**
- `liminal "make an eerie Strudel rhythm"` routes to Strudel.
- `liminal "improve your Strudel repair loop"` routes to self-improvement, not art.
- GUI/workbench shows: prompt, chosen lane, artifact/session receipt, what Liminal learned.

**Verification:**
```bash
pnpm exec vitest run test/unit/cli test/unit/runtime-core test/unit/tui-bridge --coverage=false --pool=threads --maxWorkers=1
pnpm build
node bin/liminal market status
```

---

## Phase 2: Creative Domain Gauntlets

**Objective:** Preserve and exercise the full creative surface: p5, GLSL, Three.js, SVG, Hydra, Strudel, Tone.js, Revideo, ASCII, Kinetic, TextGen.

**Files:**
- Create: `src/runtime-core/CreativeDomainGauntlet.ts`
- Create: `test/unit/runtime-core/CreativeDomainGauntlet.test.ts`
- Modify: `bin/liminal` to add `liminal domains gauntlet`
- Touch domain files only when tests expose real gaps.

**Acceptance:**
- One command reports domain readiness by domain.
- Each domain has at least: route, generate/wrap, validate, artifact path or receipt.
- No domain silently disappears from registry or market status.

**Verification:**
```bash
node bin/liminal domains gauntlet --output .omx/domain-gauntlet.json
pnpm exec vitest run test/unit/runtime-core/CreativeDomainGauntlet.test.ts --coverage=false --pool=threads --maxWorkers=1
pnpm build
```

---

## Phase 3: Cognitive Loop Receipts

**Objective:** Make memory, compost, dreaming, and intuition do jobs in the product loop, not just exist as architecture.

**Files:**
- Modify: `src/reporting/CognitiveArchitectureAtlas.ts`
- Create/modify: `src/runtime-core/CognitiveRunReceipt.ts`
- Modify: creative generation/session completion paths
- Test: `test/unit/runtime-core/CognitiveRunReceipt.test.ts`

**Acceptance:**
Every generation or self-improvement run records:
- Memory: what was attempted and outcome.
- Compost: what failed or can be reused.
- Dreaming: future candidate improvement/creative recombination.
- Intuition: ranked next best action.

**Verification:**
```bash
node bin/liminal "make a calming SVG animation" --output /tmp/liminal-receipt-smoke
cat /tmp/liminal-receipt-smoke/*receipt*.json
pnpm exec vitest run test/unit/runtime-core/CognitiveRunReceipt.test.ts --coverage=false --pool=threads --maxWorkers=1
```

---

## Phase 4: Model Assimilation Auditions

**Objective:** New models become measurable upgrades instead of vibes/env-var swaps.

**Files:**
- Create: `src/runtime-core/ModelAssimilationGauntlet.ts`
- Modify: `bin/liminal` to add `liminal model audition <provider/model>`
- Test: `test/unit/runtime-core/ModelAssimilationGauntlet.test.ts`

**Acceptance:**
A model audition compares at least:
- tool-call/schema reliability
- creative-domain routing
- self-improvement mutation readiness
- cost/latency placeholders when available
- no-op honesty

**Verification:**
```bash
node bin/liminal model audition local-test-model --dry-run --output .omx/model-audition.json
pnpm exec vitest run test/unit/runtime-core/ModelAssimilationGauntlet.test.ts --coverage=false --pool=threads --maxWorkers=1
```

---

## Phase 5: Level 6 Release Gate

**Objective:** One command says whether Liminal is ready for a human to install/use, and why.

**Files:**
- Create: `src/runtime-core/Level6ReleaseGate.ts`
- Modify: `bin/liminal` to add `liminal release gate`
- Modify: `node bin/liminal market status` to include Level 6 gate summary
- Test: `test/unit/runtime-core/Level6ReleaseGate.test.ts`

**Acceptance:**
Release gate requires:
- Level 3.5 self-improvement gauntlet passes
- creative-domain gauntlet passes
- workbench/front-door smoke passes
- cognitive receipt smoke passes
- model audition dry-run passes
- build/lint/focused tests pass
- docs/install smoke exists

**Verification:**
```bash
node bin/liminal release gate --output .omx/level6-release-gate.json
pnpm build
pnpm lint
pnpm exec vitest run test/unit/runtime-core test/unit/cli --coverage=false --pool=threads --maxWorkers=1
```

---

## Non-Negotiables

- No removal of Strudel, Tone.js, Revideo, SVG, Hydra, or any named domain.
- No new cockpit as the product. Disposable QA helpers are allowed; product surface stays the workbench/CLI.
- No success without artifact/session receipt.
- No self-improvement success without mutation when execution is requested.
- No “Level 6” claim until release gate passes on main.

---

## Milestone Definition

**Level 4:** self-improvement + domain gauntlets pass.

**Level 5:** cognitive loop receipts feed future runs and model auditions exist.

**Level 6:** release gate passes and a human can install/open/use Liminal through one front door.
