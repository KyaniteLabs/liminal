/**
 * P5GeneratorLLM tests. When LLM is not configured, generate() uses template path.
 * Build before running: npm run build
 */
import { P5GeneratorLLM } from '../../src/generators/p5/P5GeneratorLLM.js';

describe('P5GeneratorLLM', () => {
  describe('generate()', () => {
    it('should generate code with sound API when prompt suggests sound', async () => {
      const generator = new P5GeneratorLLM();
      const prompt = 'sketch with subtle sound';
      const code = await generator.generate(prompt);

      expect(typeof code).toBe('string');
      expect(code.length).toBeGreaterThan(0);
      const hasSoundApi =
        code.includes('AudioContext') ||
        code.includes('createOscillator') ||
        code.includes('p5.sound');
      expect(hasSoundApi).toBe(true);
    });

    it('should return valid runnable p5 sketch with setup/draw for sound template', async () => {
      const generator = new P5GeneratorLLM();
      const code = await generator.generate('audio sketch');

      expect(code).toContain('function setup(');
      expect(code).toMatch(/createCanvas\s*\(/);
      expect(code).toContain('function draw(');
    });
  });
});
