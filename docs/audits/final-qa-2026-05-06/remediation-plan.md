# Remediation Plan

Status: first-pass plan; Batch 0 partially executed in `fix/final-qa-batch0-remediation-20260506`.

Saturation is not achieved. This plan converts confirmed first-pass findings into an execution order so remediation can begin without new strategic decisions once the audit owner opens implementation worktrees.

No remediation is complete until its finding is marked `fixed` and then `verified` in `findings-ledger.md` with command or live-run evidence.

## Batch 0: Containment And Truth Repair

Release risk: highest. These items prevent honest launch claims and false release gates.

1. Fix or remove `proof:route-performance`.
   - Findings: FQA-001
   - Action: either restore `scripts/proof/route-performance-budget.ts` with real assertions or remove the package script and every launch claim that depends on it.
   - Proof: package-script target scan passes; `pnpm proof:route-performance` exits 0 and writes a receipt.
   - Remediation status: verified. Added `scripts/proof/route-performance-budget.ts`, `scripts/ci/check-package-script-targets.mjs`, `pnpm check:script-targets`, and regression coverage.

2. Repair launch claim truth.
   - Findings: FQA-004, FQA-005, FQA-008, FQA-009
   - Action: create a feature-claim ledger and downgrade every public claim that lacks live proof. Replace placeholder PR review language with explicit placeholder truth or a real gate.
   - Proof: every launch/public claim maps to a passing command, live receipt, or documented caveat.
   - Remediation status: FQA-004, FQA-005, and FQA-008 verified; FQA-009 fixed in workflow/branch-protection config but still needs a GitHub PR run.

3. Make branch protection real before publication.
   - Findings: FQA-007
   - Action: configure required checks and PR review policy on `main`.
   - Proof: live `gh api` readback shows required checks/reviews.
   - Remediation status: verified. Live readback requires `build-and-test`, `browser-and-e2e-smoke`, `validate-docs`, one PR approval, stale-review dismissal, admin enforcement, conversation resolution, linear history, and no force pushes/deletions.

4. Correct self-healing/HarnessUpdater claims.
   - Findings: FQA-012
   - Action: either restore a tested runtime implementation or rewrite docs to the current manual-memory behavior.
   - Proof: docs/runtime consistency test or direct source check.
   - Remediation status: verified. Docs now describe manual-memory behavior and `test/unit/harness-self-healing-docs.test.ts` locks the claim.

5. Repair git/CI packaging.
   - Findings: FQA-002
   - Action: ensure git dependency installs build package artifacts under `CI=1` and that installed consumers can import the package and run the CLI.
   - Proof: clean temp git dependency install with `CI=1`, import package, and run `liminal --version`.
   - Remediation status: verified. `prepare` now builds missing `dist`, `postinstall` is a backstop instead of a CI blind spot, package file allowlisting keeps lifecycle helpers, the self `link:` dependency is removed, runtime `typescript` is installed for parser imports, and `pnpm proof:git-ci-install` verifies the full clean install path.

## Batch 1: Silent Failure And Evidence Integrity

Release risk: high. These items turn failures into success or weak proof into readiness.

1. Fix streaming fallback error handling.
   - Findings: FQA-003, FQA-033
   - Action: propagate fallback stream errors through LLM client and TUI bridge terminal events.
   - Proof: failing-provider stream test proves no empty completed response is emitted, and integration/slow CI no longer fail from empty-code generation.
   - Remediation status: FQA-003 verified for streaming fallback errors. FQA-033 remains open because integration/slow suites still need their broader empty-code and run/merge/approve failures fixed.

2. Harden release-gate receipts.
   - Findings: FQA-004
   - Action: require commit SHA, timestamp freshness, provider identity, case matrix, and artifact existence checks.
   - Proof: receipt validator rejects stale, wrong-SHA, missing-artifact, and insufficient-case receipts.
   - Remediation status: verified. `ProofReceiptValidator` now backs market readiness and Level 6 live receipts; model-assimilation reports include `gitCommit` and case coverage.

3. Make evaluator degradation explicit.
   - Findings: FQA-010
   - Action: evaluator exceptions must mark degraded evidence and block confidence-1 success.
   - Proof: evaluator-throws regression produces degraded/non-passing result.
   - Remediation status: verified. RalphLoop now records auto evaluator/scorer fallback as `confidence:0` degraded evidence, and the creative gate blocks completion when fallback evidence is degraded.

4. Add decoded-pixel visual proof.
   - Findings: FQA-011
   - Action: replace byte-pattern visibility checks with decoded-pixel validation.
   - Proof: blank/solid/transparent fixtures fail; real visual fixture passes.
   - Remediation status: verified. Screenshot scoring and render-evidence perception now decode pixels and fail closed for undecodable, transparent, blank, or solid screenshots.

5. Block reasoning/thinking artifact leakage.
   - Findings: FQA-029
   - Action: artifact extraction must use final user-visible content only unless a provider explicitly marks a content field safe for display.
   - Proof: reasoning-only provider fixture fails extraction.
   - Remediation status: verified. OpenAI-compatible and MiniMax providers now keep `reasoning_content` as thinking diagnostics only, LLMClient no longer recovers artifacts from thinking or `<think>`-only output, and TierBasedGenerator no longer promotes tool-loop thinking into code.

## Batch 2: First-Run And Customer-Control UX

Release risk: high. These items make customers angry even when the core code runs.

