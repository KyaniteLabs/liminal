# ADR 0001: Provider runtime truth belongs in ProviderRuntime

- **Status:** Accepted
- **Date:** 2026-04-30

## Context

Liminal resolves LLM runtime details in several paths: user/project config loading, role config, model config, the meta-harness provider registry, the TUI bridge, and endpoint API-key selection. Before this decision, provider aliases, default endpoints, default models, key environment-variable order, key-required checks, status labels, adapter detection, and `apiStyle` inference were duplicated across those paths. That made provider truth drift easy: a provider could appear configured in one surface, use a different default endpoint in another, or report a misleading runtime label to the operator.

## Decision

`src/config/ProviderRuntime.ts` is the canonical module for provider/runtime truth:

- canonical provider keys and aliases
- provider defaults: endpoint, model, label, description, key requirement, API style, temperature, and token budget
- runtime provider detection from endpoints/models
- status-label and adapter inference
- vision-support inference
- provider-specific and endpoint-specific API-key environment-variable order
- placeholder-key filtering and key selection

Callers may still own surface-specific policy, but they must delegate provider facts to `ProviderRuntime.ts`. Examples: `ConfigLoader` may preserve legacy implicit-local defaults, and `MultiProviderConfig` may keep harness fallback policy, but neither should keep local provider default maps or key-required sets.

## Consequences

- Adding or changing a provider starts in `ProviderRuntime.ts`, then tests assert the surface-specific behavior.
- Harness templates are generated from runtime defaults instead of hand-maintained copies.
- `ProviderKeyResolver`, `ModelConfig`, `RoleConfig`, and `BridgeLauncherConfig` become thin consumers of the shared contract.
- Endpoint-specific behavior, such as MiniMax `/v1` using OpenAI style while MiniMax `/anthropic` uses Anthropic style, is tested at the runtime seam.
