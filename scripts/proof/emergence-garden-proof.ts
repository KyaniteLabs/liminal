#!/usr/bin/env tsx
/**
 * Emergence garden proof runner.
 *
 * Proves behavior descriptors, lineage, emergence signals, archive placement,
 * and persisted archive entries for a bounded creative garden sequence.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

interface GardenCase {
  id: string;
  output: string;
  qualityScore: number;
  provenance: 'fresh-generation' | 'mutation' | 'remix';
  parentIds?: string[];
  seed: string;
}

const outputRoot = process.argv.find(arg => arg.startsWith('--out='))?.slice('--out='.length)
  || path.join('.omx', 'proof', 'emergence-garden');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const outDir = path.join(outputRoot, timestamp);
const isolatedHome = path.join(outDir, 'home');

await fs.mkdir(isolatedHome, { recursive: true });
process.env.HOME = isolatedHome;

const { LiminalFS } = await import('../../src/fs/LiminalFS.js');
const { EmergenceHooks } = await import('../../src/emergence/EmergenceHooks.js');

const cases: GardenCase[] = [
  {
    id: 'seed-particles',
    qualityScore: 0.72,
    provenance: 'fresh-generation',
    seed: 'particle pond seed',
    output: `function setup(){createCanvas(640,480)}
function draw(){background(5,12,28);for(let i=0;i<90;i++){circle(sin(frameCount*.01+i)*220+320,cos(frameCount*.013+i)*120+240,3+i%5)}}`,
  },
  {
    id: 'mutation-flow',
    qualityScore: 0.84,
    provenance: 'mutation',
    seed: 'mutated flow field',
    output: `let phase=0;function draw(){phase+=0.01;background(8,18,35,40);for(let i=0;i<140;i++){let a=noise(i*.05,phase)*TAU;line(i*5%640,i*3%480,i*5%640+cos(a)*20,i*3%480+sin(a)*20)}}`,
  },
  {
    id: 'remix-glyphs',
    qualityScore: 0.9,
    provenance: 'remix',
    seed: 'glyph remix',
    output: `const glyphs=['moon','water','signal'];function draw(){background(2,4,10);textSize(32);for(let i=0;i<glyphs.length;i++){text(glyphs[i],120+i*150,220+sin(frameCount*.04+i)*50)}}`,
  },
];

const liminalFs = LiminalFS.open(path.join(outDir, 'liminalfs'));
const hooks = new EmergenceHooks(liminalFs, { minQuality: 0.3, binsPerAxis: 6 });
const results = [];
const parentIds: string[] = [];

try {
  for (const item of cases) {
    const result = await hooks.onCreativeRun({
      output: item.output,
      qualityScore: item.qualityScore,
      provenance: item.provenance,
      parentIds: item.parentIds ?? (item.provenance === 'fresh-generation' ? [] : parentIds.slice(-1)),
      seed: item.seed,
      runId: `emergence-proof-${timestamp}`,
      metadata: { hasAnimation: true, frameCount: 120 },
    });
    parentIds.push(result.lineage.artifactId);
    results.push({
      caseId: item.id,
      qualityScore: item.qualityScore,
      descriptor: result.descriptor,
      lineage: result.lineage,
      signals: result.signals,
      placement: result.placement,
    });
  }
} finally {
  liminalFs.close();
}

const archiveStats = hooks.getArchive().getStats();
const lineageStats = await hooks.getLineageTracker().getStats();
const report = {
  generatedAt: new Date().toISOString(),
  outputDir: outDir,
  summary: {
    passed: results.length === cases.length
      && results.every(result => result.placement.accepted)
      && archiveStats.totalElites > 0
      && lineageStats.totalRecords >= cases.length,
    cases: results.length,
    acceptedPlacements: results.filter(result => result.placement.accepted).length,
    archiveStats,
    lineageStats,
  },
  results,
};

function markdown(): string {
  return [
    '# Emergence Garden Proof Report',
    '',
    `Generated: ${report.generatedAt}`,
    `Output dir: ${outDir}`,
    '',
    `Summary: ${report.summary.passed ? 'pass' : 'fail'}`,
    '',
    '| Case | Placement | Cell | Quality | Novelty | Structure | Fertility | Lineage Parents |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...results.map(result => `| ${result.caseId} | ${result.placement.outcome} | ${result.placement.cellId} | ${result.qualityScore.toFixed(2)} | ${result.signals.novelty.toFixed(2)} | ${result.signals.structure.toFixed(2)} | ${result.signals.fertility.toFixed(2)} | ${result.lineage.parentIds.length} |`),
    '',
    '## Archive Stats',
    '',
    `- Total cells: ${archiveStats.totalCells}`,
    `- Total elites: ${archiveStats.totalElites}`,
    `- Total near-elites: ${archiveStats.totalNearElites}`,
    `- Average quality: ${archiveStats.avgQuality.toFixed(3)}`,
    '',
    '## Lineage Stats',
    '',
    `- Total records: ${lineageStats.totalRecords}`,
    `- Max depth: ${lineageStats.maxDepth}`,
    `- Root count: ${lineageStats.rootCount}`,
  ].join('\n');
}

await fs.writeFile(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
await fs.writeFile(path.join(outDir, 'report.md'), markdown(), 'utf8');
console.log(path.join(outDir, 'report.md'));
process.exit(report.summary.passed ? 0 : 1);
