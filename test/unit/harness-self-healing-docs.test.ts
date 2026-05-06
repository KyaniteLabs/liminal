import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '../..');

function readRepoFile(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

describe('meta-harness self-healing documentation truth', () => {
  it('documents HarnessUpdater as manual-memory recording, not automatic runtime self-healing', () => {
    const source = readRepoFile('src/harness/MetaHarnessIntegration.ts');

    expect(source).toContain('manual fix required');
    expect(readRepoFile('AGENTS.md')).toContain('Records manual adaptation advice');
    expect(readRepoFile('docs/ARCHITECTURE_AND_PHILOSOPHY.md')).toContain('manual-memory mode');
    expect(readRepoFile('docs/THE_BIBLE.md')).toContain('manual-memory mode');
  });
});
