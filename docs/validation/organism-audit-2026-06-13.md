# Sinter Organism Audit — 2026-06-13

> Full zoom-out audit of the entire ML-inspired "cognitive organism" (132,436 LOC, 60+ subsystems),
> on two axes — **output quality** (does the user get good art?) and **code quality** (no dumb decisions) —
> through the **inference vs. deterministic vs. learned-local** lens. Seven read-only auditor agents,
> one per functional lane. Synthesized into cross-cutting themes below. No code changed in this pass.

## Headline

The inference-vs-deterministic **balance is mostly right where it's wired.** The disease is **wiring**:
the organism is a graveyard of sophisticated, well-built subsystems that are *computed-then-discarded,
write-only, or orphaned.* Most of the self-improvement loop's feed-forward channels transmit nothing.
Several "learned/adaptive" apparatuses (bandit routing, the autonomous gardener's selection, the
recombination engine, the trained taste model) are disconnected from the path that actually runs hourly.

So the answer to "how much should be inference?" for THIS codebase: the question is mis-framed —
**the honest judgment channels you already built are unwired, and the deterministic fallbacks that ARE
wired are keyword-counting theater.** Fix the wiring, delete the theater, and the inference/determinism
split largely sorts itself out.

---

## THEME 1 — The self-improvement feed-forward is broken (HIGH · both axes)

Almost every channel that should carry learning into the next generation is empty, write-only, or orphaned.

- **Adaptations are structurally empty.** `MetaHarnessIntegration.ts:227-233` is the only caller of
  `recordAdaptation` and hardcodes `success: false`. `TierBasedGenerator.getRecentAdaptations()` →
  `getSuccessfulAdaptations()` filters `success === true` and injects the result into every generation
  prompt — so it is **guaranteed to return `[]` forever**. The loop looks closed; it transmits zero.
- **Harness reflection is write-only.** `analyzeGeneratorThinking` (MetaHarnessIntegration.ts:245-360)
  spends a real harness LLM call per generation, then writes to a trace file + a `feedback` episode that
  **nothing reads back**. The high-confidence "auto-adapt prompt templates" branch is two `Logger.debug`
  lines — a confessed no-op.
