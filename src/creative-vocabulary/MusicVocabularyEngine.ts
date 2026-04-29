import { CHORD_PROGRESSIONS, SCALE_INTERVALS } from '../music/TheoryEngine.js';
import type { CreativeQuestion, CreativeTerm, CreativeVocabularyEngine } from './types.js';

export interface MusicPreferences extends Record<string, unknown> {
  tempo?: 'slow' | 'moderate' | 'fast';
  rhythm?: 'straight' | 'syncopated' | 'polyrhythmic';
  dynamics?: 'soft' | 'balanced' | 'loud';
  instrumentation?: string;
  harmony?: 'sparse' | 'chordal' | 'modal' | 'atonal';
  chords?: string;
  density?: 'sparse' | 'dense';
}

export class MusicVocabularyEngine implements CreativeVocabularyEngine<MusicPreferences> {
  readonly domain = 'music' as const;

  describeTerms(): CreativeTerm[] {
    return [
      term('tempo', 'Tempo', 'The felt speed or pulse of the music.'),
      term('rhythm', 'Rhythm', 'How beats and accents are arranged over time.'),
      term('dynamics', 'Dynamics', 'How soft, loud, swelling, or restrained the sound feels.'),
      term('instrumentation', 'Instrumentation', 'The sound sources or instruments carrying the piece.'),
      term('harmony', 'Harmony', `How notes combine, including ${Object.keys(SCALE_INTERVALS).slice(0, 4).join(', ')} modes.`),
      term('chords', 'Chords', `Progression language such as ${CHORD_PROGRESSIONS[0] ?? 'I-V-vi-IV'}.`),
      term('timbre', 'Timbre', 'The texture or tone color of the sound.'),
      term('density', 'Density', 'How much musical material happens at once.'),
    ];
  }

  inferPreferences(text: string): Partial<MusicPreferences> {
    const lower = text.toLowerCase();
    return {
      ...(/(slow|largo|ambient|drone)/.test(lower) ? { tempo: 'slow' as const } : {}),
      ...(/(fast|rapid|rave|dance|urgent)/.test(lower) ? { tempo: 'fast' as const } : {}),
      ...(/(syncopated|offbeat|swing)/.test(lower) ? { rhythm: 'syncopated' as const } : {}),
      ...(/(polyrhythm|polyrhythmic)/.test(lower) ? { rhythm: 'polyrhythmic' as const } : {}),
      ...(/(soft|quiet|gentle)/.test(lower) ? { dynamics: 'soft' as const } : {}),
      ...(/(loud|huge|aggressive)/.test(lower) ? { dynamics: 'loud' as const } : {}),
      ...(/(sparse|minimal|roomy)/.test(lower) ? { density: 'sparse' as const } : {}),
      ...(/(dense|busy|maximal)/.test(lower) ? { density: 'dense' as const } : {}),
      ...(/(chord|harmony|harmonic)/.test(lower) ? { harmony: 'chordal' as const } : {}),
      ...(/(modal|dorian|lydian|minor|major)/.test(lower) ? { harmony: 'modal' as const } : {}),
    };
  }

  suggestQuestions(): CreativeQuestion[] {
    return [
      { id: 'music.tempo-rhythm', question: 'Should the music feel slow, moderate, fast, straight, or syncopated?', terms: ['tempo', 'rhythm'], optional: true },
      { id: 'music.harmony-instrumentation', question: 'Do you want sparse texture, chord movement, or a specific instrumentation?', terms: ['harmony', 'chords', 'instrumentation', 'density'], optional: true },
    ];
  }

  buildPromptHints(preferences: Partial<MusicPreferences>): string[] {
    const hints: string[] = [];
    if (preferences.tempo) hints.push(`Prefer a ${preferences.tempo} tempo feel.`);
    if (preferences.rhythm === 'syncopated') hints.push('Use syncopated rhythmic language.');
    if (preferences.rhythm === 'polyrhythmic') hints.push('Use polyrhythmic rhythmic language.');
    if (preferences.dynamics) hints.push(`Keep dynamics ${preferences.dynamics}.`);
    if (preferences.density) hints.push(`Keep musical density ${preferences.density}.`);
    if (preferences.harmony) hints.push(`Use ${preferences.harmony} harmony as a creative preference.`);
    if (preferences.instrumentation) hints.push(`Prefer instrumentation: ${preferences.instrumentation}.`);
    return hints;
  }
}

function term(id: string, label: string, description: string): CreativeTerm {
  return { id, label, description, layer: 'creative-preference' };
}
