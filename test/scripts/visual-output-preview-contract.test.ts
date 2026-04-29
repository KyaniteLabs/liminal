import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const script = readFileSync('scripts/proof/visual-output-preview-contract.ts', 'utf8');

describe('visual output preview contract matrix', () => {
  it('treats the full artist-facing output matrix as the proof contract', () => {
    expect(script).toContain('ARTIST_OUTPUT_DOMAINS');
    for (const domain of ['p5', 'three', 'svg', 'glsl', 'hydra', 'strudel', 'tone', 'revideo', 'hyperframes', 'ascii', 'kinetic', 'textgen', 'organism']) {
      expect(script).toContain(`'${domain}'`);
    }
  });

  it('fails proof for tiny or non-visual output surfaces across domains', () => {
    expect(script).toContain('largestCanvasAreaRatio');
    expect(script).toContain('largestSvgAreaRatio');
    expect(script).toContain('primaryTextBlockAreaRatio');
    expect(script).toContain('cssAnimationCount');
    expect(script).toContain('is missing a browser-visible canvas');
    expect(script).toContain('SVG preview is too small');
    expect(script).toContain('ASCII preview text block is too small');
    expect(script).toContain('Kinetic preview is missing visible CSS animation');
  });

  it('writes a gallery and contact sheet every time screenshots are captured', () => {
    expect(script).toContain('contact-sheet.png');
    expect(script).toContain('gallery.html');
  });

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
