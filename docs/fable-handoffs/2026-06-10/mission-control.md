# Fable Mission Control — 2026-06-10

Session role: frontier strategist/investigator per `SinterPrompt1fable.md`. Budget-conscious; rote work becomes worker handoffs.

## Current repo truth (verified this session)

- **Branch:** `feat/f4-sing-wiring-test` at `8304107a` (1 commit ahead of main, content = the F4 sing wiring test from the investor-audit register).
- **PR state:** GitHub PR #699 open for this branch. **Forgejo is now the source of truth (Simon, 2026-06-10)** — GitHub is a mirror.
- **SHA divergence:** Forgejo's `feat/f4-sing-wiring-test` = `ce0b2011`; local/GitHub = `8304107a`. **Content-identical** (same tree, same parent `0174fe61`, empty diff) — the commit was recreated between pushes. Needs alignment to one SHA.
- **main:** local = Forgejo = GitHub = `0174fe61` (in sync).
- **CI:** zero GitHub Actions runs for PR #699 — explained by forge migration, but raises the live question: nothing under `.forgejo/workflows/`; all CI lives in `.github/workflows/`. Whether Forgejo Actions executes `.github/workflows` on the instance is **unverified** (API requires auth; no `tea` CLI).
- **Gates run locally:** `pnpm typecheck` exit 0 (verified). `vitest run test/unit/sing/pipeline-wiring.test.ts` → 4/4 passed, exit 0 (verified).
- **Dirty files:** `docs/validation/self-improve-ledger.jsonl` (+24 lines — live daemon appends, do NOT commit on this branch), `SinterPrompt1fable.md` (user's prompt file, untracked, leave alone), this `docs/fable-handoffs/` tree (session artifacts).
- **Preflight leads disposition:** "dirty ThreeValidator/ThreeGenerator files" = **stale** (committed in #696/#697). "ThreeValidator focused test failing" = **stale** (typecheck green; suite committed). "package=sinter, CLI sinter/liminal/lim, README=Sinter" = **verified** current.
- **Self-improve daemon:** LIVE — ledger appended 20:45Z and 21:48Z; archive 113→124; health 84.5; mean scores 0.81/0.84.
- **Investor-audit register staleness:** `docs/validation/investor-audit-register-2026-06.md` still lists F11/F7/F17 in the "open remainder" row, but #696 fixed F11 (three near-black), #697 fixed F17 (text-art centering), #698 fixed F7 (taste auto-feed). F4 closes when this branch merges. Remaining genuinely open: F5 (sing ffmpeg render stub), F10 (revideo render), F20 (bridge split), F19 (p5 contrast), F12/#637 lane.

## Active risks

1. **CI gate vacuum (HIGH, unverified):** if Forgejo merges happen without Actions runners executing `.github/workflows`, the coverage ratchet / quality checker / orphan gate are silently OFF for the source of truth.
2. **Docs mislead operators (HIGH):** README CI badge, `docs/launch/test-ci-truth-matrix-2026-05-01.md` (names GitHub checks + branch protection as the policy), AGENTS.md ("Issues tracked in GitHub Issues") all assume GitHub as gate.
3. Branch SHA divergence (MEDIUM, content-safe) — resolution requires a push decision (ask first).
4. Hygiene (LOW): idle clean worktree `.claude/worktrees/pr699-verify` (detached @ 8304107a; remove after F4 merges); 1 stash (`gallery-cleanup salvage` — meaningful WIP, keep).

## Decision log (FABLE-DO / HANDOFF / SKIP)

| Item | Decision | Why |
|---|---|---|
| State reconstruction | FABLE-DO (done) | Unknown-unknown discovery is the Fable mandate. |
| Forge-vs-GitHub CI truth | FABLE-DO (blocked on Simon: instance access) | Strategic, changes every other priority. |
| Branch SHA alignment | FABLE-DO after approval | Push/force ops require asking per boundaries. |
| Register staleness fix (F11/F7/F17 rows) | FABLE-DO (small, evidence-backed docs edit) | <10 lines, unblocks correct prioritization. |
| CI-truth-matrix rewrite for forge | HANDOFF after Simon answers | Mechanical once the new gate policy is decided. |
| F5 sing ffmpeg render | HANDOFF | Implementation slice, well-scoped by register. |
| F10 revideo render harness | HANDOFF | Mechanical harness extension. |
| F20 TuiBridgeService split | HANDOFF (design review later) | Broad mechanical refactor. |
| Mass docs Liminal→Sinter sweep | SKIP | Known intentional back-compat; low leverage. |

## Verification run log

| Command | Result |
|---|---|
| `pnpm typecheck` | exit 0 |
| `pnpm exec vitest run test/unit/sing/pipeline-wiring.test.ts` | 4 passed (4), exit 0 |
| `git ls-remote forgejo-ssh` main + branch | main in sync; branch SHA-diverged, content-identical |
| `gh run list --branch feat/f4-sing-wiring-test` | zero runs (forge migration explains) |

## Open blockers

- Forgejo instance access (API token or `tea` login) to verify PR + Actions state on the source of truth.
- Simon's answers on: forge CI status, GitHub mirror policy, divergence resolution.

## Fable budget strategy

~30 min spent on reconstruction. Next: small evidence-backed register fix (FABLE-DO), questions to Simon, then write worker handoffs for everything mechanical. Reserve remaining budget for the CI-gate architecture call and self-improvement-loop audit (Tier 2).

---

## Session updates (post-reconstruction)

### Simon's directives (mid-session)
- Forgejo = source of truth; **PRs merge on forge; GitHub = mirror of main**. Missing forge CI = infra gap actively being fixed; temporary gate = local verification + review-agent handoff. Branch divergence: adopt forge SHA.

### Events
1. Local branch soft-reset to forge SHA `ce0b2011` (working tree/dirty files preserved; trees identical).
2. GitHub force-align became moot: PR #699 was **closed unmerged at 22:42Z and its branch deleted** by the mirror flow. F4 now rides solely on the forge branch. FAB-002 → resolved.
3. **Tier-2 audit found FAB-009 (the session's headline unknown-unknown):** F7 (#698) was merged but NOT live — daemon pid 84637 (started 01:54) was executing the pre-merge loop body; zero `preferences train` log lines. Manual run proved the path (244 score-gap pairs from 130 archive entries, 0 human events, model persisted via SinterFS). Daemon restarted 23:39Z (`launchctl kickstart -k`, new pid 44968); restarted loop ran `preferences train` before its cycle. F7 is now live with runtime evidence.
4. FAB-010: `~/.sinter/taste/taste-weights.json` is a legacy artifact (no src/ references) — excluded as evidence.

### Verification run log (additions)
| Command | Result |
|---|---|
| `node bin/sinter preferences train` | exit 0 — 244 pairs, agreement 100%, model ref persisted |
| `launchctl kickstart -k gui/501/com.sinter.self-improve` | new pid 44968; log shows `preferences train` then `cycle start` at 23:39Z |
| `grep -c "preferences train" .quality/self-improve-daemon.log` (pre-restart) | 0 — proof of merged-not-live |

### Handoffs created (priority order)
1. `worker-handoffs/01-code-review-f4-sing-wiring-test.md` — inspect-only merge gate for the forge branch.
2. `worker-handoffs/02-forge-era-docs-truth-sync.md` — truth matrix/README/AGENTS.md/register catch-up.
3. `worker-handoffs/03-daemon-script-staleness-guardrail.md` — re-exec on script change (closes FAB-009 class).
4. `worker-handoffs/04-f5-sing-offline-mp4-render.md` — implement or honestly relabel.
5. `worker-handoffs/05-f10-revideo-render-grading.md` — last blind visual domain.

### Second work block (parallel to handoff execution)

- **Liveness sweep (FAB-012):** self-hosted GitHub Actions runner live on this machine since May 27 (precedent for a Forgejo `act_runner` — feeds FAB-001); gui + sing vite dev servers running for days (HMR mitigates — low); active Codex/omx session's goal ("UltraQA the Fable 5 prompt") is COMPLETE — no competing code work.
- **FAB-011 (design complete):** F12/F19 root architecture gap located — `RenderEvidencePerception.ts:27-28` discards the already-computed pixel stats (visibleRatio, uniqueColors, brightnessStd), so single-gen scoring never sees washout/contrast despite the data existing every iteration. Design: `render-measure-lane-design.md` (shared verdict module extracted from CompositeRenderGate, deterministic score cap, calibration gate against the graded gallery). Implementation: **Handoff 06** (`worker-handoffs/06-f12-f19-single-gen-render-measurement.md`).

### Third work block — F18 fixed (FAB-013) + external F4 merge (FAB-014)

- **External event:** main fast-forwarded to ce0b2011 — **F4 merged on forge**; main worktree switched to main; `pr699-verify` worktree removed externally. Handoff 01 is moot-as-merged.
- **F18 root-caused and fixed:** `CompositionOrchestrator.generateLayer` never passed `spec.background` into `buildLayerPrompt`, and the base layer — the only layer licensed (#619) to paint an opaque full-stage background — got its prompt back unchanged. The generator never heard the spec'd color → paper-signal (spec #fbfaf7) rendered dark, dusk-bloom (spec #1a1020) rendered pale. Fix = base-layer background contract (same prompt-contract mechanism as #619), wired through `compose()`. **Commit `92b8defc` on `fix/f18-base-layer-background`** (worktree `.claude/worktrees/f18-base-background`), red-green: 2 new tests failed before, 812/812 composition tests + typecheck 0 after, pre-commit related tests 68/68. **Unpushed — awaiting approval.** Owed follow-up: one live compose of paper-signal/dusk-bloom to receipt the LLM-behavior claim.

### Fourth work block — post-migration truth + second merged-vs-live incident (2026-06-11)

- **Simon's update:** Forgejo VPS migration done; HTTPS main = `ee5a54f0` is truth (Codex repaired drift + ran leak audit); stale branches cleaned; GitHub not truth. Unproven: API token, tea, SSH (22 rejects key, 2222 times out), real Actions runner run. Use HTTPS for repo-state.
- **Merged this window:** F18 fix (forge PR #1), F18 live receipt + ASCII foreground transparency fix (#3), handoff executions (#2: H02 docs sync, H03 daemon guardrail, H04 sing render, H05 revideo render, H06 render measurement) and `a2edd9fe` the Forgejo CI fast gate (H07 step 3).
- **FAB-015 (second merged-vs-live incident):** all of the above was DORMANT in the live loop — dist/ built 15:21 Jun 10 (pre-everything), and daemon pid 44968's loop predated the guardrail (bootstrap gap: the guardrail can't load itself). Fixed operationally: `pnpm build` (exit 0; `dist/render/LuminanceVerdict.js` present; F18 contract in dist) + `launchctl kickstart` → pid 20551 trained and cycled on fresh code (archive 143). Durable fix = **Handoff 09** (HEAD-moved dist rebuild + per-cycle `codeSha`/`distBuiltAt` ledger stamp).
- **FAB-016 (claim-vs-evidence audit of the executed handoffs):** calibration doc honest (escape hatch used; low-contrast stays opt-in pending labeled data); forge CI workflow sound; only unproven element is the runner itself (H07 probe pending).

### Fifth work block — H09 merged+live, runner proven executing, F19 calibrated (2026-06-11 early AM)

- **H09 (FAB-017):** reviewed (25-line diff, in contract), rebased onto forge main after repairing a sibling-divergence my own `| tail -1` exit-code masking caused (lesson: never pipe a gating git command through tail), merged + pushed as `ca395939`. **Proven live with zero manual ops:** daemon logged `HEAD moved none→ca395939 — rebuilding dist` at 04:56:11Z. Forensics: old process died mid-sleep, launchd respawned — H03's in-loop re-exec has still never fired; launchd KeepAlive is the outer guardrail.
- **Runner (FAB-018):** `vps-runner-01` (act_runner v0.6.1, labels incl. `ubuntu-latest`) picked up and ran tasks 71+72 for KyaniteLabs/liminal. Forgejo restarted 05:05Z mid-task-72 (SSH repair in flight: container listens on 22 now, new pubkey registered) → completed-green-run proof still pending one quiet-window push.
- **F19 (FAB-019):** labeled calibration delivered — `docs/validation/f19-calibration-2026-06-11.md` + `.quality/f19-renders/`. Washout rule alone: 50% FP rate ON THE ARCHIVE'S BEST WORK; `brightnessStd` separates (fog <=9.5 vs good high-key >=18.5); `LOW_CONTRAST_MAX_STD` unit bug (0-1 constant vs 0-255 measurement) means that verdict can never fire. Fix spec = **Handoff 10** (structure-aware verdicts + 6-fixture regression table).

### Sixth work block — loop closure (2026-06-11 ~06:45Z)

- **Handoff 10 executed by a worker and merged (`5a158156`)** — diff exactly in contract (LuminanceVerdict + its test + calibration doc; low-contrast branch deleted; labeled fixtures present). Post-merge verification: 39 files / 913 tests green across render+composition; typecheck implied by worker gate.
- **The self-updating loop closed twice unattended:** daemon ledger 06:00Z line is stamped `codeSha=5a158156` — merge → HEAD-moved rebuild → generation under the new verdicts, no human in the loop. This was the session's target end-state.
- **Branch hygiene:** deleted on forge: `feat/f7-taste-autofeed`, `fix/f11-three-subject-visibility`, `fix/f17-f10-harness-presentation` (squash-merge leftovers from GitHub-era #696-698; content verified in main) and merged `docs/fable-session-2026-06-10`. Forge now has only `main`.
- **Still open (Simon, 5-second check):** Actions tab run status for `355d1a7a`/`5a158156` — badge endpoint is auth-gated, runner log window aged out (debug logging flooded it). Then Handoff 07's deliberate-failure probe.

### Seventh work block — movement audit + telemetry fix (2026-06-11 ~07:45Z)

- **Quality movement (bounded, zero-generation audit):** rendered + vision-graded the newest post-fix archive entries. Pass-1 worst domains improved: three (lanterns, healthy), p5 (topographic ridgelines, good), kinetic (passable). SVG rows excluded (one-off harness wrap failure, known).
- **FAB-020 (new HIGH):** two near-black glsl frames archived at 0.85 (brightF 0, std ~4, vision-dead) prove the H06 rendered-score cap does NOT reach archive admission — uncapped evaluator score is what gets archived, and the dead frames now feed taste training as winners. Handoff 11 written (wiring trace + retroactive archive quarantine via class methods).
- **Telemetry fix shipped (`025a1860`):** FAILED tails were showing trailing INFO store-registration lines instead of the real error; cycle script now prefers the last error-bearing stderr line. Picked up automatically next cycle (cycle.mjs is re-invoked per iteration).
- **Watch-item:** cycles at 06:00/07:12 completed 1/3 each (validation failures, generation-side). n=2 — re-check after a few stamped cycles before investigating.
- Renovate appeared on forge (`renovate/configure` branch — Simon's infra).

### End-of-session repo state
- Branch `feat/f4-sing-wiring-test` @ ce0b2011 = forge. Dirty: self-improve ledger (daemon-owned, do not commit), `SinterPrompt1fable.md` (Simon's), `docs/fable-handoffs/` (this session's deliverables — commit/push left to Simon's call since the only open branch is the under-review F4 branch).
- Idle worktree `.claude/worktrees/pr699-verify` — remove after F4 merges on forge.
- Daemon healthy on new code: pid 44968, hourly, training each cycle.
