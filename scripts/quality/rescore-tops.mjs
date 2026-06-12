// Read-only re-score report for the best visual archive entries.
//
// Builds must run first so this script uses the compiled runtime under dist/.
// It intentionally never calls QualityArchive.save() or writes archive data.

import fs from 'node:fs/promises';
import { QualityArchive } from '../../dist/learning/QualityArchive.js';
import { eventBus } from '../../dist/core/EventBus.js';
import { HeadlessRenderer } from '../../dist/render/HeadlessRenderer.js';
import { scoreRenderedEvidence } from '../../dist/core/ScoringEngine.js';

const VISUAL_DOMAINS = ['p5', 'glsl', 'three', 'hydra', 'svg', 'ascii', 'textgen', 'kinetic'];
const TOP_N = 2;

// EventBus normally mirrors LLM timing events to stdout; this report's stdout
// contract is newline-delimited JSON, so suppress those process-wide event logs.
eventBus.enableTuiMode();

function isNonQuarantined(entry) {
  return !(entry && entry.metadata && entry.metadata.quarantinedAt);
}

function topEntriesForDomain(archives, domain) {
  const entries = Array.isArray(archives[domain]) ? archives[domain] : [];
  return entries
    .filter(isNonQuarantined)
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => {
      const scoreDelta = (b.entry.qualityScore ?? 0) - (a.entry.qualityScore ?? 0);
      return scoreDelta || a.index - b.index;
    })
    .slice(0, TOP_N)
    .map(({ entry }) => entry);
}

function roundScore(value) {
  return Math.round(value * 10000) / 10000;
}

async function readArchiveData() {
  const archivePath = process.env.QUALITY_ARCHIVE_PATH ?? QualityArchive.DEFAULT_PATH;
  const raw = await fs.readFile(archivePath, 'utf-8');
  const data = JSON.parse(raw);
  return data && typeof data.archives === 'object' && data.archives ? data.archives : {};
}

const archives = await readArchiveData();
const renderer = new HeadlessRenderer();

try {
  for (const domain of VISUAL_DOMAINS) {
    const entries = topEntriesForDomain(archives, domain);
    if (entries.length < TOP_N) {
      throw new Error(`Expected ${TOP_N} non-quarantined ${domain} entries, found ${entries.length}`);
    }

    for (const entry of entries) {
      const evidence = await renderer.renderWithEvidence(entry.output, { domain });
      const evaluation = await scoreRenderedEvidence(
        evidence,
        entry.output,
        entry.prompt ?? `Archive ${domain} entry ${entry.id}`,
        undefined,
        domain,
      );
      const stored = roundScore(entry.qualityScore ?? 0);
      const fresh = roundScore(evaluation.score ?? 0);
      console.log(JSON.stringify({
        id: entry.id,
        domain,
        stored,
        fresh,
        delta: roundScore(fresh - stored),
      }));
    }
  }
} finally {
  await renderer.close();
}
