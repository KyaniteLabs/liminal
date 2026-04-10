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
  toneConfidence,
  kineticConfidence,
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
    });

    describe('htmlConfidence', () => {
      it('returns 0 for SaaS patterns (HTML is infrastructure-only, not creative)', () => {
        expect(htmlConfidence('create a portfolio')).toBe(0);
        expect(htmlConfidence('landing page design')).toBe(0);
        expect(htmlConfidence('dashboard ui')).toBe(0);
      });

      it('returns 0.50 for explicit HTML generator mentions (composition adapters)', () => {
        expect(htmlConfidence('html generator')).toBe(0.50);
        expect(htmlConfidence('generate html')).toBe(0.50);
      });

      it('returns 0 for unrelated prompts', () => {
        expect(htmlConfidence('draw a circle')).toBe(0);
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
      it('returns 0.95 for explicit kinetic typography/art/type mentions', () => {
        expect(kineticConfidence('kinetic typography')).toBe(0.95);
        expect(kineticConfidence('kinetic art')).toBe(0.95);
        expect(kineticConfidence('kinetic type')).toBe(0.95);
      });

      it('returns 0.90 for kinetic + css patterns', () => {
        expect(kineticConfidence('kinetic css animation')).toBe(0.90);
        expect(kineticConfidence('css kinetic design')).toBe(0.90);
        expect(kineticConfidence('kinetic style with css')).toBe(0.90);
      });

      it('returns 0.85 for perpetually animated / autonomous animation', () => {
        expect(kineticConfidence('perpetually animated')).toBe(0.85);
        expect(kineticConfidence('autonomous animation')).toBe(0.85);
        expect(kineticConfidence('css keyframes art')).toBe(0.85);
        expect(kineticConfidence('keyframes generative')).toBe(0.85);
      });

      it('returns 0.75 for kinetic typography signals', () => {
        expect(kineticConfidence('type in motion')).toBe(0.75);
        expect(kineticConfidence('animated typography')).toBe(0.75);
        expect(kineticConfidence('css animation art')).toBe(0.75);
      });

      it('returns 0 for unrelated prompts', () => {
        expect(kineticConfidence('draw a circle')).toBe(0);
        expect(kineticConfidence('three.js scene')).toBe(0);
      });
    });
  });

  describe('registerAllGenerators', () => {
    it('registers static generators when no plugins available', async () => {
      mockLoadAll.mockResolvedValueOnce([{ success: false }]);
      mockGetAll.mockReturnValueOnce([]);

      await registerAllGenerators();

      // Should register all static generators (10 domain + 1 p5 fallback)
      expect(mockRegister).toHaveBeenCalledTimes(11);
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
