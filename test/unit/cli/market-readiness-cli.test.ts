import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('market readiness CLI contract', () => {
  it('exposes a market status command that prints the readiness verdict', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'bin', 'sinter'), 'utf8');

    expect(source).toContain("cmd === 'market'");
    expect(source).toContain('collectRepositoryMarketReadinessStatus');
    expect(source).toContain('formatMarketReadinessStatus');
  });
});
