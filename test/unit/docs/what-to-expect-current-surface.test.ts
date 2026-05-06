import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../../..');

function readRepoFile(relativePath: string): string {
  return readFileSync(resolve(repoRoot, relativePath), 'utf8');
}

describe('WHAT_TO_EXPECT first-run guide', () => {
  it('describes the current Studio/workbench first-run path instead of the retired harness task runner', () => {
    const doc = readRepoFile('docs/WHAT_TO_EXPECT.md');

    expect(doc).toContain('# What to Expect When Running Liminal Studio');
    expect(doc).toContain('pnpm gui');
    expect(doc).toContain('Message Liminal');
    expect(doc).toContain('Generate');
    expect(doc).toContain('Polish');
    expect(doc).toContain('same-screen preview');
    expect(doc).toContain('pnpm typecheck');
    expect(doc).toContain('pnpm --dir gui build');

    expect(doc).not.toContain('# What to Expect When Running the Harness');
    expect(doc).not.toContain('/run M1');
    expect(doc).not.toContain('HarnessAgent');
    expect(doc).not.toContain('harness-tasks');
    expect(doc).not.toContain('.liminal/backups');
    expect(doc).not.toContain('npm run tui');
  });
});
