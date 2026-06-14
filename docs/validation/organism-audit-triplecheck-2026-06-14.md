# Triple-Check Audit — Verified (2026-06-14)

> Adversarial re-verification of the 2026-06-13 organism audit + fresh independent deep-dig.
> **56 Opus 4.8 agents, 5.5M tokens, 4 loop rounds** (workflow `organism-audit-triplecheck`).
> 19 prior HIGH findings re-judged → **12 confirmed (all downgraded to MED/LOW), 5 partial, 2 refuted**.
> **179 new findings** (57 HIGH, ~40 unique after dedup). Below is the synthesizer's verified report.
> Method: each prior finding got an independent Opus skeptic prompted to *refute* it; 8 fresh
> concern-based personas dug in parallel; a completeness critic looped until 2 dry rounds.

---

# Triple-Check Audit — Final Verified Report: Sinter (Liminal) Cognitive Organism

**Scope:** ~132k LOC TypeScript at `/Users/simongonzalezdecruz/workspaces/liminal`. Synthesized from 19 prior-finding verdicts + 179 fresh findings, cross-checked against live `bin/sinter`, `scripts/`, dynamic imports, and barrels. Spot-verified 12 load-bearing claims against current code; all held.

---

## Verification result — prior HIGH findings

### CONFIRMED (12) — real defects, accept as written
| ID | Verdict | Corrected severity | One-line |
|----|---------|--------------------|----------|
| **C1** | CONFIRMED | LOW | `src/config/model-routing.ts` orphan duplicate of live `RoutingData.ts`; zero importers (verified); hardcodes model names. Dead, not load-bearing. |
| **E2** | CONFIRMED | MED | LLM-as-Judge path (`AestheticCritic.critiqueWithLLM` / `LLMJudgeCritic.analyzeWithLLMJudge`) built-not-wired; loop wires `setLLMClient` then calls sync `critique()`. Scope: only the LLM path is dead, not `AestheticCritic` wholesale. |
| **E3** | CONFIRMED | MED | Evaluator-offline fallback = `scoreReliable('detailed'→comprehensive→CreativeEvaluator)` = pure keyword/regex heuristics. Correction: `detectErrors` is 4 misspellings + brace check + 3 undefined-call patterns (`CreativeEvaluator.ts:606-640`), not "4 misspellings." |
| **X2** | CONFIRMED | MED | `SinterCortex` instantiated/started only in `TuiBridgeService.ts:239/257`; action proposals broadcast `publishEphemeral` (display-only), never executed. Nuance: bridge backs live GUI SSE, so not dead surface — but cortex actions are. |
| **X3** | CONFIRMED | MED | Per-generation harness LLM call (`AbortSignal.timeout(30000)`); writes `harness-insight-*.json` no reader parses + a `feedback` episode every consumer filters out by tag/domain; high-confidence branch = 2 `Logger.debug` no-ops. |
| **P1** | CONFIRMED | MED | `compositionForeground` flag consumed **only** by ascii branch; p5/shader/three/**hydra** drop it and paint opaque bodies. Correction: 4 visual domains lose it, not "3 of 4." Seam fix rests entirely on LLM prompt contract. |
| **P2** | CONFIRMED | LOW | `capLayerBrightness` changes opacity only, never `blendMode`; the `demoted N…to normal` log is permanently `0` and the wording is stale. Log-only defect; real render-gate works. |
| **L2** | CONFIRMED | MED | `GuidanceEngine` session-taste suggestion `action` is empty stub; only consumer records a display string. Confined to chatMode. |
| **V1** | CONFIRMED | LOW | `RecombinationEngine` blended descriptors discarded in every path; `candidateDescriptor:[]` is a dead store. Loop generates from raw-parent poles instead. |
| **G1** | CONFIRMED | MED | `generateMusic(livePrompt, {musicPlatform})` — **verified live** `bin/sinter:1045`. Signature is single-object; prompt → `undefined`. |
| **G2** | CONFIRMED | MED | Bandit fed every gen; `selectModel`/`getOptimalModelBandit` have zero production readers; `serialize/deserialize` never called → in-memory only, resets per process. |
| **G3** | CONFIRMED | LOW | Routing records written with hardcoded `model:'local'` + untyped domain cast; store has no production consumer. Dead, so no user-facing impact today. |

### PARTIAL (5) — accept the **correction**, downgrade
| ID | Corrected reality | Severity |
|----|-------------------|----------|
| **C2** | `getProvider()` drops the role-resolved provider hint, but role resolver used the *same* `detectProviderAdapter`, so re-detection is identical in all auto/default configs. Only breaks when a user hand-writes a `provider` contradicting URL/model. | LOW |
| **E1** | `analyzeWithLLMJudge` returns `{0.5, passed:true, usedLLM:false}` on failure — a real smell — but the sole caller gates on `usedLLM` and discards it; path is inert. Latent, not active. | LOW |
| **E4** | `scoreReliable` LLM boost off by default — but it's **intentional, documented, env-toggleable** (`LIMINAL_SCORE_LLM_BOOST` / `evaluationStrategy:'llm'`), not dead code. | LOW |
| **X1** | Adaptation loop carries zero signal, but via a *stronger/different* mechanism than claimed: `success` hardcoded false AND `ctx.recentAdaptations` never rendered by any `build*Prompt`. "Injected into every prompt" is **false**. | LOW |
| **L4** | `cycle()`-result taste selections are report-only (dead), BUT the gardener DOES feed generation via the **separate** persisted DreamQueue path (`bin/sinter:2644` → `self-improve-cycle.mjs`). Not a fully-severed loop. | LOW |

### REFUTED (2) — DROP, do not act
- **L3** — FALSE POSITIVE. The trained taste model **is** consumed by the unattended daemon: `garden tend` hydrates it into `AutonomousGardener`/`ReplayBiasPolicy` (`bin/sinter:2590-2616`, `AutonomousGardener.ts:183-187`). TUI bridge is no longer the only consumer.
- **G4** — FALSE POSITIVE (the exact bin/sinter-dispatcher miss the brief warned about). `sinter prompt synthesize --input <graph.json>` is a live command (`bin/sinter:2772-2802`) importing `synthesizePrompt` directly. Only the opt-in helper `enrichWithConceptGraph` is unused.

---

## New debt found (deduped, severity-ranked)

The 179 fresh findings collapse into ~40 unique defects after dedup (the bandit/routing defect appears 9×; live-music 5×; IntuitionEngine 3×; isCodeComplete 5×; etc.). Grouped below.

### A. HONESTY / FABRICATION (highest priority — corrupts the fitness signal and the release gates)

| # | Sev | File:line | Defect & fix |
|---|-----|-----------|--------------|
| H1 | **HIGH** | `RalphLoop.ts:1424` | **Archive admission ignores evaluator confidence.** Gate is `evaluation.score >= 0.65`; when evaluator is offline the keyword fallback readily hits 0.65-0.8 (confidence 0) and is persisted as a real exemplar that biases all future few-shot prompts. `addOutput`/`QualityArchive.add` record no `confidence`/`failureClass`. **Fix:** gate on `confidence>0 && failureClass∈{none,render}`; thread confidence into `ArchiveEntry.metadata`. |
| H2 | **HIGH** | `self-improve-cycle.mjs:147` | **Ledger records degraded fallback scores as real fitness;** `bin/sinter:1137` prints `Quality score:` with no degradation marker. Gen-failures collapse to unexplained `'other'` (`self-improve-domains.mjs:283`) because only a 200-char stderr tail is captured. **Fix:** print failureClass/confidence + `[degraded]`; capture full stderr; surface per-cycle fail-rate as a first-class ledger field. |
| H3 | **HIGH** | `CreativeEvaluator.ts` (`assessHydra:1135`, `assessThree:1026`, etc.) | **Default live fitness is regex API-token counting.** `emergenceScore`/`interestingnessScore` hardcoded 0; a sketch that name-drops `.modulate()`/`noise`/`.out()` scores high regardless of render. This score drives archive admission, routing, stagnation, and the "improvement" ledger. **Fix:** make rendered-evidence/LLM eval the default for visual domains; demote regex assessors to pass/fail syntax gate. |
| H4 | **HIGH** | `scripts/proof/ml-value-proof.ts:6` + `OpportunityScanner.ts:91-108` | **`proven` labels are hardcoded string literals** — `proofCommand` strings are never executed; `hasProof` only checks the strings are non-empty. `launch-risk-proof.ts:52` cites this as mitigation. **Fix:** actually run each proofCommand; set label from real pass/fail. |
| H5 | **HIGH** | `ModelAssimilationGauntlet.ts:21-55` | **Level-6 release gate `model-assimilation` check is structurally incapable of failing** — 5 checks all literal `status:'pass'`, `ready=checks.every(...)` always true. Consumed by `Level6ReleaseGate.ts:44`. **Fix:** derive status from a real audition or validated live receipt. |
| H6 | **HIGH** | `scripts/proof/model-assimilation-proof.ts:79-110,177` | **`--live` mode still computes promote/demote from hardcoded `fixtureCandidates`;** live receipt is only a side file. Gates Level-6. **Fix:** run real per-(role,domain) executions before ranking, or drop from the live gate. |
| H7 | **HIGH** | `MarketReadinessStatus.ts:44-49` | **`market status` READY verdict is 5/7 grep-for-string checks** (`sourceCheck` passes if literals exist in source). Only live-provider smoke runs anything. **Fix:** replace source-presence gates with receipt-backed execution checks. |
| H8 | **MED** | `gui/server.js:1134` | **Organism run returns hardcoded `finalScore:1`;** UI renders "score 1.00" for every organism run with no evaluation. **Fix:** score the output or stop emitting a numeric score for organism runs. |
| H9 | **MED** | `LLMJudgeCritic.ts:254` | Returns `passed:true` on judge failure (canonical silent-catch-returns-pass). Defused by one caller's `usedLLM` guard but unsafe contract. **Fix:** return `passed:false` on failure. |

### B. SELF-IMPROVEMENT LOOP — DEAD / WRITE-ONLY FEED-FORWARD (the "wiring disease" core)

| # | Sev | File:line | Defect & fix |
|---|-----|-----------|--------------|
| B1 | **HIGH** | `RoutingData.ts:106`, `GeneratorBanditRouter.ts:57`, `RalphLoop.ts:1511-1513` | **Routing bandit is the canonical dead loop.** Verified: `recordRoutingOutcome` fed every gen with **hardcoded `model:'local'`** and a domain cast (`as 'ascii'|'music'|'code'|'visual'`) that excludes the real domains (`p5`/`hydra`/`three`); read side (`getOptimalModelBandit`/`getRollingPerformance`/`getBanditStats`) has **zero production callers**; `serialize/deserialize` never called (resets per process); the only `route()` consumer `routeByPrompt` is itself uncalled. **Fix:** either wire `getOptimalModelBandit` into generator dispatch + persist state + record the real model + map domains to `DomainType`; **or** delete the bandit + recorder. |
| B2 | **HIGH** | `RalphLoop.ts:501,1252` | **IntuitionEngine re-instantiated empty every iteration.** Verified: two `new IntuitionEngine()`, zero serialize/deserialize callers. `generateHint` reads a cold cache; `recordOutcome` writes a GC'd instance; called with 3 args so model/strategy/embedding samplers are all guarded out. The four sub-modules (DreamEngine/CreativeWorldModel/ForgettingCurve/DomainPrototype, ~1,249 LOC) are never read back. **Fix:** hoist one persisted instance (deserialize at start, serialize after recordOutcome) or delete `--intuition`. |
| B3 | **HIGH** | `MetaHarnessIntegration.ts:352` | **Per-gen harness LLM insight discarded.** `analyzeGeneratorThinking` (LLM call, ~30s) writes a `thinking-analysis`-tagged episode no consumer queries + a JSON file no reader parses; high-confidence auto-adapt branch = `Logger.debug`. Most expensive feed-forward channel, zero downstream effect. **Fix:** have PromptBuilder/GuidanceEngine read `thinking-analysis` episodes, or gate the call off. |
| B4 | **HIGH** | `MetaHarnessIntegration.ts:91-95` | **Harness runs on the WRONG model.** Verified: spreads `providerFields` into `new LLMClient`, setting `explicitEndpointConfig=true`, which short-circuits role resolution so `roles.harness` (MiniMax-M3) is ignored → resolves to `defaultProvider` (GLM). `CompositionOrchestrator` studio role uses the correct `new LLMClient({role:'studio'})` and resolves right. **Fix:** drop the spread; use `new LLMClient({role:'harness'})` after `loadRoles()`. |
| B5 | **HIGH** | `RalphLoop.ts:1455` | **Aesthetic-model prompt hint appended to `usedPrompt`, which is re-initialized at the top of every iteration** (`RalphLoop.ts:459`) and computed *after* generation. The aesthetic model's only feed-forward channel is dead by variable lifecycle. **Fix:** route hints through `ContextAccumulation.save()` so they survive into iteration N+1. |
| B6 | **HIGH** | `RalphLoop.ts:1802` | **EmergenceHooks loop-closure wrapped in silent `catch {}`** (verified) — no Logger, while the routing handler 14 lines above does `Logger.warn`. A persistently-failing archive write silently stops all learning while the loop looks healthy. **Fix:** add `Logger.warn` mirroring the routing handler. |
| B7 | **HIGH** | `LoopConfig.ts:261,294`, `EvolutionIntegration.ts:47` | **Production novelty score is structurally always 0.** `useMapElites` defaults false, CLI never sets it, so `_noveltyArchive` undefined → novelty event always 0, stagnation-reset branch dead. **Fix:** construct a persistent noveltyArchive for the default path, or remove the always-0 novelty field + dead reset branch. |
| B8 | **HIGH** | `RalphLoop.ts:1179`, `LoopConfig.ts:283`, `self-improve-cycle.mjs:137` | **AestheticCritic never runs in the autonomous loop.** `useAestheticGuardrails` defaults false; daemon passes no `--aesthetic`. The dedicated "soul" critic contributes zero to autonomous fitness. **Fix:** pass `--aesthetic` (domain preset) in the cycle, or flip the default for the autonomous path. |
| B9 | **HIGH** | `StudioReflection.ts:62,104,126` | **`session-taste` producers have zero callers** → `createSessionTasteSuggestion` consumer always returns null. Fully built, fully disconnected. **Fix:** wire `reflectUnreflectedSessions` to a real trigger or delete. *(Note: a fresh refutation found `reflectUnreflectedSessions` IS imported at `bin/sinter:1521` for `sinter reflect`; confirm which is live before deleting — see Blindspots.)* |
| B10 | **MED** | `GuidanceEngine.ts:265,278` | Archive + session-taste suggestion `action` callbacks are empty stubs AND never invoked (`ConversationManager` only records a display string). Doubly dead. **Fix:** give `action` a real body that mutates next prompt + `await` it, or remove the abstraction. |
| B11 | **MED** | `RalphLoop.ts:1489` | MetaHarness→HarnessMemory→GuidanceEngine feed-forward fires **only in chatMode**; daemon `run()` path never sets `guidanceEngine`. The main learning loop gets none of it. **Fix:** construct GuidanceEngine in CLI `run()` when chatMode false. |
| B12 | **MED** | `bin/sinter:1555-1607` | `sinter consolidate` computes patterns then `process.exit(0)` discards them; daemon never runs it. **Fix:** persist consolidation output + add to daemon, or relabel as diagnostic. |
| B13 | **MED** | `StagnationDetector.ts:104` | SelfReflection input is live, but the designed `suggestedAction` is saved only to `usedPrompt`, which `buildContextForInjection` never reads — only the one-line `description` leaks. **Fix:** append the spec where ContextBuilder reads. |
| B14 | **MED** | `CompostSoup.ts:138` | `evolveNotation` updates a `notationEma` map whose only reader (`getNotationStats`) has zero callers; `mergeViaLLM` ignores it. Write-only learner. **Fix:** bias merge prompt by high-EMA tokens, or remove. |
| B15 | **MED** | `AutonomousGardener.ts:176,185` | In-cycle `recombine()` + `tasteSelectedEntryIds` are telemetry-only counts; the real dream→gen feed is the *separate* DreamQueue path. Cognitive work recomputed and discarded each cycle. **Fix:** persist in-cycle recombinations into DreamQueue or remove the in-cycle calls. |
| B16 | **MED** | `bin/sinter:2553` | `garden start` never hydrates the taste model (`garden tend` and TuiBridge do) — interactive replay silently falls back to fertility ranking. **Fix:** add the `loadLatestModel`+`loadTasteModel` block. |
| B17 | **MED** | `TuiBridgeService.ts:268` | GUI gardener started with axes provider `() => []` (CLI passes the real 6 axes). The only invested surface runs dream/novelty over a null descriptor space. **Fix:** source the real axis list. |
| B18 | **HIGH** | `QualityArchive.ts:180-198`, `ArchivePlacement.ts:62`, `EmergenceHooks` via `RalphLoop.ts:1786` | **Both archives gate purely on `qualityScore`** — novelty/emergence/niche never gate admission; `onCreativeRun` result discarded. The "quality-diversity" archive isn't diversity-gated. **Fix:** route emergence signals into admission (MAP-Elites placement or niche tie-break) or stop calling it diversity. |

### C. INTEGRATION DEBT — ORPHANED / DEAD SUBSYSTEMS (retire-vs-rehome decisions)

| # | Sev | Subsystem | Status & decision |
|---|-----|-----------|-------------------|
| C1 | **HIGH** | **Guardrails framework** (`src/guardrails/`, ~5.5k LOC) | Verified: `initializeGuardrailSystem` called at `bin/sinter:786`, returned registry **never evaluated** (`registry.evaluate` has zero non-guardrails callers). ~4,717 LOC functionally inert; Constitution/SelfHealing never even registered; TelemetryCollector feeds entropy but is never populated. **DECISION (human): ADOPT** (wire `registry.evaluate` into the LLM/gen path) **or RETIRE** (remove `bin/sinter:785-786,1336-1343`, decouple entropy). |
| C2 | **HIGH** | **`src/music/` theory engines** (TheoryEngine/MarkovChain/EuclideanRhythm/Arpeggiator/Rhyme/StructureTemplates, ~46KB) | Imported then `void`-suppressed (`generateMusic.ts:52-69`); `getStrudelCode`/`getP5WebAudioCode` are hand-written `prompt.includes()` templates calling zero engines. Pure capability theater. **DECISION (human): WIRE or rehome as standalone library.** |
| C3 | **HIGH** | **`ArtKnowledgeGraph` + `comprehensive-artistic-knowledge.ts` + `SemanticArtMemory` + `EpisodicMemory` (~2,540 LOC)** | Constructed and seeded on every `ConversationManager`/TUI hot path, then `void this.artBrain` discards it (`GuidanceEngine.ts:48`). Real construction cost on live surface, zero output. **Fix:** stop eager-constructing; rehome under `src/brain/archive/` or wire. |
| C4 | **HIGH** | **Model-Assimilation loop** (`ModelAssimilationGauntlet`, proof scripts, atlas/FINISH_LINE label) | No runtime audition/promotion path; constant-`pass` stub + fixtures + reporting label. The 3rd "core loop" exists only as dry-run. **DECISION (human): implement real audition + route registry, or relabel atlas/gate as fixture-only.** |
| C5 | **HIGH** | **Promotion/rollback tier** (`PolicyChangeManifest`, `GardenPromotionGate`, `GardenRollbackController`) | `PolicyChangeManifest` is in-memory Map, never persisted, never `.stage()`/`.promote()`'d → `ship garden` always "No promoted changes" exits 0 (looks like a passing gate); `ship rollback` always "Change not found." No autonomy/daemon coupling. **DECISION (human): wire with persisted manifest, or delete the ship/report-promotion branches + demote the tier to demo.** |
| C6 | **HIGH** | **TestFailureDetector / AutoFixOrchestrator** | `executeTestFailureFix` (`AutoFixOrchestrator.ts:205`) is a "not yet implemented" stub; the working `TestFailureDetector` exists 1 dir away, never imported. `sinter fix --test-failures` (advertised) routes into the stub. **Fix:** wire detector into orchestrator + export from barrel, or drop the flag. |
| C7 | **HIGH** | **Swarm generation path** (`GenerationOrchestrator.ts:192`) | Verified: `new SwarmOrchestrator(swarmConfig, {signal,onProgress})` passes **no `callOllama`**, so it always uses `defaultOllamaCaller` → 5 Ollama-only personas. On the default MiniMax/GLM install every persona errors; HeuristicScorer picks among error strings. `--use-swarm` is advertised. The provider-correct `CollaborationEngine` path that injects `callOllama` is itself unreachable (no `--collab` flag). **Fix:** inject the configured-provider caller into `generateWithSwarm`, or hard-fail on non-Ollama. |
| C8 | **MED** | **`config/model-routing.ts`** (237 LOC), **`ModelConfig.ts` load\* functions**, **`ModelRouter.ts` (swarm dup)** | Three parallel dead config/routing systems. `model-routing.ts` zero importers (verified). `ModelConfig` is a third role-resolution path reading only `process.env.LIMINAL_*`, ignoring config.json — the root condition behind B4. swarm `ModelRouter` re-implements Beta/Gamma already in `compost/ModelRouter`. **Fix:** delete; standardize on `RoleConfig`. |
| C9 | **MED** | **nodeprompt layout/gesture/store/extraction** (~2,300 of 2,555 LOC) | Only `synthesizePrompt` is reachable (via `prompt synthesize` CLI + unused `enrichWithConceptGraph`); the graph-*building* pipeline (SphereLayout/GestureEngine/GraphStore/extraction tools) has zero callers, and the CLI command dead-ends to stdout (never pipes into generation). **DECISION (human): vendored port — confirm 3D/gesture roadmap abandoned before shrinking to the synthesis renderer.** |
| C10 | **MED** | **Orphaned modules** | `CrossModalTransfer` (atlas label only), `DNAExtractor` (scavenger never run), `CompostBridge` (always undefined in `GitIntegration` → git+compost timeline empty), `OrganismLoop`/`generateMusicToVisual` loop (mode `'organism'` never set by any surface), `ReplayBundle`, `HoldoutCriticBus`, `FeedbackQueue` (superseded by PreferenceEvent path), `StyleBlender`, `CreativePreferenceExtractor`, `TaskDelegator`+`ResponseComposer`, `StudioAgent` class (only `STUDIO_SYSTEM_PROMPT` const is live), `voice→shape` Phase-2 (`VoiceToShapeMapper`/`FormantAnalyzer`/`BPMKeyDetector`), `TraceFSAdapter`, `SeedFSAdapter` (open W001), `HookSystem`. **DECISION (human, per no-deletion-of-unwired rule): rehome or delete in a batch PR.** |
| C11 | **MED** | **Calibration subsystem** (`CalibrationSuite`+`CorrelationCalculator`+8 `calibratedScore` branches, ~630 LOC) | `useCalibration && isCalibrated()` can never be true (no production caller of `calibrate`/`setCalibrationWeights`; nothing passes `useCalibration:true`). AestheticCritic's `applyCalibrationWeights` runs in `critique()` but is a permanent identity (map always empty; `setHarnessMemory` never called). Misleads readers into thinking scores are human-calibrated. Latent math bug: `findOptimalWeights` re-normalizes every gradient step. **DECISION (human): wire (add producer + flip flag + fix normalization) or delete.** |
| C12 | **MED** | **Plugin system** (`plugins/`, `PluginLoader`) | Verified: 9 manifests declare `entry:"index.js"`; **zero `.js` compiled** (tsconfig excludes `plugins/`), so all 9 dynamic imports throw ENOENT every cold start (5 entrypoints). Static generators do all real work. Logged as static count, masking 9 failures. **Fix:** delete plugins/ + loader, or compile plugins to dist + assert `>0` loaded. |
| C13 | **LOW** | **`src/composite/` + `index.ts` barrel** | `Compositor.ts` is a wired stub (`sinter composite`), NOT an orphan and NOT a dup of `CompositionOrchestrator` (different video-spec abstraction). The **barrel `src/composite/index.ts` (7 LOC) has zero importers** — genuine orphan. `sinter composite` is near-vestigial (~214 LOC video-era surface). **Fix:** delete barrel; **DECISION (human): retire `composite` command vs keep as spec linter.** |

### D. OUTPUT-QUALITY / DOMAIN MISROUTING (user receives wrong/garbage artifacts)

| # | Sev | File:line | Defect & fix |
|---|-----|-----------|--------------|
| D1 | **HIGH** | `registerGenerators.ts:135` | **Verified: bare `pattern` → strudel @ 0.65.** Common visual prompts ("flowing pattern of hexagons") produce a **music file** instead of art. **Fix:** remove bare `pattern`/`beat`/`bass`; require a music co-keyword; add regression test. |
| D2 | **HIGH** | `bin/sinter:1045` (= G1) | Verified live-music arg-shape bug → empty-prompt music, silent template fabrication. **Fix:** `generateMusic({prompt: livePrompt, platform:'strudel'})` + throw on empty prompt. *(GUI path is correct — `gui/server.js:1190`.)* |
| D3 | **HIGH** | **Nine incompatible Domain definitions** (`types/domains.ts:5` + 8 others) | Canonical enum has 3 shader labels (GLSL/SHADER/WEBGL) + 2 audio (TONE/MUSIC); `RoutingData` uses a disjoint union; `BehaviorVectors` uses `glsl` where others use `shader`. Root cause of every downstream domain bug + unchecked casts. Plus typo `REVIEWD='revideo'` propagated to 8 sites. **Fix:** single source of truth, collapse synonyms, map (don't duplicate). |
| D4 | **HIGH** | `CreativeEvaluator.ts:373` | **Type-lie zeros behavior vectors for shader/hydra/strudel/svg/ascii** — `options.domain as 'p5'|'glsl'|'three'|'music'`; a `shader` work hits `'shader'!=='glsl'`, all 8 GLSL features → 0; novelty/aesthetic computed on garbage. **Fix:** total mapping `shader→glsl`, `tone→music`. |
| D5 | **MED** | `CreativeEvaluator.ts:307,576,971` | Offline evaluator has **no SVG/kinetic branch** → raw `<svg>` scores 0.1 or p5-floor; `checkBasicSyntax` (brace balance) grants free "valid syntax" bonus to SVG/ASCII/textgen (zero braces = `0===0` true). Good SVG art invisible to fitness. **Fix:** add `assessSVG`; make syntax check domain-aware. |
| D6 | **MED** | `GLSLValidator.ts:141` | Built-in allow-list omits `radians/fwidth/transpose/...` → valid GLSL3 shaders false-rejected as "Undefined function." **Fix:** complete the list or downgrade to warning. |
| D7 | **MED** | `BehaviorVectors.ts:22` | Stale Hydra-before-Strudel misroute (#618 fix never ported here) → Strudel works get wrong feature extractor. **Fix:** port Strudel-before-Hydra ordering or call canonical detector. |
| D8 | **MED** | `RalphLoop.ts:1878` + `LLMClient.ts:1843` | Two naive `isCodeComplete` brace-counters; trivially-true for SVG/XML, miscount braces in strings/comments for GLSL/Strudel. Gates real early-exit (`CreativeIterationGate`). **Fix:** one shared, domain-aware, string/comment-stripping helper. |
| D9 | **MED** | `validators/types.ts:96` | `stripReasoningText` silently truncates leading lines of sparse ASCII/concrete-text art (partial truncation evades the empty-case rescue). **Fix:** skip stripping for ascii/textgen; detect partial truncation. |
| D10 | **MED** | `RalphLoop.ts:837` | GLSL `runtimeValid` gates nothing (log-only) and the `gl_FragColor` check rejects valid GLSL3. **Fix:** make it penalize/skip + accept `out vec4`. |
| D11 | **MED** | `CompositionOrchestrator.ts:259,319` | `paintsOpaqueBackground` seam guard is observe-only (Logger.warn) — seamed composite still ships to gallery; spec parser silently drops `difference`/`exclusion` blends the engine otherwise models. **Fix:** regenerate/demote seamed foreground; add the two blends to `validBlends`. |
| D12 | **LOW** | `swarm/HeuristicScorer.ts:108` | Offline scorer rates visual art by prompt-vs-source token overlap (meaningless for p5/shader); magic-number weights. **Fix:** flag degraded; base on render signals. |
| D13 | **LOW** | `RalphLoop.ts:1198` | Aesthetic penalty `score *= aestheticReport.score` inverts magnitude (worse aesthetics → harsher), and a low-but-passing score escapes untouched. **Fix:** penalty as function of threshold gap. |

### E. RELIABILITY / DATA-LOSS

| # | Sev | File:line | Defect & fix |
|---|-----|-----------|--------------|
| E1 | **HIGH** | `MiniMaxProvider.ts:152` (+ all providers) | **Caller `AbortSignal` silently disables the provider timeout** — `req.signal \|\| AbortSignal.timeout(...)`. When RalphLoop passes a deadline-less signal, the only time bound is removed → structural cause of the ~8-min hydra stall. No `AbortSignal.any` anywhere. **Fix:** `AbortSignal.any([req.signal, AbortSignal.timeout(...)])` in BaseProvider. |
| E2 | **HIGH** | **Non-atomic persistence, systemic** | Verified `QualityArchive.save` is a bare `fs.writeFile` (`:169`). Same pattern in `HarnessMemory.save:215` (whole feed-forward memory; corrupt-branch overwrites with empty state — wipes everything), `RoutingData:54`, `SinterFS.writeRef:71`/`writeManifest:150`, `bin/sinter:159` (config with API keys). No `writeFileAtomic` helper exists. **Fix:** add one `writeFileAtomic` (tmp+rename) util; route all JSON-state writers through it; quarantine HarnessMemory corrupt reads. |
| E3 | **MED** | `SinterFS.readRef:87` | Unguarded `JSON.parse` → a truncated ref crashes the GUI gallery server (`PreviewServer.ts:280/316`) and the taste-model loader (`TasteLearningService.ts:102`). **Fix:** catch → return null (matching `readAllArchiveEntries`). |
| E4 | **MED** | `registerGenerators.ts:394` | `registerAllGenerators` has no in-flight guard — concurrent cold-start callers (N parallel candidates) double-load plugins / race the registry. The documented "0-generators race." **Fix:** memoize a single init promise. |
| E5 | **MED** | `SiteCommand.ts:72` | `setInterval(run, …)` with no in-flight guard → overlapping cycles concurrently mutate SlotManager + `save()`. **Fix:** self-scheduling `setTimeout` after `await run()`. |
| E6 | **MED** | `HarnessMemory.ts:443`, `EmbeddingService.ts:192` | Serial embedding of up to 100 episodes blocks every memory query; `embedBatch` is falsely-documented sequential. `RetryManager.mapSettled` exists, unused. **Fix:** true batch request or bounded-concurrency map. |
| E7 | **LOW** | `HarnessMemory.ts:177` | 30s auto-save interval not `.unref()`'d (zero `.unref()` in src) + daemon `process.exit(0)` without `shutdown()` → can truncate in-flight save + lose ≤30s of episodes. **Fix:** `.unref()` + flush on exit. |
| E8 | **HIGH** | `LivingSiteDaemon.ts:311-336` + `PostHogClient.ts:142-154` | **Engagement sensorium doubly dead (verified):** injected script has literal `+` line prefixes → SyntaxError, zero events fire; AND read side queries `sinter_*` while client emits `liminal_*` → zero-row match even if events existed. ADR-0002-compliant tiebreaker (≤0.02 aesthetic gap) feeding a dead chain. **Fix:** strip `+`; unify property-key prefix via a shared constant; add a `new Function(script)` parse test. **DECISION (human): repair vs gate-as-deferred.** |

### F. SECURITY (untrusted LLM-generated code execution)

| # | Sev | File:line | Defect & fix |
|---|-----|-----------|--------------|
| F1 | **HIGH** | `HeadlessRenderer.ts:391` | **Live render path allows arbitrary outbound network requests** — `installLocalAssetFallbacks` calls `route.continue()` for unknown hosts (no allowlist/abort). LLM-generated `fetch`/`WebSocket`/`<img>` to attacker hosts run unimpeded (exfil/SSRF). `SandboxRunner` aborts these — but is never used. **Fix:** deny-by-default `route.abort()` for non-local assets in HeadlessRenderer/Renderer/CanvasRecorder. |
| F2 | **HIGH** | `SandboxRunner.ts:67` | **`runInSandbox` (the only network-isolated executor) is never invoked** — the real path uses `HeadlessRenderer`. The strongest isolation primitive is dead. **Fix:** route render through it, or delete to remove false security. |
| F3 | **HIGH** | `CodeValidator.ts:315` | Only the `html` validator screens `eval`/`fetch`/`javascript:`; p5/three/hydra/shader/tone get **structural checks only** then run as live JS in a browser with unrestricted egress (F1). **Fix:** apply a security screen to all JS-executing domains. |
| F4 | **MED** | `Renderer.ts:33`, `HeadlessRenderer.ts:182`, `CanvasRecorder.ts:58` | Live renderers hard-code `--no-sandbox`, bypassing `SandboxConfig`'s env gate entirely → OS Chrome sandbox off regardless of `LIMINAL_DISABLE_SANDBOX`. **Fix:** route launches through `getChromeArgs`. |
| F5 | **MED** | `ImportValidator.ts:13` | Dead security control (zero callers); also only checks fs paths, not JS imports. **Fix:** wire or delete. |

### Verified-CLEAN (do not re-investigate — recorded baselines)
Render-measurement signal IS wired (penalizes score 0.9→0.54, gates archive at 0.65, default `evalMode:'auto'`); GUI endpoints (30+) all hit live subsystems; TuiBridgeService JS service is the live chat backend (only the Go TUI is retired); GUI pin/reject taste loop #611 is intact end-to-end; creative-vocabulary engines reach prompts via CreativePreferenceGuide (chat-only); `src/agent` 15/17 modules live via GUI; `route-performance-budget.ts` / `mic-preview-browser-smoke.ts` / `user-surface-controls.ts` are honest proofs; `BehaviorDescriptorExtractor` does NOT zero non-JS (distinct from D4). **One nuance to flag:** the persisted taste model trained today (pairCount 698) was trained entirely from **score-gap auto-feed — zero human pins on disk**; the human inlet works but has never been exercised.

---

## Cross-cutting verdict

**The "wiring disease" diagnosis is correct, and the triple-check now makes it specific and quantified — but it is broader than a single pattern.** It is the dominant failure mode (the routing bandit alone surfaced 9× independently), and the prior audit was directionally right on all 12 confirmed HIGHs. There are **five distinct systemic patterns**, not one:

1. **Write-only / discarded feed-forward** (B1-B18, X1/X3/L2/L4) — every learning channel writes but no consumer reads, OR reads but the producer is dead, OR the result is GC'd/overwritten before the next iteration. The taste/pin→replay loop (#611) is the *only* fully-closed learning loop in the organism.
2. **Dishonest fitness + fabricated proofs** (H1-H9, D5/D12) — the score driving the entire archive is regex token-counting; degraded fallback scores are persisted indistinguishably from real ones; and the release/market gates (Level-6, `market status`, ml-value, model-assimilation) are grep-for-string or constant-`pass`. This is the most dangerous pattern: **the system cannot tell whether it is improving, and the gates that should catch that are themselves fabricated.**
3. **Domain-type fragmentation** (D3/D4/D7/D8, B1 domain cast) — 9 incompatible Domain definitions with unchecked `as` casts are the *root cause* of the routing keyspace mismatch, the behavior-vector zeroing, the misroutes, and the brace-counter blindness. Fix this once and ~6 downstream findings collapse.
4. **Non-atomic persistence + silent error swallowing** (E2/E3/B6, E8) — no atomic-write primitive exists repo-wide; corruption is a when-not-if for the archive/harness-memory/refs, and several catches swallow the failure with no log.
5. **Security theater** (F1-F5) — the strongest isolation primitives are built and never invoked; the live path executes untrusted LLM code with OS sandbox off and unrestricted network egress.

**Provider/config divergence** (B4, C8, the `getActiveProvider` ollama-vs-lmstudio default, FeatureFlags reading raw `process.env.LIMINAL_*`) is a sixth, smaller pattern that *causes* the harness-on-wrong-model bug — three overlapping config systems with different precedence.

**Is the diagnosis COMPLETE?** For integration/feed-forward/honesty/domain/persistence/security — **yes, this is now exhaustive within the audited surface** (every named subsystem was traced through `bin/sinter`, dynamic imports, scripts, and barrels, and the cross-checks I ran all confirmed). See Blindspots for the residual gaps.

---

## Zero-debt closure plan (prioritized by leverage)

**Tier 0 — fix first; these unblock or invalidate everything below.**
| # | Item | Effort | Human decision? |
|---|------|--------|-----------------|
| 0.1 | **Consolidate the 9 Domain definitions → one source of truth** (collapse GLSL/SHADER/WEBGL + TONE/MUSIC, fix `REVIEWD`→`REVIDEO`, replace casts with total mapping). Collapses D3/D4/D7 + B1's domain half + the routing keyspace mismatch. | **L** | No |
| 0.2 | **Add `writeFileAtomic` (tmp+rename) + route all JSON-state writers through it** (QualityArchive, HarnessMemory, RoutingData, SinterFS refs/manifests, config). Guard `readRef`. Fixes E2/E3. | **M** | No |
| 0.3 | **Make fitness honest: gate archive admission on confidence/failureClass; thread confidence into ledger + `bin/sinter` score output** (H1/H2). Without this, no "improvement" claim is trustworthy. | **M** | No |
| 0.4 | **`AbortSignal.any` in BaseProvider** (E1) — kills the hydra stall class. | **S** | No |

**Tier 1 — close the live feed-forward loops (decide retire-vs-rehome per channel).**
| # | Item | Effort | Human decision? |
|---|------|--------|-----------------|
| 1.1 | **Routing bandit** (B1/G2/G3): WIRE (record real model, map domain, persist state, consult `getOptimalModelBandit` in dispatch) **or DELETE**. | **M** | **Yes — wire vs delete** |
| 1.2 | **IntuitionEngine** (B2): hoist one persisted instance + pass real model/strategy, **or remove `--intuition`**. | **M** | **Yes** |
| 1.3 | **MetaHarness wrong-model fix** (B4) — drop the providerFields spread. | **S** | No |
| 1.4 | **MetaHarness insight + aesthetic-hint feed-forward** (B3/B5): consume `thinking-analysis`; route hints via `ContextAccumulation`. | **M** | No |
| 1.5 | **EmergenceHooks silent catch → `Logger.warn`** (B6). | **S** | No |
| 1.6 | **Autonomous loop consumes AestheticCritic + GuidanceEngine + novelty** (B7/B8/B11) — pass `--aesthetic`, construct GuidanceEngine in `run()`, build a persistent noveltyArchive. | **M** | No |
| 1.7 | **Live-music arg fix + strudel `pattern` misroute** (D2/D1) — two-line + keyword-table fix, both add regression tests. | **S** | No |

**Tier 2 — security + reliability hardening.**
| # | Item | Effort | Human decision? |
|---|------|--------|-----------------|
| 2.1 | **Deny-by-default network in HeadlessRenderer/Renderer/CanvasRecorder + security screen for JS domains + route through getChromeArgs** (F1/F3/F4). | **M** | No |
| 2.2 | **Decide `runInSandbox`/`ImportValidator` fate** (F2/F5) — wire as the single executor or delete. | **S** | **Yes** |
| 2.3 | **Init-race + reentrancy guards** (E4/E5), embedding batch (E6), interval unref (E7). | **M** | No |
| 2.4 | **Engagement sensorium** (E8): repair both ends (strip `+`, unify prefix) **or** gate as explicitly-deferred. | **S** | **Yes — repair vs defer** |

**Tier 3 — retire/rehome the dead subsystems (one batch PR per group, per no-deletion rule).**
| # | Item | Effort | Human decision? |
|---|------|--------|-----------------|
| 3.1 | **Guardrails framework** (C1, ~5k LOC): ADOPT or RETIRE. | **L** | **Yes** |
| 3.2 | **Music theory engines + ArtKnowledgeGraph + brain modules** (C2/C3): wire or rehome. | **L** | **Yes** |
| 3.3 | **Model-assimilation + promotion/rollback + fabricated proofs** (C4/C5, H3-H7): implement real audition/gates or relabel atlas/FINISH_LINE as fixture-only and tighten `Level6ReleaseGate`/`market status` to receipt-backed checks. | **L** | **Yes** |
| 3.4 | **Plugin system** (C12): compile-to-dist or delete. | **S** | **Yes** |
| 3.5 | **Config-system consolidation** (C8) + swarm provider injection (C7) + orphan batch (C10/C9/C11/C13/B12). | **L** | **Yes — per module** |

**Effort rollup:** Tier 0 ≈ 1 L + 2 M + 1 S; Tiers 1-2 are mostly S/M and parallelizable; Tier 3 is decision-gated L work. Most leverage is in Tier 0.1 (one refactor kills ~6 findings) and Tier 0.3 (restores trust in the fitness signal).

---

### Blindspots / coverage statement
Coverage of **integration debt, feed-forward wiring, honesty/fabrication, domain typing, persistence safety, and security** is now **exhaustive** within the source tree — every named subsystem was traced through the dispatcher, dynamic imports, scripts, and barrels, and my 12 spot-checks all confirmed the findings. Three residual gaps remain, none of which change the verdict:

1. **B9/StudioReflection contradiction:** one finding calls `reflectUnreflectedSessions` zero-caller; a fresh refutation found it imported at `bin/sinter:1521` (`sinter reflect`). **Resolve before deleting** — likely the `session-taste` *producers* (`recordTasteSignal`) are dead while the reflect entrypoint is live. (Low risk; one grep settles it.)
2. **Runtime behavior under real providers** was not executed (sandbox/cost) — all findings are static + the prior auditors' live reproductions. The two most consequential (live-music empty prompt, strudel misroute) were independently reproduced in the source dig.
3. **Go TUI (`bubbletea/`)** was treated as retired per ADR-0005 and not deeply audited; if it is ever revived, its domain-routing copy needs the Tier-0.1 consolidation applied too.

No finding in the 179-item set was found to be a *missed* false-positive of the bin/sinter-dispatcher class beyond the two already correctly refuted (L3, G4) — the fresh diggers were disciplined about checking `bin/sinter` and dynamic imports, which is why several "orphan" hypotheses were correctly cleared (Compositor, src/agent, GUI endpoints, render-measurement, taste loop #611).
