# Overnight Mission Control — 2026-06-12 (Fable autonomous loop)

Goal: advance highest-leverage self-improvement seams; Fable = diagnosis/synthesis only; workers via pushing-dispatch (Claude workers: Sonnet/Haiku only).

## Loop 1 — seam: ledger observability vs displacement ratchet (~01:1x PT)

**Truth refreshed:**
- Checkout `~/workspaces/liminal` on `feat/generation-craft-contracts` @ 43e9b629 (= main). Dirty: `src/core/RalphLoop.ts`, `src/learning/ArchiveLearning.ts`, `src/llm/PromptBuilder.ts`, untracked `src/prompts/CraftContract.ts` + test — ANOTHER AGENT ACTIVE in this tree (RalphLoop.ts became dirty mid-session). Stay out of `src/`.
- Codex queue (`codex-window-tasks.md`): ALL 6 tasks done, PRs #22–#28 merged (see `codex-findings.md`).
- Daemon `com.sinter.self-improve` ALIVE (pid 97830), WorkingDirectory = this checkout, sleeping 1200s between cycles. `com.sinter.fable-watchman` loaded.
- `pushing-dispatch` works; `route --mode task` → `zai-glm` (non-Claude, restriction OK).

**Evidence (archive `~/.sinter/archive/quality_archive.json`, ledger tail, daemon log):**
- All 10 target domains at cap 20 (200 total); `archiveDelta=0` and health flat 84.3% across all recent cycles.
- BUT admissions ARE happening by displacement: newest entry timestamps hydra 05:27Z, svg 06:52Z, ascii 07:44Z TODAY — during cycles whose ledger says Δ+0. `QualityArchive.add()` (src/learning/QualityArchive.ts:180) = rolling top-20 by score.
- Targeting healthy: quality-aware arm of `pickUnderfilledDomains` targets capped-but-mediocre (top<0.9) = {hydra, svg, ascii, kinetic} — matches observed targets. `music` is a legacy empty bucket, NOT in DOMAIN_TEMPLATES — not a bug, document only.
- Score-scale contamination signal: kinetic floor=max=0.85 (all 20 entries identical 0.85), tone floor 0.9/max 1.0, strudel max 1.0 — old un-banded inflated scores form admission floors vs fresh banded honest scores (08:09Z cycle's ascii 0.72 rejected vs 0.82 floor).
- Integrity: ledger `codeSha` claims clean HEAD while daemon dist builds from this DIRTY tree (uncommitted src/ edits compiled in since 07:41Z build).
- Failure burn: SVG + Kinetic generators failed in most recent cycles (1–2 of 3 gens complete). NOT acting on this — likely lane of in-flight `feat/generation-craft-contracts` work; re-check after it lands.

**Worker launched:** `w-d1c0-task` (pushing-dispatch, executor auto, routed zai-glm) — ledger observability: add `admitted`/`floors`/`tops`/`dirty`/`branch` to ledger records via pure `diffArchiveAdmissions` helper + tests, isolated worktree, Forgejo PR. Full prompt: `worker-ledger-observability.md`. Acceptance: unit tests exact-value, node --check, vitest green, build green, NO real gen cycles.

**Result:** Seam diagnosed and converted to exact worker execution. Loop NOT frozen (displacement active) — but its own ledger can't see that, and stale-inflated floors may be suppressing legitimate admissions (Seam B, evidence pending).

**Next step:** Loop 2 — check `w-d1c0-task` status; dispatch Seam B worker (`worker-rescore-floors.md`, written and ready): bottom-2 per-domain re-score to quantify floor inflation. Then decide if archive re-normalization handoff to Simon is warranted (mutation = preference-dependent, NOT auto).

**Blockers:** none.

## Loop 2 — seam: taste signal reaching training (~01:5x PT)

**Truth refreshed:**
- Main checkout SWITCHED branches between loops: `feat/generation-craft-contracts` → `feat/rubric-climbing`; dirty now = `src/core/RalphLoop.ts`, `src/core/ScoringEngine.ts`. Other agent active in `src/core/**` — avoid.
- Daemon cycled 08:57Z normally. Taste training: 234 archive entries / 0 preference events / 418 pairs.
- Worker `w-d1c0-task` (zai-glm) ERRORED at 08:32Z — HTTPS read timeout in the zai executor, 0 tokens, task never started (log: `~/.local/share/pushing-dispatch/logs/w-d1c0-task.log`). `pushing-dispatch doctor`: all major executors nominally available.

**Worker management:**
- Ledger observability RE-dispatched → `w-4b0a-task` (kimi-coding), phase `starting` at check time.
- Floors rescore dispatched → `w-2661-task` (codex) ERRORED: **codex executor auth is dead** (OAuth refresh token already used; needs interactive `codex` re-login — SIMON ACTION). Re-dispatched → `w-1487-task` (minimax-m25).
- NEW seam worker dispatched → `w-e50c-task` (minimax): GUI pin/reject taste parity, handoff `worker-gui-taste-parity.md`.

**Seam diagnosed (Fable, evidence-backed):** the taste loop's human-signal inlet is structurally severed:
1. `Preference events: 0` — all 418 training pairs are `score-gap` auto-feed pairs derived from evaluator scores (`src/learning/PreferenceDatasetBuilder.ts` "Auto-feed (audit F7)" block). Training agreement 100% = the model fits the judge's own ordering. The garden's "replay bias ACTIVE" taste model is a judge distillation, not taste.
2. Only production `recordPreference` caller is the retired TUI path (`src/tui-bridge/TuiBridgeService.ts:1538`, reached via `/pin`//`/reject` commands gated on reviewManager candidates).
3. GUI has zero taste wiring — its "Reject" button (gui/src/App.tsx:1802) is merge-proposal dismissal (local state only).
4. Server-side parity ALREADY EXISTS (`recordReviewPreference` → train → `gardener.loadTasteModel`); only GUI client wiring missing. ADR 0005 names this parity as the TUI retirement gate → sanctioned work, dispatched as `w-e50c-task`.
5. Secondary fact: taste trains on repo-local SinterFS store (234 append-only entries, keeps displaced ones) — NOT `~/.sinter/archive/quality_archive.json` (200). Two stores by design; documented here so nobody "fixes" the mismatch blindly.

**Next step:** Loop 3 — verify all three workers' phases/output; if ledger-obs lands, confirm next daemon ledger line carries admitted/floors/dirty/branch fields.

**Blockers:** codex executor auth dead (Simon: `codex logout && codex login`).

## Loop 3 — verify + land worker output (~02:3x PT)

**Truth refreshed:**
- Other agent's craft-contracts branch MERGED to main as PR #29 ("craft contract on every generation path + exemplar quality floor"); checkout now on `feat/rubric-climbing`, dirty: FeatureFlags, RalphLoop, ScoringEngine (+tests). Daemon cycling normally (09:27Z).
- Worker results: `w-4b0a-task` (kimi, ledger-obs) DONE — implemented+pushed but NEEDS_GUIDANCE at the credential step (its sandbox blocks `git credential fill`); `w-e50c-task` (minimax, GUI parity) DONE — **self-landed PR #30, merged** (`3079ad8f`), e2e proof: preference event artifact + `trainFromProject()` preferenceEventCount ≥ 1, 118 bridge tests green; `w-1487-task` (minimax-m25, floors) ERRORED — 401 invalid bearer token (minimax-m25 executor auth broken; plain `minimax` works).

**Fable verification + landing (ledger observability):**
- Reviewed full diff (pure `diffArchiveAdmissions`, defensive parsing, add-only ledger schema, try/catch git probes) — sound.
- Ran acceptance in the worker's worktree: `node --check` both scripts OK; `vitest test/unit/quality` → **58/58 passed**.
- PR #31 already existed (worker created it pre-block); merged via Forgejo API (HTTP 200); `merge-base --is-ancestor` → confirmed on origin/main.
- Cleanup: ledger-observability worktree removed, local+remote branches deleted (incl. `codex/gui-taste-parity` remote).

**Floors worker re-dispatched (3rd executor):** `w-7c05-task` on `minimax` (proven via PR #30), with explicit NEEDS_GUIDANCE fallback instructions for the credential step.

**IMPORTANT deployment gap (recorded for morning):** the live daemon executes `scripts/quality/*.mjs` and builds dist from the MAIN checkout working tree, which sits on `feat/rubric-climbing` — i.e. tonight's merges (#29 contracts excepted, #30 taste parity, #31 ledger observability) are NOT live in the daemon until the checkout returns to main (or rebases). Merged-to-main ≠ running-in-daemon while another agent holds the checkout on a feature branch.

**Unverified:** GUI parity merged on worker's own test evidence (exact outputs pasted in findings); Fable spot-reviewed the design notes but did not re-run its suites (main checkout is on a different branch). Executor auth states (codex 401-refresh, minimax-m25 401-bearer) unverified beyond logs.

**Next:** Loop 4 — floors worker result; consider durable memory note + remaining seams (render scorer reliability already partly covered by rescore lanes; docs/claims truth).

**Blockers:** codex + minimax-m25 executor auth (Simon action; non-fatal — kimi/minimax cover).

## Loop 4 — floor-inflation evidence + decision handoff + durable memory (~03:0x PT)

**Worker result:** `w-7c05-task` (minimax, floors) DONE_WITH_CONCERNS — delivered fully and self-landed **PR #32** (merge `e5035de5`; ancestor-verified by Fable; `quality:rescore:floors` alias confirmed on origin/main; worktree/branches cleaned). Honest concerns disclosed: ~19 evaluator calls instead of 16 (first run truncated by a `head -3` misstep), nested-worktree misstep self-corrected.

**Evidence (16-entry bottom-2 rescore):** mean fresh−stored = **−0.063**; every domain except p5 negative. Worst: `hyd_e6b82c2a` 0.65→0.252 (−0.398), `thr_1653e2a6` 0.65→0.372 (−0.278). **kinetic SEALED** (all 20 stored at 0.85; fresh honest 0.78–0.82 can never displace); textgen/ascii partially sealed. Full lines: `codex-findings.md` § FLOOR RESCORE.

**Deliverables:**
- Decision handoff for Simon (mutation + spend — NOT auto-executed): `decision-archive-renormalization.md` — options A (class-mediated one-time re-score, recommended, ~200 evaluator calls, backup+--dry baked in, ready-to-paste dispatch command), B (judge-version field), C (do nothing).
- Durable memory written: `~/.claude/projects/.../memory/overnight-2026-06-12-self-improve-seams.md` + MEMORY.md index (also corrected the stale "pin/reject parity deferred" line).

**Rubric check:** 1✓ truth documented; 2✓ three seams fixed (#30, #31) or proven+handed-off (floor inflation); 3✓ all workers have prompts/acceptance/status; 4✓ Fable did only diagnosis/review/landing; 5✓ evidence cited throughout; 6✓ durable memory written.

**Next:** Loop 5 (light) — observe post-#29 daemon cycles (do craft contracts reduce SVG/kinetic generation failures?); then morning report.

**Blockers:** archive re-normalization awaits Simon's decision (handoff ready).

## Loop 5 — seam: daemon generation failure burn + deployment gap confirmed (~03:3x PT)

**Evidence (daemon log cycles 08:57→10:29Z + ledger jq):**
- **SVG hard-down: 100% failure in all 4 observed cycles** — `SVGGenerator: provider returned no valid SVG after 2 bounded direct attempts: SVG output must be a raw <svg> document` (`src/generators/svg/SVGValidator.ts:52`; failure record `~/.sinter/failures/1781258426690-830n822uf.json`). Timing: SVG still succeeded ~06:46Z cycle (admission 06:52Z); 100% fail from 07:41Z onward = exactly when craft-contract code (merged as #29) entered the daemon dist via the dirty tree. Hypothesis (unconfirmed): contract appendix breaks the raw-SVG output rule. Hydra also failed both slots ("All generation candidates failed") — out of scope, prior history.
- **Deployment gap empirically confirmed:** post-#29 ledger records (codeSha 5ea3b5b5) show `admitted`/`dirty`/`branch` = absent → daemon still runs pre-#31 scripts from the feature-branch working tree. Merged ≠ live, as recorded in Loop 3.
- 09:27Z cycle completed 0/3 — worst of the night; cycle efficiency is the top operational cost right now.

**Worker launched:** `w-72fc-task` (kimi-coding) — SVG hard-down repro-first fix, handoff `worker-svg-generation-hard-down.md` (mandatory raw-provider-output evidence; stop-and-report if no repro on clean main; SVG-path-only fix; never weaken validator; never touch src/core/**).

**Next:** Loop 6 — verify SVG worker outcome; compile morning report.

**Blockers:** unchanged.

## Loop 6 — SVG fix verified + landed; mission wrap (~04:1x PT)

**Worker result:** `w-72fc-task` (kimi-coding) NEEDS_GUIDANCE-at-landing but work COMPLETE: reproduced the hard-down with raw evidence (provider output markdown-fenced and/or truncated before `</svg>` under the #29 contract), implemented SVG-specific contract variants routed at all 4 PromptBuilder tiers, 3/3 novel-prompt gens pass (0.82/0.78/0.82), 1012 prompts+generators tests green, typecheck+build green, branch pushed with findings.
**Fable verification + landing:** reviewed full diff (scoped exactly; validator untouched; src/core untouched) → **PR #33 created + merged** (HTTP 201/200), `merge-base --is-ancestor a23e65be origin/main` OK, worktree + local/remote branches cleaned. **Security:** worker disclosed a leaked credential file `/tmp/netrc-svg` it couldn't delete — Fable removed it immediately (verified gone).

**MISSION COMPLETE — rubric passes.** 6 loops; 4 PRs landed (#30 taste parity, #31 ledger observability, #32 floor rescore, #33 SVG fix); 1 decision handoff awaiting Simon (`decision-archive-renormalization.md`); durable memory written. Remaining open: daemon still runs feature-branch working tree (picks up everything when checkout returns to main); hydra generation failures (prior history, out of scope); codex + minimax-m25 executor auth.
