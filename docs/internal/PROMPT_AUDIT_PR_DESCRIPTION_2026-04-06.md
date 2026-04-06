## Summary
Consolidates prompt contracts and evaluator schemas across the Liminal workspace, fixes contradictory prompt instructions, syncs prompt docs/tests to runtime reality, and converts `LLMJudgeCritic` to JSON-only parsing.

## What changed
- fixed contradictory output instructions in registered prompts
- normalized `PromptBuilder` and simplified `LLMClient` fallback prompt wording
- added shared prompt contract fragments in `src/prompts/contracts.ts`
- added shared evaluator schema helpers in `src/prompts/evaluatorSchemas.ts`
- reused shared contracts across main generator prompts
- reused shared evaluator schemas across core evaluator prompt surfaces
- converted `LLMJudgeCritic` from bespoke text parsing to JSON-only parsing
- added prompt inventory, remediation, final audit, and commit-summary docs
- updated `docs/PROMPTS.md`, `docs/THE_BIBLE.md`, and `docs/visual-bible.html`

## Verification
- `npx vitest run test/unit/prompts/evaluator-schemas.test.ts test/unit/aesthetic/llm-judge-critic.test.ts test/prompts/prompt-validation.test.ts test/unit/llm/PromptBuilder.test.ts test/unit/prompts/remotion.test.ts test/unit/prompts/compost-prompts.test.ts`
- `npx tsc --noEmit --pretty false`

## Notes
This PR substantially reduces prompt drift and parser fragility, but full prompt-surface unification is still a follow-up architecture task.
