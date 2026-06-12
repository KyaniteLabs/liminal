# Codex Findings — 2026-06-12

## TASK 0 — Land `feat/prompt-tiering`
- Branch: `feat/prompt-tiering`
- Commit: `974253a7`
- PR: `#22`
- Outcome: merged to `main` as merge commit `1c5a3ae4`.
- Verification:
  - `pnpm exec vitest run test/unit/core/ScoringEngine.test.ts test/unit/prompts/PromptTier.test.ts --coverage.enabled=false` → 93 passed.
  - `pnpm build` → passed.
  - `git merge-base --is-ancestor 974253a7 origin/main` → passed.

## TASK 1 — Band + tier the ScoringEngine LLM strategy
- Branch: `codex/scoring-llm-tier`
- PR: `#23`
- Outcome: shared the evaluator rubric, tiered the LLM scoring strategy prompt, threaded compact `jsonMode` through the tool-loop path, and added focused prompt/parser tests.
- Verification:
  - `pnpm exec vitest run test/unit/core/ScoringEngine.test.ts test/unit/prompts/PromptTier.test.ts --coverage.enabled=false` → 96 passed.
  - `pnpm exec vitest run test/unit/scoring/scoring-result-types.test.ts --coverage.enabled=false` → 10 passed.
  - `pnpm build` → passed.

## TASK 2 — Band + tier LLMJudgeCritic
- Branch: `codex/llm-judge-tier`
- PR: `#24`
- Outcome: added banded full/compact judge prompts, resolved compact tier from LLM config/base URL, enabled compact JSON mode, and parsed flat compact JSON responses without dropping legacy text responses.
- Verification:
  - `pnpm exec vitest run test/unit/aesthetic --coverage.enabled=false` → 101 passed.
  - `pnpm typecheck` → passed.
  - `pnpm build && npx vitest run --changed origin/main --coverage=false --reporter=verbose --retry=0 --testTimeout=10000` → 77 files passed, 1182 tests passed.

## TASK 3 — Fold generateP5Sketch's bespoke check into PromptTier
- Branch: `codex/p5-prompt-tier`
- PR: `#25`
- Outcome: replaced the bespoke capability/context-window condition with PromptTier routing, kept the simplified prompt as the compact variant, and asserted `glm-5v` stays on the full PromptLibrary path.
- Verification:
  - `pnpm exec vitest run test/unit --coverage.enabled=false -t p5` → 58 files passed, 182 tests passed.
  - `pnpm typecheck` → passed.
  - `pnpm build && npx vitest run --changed origin/main --coverage=false --retry=0 --testTimeout=10000` → 146 files passed, 2298 tests passed.

## TASK 4 — gemma vision pattern in CapabilityRegistry
- Branch: `codex/gemma-vision`
- PR: `#26`
- Outcome: added `gemma4*` and `gemma3*` to multimodal vision model patterns and asserted `gemma4:12b` supports vision while `glm-5.1` remains text-only.
- Verification:
  - `pnpm exec vitest run test/unit/llm/CapabilityRegistry.test.ts --coverage.enabled=false` → 28 passed.
  - `pnpm typecheck` → passed.
  - `pnpm build && npx vitest run --changed origin/main --coverage=false --retry=0 --testTimeout=10000` → 167 files passed, 2878 tests passed.

## TASK 5 — Archive top re-score script
- Branch: `codex/rescore-tops`
- Outcome: added a read-only `scripts/quality/rescore-tops.mjs` report and wired `quality:rescore`; it selects the top-2 non-quarantined entries for each visual domain, re-renders with `HeadlessRenderer.renderWithEvidence`, re-scores with `scoreRenderedEvidence`, and prints `{id, domain, stored, fresh, delta}` JSON records without saving archive data.
- Verification:
  - `node --check scripts/quality/rescore-tops.mjs` → passed.
  - `pnpm build` → passed.
  - `pnpm quality:rescore` → completed with 16 JSON records and no exceptions (`grep -c '^{' < captured output` → 16).

## TASK 6 — Full-tier guard for agentic prompts
- Branch: `codex/agentic-full-tier`
- Outcome: added explicit compact-tier warnings for `LLMModeAgent` planning and ledger `TaskRunner` prompts; both keep the existing full agentic prompt path and name the compact-resolved model in the warning.
- Verification:
  - `pnpm exec vitest run test/unit/LLMModeAgent.test.ts --coverage.enabled=false` → 1 file passed, 68 tests passed.
  - `pnpm exec vitest run test/unit/ledger/TaskRunner.test.ts test/unit/ledger/TaskRunner.prompt.test.ts --coverage.enabled=false` → 2 files passed, 11 tests passed.
  - `pnpm typecheck` → passed.
  - `pnpm build` → passed.

