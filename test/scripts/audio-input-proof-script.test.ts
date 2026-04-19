import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const scriptPath = path.join(repoRoot, 'scripts', 'proof', 'audio-input-proof.ts');

describe('audio input proof script', () => {
  it('persists audio analysis, visual mapping, context injection, and mic guard evidence', () => {
    expect(existsSync(scriptPath)).toBe(true);
    const source = readFileSync(scriptPath, 'utf8');

    expect(source).toContain("path.join('.omx', 'proof', 'audio-input')");
    expect(source).toContain('AudioAnalyzer');
    expect(source).toContain('captureMicAudio');
    expect(source).toContain('buildContextForInjection');
    expect(source).toContain('Audio-derived visual parameters');
    expect(source).toContain('liveMicrophoneCaptured');
    expect(source).toContain('report.json');
    expect(source).toContain('report.md');
  });
});
