export type CreativeVocabularyDomain = 'color' | 'music' | 'motion' | 'cinematic' | 'creative-writing';
export type CreativeTermLayer = 'creative-preference' | 'human-perception';

export interface CreativeTerm {
  id: string;
  label: string;
  description: string;
  examples?: string[];
  layer: CreativeTermLayer;
}

export interface CreativeQuestion {
  id: string;
  question: string;
  terms: string[];
  optional: boolean;
}

export interface CreativeContext {
  domain?: string;
  prompt?: string;
  userIntent?: string;
}

export interface CreativeVocabularyEngine<TPreferences extends Record<string, unknown> = Record<string, unknown>> {
  readonly domain: CreativeVocabularyDomain;
  describeTerms(): CreativeTerm[];
  inferPreferences(text: string): Partial<TPreferences>;
  suggestQuestions(context?: CreativeContext): CreativeQuestion[];
  buildPromptHints(preferences: Partial<TPreferences>): string[];
}

export type DomainPreferenceMap = Partial<Record<CreativeVocabularyDomain, Record<string, unknown>>>;
