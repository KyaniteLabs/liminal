#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const repoRoot = process.cwd();
const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'liminal-composition-example-'));

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: false,
    ...options,
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit ${result.status}`);
  }
}

function requireFile(relativePath, expectedText) {
  const target = path.join(outputDir, relativePath);
  if (!fs.existsSync(target)) {
    throw new Error(`Expected example artifact was not written: ${target}`);
  }

  const content = fs.readFileSync(target, 'utf8');
  if (content.length === 0) {
    throw new Error(`Expected example artifact to be non-empty: ${target}`);
  }

  if (expectedText && !content.includes(expectedText)) {
    throw new Error(`Expected ${target} to include ${expectedText}`);
  }
}

try {
  run('pnpm', ['exec', 'tsc', '-p', 'tsconfig.examples.json', '--noEmit']);
  run('pnpm', ['exec', 'tsx', 'examples/composition-programmatic.ts'], {
    env: {
      ...process.env,
      LIMINAL_EXAMPLE_OUTPUT_DIR: outputDir,
    },
  });

  requireFile('composition-programmatic.html', 'Liminal Composition');
  requireFile('composition-programmatic.json', 'Programmatic Demo');

  console.log(`Composition example smoke passed: ${outputDir}`);
} finally {
  fs.rmSync(outputDir, { recursive: true, force: true });
}
