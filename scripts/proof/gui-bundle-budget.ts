#!/usr/bin/env tsx
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const assetsDir = path.join(repoRoot, 'gui', 'dist', 'assets');
const outDir = path.join(repoRoot, '.omx', 'proof');
const outPath = path.join(outDir, 'gui-bundle-budget.json');
const maxChunkBytes = Number(process.env.LIMINAL_GUI_MAX_JS_CHUNK_BYTES || 500 * 1024);

if (!fs.existsSync(assetsDir)) {
  throw new Error('GUI dist assets not found. Run `pnpm --filter liminal-studio-gui build` first.');
}

const jsAssets = fs.readdirSync(assetsDir)
  .filter((name) => name.endsWith('.js'))
  .map((name) => {
    const filePath = path.join(assetsDir, name);
    const sizeBytes = fs.statSync(filePath).size;
    return { name, sizeBytes, sizeKiB: Number((sizeBytes / 1024).toFixed(1)) };
  })
  .sort((a, b) => b.sizeBytes - a.sizeBytes);

const failures = jsAssets.filter((asset) => asset.sizeBytes > maxChunkBytes);
const result = {
  generatedAt: new Date().toISOString(),
  maxChunkBytes,
  maxChunkKiB: Number((maxChunkBytes / 1024).toFixed(1)),
  passed: failures.length === 0,
  jsAssets,
  failures,
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(result, null, 2)}\n`, 'utf-8');

if (failures.length > 0) {
  console.error(`GUI bundle budget failed. See ${outPath}`);
  for (const failure of failures) {
    console.error(`- ${failure.name}: ${failure.sizeKiB} KiB > ${result.maxChunkKiB} KiB`);
  }
  process.exit(1);
}

console.log(`GUI bundle budget proof written: ${outPath}`);
