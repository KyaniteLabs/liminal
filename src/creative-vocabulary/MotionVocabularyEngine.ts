import type { CreativeQuestion, CreativeTerm, CreativeVocabularyEngine } from './types.js';

export interface MotionPreferences extends Record<string, unknown> {
  pacing?: 'slow' | 'steady' | 'snappy';
  easing?: 'linear' | 'organic' | 'springy';
  loopability?: 'seamless' | 'evolving';
  density?: 'calm' | 'busy';
}

export class MotionVocabularyEngine implements CreativeVocabularyEngine<MotionPreferences> {
  readonly domain = 'motion' as const;

  describeTerms(): CreativeTerm[] {
    return [
      term('pacing', 'Pacing', 'How quickly motion evolves over time.'),
      term('easing', 'Easing', 'How motion accelerates, decelerates, or settles.'),
      term('velocity', 'Velocity', 'The speed of movement.'),
      term('acceleration', 'Acceleration', 'The change in speed that creates snap, drift, or weight.'),
      term('loopability', 'Loopability', 'Whether motion returns cleanly to its start or keeps evolving.'),
      term('temporal-density', 'Temporal density', 'How much movement happens at once.'),
    ];
  }

  inferPreferences(text: string): Partial<MotionPreferences> {
    const lower = text.toLowerCase();
    return {
      ...(/(slow|drift|float|glide)/.test(lower) ? { pacing: 'slow' as const, easing: 'organic' as const } : {}),
      ...(/(snappy|quick|sharp|punchy)/.test(lower) ? { pacing: 'snappy' as const, easing: 'springy' as const } : {}),
      ...(/(seamless loop|perfect loop|looping)/.test(lower) ? { loopability: 'seamless' as const } : {}),
      ...(/(calm|minimal|quiet)/.test(lower) ? { density: 'calm' as const } : {}),
      ...(/(busy|chaotic|jitter)/.test(lower) ? { density: 'busy' as const } : {}),
    };
  }

  suggestQuestions(): CreativeQuestion[] {
    return [
      { id: 'motion.pacing', question: 'Should motion feel slow and drifting, steady, or snappy?', terms: ['pacing', 'easing'], optional: true },
      { id: 'motion.loopability', question: 'Should this be a seamless loop or an evolving motion system?', terms: ['loopability'], optional: true },
    ];
  }

  buildPromptHints(preferences: Partial<MotionPreferences>): string[] {
    const hints: string[] = [];
    if (preferences.pacing) hints.push(`Prefer ${preferences.pacing} motion pacing.`);
    if (preferences.easing) hints.push(`Use ${preferences.easing} easing language.`);
    if (preferences.loopability) hints.push(`Design motion as ${preferences.loopability}.`);
    if (preferences.density) hints.push(`Keep temporal density ${preferences.density}.`);
    return hints;
  }
}

function term(id: string, label: string, description: string): CreativeTerm {
  return { id, label, description, layer: 'creative-preference' };
}
