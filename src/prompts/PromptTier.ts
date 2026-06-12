/**
 * PromptTier — model-aware prompt variant selection.
 *
 * Every prompt in Sinter was historically written once and served to every
 * model identically. Small local models (gemma4:12b on the nucbox) fail
 * frontier-tuned prompts in measured ways: nested-JSON formats break their
 * parsers and anchor-free rubrics collapse to ceiling scores. This module
 * routes each model to a prompt tier:
 *
 *  - 'full'    — frontier cloud models; rich instructions, nested structures.
 *  - 'compact' — local/small models; ≤⅓ length, flat JSON, banded rubrics.
 *
 * Resolution: explicit config override (`promptTiers` map, same pattern as
 * `capabilities`) > local-provider rule > small-model heuristics > 'full'.
 */

export type PromptTier = 'full' | 'compact';

/** Providers that serve local models — always compact. */
const LOCAL_PROVIDERS = new Set(['ollama', 'lmstudio']);

/** Small-model name markers, boundary-aware so 'gemini' never matches 'mini'. */
const SMALL_MODEL_RE = /(^|[^a-z0-9])(mini|nano|tiny|phi\d*)([^a-z0-9]|$)/;
const SMALL_MODEL_FRAGMENTS = ['gemma'];

/** Parameter-count suffix (e.g. `qwen2.5:7b`, `llama3:70b`). ≤ this → compact. */
const SMALL_PARAM_THRESHOLD_B = 14;

function matchesPattern(value: string, pattern: string): boolean {
  const v = value.toLowerCase();
  const p = pattern.toLowerCase();
  if (p.endsWith('*')) return v.startsWith(p.slice(0, -1));
  return v === p;
}

function paramCountB(model: string): number | undefined {
  const m = model.toLowerCase().match(/[:\-_](\d+(?:\.\d+)?)b\b/);
  return m ? parseFloat(m[1]) : undefined;
}

/**
 * Resolve the prompt tier for a model/provider pair.
 * @param overrides — config `promptTiers` map: model pattern → tier.
 */
export function resolvePromptTier(
  model: string,
  provider?: string,
  overrides?: Record<string, PromptTier>,
): PromptTier {
  if (overrides) {
    for (const [pattern, tier] of Object.entries(overrides)) {
      if (matchesPattern(model, pattern)) return tier;
    }
  }
  if (provider && LOCAL_PROVIDERS.has(provider.toLowerCase())) return 'compact';
  const m = model.toLowerCase();
  if (SMALL_MODEL_FRAGMENTS.some((f) => m.includes(f)) || SMALL_MODEL_RE.test(m)) return 'compact';
  const params = paramCountB(model);
  if (params !== undefined) return params <= SMALL_PARAM_THRESHOLD_B ? 'compact' : 'full';
  return 'full';
}

/** Pick the prompt variant for a tier; compact falls back to full if unauthored. */
export function tiered(variants: { full: string; compact?: string }, tier: PromptTier): string {
  if (tier === 'compact' && variants.compact !== undefined) return variants.compact;
  return variants.full;
}
