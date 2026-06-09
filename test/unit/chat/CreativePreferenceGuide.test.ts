import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getCreativeVocabularyDomainsForRuntimeDomain,
  buildCreativePreferencePromptHints,
  createCreativePreferenceSuggestion,
} from '../../../src/chat/CreativePreferenceGuide.js';

const { mockInfer, mockBuildHints, mockCollectQuestions } = vi.hoisted(() => ({
  mockInfer: vi.fn().mockReturnValue({}),
  mockBuildHints: vi.fn().mockReturnValue([]),
  mockCollectQuestions: vi.fn().mockReturnValue([]),
}));

vi.mock('../../../src/creative-vocabulary/index.js', () => ({
  inferCreativePreferences: mockInfer,
  buildCreativePromptHints: mockBuildHints,
  collectCreativeQuestions: mockCollectQuestions,
}));

describe('CreativePreferenceGuide', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInfer.mockReturnValue({});
    mockBuildHints.mockReturnValue([]);
    mockCollectQuestions.mockReturnValue([]);
  });

  describe('getCreativeVocabularyDomainsForRuntimeDomain', () => {
    it('returns mapped domains for known runtime domains', () => {
      expect(getCreativeVocabularyDomainsForRuntimeDomain('hydra')).toEqual(['color', 'motion']);
      expect(getCreativeVocabularyDomainsForRuntimeDomain('p5')).toEqual(['color', 'motion']);
      expect(getCreativeVocabularyDomainsForRuntimeDomain('strudel')).toEqual(['music']);
      expect(getCreativeVocabularyDomainsForRuntimeDomain('revideo')).toEqual(['motion', 'cinematic', 'creative-writing']);
    });

    it('returns default domains for unknown runtime domain', () => {
      expect(getCreativeVocabularyDomainsForRuntimeDomain('unknown')).toEqual(['color', 'motion']);
    });

    it('returns default domains for empty string', () => {
      expect(getCreativeVocabularyDomainsForRuntimeDomain('')).toEqual(['color', 'motion']);
    });

    it('returns a copy (not the original array)', () => {
      const a = getCreativeVocabularyDomainsForRuntimeDomain('hydra');
      const b = getCreativeVocabularyDomainsForRuntimeDomain('hydra');
      expect(a).toEqual(b);
      expect(a).not.toBe(b);
    });
  });

  describe('buildCreativePreferencePromptHints', () => {
    it('returns hints from buildCreativePromptHints', () => {
      mockInfer.mockReturnValue({ color: { palette: 'warm' } });
      mockBuildHints.mockReturnValue(['Consider warm palettes']);

      const hints = buildCreativePreferencePromptHints({
        domain: 'hydra',
        prompt: 'warm sunset',
      });

      expect(hints).toEqual(['Consider warm palettes']);
    });

    it('passes answers to conversation text', () => {
      mockInfer.mockReturnValue({});
      mockBuildHints.mockReturnValue([]);

      buildCreativePreferencePromptHints({
        domain: 'p5',
        prompt: 'test prompt',
        answers: { q1: 'answer1', q2: ['a', 'b'] },
      });

      const calledWith = mockInfer.mock.calls[0][0];
      expect(calledWith).toContain('test prompt');
      expect(calledWith).toContain('answer1');
      expect(calledWith).toContain('a b');
    });

    it('handles undefined answers', () => {
      buildCreativePreferencePromptHints({
        domain: 'p5',
        prompt: 'test',
      });

      expect(mockInfer).toHaveBeenCalledWith('test');
    });

    it('handles null-ish values in answers', () => {
      buildCreativePreferencePromptHints({
        domain: 'p5',
        prompt: 'test',
        answers: { q1: null, q2: undefined },
      });

      expect(mockInfer).toHaveBeenCalled();
    });
  });

  describe('createCreativePreferenceSuggestion', () => {
    it('returns null when context has no prompt', () => {
      expect(createCreativePreferenceSuggestion({ prompt: '', domain: 'hydra' } as any)).toBeNull();
    });

    it('returns null when context has no domain', () => {
      expect(createCreativePreferenceSuggestion({ prompt: 'sunset', domain: '' } as any)).toBeNull();
    });

    it('returns null when context is null', () => {
      expect(createCreativePreferenceSuggestion(null as any)).toBeNull();
    });

    it('returns null when no questions are collected', () => {
      mockCollectQuestions.mockReturnValue([]);

      const result = createCreativePreferenceSuggestion({
        prompt: 'make a sunset',
        domain: 'hydra',
      } as any);

      expect(result).toBeNull();
    });

    it('returns suggestion when questions exist', () => {
      mockCollectQuestions.mockReturnValue([
        { question: 'What color palette?', domain: 'color' },
      ]);

      const result = createCreativePreferenceSuggestion({
        prompt: 'make a sunset',
        domain: 'hydra',
      } as any);

      expect(result).not.toBeNull();
      expect(result!.type).toBe('parameter');
      expect(result!.title).toBe('Optional creative preferences');
      expect(result!.priority).toBe('low');
      expect(result!.description).toContain('color/motion');
      expect(result!.description).toContain('What color palette?');
    });

    it('limits questions to 2 in description', () => {
      mockCollectQuestions.mockReturnValue([
        { question: 'Q1?', domain: 'color' },
        { question: 'Q2?', domain: 'motion' },
        { question: 'Q3?', domain: 'color' },
      ]);

      const result = createCreativePreferenceSuggestion({
        prompt: 'test',
        domain: 'hydra',
      } as any);

      expect(result!.description).toContain('Q1?');
      expect(result!.description.split('\n').length).toBeLessThanOrEqual(4);
    });
  });
});
