import { describe, it, expect } from 'vitest';
import { commandPrompt, inferNaturalLanguagePrompt, isSelfImprovementPrompt, suggestCommandForTypo } from '../../../src/cli/PromptArgs.js';

describe('PromptArgs', () => {
  describe('commandPrompt', () => {
    it('returns flag prompt when provided', () => {
      expect(commandPrompt('my custom prompt', ['unused'])).toBe('my custom prompt');
    });

    it('returns joined args when no flag prompt', () => {
      expect(commandPrompt(undefined, ['make', 'a', 'sunset'])).toBe('make a sunset');
    });

    it('returns null when flag is undefined and args are empty', () => {
      expect(commandPrompt(undefined, [])).toBeNull();
    });

    it('returns null when flag is undefined and args are whitespace-only', () => {
      expect(commandPrompt(undefined, ['  ', ' '])).toBeNull();
    });

    it('trims whitespace from joined args', () => {
      expect(commandPrompt(undefined, ['  hello  '])).toBe('hello');
    });
  });

  describe('inferNaturalLanguagePrompt', () => {
    it('returns null when cmd is null', () => {
      expect(inferNaturalLanguagePrompt(null, ['extra'])).toBeNull();
    });

    it('returns null for known commands', () => {
      expect(inferNaturalLanguagePrompt('generate', ['sunset'])).toBeNull();
      expect(inferNaturalLanguagePrompt('chat', [])).toBeNull();
      expect(inferNaturalLanguagePrompt('serve', [])).toBeNull();
      expect(inferNaturalLanguagePrompt('g', [])).toBeNull();
    });

    it('returns joined string for unknown commands', () => {
      expect(inferNaturalLanguagePrompt('sunset', ['with', 'noise'])).toBe('sunset with noise');
    });

    it('returns the command alone when no extra args', () => {
      expect(inferNaturalLanguagePrompt('ocean', [])).toBe('ocean');
    });

    it('returns null for unknown command that trims to empty', () => {
      expect(inferNaturalLanguagePrompt('   ', [])).toBeNull();
    });
  });

  describe('isSelfImprovementPrompt', () => {
    it('detects "improve yourself"', () => {
      expect(isSelfImprovementPrompt('please improve yourself')).toBe(true);
    });

    it('detects "self-improve"', () => {
      expect(isSelfImprovementPrompt('self-improve the system')).toBe(true);
    });

    it('detects "self improve" (no hyphen)', () => {
      expect(isSelfImprovementPrompt('self improve now')).toBe(true);
    });

    it('detects "improves itself"', () => {
      expect(isSelfImprovementPrompt('it improves itself over time')).toBe(true);
    });

    it('detects "improve itself"', () => {
      expect(isSelfImprovementPrompt('help it improve itself')).toBe(true);
    });

    it('detects "self-improvement loop"', () => {
      expect(isSelfImprovementPrompt('run the self-improvement loop')).toBe(true);
    });

    it('detects "finish yourself"', () => {
      expect(isSelfImprovementPrompt('finish yourself')).toBe(true);
    });

    it('detects "finish building yourself"', () => {
      expect(isSelfImprovementPrompt('finish building yourself')).toBe(true);
    });

    it('detects "improve your own"', () => {
      expect(isSelfImprovementPrompt('improve your own code')).toBe(true);
    });

    it('detects "improve the actual sinter application"', () => {
      expect(isSelfImprovementPrompt('improve the actual sinter application')).toBe(true);
    });

    it('detects "codex for art"', () => {
      expect(isSelfImprovementPrompt('a codex for art')).toBe(true);
    });

    it('is case-insensitive', () => {
      expect(isSelfImprovementPrompt('IMPROVE YOURSELF')).toBe(true);
      expect(isSelfImprovementPrompt('Self-Improve')).toBe(true);
    });

    it('returns false for unrelated prompts', () => {
      expect(isSelfImprovementPrompt('make a sunset with noise')).toBe(false);
      expect(isSelfImprovementPrompt('generate a cool animation')).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(isSelfImprovementPrompt('')).toBe(false);
    });
  });

  describe('suggestCommandForTypo (audit F8 — front-door gate)', () => {
    it('catches single-edit typos of known commands', () => {
      expect(suggestCommandForTypo('grden', ['status'])).toEqual({ command: 'garden', reason: 'typo' });
      expect(suggestCommandForTypo('tast', ['eval'])).toEqual({ command: 'taste', reason: 'typo' });
      expect(suggestCommandForTypo('serv', [])).toEqual({ command: 'serve', reason: 'typo' });
    });

    it('catches a quoted command phrase passed as one argument', () => {
      // The shape that launched two real paid generations during the audit
      // (zsh does not word-split unquoted parameters).
      expect(suggestCommandForTypo('taste status', [])).toEqual({ command: 'taste', reason: 'quoted-phrase' });
      expect(suggestCommandForTypo('dream status', [])).toEqual({ command: 'dream', reason: 'quoted-phrase' });
    });

    it('lets genuine creative prompts through to generation', () => {
      expect(suggestCommandForTypo('icebergs', ['dancing', 'in', 'the', 'sky'])).toBeNull(); // 5 words
      expect(suggestCommandForTypo('cosmic', ['jellyfish'])).toBeNull(); // no near-miss
      expect(suggestCommandForTypo('blue particles drifting upward', [])).toBeNull(); // quoted, no command word
      expect(suggestCommandForTypo('a quiet tide, breathing', [])).toBeNull(); // punctuation = prose
    });

    it('does not fire for exact known commands or empty input', () => {
      expect(suggestCommandForTypo('garden', ['status'])).toBeNull(); // dispatched, never NL
      expect(suggestCommandForTypo(null, [])).toBeNull();
    });

    it('uses a tighter threshold for short tokens', () => {
      expect(suggestCommandForTypo('lst', [])).toEqual({ command: 'list', reason: 'typo' }); // d=1 at len 3
      expect(suggestCommandForTypo('lt', [])).toEqual({ command: 'ls', reason: 'typo' }); // d=1 to ls
      expect(suggestCommandForTypo('zq', [])).toBeNull(); // no 1-edit neighbor at len 2
    });
  });
});
