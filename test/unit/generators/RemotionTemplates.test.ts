import { describe, it, expect } from 'vitest';
import { selectRemotionTemplate } from '../../../src/generators/remotion/RemotionTemplates.js';

describe('RemotionTemplates', () => {
  it('returns particle template for particle/galaxy keywords', () => {
    const code = selectRemotionTemplate('cosmic particle animation');
    expect(code).toContain('useCurrentFrame');
    expect(code).toContain('AbsoluteFill');
    expect(code).toContain('export');
  });

  it('returns text motion template for text/typography keywords', () => {
    const code = selectRemotionTemplate('animated text reveal');
    expect(code).toContain('useCurrentFrame');
    expect(code).toContain('interpolate');
  });

  it('returns geometric template for geometric/shape keywords', () => {
    const code = selectRemotionTemplate('geometric shapes rotating');
    expect(code).toContain('useCurrentFrame');
  });

  it('returns gradient template as default fallback', () => {
    const code = selectRemotionTemplate('something random');
    expect(code).toContain('useCurrentFrame');
    expect(code).toContain('AbsoluteFill');
  });

  it('all templates are valid React components with Remotion imports', () => {
    const prompts = ['particles', 'text motion', 'geometric', 'gradient', 'anything'];
    for (const p of prompts) {
      const code = selectRemotionTemplate(p);
      expect(code).toMatch(/import.*from ['"]remotion['"]/);
      expect(code).toMatch(/export (const|default)/);
    }
  });
});