1. Align provider setup and diagnostics.
   - Findings: FQA-006
   - Action: update CLI help, onboarding, and env validation around documented providers, especially GLM.
   - Proof: credential-free provider setup diagnostics tests.
   - Remediation status: verified. `EnvironmentValidator` now uses ProviderRuntime provider/key truth, fails selected cloud providers with exact key guidance, accepts GLM/provider-specific keys without generic envs, treats LM Studio/Ollama as keyless local providers, avoids inferring GLM from Anthropic-compatible fallback tokens alone, and CLI help/shorthands advertise the documented provider set.

2. Make stop/cancel visible and effective.
   - Findings: FQA-016, FQA-023, FQA-024
   - Action: visible active-run stop affordance; propagate AbortSignal through draft generation, provider calls, and retry sleeps.
   - Proof: UI smoke shows stop button; fake provider confirms abort; retry backoff aborts immediately.
   - Remediation status: verified. The Studio composer now exposes a visible active-run stop control wired to `bridge.cancelCurrent()`, draft timeout aborts the underlying generation controller, `LLMClient` passes generation and completion signals into `RetryManager`, and retry backoff sleeps abort immediately.

3. Fix Revideo/video intent routing and preview failure states.
   - Findings: FQA-017, FQA-019
   - Action: route common video/timeline prompts correctly and render visible image-preview failure states.
   - Proof: routing tests and broken-preview browser test.
   - Remediation status: verified. Common video/timeline/mp4/motion-graphics prompts now route to Revideo, and broken inline image previews render a visible alert/retry state instead of disappearing.

4. Rewrite first-time user docs.
   - Findings: FQA-018
   - Action: replace harness-era commands with current Studio/workbench/CLI paths.
   - Proof: docs claim scan plus manual first-run smoke.
   - Remediation status: verified. `docs/WHAT_TO_EXPECT.md` now describes `pnpm gui`, Message Liminal, Generate, Polish, same-screen preview, visible preview errors, provider setup, and current local verification commands; a focused docs contract rejects the retired harness task-runner path.

## Batch 3: Runtime Contracts And Examples

Release risk: medium-high. These items reduce integration debt and future bug generation.

1. Share event contracts between bridge and GUI.
   - Findings: FQA-014
   - Action: move GUI telemetry/cockpit event parsing onto shared types or generated schema; expose public conversation history API.
   - Proof: backend/frontend type-contract test.

2. Fix examples and include them in verification.
   - Findings: FQA-021
   - Action: export documented composition APIs or update imports; replace CJS `require` in ESM examples; compile examples.
   - Proof: example compile/smoke script passes.
   - Remediation status: verified. `pnpm check:examples` now compiles the composition examples against the public root API and smokes `examples/composition-programmatic.ts` into a temp output directory; examples use ESM filesystem imports and `CompositionEngine.exportProject()` no longer relies on runtime `require()`.

3. Correct Studio executor provenance.
   - Findings: FQA-022
   - Action: receipts must name actual executor path and delegation boundary.
   - Proof: per-mode provenance tests.
   - Remediation status: verified. Studio response metadata and TUI bridge lifecycle/session-turn events now separate delegation boundary from concrete executor. Engineering bridge runs report `delegatedTo: "engineering-agent"` and `executor: "llm-mode-agent"`; injected Studio engineering delegates report `delegatedTo: "engineering-delegate"` plus the delegate-supplied executor when available. Compatibility note: existing consumers matching `delegatedTo: "conveyor"` should migrate to `engineering-agent` and use `executor` for the actual runtime path.

4. Fix Anthropic-compatible provenance URL.
   - Findings: FQA-027
   - Action: derive displayed endpoint from the adapter request path.
   - Proof: adapter/provenance contract test.
   - Remediation status: verified. `AnthropicProvider` and `LLMClient` now share the same effective `/v1/messages` endpoint builder, including already-`/v1` base URLs and Anthropic-compatible GLM/Z.ai paths.

5. Align Three prompt and runtime wrapper.
   - Findings: FQA-028
   - Action: choose one contract: full HTML or raw scene JS, one Three version, one audited path.
   - Proof: prompt audit renders through actual generator path.
   - Remediation status: verified. `three.generate`, `docs/PROMPTS.md`, Three harness skeleton/repair hints, and `ThreeGenerator.wrapForGallery()` now share the raw-scene JavaScript contract. Prompt metadata uses `SERVICE_DEFAULTS.THREE_VERSION`, the gallery import map uses `THREE_CDN`, and regression tests block full HTML/import-map/import-statement drift and undefined skeleton dimensions from returning through prompt or harness recovery paths.

## Batch 4: Coverage And Guardrails

Release risk: medium. These items prevent recurrence.

1. Expand final QA gate coverage.
   - Findings: FQA-013, FQA-015, FQA-034
   - Action: include GUI, Bubble Tea, scripts, examples, pending-test classification, strict test-quality scanning, and all launch-scoped creative domains in final QA.
   - Proof: final QA script prints included surfaces/domains and fails on weak assertion fixtures or missing live artifacts.

2. Repair observability proof and SSE replay.
   - Findings: FQA-025, FQA-026
   - Action: prove real runtime-originated events and preserve lifecycle/provenance in replay.
   - Proof: real generation observability proof and long-stream replay test.
   - Remediation status: verified. `TuiEventStream` now preserves replay anchors for run lifecycle, route/provenance, terminal status, and error events across long content streams while keeping non-critical events tail-bounded. `pnpm proof:user-surface-observability` now drives the real Studio draft-generation path through a local OpenAI-compatible proof model and verifies runtime-originated generation, artifact, preview, and session-turn events instead of manually publishing them.

3. Resolve non-material copy drift.
   - Findings: FQA-030, FQA-031, FQA-032
   - Action: copy/terminology/logging cleanup after material truth is fixed.
   - Proof: docs terminology scan and operator smoke.
