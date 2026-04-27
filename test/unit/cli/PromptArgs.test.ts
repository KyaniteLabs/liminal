import { describe, expect, it } from 'vitest';
import { commandPrompt, inferNaturalLanguagePrompt } from '../../../src/cli/PromptArgs.js';

describe('CLI natural-language prompt args', () => {
  it('treats unknown positional text as a generation prompt', () => {
    expect(inferNaturalLanguagePrompt('icebergs', ['dancing', 'in', 'the', 'sky'])).toBe('icebergs dancing in the sky');
  });

  it('does not steal known commands', () => {
    expect(inferNaturalLanguagePrompt('studio', [])).toBeNull();
    expect(inferNaturalLanguagePrompt('compost', ['status'])).toBeNull();
  });

  it('preserves multi-word prompts for explicit generate commands', () => {
    expect(commandPrompt(undefined, ['purple', 'alien', 'flower'])).toBe('purple alien flower');
    expect(commandPrompt('flag prompt', ['ignored'])).toBe('flag prompt');
  });
});
