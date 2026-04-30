import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockRegister, mockGetAll } = vi.hoisted(() => ({
  mockRegister: vi.fn(),
  mockGetAll: vi.fn().mockReturnValue([]),
}));

const { mockLoadAll, mockGetAllPlugins } = vi.hoisted(() => ({
  mockLoadAll: vi.fn().mockResolvedValue([]),
  mockGetAllPlugins: vi.fn().mockReturnValue([]),
}));

vi.mock('../../../src/generators/GeneratorRegistry.js', () => ({
  generatorRegistry: {
    register: mockRegister,
    getAll: mockGetAll,
  },
}));

vi.mock('../../../src/plugins/PluginLoader.js', () => ({
  pluginLoader: {
    loadAll: mockLoadAll,
    getAllPlugins: mockGetAllPlugins,
  },
}));

import {
  registerAllGenerators,
  shaderConfidence,
  threeConfidence,
  htmlConfidence,
  asciiConfidence,
  textgenConfidence,
  strudelConfidence,
  hydraConfidence,
  svgConfidence,
  toneConfidence,
  kineticConfidence,
  p5Confidence,
} from '../../../src/generators/registerGenerators.js';

describe('registerGenerators', () => {
  beforeEach(() => {
    mockRegister.mockClear();
    mockGetAll.mockClear().mockReturnValue([]);
    mockLoadAll.mockClear().mockResolvedValue([]);
    mockGetAllPlugins.mockClear().mockReturnValue([]);
  });

  describe('confidence functions', () => {
    describe('shaderConfidence', () => {
      it('returns 0.9 for ray march patterns', () => {
        expect(shaderConfidence('create a ray march shader')).toBe(0.9);
        expect(shaderConfidence('sdf geometry shader')).toBe(0.9);
        expect(shaderConfidence('fragment shader with noise')).toBe(0.9);
      });

      it('returns 0.7 for shader/glsl patterns', () => {
        expect(shaderConfidence('create a shader')).toBe(0.7);
        expect(shaderConfidence('write glsl code')).toBe(0.7);
      });

      it('returns 0 for unrelated prompts', () => {
        expect(shaderConfidence('draw a circle')).toBe(0);
        expect(shaderConfidence('animate a box')).toBe(0);
      });
    });

    describe('threeConfidence', () => {
      it('returns 0.95 for explicit three.js mentions', () => {
        expect(threeConfidence('three.js scene')).toBe(0.95);
        expect(threeConfidence('using threejs')).toBe(0.95);
      });

      it('returns 0.90 for 3D with specific keywords', () => {
        expect(threeConfidence('3D scene with camera')).toBe(0.90);
        expect(threeConfidence('3D cube with rotation')).toBe(0.90);
      });

      it('returns 0.75 for generic 3D/webgl', () => {
        expect(threeConfidence('make something 3D')).toBe(0.75);
        expect(threeConfidence('webgl visualization')).toBe(0.75);
      });

      it('returns 0 for unrelated prompts', () => {
        expect(threeConfidence('draw a circle')).toBe(0);
      });

      it('does not win when Three.js is explicitly forbidden by a p5 route prompt', () => {
        expect(threeConfidence('Target creative domain: p5. Use p5.js only. Do not use Three.js.')).toBe(0);
      });
    });

    describe('htmlConfidence', () => {
      it('returns 0.95 for portfolio/landing page patterns', () => {
        expect(htmlConfidence('create a portfolio')).toBe(0.95);
        expect(htmlConfidence('landing page design')).toBe(0.95);
        expect(htmlConfidence('dashboard ui')).toBe(0.95);
      });

      it('returns 0.90 for explicit HTML/CSS mentions', () => {
        expect(htmlConfidence('html page')).toBe(0.90);
        expect(htmlConfidence('css styling')).toBe(0.90);
      });

      it('returns 0 for unrelated prompts', () => {
        expect(htmlConfidence('draw a circle')).toBe(0);
      });
    });

    describe('svgConfidence', () => {
      it('routes explicit SVG/vector business asset prompts to SVG', () => {
        expect(svgConfidence('svg icon')).toBe(0.95);
        expect(svgConfidence('vector logo asset')).toBe(0.95);
        expect(svgConfidence('laser cutfile for acrylic')).toBe(0.85);
        expect(svgConfidence('cnc toolpath')).toBe(0.85);
      });

      it('returns 0 for unrelated prompts', () => {
        expect(svgConfidence('draw a circle in p5')).toBe(0);
      });

      it('does not win when SVG is explicitly forbidden by a kinetic route prompt', () => {
        expect(svgConfidence('Target creative domain: kinetic. Return complete HTML/CSS. Do not return SVG-only output.')).toBe(0);
      });
    });

    describe('asciiConfidence', () => {
      it('returns 0.95 for explicit ascii art mentions', () => {
        expect(asciiConfidence('ascii art of a cat')).toBe(0.95);
      });

      it('returns 0.90 for ascii mentions', () => {
        expect(asciiConfidence('create ascii')).toBe(0.90);
      });

      it('returns 0 for unrelated prompts', () => {
        expect(asciiConfidence('draw a circle')).toBe(0);
      });
    });

    describe('textgenConfidence', () => {
      it('returns 0.95 for concrete poetry/text art patterns', () => {
        expect(textgenConfidence('concrete poetry')).toBe(0.95);
        expect(textgenConfidence('word art')).toBe(0.95);
        expect(textgenConfidence('typographic art')).toBe(0.95);
      });

      it('returns 0.90 for poem with visual patterns', () => {
        expect(textgenConfidence('poem with visual shape')).toBe(0.90);
      });

      it('returns 0 for ascii mentions (delegated to ascii generator)', () => {
        expect(textgenConfidence('ascii art')).toBe(0);
      });
    });

    describe('strudelConfidence', () => {
      it('returns 0.95 for strudel/tidal patterns', () => {
        expect(strudelConfidence('strudel music')).toBe(0.95);
        expect(strudelConfidence('tidal cycles')).toBe(0.95);
      });

      it('returns 0.85 for pattern-based music', () => {
        expect(strudelConfidence('techno beat music')).toBe(0.85);
      });

      it('returns 0 for unrelated prompts', () => {
        expect(strudelConfidence('draw a circle')).toBe(0);
      });
    });

    describe('hydraConfidence', () => {
      it('returns 0.95 for hydra/video synth patterns', () => {
        expect(hydraConfidence('hydra video synth')).toBe(0.95);
      });

      it('returns 0 for unrelated prompts', () => {
        expect(hydraConfidence('draw a circle')).toBe(0);
      });

      it('does not override explicit GLSL shader prompts when compost context mentions hydra', () => {
        expect(hydraConfidence('GLSL fragment shader plasma waves with hydra-like visual synthesis context')).toBe(0);
      });
    });

    describe('toneConfidence', () => {
      it('returns 0.95 for tone.js mentions', () => {
        expect(toneConfidence('tone.js synth')).toBe(0.95);
        expect(toneConfidence('using tonejs')).toBe(0.95);
      });

      it('returns 0.90 for synth patterns', () => {
        expect(toneConfidence('synthesizer in js')).toBe(0.90);
      });

      it('returns 0.80 for audio effect patterns', () => {
        expect(toneConfidence('bass sound')).toBe(0.80);
        expect(toneConfidence('sequencer pattern')).toBe(0.80);
      });

      it('returns 0 for unrelated prompts', () => {
        expect(toneConfidence('draw a circle')).toBe(0);
      });
    });

    describe('kineticConfidence', () => {
      it('routes kinetic typography and CSS motion prompts to KineticGenerator', () => {
        expect(kineticConfidence('kinetic typography')).toBe(0.95);
        expect(kineticConfidence('css kinetic text')).toBe(0.95);
        expect(kineticConfidence('animated words orbiting')).toBe(0.85);
      });

      it('returns 0 for unrelated prompts', () => {
        expect(kineticConfidence('draw a circle')).toBe(0);
      });
    });

    describe('p5Confidence', () => {
      it('returns 0.95 for explicit p5.js mentions', () => {
        expect(p5Confidence('create a p5.js sketch')).toBe(0.95);
        expect(p5Confidence('build this with p5js')).toBe(0.95);
      });

      it('returns 0.9 for p5 lifecycle APIs', () => {
        expect(p5Confidence('use createCanvas and draw()')).toBe(0.9);
      });

      it('returns 0 for vague prompts so ambiguity can be evaluated first', () => {
        expect(p5Confidence('make it cooler')).toBe(0);
      });
    });
  });

  describe('registerAllGenerators', () => {
    it('registers static generators when no plugins available', async () => {
      mockLoadAll.mockResolvedValueOnce([{ success: false }]);
      mockGetAll.mockReturnValueOnce([]);

      await registerAllGenerators();

      // Should register all static generators
      expect(mockRegister).toHaveBeenCalledTimes(13);
      expect(mockRegister.mock.calls.map(([entry]) => entry.name)).toContain('kinetic');
    });

    it('registers p5 with explicit-signal routing instead of always-on fallback confidence', async () => {
      mockLoadAll.mockResolvedValueOnce([{ success: false }]);
      mockGetAll.mockReturnValueOnce([]);

      await registerAllGenerators();

      const p5Entry = mockRegister.mock.calls
        .map(([entry]) => entry)
        .find((entry) => entry.name === 'p5');

      expect(p5Entry).not.toBeNull();
      expect(p5Entry.canHandle('make it cooler')).toBe(0);
      expect(p5Entry.canHandle('create a p5.js sketch with bouncing balls')).toBe(0.95);
    });

    it('is idempotent - skips if generators already registered', async () => {
      mockGetAll.mockReturnValueOnce([{ name: 'existing' }]);

      await registerAllGenerators();

      expect(mockLoadAll).not.toHaveBeenCalled();
      expect(mockRegister).not.toHaveBeenCalled();
    });

    it('loads and registers plugins when available', async () => {
      const mockPlugin = {
        manifest: { id: 'test-plugin' },
        canHandle: () => 0.5,
        generate: vi.fn(),
      };
      mockLoadAll.mockResolvedValueOnce([{ success: true }]);
      mockGetAllPlugins.mockReturnValueOnce([mockPlugin]);
      mockGetAll.mockReturnValueOnce([]).mockReturnValueOnce([]);

      await registerAllGenerators();

      expect(mockLoadAll).toHaveBeenCalled();
      expect(mockRegister).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'test-plugin',
          canHandle: expect.any(Function),
          generate: expect.any(Function),
        })
      );
    });
  });
});
