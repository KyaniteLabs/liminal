# Repository Prompt Audit — 2026-06-12

Every LLM prompt surface in Sinter, audited for model-robustness, with the new tiering
infrastructure (`src/prompts/PromptTier.ts`) as the repair mechanism. Trigger: the
judge-swap experiment measured gemma4:12b failing the frontier-tuned scoring prompt
(6/8 parsed, ceiling-pinned 0.95 when parsed) — one instance of a repo-wide pattern:
**no prompt in the repo was model-aware before this audit.**

Depth legend: **DEEP** = read end-to-end and fixed/judged · **SKIM** = headline read,
findings provisional · **INV** = inventoried only, migration candidate.

## The tiering doctrine (applies to every new prompt)

1. Resolve the consumer's tier: `resolvePromptTier(model, provider)` — local providers
   (ollama/lmstudio) and ≤14B-class models get `compact`; config `promptTiers` map overrides.
2. Author `full` + `compact` variants via `tiered({full, compact}, tier)` when the prompt
   demands structured output or multi-step judgment. Compact rules: ≤⅓ length, **flat JSON
   only**, "ONE line, nothing else", rubric **bands with concrete anchors**, no prose preamble.
3. Structured-output prompts request `jsonMode: true` on compact (ollama gets `format:'json'`).
4. Judges always get anchor bands — anchor-free 0-1 scales collapse to ceiling on small
   models and drift on large ones (measured: gemma all-0.95; GLM gen-time +0.10 inflation).

## Scoring & evaluation (highest leverage)

| Surface | Depth | Findings / status |
|---|---|---|
| `core/ScoringEngine.ts` scoreRenderedEvidence | **DEEP** | **FIXED this pass**: tiered full/compact judge prompts, rubric bands added to BOTH tiers, compact = flat JSON + jsonMode, parser accepts both shapes. Was: nested JSON, no anchors → measured gemma failures. |
| `core/ScoringEngine.ts` scoreWithResult / LLM strategy | DEEP (read) | Same anchor-free `"score": <number 0-1>` pattern at :349. Migration candidate #1 (same recipe). |
| `aesthetic/critics/LLMJudgeCritic.ts` | SKIM | `SYSTEM_PROMPT` 0.0-1.0 scale, no bands, dimension scores nested. Candidate #2. |
| `prompts/specialized/evaluation.ts` | INV | Evaluation persona prompts; audit for anchor bands. |
| `compost/FragmentScorer.ts` | INV | Scoring prompt; same banding need. |
| `guardrails/SemanticValidator.ts` | INV | Validation verdict prompt; structured output → jsonMode candidate. |
| `intuition/IntuitionEngine.ts` | INV | Quick-judgment prompts; compact-friendly by nature. |
| `evaluation/EmergenceCritic` (via specialized) | INV | Banding audit needed. |

## Generation

| Surface | Depth | Findings / status |
|---|---|---|
| `llm/LLMClient.ts` generateP5Sketch | DEEP (read) | **Prior art**: already does capability-based simplification ("replaces model-name-based Qwen hack") — the embryonic version of PromptTier. Should migrate to `resolvePromptTier` so the heuristic is shared, not bespoke. |
| `llm/PromptBuilder.ts` | SKIM | Generation system prompts + archive exemplars; exemplar payloads are large — compact tier should cut exemplar count (token budget on local models). Candidate #3. |
| `prompts/{p5,glsl,hydra,three,music,audio}.ts` | INV | Domain templates (~40-110 lines each); mostly instruction lists — compact variants = keep rules, drop prose. |
| `generators/p5/P5GeneratorLLM.ts`, `kinetic/kineticPrompt.ts`, `TierBasedGenerator.ts`, `GeneratorHarnessTools.ts` | INV | Inline generation prompts; kinetic produces full HTML docs — format contract should be stated once. |
| `composition/CompositionAnalyzer.ts` / `LayerContract.ts` | DEEP (prior work) | LayerContract appends per-layer transparency contracts — keep; analyzer prompt INV. |
| `swarm/prompt-fragments.ts`, `prompts/swarm.ts`, `personaCatalog/personas` | INV | Persona fragments; low risk (frontier-only consumers today). |
| `creative-vocabulary/*` (6 engines) | INV | Vocabulary expansion prompts; local-model usage unlikely; lowest priority. |

## Routing & chat

| Surface | Depth | Findings / status |
|---|---|---|
| `tui-bridge/TuiBridgeService.ts` TUI_SYSTEM_PROMPT + intent classification | SKIM | Classification now partly deterministic (IntentRouter) — good; LLM fallback prompt should get a compact variant with enumerated labels. Candidate #4. |
| `prompts/specialized/chat.ts`, `agent/StudioAgent.ts`, `tui/NaturalInterface.ts`, `tui/IntentRouter.ts` | INV | Conversational; harness/studio roles are frontier (MiniMax) today — tier when local routing arrives. |
| `harness/agent/LLMModeAgent.ts`, `ledger/TaskRunner.ts`, `harness/MetaHarnessIntegration.ts`, `harness/prompts/self-improve.ts`, `runtime-core/SelfImprovementRuntime.ts` | INV | Agentic/tool-loop prompts; tool-calling on small local models is unreliable — these should HARD-REQUIRE full tier (add a guard rather than a compact variant). |
| `collab/CollaborationEngine.ts`, `prompts/collab*.ts`, `creativeBoardAgents.ts` | INV | Multi-agent collab prompts; frontier-only. |
| `compost/{CollisionEngine,CompostSoup}.ts` | INV | Recombination prompts; compact candidates (short creative asks suit small models well). |

## Out of LLM-API scope (agent prompts, audited separately)

- `scripts/quality/watchman-prompt.md` — headless agent prompt; already hardened (gate-silencing rules, ledger-tail IDs, 0.68 render-infra alarm).
- `scripts/quality/self-improve-domains.mjs` DOMAIN_TEMPLATES + dream themes — routing phrases, not instruction prompts; verified working.

## Measured QA gate for this pass

Judge-swap rerun with tiering live (gemma4:12b via ollama → compact + jsonMode):
- Parse rate target **8/8** (pre-fix: 6/8).
- Score spread target **>0.2** (pre-fix: every parsed score 0.95).
- Frontier path regression check: GLM lane re-run — full tier adds bands but keeps structure; scores must stay plausible vs the 2026-06-12 control table (`docs/validation/` judge-swap experiment).

## Migration queue (post-pass, in order)

1. ScoringEngine LLM strategy (`:349`) — bands + tiering.
2. LLMJudgeCritic — bands + flat compact.
3. PromptBuilder — compact exemplar budget.
4. TuiBridge classification fallback — enumerated compact.
5. generateP5Sketch — fold bespoke capability check into PromptTier.
6. Agentic prompts — add full-tier-required guard.
