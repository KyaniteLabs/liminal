# Orchestrator Runbook — Domain Wave (handoff 2026-06-08, ~5h Claude gap)

> **You are the new ORCHESTRATOR.** The previous orchestrator (Claude) is out for ~5h.
> This runbook is self-contained — operate from it. You do NOT write product code. You
> write paste-ready prompts for workers, do git admin (merge/sync/cleanup), grade output,
> and keep state honest. The HUMAN (Simon) dispatches your prompts to the workers and
> relays results back to you.

## Live update — 2026-06-08 22:37 PDT

This section supersedes the original handoff snapshot below.

- Current main: `872235fb fix(glsl): prevent WebGL1 missing-precision compile failures; keep runtime failures honest (#650)`.
- Open PRs: **0**.
- Merged during the replacement-orchestrator/domain-wave stint: #627 runbook, #628 provider routing, #630 runtime endpoint overrides, #629 M3 visual quality, #631 TextGen + ratchet, #632 Kinetic validator, #633 V visual-render stabilization, #642 Kimi-calibrated blank/flat + low-detail render gate, #644 bounded SVG direct retry, #646 ratchet honesty labels, #647 final master-plan/runbook sync, #649 deterministic organism CI repair, #650 honest GLSL WebGL1 precision stabilization.
- Kimi partial-frame calibration is evidence-only: bbox/coverage auto-fail is **not safe**. Use human-review labeling only unless the same Hydra half-black failure recurs.
- Kimi all-domain visual audit is evidence-only: fresh all-domain gauntlet timed out after 300s, so the audit uses newest existing `.quality/gauntlet/` artifacts.
- Kimi Hydra recurrence check is evidence-only: 4 fresh Hydra PNGs were full-frame with no half-black or washout recurrence; 1 fresh run failed validation at 147b/150b, which is monitor-only unless it recurs.
- Recent merge cleanup covered the completed domain-wave/doc worktrees; the persistent stale worktrees remain listed in §2/§7.
- Local root state after pull: untracked Kimi report `docs/ci-investigations/2026-06-09-hydra-recurrence-check.md`; historically dirty `docs/validation/self-improve-ledger.jsonl` may reappear and should not be touched unless explicitly assigned.
- CI packet lane exists at `docs/ci-investigations/`; packet `2026-06-09-run-27182845442.md` was repaired by #649.

### Current gauntlet/ratchet reality

The latest landed ratchet on #646 was CI-green. The gauntlet analyzes rendered PNGs using color variance + edge density, not exact solid-color or luminance alone. This catches Kimi's unambiguous blank/flat class, including bright-gray blanks that luminance cannot catch. Ratchet output now labels each row `GATED` or `advisory`, reports the gated denominator, and names failing advisory domains.

Do **not** overread that as all-12 perfect. #642 does **not** auto-fail partial-frame/composition-layer layouts because Kimi identified too many false-positive risks; Kimi's later partial-frame calibration confirmed bbox/coverage is unsafe for auto-fail across p5, kinetic, three, and #619 composition layers.

| Domain | Latest local evidence | Status |
|---|---|---|
| p5 | Kimi all-domain audit: latest artifact core-ready, 0/7 recent failures | lock-ready |
| svg | #644: SVG now makes primary + one SVG-specific bounded direct provider attempt, then fails cleanly; local post-fix gauntlet hit provider 429, not timeout/empty tool-loop | timeout/empty-retry ambiguity fixed; provider availability still external |
| hydra | Kimi audit: latest artifact PASS and rich, but 3/7 recent failures: 2 half-black partial frames + 1 blank washout | beta; stabilize before lock |
| glsl | Kimi audit: latest artifact PASS and rich, but 2/6 recent shader-error screens; #650 now injects missing WebGL1 precision without runtime fallback masking | beta; re-run next all-domain batch before lock |
| three, html, revideo, tone, strudel | Kimi audit: core-ready with stable recent artifacts | lock-ready |
| kinetic, ascii, textgen | Kimi audit: PASS but visually simple/minimal | pass-but-weak |

Local verification for #642/#644:

