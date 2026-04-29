import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const script = readFileSync('scripts/proof/live-creative-domain-execution.ts', 'utf8');

describe('live creative-domain execution matrix', () => {
  it('treats HyperFrames as the HTML-backed video output and does not promote generic HTML in --all', () => {
    expect(script).toContain('HyperFramesGenerator');
    expect(script).toMatch(/hyperframes:\s*'create a HyperFrames/i);
    expect(script).toMatch(/hyperframes:\s*'html'/);
    expect(script).not.toMatch(/html:\s*'create an HTML landing page/i);
    expect(script).not.toContain("case 'html': return new HTMLWebGenerator");
  });
});
