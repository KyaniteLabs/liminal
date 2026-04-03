import { describe, it, expect, vi } from 'vitest';
/**
 * P5GeneratorLLM tests. When LLM is not configured, generate() throws.
 */
import { P5GeneratorLLM } from '../../src/generators/p5/P5GeneratorLLM.js';
import { LLMClient } from '../../src/llm/LLMClient.js';

describe('P5GeneratorLLM', () => {
  describe('generate()', () => {
    it('should throw when LLM is not configured', async () => {
      vi.spyOn(LLMClient, 'isConfigured').mockReturnValue(false);
      const generator = new P5GeneratorLLM();
      await expect(generator.generate('sketch with sound')).rejects.toThrow();
    });
  });
});
