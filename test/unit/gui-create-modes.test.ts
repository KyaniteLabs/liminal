import { describe, expect, it } from 'vitest';
import {
  buildWorkbenchPrompt,
  buildWorkbenchRunOptions,
  buildWorkbenchRunOptionsForMode,
  CREATE_MODE_OPTIONS,
  detectPromptCreateMode,
  getCreateModeOption,
  requiresBridgeSession,
  usesOrganismApi,
  type CreateModeId,
} from '../../gui/src/gui/createModes';

describe('createModes', () => {
  it('exposes the full creative mode catalog', () => {
    expect(CREATE_MODE_OPTIONS.map((option) => option.id)).toEqual([
      'auto',
      'p5',
      'three',
      'svg',
      'glsl',
      'hydra',
      'strudel',
      'tone',
      'hyperframes',
      'kinetic',
      'ascii',
      'text',
      'revideo',
      'organism',
    ]);
    expect(CREATE_MODE_OPTIONS.find((option) => option.id === 'hyperframes')?.label).toContain('HyperFrames');
    expect(CREATE_MODE_OPTIONS.map((option) => option.id)).not.toContain('html');
  });

  it('adds domain hints for explicit bridge modes while leaving auto untouched', () => {
    expect(buildWorkbenchPrompt('auto', 'make a flower')).toBe('make a flower');
    expect(buildWorkbenchPrompt('three', 'make a flower')).toContain('Three.js 3D scene');
    expect(buildWorkbenchPrompt('svg', 'make a flower')).toContain('raw SVG vector asset');
    expect(buildWorkbenchPrompt('glsl', 'make a flower')).toContain('GLSL fragment shader');
    expect(buildWorkbenchPrompt('hyperframes', 'make a promo')).toContain('HyperFrames composition');
    expect(buildWorkbenchPrompt('kinetic', 'make moving typography')).toContain('CSS kinetic typography');
  });

  it('lets explicit prompt domain override a stale selected mode hint', () => {
    const prompt = buildWorkbenchPrompt('tone', 'make a hydra visual of icebergs dancing in the sky');

    expect(prompt).toContain('Hydra video synth');
    expect(prompt).not.toContain('Tone.js audio');
    expect(detectPromptCreateMode('make a hydra visual')).toBe('hydra');
    expect(detectPromptCreateMode('make a HyperFrames promo with clips')).toBe('hyperframes');
    expect(detectPromptCreateMode('make kinetic typography')).toBe('kinetic');
    expect(detectPromptCreateMode('make an HTML landing page')).toBe('hyperframes');
  });

  it('routes common video and timeline language to Revideo', () => {
    expect(detectPromptCreateMode('make a product video with timeline cuts')).toBe('revideo');
    expect(detectPromptCreateMode('render an mp4 motion graphics piece')).toBe('revideo');
    expect(buildWorkbenchPrompt('auto', 'make a product video with timeline cuts')).toContain('Revideo composition');
  });

  it('keeps organism as the dedicated paired music and visual API mode', () => {
    expect(usesOrganismApi('organism')).toBe(true);
    for (const mode of ['auto', 'p5', 'three', 'svg', 'hydra', 'strudel'] as CreateModeId[]) {
      expect(usesOrganismApi(mode)).toBe(false);
      expect(requiresBridgeSession(mode)).toBe(true);
    }
    expect(requiresBridgeSession('organism')).toBe(false);
    expect(getCreateModeOption('missing').id).toBe('auto');
  });

  it('builds fast draft run options separately from the slower prove path', () => {
    expect(buildWorkbenchRunOptions('draft', 7)).toEqual({
      executionMode: 'draft',
      maxIterations: 1,
      candidateCount: 1,
      timeoutMinutes: 1,
    });

    expect(buildWorkbenchRunOptions('prove', 7)).toEqual({
      executionMode: 'prove',
      maxIterations: 7,
      candidateCount: 1,
      timeoutMinutes: 3,
    });
  });

  it('gives slower draft domains enough time to return a visible preview', () => {
    expect(buildWorkbenchRunOptionsForMode('draft', 7, 'strudel')).toMatchObject({
      executionMode: 'draft',
      timeoutMinutes: 3,
    });
    expect(buildWorkbenchRunOptionsForMode('draft', 7, 'hydra')).toMatchObject({
      executionMode: 'draft',
      timeoutMinutes: 3,
    });
    expect(buildWorkbenchRunOptionsForMode('draft', 7, 'p5')).toMatchObject({
      executionMode: 'draft',
      timeoutMinutes: 1,
    });
  });
});
