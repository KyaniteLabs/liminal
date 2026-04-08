/**
 * P5Generator tests — verifies the static wrapper delegates to P5GeneratorLLM.
 * P5Generator is a thin facade; the real generation logic lives in P5GeneratorLLM.
 */
import { describe, it, expect, vi } from 'vitest';

// Self-contained mock for P5GeneratorLLM
vi.mock('../../src/generators/p5/P5GeneratorLLM.js', () => {
  const mockCode = `function setup() {
  createCanvas(400, 400);
}

function draw() {
  background(30);
  ellipse(width / 2, height / 2, 60, 60);
}`;

  return {
    P5GeneratorLLM: vi.fn(function() {
      this.generate = vi.fn(() => Promise.resolve(mockCode));
      this.generateFull = vi.fn(() => Promise.resolve({
        code: mockCode,
        success: true,
        thinking: 'test thinking',
        recoveredFromThinking: false,
      }));
    }),
  };
});

import { P5Generator } from '../../src/generators/p5/P5Generator.js';

describe('P5Generator', () => {
  describe('generate()', () => {
    it('should return a string containing p5.js sketch code', async () => {
      const result = await P5Generator.generate('Create a simple particle system');
      expect(typeof result).toBe('string');
      expect(result).toContain('createCanvas');
    });

    it('should generate code with setup() function', async () => {
      const result = await P5Generator.generate('Create a basic sketch');
      expect(result).toContain('function setup(');
    });

    it('should generate code with draw() function', async () => {
      const result = await P5Generator.generate('Create a basic sketch');
      expect(result).toContain('function draw(');
    });

    it('should generate code with background() call', async () => {
      const result = await P5Generator.generate('Create a sketch with background');
      expect(result).toMatch(/background\s*\(/);
    });

    it('should handle empty prompt gracefully', async () => {
      const result = await P5Generator.generate('');
      expect(typeof result).toBe('string');
    });

    it('should handle null prompt gracefully', async () => {
      const result = await P5Generator.generate(null);
      expect(typeof result).toBe('string');
    });

    it('should handle undefined prompt gracefully', async () => {
      const result = await P5Generator.generate(undefined);
      expect(typeof result).toBe('string');
    });

    it('should handle numeric prompt input', async () => {
      const result = await P5Generator.generate(12345);
      expect(typeof result).toBe('string');
    });

    it('should handle object prompt input', async () => {
      const result = await P5Generator.generate({ text: 'Create a sketch' });
      expect(typeof result).toBe('string');
    });

    it('should handle unicode in prompts', async () => {
      const result = await P5Generator.generate('Create artistic sketch');
      expect(typeof result).toBe('string');
    });

    it('should generate code with proper bracket matching', async () => {
      const result = await P5Generator.generate('Create a complex sketch');
      const openBraces = (result.match(/\{/g) || []).length;
      const closeBraces = (result.match(/\}/g) || []).length;
      expect(openBraces).toBe(closeBraces);
    });

    it('should generate code with proper parenthesis matching', async () => {
      const result = await P5Generator.generate('Create a sketch with function calls');
      const openParens = (result.match(/\(/g) || []).length;
      const closeParens = (result.match(/\)/g) || []).length;
      expect(openParens).toBe(closeParens);
    });
  });
});
