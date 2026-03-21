import { describe, it, expect } from 'vitest';
/**
 * P5GeneratorLLM tests. When LLM is not configured, generate() throws.
 */
import { P5GeneratorLLM } from '../../src/generators/p5/P5GeneratorLLM.js';

describe('P5GeneratorLLM', () => {
  describe('generate()', () => {
    it('should throw when LLM is not configured', async () => {
      const generator = new P5GeneratorLLM();
      await expect(generator.generate('sketch with sound')).rejects.toThrow(
        'P5GeneratorLLM: No LLM configured'
      );
    });
  });
});
