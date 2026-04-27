import { describe, expect, it } from 'vitest';
import { commandPrompt, inferNaturalLanguagePrompt, isSelfImprovementPrompt } from '../../../src/cli/PromptArgs.js';

describe('CLI natural-language prompt args', () => {
  it('treats unknown positional text as a generation prompt', () => {
    expect(inferNaturalLanguagePrompt('icebergs', ['dancing', 'in', 'the', 'sky'])).toBe('icebergs dancing in the sky');
  });

  it('does not steal known commands', () => {
    expect(inferNaturalLanguagePrompt('studio', [])).toBeNull();
    expect(inferNaturalLanguagePrompt('compost', ['status'])).toBeNull();
    expect(inferNaturalLanguagePrompt('market', ['status'])).toBeNull();
  });

  it('preserves multi-word prompts for explicit generate commands', () => {
    expect(commandPrompt(undefined, ['purple', 'alien', 'flower'])).toBe('purple alien flower');
    expect(commandPrompt('flag prompt', ['ignored'])).toBe('flag prompt');
  });

  it('recognizes broad self-improvement prompts so they do not become art prompts', () => {
    expect(isSelfImprovementPrompt('Improve yourself in one bounded real way')).toBe(true);
    expect(isSelfImprovementPrompt('Liminal should finish building itself as Codex for Art')).toBe(true);
    expect(isSelfImprovementPrompt('make a blue particle garden')).toBe(false);
  });
});
