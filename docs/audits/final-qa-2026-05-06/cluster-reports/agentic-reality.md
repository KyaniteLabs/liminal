# Agentic Reality Cluster Report

Personas: David Isler, Liz the Developer

Lens: agent workflows, demos-to-reality gaps, public-source implementation patterns, community comprehension.

Status: first-pass white-box review complete. This cluster found release-blocking self-healing, persona-runtime, example, provenance, and setup-truth gaps.

## Findings

### AR-001: HarnessUpdater/self-healing docs describe runtime behavior that no longer exists

- Severity: P1
- Material: yes
- Evidence: `AGENTS.md:146`, `docs/ARCHITECTURE_AND_PHILOSOPHY.md:51`, `src/harness/MetaHarnessIntegration.ts:22`, `src/harness/MetaHarnessIntegration.ts:221`, `docs/THE_BIBLE.md:254`, `docs/THE_BIBLE.md:284`
- Failure mode: docs describe an active `HarnessUpdater` applying adaptations, but runtime only records manual-fix memory and `src/harness/HarnessUpdater.ts` is absent.
- Customer impact: the project overclaims self-improvement and autonomous repair.
- Recommended proof: either restore the runtime path with tests or rewrite docs to the actual manual-memory behavior.

### AR-002: Factory personas and RAG folders are docs-only, not runtime skills

- Severity: P2
- Material: yes
- Evidence: `docs/agents/factory-artists/README.md:13`, `docs/agents/factory-artists/rag/README.md:3`, `src/harness/skills/SkillLoader.ts:54`, `src/tui-bridge/TuiBridgeService.ts:519`, `src/tui-bridge/TuiBridgeService.ts:1009`
- Failure mode: factory/RAG material is not loaded by the runtime skill system, which searches `.skills`, `~/.agents/skills`, and `~/.codex/skills`.
- Customer impact: future agents may assume `/skill davidisler` or equivalent works when it does not.
- Recommended proof: final-QA persona prompts must label personas as audit reference material, not runtime configuration.

### AR-003: Composition examples are broken and excluded from TypeScript checks

- Severity: P2
- Material: yes
- Evidence: `examples/composition-basic.ts:10`, `examples/composition-programmatic.ts:8`, `examples/composition-programmatic.ts:145`, `src/index.ts:614`, `src/index.ts:640`, `src/composition/index.ts:70`, `tsconfig.json:26`
- Failure mode: examples import composition APIs from the root package, but root exports do not expose them; one example uses `require('fs')` in an ESM package and examples are excluded from TS compile.
- Customer impact: copy-pasted examples fail.
- Recommended proof: compile or smoke all examples exactly as documented.

### AR-004: Route performance proof command is broken

- Severity: P2
- Material: yes
- Evidence: `package.json:67`, `package.json:69`, `docs/audits/final-qa-2026-05-06/preflight-inventory.md:34`
- Failure mode: a documented proof command references a missing file.
- Customer impact: audit/proof instructions cannot be followed.
- Recommended proof: package-script target check and real command execution.

### AR-005: StudioAgent provenance overstates ConveyorRunner delegation

- Severity: P2
- Material: yes
- Evidence: `src/agent/IntentRouter.ts:4`, `src/agent/StudioAgent.ts:192`, `src/agent/TaskDelegator.ts:4`, `src/tui-bridge/TuiBridgeService.ts:799`, `src/tui-bridge/TuiBridgeService.ts:2573`, `src/tui-bridge/TuiBridgeService.ts:2634`
- Failure mode: session summaries describe ConveyorRunner delegation while bridge execution goes through LLMModeAgent paths.
- Customer impact: receipts and demos imply a different executor than actually ran.
- Recommended proof: provenance assertions that name the exact executor path per run.

### AR-006: GLM setup is documented but diagnostics validate old generic env keys

- Severity: P2
- Material: yes
- Evidence: `README.md:68`, `src/agent/OnboardingWizard.ts:59`, `src/agent/OnboardingWizard.ts:136`, `src/agent/EnvironmentValidator.ts:85`, `test/unit/agent/EnvironmentValidator.test.ts:48`
- Failure mode: onboarding promotes `LIMINAL_LLM_PROVIDER=glm` and `GLM_API_KEY`, while diagnostics check `LLM_BASE_URL` and `LLM_API_KEY`.
- Customer impact: correctly configured GLM users can be told their environment is broken.
- Recommended proof: provider-specific env validation tests for GLM and documented providers.

### AR-007: Swarm/persona counts and terminology drift across docs and code

- Severity: P3
- Material: no
- Evidence: `README.md:106`, `README.md:128`, `src/types/options/SwarmOptions.ts:15`, `src/core/GenerationOrchestrator.ts:6`, `src/swarm/personas.ts:5`, `test/swarm/personas.test.ts:10`
- Failure mode: public docs mix 3-agent CreativeBoard, 5 default swarm, and stale 7-persona comments.
- Customer impact: confusing mental model, but secondary to runtime execution/provenance bugs.
- Recommended proof: terminology pass after the executor/provenance truth is fixed.
