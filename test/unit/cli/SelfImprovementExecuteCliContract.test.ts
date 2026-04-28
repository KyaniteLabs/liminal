import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '../../..');

function readRepoFile(relativePath: string): string {
  return readFileSync(resolve(repoRoot, relativePath), 'utf8');
}

describe('self-improvement CLI execution contract', () => {
  it('keeps packet creation default and executes only with explicit auto-confirm in an isolated worktree', () => {
    const bin = readRepoFile('bin/liminal');

    expect(bin).toContain("flags.confirm === 'auto' || flags.force === true");
    expect(bin).toContain('Routed to self-improvement task preparation, not creative generation.');
    expect(bin).toContain('Add --confirm auto to execute this bounded self-improvement task in an isolated worktree.');
    expect(bin).toContain('Refusing to execute self-improvement in the main worktree.');
    expect(bin).toContain("`${path.sep}.claude${path.sep}worktrees${path.sep}`");
    expect(bin).toContain('self-improvement-session.json');
    expect(bin).toContain('prepared.task.requiresMutation = true');
  });

  it('exposes a headless gauntlet command for self-improvement reflex reliability', () => {
    const bin = readRepoFile('bin/liminal');

    expect(bin).toContain("cmd === 'self-improve'");
    expect(bin).toContain("subCmd === 'gauntlet'");
    expect(bin).toContain('runSelfImprovementGauntlet');
    expect(bin).toContain('Self-improvement gauntlet');
    expect(bin).toContain('Level:');
  });

  it('exposes Level 6 product gates from the real CLI', () => {
    const bin = readRepoFile('bin/liminal');

    expect(bin).toContain("cmd === 'domains'");
    expect(bin).toContain('runCreativeDomainGauntlet');
    expect(bin).toContain("cmd === 'model'");
    expect(bin).toContain('runModelAssimilationGauntlet');
    expect(bin).toContain("cmd === 'release'");
    expect(bin).toContain('runLevel6ReleaseGate');
  });
});