- **StudioReflection → GuidanceEngine dead-ends at a UI string.** (PR #89, this session.) The taste
  signal is captured, persisted, and read back by `GuidanceEngine.createSessionTasteSuggestion`
  (GuidanceEngine.ts:278-306) — but the suggestion's `action` is an empty stub, it's emitted only via
  `onSuggestion?.()` to the UI (RalphLoop.ts:1505, gated behind chatMode), and **the `likes` are never
  injected into a generation prompt.** The sibling `createArchiveSuggestion` has the identical dead stub.
- **The trained taste model never reaches the autonomous daemon.** `TasteModelRuntime`/`ReplayBiasPolicy`/
  `loadLatestModel` are loaded ONLY in `TuiBridgeService.ts:264` (retired TUI). The daemon generates via
  `bin/sinter --prompt` → RalphLoop, which uses `ArchiveLearning` few-shot (genuinely wired) but never
  consults the taste model. Pins train a model the unattended generator never sees.
- **Orphaned proposers.** Cortex `ActionProposer` proposals, `SelfImprovementReflexEngine.classify`
  (runtime-core/SelfImprovementReflexes.ts:112-177, only exercised against a synthetic self-test), and
  `HarnessAgent.generateImprovementTask` all propose work nothing dequeues/executes.

**Net:** the daemon runs and burns inference, but "the organism learns" is mostly not transmitting.
The genuinely-wired channels are ArchiveLearning few-shot and (in chat-mode UI only) the suggestion display.

## THEME 2 — The evaluator-offline fallback is dishonest AND soulless (HIGH · output)

The inference-vs-deterministic crux. When the rendered LLM judge is unavailable (a documented recurring
ops state), the live path is keyword-counting that trains the organism toward garbage.

- **The honest aesthetic judge is built-not-wired.** `AestheticCritic.critiqueWithLLM` /
  `LLMJudgeCritic.analyzeWithLLMJudge` / the `'aesthetic'` ScoringEngine strategy (calibration, rubric
  bands, prompt tiering) have **zero production callers**. Tested, looks like the aesthetic core, never run.
- **The live fallback counts p5 API keywords.** `CreativeEvaluator.ts:453-535` scores "creativity"/
  "technical" by API presence: `usesAnimation +0.15`, `usesColor +0.1`, `usesClasses +0.15`,
  `codeLength>150 +0.1`. A verbose colorful sketch that renders garbage scores like a beautiful one.
  Under-inference: a rigid metric standing in for irreducible taste.
- **Failures lie as passes.** `LLMJudgeCritic.ts:255-261` returns `{ score: 0.5, passed: true }` on a
  failed/timed-out judge call. `ScoringEngine.scoreRenderedEvidence` does the same (0.5 + confidence 0),
  and RalphLoop then overwrites `candidate.score` with the keyword score while keeping `failureClass`.
- **The dead-zone LLM boost never fires.** `ScoringEngine.scoreReliable` `reliableLlmBoostEnabled`
  defaults FALSE; every RalphLoop call site constructs the engine with no llm, so the boost meant to
  break clumped scores is disabled in the live loop.
- **`detectErrors` is 4 hardcoded misspellings** (`creatCanvas`, `backgound`, …) → `+0.2 technical`.
  Theater; the real gate (CodeValidator + SandboxRunner) already runs first.

## THEME 3 — Routing-learning is entirely dead and writes garbage (HIGH · both)

- **Two routing tables.** `src/config/model-routing.ts` (hardcoded model IDs — violates "zero hardcoded
  models") is an orphan with zero production importers, kept alive by its own test. The live one is
  `src/routing/RoutingData.ts`. A future dev wires the wrong one.
- **The bandit is write-only.** `GeneratorBanditRouter` / `getOptimalModelBandit` / `route()` are never
  called for selection in the generation path; bandit state is in-memory and resets every process. The
  real model is fixed by RoleConfig.
- **The write path records lies.** `RalphLoop.ts:1511-1517` records routing outcomes with
  `domain: (collabDomain||'p5') as DomainType` — but real Domain enum values aren't valid `DomainType`
  keys — and `model: 'local'` HARDCODED (the provider is usually cloud MiniMax). Mislabeled, falsified
  data into a store nothing reads.

## THEME 4 — The retired TUI was load-bearing; its removal orphaned the executive + gardener (HIGH · both)

ADR-0005 retired the TUI as a *user surface*, but it was also the *only host* for two "core" systems.

- **Cortex runs only in the TUI.** The entire `src/cortex/` background executive is instantiated and
  `.start()`-ed only in `TuiBridgeService.ts:239`. Nothing acts on a cortex proposal.
- **The gardener runs only in the TUI.** `AutonomousGardener.start()` is called only from
  `TuiBridgeService.ts:266`. Its bounded `cycle()` (used by `garden tend`) computes taste-replay +
  promising-state selections and recombination, then **only increments counters / fills a report** —
  no selected entry drives a generation (bin/sinter:2623 ignores `tasteSelectedEntryIds`).

**Strong candidate for the documented "flat fitness signal":** the autonomous selection logic produces
no generations.

## THEME 5 — Deterministic guards that should replace fragile inference are no-ops (HIGH · output)

The inference-vs-deterministic inversion, concretely — the safety nets exist in code but don't run.

- **Composition transparency contract is a no-op for 3/4 domains.** The `compositionForeground` flag is
  plumbed from CompositionOrchestrator but consumed ONLY by the ascii branch (htmlWrapper.ts:250). For
  p5/shader/three/hydra the flag is dropped and the wrappers paint an OPAQUE `<body>` background — so a
  foreground layer occludes everything beneath, and the seam fix rests entirely on the LLM prompt contract.
- **`paintsOpaqueBackground` guard only covers p5** (LayerContract.ts:77-97); shader/three/hydra get the
  prompt contract but no deterministic verification.
- **The 4-role `provider` override never reaches the adapter.** `LLMClient.getProvider()` never passes
  the resolved `provider` to `createProvider()`, so an explicit per-role provider is silently ignored —
  routing is 100% URL re-detection. (Benign today only because the URL detector is robust.)

## THEME 6 — "Learned"/evolutionary machinery is computed-then-discarded theater (HIGH/MED · both)

- **RecombinationEngine blended descriptors are discarded.** `garden tend` / `dream run` compute
  interpolate/extrapolate/crossover/mutate child vectors, then throw them away; dream themes use the raw
  PARENT poles (`dreamThemeFromTask`). The mixing algorithms influence nothing.
- **AestheticModel self-supervises on the evaluator's own score** (`rating: evaluationScore * 5`,
  EvolutionIntegration.ts:86) — circular "learned aesthetic" that echoes the evaluator. (Gated off by default.)
- **MapElites tournament mis-scale** (MapElites.ts:287-305): `bestScore` seeded from raw fitness but
  candidates scored as `fitness*0.7 + diversity*0.3`, so selection collapses to pure fitness — the 0.3
  diversity weight is nullified. Live via ContextBuilder.
- **NoveltyIndex flattens at saturation** (NoveltyIndex.ts:48): normalized by the theoretical hypercube
  diagonal `sqrt(numAxes)` while realized distances are tiny, so novelty ordering is noise once full.
- **CompostRehydrator is computed-then-discarded** (CompostMill.ts:244); the real compost→generation path
  (SeedBank via `getGenerationMaterials`) is wired, but the rehydration tier is dead.
- **`src/nodeprompt/**` is entirely orphaned** — the concept-graph prompt-synthesis subsystem is reachable
  only via `TierBasedGenerator.enrichWithConceptGraph`, which has zero callers (no flag ever supplies a path).

## THEME 7 — The honesty signal is blind at saturation (MED · output)

`archiveDelta` pinned at 0 for ~30 cycles (self-improve-cycle.mjs:206; archive at capacity), `intraCycleTrend`
null (needs ≥4 gens, loop completes 1-3), health flat 84.1%, novelty flat (Theme 6). The loop can't see its
own improvement exactly when it matters. Already noted in MEMORY (overnight-seams). Fix: report
`admitted`/`floors`/`tops` quality deltas as the primary signal at saturation.

## THEME 8 — Reliability & correctness bugs (MED/LOW)

- **~36% gen-failure inside the self-improve loop** (306/479 ledger cycles complete); the top failure is
  `candidate_pool_empty` / "Registered 0 static generators" — an init/race in the spawned `node bin/sinter`
  child. A third of the recursion's fuel is wasted; cycles still append healthy-looking ledger rows.
- **`sinter live-music` feeds the LLM an empty prompt** (bin/sinter:1045 — wrong call shape for
  `generateMusic`; `options.prompt` is undefined). Whole command ignores the user's request, no error.
- **`isCodeComplete` brace-counting applied to SVG/GLSL/strudel/ascii** (RalphLoop.ts:1878) — domains with
  no braces or legitimately unbalanced brackets get mis-flagged → biases candidate selection.
- **Unseeded `Math.random()` in evolutionary ops** (RecombinationEngine.mutate, MapElites GA/tournament) —
  dreams/GA non-reproducible, can't A/B or regression-test.
- **Preference-event filename collisions** (PreferenceEventLogger.ts:251 — `action-ms` key) → rapid
  pin/reject bursts overwrite the scarcest signal (human taste).
- **Taste model positional axis weights** (TasteModelRuntime.ts:34) — no axis-name binding; a descriptor
  schema change silently applies weights to the wrong axes.
- **Luminance washout thresholds** hand-tuned on tiny labeled sets — correct instinct, brittle constants;
  a high-key white-on-white piece can get a false washout penalty (the loop learns to avoid valid high-key art).
- **Duplicate machinery:** two parallel novelty implementations (evolution/NoveltyArchive vs emergence/
  NoveltyIndex, different scales); `telemetry-seed.ts` orphaned; `composite`/`compose` adjacent CLI verbs
  (one live, one a vestigial analyzer over a removed video compositor).

---

## What's actually healthy (don't churn it)

- **CodeValidator + SandboxRunner gate before scoring** (RalphLoop.ts:586) — deterministic-first, correct.
- **The rendered-evidence LLM path** (`scoreRenderedEvidence`) is the honest core of aesthetic judgment,
  properly timeout-bounded; **luminance verdicts** correctly penalize washout/blank before/with the LLM.
- **The DreamQueue pipeline** (prune → enqueue → dequeue, `excludeKeys` dedup) is real, deterministic, and
  now correctly wired through the daemon — the historic `dreams:+0` saturation bug is genuinely fixed.
- **The archive taste tier** (pins/score-gaps → train → persist weights → bias replay) closes honestly —
  but only inside the interactive GUI (Theme 1/4).
- **ArchiveLearning few-shot** is genuinely wired into the daemon's generation path.
- **MAP-Elites placement, NoveltyIndex kNN, StagnationDetector at-capacity gating** are real, non-LLM,
  correctly deterministic.

---

## Prioritized fix shortlist (by leverage)

1. **Theme 2 — fix the evaluator-offline fallback.** Highest output-quality leverage. Make the
   deterministic fallback a low-confidence FLOOR/gate, never a "creativity" score; make judge failure
   return `passed:false`/degraded, never a passing 0.5; wire the real aesthetic judge OR delete it. Stops
   the organism training on garbage when the judge is down.
2. **Theme 4 — decide the cortex/gardener fate post-TUI.** Wire `AutonomousGardener` (+ optionally cortex)
   into the self-improve daemon, or explicitly retire them. Likely fixes the "flat fitness signal."
   **Needs Simon's call** (re-home vs retire).
3. **Theme 1 — close or honestly downgrade the feed-forward channels.** Fix adaptations `success:false`;
   inject the GuidanceEngine taste `likes` into the actual generation prompt (completes the StudioReflection
   work + the archive suggestion); route harness insight into the channel that's read. Or mark not-yet-closed.
4. **Theme 3 — delete or wire the dead routing apparatus.** Stop writing mislabeled garbage; wire the
   bandit + persist it, or remove the selection half. Kills a class of dishonest data.
5. **Theme 5 — make the deterministic guards actually run.** Composition transparency flag → transparent
   wrapper background for all 4 domains; provider override → `createProvider`. Cheap, high-correctness.
6. **Theme 7 — fix saturation blindness.** Report admitted/floors/tops deltas at capacity. Already scoped.
7. **Theme 8 — the 36% `candidate_pool_empty` / 0-generators bug** deserves a systematic-debug; the rest
   are smaller surgical fixes.

## Method note

7 read-only `general-purpose` auditor agents, ~10 findings each, file:line evidence required, severity-
ranked. One false positive caught and corrected by the orchestrator: the learning-lane claim that
`sinter chat reflect` "doesn't exist" — it does (bin/sinter:1514, daemon:68); the auditor scoped its grep
to `src/` and missed `bin/sinter`. The genuine half of that finding (GuidanceEngine dead-ends at a UI
string) is captured under Theme 1.
