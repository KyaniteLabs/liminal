import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const script = readFileSync('scripts/proof/visual-output-preview-contract.ts', 'utf8');

describe('visual output preview contract matrix', () => {
  it('shows HyperFrames in the fixture gallery instead of generic landing-page HTML', () => {
    expect(script).toContain("domain: 'hyperframes'");
    expect(script).toContain('data-hyperframes-preview-shell');
    expect(script).not.toContain("domain: 'html', sourceLabel: 'fixture html'");
  });

  it('wraps live HyperFrames artifacts with the polished preview shell', () => {
    expect(script).toContain("if (domain === 'hyperframes') return HTMLWrapper.wrap");
    expect(script).toContain('hyperframesPreviewShell');
  });
});
