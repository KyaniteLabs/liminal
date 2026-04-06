# Prompt Surface Inventory — 2026-04-06

## Summary

This inventory captures the active prompt surfaces under `src/` after the prompt-quality remediation passes on 2026-04-06.

### Counts
- Prompt-bearing files found under `src/`: **59**
- Registered reusable prompt templates in `PromptLibrary`: **41**
- Main non-registered runtime prompt surfaces still active: **6**
  - `src/llm/PromptBuilder.ts`
  - `src/harness/prompts/self-improve.ts`
  - `src/harness/MetaHarnessIntegration.ts`
  - `src/harness/agent/LLMModeAgent.ts`
  - `src/core/ScoringEngine.ts`
  - `src/aesthetic/critics/LLMJudgeCritic.ts`

## Canonical buckets

### 1. Registered reusable prompts — medium risk, mostly normalized
These live in `src/prompts/*` and are routed through `PromptLibrary`.

Examples:
- generation: `p5`, `three`, `glsl`, `hydra`, `music`, `remotion`
- collaboration: `collab-internal.ts`
- evaluation/chat/design: `specialized/*`
- narrative/audio/aesthetic: `blog-to-video.ts`, `audio.ts`, `aesthetic.ts`

Status:
- output contract contradictions fixed in the highest-traffic generation prompts
- inventory docs/tests now reflect runtime reality (`41` registered prompts)

### 2. Tier-adaptive generator prompts — high architectural risk
File:
- `src/llm/PromptBuilder.ts`

Used by:
- `src/generators/TierBasedGenerator.ts`

Status:
- wording normalized toward the same raw-code contract as `PromptLibrary`
- now backed by shared fragments in `src/prompts/contracts.ts`
- the main `PromptLibrary` generation prompts also consume those fragments
- selected JSON-oriented prompt surfaces now consume shared JSON-only fragments too
- `LLMJudgeCritic` has been converted from bespoke text parsing to JSON-only evaluator parsing
- shared evaluator schema helpers now live in `src/prompts/evaluatorSchemas.ts`
- `ScoringEngine`, `specialized/evaluation`, and `collab.scoring` now reuse them
- still separate from registered prompt templates

Risk:
- same generation request can still take different prompt paths depending on entrypoint

### 3. Harness self-improvement / tool-calling prompts — high risk, specialized
Files:
- `src/harness/prompts/self-improve.ts`
- `src/harness/agent/LLMModeAgent.ts`
- `src/harness/MetaHarnessIntegration.ts`

Status:
- no high-confidence contradictions found after review
- these prompts are intentionally JSON/tool-call oriented and should remain separate from code-generation prompts

Risk:
- prompt shape is duplicated across multiple harness surfaces
- JSON-only / tool-call parsing remains brittle by nature

### 4. Evaluator prompts — medium risk
Files:
- `src/core/ScoringEngine.ts`
- `src/aesthetic/critics/LLMJudgeCritic.ts`
- `src/guardrails/SemanticValidator.ts`
- `src/prompts/specialized/evaluation.ts`

Status:
- evaluator prompts are coherent, but not unified under one schema
- some use JSON-only output; others use ad hoc text formats

Risk:
- inconsistent evaluator output shapes increase parser complexity

### 5. Persona / board / swarm prompts — low to medium risk
Files:
- `src/prompts/personas.ts`
- `src/swarm/personas.ts`
- `src/collab/CreativeBoard.ts`
- `src/swarm/prompt-fragments.ts`
- `src/collab/board-agents/*.md`

Status:
- mostly descriptive identity prompts rather than strict output-contract prompts
- no urgent contradictions found

Risk:
- persona text exists in multiple representations; drift is possible

### 6. Narrative prompts — low risk
File:
- `src/narrative/ThreeActContentGenerator.ts`

Status:
- distinct purpose, voice-driven rather than code-generation
- no immediate contradiction requiring intervention

## Main findings

### A. The architecture is still split, not unified
There is no single prompt authority yet.

Current reality:
- `PromptLibrary` is the reusable prompt registry
- `PromptBuilder` is a separate tier-adaptive generator surface
- harness / evaluator / narrative prompts embed their own system prompts directly

### B. The highest-value contradictions are already fixed
Resolved in the previous passes:
- code-only vs markdown-code-block contradictions in registered generation prompts
- PromptBuilder wording drift vs raw-code contract
- stale prompt inventory counts in docs/tests

### C. Remaining problem is now mostly structural, not textual
The repo’s biggest prompt issue is no longer obvious instruction contradiction.
It is fragmentation:
- multiple prompt stores
- multiple output schemas
- multiple parsing expectations

## Recommended consolidation roadmap

### Phase 4 — define prompt kinds
Create an explicit taxonomy:
- `code_generation`
- `tool_call_json`
- `evaluation_json`
- `evaluation_text`
- `spec_markdown`
- `persona_voice`

### Phase 5 — centralize contracts
Create shared builders for:
- raw-code output contract
- JSON-only output contract
- markdown-spec output contract

### Phase 6 — narrow PromptBuilder’s role
Refactor `PromptBuilder` so it assembles context and tier adaptation around canonical contracts, instead of owning independent instruction wording.

### Phase 7 — standardize evaluator outputs
Unify evaluators on either:
- JSON-only structured outputs
or
- one typed textual schema

Recommendation: prefer JSON-only where parsing matters.

## Concrete follow-up targets

1. `src/llm/PromptBuilder.ts`
   - make it consume shared contract fragments
2. `src/core/ScoringEngine.ts`
   - align with structured evaluator schema
3. `src/aesthetic/critics/LLMJudgeCritic.ts`
   - consider JSON schema instead of bespoke text parser
4. `src/harness/MetaHarnessIntegration.ts`
   - consolidate JSON-analysis prompt format with harness agent conventions
5. `src/collab/CreativeBoard.ts` and swarm persona files
   - pick one canonical home for persona text and derive the rest

## Bottom line

The prompt system is now significantly cleaner than it was at the start of the audit.

What remains is not “find more obvious contradictions.”
What remains is “reduce the number of independently-authored prompt surfaces.”
