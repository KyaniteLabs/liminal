import { describe, it, expect } from 'vitest';
import { CellularAutomata } from '../../src/generators/p5/CellularAutomata.js';

describe('CellularAutomata', () => {
  describe('generate()', () => {
    it('should return a string containing p5.js cellular automata code', () => {
      const params = {};
      const result = CellularAutomata.generate(params);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should generate code with setup() and draw() functions', () => {
      const params = {};
      const result = CellularAutomata.generate(params);

      expect(result).toContain('function setup(');
      expect(result).toContain('function draw(');
    });

    it('should generate code with createCanvas() call', () => {
      const params = {};
      const result = CellularAutomata.generate(params);

      expect(result).toContain('createCanvas');
    });

    it('should generate valid JavaScript syntax', () => {
      const params = {};
      const result = CellularAutomata.generate(params);

      expect(result).not.toContain('SyntaxError');
      expect(result).not.toContain('undefined');
    });

    it('should handle empty params object', () => {
      const params = {};
      const result = CellularAutomata.generate(params);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle null params gracefully', () => {
      const params = null;
      const result = CellularAutomata.generate(params);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle undefined params gracefully', () => {
      const params = undefined;
      const result = CellularAutomata.generate(params);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should generate Lenia-style continuous CA with smooth rules', () => {
      const params = {
        type: 'lenia',
        continuous: true
      };
      const result = CellularAutomata.generate(params);

      expect(result.toLowerCase()).toMatch(/(continuous|smooth|lenia|float)/);
      expect(typeof result).toBe('string');
    });

    it('should generate organic-looking patterns', () => {
      const params = {
        type: 'lenia',
        organic: true
      };
      const result = CellularAutomata.generate(params);

      expect(result.toLowerCase()).toMatch(/(organic|smooth|growth|decay|blob)/);
      expect(typeof result).toBe('string');
    });

    it('should support grid/resolution parameter', () => {
      const params = {
        resolution: 5
      };
      const result = CellularAutomata.generate(params);

      expect(result).toMatch(/(5|resolution|grid)/);
      expect(typeof result).toBe('string');
    });

    it('should support different CA types (lenia, game-of-life, custom)', () => {
      const types = ['lenia', 'game-of-life', 'custom'];

      types.forEach(type => {
        const params = { type };
        const result = CellularAutomata.generate(params);

        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
      });
    });

    it('should generate code with kernel/ring functions for Lenia', () => {
      const params = {
        type: 'lenia',
        kernel: 'ring'
      };
      const result = CellularAutomata.generate(params);

      expect(result.toLowerCase()).toMatch(/(kernel|ring|gaussian|distance)/);
      expect(typeof result).toBe('string');
    });

    it('should support custom rules parameters', () => {
      const params = {
        rules: {
          birth: [0.3, 0.7],
          survival: [0.2, 0.8]
        }
      };
      const result = CellularAutomata.generate(params);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle neighborhood radius parameter', () => {
      const params = {
        radius: 15
      };
      const result = CellularAutomata.generate(params);

      expect(result).toMatch(/(15|radius|neighborhood)/);
      expect(typeof result).toBe('string');
    });

    it('should support time step/speed parameters', () => {
      const params = {
        timeStep: 0.1,
        speed: 2
      };
      const result = CellularAutomata.generate(params);

      expect(result.toLowerCase()).toMatch(/(time|speed|step|dt|delta)/);
      expect(typeof result).toBe('string');
    });

    it('should handle color mapping for cell states', () => {
      const params = {
        colorMapping: 'state',
        palette: 'bioluminescent'
      };
      const result = CellularAutomata.generate(params);

      expect(result.toLowerCase()).toMatch(/(color|fill|map|state)/);
      expect(typeof result).toBe('string');
    });

    it('should support canvas size parameters', () => {
      const params = {
        width: 800,
        height: 600
      };
      const result = CellularAutomata.generate(params);

      expect(result).toContain('800');
      expect(result).toContain('600');
      expect(typeof result).toBe('string');
    });

    it('should generate code with proper bracket matching', () => {
      const params = {};
      const result = CellularAutomata.generate(params);

      const openBraces = (result.match(/\{/g) || []).length;
      const closeBraces = (result.match(/\}/g) || []).length;

      expect(openBraces).toBe(closeBraces);
    });

    it('should generate code with proper parenthesis matching', () => {
      const params = {};
      const result = CellularAutomata.generate(params);

      const openParens = (result.match(/\(/g) || []).length;
      const closeParens = (result.match(/\)/g) || []).length;

      expect(openParens).toBe(closeParens);
    });

    it('should handle different neighborhood types (moore, von-neumann, circular)', () => {
      const neighborhoods = ['moore', 'von-neumann', 'circular'];

      neighborhoods.forEach(neighborhood => {
        const params = { neighborhood };
        const result = CellularAutomata.generate(params);

        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
      });
    });

    it('should support wrapping boundary conditions', () => {
      const params = {
        boundary: 'wrap'
      };
      const result = CellularAutomata.generate(params);

      expect(result.toLowerCase()).toMatch(/(wrap|modulo|%|toroidal)/);
      expect(typeof result).toBe('string');
    });

    it('should support fixed boundary conditions', () => {
      const params = {
        boundary: 'fixed'
      };
      const result = CellularAutomata.generate(params);

      expect(result.toLowerCase()).toMatch(/(bound|edge|fixed|clamp)/);
      expect(typeof result).toBe('string');
    });

    it('should generate code with 2D grid/array initialization', () => {
      const params = {};
      const result = CellularAutomata.generate(params);

      expect(result.toLowerCase()).toMatch(/(grid|array|\[\].*length|for.*nested)/);
      expect(typeof result).toBe('string');
    });

    it('should handle custom kernel functions', () => {
      const params = {
        kernel: 'custom',
        kernelFunction: 'gaussian'
      };
      const result = CellularAutomata.generate(params);

      expect(result.toLowerCase()).toMatch(/(kernel|gaussian|function|weight)/);
      expect(typeof result).toBe('string');
    });

    it('should support multiple species for Lenia', () => {
      const params = {
        species: 3
      };
      const result = CellularAutomata.generate(params);

      expect(result.toLowerCase()).toMatch(/(species|multi|3)/);
      expect(typeof result).toBe('string');
    });

    it('should handle mutation parameters', () => {
      const params = {
        mutationRate: 0.01,
        mutationStrength: 0.1
      };
      const result = CellularAutomata.generate(params);

      expect(result.toLowerCase()).toMatch(/(mutat|random|noise|perturb)/);
      expect(typeof result).toBe('string');
    });

    it('should generate different code for different parameters', () => {
      const params1 = { type: 'lenia', resolution: 10 };
      const params2 = { type: 'game-of-life', resolution: 5 };

      const result1 = CellularAutomata.generate(params1);
      const result2 = CellularAutomata.generate(params2);

      expect(result1).not.toBe(result2);
    });

    it('should support initial pattern generation', () => {
      const params = {
        initialPattern: 'random'
      };
      const result = CellularAutomata.generate(params);

      expect(result.toLowerCase()).toMatch(/(initial|random|setup|init)/);
      expect(typeof result).toBe('string');
    });

    it('should handle symmetry parameters', () => {
      const params = {
        symmetry: 6
      };
      const result = CellularAutomata.generate(params);

      expect(result.toLowerCase()).toMatch(/(symmetry|rotat|mirror|6)/);
      expect(typeof result).toBe('string');
    });

    it('should generate code with update/computation step', () => {
      const params = {};
      const result = CellularAutomata.generate(params);

      expect(result.toLowerCase()).toMatch(/(update|compute|next|step|evolve)/);
      expect(typeof result).toBe('string');
    });

    it('should handle interpolation/smoothing parameters', () => {
      const params = {
        smoothing: true,
        interpolation: 'bilinear'
      };
      const result = CellularAutomata.generate(params);

      expect(result.toLowerCase()).toMatch(/(smooth|interpolat|bilinear|lerp)/);
      expect(typeof result).toBe('string');
    });

    it('should support rendering options (cells, contours, heatmap)', () => {
      const renderModes = ['cells', 'contours', 'heatmap'];

      renderModes.forEach(mode => {
        const params = { renderMode: mode };
        const result = CellularAutomata.generate(params);

        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
      });
    });

    it('should generate code with proper comments', () => {
      const params = {};
      const result = CellularAutomata.generate(params);

      expect(result).toMatch(/(\/\/|\/\*|\*)/);
      expect(typeof result).toBe('string');
    });

    it('should handle complex parameter combinations', () => {
      const params = {
        type: 'lenia',
        resolution: 4,
        radius: 20,
        timeStep: 0.2,
        colorMapping: 'gradient',
        species: 2,
        boundary: 'wrap',
        smoothing: true
      };
      const result = CellularAutomata.generate(params);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
      expect(result).toContain('function setup(');
      expect(result).toContain('function draw(');
    });

    it('should generate code within reasonable length limits', () => {
      const params = {};
      const result = CellularAutomata.generate(params);

      expect(result.length).toBeGreaterThanOrEqual(200);
      expect(result.length).toBeLessThanOrEqual(20000);
    });

    it('should handle special characters in params', () => {
      const params = {
        description: '<Organic> & {smooth} patterns'
      };
      const result = CellularAutomata.generate(params);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should generate code that can be parsed as JavaScript', () => {
      const params = {};
      const result = CellularAutomata.generate(params);

      expect(() => {
        const cleanCode = result
          .replace(/function\s+(setup|draw)\s*\(/g, 'function $1(')
          .replace(/\/\/.*$/gm, '')
          .replace(/\/\*[\s\S]*?\*\//g, '');

        new Function(cleanCode);
      }).not.toThrow();
    });

    it('should support interaction with mouse', () => {
      const params = {
        mouseInteraction: true
      };
      const result = CellularAutomata.generate(params);

      expect(result.toLowerCase()).toMatch(/mouse/);
      expect(typeof result).toBe('string');
    });

    it('should handle state preservation between frames', () => {
      const params = {};
      const result = CellularAutomata.generate(params);

      expect(result.toLowerCase()).toMatch(/(previous|state|buffer|current|next)/);
      expect(typeof result).toBe('string');
    });

    it('should support palette options for visualization', () => {
      const palettes = ['bioluminescent', 'thermal', 'grayscale', 'rainbow'];

      palettes.forEach(palette => {
        const params = { palette };
        const result = CellularAutomata.generate(params);

        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
      });
    });

    it('should generate different code on multiple calls with same params', () => {
      const params = { type: 'lenia' };

      const results = [];
      for (let i = 0; i < 3; i++) {
        results.push(CellularAutomata.generate(params));
      }

      const uniqueResults = new Set(results);
      expect(uniqueResults.size).toBeGreaterThan(1);
    });

    it('should handle very high resolution values', () => {
      const params = {
        resolution: 1
      };
      const result = CellularAutomata.generate(params);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle very low resolution values', () => {
      const params = {
        resolution: 20
      };
      const result = CellularAutomata.generate(params);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle zero resolution gracefully', () => {
      const params = {
        resolution: 0
      };
      const result = CellularAutomata.generate(params);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle negative radius gracefully', () => {
      const params = {
        radius: -10
      };
      const result = CellularAutomata.generate(params);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle extremely large canvas sizes', () => {
      const params = {
        width: 10000,
        height: 10000
      };
      const result = CellularAutomata.generate(params);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle unicode in custom parameters', () => {
      const params = {
        description: '🧬 Lenia CA with 中文 and 日本語'
      };
      const result = CellularAutomata.generate(params);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle very long parameter strings', () => {
      const params = {
        description: 'a'.repeat(10000)
      };
      const result = CellularAutomata.generate(params);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('Parameter Validation', () => {
    it('should use default resolution when invalid', () => {
      const params = {
        resolution: 'invalid'
      };
      const result = CellularAutomata.generate(params);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should use default type when invalid', () => {
      const params = {
        type: 999
      };
      const result = CellularAutomata.generate(params);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle NaN values gracefully', () => {
      const params = {
        resolution: NaN,
        radius: NaN
      };
      const result = CellularAutomata.generate(params);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle Infinity values gracefully', () => {
      const params = {
        resolution: Infinity,
        timeStep: Infinity
      };
      const result = CellularAutomata.generate(params);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle mixed valid and invalid parameters', () => {
      const params = {
        type: 'lenia',
        resolution: 'invalid',
        width: 800,
        height: 'invalid'
      };
      const result = CellularAutomata.generate(params);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('Lenia-Specific Features', () => {
    it('should generate smooth state transitions', () => {
      const params = {
        type: 'lenia',
        continuous: true
      };
      const result = CellularAutomata.generate(params);

      expect(result.toLowerCase()).toMatch(/(smooth|continuous|lerp|interpolat|0\.\d+.*1)/);
      expect(typeof result).toBe('string');
    });

    it('should support growth and decay functions', () => {
      const params = {
        type: 'lenia'
      };
      const result = CellularAutomata.generate(params);

      expect(result.toLowerCase()).toMatch(/(growth|decay|sigmoid|tanh|activ)/);
      expect(typeof result).toBe('string');
    });

    it('should handle convolution operations', () => {
      const params = {
        type: 'lenia',
        kernel: 'gaussian'
      };
      const result = CellularAutomata.generate(params);

      expect(result.toLowerCase()).toMatch(/(convol|kernel|neighbor|sum.*weight)/);
      expect(typeof result).toBe('string');
    });

    it('should support activation functions', () => {
      const params = {
        type: 'lenia',
        activation: 'sigmoid'
      };
      const result = CellularAutomata.generate(params);

      expect(result.toLowerCase()).toMatch(/(sigmoid|tanh|relu|activ|function)/);
      expect(typeof result).toBe('string');
    });

    it('should generate patterns with blob-like structures', () => {
      const params = {
        type: 'lenia',
        pattern: 'blobs'
      };
      const result = CellularAutomata.generate(params);

      expect(result.toLowerCase()).toMatch(/(blob|circle|orb|smooth|organic)/);
      expect(typeof result).toBe('string');
    });

    it('should support multi-scale Lenia variants', () => {
      const params = {
        type: 'lenia',
        scales: 3
      };
      const result = CellularAutomata.generate(params);

      expect(result.toLowerCase()).toMatch(/(scale|multi|level|3)/);
      expect(typeof result).toBe('string');
    });
  });

  describe('Code Quality', () => {
    it('should generate code with proper indentation', () => {
      const params = {};
      const result = CellularAutomata.generate(params);

      expect(result).toMatch(/  /);
      expect(typeof result).toBe('string');
    });

    it('should generate code with Cell or Grid class', () => {
      const params = {};
      const result = CellularAutomata.generate(params);

      expect(result.toLowerCase()).toMatch(/(class|grid|cell|state)/);
      expect(typeof result).toBe('string');
    });

    it('should generate code that includes background() call', () => {
      const params = {};
      const result = CellularAutomata.generate(params);

      expect(result).toMatch(/background\s*\(/);
      expect(typeof result).toBe('string');
    });

    it('should generate code with iteration loops', () => {
      const params = {};
      const result = CellularAutomata.generate(params);

      expect(result.toLowerCase()).toMatch(/for\s*\(|while\s*\(/);
      expect(typeof result).toBe('string');
    });

    it('should handle HSB color mode when specified', () => {
      const params = {
        colorMode: 'HSB'
      };
      const result = CellularAutomata.generate(params);

      expect(result).toMatch(/HSB|hsb/);
      expect(typeof result).toBe('string');
    });

    it('should handle RGB color mode when specified', () => {
      const params = {
        colorMode: 'RGB'
      };
      const result = CellularAutomata.generate(params);

      expect(result).toMatch(/RGB|rgb/);
      expect(typeof result).toBe('string');
    });

    it('should generate code with loadPixels() for direct manipulation', () => {
      const params = {
        renderMode: 'heatmap'
      };
      const result = CellularAutomata.generate(params);

      expect(result.toLowerCase()).toMatch(/(loadpixels|updatepixels|pixels\[\])/);
      expect(typeof result).toBe('string');
    });
  });
});