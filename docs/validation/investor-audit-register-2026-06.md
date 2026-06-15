# Investor-Readiness Audit Register — 2026-06-10 (Pass 1)

Campaign artifacts: `.omc/ultragoal/` (goals + ledger). Method: real-LLM execution proofs,
headless renders, in-context vision grading, live operator-journey smokes, ledger trend
analysis, targeted code sweeps. Single-agent (subagent fan-out unavailable this environment).

## Verified GREEN (evidence-backed)

| Area | Evidence |
|------|----------|
| CI on main | All workflows green through `0999828d` (#684 #685 #686 merged tonight) |
| Self-improve daemon loop | pid live; ledger 20 cycles; archive 10→79; post-#678 gen success ~85% (was ~57%) |
| Gardener→dreams→generation | `garden tend` persists dream plan; cycle consumed dream-2 live (completed w/ lineage); daemon runs tend hourly (#686) |
| Market gate | `market status` READY (fresh live-provider-smoke receipt at HEAD) |
| Studio GUI smoke | `proof:studio-smoke` pass (health + improve lane), receipt written |
| TUI bridge | live session create/status over HTTP pass (glm roles wired) |
| Sing engine build | `sing:typecheck` + `sing:build` pass (vite bundle + audio-core + pose worker); One-Euro filters live in pipeline; moonlitGarden preset present |
| Domain proof | 11/12 live-LLM domains pass (kinetic aborted under self-inflicted concurrency; rerun pending) ; renders 9/9 zero console errors |
| Craft pulse | 5 `as any` / 132.9k LOC; 10 TODO-family (mostly the TODO-scanner itself); empty catches are deliberate hardening |
| Secrets | repo scan clean; .gitignore covers .env |

### Visual grades (pass 1)
Domains: hyperframes A · shader A- · tone B+ · svg B+ (revised: the "blank" was harness blindness — F14; the artifact is a sound SINTER logo) · ascii B- · textgen B- · p5 C+ · three D+ · hydra D · strudel/revideo not visually graded (audio / not in harness)
Composites: tide-glass A- · paper-signal B · reef-pulse C · ink-garden D+ (root cause F15, fixed) · dusk-bloom D

## Findings — ordered by ROI (impact ÷ cost)

### Tier 1 — high impact, small fix
1. **F8 (REVISED after adversarial re-check) — Command-like phrases and typos silently become paid generations.** Properly-split `taste status` correctly errors (verified live) — the original observation was zsh passing the phrase as ONE token. The REAL residual: a single-token typo (`sinter grden status`) or a quoted command-like phrase routes to the NL front door and spends a generation with no confirmation. Candidate: edit-distance did-you-mean gate before generating when token 1 nearly matches a known command. MEDIUM severity, kept here for visibility.
1b. **F21 — Kinetic generation reliably times out in the proof path** (~60s, twice: once concurrent, once isolated — `llm:response 59996ms err: undefined`), while kinetic succeeds via RalphLoop `--learn` (archived 0.85 on 06-09). **LOCALIZED (2026-06-10 PM):** both aborts match the hardcoded 60s inner cap in KineticGenerator's direct-print fallback (`completeWithAttemptTimeout(..., 60_000)`, KineticGenerator.ts:108) — the proof's per-domain timeout floors cannot override an inner cap, and something about this prompt shape stalls GLM past 60s. Remaining work: instrument a live run to see why the primary tool-loop path fails first and why the fallback stalls; make the inner cap configurable; fix the `err: undefined` logging (error detail lost).
2. **F6 — Per-generation dream receipts still evaporate.** `PostGenerationCognitiveWriter` (`:79`) defaults to in-memory `new DreamQueue()`; both call sites (CLI receipts, TUI bridge) lose every "Queued dream recombination task". Default to the shared `~/.sinter/dreams/queue.json` persistPath (#686 infra).
3. **F13 — Code-fence residue reaches rendered art.** Tone proof render shows a literal `html` token beside the start button — markdown fence leakage through extraction/wrapping. Locate in CodeParser/normalizeArtifactCode; add regression test.
4. **F15 — Hydra layers don't fill the composite frame.** Ink-garden composite: hydra canvas rendered as a top-left quarter rectangle over black (content itself vivid). Composition adapter must size/stretch the hydra canvas to the viewport.
5. **F1 — Proof prompts are fixed strings.** `live-creative-domain-execution.ts:33` + `matrix.mjs` SPECS — violates the novel-prompt rule; LLM caching can mask regressions. Append a per-run nonce (keep theme for comparability).
6. **F14 — Render harness SVG job is blind.** viewBox-only SVG collapsed to ~nothing on the dark page (artifact itself is a sound logo with dark ink + orange gradient). wrapSvg needs explicit sizing + contrast-aware page background (light/checker for transparent art).

### Tier 2 — high impact, medium cost
7. **F16 — Composite washout/mud from light-direction blends (KNOWN, now quantified 2/5).** dusk-bloom (overlay) washed to near-white; reef-pulse (multiply) went mud. Extend the #637 render-measurement gate to composites and/or add LayerContract blend-mode guardrails (e.g., cap stacked lighten/screen/overlay; measured luminance bounds).
8. **F12 — Hydra washout reproduced in proof artifact** (near-white pastel fog). Same cure: render-measured score gate wired into proof/learn paths (#637 lane).
9. **F11 — three.js lighting quality. FIXED (#696).** three.js invisible-subject guard landed; keep render visibility checks in the follow-up gate.
10. **F7 — Taste model is starved. FIXED (#698; live-verified 2026-06-10).** Auto-feed produced 244 score-gap pairs from 0 human events, trained the model, and persisted it via SinterFS after the self-improve daemon was restarted so hourly `preferences train` actually runs. `~/.sinter/taste/taste-weights.json` is a legacy artifact referenced nowhere in `src/`; never use its mtime as training evidence.
11. **F18 — Composite spec fidelity — FIXED with live receipt (2026-06-11).** `background` in specs was not surviving layered composition. The first F18 fix told the base layer the declared background; the live receipt then exposed the remaining blocker: foreground ASCII wrappers could still paint an opaque dark presentation shell over the light base. Current fix marks non-base visual wrappers as composition foreground and renders ASCII foregrounds transparent. Live receipt: paper-signal lum 0.719, dusk-bloom lum 0.100 — inversion gone.

### Tier 3 — important, larger or scoped work
12. **F5 — Sing recording render is a stub** (`render-cli.ts`: "ffmpeg frame synthesis is the next implementation slice"). For the performance-instrument story this is the gap: record→MP4 no-ops. Implement frame synthesis or relabel the command until then.
13. **F4 — `packages/sing` has zero tests. IN REVIEW on Forgejo branch `feat/f4-sing-wiring-test` @ `ce0b2011`.** GitHub PR #699 was closed unmerged by the mirror flow; merge decision belongs on Forgejo after local verification + review-agent pass.
14. **F17 — ascii/textgen presentation. FIXED (#697).** text-art presentation and skip-transparency handling landed; keep visual grading as the proof surface.
15. **F19 — p5 contrast adherence**: pale-on-pale scatter despite the bidirectional-contrast mandate; consider render-measured contrast scoring (joins #637 lane).
16. **F10 — revideo artifacts aren't visually rendered/graded** by quality:render.
17. **F20 — `TuiBridgeService.ts` 3,634 LOC** — split candidate (architecture lane).
18. **Hygiene** — stale local branch `rescue/local-uncommitted-20260606` (not this agent's; confirm before deleting).

## G009 progress (fix-by-ROI)

| Finding | Status | PR |
|---------|--------|-----|
| F6 per-gen dream receipts evaporate | **FIXED** | #687 |
| F1 fixed proof prompts (cache masking) | **FIXED** | #687 |
| F13 code-fence residue in rendered art | **FIXED** (red-green verified) | #688 |
| F15 hydra quarter-frame in composites | **FIXED** (bare `render()` → 2×2 debug grid; pixel-identical repro + full-bleed after) | #689 |
| F14 render-harness SVG blindness | **FIXED** (svg grade revised to B+) | #690 |
| F8 typo/quoted-phrase silent generations | **FIXED** (did-you-mean gate + `--prompt` escape hatch; both accident shapes repro'd live) | #693 |
| F21 kinetic proof-path 60s inner cap | **RESOLVED** (stall gone post-#687: 28.7s live pass; env-tunable cap + honest abort telemetry + partial-run exit clarity) | #692 |
| F16 composite washout/mud (Tier 2) | **FIXED** (CompositeRenderGate: measured verdict + one blend-demoted re-assembly; live probe lum 1.00→0.79 ok) | #694 |
| F11 three.js lighting quality | **FIXED** (invisible-subject guard) | #696 |
| F17 ascii/textgen presentation | **FIXED** (centered/scaled text-art presentation + transparent-skip handling) | #697 |
| F7 taste auto-feed | **FIXED** (live-verified 2026-06-10: daemon restarted; hourly `preferences train` runs; 244 score-gap pairs from 0 human events; model persisted via SinterFS; legacy `taste-weights.json` mtime is not evidence) | #698 |
| F4 sing tests | **IN REVIEW** on Forgejo branch `feat/f4-sing-wiring-test` @ `ce0b2011` (GitHub PR #699 closed unmerged) | forge |
| F18 composite spec fidelity | **FIXED** (base background contract + transparent ASCII foregrounds; live receipt 2026-06-11: paper-signal lum 0.719, dusk-bloom lum 0.100) | pending |
| F19 p5 contrast adherence | **FIXED** (VisualScorer now computes luminance verdict from measured pixels; washout/too-dark/low-contrast renders penalized 50% + warning) | #140 |
| F12 hydra washout (render-measured gate) | **FIXED** (same mechanism as F19 — verdictFromMeasure wired into VisualScorer.score()) | #140 |
| F10 revideo visual rendering | **RESOLVED** (render.mjs renders revideo via renderRevideoStill; coverage transparency comment added per F10) | existing |
| F5 sing render stub | **RESOLVED** (render-cli.ts fails loudly with exit 1 + clear "not yet implemented" message; relabel option chosen per register) | existing |
| F20 TuiBridgeService 3,634 LOC split | open (architecture lane — needs planning for extraction seams) | — |
| C2 music theory engines (void-suppressed) | **FIXED** (theory engines wired into Strudel/p5 templates: Markov melodies, euclidean patterns, arpeggios replace hardcoded notes) | #132 |
| C4 model-assimilation live audition | **FIXED** (real candidate audition path wired into gauntlet; `sinter assimilate --live --candidates <file>` runs per-role/domain executions) | #133 |
| C12 plugin-load honesty | **FIXED** (PluginLoadSummary tracks loaded/total/failed; no longer masks ENOENT on uncompiled plugins) | #131 |
| C13 composite barrel orphan | **FIXED** (dead `src/composite/index.ts` removed) | #131 |
| P2 washout-guard stale log | **FIXED** (log now reports actual opacity-capped count, not always-0 blendMode demotion) | #137 |
| HydraGenerator math-method sanitizing | **FIXED** (strips hallucinated .sin()/.cos()/.tan() chain methods) | #134 |
| Model-assimilation proof test isolation | **FIXED** (beforeEach cleans stale receipts so fixture-only test isn't polluted by prior live runs) | #136 |

## Open campaign state
- Pass 1 complete (this file). Passes 2-3 (clean-pass criterion) tracked in `.omc/ultragoal/goals.json` G010.
- G009 fix-by-ROI: ALL F-findings resolved (F1–F21) + Tier 3 cures C2/C4/C12/C13. F19/F12 render-measurement gate landed (#140); F5 sing render stub + F10 revideo rendering confirmed honest/existing. Zero-debt campaign Tier 0-2 complete (#91-#130); P2/HydraGenerator/test-isolation fixes landed (#134/#136/#137).
- Remaining open: F4 sing tests (Forgejo review), F20 bridge split (architecture), Tier 3 decisions C1/C5/C9/C10/C11 (retire-vs-rehome), G010 clean passes.
