# AI Systems Cluster Report

Personas: Andrej Karpathy, Yann LeCun, Dwarkesh Patel

Lens: model behavior, prompt quality, evaluator gaps, AI architecture, reasoning blind spots.

Status: first-pass white-box review complete. This cluster found release-blocking evaluator, evidence, and prompt-runtime drift.

## Findings

### AI-001: Live model-assimilation proof can rely on fixture candidate scores

- Severity: P1
- Material: yes
- Evidence: `scripts/proof/model-assimilation-proof.ts:1`, `scripts/proof/model-assimilation-proof.ts:68`, `scripts/proof/model-assimilation-proof.ts:137`, `scripts/proof/model-assimilation-proof.ts:152`, `scripts/proof/live-provider-smoke.ts:57`, `src/runtime-core/Level6ReleaseGate.ts:48`, `test/unit/runtime-core/Level6ReleaseGate.test.ts:48`
- Failure mode: the proof can reuse fixture candidate scores and assignments while only reading one live-provider smoke receipt.
- Customer impact: model-readiness claims can be satisfied by old or synthetic evidence.
- Recommended proof: require fresh commit-bound live receipts per model/domain/case.

### AI-002: Auto-evaluator failures can be downgraded to legacy scoring with confidence 1

- Severity: P1
- Material: yes
- Evidence: `src/config/FeatureFlags.ts:1`, `src/core/RalphLoop.ts:326`, `src/core/RalphLoop.ts:580`, `src/core/RalphLoop.ts:623`, `src/core/RalphLoop.ts:789`, `src/core/RalphLoop.ts:823`, `src/core/ScoringEngine.ts:651`, `src/core/ScoringEngine.ts:740`
- Failure mode: default auto eval can fail, fall back to legacy scoring, and still report `failureClass:"none"` and `confidence:1`.
- Customer impact: evaluator outage looks like high-confidence success.
- Recommended proof: regression where evaluator throws and the run reports degraded evidence, not success.

### AI-003: Visual evidence can pass without decoded-pixel validation

- Severity: P1
- Material: yes
- Evidence: `src/render/VisualScorer.ts:144`, `src/render/VisualScorer.ts:158`, `src/render/VisualScorer.ts:192`, `src/render/VisualScorer.ts:209`, `src/perception/RenderEvidencePerception.ts:22`, `src/perception/RenderEvidencePerception.ts:54`, `src/render/HeadlessRenderer.ts:321`, `src/render/HeadlessRenderer.ts:378`
- Failure mode: visibility is inferred from dimensions, compressed size, and synthetic byte patterns rather than decoded pixels.
- Customer impact: blank or solid screenshots can be accepted as visual proof.
- Recommended proof: decoded-pixel checks for blank, solid, transparent, and valid images.

### AI-004: Anthropic-compatible provenance endpoint is wrong

- Severity: P2
- Material: yes
- Evidence: `src/llm/providers/AnthropicProvider.ts:48`, `src/llm/providers/AnthropicProvider.ts:188`, `src/llm/LLMClient.ts:549`, `src/llm/LLMClient.ts:567`, `src/llm/LLMClient.ts:781`, `src/config/ProviderRuntime.ts:87`
- Failure mode: provenance reports `${baseUrl}/messages`, but the adapter calls `${baseUrl}/v1/messages`.
- Customer impact: provider failure reports send users to the wrong endpoint.
- Recommended proof: adapter/provenance contract test for the effective request URL.

### AI-005: Three.js prompt contract has drifted from runtime wrapping

- Severity: P2
- Material: yes
- Evidence: `src/prompts/three.ts:7`, `src/prompts/three.ts:42`, `src/generators/three/ThreeGenerator.ts:12`, `src/generators/three/ThreeGenerator.ts:100`, `test/unit/prompts/system-prompt-audit.test.ts:25`, `test/prompts/prompt-validation.test.ts:149`, `docs/PROMPTS.md:30`
- Failure mode: audited prompt asks for full HTML with import map and Three 0.172.0 while runtime expects raw scene JS and wraps Three 0.160.0.
- Customer impact: prompt compliance and runtime execution are measuring different contracts.
- Recommended proof: prompt audit that renders through the actual Three generator path.

### AI-006: Reasoning/thinking fields can leak into artifact extraction

- Severity: P2
- Material: yes
- Evidence: `src/llm/providers/OpenAIProvider.ts:190`, `src/generators/TierBasedGenerator.ts:239`, `src/generators/TierBasedGenerator.ts:553`, `src/core/validators/types.ts:95`, `src/core/validators/types.ts:135`
- Failure mode: empty final content can be replaced by reasoning/thinking fields and permissive extraction can turn hidden reasoning into product output.
- Customer impact: non-user-facing model internals can become generated artifacts.
- Recommended proof: provider response fixtures with reasoning-only output that must fail artifact extraction.