## FLOOR RESCORE — Worker handoff `worker-rescore-floors.md`
- Branch: `codex/rescore-floors`
- PR: (see "Outcome" below)
- Outcome: extended `scripts/quality/rescore-tops.mjs` with a `--floors` flag that re-scores the BOTTOM-2 non-quarantined entries per visual domain and emits `{id, domain, position: "floor", stored, fresh, delta}` JSON records; the default top-2 code path is preserved unchanged and the script never calls `QualityArchive.save()`. Added an optional `quality:rescore:floors` package.json alias. Touched ONLY: `scripts/quality/rescore-tops.mjs`, `package.json` (one line), and this `codex-findings.md` entry. The run was performed exactly once from the isolated worktree `.claude/worktrees/rescore-floors` (off `origin/main` at `57ad52f5`).
- Verification (from `.claude/worktrees/rescore-floors`):
  - `node --check scripts/quality/rescore-tops.mjs` → passed.
  - `pnpm build` (`tsc --incremental false`) → passed.
  - `pnpm install` (workspace install, lockfile in sync) → passed.
  - `node scripts/quality/rescore-tops.mjs --floors` → 16 newline-delimited JSON records, no exceptions (full output below).
- 16-line output (captured 2026-06-12, single run):
  ```
  {"id":"p5_6c7eb20e","domain":"p5","stored":0.65,"fresh":0.72,"delta":0.07,"position":"floor"}
  {"id":"p5_83ffe00b","domain":"p5","stored":0.75,"fresh":0.72,"delta":-0.03,"position":"floor"}
  {"id":"gls_ebf85a55","domain":"glsl","stored":0.65,"fresh":0.68,"delta":0.03,"position":"floor"}
  {"id":"gls_d7029ffd","domain":"glsl","stored":0.65,"fresh":0.62,"delta":-0.03,"position":"floor"}
  {"id":"thr_1653e2a6","domain":"three","stored":0.65,"fresh":0.372,"delta":-0.278,"position":"floor"}
  {"id":"thr_bf6fc1ff","domain":"three","stored":0.75,"fresh":0.68,"delta":-0.07,"position":"floor"}
  {"id":"hyd_e6b82c2a","domain":"hydra","stored":0.65,"fresh":0.252,"delta":-0.398,"position":"floor"}
  {"id":"hyd_ee3732f1","domain":"hydra","stored":0.68,"fresh":0.78,"delta":0.1,"position":"floor"}
  {"id":"svg_ed4da0f1","domain":"svg","stored":0.78,"fresh":0.78,"delta":0,"position":"floor"}
  {"id":"svg_2a402b4b","domain":"svg","stored":0.78,"fresh":0.68,"delta":-0.1,"position":"floor"}
  {"id":"asc_b203e616","domain":"ascii","stored":0.82,"fresh":0.78,"delta":-0.04,"position":"floor"}
  {"id":"asc_02221a6a","domain":"ascii","stored":0.82,"fresh":0.72,"delta":-0.1,"position":"floor"}
  {"id":"tex_ccd3d63b","domain":"textgen","stored":0.85,"fresh":0.82,"delta":-0.03,"position":"floor"}
  {"id":"tex_450bf30d","domain":"textgen","stored":0.85,"fresh":0.82,"delta":-0.03,"position":"floor"}
  {"id":"kin_08cecb7a","domain":"kinetic","stored":0.85,"fresh":0.82,"delta":-0.03,"position":"floor"}
  {"id":"kin_a85243e6","domain":"kinetic","stored":0.85,"fresh":0.78,"delta":-0.07,"position":"floor"}
  ```
- 3-sentence summary: across the 16 floor entries the mean `delta = fresh − stored` is **−0.0629** (sum −1.006 / 16) and every domain except `p5` shows a negative mean, confirming the stored floor scores are systematically inflated versus the banded-rubric fresh judge; the **worst domain is `three`** with mean delta −0.174 (entry `thr_1653e2a6` at −0.278) and the single worst entry is `hyd_e6b82c2a` at −0.398, so floor inflation is real and `three`/`hydra` are the highest-priority targets for re-scoring or floor-relaxation work before the next admission cycle.
