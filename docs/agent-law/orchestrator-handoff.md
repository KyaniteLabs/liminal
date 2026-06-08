# Sinter — Orchestrator Power Transfer & Continuation Handoff

> Handed off **2026-06-08** at `main @ da8a2ba3` (#609). Prior worker agents **A and B
> retired**. **Codex** is now the sole agent: orchestrator **and** executor. This document
> is self-contained — operate standalone from it.

---

## 0. What you are

You are the continuation engineer and orchestrator for Sinter. With A and B retired, you do
the work directly **or** spawn your own isolated workers — either way the **Doctrine (§4)**
applies. You decide priorities, write/execute changes, merge, and keep state honest.

---

## 1. Project

- **Repo:** `~/workspaces/liminal`. The directory and GitHub remote keep the **old name
  "liminal"**; the **product / CLI / npm package are "sinter"**. Remaining `liminal`
  references are **deliberate back-compat** (`LIMINAL_` env mirror, `~/.liminal` migration,
  repo/go-module names, runtime globals, the English word "liminal"). **Do not "fix" them.**
- **GitHub for PRs/CI:** `KyaniteLabs/liminal` (use `gh`).
- Sinter = creative-coding generation + self-improvement engine. CLI entry `bin/sinter`.
  `src/` → `dist/` via `tsc`. Config: `~/.sinter/config.json` + `SINTER_*` env (`LIMINAL_` mirror).

---

## 2. Exact current state (verify with §7 before acting)

- `main @ da8a2ba3` (#609), synced with origin (0 ahead / 0 behind).
- Working tree may show `docs/validation/self-improve-ledger.jsonl` modified — written by the
  **`sinter-self-improve` cron** (§6), not an agent. **Not a code change; don't commit it.**
- Open PRs: **none.**
- Worktrees/branches were cleaned at handoff (Agent A's stale worktree removed; the `[gone]`
  branches `feat/close-accumulation-gaps`, `feat/sing-engine-phase5`,
  `fix/operator-path-validation` pruned).
- Active cron: `0 */6 * * * … node scripts/quality/self-improve-cycle.mjs 3 … # sinter-self-improve`.

---

## 3. What landed this session (all squash-merged to main)

| PR | Summary |
|----|---------|
| #605 | `fix(test)`: isolate Sinter object store via `SINTER_PROJECT_ROOT` (`.sinter` test-leak root-cause; also honors legacy `LIMINAL_PROJECT_ROOT`; test setup → per-file tmpdir). |
| #606 | `fix(living-site)`: scope PostHog engagement to **sensorium** (ADR 0002) + dedup audit. Daemon promotes on **aesthetic** fitness; PostHog = telemetry + tiebreaker only. FitnessCombiner engagement weight 0.25→0; dead `EvolutionIntegration.engagementScore` removed. Orphaned `liminal-sites` fork worktree disposed; tip kept as tag `archive/living-site-quality`. |
| #607 | `feat(autonomy)`: garden archive hydration (**RSI gap #2**). Gardener hydrates persisted emergence experience (was planning over `[]` cold). Pattern: `EmergenceHooks` writes `archive/<id>` to SinterFS; `SinterFS.listRefs` + `ArchiveEntries.readAllArchiveEntries` + `EmergenceHooks.hydrateArchive` read back; wired in `TuiBridgeService`. Proven cold 0 → hydrated 3. |
| #608 | `test(living-site)`: e2e proof aesthetic=objective, engagement=sensorium + a CLI flag fix. |
| #609 | `feat(agent)`: close **session-resume** accumulation gap (#607 pattern). Sessions now persist **and** hydrate so `/sessions` accumulates across restarts. Includes the accumulation audit. |

### 3b. Accumulation audit result

`docs/validation/sinter-accumulation-audit-2026-06-08.md` — the "written to SinterFS but never
read back" sweep is essentially **complete**:

| Write path | Accumulates? | Note |
|---|---|---|
| Session turns/manifest | **FIXED (#609)** | was the HIGH gap |
| Archive entries (QD) | OK | fixed #607 |
| Cortex goals | OK | already hydrates |
| Task ledger | OK | |
| Gallery versions | OK | |
| `SinterFS.recordRun` | NO reader, **LOW** | audit/telemetry log, not behavior; adding a reader nobody consumes = manufacturing — skip |
| `writeArchiveState` | dead path | zero callers |
| `PreferenceEvents` adapter | never called | no active writer |
| **Taste model** (preferences→train→weights→replay) | **broken, OUT OF SCOPE of the surgical sweep** | unwired scaffolding on **both** sides — `TasteModelTrainer.train()`, `AutonomousGardener.loadTasteModel()`, `PreferenceEventLogger` have no product call sites; `/pin` only updates in-memory review state. Closing it is a **multi-joint feature** (capture → persist → train → persist-weights → hydrate → wire). **Largest open self-improvement opportunity.** See §5. |

---

## 4. Orchestrator / engineering doctrine (non-negotiable)

- If you spawn workers: each gets its **own git worktree + branch**; parallel lanes must be
  **file-disjoint**; never run parallel workers in the shared `main` checkout.
- **Never commit to main.** Flow: branch → PR → squash-merge (`gh pr merge <N> --squash
  --delete-branch`) → remove worktree + delete local branch. A local branch can't delete while
  a worktree holds it — that's expected; clean the worktree.
- Before claiming "clean": check `git status --porcelain` (the `??` lines) **and** `git worktree list`.
- **karpathy-guidelines:** simplest sufficient change; surgical edits; state assumptions up
  front; define concrete verification **before** claiming success. If a thing already works,
  mark it OK — **don't manufacture a fix.**
- **Integration-first:** every new module needs a real call site (no orphans/stubs); every
  task ends with a verifiable CLI/test run. Orphans are defects (pre-commit blocks them).
- **Test quality** (CI + pre-commit enforced): concrete assertions (`toBe(value)`/`toEqual(shape)`,
  **not** lone `toBeDefined`/`toBeGreaterThan(0)`); mock at boundaries not internals; `vi.hoisted()`
  for mock vars in `vi.mock` factories; cover error paths; `test/integration/` must exercise
  ≥2 real modules. Coverage ratchet only goes **up**.
- Every image/art generation uses a **never-before-used prompt** (reused prompts hit the LLM
  cache → stale artifacts that mask whether anything ran).
- **Vision/image grading is yours alone** — text-only workers can't see images. Never delegate
  visual QA. Use `pnpm quality:render` / `quality:matrix` and judge with your own eyes.
- **No fake fallbacks.** The codebase does **honest degraded scoring** (`ScoringEngine`: "infra
  unavailable → score 0, confidence 0, failureClass 'infra'"; "do not mark degraded evaluator
  fallback as release-ready"). Do **not** add provider-fallback shims/workarounds — that's slop
  the architecture explicitly rejects.

---

## 5. Self-improvement loop — status, the honest caveat, next frontier

- **Accumulation is now solid:** the QualityArchive path (`RalphLoop`, gated by `--learn` /
  `useArchiveLearning`), the garden/autonomy path (#607), and sessions (#609) all persist+hydrate.
- **"Gets better every cycle" is NOT proven** — only accumulation is. A rising quality/diversity
  trend needs many cron cycles **plus periodic vision audits** (you, on the latest gallery) to
  guard against the evaluator Goodharting its own score. **Never trust the number alone.**
- **Next frontier (highest leverage):** wire the **taste/preference learning loop** end-to-end
  (§3b) — capture preferences → persist → train → persist weights → hydrate → bias replay/
  generation. Currently dead scaffolding on both ends. Scope it as a multi-step feature
  (brainstorm → plan → TDD), not a one-shot. It is the biggest unrealized self-improvement capability.

---

## 6. Providers / env / evaluator / cron (current reality)

- **GLM (z.ai)** = active workhorse. **MiniMax** (studio role) hits 5-hour token limits.
- **NUCBOX evaluator** (qwen @ `100.113.174.74:4000`) is **OFFLINE** → scoring runs **DEGRADED
  by design** (honest scoring, not a bug). For a reliable score: repoint the `evaluator` role
  to GLM in `~/.sinter/config.json` (back up first) and **restore after**. Do **not** code an
  auto-fallback (§4).
- Roles (`src/config/RoleConfig.ts`): generator(0.7) / evaluator(0.2) / harness(0.5) / studio.
- `SINTER_PROJECT_ROOT` overrides where the `.sinter` object store is created (defaults to cwd);
  test setup points it at a tmpdir so loop/preview tests don't leak into the repo tree.
- The **`sinter-self-improve` cron** runs every 6h on the **degraded evaluator** → it accumulates
  low-confidence entries and dirties `self-improve-ledger.jsonl`. **Decision for you:** either
  (a) restore a reliable evaluator first, or (b) disable the cron until then:
  `crontab -l | grep -v sinter-self-improve | crontab -`.

---

## 7. Monitoring / verification commands

```bash
# State
git -C ~/workspaces/liminal fetch origin --prune
git log --oneline -5 ; git status --porcelain ; git worktree list
gh pr list --state open ; gh pr checks <N>
gh pr view <N> --json mergeStateStatus,mergeable    # want CLEAN + MERGEABLE before merge

# Verify (workers must run before claiming done)
pnpm build        # 0 TS errors
pnpm lint
pnpm vitest run <files>   # or: pnpm test:ci:fast
pnpm test:quality

# Merge
gh pr merge <N> --squash --delete-branch && git checkout main && git pull
```

CI gates on PRs: `agent-law`, `build-and-test`, `browser-and-e2e-smoke`, `validate-docs`,
`metadata-summary`, `probe` (`slow-browser-and-e2e` is skipped).

---

## 8. Open backlog (prioritized)

1. **Housekeeping** (kept clean at handoff — re-verify): no stale worktrees/branches; decide on
   the cron (§6); leave the ledger file uncommitted or revert it.
2. **Evaluator:** restore a reliable evaluator (ops/config) so the loop accumulates meaningfully.
3. **Taste/preference loop:** wire it end-to-end (§5) — the top self-improvement feature.
4. **Vision audit:** run `pnpm quality:render` on the latest gallery and judge it yourself; start
   a trend log to test the "gets better" claim.
5. **De-scoped — do NOT start without explicit re-authorization:** `@sinter/core` polyrepo
   extraction / `liminal-sites` fork dedup. Old fork tip preserved as tag `archive/living-site-quality`.

---

## 9. Your first actions

1. Run the §7 state block — confirm `main @ da8a2ba3` (or later), no open PRs, clean worktrees.
2. Re-verify §8.1 housekeeping; leave the tree clean.
3. Decide the cron question (§6) and surface it + the evaluator question to the user — these
   touch live machine config / data quality and are the user's call.
4. Pick the next real task from §8 (the taste loop is the highest-leverage). Brainstorm → plan →
   implement under the doctrine. Don't manufacture busywork; if nothing clean is available, say so
   and ask.
