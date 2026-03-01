import { P5Generator } from '../../src/generators/p5/P5Generator';

describe('P5Generator', () => {
  describe('generate()', () => {
    it('should return a string containing p5.js sketch code', () => {
      const prompt = 'Create a simple particle system';
      const context = {};
      const result = P5Generator.generate(prompt, context);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should generate code with setup() function', () => {
      const prompt = 'Create a basic sketch';
      const context = {};
      const result = P5Generator.generate(prompt, context);

      expect(result).toContain('function setup(');
      expect(result).toContain('setup(');
    });

    it('should generate code with createCanvas() call', () => {
      const prompt = 'Create a canvas';
      const context = {};
      const result = P5Generator.generate(prompt, context);

      expect(result).toContain('createCanvas');
    });

    it('should generate valid JavaScript syntax', () => {
      const prompt = 'Create a sketch';
      const context = {};
      const result = P5Generator.generate(prompt, context);

      // Should not contain syntax error indicators
      expect(result).not.toContain('SyntaxError');
      expect(result).not.toContain('undefined');
      expect(result).not.toContain('null');
    });

    it('should handle empty prompt gracefully', () => {
      const prompt = '';
      const context = {};
      const result = P5Generator.generate(prompt, context);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle null prompt gracefully', () => {
      const prompt = null;
      const context = {};
      const result = P5Generator.generate(prompt, context);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle undefined prompt gracefully', () => {
      const prompt = undefined;
      const context = {};
      const result = P5Generator.generate(prompt, context);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should use context in generation when provided', () => {
      const prompt = 'Create a sketch';
      const context = {
        previousCode: 'function setup() { createCanvas(400, 400); }',
        iteration: 2
      };
      const result = P5Generator.generate(prompt, context);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle empty context object', () => {
      const prompt = 'Create a sketch';
      const context = {};
      const result = P5Generator.generate(prompt, context);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle null context gracefully', () => {
      const prompt = 'Create a sketch';
      const context = null;
      const result = P5Generator.generate(prompt, context);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle undefined context gracefully', () => {
      const prompt = 'Create a sketch';
      const context = undefined;
      const result = P5Generator.generate(prompt, context);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should generate different code for different prompts', () => {
      const prompt1 = 'Create a particle system';
      const prompt2 = 'Create a cellular automata';
      const context = {};

      const result1 = P5Generator.generate(prompt1, context);
      const result2 = P5Generator.generate(prompt2, context);

      expect(result1).not.toBe(result2);
    });

    it('should generate code with draw() function for animation prompts', () => {
      const prompt = 'Create an animated particle system';
      const context = {};
      const result = P5Generator.generate(prompt, context);

      expect(result).toContain('function draw(');
      expect(result).toContain('draw(');
    });

    it('should generate code with background() call', () => {
      const prompt = 'Create a sketch with background';
      const context = {};
      const result = P5Generator.generate(prompt, context);

      expect(result).toMatch(/background\s*\(/);
    });

    it('should handle particle system prompts specifically', () => {
      const prompt = 'Create a particle system with 100 particles';
      const context = {};
      const result = P5Generator.generate(prompt, context);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
      // Should contain particle-related terms
      expect(result.toLowerCase()).toMatch(/particle|class|system/);
    });

    it('should handle cellular automata prompts', () => {
      const prompt = 'Create a cellular automata';
      const context = {};
      const result = P5Generator.generate(prompt, context);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should generate code that includes comments', () => {
      const prompt = 'Create a documented sketch';
      const context = {};
      const result = P5Generator.generate(prompt, context);

      // Should contain some form of comments
      expect(result).toMatch(/(\/\/|\/\*|\*)/);
    });

    it('should handle prompts with special characters', () => {
      const prompt = 'Create <glitch> effect with {params} & $symbols';
      const context = {};
      const result = P5Generator.generate(prompt, context);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle very long prompts', () => {
      const prompt = 'Create a sketch '.repeat(100) + 'with particles';
      const context = {};
      const result = P5Generator.generate(prompt, context);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle multiline prompts', () => {
      const prompt = `Create a sketch with:
- 100 particles
- Mouse interaction
- Smooth animation`;
      const context = {};
      const result = P5Generator.generate(prompt, context);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle context with iteration history', () => {
      const prompt = 'Improve the previous sketch';
      const context = {
        iteration: 3,
        history: [
          'v1: Basic particles',
          'v2: Added color',
          'v3: Improved animation'
        ]
      };
      const result = P5Generator.generate(prompt, context);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle context with previous code', () => {
      const prompt = 'Refine this code';
      const context = {
        previousCode: `function setup() {
  createCanvas(400, 400);
}

function draw() {
  background(220);
}`
      };
      const result = P5Generator.generate(prompt, context);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should generate code with proper bracket matching', () => {
      const prompt = 'Create a complex sketch';
      const context = {};
      const result = P5Generator.generate(prompt, context);

      // Count opening and closing braces
      const openBraces = (result.match(/\{/g) || []).length;
      const closeBraces = (result.match(/\}/g) || []).length;

      expect(openBraces).toBe(closeBraces);
    });

    it('should generate code with proper parenthesis matching', () => {
      const prompt = 'Create a sketch with function calls';
      const context = {};
      const result = P5Generator.generate(prompt, context);

      // Count opening and closing parentheses
      const openParens = (result.match(/\(/g) || []).length;
      const closeParens = (result.match(/\)/g) || []).length;

      expect(openParens).toBe(closeParens);
    });

    it('should handle prompts requesting specific colors', () => {
      const prompt = 'Create a sketch with red and blue colors';
      const context = {};
      const result = P5Generator.generate(prompt, context);

      expect(typeof result).toBe('string');
      expect(result.toLowerCase()).toMatch(/(red|blue|color|fill)/);
    });

    it('should handle prompts requesting specific canvas sizes', () => {
      const prompt = 'Create a 800x600 canvas';
      const context = {};
      const result = P5Generator.generate(prompt, context);

      expect(result).toContain('createCanvas');
      expect(result).toMatch(/\d+/); // Should contain numbers
    });

    it('should generate code that can be parsed as JavaScript', () => {
      const prompt = 'Create a valid sketch';
      const context = {};
      const result = P5Generator.generate(prompt, context);

      // Try to parse the code (should not throw)
      expect(() => {
        // Remove p5 specific syntax that might not parse
        const cleanCode = result
          .replace(/function\s+(setup|draw)\s*\(/g, 'function $1(')
          .replace(/\/\/.*$/gm, '') // Remove comments
          .replace(/\/\*[\s\S]*?\*\//g, ''); // Remove block comments

        // Basic syntax check
        new Function(cleanCode);
      }).not.toThrow();
    });

    it('should generate different code on multiple calls with same prompt', () => {
      const prompt = 'Create a creative sketch';
      const context = {};

      const results = [];
      for (let i = 0; i < 5; i++) {
        results.push(P5Generator.generate(prompt, context));
      }

      // At least some variation should exist
      const uniqueResults = new Set(results);
      expect(uniqueResults.size).toBeGreaterThan(1);
    });

    it('should handle prompts asking for interaction', () => {
      const prompt = 'Create a sketch that responds to mouse';
      const context = {};
      const result = P5Generator.generate(prompt, context);

      expect(result.toLowerCase()).toMatch(/(mouse|mousex|mousey|mousepressed|mousemoved)/);
    });

    it('should handle prompts asking for animation', () => {
      const prompt = 'Create an animated visualization';
      const context = {};
      const result = P5Generator.generate(prompt, context);

      expect(result).toContain('function draw(');
    });

    it('should handle error conditions gracefully', () => {
      const prompt = 'invalid prompt @#$%^&*()';
      const context = { invalid: 'data' };
      const result = P5Generator.generate(prompt, context);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should generate code within reasonable length limits', () => {
      const prompt = 'Create a sketch';
      const context = {};
      const result = P5Generator.generate(prompt, context);

      // Should be between 100 and 10000 characters (reasonable for a sketch)
      expect(result.length).toBeGreaterThanOrEqual(100);
      expect(result.length).toBeLessThanOrEqual(10000);
    });
  });

  describe('Edge Cases', () => {
    it('should handle extremely long context objects', () => {
      const prompt = 'Create a sketch';
      const context = {
        data: 'x'.repeat(10000)
      };
      const result = P5Generator.generate(prompt, context);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle context with nested objects', () => {
      const prompt = 'Create a sketch';
      const context = {
        meta: {
          version: 1,
          config: {
            width: 400,
            height: 400
          }
        }
      };
      const result = P5Generator.generate(prompt, context);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle context with arrays', () => {
      const prompt = 'Create a sketch';
      const context = {
        history: ['v1', 'v2', 'v3'],
        colors: ['red', 'green', 'blue']
      };
      const result = P5Generator.generate(prompt, context);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle unicode in prompts', () => {
      const prompt = 'Create 🎨 artistic sketch with 中文 and 日本語';
      const context = {};
      const result = P5Generator.generate(prompt, context);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle numeric prompt input', () => {
      const prompt = 12345;
      const context = {};
      const result = P5Generator.generate(prompt, context);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle object prompt input', () => {
      const prompt = { text: 'Create a sketch' };
      const context = {};
      const result = P5Generator.generate(prompt, context);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle boolean prompt input', () => {
      const prompt = true;
      const context = {};
      const result = P5Generator.generate(prompt, context);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });
});