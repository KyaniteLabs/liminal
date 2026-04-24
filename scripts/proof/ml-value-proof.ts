#!/usr/bin/env tsx
import fs from 'node:fs';
import path from 'node:path';
import { buildMlFeatureValueMatrix } from '../../src/improvement/OpportunityScanner.js';

const matrix = buildMlFeatureValueMatrix();
const outDir = path.join(process.cwd(), '.omx', 'proof');
const outPath = path.join(outDir, 'ml-value-proof.json');

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify({
  generatedAt: new Date().toISOString(),
  features: matrix,
  summary: {
    proven: matrix.filter((feature) => feature.launchLabel === 'proven').length,
    experimental: matrix.filter((feature) => feature.launchLabel === 'experimental').length,
    hidden: matrix.filter((feature) => feature.launchLabel === 'hidden').length,
  },
}, null, 2)}\n`, 'utf-8');

console.log(`ML value proof written: ${outPath}`);
for (const feature of matrix) {
  console.log(`${feature.id}: ${feature.launchLabel} | ${feature.metric || 'no metric'}`);
}
