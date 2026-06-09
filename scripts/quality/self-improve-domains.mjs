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