- `pnpm vitest run test/unit/quality/luminance.test.ts --coverage=false` PASS, 11 tests.
- `pnpm vitest run test/unit/generators/SVGGenerator.test.ts --coverage=false` PASS, 22 tests.
- `pnpm vitest run scripts/domains/test/gauntlet.test.js --coverage=false` PASS, 6 tests after #646.
- `git diff --check` PASS.
- `pnpm build` PASS.
- `pnpm lint` PASS.
- Focused gauntlets PASS: p5, svg, hydra, glsl.
- #644 post-fix SVG gauntlet failed fast with `Anthropic API error 429`; that was provider/rate-limit behavior, not timeout or empty-tool-loop behavior.
- `npx vitest run --changed origin/main --coverage=false --reporter=verbose --retry=2 --testTimeout=10000` was interrupted after several minutes with no output; CI `build-and-test` passed on #642.
- #644 CI fully green: Domain Gauntlet Ratchet, agent-law, browser/e2e smoke, build-and-test, metadata, probe, validate-docs.
- #646 CI fully green: Domain Gauntlet Ratchet, agent-law, browser/e2e smoke, build-and-test, metadata, probe, validate-docs.
- #647 CI fully green: Domain Gauntlet Ratchet, agent-law, browser/e2e smoke, build-and-test, metadata, probe, validate-docs.
- #649 CI fully green after rerun: initial `build-and-test` failure was a TypeScript internal `charCodeUnchecked` crash; rerun passed.
- #650 CI fully green and merged: `pnpm build`, focused GLSL tests, Domain Gauntlet Ratchet, browser/e2e smoke, metadata, probe, docs, and agent-law all passed. Local orchestrator spot-check: `pnpm vitest run test/core/wrappers/GenericWrapper.test.ts --coverage=false` PASS, 53 tests. The merged diff contains no `fsFallback` runtime shader substitution; generated compile failures still surface as honest shader-error evidence.

### Next Wave 2 dispatch

1. **Hydra monitoring:** do not implement a half-black auto-fail yet. Fresh recurrence check found 0/4 partial-frame or washout PNGs on current main; re-open only if half-black recurs in 2+ consecutive runs or the 147b/150b code-size near-miss recurs in at least 2 of the next 10 Hydra runs.
2. **GLSL recheck:** #650 is merged. Re-run GLSL in the next all-domain gauntlet batch; if shader-error screens recur, fix validator/retry evidence rather than runtime render substitution.
3. **Weak-domain depth:** improve Kinetic/SVG/ASCII/TextGen prompts or generator contracts for richer output; they are stable but not showpiece-quality.
4. **Kinetic invalid recovery recheck:** #632 added the validator, but prior ratchet output mentioned invalid HTML recovery. Re-run with #646 honest labels before assigning code work.
5. **Return to launch backlog:** once domain stabilization decisions are made, resume #7 Surfaces, #8 secrets hardening/release trust, #9 design debt/coverage, and M5 trend-log audits.

---

