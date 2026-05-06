#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { copyFile, lstat, mkdir, mkdtemp, readlink, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const tempRoot = await mkdtemp(path.join(tmpdir(), 'liminal-git-ci-install-'));
const sourceRoot = path.join(tempRoot, 'source');
const consumerRoot = path.join(tempRoot, 'consumer');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    env: options.env ?? process.env,
    encoding: 'utf8',
    stdio: options.stdio ?? 'pipe',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    const rendered = [result.stdout, result.stderr].filter(Boolean).join('\n');
    throw new Error(`${command} ${args.join(' ')} failed with exit ${result.status}\n${rendered}`);
  }
  return result;
}

async function copyTrackedFile(relativePath) {
  const source = path.join(repoRoot, relativePath);
  const target = path.join(sourceRoot, relativePath);
  await mkdir(path.dirname(target), { recursive: true });
  const stat = await lstat(source);
  if (stat.isSymbolicLink()) {
    await symlink(await readlink(source), target);
    return;
  }
  await copyFile(source, target);
}

const gitFiles = run('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'])
  .stdout
  .split('\0')
  .filter(Boolean);
await mkdir(sourceRoot, { recursive: true });
await mkdir(consumerRoot, { recursive: true });
for (const file of gitFiles) {
  await copyTrackedFile(file);
}

run('git', ['init'], { cwd: sourceRoot });
run('git', ['config', 'user.email', 'proof@liminal.local'], { cwd: sourceRoot });
run('git', ['config', 'user.name', 'Liminal Proof'], { cwd: sourceRoot });
run('git', ['add', '.'], { cwd: sourceRoot });
run('git', ['commit', '-m', 'proof source'], { cwd: sourceRoot });

await writeFile(
  path.join(consumerRoot, 'package.json'),
  `${JSON.stringify({ type: 'module', private: true }, null, 2)}\n`,
  'utf8'
);

const cleanEnv = {
  ...process.env,
  CI: '1',
  npm_config_audit: 'false',
  npm_config_fund: 'false',
};

run('npm', [
  'install',
  '--no-audit',
  '--no-fund',
  `git+${pathToFileURL(sourceRoot).href}`,
], { cwd: consumerRoot, env: cleanEnv, stdio: 'pipe' });

const installedRoot = path.join(consumerRoot, 'node_modules', 'liminal-ai');
const distIndex = path.join(installedRoot, 'dist', 'index.js');
if (!existsSync(distIndex)) {
  throw new Error(`Installed package is missing ${path.relative(consumerRoot, distIndex)}`);
}

run('node', [
  '--input-type=module',
  '-e',
  "const mod = await import('liminal-ai'); if (!mod) throw new Error('import returned empty module');",
], { cwd: consumerRoot });

const version = run('node', [path.join(consumerRoot, 'node_modules', '.bin', 'liminal'), '--version'], {
  cwd: consumerRoot,
}).stdout.trim();
const versionLine = version.split(/\r?\n/).find(line => /\bLiminal v\d+\.\d+\.\d+/.test(line));
if (!versionLine) {
  throw new Error(`Unexpected liminal --version output: ${version}`);
}

console.log(`Git CI install proof passed: ${versionLine}`);
