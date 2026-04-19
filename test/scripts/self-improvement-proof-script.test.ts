import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const scriptPath = path.join(repoRoot, 'scripts', 'proof', 'self-improvement-proof.ts');

describe('self-improvement proof script', () => {
  it('persists deterministic self-improvement task packet evidence', () => {
    expect(existsSync(scriptPath)).toBe(true);
    const source = readFileSync(scriptPath, 'utf8');

    expect(source).toContain("path.join('.omx', 'proof', 'self-improvement')");
    expect(source).toContain('LLMModeSelfImprovementRuntime');
    expect(source).toContain('Deterministic Task Packet');
    expect(source).toContain('stop_after_verification');
    expect(source).toContain('verificationTargets');
    expect(source).toContain('report.json');
    expect(source).toContain('report.md');
  });
});
