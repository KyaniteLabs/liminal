import { describe, expect, it } from 'vitest';
import {
  buildCreativePromptHints,
  collectCreativeQuestions,
  ColorVocabularyEngine,
  CreativeWritingEngine,
  getCreativeVocabularyEngine,
  listCreativeVocabularyEngines,
  MusicVocabularyEngine,
  MotionVocabularyEngine,
  CinematicLanguageEngine,
} from '../../../src/creative-vocabulary/index.js';

describe('creative vocabulary engines', () => {
  it('keeps human-perception guardrails separate from optional taste vocabulary', () => {
    const color = new ColorVocabularyEngine();
    const terms = color.describeTerms();

    expect(terms.map(term => term.id)).toEqual(expect.arrayContaining(['hue', 'value', 'contrast', 'saturation']));
    expect(terms.every(term => term.layer === 'creative-preference')).toBe(true);
  });

  it('offers a music vocabulary engine equivalent to ColorTheoryEngine for preference conversations', () => {
    const music = new MusicVocabularyEngine();

    expect(music.describeTerms().map(term => term.id)).toEqual(
      expect.arrayContaining(['tempo', 'rhythm', 'dynamics', 'instrumentation', 'harmony', 'chords']),
    );
    expect(music.inferPreferences('slow ambient chords with sparse instrumentation')).toMatchObject({
      tempo: 'slow',
      density: 'sparse',
      harmony: 'chordal',
    });
    expect(music.buildPromptHints({ tempo: 'slow', rhythm: 'syncopated' })).toEqual(
      expect.arrayContaining(['Prefer a slow tempo feel.', 'Use syncopated rhythmic language.']),
    );
  });

  it('covers motion, cinematic/video, and creative-writing domains without removing capabilities', () => {
    const motion = new MotionVocabularyEngine();
    const cinematic = new CinematicLanguageEngine();
    const writing = new CreativeWritingEngine();

    expect(motion.describeTerms().map(term => term.id)).toEqual(expect.arrayContaining(['pacing', 'easing', 'loopability']));
    expect(cinematic.describeTerms().map(term => term.id)).toEqual(expect.arrayContaining(['shot', 'scene', 'beat', 'transition']));
    expect(writing.describeTerms().map(term => term.id)).toEqual(expect.arrayContaining(['voice', 'tone', 'structure', 'imagery']));
    expect(writing.inferPreferences('lyrical first-person narration with short captions')).toMatchObject({
      voice: 'first-person',
      tone: 'lyrical',
      captionStyle: 'short',
    });
  });

  it('provides a registry for conversational UIs to ask optional preference questions', () => {
    const domains = listCreativeVocabularyEngines().map(engine => engine.domain);

    expect(domains).toEqual(expect.arrayContaining(['color', 'music', 'motion', 'cinematic', 'creative-writing']));
    expect(getCreativeVocabularyEngine('music')).toBeInstanceOf(MusicVocabularyEngine);
    expect(collectCreativeQuestions({ domain: 'music' }).every(question => question.optional)).toBe(true);
    expect(buildCreativePromptHints({ music: { tempo: 'fast' }, color: { saturation: 'muted' } })).toEqual(
      expect.arrayContaining(['Prefer a fast tempo feel.', 'Favor muted saturation.']),
    );
  });
});
