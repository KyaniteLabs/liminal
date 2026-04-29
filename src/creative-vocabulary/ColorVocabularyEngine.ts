import type { CreativeQuestion, CreativeTerm, CreativeVocabularyEngine } from './types.js';

export interface ColorPreferences extends Record<string, unknown> {
  hue?: string;
  value?: 'dark' | 'light';
  contrast?: 'low' | 'balanced' | 'high';
  saturation?: 'muted' | 'vivid';
  temperature?: 'warm' | 'cool';
}

export class ColorVocabularyEngine implements CreativeVocabularyEngine<ColorPreferences> {
  readonly domain = 'color' as const;

  describeTerms(): CreativeTerm[] {
    return [
      term('hue', 'Hue', 'The color family, such as blue, red, green, or violet.'),
      term('tone', 'Tone', 'The felt character of a color, often shaped by mixing gray or neighboring colors.'),
      term('value', 'Value', 'How light or dark a color feels.'),
      term('contrast', 'Contrast', 'How strongly light/dark or color differences separate elements.'),
      term('saturation', 'Saturation', 'How muted or vivid a color appears.'),
      term('temperature', 'Temperature', 'Whether colors feel warmer, cooler, or balanced.'),
    ];
  }

  inferPreferences(text: string): Partial<ColorPreferences> {
    const lower = text.toLowerCase();
    return {
      ...(/(dark|night|shadow)/.test(lower) ? { value: 'dark' as const } : {}),
      ...(/(light|bright|airy)/.test(lower) ? { value: 'light' as const } : {}),
      ...(/(muted|soft|pastel|subtle)/.test(lower) ? { saturation: 'muted' as const } : {}),
      ...(/(vivid|bold|neon|intense)/.test(lower) ? { saturation: 'vivid' as const } : {}),
      ...(/(high contrast|dramatic contrast)/.test(lower) ? { contrast: 'high' as const } : {}),
      ...(/(low contrast|gentle contrast)/.test(lower) ? { contrast: 'low' as const } : {}),
      ...(/(warm|sunset|amber|gold)/.test(lower) ? { temperature: 'warm' as const } : {}),
      ...(/(cool|blue|cyan|ice)/.test(lower) ? { temperature: 'cool' as const } : {}),
    };
  }

  suggestQuestions(): CreativeQuestion[] {
    return [
      { id: 'color.saturation', question: 'Do you want the colors to feel muted, balanced, or vivid?', terms: ['saturation'], optional: true },
      { id: 'color.contrast', question: 'Should contrast feel soft and atmospheric or crisp and legible?', terms: ['contrast', 'value'], optional: true },
    ];
  }

  buildPromptHints(preferences: Partial<ColorPreferences>): string[] {
    const hints: string[] = [];
    if (preferences.saturation === 'muted') hints.push('Favor muted saturation.');
    if (preferences.saturation === 'vivid') hints.push('Favor vivid saturation.');
    if (preferences.contrast === 'high') hints.push('Use high contrast as a creative preference.');
    if (preferences.contrast === 'low') hints.push('Use gentle low contrast as a creative preference.');
    if (preferences.value) hints.push(`Favor a ${preferences.value} value range.`);
    if (preferences.temperature) hints.push(`Favor a ${preferences.temperature} color temperature.`);
    return hints;
  }
}

function term(id: string, label: string, description: string): CreativeTerm {
  return { id, label, description, layer: 'creative-preference' };
}
