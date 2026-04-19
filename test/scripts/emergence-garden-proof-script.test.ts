import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const scriptPath = path.join(repoRoot, 'scripts', 'proof', 'emergence-garden-proof.ts');

describe('emergence garden proof script', () => {
  it('persists emergence signals, lineage, archive placement, and report files', () => {
    expect(existsSync(scriptPath)).toBe(true);
    const source = readFileSync(scriptPath, 'utf8');

    expect(source).toContain("path.join('.omx', 'proof', 'emergence-garden')");
    expect(source).toContain('EmergenceHooks');
    expect(source).toContain('LiminalFS');
    expect(source).toContain('archiveStats');
    expect(source).toContain('lineageStats');
    expect(source).toContain('report.json');
    expect(source).toContain('report.md');
  });
});
