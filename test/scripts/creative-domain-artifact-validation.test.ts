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
});
