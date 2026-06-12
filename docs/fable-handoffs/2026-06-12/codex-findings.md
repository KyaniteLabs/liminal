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
- PR: pending.
- Outcome: replaced the bespoke capability/context-window condition with PromptTier routing, kept the simplified prompt as the compact variant, and asserted `glm-5v` stays on the full PromptLibrary path.
- Verification:
  - `pnpm exec vitest run test/unit --coverage.enabled=false -t p5` → 58 files passed, 182 tests passed.
  - `pnpm typecheck` → passed.
  - `pnpm build && npx vitest run --changed origin/main --coverage=false --retry=0 --testTimeout=10000` → 146 files passed, 2298 tests passed.
