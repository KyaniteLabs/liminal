#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const distIndex = path.join(repoRoot, 'dist', 'index.js');
const isCi = process.env.CI === 'true' || process.env.CI === '1';
const initCwd = process.env.INIT_CWD ? path.resolve(process.env.INIT_CWD) : undefined;
const isRootInstall = initCwd === repoRoot;

if (existsSync(distIndex)) {
  console.log('[postinstall] skipping build: dist/index.js already exists');
  process.exit(0);
}

if (isCi && isRootInstall) {
  console.log('[postinstall] skipping build: CI root install detected');
  process.exit(0);
}

console.log('[postinstall] dist missing; building package artifacts');
const result = spawnSync('npm', ['run', 'build'], {
  cwd: repoRoot,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
process.exit(result.status ?? 1);
