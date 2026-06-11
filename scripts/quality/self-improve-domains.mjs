// Domain-targeting helpers for the self-improvement cycle.
//
// Why this exists: the cycle used to fire abstract creative themes whose domain
// detection (`detectPromptDomain`) returns null, so EVERY `--learn` output was
// archived under the single fallback domain ('p5'). The per-domain QualityArchive
// therefore never diversified — glsl/three/tone/etc. stayed empty and the archive
// plateaued. These helpers pick the least-populated domains and phrase each prompt
// so detection routes the generation to the intended domain, letting the archive
// accumulate across all domains instead of one.
//
// Pure module (no top-level side effects) so it is safe to import from tests.

import fs from 'fs';

// Prompt templates verified to route to the named domain via detectPromptDomain
// (see the routing check in the PR description). Keep the domain keyword explicit.
export const DOMAIN_TEMPLATES = {
  p5: (t) => `a p5.js generative sketch of ${t}`,
  glsl: (t) => `a GLSL fragment shader of ${t}`,
  three: (t) => `a Three.js 3D scene of ${t}`,
  hydra: (t) => `a Hydra live-coding visual of ${t}`,
  svg: (t) => `an SVG vector illustration of ${t}`,
  strudel: (t) => `a Strudel live-coding music pattern of ${t}`,
  tone: (t) => `a Tone.js generative audio piece of ${t}`,
  ascii: (t) => `ASCII art of ${t}`,
  kinetic: (t) => `kinetic typography animation of ${t}`,
  textgen: (t) => `concrete poetry about ${t}`,
};

export const TARGET_DOMAINS = Object.keys(DOMAIN_TEMPLATES);

// Mirror of QualityArchive.DEFAULT_MAX_EXAMPLES — a domain already at the cap
// cannot grow, so generating for it would not accumulate.
export const MAX_PER_DOMAIN = 20;

/** Read per-domain entry counts from a QualityArchive JSON file. Missing/corrupt → {}. */
export function readPerDomainCounts(archivePath) {
  try {
    const data = JSON.parse(fs.readFileSync(archivePath, 'utf-8'));
    const archives = data && typeof data.archives === 'object' && data.archives ? data.archives : {};
    const counts = {};
    for (const [domain, entries] of Object.entries(archives)) {
      counts[domain] = Array.isArray(entries) ? entries.length : 0;
    }
    return counts;
  } catch {
    return {};
  }
}

/**
 * Pick `n` domains to generate for this cycle from those below the cap (a full domain
 * can't accumulate), ordered emptiest-first with a domains-list tiebreak.
 *
 * `seed` rotates the start of the under-cap pool. Without rotation the picker would
 * deterministically target the same strictly-emptiest domains every cycle — and if some
 * of those never accumulate (e.g. a domain whose generator doesn't archive), the loop
 * fixates on them forever and nets Δ0, never touching archivable domains that still have
 * room. A per-cycle seed spreads coverage across ALL under-cap domains so the fillable
 * ones make progress. seed=0 preserves the deterministic emptiest-first order.
 */
export function pickUnderfilledDomains(counts, domains = TARGET_DOMAINS, cap = MAX_PER_DOMAIN, n = 3, seed = 0) {
  const countOf = (d) => counts[d] ?? 0;
  const underCap = domains.filter((d) => countOf(d) < cap);
  const pool = (underCap.length > 0 ? underCap : domains)
    .slice()
    .sort((a, b) => countOf(a) - countOf(b) || domains.indexOf(a) - domains.indexOf(b));
  if (pool.length === 0) return [];
  const offset = ((Math.trunc(seed) % pool.length) + pool.length) % pool.length;
  const rotated = pool.slice(offset).concat(pool.slice(0, offset));
  const picks = [];
  for (let i = 0; i < n; i++) picks.push(rotated[i % rotated.length]);
  return picks;
}

/** Build a domain-routed prompt for a theme. Unknown domain → the raw theme. */
export function buildDomainPrompt(domain, theme) {
  const template = DOMAIN_TEMPLATES[domain];
  return template ? template(theme) : theme;
}

// Mirror of the descriptor axes used by the garden commands (bin/sinter) and
// EmergenceHooks — keep in sync if the axis list ever changes.
export const DESCRIPTOR_AXES = [
  'order-chaos',
  'sparse-dense',
  'symmetry-asymmetry',
  'smooth-bursty',
  'static-evolving',
  'harmonic-dissonant',
];

const AXIS_POLES = {
  'order-chaos': ['orderly', 'chaotic'],
  'sparse-dense': ['sparse', 'dense'],
  'symmetry-asymmetry': ['symmetric', 'asymmetric'],
  'smooth-bursty': ['smooth', 'bursty'],
  'static-evolving': ['still', 'ever-evolving'],
  'harmonic-dissonant': ['harmonic', 'dissonant'],
};

/**
 * Turn a persisted dream task (sources carry descriptor vectors on the garden
 * axes) into a generation theme: name each parent's OWN decisive poles
 * (≤0.35 → first pole, ≥0.65 → second pole) and cross distinct parents.
 * Averaging the parents annihilated the tension recombination exists for —
 * opposite poles cancel toward 0.5, and 41/50 queued dreams rendered the
 * identical "chaotic, sparse, asymmetric…" theme (FAB-022). This is how the
 * gardener's dream recombinations become real generation prompts in the
 * self-improve cycle. Returns null when the task has no usable descriptors.
 */
export function dreamThemeFromTask(task, axes = DESCRIPTOR_AXES) {
  const descriptors = (task?.sources ?? [])
    .map((s) => s?.descriptor)
    .filter((d) => Array.isArray(d) && d.length > 0);
  if (descriptors.length === 0) return null;

  const polesFor = (d) => {
    const dims = Math.min(axes.length, d.length);
    const words = [];
    for (let i = 0; i < dims; i++) {
      const poles = AXIS_POLES[axes[i]];
      if (!poles) continue;
      if (d[i] <= 0.35) words.push(poles[0]);
      else if (d[i] >= 0.65) words.push(poles[1]);
    }
    return words;
  };

  const voices = descriptors.map((d) => polesFor(d).join(', ')).filter((v) => v.length > 0);
  const distinct = [...new Set(voices)];
  if (distinct.length >= 2) {
    const [a, b] = distinct.map((v) => v.split(', ').slice(0, 3).join(', '));
    return `${a} crossed with ${b} — one work fusing both lineage parents`;
  }
  return `${distinct[0] ?? 'balanced'} forms recombined from its own archive lineage`;
}
