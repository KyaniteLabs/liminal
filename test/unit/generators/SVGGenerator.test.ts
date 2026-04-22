import { describe, expect, it } from 'vitest';

import { SVGGenerator } from '../../../src/generators/svg/SVGGenerator.js';
import { sanitizeSVG } from '../../../src/generators/svg/SVGSanitizer.js';
import { validateSVG } from '../../../src/generators/svg/SVGValidator.js';
import {
  SVG_MODE_PROFILES,
  inferSVGMode,
  type SVGMode,
} from '../../../src/generators/svg/SVGModeProfiles.js';

class TestableSVGGenerator extends SVGGenerator {
  validateForTest(code: string) {
    return this.validateOutput(code);
  }
}

describe('SVGModeProfiles', () => {
  it('defines profiles for every approved SVG business mode', () => {
    expect(Object.keys(SVG_MODE_PROFILES).sort()).toEqual([
      'cnc',
      'cutfile',
      'diagram',
      'generative-art',
      'icon',
      'logo',
      'print',
      'sticker',
    ]);
  });

  it('infers use-case modes from prompts', () => {
    expect(inferSVGMode('make a laser cutting file for acrylic')).toBe('cutfile');
    expect(inferSVGMode('simple app icon')).toBe('icon');
    expect(inferSVGMode('flowchart diagram with labels')).toBe('diagram');
    expect(inferSVGMode('procedural generative art poster')).toBe('generative-art');
  });
});

describe('SVGSanitizer', () => {
  it('extracts raw SVG from markdown and normalizes xmlns/viewBox', () => {
    const sanitized = sanitizeSVG('```svg\n<svg width="64" height="64"><circle cx="32" cy="32" r="20"/></svg>\n```');

    expect(sanitized).toMatch(/^<svg\b/);
    expect(sanitized).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(sanitized).toContain('viewBox="0 0 64 64"');
    expect(sanitized).toContain('<circle');
  });

  it('removes scripts, event handlers, foreignObject, and unsafe hrefs', () => {
    const sanitized = sanitizeSVG(`
      <svg viewBox="0 0 100 100" onload="alert(1)">
        <script>alert(1)</script>
        <foreignObject><iframe src="https://evil.test"></iframe></foreignObject>
        <a href="javascript:alert(1)"><rect width="50" height="50"/></a>
        <image href="https://example.com/pixel.png"/>
        <circle cx="50" cy="50" r="20"/>
      </svg>
    `);

    expect(sanitized).not.toMatch(/script|foreignObject|iframe|javascript:|<image|onload/i);
    expect(sanitized).toContain('<circle');
  });
});

describe('SVGValidator', () => {
  it('accepts a safe icon SVG with square viewBox', () => {
    const result = validateSVG('<svg viewBox="0 0 24 24"><path d="M12 2 L22 22 L2 22 Z" fill="#111"/></svg>', { mode: 'icon' });

    expect(result.valid).toBe(true);
  });

  it('accepts already-sanitized SVGs with the standard xmlns URL', () => {
    const sanitized = sanitizeSVG('<svg width="24" height="24"><circle cx="12" cy="12" r="8"/></svg>');
    const result = validateSVG(sanitized, { mode: 'icon' });

    expect(result.valid).toBe(true);
  });

  it('rejects icon SVGs with non-square viewBox', () => {
    const result = validateSVG('<svg viewBox="0 0 48 24"><circle cx="12" cy="12" r="8"/></svg>', { mode: 'icon' });

    expect(result.valid).toBe(false);
    expect(result.error).toContain('square viewBox');
  });

  it('rejects unsafe executable SVG even if it has visible geometry', () => {
    const result = validateSVG('<svg viewBox="0 0 100 100"><script>alert(1)</script><rect width="100" height="100"/></svg>');

    expect(result.valid).toBe(false);
    expect(result.error).toContain('unsafe');
  });

  it('rejects SVGs without visible vector geometry', () => {
    const result = validateSVG('<svg viewBox="0 0 100 100"><defs><linearGradient id="g"/></defs></svg>');

    expect(result.valid).toBe(false);
    expect(result.error).toContain('visible');
  });

  it('enforces diagram labels and connectors', () => {
    const noText = validateSVG('<svg viewBox="0 0 200 100"><line x1="10" y1="10" x2="190" y2="90"/></svg>', { mode: 'diagram' });
    const noConnector = validateSVG('<svg viewBox="0 0 200 100"><text x="20" y="30">Start</text></svg>', { mode: 'diagram' });
    const valid = validateSVG('<svg viewBox="0 0 200 100"><text x="20" y="30">Start</text><line x1="60" y1="25" x2="160" y2="25"/></svg>', { mode: 'diagram' });

    expect(noText.valid).toBe(false);
    expect(noConnector.valid).toBe(false);
    expect(valid.valid).toBe(true);
  });

  it('rejects cutfile SVGs with filters, gradients, text, or open paths', () => {
    const result = validateSVG(
      '<svg viewBox="0 0 100 100"><defs><linearGradient id="g"/></defs><text>cut</text><path d="M10 10 L90 10"/></svg>',
      { mode: 'cutfile' },
    );

    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/cutfile|closed path|text|gradient|filter/i);
  });

  it('allows generative-art SVGs to use gradients and filters safely', () => {
    const result = validateSVG(
      '<svg viewBox="0 0 100 100"><defs><linearGradient id="g"><stop offset="0%" stop-color="#f00"/></linearGradient><filter id="blur"><feGaussianBlur stdDeviation="2"/></filter></defs><circle cx="50" cy="50" r="30" fill="url(#g)" filter="url(#blur)"/></svg>',
      { mode: 'generative-art' },
    );

    expect(result.valid).toBe(true);
  });
});

describe('SVGGenerator', () => {
  it('validates sanitized SVG output through the generator contract', () => {
    const gen = new TestableSVGGenerator();
    const result = gen.validateForTest('<svg width="64" height="64"><rect width="64" height="64" fill="#000"/></svg>');

    expect(result.valid).toBe(true);
  });

  it('wraps raw SVG in a browser-renderable gallery page', () => {
    const gen = new SVGGenerator();
    const html = gen.wrapForGallery('<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/></svg>');

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<svg');
    expect(html).toContain('contain: content');
  });

  it('adds mode-specific prompt constraints for all modes', async () => {
    const gen = new TestableSVGGenerator();
    for (const mode of Object.keys(SVG_MODE_PROFILES) as SVGMode[]) {
      const prompt = (gen as any).buildSVGPrompt('make something useful', { mode });
      expect(prompt).toContain(`Mode: ${mode}`);
      expect(prompt).toContain(SVG_MODE_PROFILES[mode].label);
    }
  });
});
