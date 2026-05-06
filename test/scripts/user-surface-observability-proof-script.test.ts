import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '../..');

describe('user-surface observability proof script', () => {
  it('is wired as a package proof command and validates route-to-preview observability', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8')) as { scripts: Record<string, string> };
    const scriptPath = path.join(repoRoot, 'scripts/proof/user-surface-observability.ts');

    expect(pkg.scripts['proof:user-surface-observability']).toBe('tsx scripts/proof/user-surface-observability.ts');
    expect(fs.existsSync(scriptPath)).toBe(true);

    const source = fs.readFileSync(scriptPath, 'utf8');
    expect(source).toContain('generation.route.selected');
    expect(source).toContain('generation.attempt.started');
    expect(source).toContain('artifact.found');
    expect(source).toContain('preview.verified');
    expect(source).toContain("clientIntent: 'creative'");
    expect(source).toContain('startProofModel');
    expect(source).toContain('proofModelCalled');
    expect(source).not.toContain('bridge.publishEvent(session.sessionId');
  });
});