## 0. The one mission right now
**Drive all 12 creative domains to "perfect."** The domain **gauntlet** is the scoreboard:
`node scripts/domains/gauntlet.mjs --all` (or `--domain <d>`). At handoff: **4/12 PASS**
(p5, three, revideo, ascii), **8 FAIL**. Three workers are mid-flight fixing the 8 (Wave 1).
"Perfect" = gauntlet PASS **and** the render looks genuinely good (a human/vision check —
PASS alone isn't enough; e.g. `three` passes but renders mediocre).

If you (the new orchestrator) **cannot see images**, you cannot do the final quality grade —
defer visual verdicts to Simon, and use the objective proxies the harness already emits
(`DARK(lum<0.12)`, `RENDER-FAIL`, `SUSPECT-TINY`) as a partial substitute.

---

## 1. Workers & standing lane ownership (collision-free by directory)
| Worker | Model | Lane (owns these files) | Status at handoff |
|---|---|---|---|
| **C** | Codex | `src/config/*`, `src/llm` routing, `src/generators/{tone,strudel,kinetic,svg,html}` + tests | 🟢 active: generation-routing fix |
| **U** | Ultracode Claude | `src/generators/{shader,hydra,three}`, `src/core/validators/{GLSL,Hydra,Three}*` + tests | 🟢 active: visual codegen quality |
| **G** | Gemini Pro | `src/generators/textgen`, `src/core/validators/TextGenValidator.ts`, `src/core/CodeValidator.ts` (registration only), `scripts/domains/*`, `.github/workflows/*`, `package.json` | 🟢 active: textgen + gauntlet CI ratchet |
| **K** | Kimi | (none) | 🔴 on hold (tech issues) — reassign a Wave-2 lane if it returns |
| **Orchestrator (you)** | — | merges, `~/.sinter` config + secrets, vision grading, `package.json`/CI seams when not given to G, the gauntlet scoreboard | — |

**Golden rule:** a worker edits ONLY its lane. You enforce it: every PR, check the file list
is within lane (see Merge Protocol §5).

---

## 2. EXACT state at handoff (verify first: `git -C ~/workspaces/liminal fetch && git log --oneline -3`)
- Repo: `~/workspaces/liminal` (dir/remote keep old name "liminal"; product = "sinter").
- GitHub: `KyaniteLabs/liminal` (use `gh`).
- `main @ 0b948216`. **0 open PRs** at handoff.
- Merged this session (don't redo): #605 .sinter leak; #606 engagement→sensorium; #607 garden hydration; #608 sensorium e2e; #609 session-resume; #610 handoff doc; #611 taste loop; #612 persistence race; #613 weak-assertions; #614 vision renderer; #615 proof-llm env (Codex); #616 audio-skip+dark-flag; #617 seam root-cause; #618 Strudel domain fix (Codex); #619 transparent-layer contract; #620 broken-gen gate (Codex); #621 launch masterplan; #622 washout fix; #623 release smoke; #624 color-codegen handoff; #625 P5Validator color fix; #626 **domain gauntlet** (the scoreboard).
- **Evaluator: GLM** (this session repointed `~/.sinter/config.json` evaluator role → GLM; verified real 0.90 score). Backups: `~/.sinter/config.json.bak-*`. NUCBOX config (`openai`/`nucbox` providers) is preserved for when it returns.
- **Cron**: `sinter-self-improve` re-enabled (every 6h, on the GLM evaluator). M5 trend baseline (t=0) logged: gallery is mostly legacy/dark works; post-fix works accrue over cron cycles.
- **Stale worktrees** (cleanup candidates, not active): `~/.gemini/antigravity/.../sinter-release-trust-smoke` (merged #623, Gemini-managed — leave it), `~/workspaces/G-gallery-cleanup` (parked, incomplete — see §8).

### The gauntlet scoreboard (from #626)
| PASS (4) | FAIL (8) + reason |
|---|---|
| p5 (excellent), three (mediocre render — fix in U's lane), revideo, ascii | **tone/strudel/kinetic** → route to offline local LLM `localhost:1234` (C); **svg/html** → "generate timed out 120s" (likely same local-LLM cause, C); **glsl** → shader compile `#endif` without `#if` (U); **hydra** → code too small 103B<150B (U); **textgen** → no validator (G) |

**Key shared root cause:** `src/config/ConfigLoader.ts:392` falls back to `'lmstudio'` (localhost:1234) and `RoleConfig.ts:91 DEFAULT_BASE_URL=lmstudio`. C's routing fix likely unblocks tone/strudel/kinetic/svg/html **and** the clean-env startup (#8) at once.

---

## 3. Wave 1 — what each worker will return, and what to do with it
Each worker's PR should: be **in-lane** (§1), be **CI green**, and turn its domains' gauntlet rows to **PASS** (honestly). Process per §5. After merging each, **re-run `node scripts/domains/gauntlet.mjs --all`** and update the scoreboard (4/12 → higher).

- **C (`fix/domain-generation-routing`)**: root-causes why 5 domains hit localhost:1234. Three outcomes it may report: (i) the **gauntlet itself** doesn't load config → C hands the gauntlet fix to **G** (don't merge a "fix" that's really in scripts; re-route). (ii) a **per-domain provider pin** → C removes it. (iii) the **lmstudio last-resort** fires even with GLM configured → C fixes resolution. Any is fine; verify the 5 domains now generate via GLM.
- **U (`fix/visual-domain-quality`)**: glsl validator rejects bad preprocessor → retry self-repairs; hydra produces more substance; three drops the debug axis-helper + fixes exposure. **Vision-grade these renders** — U "passing" the gauntlet is necessary but you must confirm they look good.
- **G (`feat/gauntlet-ci-ratchet`)**: adds TextGenValidator (textgen PASS), and wires the gauntlet as a **CI ratchet** (passing domains can't regress; not-yet-passing reported, not blocking) + a quality floor (luminance). **Audit the ratchet for honesty** — never let it claim a domain passes that doesn't.

---

## 4. Standing doctrine (hard rules — violations are defects)
- Branch → PR → **squash-merge** (`gh pr merge <N> --squash --delete-branch`) → prune → remove the worker's worktree. **Never commit to main.**
- karpathy: simplest sufficient change, surgical, verification-first. If it already works, mark OK — don't manufacture a fix.
- Integration-first; every module has a real call site. Test-quality: concrete assertions, error paths, vi.hoisted, ≥2-module integration tests.
- **NEVER-used prompts** for any live generation (LLM cache returns stale art).
- **Vision grading is the orchestrator's job** — never delegate to a text-only worker.
- **NO fake fallbacks / no fake green**: honest degraded scoring, honest gauntlet, clean failure messages. Merge past a red check ONLY when it's a **proven infra flake** (see §5b) AND the substantive gate (`build-and-test`) is green.

---

## 5. MERGE PROTOCOL (run for every worker PR)
```bash
cd ~/workspaces/liminal && git fetch origin --prune
gh pr view <N> --json mergeStateStatus,mergeable,files     # a) in-lane check: every path within the worker's lane (§1)
gh pr checks <N>                                            # b) CI
gh pr diff <N>                                             # read the change; for visual domains, find/grade the render PNG
# ... vision-grade renders if you can; else defer to Simon ...
gh pr merge <N> --squash --delete-branch
git checkout main && git pull
git worktree remove --force <worker-worktree>             # if only node_modules/cache dirty
git branch -D <branch> ; git remote prune origin
node scripts/domains/gauntlet.mjs --all                    # update the scoreboard
```
**a) Out-of-lane:** if a PR touches files outside the worker's lane, STOP — tell Simon; either the worker fixes scope, or (if collision-free and done) absorb it but note the slip. (U did this once this session with the color fix — we absorbed it because it was done + collision-free.)
**b) CI flake:** `browser-and-e2e-smoke` intermittently fails on `electron`/`sharp` **504 Gateway Timeout** during install — pure infra. `gh run rerun <run-id> --failed`, or merge on green `build-and-test` (the substantive gate that runs install+build+test) and document the flake. Confirm it's the 504 (`gh run view <id> --log-failed | grep -iE '504|electron|sharp'`), NOT a real test failure.
**c) mergeStateStatus UNKNOWN** right after another merge = GitHub recomputing; wait a few seconds and re-query.
**d) Local branch won't delete (held by worktree):** expected; remove the worktree first.

---

## 6. After Wave 1 → Wave 2
Re-run `node scripts/domains/gauntlet.mjs --all`. Whatever still FAILS becomes Wave 2 lanes, allocated the same way (by failure type → file area, one worker each, disjoint). Likely Wave-2 candidates: svg/html if they have a *real* perf issue beyond routing; aesthetic-quality passes on any domain that passes-but-looks-weak; ascii/textgen/kinetic depth (they're "scaffold" tier per `docs/FINISH_LINE.md`). The **ratchet** (G's work) guarantees you only climb — a passing domain can't regress.

When all 12 PASS + vision-verified, lock them "core" and move to the broader launch backlog (§8).

---

## 7. MITIGATIONS / ALTERNATIVES — "what comes up"
- **A worker's PR has a REAL build/test failure** → do not merge; relay the failing output to Simon to give the worker; it fixes and re-pushes.
- **CI red but it's the electron/sharp 504** → §5b: re-run or merge on the green substantive gate, documented. Never on a real failure.
- **Worker out of lane** → §5a.
- **Two PRs collide on a shared file** (shouldn't, lanes are disjoint; risk files: `CodeValidator.ts` (G only), `package.json` (G this wave), `src/config` (C only)) → merge one, tell Simon the other worker must `git pull --rebase origin main` then re-push.
- **Worker reports STOP+SURFACE** (premise wrong / not fixable in lane) → accept it (anti-slop is correct), merge the findings doc if useful, re-route the real fix to the right lane. (U did this well twice — seam #617, color-codegen #624.)
- **A domain still fails for a NEW reason after the fix** → honest progress; log it for Wave 2, don't force it.
- **The gauntlet is the bug (doesn't load config)** → C will report this; route the gauntlet fix to G; the domains may be closer to working than the scoreboard shows.
- **K (Kimi) returns** → give it a Wave-2 domain lane or a deferred backlog item (§8).
- **NUCBOX returns** (Simon restarts `tailscaled` on the box) → verify reachable (`curl --max-time 5 http://100.113.174.74:4000/v1/models`); optionally repoint evaluator back to qwen in `~/.sinter/config.json` (back up first). GLM works fine, so this is optional.
- **Spawned review subagents fail** (resolve to unreachable `glm-5.1` on some setups) → workers fall back to in-context `/code-review`; that's acceptable, just flag it.
- **Worktrees pile up** → sweep merged orphans: verify clean (`git -C <wt> status --porcelain | grep -vE 'node_modules|\.eslintcache|\.quality|output|gallery'`), then `git worktree remove --force <wt> && git branch -D <br>`. Leave Gemini's `~/.gemini/...` worktrees to Gemini.
- **You can't see images** → defer the quality verdict to Simon; lean on the gauntlet's objective flags (DARK/RENDER-FAIL/SUSPECT-TINY) as a partial proxy; do NOT mark a domain "perfect" on PASS alone.
- **Secrets**: `~/.sinter/config.json` holds plaintext API keys (GLM/MiniMax/qwen) — never commit it; it's gitignored as runtime config. Backups exist (`.bak-*`).
- **Running low on a worker's usage** → prioritize C's routing lane (highest leverage — unblocks ~5 domains + clean-env).

---

## 8. Broader launch backlog (after domains — the 9-category Green Board)
- **#8 Release trust**: release smoke landed (#623) but clean-env startup is broken (config stack trace + lmstudio fallback). **Likely fixed as a side-effect of C's routing.** Then have G tighten the smoke assertions to fail on cryptic messages. Plus secrets hardening (plaintext keys).
- **#7 Surfaces**: Studio/TUI e2e UX smoke (the deferred U lane: `src/tui-bridge`, `docs/USER_SURFACE_CONTRACT.md`) + Simon's real-user alpha.
- **#9 Eng hygiene**: `docs/design-debt-inventory.md` (11 HIGH); coverage ≥70 all metrics.
- **#4 SI improving**: cron accruing; run `pnpm quality:render-gallery` periodically + vision-grade a trend (anti-Goodhart). The one thing accumulation can't prove.
- **Legacy gallery cleanup**: redo cleanly — quarantine genuinely-broken works only (parse-fail), `git mv` (not copy), commit the scripts. The parked `G-gallery-cleanup` branch was incomplete (copied not moved, scripts uncommitted) — start fresh.
- Full launch context: `docs/agent-law/launch-masterplan.md`, the readiness map, `docs/FINISH_LINE.md` (domain maturity tiers).

---

## 9. Command cheat-sheet
```bash
# state
git -C ~/workspaces/liminal fetch origin --prune; git log --oneline -5; git worktree list; gh pr list --state open
# domains scoreboard
node scripts/domains/gauntlet.mjs --all        # or --domain <d>
# vision audit (orchestrator only)
pnpm quality:render-gallery --count 8          # renders newest gallery → .quality/renders/gallery/*.png, then LOOK
# verify a generation works via real config
node bin/sinter --prompt "<NEVER-used phrase + nonce>" -o .quality/diag/x
# evaluator sanity
node -e "console.log(require(process.env.HOME+'/.sinter/config.json').roles.evaluator.provider)"   # expect: glm
# merge (after in-lane + CI + grade): gh pr merge <N> --squash --delete-branch
```

## 10. Open Simon-decisions (don't decide these unilaterally)
- Restart `tailscaled` on NUCBOX (only Simon, at the box). Then evaluator can go back to qwen (optional; GLM works).
- "All 12 domains perfect" is Simon's explicit bar (do NOT narrow to the 4 working ones).
- Real-user alpha timing (#7) and secrets policy (#8).

---
**First actions when you take over:** (1) verify state (§2 cmd). (2) Wait for C/U/G PRs; process each via §5; re-run the gauntlet after each merge. (3) Keep the scoreboard honest and the lanes disjoint. (4) Surface Simon-decisions, don't manufacture work. The previous orchestrator returns in ~5h.
