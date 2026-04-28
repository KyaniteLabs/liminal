/**
 * P5GeneratorLLM unit tests.
 */
import { describe, it, expect } from 'vitest';
import { P5GeneratorLLM } from '../../../src/generators/p5/P5GeneratorLLM.js';

describe('P5GeneratorLLM', () => {
  it('can be instantiated', () => {
    const gen = new P5GeneratorLLM();
    expect(gen).not.toBeNull();
  });

  it('generate rejects without LLM config', async () => {
    const gen = new P5GeneratorLLM();
    await expect(gen.generate('test')).rejects.toThrow('LLM');
  });
});
