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
    expect(inferNaturalLanguagePrompt('domains', ['gauntlet'])).toBeNull();
    expect(inferNaturalLanguagePrompt('model', ['audition', 'dry-run-model'])).toBeNull();
    expect(inferNaturalLanguagePrompt('release', ['gate'])).toBeNull();
  });

  it('preserves multi-word prompts for explicit generate commands', () => {
    expect(commandPrompt(undefined, ['purple', 'alien', 'flower'])).toBe('purple alien flower');
    expect(commandPrompt('flag prompt', ['ignored'])).toBe('flag prompt');
  });

  it('recognizes broad self-improvement prompts so they do not become art prompts', () => {
    expect(isSelfImprovementPrompt('Improve yourself in one bounded real way')).toBe(true);
    expect(isSelfImprovementPrompt('Liminal should finish building itself as Codex for Art')).toBe(true);
    expect(isSelfImprovementPrompt('Make the prompt to Liminal acts to Liminal improves itself loop concrete for the agent')).toBe(true);
    expect(isSelfImprovementPrompt('Improve the way memory compost dreaming and intuition feed the self-improvement loop')).toBe(true);
    expect(isSelfImprovementPrompt('make a blue particle garden')).toBe(false);
    expect(isSelfImprovementPrompt('make visuals about liminal acts on stage')).toBe(false);
    expect(isSelfImprovementPrompt('make a memory compost dreaming garden')).toBe(false);
  });
});
