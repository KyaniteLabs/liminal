import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const scriptPath = path.join(repoRoot, 'scripts', 'proof', 'cognitive-loop-proof.ts');
const packagePath = path.join(repoRoot, 'package.json');

describe('cognitive loop proof script', () => {
  it('persists a deterministic creative cognition loop proof with all organ receipts', () => {
    expect(existsSync(scriptPath)).toBe(true);
    const source = readFileSync(scriptPath, 'utf8');
    expect(source).toContain("path.join('.omx', 'proof', 'cognitive-loop')");
    expect(source).toContain('deterministic');
    expect(source).toContain('live-writer');
    expect(source).toContain('--live');
    expect(source).toContain('PostGenerationCognitiveWriter');
    expect(source).toContain('ProofMemoryStore');
    expect(source).toContain('ProofCompostSink');
    expect(source).toContain('perception');
    expect(source).toContain('memory');
    expect(source).toContain('compost');
    expect(source).toContain('dreaming');
    expect(source).toContain('intuition');
    expect(source).toContain('evaluation');
    expect(source).toContain('nextRunInfluence');
    expect(source).toContain('report.json');
    expect(source).toContain('report.md');
    expect(source).toContain('writeBackGeneration');
    expect(source).toContain('prepareGeneration');
  });

  it('exposes the proof through package scripts', () => {
    const packageJson = JSON.parse(readFileSync(packagePath, 'utf8')) as { scripts: Record<string, string> };
    expect(packageJson.scripts['proof:cognitive-loop']).toBe('tsx scripts/proof/cognitive-loop-proof.ts');
  });
});
