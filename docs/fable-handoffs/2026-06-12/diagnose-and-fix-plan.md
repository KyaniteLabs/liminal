# Plan: Diagnose & Fix Every Open Defect — Sinter Self-Improvement & Generation

> Status: **PENDING APPROVAL** (ralplan consensus output — Planner draft, pre-review)
> Date: 2026-06-12 · Repo: `~/workspaces/liminal` (product = Sinter) · Forgejo is source of truth
> Method: every item is **Diagnose → Fix → Verify**. Test-first where a test file exists. One branch+PR per workstream item.

## RALPLAN-DR Summary

**Principles**
1. **Measure before and after.** No fix ships without a reproduced failure and a named verification command showing the delta.
2. **Honest signal over flattering signal.** The renormalization work proved the system was lying to itself; every change here must keep the metrics truthful (no threshold-lowering, no masking).
3. **Reliability before features.** A 50% generation failure rate wastes half of all inference; it outranks new domains and new quality ceilings.
4. **Surgical edits, integration-first.** Every change has a call site and a regression test; no orphaned modules (CLAUDE.md law).
5. **Sequence by leverage ÷ blast-radius.** Cheap high-impact reliability fixes first; risky structural work (TUI removal, health-metric redefinition) isolated and last.

**Decision Drivers (top 3)**
1. Generation completion is **50% over the last 30 cycles** (66% all-time, and trending *worse*) — the dominant waste.
2. The self-improvement loop's fitness signal (`health`) has been **flat at ~84.2% for all 115 cycles** — it cannot currently distinguish improvement from stagnation, so the loop is optimizing partly blind.
3. The work must feed Sinter's own learning loop (Simon's standing rule), not be hand-patched around it.

**Viable Options (≥2)**

- **Option A — One monolithic ralph/team run over all items.**
  Pros: single launch. Cons: 7 workstreams with cross-cutting concerns (generation, autonomy, composition, build) in one shared worktree → collisions, unverifiable attribution, the daemon runs the working tree so churn risks live cycles. **Rejected** — violates parallel-agent isolation and makes before/after measurement impossible.

- **Option B (CHOSEN) — Phased, dependency-ordered workstreams, each its own branch+PR, executed as small `/team` or sequential `ralph` runs gated by a diagnostic harness built in Phase 0.**
  Pros: each fix independently measured, reviewed, reverted; respects worktree isolation; Phase 0 instrumentation makes every later claim evidence-backed. Cons: more coordination overhead, longer wall-clock. Accepted because correctness and honest measurement are the whole point of this system.

- **Option C — Diagnose-only pass now, fix later.**
  Pros: lowest risk. Cons: the user explicitly asked to *fix* every item; diagnosis without fix leaves the 50% failure bleeding. **Rejected** as under-delivering, but its diagnostic spine is folded into Phase 0 of Option B.

**Why B invalidates A and C:** A cannot produce honest per-fix deltas (the core value); C ignores the explicit "fix" mandate. B is the only option that both fixes everything and keeps the measurement honest.

---

## Pre-Mortem (deliberate mode — 3 failure scenarios)

