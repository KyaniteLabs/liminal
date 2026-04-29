import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('studio and improve CLI contract', () => {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  const bin = () => fs.readFileSync(path.join(repoRoot, 'bin/liminal'), 'utf8');
  const pkg = () => JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')) as { version: string; scripts: Record<string, string> };

  it('advertises GUI-first studio and improve scan commands', () => {
    const content = bin();

    expect(content).toContain('studio');
    expect(content).toContain('Launch GUI workbench');
    expect(content).toContain('improve <scan|run>');
    expect(content).toContain('--gates-passed');
    expect(content).toContain("cmd === 'improve'");
    expect(content).toContain("pnpm test:ci:slow");
  });

  it('prints the package version instead of stale hardcoded 1.0.0 text', () => {
    const content = bin();
    const packageJson = pkg();

    expect(content).toContain('packageJson.version');
    expect(content).not.toContain("console.log('Liminal v1.0.0')");
    expect(packageJson.version).toBe('2.1.0');
  });

  it('has a canonical studio script for the GUI workbench', () => {
    const scripts = pkg().scripts;

    expect(scripts.gui).toBe('node scripts/utils/start-studio.js');
    expect(scripts.studio).toBe('npm run gui');
    expect(scripts['gui:all']).toBeUndefined();
  });

  it('has launch-risk proof scripts and docs for explicit risk ownership', () => {
    const packageJson = pkg();

    expect(packageJson.scripts['proof:launch-risk']).toBe('tsx scripts/proof/launch-risk-proof.ts');
    expect(packageJson.scripts['proof:studio-smoke']).toBe('tsx scripts/proof/studio-smoke.ts');
    expect(fs.existsSync(path.join(repoRoot, 'docs/launch/skipped-test-ledger.md'))).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, 'docs/launch/ml-feature-value-matrix.md'))).toBe(true);
    expect(fs.existsSync(path.join(repoRoot, 'docs/launch/warning-budget.md'))).toBe(true);
  });
});
