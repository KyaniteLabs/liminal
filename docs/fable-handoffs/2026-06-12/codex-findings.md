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
