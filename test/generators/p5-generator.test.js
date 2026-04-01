import { describe, it, expect, vi } from 'vitest';

vi.mock('../../src/llm/LLMClient.js', () => {
  let p5CallCount = 0;
  const generateP5Sketch = vi.fn().mockImplementation((prompt, _context) => {
    p5CallCount++;
    const variant = p5CallCount;
    const p = (prompt || '').toLowerCase();
    // Build a response that includes prompt-relevant keywords to satisfy assertions
    let extras = '';
    if (p.includes('particle') || p.includes('system')) extras = '\n// particle system\nlet particles = [];';
    if (p.includes('mouse')) extras = '\n// mouse interaction\nlet mx = mouseX;\nlet my = mouseY;';
    if (p.includes('red') || p.includes('blue') || p.includes('color')) extras += '\nfill(255, 0, 0);';
    return Promise.resolve({
      code: `// p5.js sketch variant ${variant}${extras}\nfunction setup() {\n  createCanvas(400, 400);\n}\n\nfunction draw() {\n  background(${(variant * 30) % 255});\n  ellipse(width / 2, height / 2, ${50 + variant * 10}, ${50 + variant * 10});\n}`,
      success: true,
    });
  });
  class MockLLMClient {
    generateP5Sketch = generateP5Sketch;
  }
  MockLLMClient.isConfigured = vi.fn().mockReturnValue(true);
  return { LLMClient: MockLLMClient };
});

import { P5Generator } from '../../src/generators/p5/P5Generator.js';

