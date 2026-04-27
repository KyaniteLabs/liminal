import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const scriptPath = path.join(repoRoot, 'scripts', 'proof', 'creative-copilot-proof.ts');

describe('creative copilot proof script', () => {
  it('persists reports, artifacts, screenshot previews, and issue evidence', () => {
    const source = readFileSync(scriptPath, 'utf8');

    expect(source).toContain("path.join('.omx', 'proof', 'creative-copilot')");
    expect(source).toContain('report.json');
    expect(source).toContain('report.md');
    expect(source).toContain('renderScreenshot');
    expect(source).toContain('shouldRenderScreenshot');
    expect(source).toContain('audio-playable');
    expect(source).toContain('audio-external');
    expect(source).toContain('video-code');
    expect(source).toContain('KineticGenerator');
    expect(source).toContain('SVGGenerator');
    expect(source).toContain("domain: 'svg'");
    expect(source).toContain("artifactExtension: 'svg'");
    expect(source).not.toContain("if (spec.previewKind === 'video-code') status = 'blocked';");
    expect(source).toContain('Revideo code artifact saved; native rendered video/still proof pending.');
    expect(source).toContain('validateScreenshotVisible');
    expect(source).toContain('Preview runtime error');
    expect(source).toContain("previewKind: 'image'");
    expect(source).toContain('createColorTheoryPalette');
    expect(source).toContain('promptWithColorTheory');
    expect(source).toContain('colorTheoryGuidance');
    expect(source).toContain('Launch color theory guidance');
    expect(source).toContain('max-tokens');
    expect(source).toContain('timeout-ms');
    expect(source).toContain('isEmptyGenerationFailure');
    expect(source).toContain('maxEmptyGenerationAttempts = 3');
    expect(source).toContain('empty response retry');
    expect(source).toContain('issues:');
    expect(source).toContain('getProviderConfig');
    expect(source).toContain('P5GeneratorV2');
  });
});
