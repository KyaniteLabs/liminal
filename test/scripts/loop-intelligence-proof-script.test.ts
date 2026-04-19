import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const scriptPath = path.join(repoRoot, 'scripts', 'proof', 'loop-intelligence-proof.ts');

describe('loop intelligence proof script', () => {
  it('persists loop lineage, evaluation, winner artifacts, and pixel checks', () => {
    expect(existsSync(scriptPath)).toBe(true);
    const source = readFileSync(scriptPath, 'utf8');

    expect(source).toContain("path.join('.omx', 'proof', 'loop-intelligence')");
    expect(source).toContain('iterationName');
    expect(source).toContain('lineage.json');
    expect(source).toContain('evaluation.json');
    expect(source).toContain('winner.html');
    expect(source).toContain('winner.png');
    expect(source).toContain('nonblankPixelVariance');
    expect(source).toContain('pixelVariance');
    expect(source).toContain('visualDifferenceFromPrevious');
    expect(source).toContain('memoryContextNote');
    expect(source).toContain('compostIntelligenceNote');
    expect(source).toContain('reasonForChanges');
  });
});
