# Prompt Audit Final Report — 2026-04-06

## Scope completed
This audit started as a workspace-wide prompt quality review and expanded into a prompt consolidation pass.

Completed work:
1. Audited prompt-bearing files across the workspace
2. Fixed direct instruction contradictions in registered prompts
3. Synced docs/tests to the actual runtime prompt inventory
4. Normalized `PromptBuilder` wording to the same raw-code contract
5. Added shared prompt contract fragments in `src/prompts/contracts.ts`
6. Reused those contracts across the main generator prompts and fallback paths
7. Added shared evaluator schema helpers in `src/prompts/evaluatorSchemas.ts`
8. Migrated `LLMJudgeCritic` from bespoke text parsing to JSON-only parsing

## Verified outcomes
- Registered prompt inventory documented as **41** prompts
- Active prompt-bearing files under `src/` documented as **59**
- High-traffic generation prompts now share canonical output-contract wording
- Core evaluator surfaces now share schema helpers
- `LLMJudgeCritic` no longer depends on ad hoc text labels like `SCORE:` / `DIMENSIONS:`

## Major improvements made

### 1. Direct contradictions removed
Examples fixed:
- raw code only vs markdown code block
- explain-before-code vs code-only output
- impossible synthesis constraints like “include all working code from both inputs”

### 2. Architecture made more honest
Docs now reflect reality:
- `PromptLibrary` is not the only prompt surface
- `PromptBuilder`, harness prompts, evaluators, and narrative prompts are all active surfaces

### 3. Shared contracts introduced
`src/prompts/contracts.ts` now anchors:
- raw code output
- HTML output
- TSX output
- JSON-only output
- tool-call JSON schema

### 4. Shared evaluator schemas introduced
`src/prompts/evaluatorSchemas.ts` now anchors:
- scalar scoring schema
- compact collaboration score schema
- dimension/evidence evaluation schema

## Remaining fragmentation
The prompt system is significantly cleaner, but not fully unified.

Remaining architectural issues:
- harness prompts are still embedded rather than registry-driven
- some prompt builders still live inline in runtime classes
- persona/swarm/board prompt text still exists in multiple locations
- prompt ownership is improved, but not fully centralized

## Recommended final architecture

### Canonical layers
1. `src/prompts/contracts.ts`
   - output contracts
2. `src/prompts/evaluatorSchemas.ts`
   - JSON evaluator schema shapes
3. `src/prompts/*`
   - reusable prompt templates and builders
4. runtime callers
   - compose from the shared layers instead of inventing wording locally

### Principle
Runtime code should assemble prompts, not author prompt policy.

## Suggested next milestones
1. Move more embedded harness/evaluator prompt text behind shared builders
2. Deduplicate persona/swarm/board prompt text into one canonical home
3. Add a tiny prompt-surface CI audit test to prevent future drift
4. Land the worktree changes as one prompt-consolidation PR

## Final assessment
This audit succeeded.

The prompt system is now:
- more internally consistent
- better documented
- less contradictory
- less parser-fragile
- more ready for future consolidation

The biggest remaining work is no longer prompt quality triage.
It is architecture simplification.
