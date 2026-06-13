// Re-score report (and, with --persist, re-normalization) for visual archive entries.
//
// Builds must run first so this script uses the compiled runtime under dist/.
// Default and --floors modes are READ-ONLY. --persist mutates ONLY through
// QualityArchive.rescoreEntry (class-mutation rule) after writing a timestamped
// backup of the archive file, and verifies by reloading.
//
// Flags:
//   --floors   re-score the BOTTOM-2 non-quarantined entries per visual domain
//              and emit each record with `position: "floor"`.
//   --all      re-score EVERY non-quarantined entry per visual domain.
//   --domain <d[,d2]>  restrict to the given visual domain(s) (default: all).
//   --persist  write fresh scores back via QualityArchive.rescoreEntry.
//              PAUSE the self-improve daemon first — concurrent saves race.
//              (Simon-approved re-normalization, 2026-06-12.)

import fs from 'node:fs/promises';
import { QualityArchive } from '../../dist/learning/QualityArchive.js';
import { eventBus } from '../../dist/core/EventBus.js';
import { HeadlessRenderer } from '../../dist/render/HeadlessRenderer.js';
import { scoreRenderedEvidence } from '../../dist/core/ScoringEngine.js';

const VISUAL_DOMAINS = ['p5', 'glsl', 'three', 'hydra', 'svg', 'ascii', 'textgen', 'kinetic'];
const TOP_N = 2;
const FLOORS_MODE = process.argv.includes('--floors');
const ALL_MODE = process.argv.includes('--all');
const PERSIST = process.argv.includes('--persist');
const domainArgIndex = process.argv.indexOf('--domain');
const DOMAIN_FILTER = domainArgIndex >= 0
  ? (process.argv[domainArgIndex + 1] ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  : null;
const DOMAINS = DOMAIN_FILTER && DOMAIN_FILTER.length
  ? VISUAL_DOMAINS.filter((d) => DOMAIN_FILTER.includes(d))
  : VISUAL_DOMAINS;
if (DOMAIN_FILTER && DOMAINS.length === 0) {
  console.error(`[rescore] --domain matched no known visual domain (known: ${VISUAL_DOMAINS.join(', ')})`);
  process.exit(1);
}

// EventBus normally mirrors LLM timing events to stdout; this report's stdout
// contract is newline-delimited JSON, so suppress those process-wide event logs.
eventBus.enableTuiMode();

function isNonQuarantined(entry) {
  return !(entry && entry.metadata && entry.metadata.quarantinedAt);
}

function rankedEntriesForDomain(archives, domain, { ascending }) {
  const entries = Array.isArray(archives[domain]) ? archives[domain] : [];
  return entries
    .filter(isNonQuarantined)
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => {
      const scoreDelta = ascending
        ? (a.entry.qualityScore ?? 0) - (b.entry.qualityScore ?? 0)
        : (b.entry.qualityScore ?? 0) - (a.entry.qualityScore ?? 0);
      return scoreDelta || a.index - b.index;
    })
    .slice(0, TOP_N)
    .map(({ entry }) => entry);
}

function topEntriesForDomain(archives, domain) {
  return rankedEntriesForDomain(archives, domain, { ascending: false });
}

function floorEntriesForDomain(archives, domain) {
  return rankedEntriesForDomain(archives, domain, { ascending: true });
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

const stampDate = new Date().toISOString().slice(0, 10);
const archives = await readArchiveData();
const renderer = new HeadlessRenderer();

let persistArchive = null;
if (PERSIST) {
  const archivePath = process.env.QUALITY_ARCHIVE_PATH ?? QualityArchive.DEFAULT_PATH;
  const backupPath = `${archivePath}.bak-renorm-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  await fs.copyFile(archivePath, backupPath);
  console.error(`[persist] backup written: ${backupPath}`);
  persistArchive = new QualityArchive({ path: archivePath });
  await persistArchive.load();
}

try {
  for (const domain of DOMAINS) {
    const entries = ALL_MODE
      ? (Array.isArray(archives[domain]) ? archives[domain] : []).filter(isNonQuarantined)
      : FLOORS_MODE
        ? floorEntriesForDomain(archives, domain)
        : topEntriesForDomain(archives, domain);
    if (!ALL_MODE && entries.length < TOP_N) {
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
      const record = {
        id: entry.id,
        domain,
        stored,
        fresh,
        delta: roundScore(fresh - stored),
      };
      if (FLOORS_MODE) {
        record.position = 'floor';
      }
      if (persistArchive && evaluation.failureClass !== 'scorer' && evaluation.failureClass !== 'infra') {
        record.persisted = await persistArchive.rescoreEntry(
          entry.id, fresh, `banded-judge renorm ${stampDate}`,
        );
      } else if (persistArchive) {
        record.persisted = false;
        record.skipReason = evaluation.failureClass;
      }
      console.log(JSON.stringify(record));
    }
  }
} finally {
  await renderer.close();
}

if (persistArchive) {
  const verify = new QualityArchive({ path: process.env.QUALITY_ARCHIVE_PATH ?? QualityArchive.DEFAULT_PATH });
  await verify.load();
  const total = VISUAL_DOMAINS.reduce((n, d) => n + verify.getAll(d).length, 0);
  console.error(`[persist] reload-verify: ${total} visual entries present after re-normalization`);
}
