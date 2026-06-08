# Living-Site Sensorium — End-to-End Verification (2026-06-08)

Verifies the engagement→sensorium consolidation merged in
[#606](https://github.com/KyaniteLabs/liminal/pull/606): that the living-site daemon's
**objective function is aesthetic/visual fitness**, and **PostHog engagement is telemetry
+ a tiebreaker only** (ADR 0002), proven through the real daemon decision path and the CLI.

## 1. Objective-function analysis (merged code)

`src/daemon/LivingSiteDaemon.ts` `evaluateChallenger` (post-#606):

- **Objective = aesthetic fitness.** Lines 146–148 compute
  `aestheticDelta = slot.challenger.fitness − slot.active.fitness`.
- **Decision** (lines 153–156):
  ```ts
  const challengerWins =
      Math.abs(aestheticDelta) > AESTHETIC_TIE_EPSILON   // 0.02
          ? aestheticDelta > 0                            // aesthetic decides
          : challengerScore > activeScore;                // engagement only on a tie
  ```
- **Engagement is telemetry.** `EngagementFitness.score()` (lines 150–151) feeds the
  `liminal_challenger_evaluated` / `_promoted` / `_rejected` `trackEvent` payloads
  (lines 158–195) and enters the decision *only* in the `else` (aesthetic tie).
- The 0.65 **visual deploy gate** lives in the generation path
  (`generateAndDeployChallenger` → `passesVisualDeployGate`), not in promotion.

Conclusion: matches "aesthetic = objective, engagement = telemetry + tiebreaker." ✅

## 2. Integration test — `test/integration/living-site-daemon-objective.test.ts`

Real modules exercised together: `LivingSiteDaemon` + `SlotManager` + `EngagementFitness`
(engagement scores computed for real). Mocked only at boundaries: PostHog (spied on a real
client), and the LLM (`RalphLoop`) / render pipeline (`RenderAndScorePipeline`) / generator
registration for the gate path.

| # | Scenario | Concrete setup | Expected | Result |
|---|----------|----------------|----------|--------|
| a | Higher engagement, **lower** aesthetic | active fitness 0.85 / engagement 0.10; challenger fitness 0.70 / engagement 0.95 | challenger **NOT** promoted (active stays `active-A`, challenger cleared) | ✅ |
| b | Aesthetic tie (Δ 0.01 < 0.02 epsilon) | active fitness 0.70 / eng 0.20; challenger fitness 0.71 / eng 0.90 | engagement breaks tie → challenger **promoted** | ✅ |
| c | Below 0.65 visual gate | render score 0.50; engagement seeded | challenger **rejected** (`visual_score_below_threshold`, visualScore 0.5); `getVariantEngagementMetrics` **never called** | ✅ |
| d | Aesthetic win despite **lower** engagement | active fitness 0.60 / eng 0.85; challenger fitness 0.90 / eng 0.15 | challenger **promoted** on aesthetic; `liminal_challenger_promoted` telemetry fires | ✅ |

All assertions use concrete values (no `toBeDefined` / no lone `toBeGreaterThan`).

```
 Test Files  2 passed (2)
      Tests  25 passed (25)   # 4 new integration + 21 existing unit daemon
```

### Mutation check (proves the guard is not vacuous)

Temporarily replacing the decision with the old engagement-only policy
(`const challengerWins = challengerScore > activeScore;`) makes exactly the
objective-function guards fail, then reverts cleanly:

```
 ❯ test/integration/living-site-daemon-objective.test.ts (4 tests | 2 failed)
     × (a) does NOT promote a higher-engagement challenger when its aesthetic fitness is lower
     × (d) promotes on aesthetic fitness even when engagement is LOWER, ...
      Tests  2 failed | 2 passed (4)
```

(b) and (c) still pass under the mutant — correct: (b)'s tie legitimately uses engagement,
and (c) is the gate path. So (a)/(d) are genuine ADR-0002 regression guards.

## 3. Real CLI smoke — `sinter site evolve --once --dry-run`

Built (`pnpm build`, 0 TS errors) and run against a throwaway `HOME` (so the state dir
`~/.sinter/site` is hermetic — note `SINTER_PROJECT_ROOT` does **not** redirect
`SiteCommand`, which uses `homedir()`). No LLM or live PostHog backend is touched.

**[A] PostHog unconfigured** — clean end-to-end execution:
```
[SiteCommand] Running single evolution cycle
[LivingSiteDaemon] PostHog not configured, skipping cycle
exit=0
```

**[B] PostHog configured + seeded slot/challenger** — reaches the real evaluation path:
```
[SiteCommand] Running single evolution cycle
exit=0   # (offline PostHog flush of the fake key logs a non-fatal network warning)
```
(The promote/reject *outcome* requires a live PostHog project for engagement readback, so
it cannot be forced hermetically; its semantics are proven by §2 + the mutation check.)

### Gap found and fixed: `site evolve` flags were ignored

The smoke surfaced a real bug: `bin/sinter`'s global flag loop consumes `--dry-run` into
`flags` and silently drops `--once` / `--slot` / `--interval`, but the `site` handler read
all four from `cmdArgs` — so **every `site evolve` flag was a no-op**. Notably
`sinter site evolve --dry-run` ran in **non-dry-run** mode (real mutations).

Fix (surgical, in the `site` handler only — parse from the full `args` array, not
`cmdArgs`): before the fix the smoke logged `[SiteCommand] Starting continuous evolution`
(continuous branch) despite `--once`; after the fix it correctly logs
`Running single evolution cycle`.

## 4. Verification commands

```
pnpm build   # exit 0 (0 TS errors)
pnpm lint    # exit 0 (eslint src/)
npx vitest run --coverage=false \
  test/integration/living-site-daemon-objective.test.ts \
  test/unit/daemon/LivingSiteDaemon.test.ts   # 25 passed
```

## Verdict

The merged consolidation holds end-to-end: **aesthetic fitness is the objective; PostHog
engagement is telemetry + a tie-only signal.** No objective-function regression found. One
unrelated CLI flag-wiring gap was found and fixed surgically.
