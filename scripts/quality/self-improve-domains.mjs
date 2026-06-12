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

/** Read the per-domain archives map from a QualityArchive JSON file.
 *  Missing/corrupt → {}. Returns the raw `archives` object. */
export function readDomainArchives(archivePath) {
  try {
    const data = JSON.parse(fs.readFileSync(archivePath, 'utf-8'));
    return data && typeof data.archives === 'object' && data.archives ? data.archives : {};
  } catch {
    return {};
  }
}

function normalizeArchives(input) {
  if (input == null || typeof input !== 'object') return {};
  if (input.archives && typeof input.archives === 'object') return input.archives;
  return input;
}

function domainEntries(map, domain) {
  const arr = map[domain];
  return Array.isArray(arr) ? arr : [];
}

const round3 = (n) => Math.round(n * 1000) / 1000;

/**
 * Diff two per-domain archive maps (or full QualityArchive file objects) to
 * compute how many entries were admitted by the cycle, their ids, and the
 * post-cycle per-domain score floors/ceilings. Pure function: safe to call from
 * tests without touching the real archive file.
 */
export function diffArchiveAdmissions(beforeArchives, afterArchives) {
  const before = normalizeArchives(beforeArchives);
  const after = normalizeArchives(afterArchives);
  const domains = new Set([...Object.keys(before), ...Object.keys(after)]);
  const beforeIds = new Set();
  const afterIds = new Set();
  const floors = {};
  const tops = {};

  for (const domain of domains) {
    const beforeEntries = domainEntries(before, domain);
    const afterEntries = domainEntries(after, domain);

    for (const e of beforeEntries) {
      if (e && e.id) beforeIds.add(e.id);
    }
    for (const e of afterEntries) {
      if (e && e.id) afterIds.add(e.id);
    }

    if (afterEntries.length > 0) {
      const scores = afterEntries
        .map((e) => (e && typeof e.qualityScore === 'number' ? e.qualityScore : NaN))
        .filter((s) => !Number.isNaN(s));
      if (scores.length > 0) {
        floors[domain] = round3(Math.min(...scores));
        tops[domain] = round3(Math.max(...scores));
      }
    }
  }

  const admittedIds = [];
  for (const id of afterIds) {
    if (!beforeIds.has(id)) admittedIds.push(id);
  }
  admittedIds.sort();

  return { admitted: admittedIds.length, admittedIds, floors, tops };
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
export function pickUnderfilledDomains(counts, domains = TARGET_DOMAINS, cap = MAX_PER_DOMAIN, n = 3, seed = 0, quality = {}) {
  const countOf = (d) => counts[d] ?? 0;
  const underCap = domains.filter((d) => countOf(d) < cap);
  // Quality-aware targeting (all-domains-at-A): a capped domain whose archive
  // top is still below the A-bar stays targetable so the displacement ratchet
  // can keep lifting it — count-only targeting starves capped-but-mediocre
  // domains of all generation pressure. quality[d] = top-quality signal
  // (e.g. mean of the domain's top-2 archive scores); omit to keep the old
  // count-only behavior.
  const QUALITY_BAR = 0.9;
  const belowBar = domains.filter(
    (d) => countOf(d) >= cap && quality[d] !== undefined && quality[d] < QUALITY_BAR,
  );
  const ranked = [
    ...underCap.slice().sort((a, b) => countOf(a) - countOf(b) || domains.indexOf(a) - domains.indexOf(b)),
    ...belowBar.slice().sort((a, b) => quality[a] - quality[b] || domains.indexOf(a) - domains.indexOf(b)),
  ];
  const pool = ranked.length > 0
    ? ranked
    : domains
      .slice()
      .sort((a, b) => countOf(a) - countOf(b) || domains.indexOf(a) - domains.indexOf(b));
  if (pool.length === 0) return [];
  const offset = ((Math.trunc(seed) % pool.length) + pool.length) % pool.length;
  const rotated = pool.slice(offset).concat(pool.slice(0, offset));
  const picks = [];
  for (let i = 0; i < n; i++) picks.push(rotated[i % rotated.length]);
  return picks;
}

/** Read per-domain top-quality signal (mean of the top-2 non-quarantined
 *  scores) from a QualityArchive JSON file. Missing/corrupt → {}. Feeds the
 *  quality-aware arm of pickUnderfilledDomains. */
export function readPerDomainTopQuality(archivePath) {
  try {
    const data = JSON.parse(fs.readFileSync(archivePath, 'utf-8'));
    const archives = data && typeof data.archives === 'object' && data.archives ? data.archives : {};
    const quality = {};
    for (const [domain, entries] of Object.entries(archives)) {
      if (!Array.isArray(entries)) continue;
      const scores = entries
        .filter((e) => !(e && e.metadata && e.metadata.quarantinedAt))
        .map((e) => (e && typeof e.qualityScore === 'number' ? e.qualityScore : 0))
        .sort((a, b) => b - a)
        .slice(0, 2);
      if (scores.length > 0) quality[domain] = scores.reduce((s, v) => s + v, 0) / scores.length;
    }
    return quality;
  } catch {
    return {};
  }
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
