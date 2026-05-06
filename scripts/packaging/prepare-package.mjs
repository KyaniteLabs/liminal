#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const distIndex = path.join(repoRoot, 'dist', 'index.js');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: options.stdio ?? 'inherit',
    shell: process.platform === 'win32',
  });
  return result.status ?? 1;
}

if (existsSync(path.join(repoRoot, '.git')) && existsSync(path.join(repoRoot, '.githooks'))) {
  const status = run('git', ['config', 'core.hooksPath', '.githooks'], { stdio: 'ignore' });
  if (status !== 0) {
    console.warn('[prepare] could not configure git hooks; continuing');
  }
}

if (process.env.LIMINAL_SKIP_PREPARE_BUILD === '1') {
  console.log('[prepare] skipping build: LIMINAL_SKIP_PREPARE_BUILD=1');
  process.exit(0);
}

if (existsSync(distIndex)) {
  console.log('[prepare] skipping build: dist/index.js already exists');
  process.exit(0);
}

console.log('[prepare] dist missing; building package artifacts');
process.exit(run('npm', ['run', 'build']));
