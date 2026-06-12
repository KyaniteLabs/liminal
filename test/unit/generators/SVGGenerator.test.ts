import { afterEach, describe, expect, it, vi } from 'vitest';

import { SVGGenerator } from '../../../src/generators/svg/SVGGenerator.js';
import { salvageSVG, sanitizeSVG } from '../../../src/generators/svg/SVGSanitizer.js';
import { validateSVG } from '../../../src/generators/svg/SVGValidator.js';
import { LLMClient } from '../../../src/llm/LLMClient.js';
import {
  SVG_MODE_PROFILES,
  inferSVGMode,
  type SVGMode,
} from '../../../src/generators/svg/SVGModeProfiles.js';
import { Logger } from '../../../src/utils/Logger.js';

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

describe('SVG salvage (fence-strip + prose-extract)', () => {
  const COMPLETE_SVG = '<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="20" fill="#06b6d4"/></svg>';

  it('salvages an ```svg``` fenced valid SVG to a clean document', () => {
    const fenced = '```svg\n' + COMPLETE_SVG + '\n```';
    const salvaged = salvageSVG(fenced);
    const result = validateSVG(salvaged, { mode: 'icon' });

    expect(salvaged).toBe(COMPLETE_SVG);
    expect(result.valid).toBe(true);
    expect(result.sanitized).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(result.sanitized).toContain('viewBox="0 0 64 64"');
    expect(result.sanitized).toContain('<circle');
  });

  it('salvages a bare ``` fence (no language) around a valid SVG', () => {
    const fenced = '```\n' + COMPLETE_SVG + '\n```';
    const salvaged = salvageSVG(fenced);

    expect(salvaged).toBe(COMPLETE_SVG);
    expect(validateSVG(salvaged, { mode: 'icon' }).valid).toBe(true);
  });

  it('salvages an ```xml fence around a valid SVG (mixed provider convention)', () => {
    const fenced = '```xml\n' + COMPLETE_SVG + '\n```';
    const salvaged = salvageSVG(fenced);

    expect(salvaged).toBe(COMPLETE_SVG);
    expect(validateSVG(salvaged, { mode: 'icon' }).valid).toBe(true);
  });

  it('salvages an ```html fence around a valid SVG (case-insensitive)', () => {
    const fenced = '```HTML\n' + COMPLETE_SVG + '\n```';
    const salvaged = salvageSVG(fenced);

    expect(salvaged).toBe(COMPLETE_SVG);
    expect(validateSVG(salvaged, { mode: 'icon' }).valid).toBe(true);
  });

  it('extracts a valid SVG from surrounding prose', () => {
    const proseWrapped = [
      'Here is the SVG you asked for:',
      '',
      COMPLETE_SVG,
      '',
      'Hope you like it!',
    ].join('\n');
    const salvaged = salvageSVG(proseWrapped);
    const result = validateSVG(salvaged, { mode: 'icon' });

    expect(salvaged).toBe(COMPLETE_SVG);
    expect(result.valid).toBe(true);
    expect(result.sanitized).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  it('extracts a valid SVG from a single-line prose wrapper', () => {
    const prose = 'Sure! Here you go: ' + COMPLETE_SVG + ' Cheers!';
    const salvaged = salvageSVG(prose);

    expect(salvaged).toBe(COMPLETE_SVG);
    expect(validateSVG(salvaged, { mode: 'icon' }).valid).toBe(true);
  });

  it('leaves an already-raw SVG unchanged (no fence, no prose)', () => {
    const salvaged = salvageSVG(COMPLETE_SVG);

    expect(salvaged).toBe(COMPLETE_SVG);
    expect(validateSVG(salvaged, { mode: 'icon' }).valid).toBe(true);
  });

  it('STILL rejects truncated SVG with no closing </svg> (no fabricated tag)', () => {
    const truncated = '<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="20" fill="#06b6d4"/></svg';
    const salvaged = salvageSVG(truncated);
    const result = validateSVG(salvaged, { mode: 'icon' });

    expect(salvaged).toBe(truncated);
    expect(salvaged).not.toMatch(/<\/svg>$/);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('raw <svg> document');
  });

  it('STILL rejects fenced-truncated SVG (fence stripped, but still no </svg>)', () => {
    const truncated = '<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="20" fill="#06b6d4"/></svg';
    const fencedTruncated = '```svg\n' + truncated + '\n```';
    const salvaged = salvageSVG(fencedTruncated);
    const result = validateSVG(salvaged, { mode: 'icon' });

    expect(salvaged).toBe(truncated);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('raw <svg> document');
  });

  it('STILL rejects prose-wrapped truncated SVG (extraction yields truncated body)', () => {
    const truncated = '<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="20" fill="#06b6d4"/></svg';
    const prose = 'Here is the SVG: ' + truncated + ' (cut off)';
    const salvaged = salvageSVG(prose);
    const result = validateSVG(salvaged, { mode: 'icon' });

    // No closing </svg> means the prose-extraction regex finds nothing, so
    // salvage leaves the prose intact and the validator rejects it.
    expect(salvaged).toBe(prose);
    expect(salvaged).not.toMatch(/<\/svg>$/);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('raw <svg> document');
  });

  it('returns an empty string for empty or non-string input', () => {
    expect(salvageSVG('')).toBe('');
    // @ts-expect-error exercising defensive guard against non-string callers
    expect(salvageSVG(undefined)).toBe('');
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

  it('rejects remote paint-server URLs in vector attributes', () => {
    const result = validateSVG('<svg viewBox="0 0 100 100"><rect width="100" height="100" fill="url(https://example.com/pattern.svg#p)"/></svg>');

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
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.LIMINAL_LLM_BASE_URL;
  });

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
      expect(prompt).toContain('Keep the SVG compact');
      expect(prompt).toContain('End with </svg>');
    }
  });

  it('does not allow filters in prompts for gradient-only modes', () => {
    const gen = new TestableSVGGenerator();
    const prompt = (gen as any).buildSVGPrompt('make a logo', { mode: 'logo' });

    expect(prompt).toContain('Gradients may be used');
    expect(prompt).toContain('Do not use filters');
  });

  it('adds explicit transparent-background guidance when requested', () => {
    const gen = new TestableSVGGenerator();
    const prompt = (gen as any).buildSVGPrompt('make a logo with a transparent background', { mode: 'logo' });

    expect(prompt).toContain('Transparent background requested');
    expect(prompt).toContain('do not draw a full-canvas background rect');
  });

  it('bypasses the generic code tool loop for raw SVG generation', async () => {
    process.env.LIMINAL_LLM_BASE_URL = 'http://localhost:1234/v1';
    const llm = new LLMClient({ baseUrl: 'http://localhost:1234/v1', model: 'svg-test-model' });
    const complete = vi.spyOn(llm, 'complete').mockResolvedValue({
      text: '<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="18" fill="blue"/></svg>',
      success: true,
    });
    const toolLoop = vi.spyOn(llm, 'generateWithToolLoop').mockResolvedValue({
      content: '',
      iterations: 1,
      toolCallsMade: 0,
      success: false,
      error: 'wrong path',
    });

    const gen = new SVGGenerator(llm);
    const svg = await gen.generate('tiny blue SVG circle');

    expect(toolLoop).not.toHaveBeenCalled();
    expect(complete).toHaveBeenCalledOnce();
    expect(complete.mock.calls[0]?.[0].maxTokens).toBe(2200);
    expect(complete.mock.calls[0]?.[0].signal).toBeInstanceOf(AbortSignal);
    expect(svg).toContain('<circle');
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  it('salvages a fenced valid SVG returned by the provider end-to-end', async () => {
    process.env.LIMINAL_LLM_BASE_URL = 'http://localhost:1234/v1';
    const llm = new LLMClient({ baseUrl: 'http://localhost:1234/v1', model: 'svg-test-model' });
    const complete = vi.spyOn(llm, 'complete').mockResolvedValue({
      text: '```svg\n<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="18" fill="#f59e0b"/></svg>\n```',
      success: true,
    });
    const toolLoop = vi.spyOn(llm, 'generateWithToolLoop').mockResolvedValue({
      content: '',
      iterations: 1,
      toolCallsMade: 0,
      success: false,
    });

    const gen = new SVGGenerator(llm);
    const svg = await gen.generate('orange SVG circle icon');

    expect(toolLoop).not.toHaveBeenCalled();
    expect(complete).toHaveBeenCalledOnce();
    expect(svg).toContain('<circle');
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain('viewBox="0 0 64 64"');
    expect(svg).not.toMatch(/^```/);
  });

  it('salvages a prose-wrapped valid SVG returned by the provider end-to-end', async () => {
    process.env.LIMINAL_LLM_BASE_URL = 'http://localhost:1234/v1';
    const llm = new LLMClient({ baseUrl: 'http://localhost:1234/v1', model: 'svg-test-model' });
    const complete = vi.spyOn(llm, 'complete').mockResolvedValue({
      text: 'Here is the icon: <svg viewBox="0 0 64 64"><rect width="64" height="64" fill="#10b981"/></svg> enjoy!',
      success: true,
    });
    const toolLoop = vi.spyOn(llm, 'generateWithToolLoop').mockResolvedValue({
      content: '',
      iterations: 1,
      toolCallsMade: 0,
      success: false,
    });

    const gen = new SVGGenerator(llm);
    const svg = await gen.generate('green square icon');

    expect(toolLoop).not.toHaveBeenCalled();
    expect(complete).toHaveBeenCalledOnce();
    expect(svg).toContain('<rect');
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).not.toMatch(/Here is the icon/);
  });

  it('falls back to a compact SVG prompt when the first direct path is empty', async () => {
    process.env.LIMINAL_LLM_BASE_URL = 'http://localhost:1234/v1';
    const llm = new LLMClient({ baseUrl: 'http://localhost:1234/v1', model: 'svg-test-model' });
    const complete = vi.spyOn(llm, 'complete')
      .mockResolvedValueOnce({ text: '', success: true })
      .mockResolvedValueOnce({
        text: '<svg viewBox="0 0 64 64"><rect width="64" height="64" fill="#111"/><path d="M20 50 L32 14 L44 50 Z" fill="#67e8f9"/></svg>',
        success: true,
      });
    const toolLoop = vi.spyOn(llm, 'generateWithToolLoop').mockResolvedValue({
      content: '',
      iterations: 1,
      toolCallsMade: 0,
      success: false,
    });
    const warn = vi.spyOn(Logger, 'warn');

    const gen = new SVGGenerator(llm);
    const svg = await gen.generate('liminal doorway logo');

    expect(toolLoop).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalledWith(
      'TierBasedGenerator',
      expect.stringContaining('tool loop returned empty code'),
    );
    expect(complete).toHaveBeenCalledTimes(2);
    expect(complete.mock.calls[1]?.[0].prompt).toContain('previous model call returned no final artifact');
    expect(complete.mock.calls[1]?.[0].maxTokens).toBe(1600);
    expect(complete.mock.calls[1]?.[0].signal).toBeInstanceOf(AbortSignal);
    expect(svg).toContain('<path');
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  it('fails clearly when the SVG retry still returns invalid prose', async () => {
    process.env.LIMINAL_LLM_BASE_URL = 'http://localhost:1234/v1';
    const llm = new LLMClient({ baseUrl: 'http://localhost:1234/v1', model: 'svg-test-model' });
    const complete = vi.spyOn(llm, 'complete')
      .mockResolvedValueOnce({ text: '', success: true })
      .mockResolvedValueOnce({ text: 'I need to draw the logo first.', success: true });
    const toolLoop = vi.spyOn(llm, 'generateWithToolLoop').mockResolvedValue({
      content: '',
      iterations: 1,
      toolCallsMade: 0,
      success: false,
    });

    const gen = new SVGGenerator(llm);

    await expect(gen.generate('liminal doorway logo')).rejects.toThrow(
      'SVGGenerator: provider returned no valid SVG after 2 bounded direct attempts',
    );
    expect(toolLoop).not.toHaveBeenCalled();
    expect(complete).toHaveBeenCalledTimes(2);
  });

  it('fails clearly when bounded provider attempts never return valid SVG', async () => {
    process.env.LIMINAL_LLM_BASE_URL = 'http://localhost:1234/v1';
    const llm = new LLMClient({ baseUrl: 'http://localhost:1234/v1', model: 'svg-test-model' });
    const complete = vi.spyOn(llm, 'complete').mockResolvedValue({
      text: '',
      success: true,
      error: 'empty response',
    });
    vi.spyOn(llm, 'generateWithToolLoop').mockResolvedValue({
      content: '',
      iterations: 1,
      toolCallsMade: 0,
      success: false,
    });

    const gen = new SVGGenerator(llm);

    await expect(gen.generate('new bounded SVG proof prompt')).rejects.toThrow(
      'SVGGenerator: provider returned no valid SVG after 2 bounded direct attempts',
    );
    expect(complete).toHaveBeenCalledTimes(2);
  });
});
