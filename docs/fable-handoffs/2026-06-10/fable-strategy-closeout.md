# Fable Strategy Closeout — 2026-06-11

Model-level synthesis of the full campaign (51 ledger cycles, 25 findings, ~20 merged fixes). Evidence: stamped ledger eras, archive state, `QualityArchive.add()` semantics. This is the strategic read; no implementation debt is created here.

## 1. Where the system actually is

Every layer of the loop is now live and evidenced: forge fast-gate green on the source of truth (task 440 @ `3b81a84a`); daemon self-updating (script-mtime + HEAD-moved rebuild guardrails, every ledger line stamped `codeSha`/`distBuiltAt`); calibrated render gates (structure-aware washout/dark + fog, labeled-fixture regression table); taste model training hourly AND steering replay (hydrated in `garden tend` since `b592a250`); dream lane producing distinct crossed themes; failures self-naming; five scheduled watchman passes with a three-runner cascade and the gate-silencing loophole closed.

## 2. The score paradox — read it correctly or every future decision is wrong

Ledger mean score fell from 0.78 (pre-stamp era) to ~0.35–0.55 (recent eras). **This is not regression; it is honesty arriving.** Pre-fix, fog scored 0.85 and dead frames 0.85–0.92 and they were *archived*, propping the mean. Post-fix, the gates crush weak gens to 0.06–0.35 — those scores now appear in the ledger and are correctly refused by the archive. The distribution bifurcated, exactly as calibrated gates should make it. Meanwhile the metric that matters held or rose: archive medians sit at 0.75–0.95 across all ten domains.

**KPI doctrine from here:** never read mean ledger score as quality. The honest KPIs are (a) admission rate, (b) per-domain archive floor/median. Current floors: strudel/textgen/tone 0.85–0.90; p5/glsl/three 0.65; hydra 0.75 (median 0.75 — the weakest median, but not broken).

## 3. The silent phase change: accumulation → curation

Six of ten domains are AT the 20-entry cap. `QualityArchive.add()` sorts by quality and keeps the top 20 — meaning **at saturation the archive is a displacement ratchet: every admission must beat the current worst, and the floor can only rise.** Nobody designed a "phase 2"; the system already has one. Two consequences:

- **The recent completion-rate dip is partly composition, not regression.** `pickUnderfilledDomains` now concentrates every cycle on the domains with room — which are exactly the hardest ones (hydra, glsl) plus textgen/tone. Cycles look worse because they stopped farming easy domains that are full.
- **Hydra does not need rescue.** n=17, median 0.75, targeted heavily *because it has room*. Its levers are already queued: H13 two-frame capture (kills the temporal-instability measurement class) and active taste bias. No drastic move warranted.
- **Textgen is the cheapest win on the board**: n=5 with the highest floor (0.90) and median (0.95) — the loop should fill it before grinding hydra.

## 4. Meta-analysis of the 25 findings: one failure family

Nearly everything found this campaign is the same disease — **state-evidence divergence**: a claim surface (doc, score, archive entry, running process) drifting from runtime truth.

- *Merged-vs-live* ×4: daemon loop body (FAB-009), stale dist (FAB-015), taste model never hydrated, guardrail bootstrap gap.
- *Measurement-vs-truth* ×4: brightnessStd scale contract (FAB-021), single-frame flip-flop (FAB-025), temporal decay (FAB-020), harness blindness (F14 class).
- *Agent-integrity* ×2: gate silencing (FAB-024), finding-id collision.

The cure that worked every time was the same move: **stamp the claim with its runtime evidence** — ledger lines carry `codeSha`/`distBuiltAt`, archive entries carry gen-time `renderMeasure`, sweeps carry consecutive-state, quarantines carry their measure. Adopt this as standing doctrine: *any surface that asserts system state must record what code and data produced the assertion, so divergence is one grep instead of a forensic investigation.* It converted three multi-hour investigations into one-line checks.

## 5. Stop doing

- Reading mean ledger score as a quality signal (see §2).
- Single-frame judgments on animated domains — anywhere (sweeps now require consecutive agreement; generation evidence gets H13).
- Treating hydra as the broken domain; treating archive Δ as the growth metric once a domain caps (track floor instead).
- Re-verifying closed handoffs (01–11 closed; 07's probe intentionally dropped; H12/H13 are future surfaces, not debt).

## 6. The next three highest-leverage moves (future surfaces, in order)

1. **H13 two-frame capture** — the largest open measurement class (temporal instability) and the principled end of single-frame ambiguity; also unblocks fair adjudication of the flagged p5 pair.
2. **Floor-aware ledger metric** — one field per ledger line (per-domain floor of targeted domains) so the curation ratchet becomes visible in the data the daemon already writes; textgen fill rides the same targeting logic.
3. **G010 pass-2 under the honest pipeline** — the investor-audit clean-pass criterion is finally measurable: re-grade domains/composites knowing scores mean what they say. The pass-1 grades (hydra D, p5 C+) were measured under an inflated regime; the comparison is now apples-to-apples.

## Post-pass-3 addendum — next-phase priorities (2026-06-11, campaign closed at `4e7f213c`)

Pass-3 PASSED (5 visual domains A-/A: glsl, hydra, p5, svg, textgen; none below B-; `docs/validation/g010-pass3-2026-06-11.md`). Priorities for the next phase, in order:

1. **Composition from the archive.** Assemble layered composites from curated archive-top entries (not fresh LLM layers): the engine, LayerContract, and CompositeRenderGate are all proven; ingredients are A-grade; generation cost ≈ zero. This is the next visible quality leap and the product's stated core.
2. **Package the proof.** The pass-1→pass-3 movement + 25-finding ledger + stamped-claims doctrine is the KyaniteLabs public-proof narrative ("a creative system that audits itself honestly"). Curate it into a shareable surface; no new engineering.
3. **Cadence stewardship.** 20-min cycles are right while textgen/glsl/hydra have cap room; at full saturation, the daemon should slow itself (cap-aware interval). Outputs per dollar is the performance metric, not cycles per hour.
4. **Hydra: no action.** Noisy per-gen yield + A-class archive-top = the curation ratchet working. Cap dynamics will retarget pressure automatically at 20/20.
