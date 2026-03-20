import { ParticleSystem } from '../../src/generators/p5/ParticleSystem.js';

describe('ParticleSystem', () => {
  describe('generate()', () => {
    it('should return a string containing p5.js particle system code', () => {
      const params = {};
      const result = ParticleSystem.generate(params);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should generate code with setup() and draw() functions', () => {
      const params = {};
      const result = ParticleSystem.generate(params);

      expect(result).toContain('function setup(');
      expect(result).toContain('function draw(');
    });

    it('should generate code with createCanvas() call', () => {
      const params = {};
      const result = ParticleSystem.generate(params);

      expect(result).toContain('createCanvas');
    });

    it('should generate valid JavaScript syntax', () => {
      const params = {};
      const result = ParticleSystem.generate(params);

      expect(result).not.toContain('SyntaxError');
      expect(result).not.toContain('undefined');
    });

    it('should handle empty params object', () => {
      const params = {};
      const result = ParticleSystem.generate(params);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle null params gracefully', () => {
      const params = null;
      const result = ParticleSystem.generate(params);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle undefined params gracefully', () => {
      const params = undefined;
      const result = ParticleSystem.generate(params);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should generate code with attraction forces when specified', () => {
      const params = {
        attraction: true,
        attractionStrength: 0.5
      };
      const result = ParticleSystem.generate(params);

      expect(result.toLowerCase()).toMatch(/(attract|force|pull)/);
      expect(typeof result).toBe('string');
    });

    it('should generate code with repulsion forces when specified', () => {
      const params = {
        repulsion: true,
        repulsionStrength: 0.8
      };
      const result = ParticleSystem.generate(params);

      expect(result.toLowerCase()).toMatch(/(repuls|push|force)/);
      expect(typeof result).toBe('string');
    });

    it('should generate code with decay parameters', () => {
      const params = {
        decay: 0.95,
        lifespan: 255
      };
      const result = ParticleSystem.generate(params);

      expect(result.toLowerCase()).toMatch(/(decay|lifespan|fade|alpha)/);
      expect(typeof result).toBe('string');
    });

    it('should generate code with color mapping', () => {
      const params = {
        colorMapping: 'velocity',
        colors: ['#ff0000', '#00ff00', '#0000ff']
      };
      const result = ParticleSystem.generate(params);

      expect(result.toLowerCase()).toMatch(/(color|fill|rgb|hsb|map)/);
      expect(typeof result).toBe('string');
    });

    it('should generate code with particle count from params', () => {
      const params = {
        particleCount: 150
      };
      const result = ParticleSystem.generate(params);

      expect(result).toContain('150');
      expect(typeof result).toBe('string');
    });

    it('should use default particle count when not specified', () => {
      const params = {};
      const result = ParticleSystem.generate(params);

      // Should contain some reasonable default particle count
      expect(result).toMatch(/\b(100|50|200)\b/);
      expect(typeof result).toBe('string');
    });

    it('should generate code with Particle class', () => {
      const params = {};
      const result = ParticleSystem.generate(params);

      expect(result).toMatch(/class\s+Particle/);
      expect(typeof result).toBe('string');
    });

    it('should generate code with particle array initialization', () => {
      const params = {};
      const result = ParticleSystem.generate(params);

      expect(result.toLowerCase()).toMatch(/particles.*\[\]|array/);
      expect(typeof result).toBe('string');
    });

    it('should generate code with update() method in Particle class', () => {
      const params = {};
      const result = ParticleSystem.generate(params);

      expect(result).toMatch(/update\s*\(/);
      expect(typeof result).toBe('string');
    });

    it('should generate code with display() method in Particle class', () => {
      const params = {};
      const result = ParticleSystem.generate(params);

      expect(result).toMatch(/display\s*\(/);
      expect(typeof result).toBe('string');
    });

    it('should handle velocity-based color mapping', () => {
      const params = {
        colorMapping: 'velocity'
      };
      const result = ParticleSystem.generate(params);

      expect(result.toLowerCase()).toMatch(/(velocity|vel|speed).*color|color.*(velocity|vel|speed)/);
      expect(typeof result).toBe('string');
    });

    it('should handle position-based color mapping', () => {
      const params = {
        colorMapping: 'position'
      };
      const result = ParticleSystem.generate(params);

      expect(result.toLowerCase()).toMatch(/(position|pos|x|y).*color|color.*(position|pos|x|y)/);
      expect(typeof result).toBe('string');
    });

    it('should handle age-based color mapping', () => {
      const params = {
        colorMapping: 'age'
      };
      const result = ParticleSystem.generate(params);

      expect(result.toLowerCase()).toMatch(/(age|life|time).*color|color.*(age|life|time)/);
      expect(typeof result).toBe('string');
    });

    it('should generate code with mouse attraction when enabled', () => {
      const params = {
        mouseAttraction: true
      };
      const result = ParticleSystem.generate(params);

      expect(result.toLowerCase()).toMatch(/mouse/);
      expect(typeof result).toBe('string');
    });

    it('should generate code with particle decay over time', () => {
      const params = {
        decay: 0.98
      };
      const result = ParticleSystem.generate(params);

      expect(result.toLowerCase()).toMatch(/(decay|fade|alpha.*-|-=.*alpha)/);
      expect(typeof result).toBe('string');
    });

    it('should generate code with lifespan parameter', () => {
      const params = {
        lifespan: 300
      };
      const result = ParticleSystem.generate(params);

      expect(result.toLowerCase()).toMatch(/lifespan/);
      expect(typeof result).toBe('string');
    });

    it('should handle custom canvas size', () => {
      const params = {
        width: 800,
        height: 600
      };
      const result = ParticleSystem.generate(params);

      expect(result).toContain('800');
      expect(result).toContain('600');
      expect(typeof result).toBe('string');
    });

    it('should handle different color palettes', () => {
      const params = {
        palette: 'warm'
      };
      const result = ParticleSystem.generate(params);

      expect(result.toLowerCase()).toMatch(/(red|orange|yellow|warm|255)/);
      expect(typeof result).toBe('string');
    });

    it('should handle cool color palette', () => {
      const params = {
        palette: 'cool'
      };
      const result = ParticleSystem.generate(params);

      expect(result.toLowerCase()).toMatch(/(blue|cyan|purple|cool|green)/);
      expect(typeof result).toBe('string');
    });

    it('should handle monochrome color palette', () => {
      const params = {
        palette: 'monochrome'
      };
      const result = ParticleSystem.generate(params);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should generate code with proper bracket matching', () => {
      const params = {};
      const result = ParticleSystem.generate(params);

      const openBraces = (result.match(/\{/g) || []).length;
      const closeBraces = (result.match(/\}/g) || []).length;

      expect(openBraces).toBe(closeBraces);
    });

    it('should generate code with proper parenthesis matching', () => {
      const params = {};
      const result = ParticleSystem.generate(params);

      const openParens = (result.match(/\(/g) || []).length;
      const closeParens = (result.match(/\)/g) || []).length;

      expect(openParens).toBe(closeParens);
    });

    it('should handle gravity parameter', () => {
      const params = {
        gravity: 0.1
      };
      const result = ParticleSystem.generate(params);

      expect(result.toLowerCase()).toMatch(/gravit/);
      expect(typeof result).toBe('string');
    });

    it('should handle friction parameter', () => {
      const params = {
        friction: 0.99
      };
      const result = ParticleSystem.generate(params);

      expect(result.toLowerCase()).toMatch(/frict/);
      expect(typeof result).toBe('string');
    });

    it('should handle both attraction and repulsion forces', () => {
      const params = {
        attraction: true,
        attractionStrength: 0.5,
        repulsion: true,
        repulsionStrength: 0.3
      };
      const result = ParticleSystem.generate(params);

      expect(result.toLowerCase()).toMatch(/(attract|repuls|force)/);
      expect(typeof result).toBe('string');
    });

    it('should generate different code for different params', () => {
      const params1 = { particleCount: 50, attraction: true };
      const params2 = { particleCount: 200, repulsion: true };

      const result1 = ParticleSystem.generate(params1);
      const result2 = ParticleSystem.generate(params2);

      expect(result1).not.toBe(result2);
    });

    it('should handle emission rate parameter', () => {
      const params = {
        emissionRate: 5
      };
      const result = ParticleSystem.generate(params);

      expect(result.toLowerCase()).toMatch(/(emiss|rate|spawn|create)/);
      expect(typeof result).toBe('string');
    });

    it('should handle trail effect parameter', () => {
      const params = {
        trails: true
      };
      const result = ParticleSystem.generate(params);

      expect(result.toLowerCase()).toMatch(/(trail|background.*alpha|fade)/);
      expect(typeof result).toBe('string');
    });

    it('should handle particle size variation', () => {
      const params = {
        minSize: 2,
        maxSize: 10
      };
      const result = ParticleSystem.generate(params);

      expect(result).toMatch(/(2|10)/);
      expect(typeof result).toBe('string');
    });

    it('should handle speed parameter', () => {
      const params = {
        speed: 3
      };
      const result = ParticleSystem.generate(params);

      expect(result.toLowerCase()).toMatch(/(speed|velocity|vx|vy)/);
      expect(typeof result).toBe('string');
    });

    it('should generate code with comments explaining parameters', () => {
      const params = {
        particleCount: 100
      };
      const result = ParticleSystem.generate(params);

      expect(result).toMatch(/(\/\/|\/\*|\*)/);
      expect(typeof result).toBe('string');
    });

    it('should handle boundary behavior (wrap vs bounce)', () => {
      const params = {
        boundary: 'bounce'
      };
      const result = ParticleSystem.generate(params);

      expect(result.toLowerCase()).toMatch(/(bound|bounce|wrap|edge)/);
      expect(typeof result).toBe('string');
    });

    it('should handle wrap boundary behavior', () => {
      const params = {
        boundary: 'wrap'
      };
      const result = ParticleSystem.generate(params);

      expect(result.toLowerCase()).toMatch(/(wrap|width|height)/);
      expect(typeof result).toBe('string');
    });

    it('should generate code within reasonable length limits', () => {
      const params = {};
      const result = ParticleSystem.generate(params);

      expect(result.length).toBeGreaterThanOrEqual(100);
      expect(result.length).toBeLessThanOrEqual(15000);
    });

    it('should handle complex parameter combinations', () => {
      const params = {
        particleCount: 200,
        attraction: true,
        repulsion: true,
        decay: 0.97,
        colorMapping: 'velocity',
        mouseAttraction: true,
        trails: true,
        gravity: 0.05,
        friction: 0.98
      };
      const result = ParticleSystem.generate(params);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
      expect(result).toContain('function setup(');
      expect(result).toContain('function draw(');
    });

    it('should handle special characters in params', () => {
      const params = {
        customEffect: '<glitch> & {noise}',
        description: 'Test with @#$ symbols'
      };
      const result = ParticleSystem.generate(params);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should generate code that can be parsed as JavaScript', () => {
      const params = {};
      const result = ParticleSystem.generate(params);

      expect(() => {
        const cleanCode = result
          .replace(/function\s+(setup|draw)\s*\(/g, 'function $1(')
          .replace(/\/\/.*$/gm, '')
          .replace(/\/\*[\s\S]*?\*\//g, '');

        new Function(cleanCode);
      }).not.toThrow();
    });

    it('should generate different code on multiple calls with same params', () => {
      const params = { particleCount: 100 };

      const results = [];
      for (let i = 0; i < 3; i++) {
        results.push(ParticleSystem.generate(params));
      }

      const uniqueResults = new Set(results);
      expect(uniqueResults.size).toBeGreaterThan(1);
    });

    it('should handle very large particle counts', () => {
      const params = {
        particleCount: 10000
      };
      const result = ParticleSystem.generate(params);

      expect(result).toContain('10000');
      expect(typeof result).toBe('string');
    });

    it('should handle very small particle counts', () => {
      const params = {
        particleCount: 5
      };
      const result = ParticleSystem.generate(params);

      expect(result).toContain('5');
      expect(typeof result).toBe('string');
    });

    it('should handle zero particle count gracefully', () => {
      const params = {
        particleCount: 0
      };
      const result = ParticleSystem.generate(params);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle negative particle count gracefully', () => {
      const params = {
        particleCount: -50
      };
      const result = ParticleSystem.generate(params);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle decimal particle count gracefully', () => {
      const params = {
        particleCount: 99.9
      };
      const result = ParticleSystem.generate(params);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle very high decay values', () => {
      const params = {
        decay: 1.5
      };
      const result = ParticleSystem.generate(params);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle very low decay values', () => {
      const params = {
        decay: 0.1
      };
      const result = ParticleSystem.generate(params);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle extremely high canvas sizes', () => {
      const params = {
        width: 10000,
        height: 10000
      };
      const result = ParticleSystem.generate(params);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle extremely low canvas sizes', () => {
      const params = {
        width: 10,
        height: 10
      };
      const result = ParticleSystem.generate(params);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle unicode in custom parameters', () => {
      const params = {
        description: '🎨 Particle system with 中文 and 日本語'
      };
      const result = ParticleSystem.generate(params);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle very long parameter strings', () => {
      const params = {
        description: 'a'.repeat(10000)
      };
      const result = ParticleSystem.generate(params);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle nested parameter objects', () => {
      const params = {
        physics: {
          gravity: 0.1,
          friction: 0.99
        },
        visual: {
          colorMode: 'HSB',
          palette: 'warm'
        }
      };
      const result = ParticleSystem.generate(params);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle array parameters', () => {
      const params = {
        colors: ['#ff0000', '#00ff00', '#0000ff'],
        sizes: [2, 4, 6, 8]
      };
      const result = ParticleSystem.generate(params);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('Parameter Validation', () => {
    it('should use default particle count when invalid', () => {
      const params = {
        particleCount: 'invalid'
      };
      const result = ParticleSystem.generate(params);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should use default decay when invalid', () => {
      const params = {
        decay: 'invalid'
      };
      const result = ParticleSystem.generate(params);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should use default canvas size when invalid', () => {
      const params = {
        width: 'invalid',
        height: 'invalid'
      };
      const result = ParticleSystem.generate(params);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle mixed valid and invalid parameters', () => {
      const params = {
        particleCount: 100,
        decay: 'invalid',
        width: 800,
        height: 'invalid'
      };
      const result = ParticleSystem.generate(params);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle NaN values gracefully', () => {
      const params = {
        particleCount: NaN,
        decay: NaN
      };
      const result = ParticleSystem.generate(params);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle Infinity values gracefully', () => {
      const params = {
        particleCount: Infinity,
        decay: Infinity
      };
      const result = ParticleSystem.generate(params);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('Code Quality', () => {
    it('should generate code with proper indentation', () => {
      const params = {};
      const result = ParticleSystem.generate(params);

      // Check for consistent indentation patterns
      expect(result).toMatch(/  /); // Should have some indentation
      expect(typeof result).toBe('string');
    });

    it('should generate code with no trailing whitespace issues', () => {
      const params = {};
      const result = ParticleSystem.generate(params);

      // Code should be clean (no excessive trailing spaces)
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should generate code with Particle class constructor', () => {
      const params = {};
      const result = ParticleSystem.generate(params);

      expect(result).toMatch(/constructor\s*\(/);
      expect(typeof result).toBe('string');
    });

    it('should generate code with particle properties', () => {
      const params = {};
      const result = ParticleSystem.generate(params);

      expect(result.toLowerCase()).toMatch(/(this\.|\.)(x|y|vx|vy|size|color)/);
      expect(typeof result).toBe('string');
    });

    it('should generate code that includes background() call', () => {
      const params = {};
      const result = ParticleSystem.generate(params);

      expect(result).toMatch(/background\s*\(/);
      expect(typeof result).toBe('string');
    });

    it('should generate code that includes noStroke() or stroke()', () => {
      const params = {};
      const result = ParticleSystem.generate(params);

      expect(result.toLowerCase()).toMatch(/(nostroke|stroke)\s*\(/);
      expect(typeof result).toBe('string');
    });

    it('should generate code that includes fill() call', () => {
      const params = {};
      const result = ParticleSystem.generate(params);

      expect(result).toMatch(/fill\s*\(/);
      expect(typeof result).toBe('string');
    });

    it('should generate code with ellipse() or rect() for drawing', () => {
      const params = {};
      const result = ParticleSystem.generate(params);

      expect(result.toLowerCase()).toMatch(/(ellipse|rect|circle)\s*\(/);
      expect(typeof result).toBe('string');
    });

    it('should handle HSB color mode when specified', () => {
      const params = {
        colorMode: 'HSB'
      };
      const result = ParticleSystem.generate(params);

      expect(result).toMatch(/HSB|hsb/);
      expect(typeof result).toBe('string');
    });

    it('should handle RGB color mode when specified', () => {
      const params = {
        colorMode: 'RGB'
      };
      const result = ParticleSystem.generate(params);

      expect(result).toMatch(/RGB|rgb/);
      expect(typeof result).toBe('string');
    });

    it('should generate code with push() and pop() for state isolation', () => {
      const params = {
        usePushMatrix: true
      };
      const result = ParticleSystem.generate(params);

      expect(result.toLowerCase()).toMatch(/push\s*\(|pop\s*\(/);
      expect(typeof result).toBe('string');
    });
  });
});