import { countSyllables } from '../music/SyllableCounter.js';
import type { CreativeQuestion, CreativeTerm, CreativeVocabularyEngine } from './types.js';

export interface CreativeWritingPreferences extends Record<string, unknown> {
  voice?: 'first-person' | 'second-person' | 'third-person';
  tone?: 'plainspoken' | 'lyrical' | 'mythic' | 'playful';
  structure?: 'caption' | 'narration' | 'dialogue' | 'poem' | 'script';
  captionStyle?: 'short' | 'dense';
}

export class CreativeWritingEngine implements CreativeVocabularyEngine<CreativeWritingPreferences> {
  readonly domain = 'creative-writing' as const;

  describeTerms(): CreativeTerm[] {
    return [
      term('voice', 'Voice', 'The perspective and personality speaking to the audience.'),
      term('tone', 'Tone', 'The emotional register: plainspoken, lyrical, mythic, playful, or direct.'),
      term('structure', 'Structure', 'The shape of the writing: caption, narration, dialogue, poem, or script.'),
      term('imagery', 'Imagery', 'Concrete sensory language that helps humans picture, hear, or feel the idea.'),
      term('pacing', 'Pacing', 'How quickly ideas, sentences, captions, or lines unfold.'),
      term('lineation', 'Lineation', 'Where lines break in captions, poems, lyrics, or on-screen text.'),
      term('dialogue', 'Dialogue', 'How characters, voices, or speakers exchange lines.'),
    ];
  }

  inferPreferences(text: string): Partial<CreativeWritingPreferences> {
    const lower = text.toLowerCase();
    return {
      ...(/(first-person|first person| i | my | me )/.test(` ${lower} `) ? { voice: 'first-person' as const } : {}),
      ...(/(you|second-person|second person)/.test(lower) ? { voice: 'second-person' as const } : {}),
      ...(/(lyrical|poetic|poem|verse)/.test(lower) ? { tone: 'lyrical' as const, structure: 'poem' as const } : {}),
      ...(/(myth|mythic|legend|ritual)/.test(lower) ? { tone: 'mythic' as const } : {}),
      ...(/(plain|clear|simple|direct)/.test(lower) ? { tone: 'plainspoken' as const } : {}),
      ...(/(caption|subtitle|short text)/.test(lower) ? { structure: 'caption' as const } : {}),
      ...(/(narration|voiceover|voice-over)/.test(lower) ? { structure: 'narration' as const } : {}),
      ...(/(dialogue|conversation|script)/.test(lower) ? { structure: 'script' as const } : {}),
      ...(/(short caption|short captions|brief caption)/.test(lower) ? { captionStyle: 'short' as const } : {}),
      ...(countSyllables(text) > 32 ? { captionStyle: 'dense' as const } : {}),
    };
  }

  suggestQuestions(): CreativeQuestion[] {
    return [
      { id: 'writing.voice-tone', question: 'Should the words feel plainspoken, lyrical, mythic, playful, first-person, or direct?', terms: ['voice', 'tone'], optional: true },
      { id: 'writing.structure', question: 'Should this be caption text, narration, dialogue, a poem, or a script?', terms: ['structure', 'lineation', 'dialogue'], optional: true },
    ];
  }

  buildPromptHints(preferences: Partial<CreativeWritingPreferences>): string[] {
    const hints: string[] = [];
    if (preferences.voice) hints.push(`Use ${preferences.voice} writing voice.`);
    if (preferences.tone) hints.push(`Use a ${preferences.tone} writing tone.`);
    if (preferences.structure) hints.push(`Shape writing as ${preferences.structure}.`);
    if (preferences.captionStyle === 'short') hints.push('Keep captions short and easy to read.');
    if (preferences.captionStyle === 'dense') hints.push('Watch caption density; split long ideas for readability.');
    return hints;
  }
}

function term(id: string, label: string, description: string): CreativeTerm {
  return { id, label, description, layer: 'creative-preference' };
}
