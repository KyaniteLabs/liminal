import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { validateCreativeDomainArtifact } from '../../scripts/lib/creative-domain-artifact-validation.mjs';

describe('creative-domain artifact validation', () => {
  it('rejects non-empty junk files for launch domains', () => {
    const tempRoot = mkdtempSync(path.join(tmpdir(), 'liminal-domain-artifact-junk-'));
    const artifactPath = path.join(tempRoot, 'p5.txt');
    writeFileSync(artifactPath, 'p5 artifact');

    const result = validateCreativeDomainArtifact('p5', artifactPath, 'p5 artifact');

    expect(result.status).toBe('fail');
    expect(result.errors.join('\n')).toContain('expected-extension');
    expect(result.errors.join('\n')).toContain('p5-setup');
  });

  it('accepts a structurally valid p5 artifact', () => {
    const tempRoot = mkdtempSync(path.join(tmpdir(), 'liminal-domain-artifact-p5-'));
    const artifactPath = path.join(tempRoot, 'p5.js');
    const code = 'function setup(){ createCanvas(400, 400); } function draw(){ background(0); }';
    writeFileSync(artifactPath, code);

    const result = validateCreativeDomainArtifact('p5', artifactPath, code);

    expect(result.status).toBe('pass');
  });

  it('rejects an opaque full-canvas SVG background', () => {
    const tempRoot = mkdtempSync(path.join(tmpdir(), 'liminal-domain-artifact-svg-'));
    const artifactPath = path.join(tempRoot, 'svg.svg');
    const code = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><rect width="400" height="400" fill="#0a0a12"/><circle cx="200" cy="200" r="80"/></svg>';
    writeFileSync(artifactPath, code);

    const result = validateCreativeDomainArtifact('svg', artifactPath, code);

    expect(result.status).toBe('fail');
    expect(result.errors.join('\n')).toContain('svg-transparent-background');
  });

  it('rejects opaque SVG backgrounds that match a shifted viewBox', () => {
    const tempRoot = mkdtempSync(path.join(tmpdir(), 'liminal-domain-artifact-svg-shifted-'));
    const artifactPath = path.join(tempRoot, 'svg.svg');
    const code = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-50 -50 100 100"><rect x="-50" y="-50" width="100" height="100" fill="#111827"/><circle cx="0" cy="0" r="20"/></svg>';
    writeFileSync(artifactPath, code);

    const result = validateCreativeDomainArtifact('svg', artifactPath, code);

    expect(result.status).toBe('fail');
    expect(result.errors.join('\n')).toContain('svg-transparent-background');
  });

  it('accepts SVGs with transparent backgrounds and non-background rect shapes', () => {
    const tempRoot = mkdtempSync(path.join(tmpdir(), 'liminal-domain-artifact-svg-transparent-'));
    const artifactPath = path.join(tempRoot, 'svg.svg');
    const code = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><rect width="400" height="400" fill="#00000000"/><rect x="90" y="90" width="220" height="220" fill="#6366f1"/><text x="200" y="360">LIMINAL</text></svg>';
    writeFileSync(artifactPath, code);

    const result = validateCreativeDomainArtifact('svg', artifactPath, code);

    expect(result.status).toBe('pass');
  });
});
