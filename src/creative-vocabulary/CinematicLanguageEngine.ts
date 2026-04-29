import type { CreativeQuestion, CreativeTerm, CreativeVocabularyEngine } from './types.js';

export interface CinematicPreferences extends Record<string, unknown> {
  structure?: 'hook-first' | 'atmospheric' | 'storyboarded';
  transition?: 'cut' | 'dissolve' | 'match-cut';
  framing?: 'wide' | 'close' | 'macro';
  captionRole?: 'none' | 'supportive' | 'primary';
}

export class CinematicLanguageEngine implements CreativeVocabularyEngine<CinematicPreferences> {
  readonly domain = 'cinematic' as const;

  describeTerms(): CreativeTerm[] {
    return [
      term('shot', 'Shot', 'A continuous visual unit with a framing and camera relationship.'),
      term('scene', 'Scene', 'A coherent dramatic or visual situation.'),
      term('beat', 'Beat', 'A small story or timing unit where meaning changes.'),
      term('sequence', 'Sequence', 'A run of shots or beats that build one idea.'),
      term('transition', 'Transition', 'How one visual moment becomes the next.'),
      term('framing', 'Framing', 'How close, wide, centered, or off-axis the subject appears.'),
      term('caption-timing', 'Caption timing', 'How long words stay on screen and how they align with beats.'),
    ];
  }

  inferPreferences(text: string): Partial<CinematicPreferences> {
    const lower = text.toLowerCase();
    return {
      ...(/(hook|attention|first second)/.test(lower) ? { structure: 'hook-first' as const } : {}),
      ...(/(atmosphere|ambient|mood)/.test(lower) ? { structure: 'atmospheric' as const } : {}),
      ...(/(storyboard|scene|shot list)/.test(lower) ? { structure: 'storyboarded' as const } : {}),
      ...(/(dissolve|fade)/.test(lower) ? { transition: 'dissolve' as const } : {}),
      ...(/(match cut|match-cut)/.test(lower) ? { transition: 'match-cut' as const } : {}),
      ...(/(close|portrait|intimate)/.test(lower) ? { framing: 'close' as const } : {}),
      ...(/(wide|landscape|establishing)/.test(lower) ? { framing: 'wide' as const } : {}),
      ...(/(caption|subtitle|text overlay)/.test(lower) ? { captionRole: 'supportive' as const } : {}),
    };
  }

  suggestQuestions(): CreativeQuestion[] {
    return [
      { id: 'cinematic.structure', question: 'Should the video lead with a hook, mood, or a storyboarded sequence?', terms: ['shot', 'scene', 'beat', 'sequence'], optional: true },
      { id: 'cinematic.captions', question: 'Should captions be absent, supportive, or carry the main message?', terms: ['caption-timing'], optional: true },
    ];
  }

  buildPromptHints(preferences: Partial<CinematicPreferences>): string[] {
    const hints: string[] = [];
    if (preferences.structure) hints.push(`Use a ${preferences.structure} cinematic structure.`);
    if (preferences.transition) hints.push(`Prefer ${preferences.transition} transitions.`);
    if (preferences.framing) hints.push(`Prefer ${preferences.framing} framing.`);
    if (preferences.captionRole) hints.push(`Use captions as ${preferences.captionRole} support.`);
    return hints;
  }
}

function term(id: string, label: string, description: string): CreativeTerm {
  return { id, label, description, layer: 'creative-preference' };
}
