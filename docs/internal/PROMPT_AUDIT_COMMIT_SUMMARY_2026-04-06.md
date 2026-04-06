# Commit Summary — Prompt Audit / Consolidation

## Summary
Consolidated prompt contracts and evaluator schemas across the Liminal workspace, fixed contradictory prompt instructions, synced docs/tests to runtime reality, and converted `LLMJudgeCritic` to JSON-only parsing.

## Included changes
- fixed contradictory output instructions in registered prompts
- normalized `PromptBuilder` and `LLMClient` fallback prompt wording
- added `src/prompts/contracts.ts`
- added `src/prompts/evaluatorSchemas.ts`
- reused shared contracts across main generator prompts
- reused shared evaluator schemas across core evaluator prompt surfaces
- converted `LLMJudgeCritic` to JSON-only parsing
- added inventory, remediation, and final audit docs
- updated `docs/PROMPTS.md`, `docs/THE_BIBLE.md`, and `docs/visual-bible.html`

## Verification
- TypeScript diagnostics: clean
- Focused prompt/aesthetic tests: passing

## Suggested commit message
feat(prompts): consolidate prompt contracts and evaluator schemas
