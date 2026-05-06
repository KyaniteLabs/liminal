import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '../..');

interface PackageJson {
  scripts: Record<string, string>;
}

interface LocalScriptTarget {
  scriptName: string;
  command: string;
  target: string;
}

function normalizeTarget(rawTarget: string): string {
  return rawTarget.replace(/^['"]|['"]$/g, '');
}

function isLocalTarget(target: string): boolean {
  return target.startsWith('./')
    || target.startsWith('bin/')
    || target.startsWith('scripts/')
    || target.startsWith('src/')
    || target.startsWith('test/');
}

function extractLocalScriptTargets(pkg: PackageJson): LocalScriptTarget[] {
  const targets: LocalScriptTarget[] = [];
  const executablePattern = /\b(?:node|tsx|bash|sh)\s+("[^"]+"|'[^']+'|[^\s&|;]+)/g;

  for (const [scriptName, command] of Object.entries(pkg.scripts)) {
    for (const match of command.matchAll(executablePattern)) {
      const target = normalizeTarget(match[1] ?? '');
      if (!target || target.startsWith('-') || !isLocalTarget(target)) continue;
      targets.push({ scriptName, command, target });
    }
  }

  return targets;
}

describe('package script targets', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')) as PackageJson;

  it('does not wire package scripts to missing local command targets', () => {
    const missingTargets = extractLocalScriptTargets(pkg)
      .filter(({ target }) => !fs.existsSync(path.join(repoRoot, target)));

    expect(missingTargets).toEqual([]);
  });

  it('keeps the route performance proof wired to its script', () => {
    expect(pkg.scripts['proof:route-performance']).toBe('tsx scripts/proof/route-performance-budget.ts');
    expect(fs.existsSync(path.join(repoRoot, 'scripts/proof/route-performance-budget.ts'))).toBe(true);
  });
});
