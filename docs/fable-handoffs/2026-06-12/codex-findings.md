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