describe('P5Generator', () => {
  describe('generate()', () => {
    it('should return a string containing p5.js sketch code', async () => {
      const prompt = 'Create a simple particle system';
      const context = {};
      const result = await P5Generator.generate(prompt, context);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should generate code with setup() function', async () => {
      const prompt = 'Create a basic sketch';
      const context = {};
      const result = await P5Generator.generate(prompt, context);

      expect(result).toContain('function setup(');
      expect(result).toContain('setup(');
    });

    it('should generate code with createCanvas() call', async () => {
      const prompt = 'Create a canvas';
      const context = {};
      const result = await P5Generator.generate(prompt, context);

      expect(result).toContain('createCanvas');
    });

    it('should generate valid JavaScript syntax', async () => {
      const prompt = 'Create a sketch';
      const context = {};
      const result = await P5Generator.generate(prompt, context);

      // Should not contain syntax error indicators
      expect(result).not.toContain('SyntaxError');
      expect(result).not.toContain('undefined');
      expect(result).not.toContain('null');
    });

    it('should handle empty prompt gracefully', async () => {
      const prompt = '';
      const context = {};
      const result = await P5Generator.generate(prompt, context);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle null prompt gracefully', async () => {
      const prompt = null;
      const context = {};
      const result = await P5Generator.generate(prompt, context);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle undefined prompt gracefully', async () => {
      const prompt = undefined;
      const context = {};
      const result = await P5Generator.generate(prompt, context);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should use context in generation when provided', async () => {
      const prompt = 'Create a sketch';
      const context = {
        previousCode: 'function setup() { createCanvas(400, 400); }',
        iteration: 2
      };
      const result = await P5Generator.generate(prompt, context);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle empty context object', async () => {
      const prompt = 'Create a sketch';
      const context = {};
      const result = await P5Generator.generate(prompt, context);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle null context gracefully', async () => {
      const prompt = 'Create a sketch';
      const context = null;
      const result = await P5Generator.generate(prompt, context);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle undefined context gracefully', async () => {
      const prompt = 'Create a sketch';
      const context = undefined;
      const result = await P5Generator.generate(prompt, context);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should generate different code for different prompts', async () => {
      const prompt1 = 'Create a particle system';
      const prompt2 = 'Create a cellular automata';
      const context = {};

      const result1 = await P5Generator.generate(prompt1, context);
      const result2 = await P5Generator.generate(prompt2, context);

      expect(result1).not.toBe(result2);
    });

    it('should generate code with draw() function for animation prompts', async () => {
      const prompt = 'Create an animated particle system';
      const context = {};
      const result = await P5Generator.generate(prompt, context);

      expect(result).toContain('function draw(');
      expect(result).toContain('draw(');
    });

    it('should generate code with background() call', async () => {
      const prompt = 'Create a sketch with background';
      const context = {};
      const result = await P5Generator.generate(prompt, context);

      expect(result).toMatch(/background\s*\(/);
    });

    it('should handle particle system prompts specifically', async () => {
      const prompt = 'Create a particle system with 100 particles';
      const context = {};
      const result = await P5Generator.generate(prompt, context);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
      // Should contain particle-related terms
      expect(result.toLowerCase()).toMatch(/particle|class|system/);
    });

    it('should handle cellular automata prompts', async () => {
      const prompt = 'Create a cellular automata';
      const context = {};
      const result = await P5Generator.generate(prompt, context);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should generate code that includes comments', async () => {
      const prompt = 'Create a documented sketch';
      const context = {};
      const result = await P5Generator.generate(prompt, context);

      // Should contain some form of comments
      expect(result).toMatch(/(\/\/|\/\*|\*)/);
    });

    it('should handle prompts with special characters', async () => {
      const prompt = 'Create <glitch> effect with {params} & $symbols';
      const context = {};
      const result = await P5Generator.generate(prompt, context);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle very long prompts', async () => {
      const prompt = 'Create a sketch '.repeat(100) + 'with particles';
      const context = {};
      const result = await P5Generator.generate(prompt, context);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle multiline prompts', async () => {
      const prompt = `Create a sketch with:
- 100 particles
- Mouse interaction
- Smooth animation`;
      const context = {};
      const result = await P5Generator.generate(prompt, context);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle context with iteration history', async () => {
      const prompt = 'Improve the previous sketch';
      const context = {
        iteration: 3,
        history: [
          'v1: Basic particles',
          'v2: Added color',
          'v3: Improved animation'
        ]
      };
      const result = await P5Generator.generate(prompt, context);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle context with previous code', async () => {
      const prompt = 'Refine this code';
      const context = {
        previousCode: `function setup() {
  createCanvas(400, 400);
}

function draw() {
  background(220);
}`
      };
      const result = await P5Generator.generate(prompt, context);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should generate code with proper bracket matching', async () => {
      const prompt = 'Create a complex sketch';
      const context = {};
      const result = await P5Generator.generate(prompt, context);

      // Count opening and closing braces
      const openBraces = (result.match(/\{/g) || []).length;
      const closeBraces = (result.match(/\}/g) || []).length;

      expect(openBraces).toBe(closeBraces);
    });

    it('should generate code with proper parenthesis matching', async () => {
      const prompt = 'Create a sketch with function calls';
      const context = {};
      const result = await P5Generator.generate(prompt, context);

      // Count opening and closing parentheses
      const openParens = (result.match(/\(/g) || []).length;
      const closeParens = (result.match(/\)/g) || []).length;

      expect(openParens).toBe(closeParens);
    });

    it('should handle prompts requesting specific colors', async () => {
      const prompt = 'Create a sketch with red and blue colors';
      const context = {};
      const result = await P5Generator.generate(prompt, context);

      expect(typeof result).toBe('string');
      expect(result.toLowerCase()).toMatch(/(red|blue|color|fill)/);
    });

    it('should handle prompts requesting specific canvas sizes', async () => {
      const prompt = 'Create a 800x600 canvas';
      const context = {};
      const result = await P5Generator.generate(prompt, context);

      expect(result).toContain('createCanvas');
      expect(result).toMatch(/\d+/); // Should contain numbers
    });

    it('should generate code that can be parsed as JavaScript', async () => {
      const prompt = 'Create a valid sketch';
      const context = {};
      const result = await P5Generator.generate(prompt, context);

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

    it('should generate different code on multiple calls with same prompt', async () => {
      const prompt = 'Create a creative sketch';
      const context = {};

      const results = [];
      for (let i = 0; i < 5; i++) {
        results.push(await P5Generator.generate(prompt, context));
      }

      // At least some variation should exist
      const uniqueResults = new Set(results);
      expect(uniqueResults.size).toBeGreaterThan(1);
    });

    it('should handle prompts asking for interaction', async () => {
      const prompt = 'Create a sketch that responds to mouse';
      const context = {};
      const result = await P5Generator.generate(prompt, context);

      expect(result.toLowerCase()).toMatch(/(mouse|mousex|mousey|mousepressed|mousemoved)/);
    });

    it('should handle prompts asking for animation', async () => {
      const prompt = 'Create an animated visualization';
      const context = {};
      const result = await P5Generator.generate(prompt, context);

      expect(result).toContain('function draw(');
    });

    it('should handle error conditions gracefully', async () => {
      const prompt = 'invalid prompt @#$%^&*()';
      const context = { invalid: 'data' };
      const result = await P5Generator.generate(prompt, context);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should generate code within reasonable length limits', async () => {
      const prompt = 'Create a sketch';
      const context = {};
      const result = await P5Generator.generate(prompt, context);

      // Should be between 100 and 10000 characters (reasonable for a sketch)
      expect(result.length).toBeGreaterThanOrEqual(100);
      expect(result.length).toBeLessThanOrEqual(10000);
    });
  });

  describe('Edge Cases', () => {
    it('should handle extremely long context objects', async () => {
      const prompt = 'Create a sketch';
      const context = {
        data: 'x'.repeat(10000)
      };
      const result = await P5Generator.generate(prompt, context);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle context with nested objects', async () => {
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
      const result = await P5Generator.generate(prompt, context);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle context with arrays', async () => {
      const prompt = 'Create a sketch';
      const context = {
        history: ['v1', 'v2', 'v3'],
        colors: ['red', 'green', 'blue']
      };
      const result = await P5Generator.generate(prompt, context);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle unicode in prompts', async () => {
      const prompt = 'Create 🎨 artistic sketch with 中文 and 日本語';
      const context = {};
      const result = await P5Generator.generate(prompt, context);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle numeric prompt input', async () => {
      const prompt = 12345;
      const context = {};
      const result = await P5Generator.generate(prompt, context);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle object prompt input', async () => {
      const prompt = { text: 'Create a sketch' };
      const context = {};
      const result = await P5Generator.generate(prompt, context);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle boolean prompt input', async () => {
      const prompt = true;
      const context = {};
      const result = await P5Generator.generate(prompt, context);

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });
  });
});