1. **"We fixed reliability but the daemon shows no improvement."** Actual mechanism (corrected via Architect review): the daemon runs **`dist` built from `main`'s HEAD** at the root worktree (`self-improve-daemon.sh:19,40-50`), and **silently falls back to the *previous* dist if the rebuild fails** — so a merged fix can be invisible for a cycle. Mitigation: Phase 0 adds a failure-class counter; every reliability PR's acceptance gate must assert the daemon's `last-build-sha` advanced to the merge commit AND show the named class dropping in a real cycle (or seeded replay), not just unit tests.
2. **"The health-metric change moved the number but not the loop."** `healthScore`/`nicheOccupancy` are **control inputs**, not just reports — consumed by `LoopMixPolicy.computeMix` (`LoopMixPolicy.ts:72-86`) and `StagnationDetector` (`src/autonomy/StagnationDetector.ts:99-102` — NOT the unrelated `src/core/StagnationDetector.ts`). A parallel `qualityHealth` axis that varies but steers nothing is an orphaned signal (violates the Dead-Code-Wiring law) and leaves the loop optimizing on the old blind metric while the ledger *looks* fixed — the renormalization failure mode one layer up. Mitigation: see the **rewired** 2.D1 below (shadow-read → evidence-gated controller switch), never a report-only axis.
3. **"TUI removal broke an import the GUI/bridge still depends on."** Mitigation: grep the entire repo for `bubbletea`/TUI bridge symbols before deletion; the ADR-0005 gate (pin/reject parity) is verified shipped (#30); removal PR must show `pnpm build` + full typecheck + GUI smoke green with zero references remaining. Coordinate with the **active `.claude/worktrees/fable-ops` worktree** (concurrent live work) before any `packages/`- or shared-file-touching deletion.

### Core tradeoff (named & chosen)
Honest-signal (P2) vs live-loop continuity: you cannot keep the daemon producing hourly cycles AND get a perfectly clean before/after on a control-signal change, because the loop's own behavior shifts the baseline mid-experiment. **Choice:** keep the daemon running and make the D-cluster experiment explicit via **shadow-read** — controllers log the decision they *would* make on `qualityHealth` for the observation window while still steering on the old axis; promote (rewire) only when the shadow log shows the new axis steering better. Continuity preserved; the experiment is named, not straddled.

---

## Problem Inventory (the "things")

| ID | Problem | Evidence (this session) | Type |
|----|---------|--------------------------|------|
| **A1** | SVG "no valid SVG after 2 bounded direct attempts" | `SVGGenerator.ts:30` — only 2 attempts, no salvage loop; live daemon failure 2026-06-13T00:56 | reliability |
| **A2** | "Code is empty after stripping LLM reasoning text" | `CodeValidator.ts:330` — strip yields empty; live daemon failure 01:29 | reliability |
| **A3** | GLSL "Undefined function 'rot()'" | `GLSLValidator.ts:145` — rejects common helpers instead of prelude-injecting; live daemon failure 01:29 | reliability |
| **B** | Hydra weakest domain | floor 0.408 / top 0.78 (ledger 06-13) | quality |
| **C** | `music` phantom domain | `domains.ts:17` MUSIC enum, no registered generator, archive `music:0` forever | hygiene |
| **D1** | Health metric flat ~84.2% across all 115 cycles | `GardenHealthMonitor.measure` is occupancy/fertility-weighted → saturates at full archive | signal integrity |
| **D2** | Garden stagnation 50% | daemon log `stagnation=50%` | signal integrity |
| **D3** | Dream queue idle (+0 new, 39 done, 0 queued) | daemon `garden tend` log | signal integrity |
| **D4** | Taste model 0 human preference events | daemon `preferences train`: "Preference events: 0" | signal integrity |
| **E** | Composition pipeline reliability/quality unverified | `CompositionOrchestrator` exists + wired `bin/sinter:1453`; no end-to-end quality receipt | product surface |
| **F** | Go TUI retirement | ADR-0005 gate passed (#30); `bubbletea/` 22 `.go` files still present | tech debt |
| **G1** | Per-domain generator routing | only `three→M3` routed; calibration found per-domain wins unrouted | routing |
| **G2** | Archive re-score cadence | `quality:rescore` script exists, never scheduled | freshness |
| **G3** | Kinetic re-normalization decision | kinetic sealed at 0.85; needs Simon's renorm call | decision (Simon) |
| **G4** | `@sinter/core` extraction | open since 06-07 | architecture |

---

## Phase 0 — Diagnostic harness & instrumentation (FOUNDATION, do first)

**Why first:** every later fix claims a delta; we need a cheap, repeatable way to measure failure classes and quality without waiting on hourly daemon cycles.

- **0.1 Failure-class counter.** Add a structured `failureClass` tag to each daemon generation failure (svg_no_raw, empty_after_strip, glsl_undefined_fn, candidate_pool_empty, brightness_dark, ambiguity_reject, other) and aggregate per-cycle in the ledger. *Diagnose:* grep current failure strings → enumerate classes. *Verify:* one daemon cycle emits the new field; a 20-line aggregator script prints class counts over the ledger.
- **0.2 Seeded reliability replay.** A script that runs N novel prompts per domain through the real generator path offline (no daemon wait), capturing pass/fail + failure class. *Verify:* `pnpm reliability:probe --domain svg --n 10` prints a pass-rate and class histogram. Reuses `quality:rescore` rendering infra.
- **0.3 Baseline capture (FREEZE-GATED).** Before running: **pause `com.sinter.self-improve`** and confirm no pending `rescore --persist` (the rescore script itself warns concurrent saves race the archive). Only then run 0.2 across all visual domains once; commit baselines to `docs/validation/reliability-baseline-2026-06.md`. Un-pause the daemon after capture. This freeze is what stops every Phase-1 delta from floating on a renorm-shifted floor.

**Acceptance:** baseline doc exists with per-domain pass-rate + failure-class histogram; daemon ledger has `failureClasses`; daemon was provably paused during capture (no interleaved cycle in the ledger). No source-behavior change yet.

---

## Phase 1 — Generation reliability (HIGHEST LEVERAGE: ~doubles useful output)

Each item: reproduce live (novel prompt — never reuse, cache masks), root-cause, surgical fix, regression test, re-run 0.2 to show pass-rate gain.

- **1.A1 SVG raw-output failures.** *Diagnose:* capture raw provider output on the failing prompt class (the #33 contract reduced fences but markdown-fence/over-long-doc cases remain). *Fix candidates (pick by evidence):* (a) widen salvage in `SVGValidator` (fence-strip already added #37 — confirm it runs before the 2-attempt bail), (b) raise bounded attempts from 2→3 with a compact-contract retry on the 2nd, (c) length guard in the prompt. *Verify:* 0.2 svg pass-rate up; regression test on the captured failing payload.
- **1.A2 Empty-after-strip.** *Diagnose:* log the pre-strip payload for the failing case — is the model emitting *only* reasoning (generator/prompt issue) or is `stripReasoningText` over-eating valid code (`validators/types.ts:96`)? *Fix:* if over-eating, tighten the strip regex with a regression fixture; if model-only-reasoning, add a one-shot "code only" reprompt before bail. *Verify:* fixture test + 0.2 pass-rate.
- **1.A3 GLSL undefined helpers.** *Diagnose:* enumerate the common helpers models assume (`rot`, `hash`, `noise`, `palette`). *Fix (injection site corrected per Critic):* `GLSLValidator.validate()` is **errors-only** (no transform return), so injection wires on the **generation side at `ShaderGenerator.ts:76`** — when the validator reports an undefined-but-*known* helper, the generator prepends a vetted GLSL prelude and re-validates; genuinely unknown functions still reject. *Verify:* prelude unit test (rot/hash/noise compile) + 0.2 glsl pass-rate.

**Acceptance:** aggregate visual-domain completion in a seeded 0.2 run rises from the Phase-0 baseline. **The target delta per domain is recorded in the Phase-0 baseline doc; Phase-1 PRs gate against that recorded number** (the margin is a Phase-0 deliverable, not a vague "some margin"). Each class has a red-green regression test; one real daemon cycle (after `last-build-sha` reaches the merge commit) shows the classes dropping.

---

## Phase 2 — Self-improvement signal integrity (so the loop optimizes truthfully)

**Structure (revised per Architect):** D1+D2+D3 are a **causal chain** (stagnation is computed *from* health flatness + dream idleness), so they ship as **ONE workstream branch with internal commits**, not three daemon-racing PRs — splitting a coupled chain makes per-PR deltas float on a baseline the previous commit + ~30 intervening cycles already moved. D4 is independent (its own small PR).

- **2.D1 Health metric that *steers*, not just moves.** *Diagnose:* `GardenHealthMonitor.computeHealthScore` (`:118-129`) = `nicheOccupancy*0.3 + fertility*0.3 + taste*0.2 + min(1,occupancy*2)*0.2` → saturates at full archive. Critically, the score is an **actuator** read by `LoopMixPolicy.computeMix` (`src/autonomy/LoopMixPolicy.ts:72-86`) and `StagnationDetector` (`src/autonomy/StagnationDetector.ts:99-102` — NOT `src/core/StagnationDetector.ts`). *Fix (two evidence-gated steps):* (1) add a `qualityHealth` axis (floor/top-delta over a window) and run the two controllers in **shadow-read** — log the mix/stagnation decision they *would* make on the new axis while still steering on the old one; the shadow window must be measured **after the daemon's `last-build-sha` reaches the D-branch merge commit** (else the log captures pre-fix behavior). (2) After the shadow log shows the new axis steering better, **rewire `LoopMixPolicy` + `src/autonomy/StagnationDetector` to consume it** (the integration step — without it the axis is orphaned). *Verify:* shadow log shows divergence; post-rewire, `StagnationDetector` reflects real quality plateaus not occupancy. *Rollback:* if post-rewire cycles steer worse, revert the PR — the daemon auto-rebuilds the prior dist on the next HEAD advance. **(Highest-risk — solo review, no bundling beyond the D-cluster.)**
- **2.D3 Dream queue refill.** *Diagnose (re-located per Architect):* `DreamPlanner.plan()` actually fills to `maxTasks` while `entries.length ≥ 2` (`DreamPlanner.ts:53,106-114`), so "+0 queued at saturation" is most likely a **`DreamQueue` dedup/consumer** issue (already-seen recombinations rejected, or the consumer drains without re-enqueue), not a planner returning 0. Start the diagnosis at `DreamQueue.enqueue`/dedup, not the planner. *Fix:* per evidence — refill threshold or dedup-window adjustment. *Verify:* `garden tend` logs `dreams: +N`, N>0; queue depth recovers across cycles.
- **2.D2 Garden stagnation.** *Resolves downstream of the D1 rewire* (stagnation reads `healthScore`; once `StagnationDetector` consumes `qualityHealth`, the 50% number reflects real plateaus). *Re-measure after D1 rewire + D3;* only fix directly if still pinned.
- **2.D4 Human taste inlet (independent PR).** Mechanism exists (#30 `/taste` + GUI buttons) but 0 events. *Diagnose:* usage gap (no fix — just use it) vs wiring gap (events not persisting)? *Fix only if wiring-broken;* else document the manual step for Simon, leave judge-distillation as the honest default. *Verify:* a manual pin produces `preferenceEventCount ≥ 1` in `preferences train`.

**Acceptance:** `StagnationDetector`/`LoopMixPolicy` provably consume a fitness axis that moves with quality (not just an unconsumed ledger field); dream recombination non-idle; stagnation re-measured post-rewire.

---

## Phase 3 — Hydra quality + composition hardening

- **3.B Hydra.** *Diagnose:* render-measurement lane exists; sample the floor entries — is the cap from brightness/fog (known additive-`.brightness()` washout) or from generation variety? *Fix:* per the memory, generation-side clamps are proven not to work; focus on the render-measurement gate + craft-contract for hydra (#36 landed a hydra contract — measure its effect). *Verify:* hydra floor rises in seeded 0.2; no regression to good runs.
- **3.E Composition (may spawn a sub-plan).** `src/composition/` is ~5,666 LOC with a real `composeFromPrompt` entry. *Diagnose:* run `CompositionOrchestrator.composeFromPrompt` on 3 novel multi-domain prompts; grade the composite renders (LayerContract #619, CompositeRenderGate #43/#694 already landed). *Fix-or-spawn:* if receipts expose only a surgical seam/washout, fix in-PR; **if they expose a generation-side layer-contract class (per the LayerContract saga), pre-declare and SPAWN a sub-plan rather than promise an in-campaign fix** (same posture as G4). *Verify:* 3 composite render receipts with luminance + seam checks committed to validation docs.

**Acceptance:** hydra floor improves measurably; 3 end-to-end composite receipts prove the pipeline produces non-muddy layered works.

---

## Phase 4 — Domain hygiene + smaller threads

- **4.C Music phantom domain — QUARANTINE THE METRIC, don't rip the enum.** *Corrected scope (Architect):* `MUSIC`/`music` has **~81 references across 15+ source files** (`PromptBuilder`, `CodeValidator`, `RalphLoop`, `CreativeEvaluator`, `AmbiguityDetector`, `QualityArchive`, `VotingEngine`, …) — deleting the enum is a refactor with `undefined`-domain runtime risk, not hygiene. *Fix surface (pinned per Critic — the "~81 refs" conflated the real `src/music/` theory subsystem with the phantom domain; the actual emit site is small):* `music:0` is produced by `readPerDomainCounts(ARCHIVE)` consumed at `scripts/quality/self-improve-cycle.mjs:93,174` (`beforeDomains`/`afterDomains`) plus the archive domain map. Suppress `music` at those sites so `music:0` stops appearing; **leave the `MUSIC` enum and `src/music/` untouched.** *Diagnose first:* confirm whether `readPerDomainCounts` derives its list from stored archive entries or a static `Object.values(Domain)` enumeration — the latter needs a filter, the former just stops once no `music` entries exist. *Verify:* ledger `beforeDomains`/`afterDomains` no longer list `music`; no `undefined`-domain path introduced; tests updated. (Re-ranked: LOW-MEDIUM blast-radius once scoped to the emit site, not "hygiene.")
- **4.G1 Per-domain routing.** *Diagnose:* from the judge-calibration matrix, which domains have a better generator than the default? *Fix:* extend the `three→M3` routing pattern to the proven per-domain winners. *Verify:* routed domain's seeded pass-rate/score ≥ default.
- **4.G2 Re-score cadence.** *Fix:* add `quality:rescore` to a scheduled cadence (weekly) writing a dated report, NOT mutating the archive. *Verify:* one scheduled run produces a report.
- **4.G3 Kinetic renorm.** **Decision for Simon** (not an agent task) — present the kinetic-sealed-at-0.85 data and the renorm options; await his call. Tracked as a question, not a code task.
- **4.G4 `@sinter/core` extraction.** *Diagnose scope only this pass* — it's an architecture migration; produce a scoped sub-plan, do not execute inside this campaign unless trivial.

---

## Phase 5 — Go TUI removal (isolated, low-risk, last or parallel)

- **5.F** *Diagnose:* grep repo for every `bubbletea/` reference + TuiBridge symbol still consumed; confirm ADR-0005 gate (pin/reject parity #30) shipped (verified). *Fix:* delete `bubbletea/` (22 `.go` files) + dead bridge code in a dedicated PR; keep the CLI/agent substrate. *Verify:* `pnpm build` + full typecheck + GUI smoke green, zero remaining references, ADR-0005 updated to "TUI removed".

**Acceptance:** Go TUI gone, no broken references, GUI unaffected.

---

## Cross-cutting verification (every PR)
- `pnpm typecheck` clean · `pnpm lint` clean · related `vitest` green · coverage ratchet not lowered.
- Novel prompt for every live generation (cache-mask rule).
- Forgejo branch→PR→merge (main protected); regenerate lockfile if deps touched (renovate-trap lesson).
- Feed the lesson back: update the relevant validator/prompt/ledger/ADR, not just the code.

## Execution shape (recommended — revised per Architect)
- Phase 0 → sequential `ralph` (foundation, must finish first; freeze-gated baseline).
- Phase 1 (1.A1/A2/A3) → `/team` parallel, isolated worktrees — genuinely independent, honest deltas cheap here.
- Phase 2 → the **D-cluster (D1+D2+D3) is ONE branch** (causal chain, no daemon-racing splits); **D4 a separate small PR**. D1's controller rewire is the highest-risk change → solo review.
- Phases 3, 4, 5 → parallel to each other once Phase 1 lands; **5 (TUI) fully independent** but must coordinate with the live `fable-ops` worktree.
- **Hybrid atomicity rule:** atomic per-item PRs for independent work (1.A*, 4.G1/G2, 5.F); single coupled branch only for the D-cluster.
- Phase 2.D1 rewire and Phase 5 are the two solo-review items.

## Consensus record
- **Planner** drafted; **Architect** review (separate agent lane) surfaced the health-metric-as-actuator blind spot, the D-cluster atomicity self-violation, the corrected daemon mechanism (builds dist from main HEAD, silent previous-dist fallback), the 81-ref music blast radius, and the missing freeze gate — all folded in.
- **Critic** verdict: **APPROVE** (THOROUGH mode, 0 critical, 3 major = under-specified fix sites, now pinned: music emit site, `src/autonomy/StagnationDetector`, GLSL injection at `ShaderGenerator.ts:76`; Phase-1 margin made a Phase-0 deliverable; D1 rollback stated).
- **Open questions (carry into execution, not blockers):** does `readPerDomainCounts` enumerate domains statically or from entries (4.C); confirm `src/composition/` LOC reinforces the SPAWN posture (3.E).

## ADR
- **Decision:** Phased Diagnose→Fix→Verify campaign. Atomic per-item PRs for independent work (1.A*, 4.G1/G2, 5.F, 2.D4); the coupled D-cluster (D1+D2+D3) ships as ONE branch; Phase-0 instrumentation + a freeze-gated baseline gate all measurement.
- **Drivers:** 50% generation failure (dominant waste); a fitness signal that is flat AND an unexamined actuator; the feed-the-loop mandate.
- **Alternatives considered:** monolithic ralph/team (rejected — cannot produce honest per-fix deltas in a daemon-consumed shared worktree; isolation breach vs the live `fable-ops` worktree); diagnose-only (rejected — under-delivers the explicit "fix" mandate; its diagnostic spine folded into Phase 0).
- **Why chosen:** only the phased option both fixes everything and keeps measurement honest — the system's whole value.
- **Consequences:** more PRs and coordination overhead; in exchange every fix is measured, reviewed, and reversible; the named honest-signal-vs-continuity tradeoff is resolved by shadow-read, not straddled.
- **Follow-ups (not in-campaign code):** G3 (kinetic renorm) is a Simon decision; G4 (@sinter/core) and a possible 3.E composition sub-plan are scoped-but-deferred migrations.

---
> **STATUS: PENDING APPROVAL.** This is a planning artifact. No source changed, nothing committed. On your go, choose an execution path (below) and I'll start with Phase 0.
