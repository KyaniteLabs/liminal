/**
 * Per-generation endpoint override for the `generator` role — the dispatch half
 * of the hybrid local/cloud router.
 *
 * GenerationOrchestrator resolves a local (e.g. nucbox) generator override for
 * local-favored domains and runs the dispatch inside {@link runWithGeneratorOverride}.
 * When a `role: 'generator'` LLMClient is then constructed (each generator builds
 * its client fresh, inside that call), the constructor reads
 * {@link getActiveGeneratorOverride} and redirects to the local endpoint.
 *
 * Scoped via AsyncLocalStorage so concurrent best-of-N candidates don't leak
 * overrides into each other. Standalone (only `node:async_hooks`) so LLMClient can
 * import it without an import cycle.
 */
import { AsyncLocalStorage } from 'node:async_hooks';

export interface GeneratorOverride {
  baseUrl: string;
  model: string;
  apiKey?: string;
}

const storage = new AsyncLocalStorage<GeneratorOverride | undefined>();

/** Run `fn` with `override` active for any role:'generator' client built inside it. */
export function runWithGeneratorOverride<T>(override: GeneratorOverride | null | undefined, fn: () => T): T {
  return storage.run(override ?? undefined, fn);
}

/** The override active for the current async context, if any. */
export function getActiveGeneratorOverride(): GeneratorOverride | undefined {
  return storage.getStore();
}
