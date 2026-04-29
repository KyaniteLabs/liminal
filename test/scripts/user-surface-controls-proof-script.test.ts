import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '../..');

describe('user-surface controls proof script', () => {
  it('is wired as a package proof command and checks controls, roles, and missing previews', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')) as { scripts: Record<string, string> };
    const scriptPath = path.join(repoRoot, 'scripts/proof/user-surface-controls.ts');

    expect(pkg.scripts['proof:user-surface-controls']).toBe('tsx scripts/proof/user-surface-controls.ts');
    expect(fs.existsSync(scriptPath)).toBe(true);

    const source = fs.readFileSync(scriptPath, 'utf8');
    expect(source).toContain('generation.cancelled');
    expect(source).toContain('action.confirmed');
    expect(source).toContain('action.cancelled');
    expect(source).toContain('preview.missing');
    expect(source).toContain('roles');
  });
});
