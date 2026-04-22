import { describe, expect, it } from 'vitest';
import {
  buildWorkbenchPrompt,
  CREATE_MODE_OPTIONS,
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
      'html',
      'ascii',
      'text',
      'revideo',
      'organism',
    ]);
  });

  it('adds domain hints for explicit bridge modes while leaving auto untouched', () => {
    expect(buildWorkbenchPrompt('auto', 'make a flower')).toBe('make a flower');
    expect(buildWorkbenchPrompt('three', 'make a flower')).toContain('Three.js 3D scene');
    expect(buildWorkbenchPrompt('svg', 'make a flower')).toContain('raw SVG vector asset');
    expect(buildWorkbenchPrompt('glsl', 'make a flower')).toContain('GLSL fragment shader');
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
});
