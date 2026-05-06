#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const pkgPath = path.join(repoRoot, 'package.json');
const outDir = path.join(repoRoot, '.omx', 'proof');
const outPath = path.join(outDir, 'package-script-targets.json');

function normalizeTarget(rawTarget) {
  return rawTarget.replace(/^['"]|['"]$/g, '');
}

function isLocalTarget(target) {
  return target.startsWith('./')
    || target.startsWith('bin/')
    || target.startsWith('scripts/')
    || target.startsWith('src/')
    || target.startsWith('test/');
}

function extractLocalScriptTargets(scripts) {
  const targets = [];
  const executablePattern = /\b(?:node|tsx|bash|sh)\s+("[^"]+"|'[^']+'|[^\s&|;]+)/g;

  for (const [scriptName, command] of Object.entries(scripts)) {
    for (const match of command.matchAll(executablePattern)) {
      const target = normalizeTarget(match[1] ?? '');
      if (!target || target.startsWith('-') || !isLocalTarget(target)) continue;
      targets.push({
        scriptName,
        command,
        target,
        exists: fs.existsSync(path.join(repoRoot, target)),
      });
    }
  }

  return targets;
}

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const targets = extractLocalScriptTargets(pkg.scripts ?? {});
const missingTargets = targets.filter((target) => !target.exists);
const result = {
  generatedAt: new Date().toISOString(),
  contract: 'liminal-package-script-target-integrity-v1',
  passed: missingTargets.length === 0,
  checkedTargetCount: targets.length,
  targets,
  missingTargets,
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');

if (!result.passed) {
  console.error(`Package script target check failed. See ${outPath}`);
  for (const target of missingTargets) {
    console.error(`- ${target.scriptName}: ${target.target}`);
  }
  process.exit(1);
}

console.log(`Package script target check passed: ${outPath}`);
