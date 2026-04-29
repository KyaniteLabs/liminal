import { describe, expect, it } from 'vitest';
import {
  buildCreativePreferencePromptHints,
  createCreativePreferenceSuggestion,
  getCreativeVocabularyDomainsForRuntimeDomain,
} from '../../../src/chat/CreativePreferenceGuide.js';

describe('CreativePreferenceGuide', () => {
  it('maps runtime domains to optional creative vocabulary lanes', () => {
    expect(getCreativeVocabularyDomainsForRuntimeDomain('p5')).toEqual(['color', 'motion']);
    expect(getCreativeVocabularyDomainsForRuntimeDomain('strudel')).toEqual(['music']);
    expect(getCreativeVocabularyDomainsForRuntimeDomain('revideo')).toEqual(['motion', 'cinematic', 'creative-writing']);
  });

  it('builds prompt hints from free-form conversation without adding mandatory UI fields', () => {
    const hints = buildCreativePreferencePromptHints({
      domain: 'strudel',
      prompt: 'slow ambient chords with sparse instrumentation',
      answers: { mood: 'gentle and quiet' },
    });

    expect(hints).toEqual(expect.arrayContaining([
      'Prefer a slow tempo feel.',
      'Keep musical density sparse.',
      'Use chordal harmony as a creative preference.',
    ]));
  });

  it('creates one low-priority optional suggestion instead of cluttering the interface', () => {
    const suggestion = createCreativePreferenceSuggestion({
      prompt: 'a cinematic title sequence with short captions',
      domain: 'revideo',
      techniques: [],
      constraints: [],
      references: [],
      iteration: 1,
      currentScore: 0.5,
    });

    expect(suggestion?.type).toBe('parameter');
    expect(suggestion?.priority).toBe('low');
    expect(suggestion?.title).toContain('Optional creative preferences');
    expect(suggestion?.description).toContain('Should the video lead');
    expect(suggestion?.description).not.toContain('guardrail');
  });
});
