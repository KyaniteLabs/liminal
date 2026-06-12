# Worker Task — SVG generation hard-down in daemon (suspect: craft contract vs raw-SVG output rule)

Self-contained. Repo: `~/workspaces/liminal` (Sinter). Forgejo source of truth; land via branch → PR → merge (recipe: rule 6 of `docs/fable-handoffs/2026-06-12/codex-window-tasks.md`).

**Claude model restriction: Sonnet or Haiku only; no Opus, no Fable.**

## Evidence (2026-06-12 overnight)

- Daemon self-improve cycles: SVG generation failed in 100% of observed cycles 07:41Z→10:29Z (`.quality/self-improve-daemon.log`), error every time: `SVGGenerator: provider returned no valid SVG after 2 bounded direct attempts: SVG output must be a raw <svg> document` (validator: `src/generators/svg/SVGValidator.ts:52`). Failure records: `~/.sinter/failures/1781258426690-830n822uf.json`.
- SVG still SUCCEEDED at ~06:46Z cycle (archive admission timestamp 06:52Z). The daemon's dist was rebuilt at 07:41Z from a working tree containing the craft-contract changes (later merged as Forgejo PR #29 "craft contract on every generation path + exemplar quality floor", merge `5ea3b5b5`). Post-#29 cycles (codeSha 5ea3b5b5) keep failing the same way.
- HYPOTHESIS (unconfirmed): contract text appended by `src/prompts/CraftContract.ts` (and/or the PromptBuilder changes from #29) to the SVG generation prompt makes the generator model emit prose/markdown-fenced output instead of a raw `<svg>` document. CONFIRM BEFORE FIXING.

## Steps

1. ISOLATED worktree (NEVER `git checkout` in the main checkout — live daemon + an active agent's `feat/rubric-climbing` branch live there):
   ```
   cd ~/workspaces/liminal && git fetch origin
   git worktree add .claude/worktrees/svg-hard-down -b codex/svg-craft-contract-fix origin/main
   cd .claude/worktrees/svg-hard-down && pnpm install --prefer-offline && pnpm build
   ```
2. REPRO + CAPTURE (this is the mandatory evidence): run 1–2 SVG generations with NOVEL prompts (never-used phrasing — LLM cache returns stale artifacts for reused prompts), e.g. `node bin/sinter "an SVG vector illustration of tide-worn copper lighthouse gears" -o /tmp/svg-repro` — instrument or log the RAW provider response before validation (temporary console/debug in the SVGGenerator path is fine in the worktree; remove before commit). Paste the first 30 lines of the raw output into your findings. If it does NOT reproduce on origin/main, STOP and report (the failure may have been the dirty-tree WIP, not #29).
3. If confirmed: minimal fix in the SVG path only — keep the craft contract's intent but make the SVG variant compatible with the raw-`<svg>`-document output rule (e.g. SVG-specific contract phrasing that re-asserts raw output, or exclude/adapt the contract appendix for the svg domain in `src/prompts/CraftContract.ts` / its call site). Do NOT weaken `SVGValidator` and do NOT touch `src/core/**` (another agent's active lane).
4. Acceptance: 3 consecutive SVG generations with 3 NOVEL prompts pass validation end-to-end (paste scores + output paths); existing unit tests for CraftContract/SVG (`test/unit/prompts/CraftContract.test.ts`, svg generator tests) green via `pnpm exec vitest run test/unit/prompts test/unit/generators --coverage.enabled=false`; `pnpm typecheck`; `pnpm build`.
5. Land via Forgejo PR; merge; verify ancestor; clean worktree+branches. Append outcome + raw-output evidence to `docs/fable-handoffs/2026-06-12/codex-findings.md` under `## SVG HARD-DOWN`. If credential commands are blocked, push + open PR if possible and end NEEDS_GUIDANCE naming the blocked step.

## Out of scope
- hydra "All generation candidates failed" (separate issue, has prior history — do not touch).
- Generator model routing, ScoringEngine, RalphLoop, anything in `src/core/**`.
