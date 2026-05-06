import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(import.meta.dirname, '../..');
const scriptPath = path.join(repoRoot, 'scripts/ci/check-doc-links.mjs');

describe('documentation link checker', () => {
  it('is wired as a package script and catches missing local links', () => {
    const pkg = JSON.parse(execFileSync(process.execPath, ['-e', 'console.log(JSON.stringify(require("./package.json")))'], { cwd: repoRoot, encoding: 'utf8' })) as { scripts: Record<string, string> };
    expect(pkg.scripts['check:doc-links']).toBe('node scripts/ci/check-doc-links.mjs');

    const tempRoot = path.join(repoRoot, '.omx', 'tmp-doc-links-test');
    mkdirSync(tempRoot, { recursive: true });
    const badDoc = path.join(tempRoot, 'bad.md');
    writeFileSync(badDoc, '[missing](./missing.md)\n');

    expect(() => execFileSync(process.execPath, [scriptPath, '--file', path.relative(repoRoot, badDoc)], { cwd: repoRoot, encoding: 'utf8' })).toThrow();
  });
});
