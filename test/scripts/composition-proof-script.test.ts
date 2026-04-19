import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const scriptPath = path.join(repoRoot, 'scripts', 'proof', 'composition-proof.ts');

describe('composition proof script', () => {
  it('persists composition reports, screenshots, layers, and pixel visibility checks', () => {
    expect(existsSync(scriptPath)).toBe(true);
    const source = readFileSync(scriptPath, 'utf8');

    expect(source).toContain("path.join('.omx', 'proof', 'composition')");
    expect(source).toContain('shader-p5-overlay');
    expect(source).toContain('kinetic-text-overlay');
    expect(source).toContain('report.json');
    expect(source).toContain('report.md');
    expect(source).toContain('renderScreenshot');
    expect(source).toContain('pixelStdDev');
    expect(source).toContain('Composition screenshot appears blank');
  });
});
