/**
 * Hybrid local/cloud generator routing — the resolver half.
 *
 * Given the current creative domain, decides whether this generation should run
 * on the local (e.g. nucbox) generator instead of the cloud `generator` role:
 *   1. `roles.generatorLocal` must be configured (else opt-out → null).
 *   2. The smart router must prefer 'local' for this domain's routing bucket.
 *
 * GenerationOrchestrator passes the result to runWithGeneratorOverride so every
 * `role: 'generator'` LLMClient built during the dispatch picks up the override.
 */
import { generatorRegistry } from './GeneratorRegistry.js';
import { domainToRoutingType } from '../routing/RoutingData.js';
import { LLMClient } from '../llm/LLMClient.js';
import { Logger } from '../utils/Logger.js';
import type { GeneratorOverride } from '../llm/generatorOverrideContext.js';

/**
 * Resolve a local generator override for `domain`, or null to keep the cloud
 * generator. Null whenever generatorLocal is unconfigured or the router prefers
 * cloud — so the hybrid is inert until the operator configures a local endpoint.
 *
 * This runs on the hot generation path, so it must NEVER throw: any failure
 * (config read, routing lookup) falls back to the cloud generator. The hybrid is
 * an optimization, never a hard dependency that can break or hang a generation.
 */
export function resolveLocalGeneratorOverride(domain: string | null | undefined): GeneratorOverride | null {
  try {
    const local = LLMClient.getRawRoleConfig()?.roles?.generatorLocal;
    if (!local?.baseUrl || !local?.model) return null;

    const decision = generatorRegistry.route(domainToRoutingType(domain));
    if (decision.model !== 'local') return null;

    return local.apiKey
      ? { baseUrl: local.baseUrl, model: local.model, apiKey: local.apiKey }
      : { baseUrl: local.baseUrl, model: local.model };
  } catch (err) {
    Logger.warn('resolveLocalGenerator', 'Local route resolution failed; falling back to cloud generator:', err instanceof Error ? err.message : err);
    return null;
  }
}
