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

  it('fails visual proof if Strudel code is not visible or Tone visuals are not tempo-synced', () => {
    expect(script).toContain('strudelCodeVisible');
    expect(script).toContain('Strudel preview is missing visible source code');
    expect(script).toContain('toneTempoSynced');
    expect(script).toContain('Tone preview is missing tempo-synced visual feedback');
    expect(script).toContain('toneEmbeddedPlayableControl');
    expect(script).toContain('Tone preview is missing the generated playback control');
  });
});
