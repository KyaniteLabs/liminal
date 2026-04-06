# 2026-04-06 Prompt Audit Remediation Design

## Goal
Remove direct prompt contradictions, sync prompt inventory docs/tests to runtime reality, and document the remaining architectural split between PromptLibrary and PromptBuilder without attempting a risky full unification in this pass.

## Scope
1. Fix contradictory output-format instructions in high-traffic registered prompts.
2. Fix prompt inventory drift in docs/tests.
3. Update Visual Bible and prompt docs to reflect the audit.
4. Leave architectural unification as a follow-up, but document it explicitly.

## Chosen approach
- Make minimal, high-confidence edits to the PromptLibrary prompts currently exercised by runtime paths.
- Avoid changing generator routing or model-tier architecture in this pass.
- Convert contradictions into a single canonical contract: raw code only, no markdown fences, unless the prompt is intentionally JSON/markdown.

## Non-goals
- Full PromptBuilder ↔ PromptLibrary consolidation.
- Changing model-tier behavior.
- Rewriting persona voice systems.
