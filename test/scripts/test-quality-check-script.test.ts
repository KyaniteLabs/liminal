import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

const repoRoot = resolve(import.meta.dirname, '../..');
const checkerScript = resolve(repoRoot, 'scripts/testing/test-quality-check.mjs');

const tempDirs: string[] = [];

function makeTempRepo(): string {
  const tempDir = mkdtempSync(join(tmpdir(), 'liminal-quality-check-'));
  tempDirs.push(tempDir);
  mkdirSync(join(tempDir, 'test'), { recursive: true });
  return tempDir;
}

function runChecker(cwd: string, args: string[] = []) {
  return spawnSync(process.execPath, [checkerScript, ...args], {
    cwd,
    encoding: 'utf8',
  });
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const tempDir = tempDirs.pop();
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
  }
});

describe('test quality checker script', () => {
  it('flags weak assertion fixtures under strict mode', () => {
    const tempRepo = makeTempRepo();
    const weakFixture = [
      "import { expect, it } from 'vitest';",
      '',
      "it('checks bad assertions against concrete outcomes', () => {",
      '  expect({ ok: true }).toBe' + 'Truthy();',
      "  expect('a').to" + "Contain('a');",
      '  expect({ ok: true }).not.toBe' + 'Null();',
      '  expect({ ok: true }).toEqual(expect.' + 'anything());',
      '});',
      '',
    ].join('\n');

    writeFileSync(join(tempRepo, 'test/weak-assertions.test.ts'), weakFixture);

    const result = runChecker(tempRepo, ['--strict']);
    const output = `${result.stdout}\n${result.stderr}`;

    expect(result.status).toBe(1);
    expect(output).toContain('no-weak-test-assertions');
    expect(output).toContain('toBeTruthy');
    expect(output).toContain('toContain');
    expect(output).toContain('not.toBeNull');
    expect(output).toContain('expect.anything');
  });

  it('accepts baseline warnings but fails newly introduced strict warnings', () => {
    const tempRepo = makeTempRepo();
    const baselinePath = join(tempRepo, 'quality-baseline.txt');
    const knownFixture = [
      "import { expect, it } from 'vitest';",
      '',
      "it('keeps known weak assertions visible', () => {",
      '  expect({ ok: true }).toBe' + 'Truthy();',
      '});',
      '',
    ].join('\n');

    writeFileSync(join(tempRepo, 'test/known-weak.test.ts'), knownFixture);

    const writeBaseline = runChecker(tempRepo, ['--write-baseline', baselinePath]);
    expect(writeBaseline.status).toBe(0);

    const accepted = runChecker(tempRepo, ['--strict', '--baseline', baselinePath]);
    expect(accepted.status).toBe(0);
    expect(accepted.stdout).toContain('Known baseline warnings: 1');

    const newFixture = [
      "import { expect, it } from 'vitest';",
      '',
      "it('adds a new weak assertion', () => {",
      "  expect('a').to" + "Contain('a');",
      '});',
      '',
    ].join('\n');
    writeFileSync(join(tempRepo, 'test/new-weak.test.ts'), newFixture);

    const rejected = runChecker(tempRepo, ['--strict', '--baseline', baselinePath]);
    const rejectedOutput = `${rejected.stdout}\n${rejected.stderr}`;

    expect(rejected.status).toBe(1);
    expect(rejectedOutput).toContain('new-weak.test.ts');
    expect(rejectedOutput).toContain('toContain');
  });

  it('wires strict final QA quality mode through package scripts', () => {
    const pkg = JSON.parse(readFileSync(resolve(repoRoot, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };

    expect(pkg.scripts['test:quality']).toBe(
      'node scripts/testing/test-quality-check.mjs --baseline scripts/testing/test-quality-baseline.txt',
    );
    expect(pkg.scripts['test:quality:strict']).toBe(
      'node scripts/testing/test-quality-check.mjs --strict --baseline scripts/testing/test-quality-baseline.txt',
    );
    expect(pkg.scripts['final-qa:test-quality']).toBe('pnpm test:quality:strict');
  });
});
