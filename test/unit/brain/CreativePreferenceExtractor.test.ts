import { describe, it, expect } from 'vitest';
import { CreativePreferenceExtractor } from '../../../src/brain/CreativePreferenceExtractor.js';

describe('CreativePreferenceExtractor', () => {
  it('extracts style and color preferences from a prompt', () => {
    const extractor = new CreativePreferenceExtractor();
    const prefs = extractor.extractFromPrompt('Create a minimalist warm p5 sketch with particles');
    expect(prefs.length).toBeGreaterThanOrEqual(2);
    const categories = prefs.map(p => p.category);
    expect(categories).toContain('style');
    expect(categories).toContain('color');
  });

  it('extracts preferences from conversation messages', () => {
    const extractor = new CreativePreferenceExtractor();
    const result = extractor.extractFromConversation([
      { role: 'user', content: 'I want a dark geometric shader with noise' },
      { role: 'assistant', content: 'Here is your GLSL fragment shader.' },
    ]);
    expect(result.preferences.length).toBeGreaterThanOrEqual(2);
    expect(result.profileCompleteness).toBeGreaterThan(0);
  });

  it('returns dominant profile', () => {
    const extractor = new CreativePreferenceExtractor();
    extractor.extractFromPrompt('minimalist calm p5 sketch');
    const profile = extractor.getDominantProfile();
    expect(profile.style).toBe('minimalist');
    expect(profile.mood).toBe('calm');
  });

  it('returns sorted preferences by confidence', () => {
    const extractor = new CreativePreferenceExtractor();
    extractor.extractFromPrompt('glitch dark abstract');
    const prefs = extractor.getPreferences();
    for (let i = 1; i < prefs.length; i++) {
      expect(prefs[i - 1].confidence).toBeGreaterThanOrEqual(prefs[i].confidence);
    }
  });
});
