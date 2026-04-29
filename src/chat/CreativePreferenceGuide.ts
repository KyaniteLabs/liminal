import {
  buildCreativePromptHints,
  collectCreativeQuestions,
  inferCreativePreferences,
  type CreativeVocabularyDomain,
  type DomainPreferenceMap,
} from '../creative-vocabulary/index.js';
import type { Domain, GenerationContext, Suggestion } from './types.js';

const DOMAIN_TO_VOCABULARY: Record<string, CreativeVocabularyDomain[]> = {
  p5: ['color', 'motion'],
  shader: ['color', 'motion'],
  three: ['color', 'motion'],
  hydra: ['color', 'motion'],
  music: ['music'],
  strudel: ['music'],
  revideo: ['motion', 'cinematic', 'creative-writing'],
};

export interface CreativePreferencePromptInput {
  domain: Domain | string;
  prompt: string;
  answers?: Record<string, unknown>;
}

export function getCreativeVocabularyDomainsForRuntimeDomain(domain: Domain | string): CreativeVocabularyDomain[] {
  return [...(DOMAIN_TO_VOCABULARY[domain] ?? ['color', 'motion'])];
}

export function buildCreativePreferencePromptHints(input: CreativePreferencePromptInput): string[] {
  const domains = getCreativeVocabularyDomainsForRuntimeDomain(input.domain);
  const conversationText = [
    input.prompt,
    ...Object.values(input.answers ?? {}).map(value => Array.isArray(value) ? value.join(' ') : String(value ?? '')),
  ].filter(Boolean).join('\n');
  const inferred = inferCreativePreferences(conversationText);
  const scoped: DomainPreferenceMap = {};

  for (const domain of domains) {
    scoped[domain] = inferred[domain] ?? {};
  }

  return buildCreativePromptHints(scoped);
}

export function createCreativePreferenceSuggestion(context: GenerationContext): Suggestion | null {
  if (!context?.prompt || !context.domain) return null;

  const domains = getCreativeVocabularyDomainsForRuntimeDomain(context.domain);
  const questionLines = domains.flatMap(domain =>
    collectCreativeQuestions({ domain, prompt: context.prompt }).slice(0, 1)
      .map(question => `- ${question.question}`),
  );

  if (questionLines.length === 0) return null;

  return {
    type: 'parameter',
    title: 'Optional creative preferences',
    description: [
      `If you want to steer the ${domains.join('/')} language, consider:`,
      ...questionLines.slice(0, 2),
    ].join('\n'),
    priority: 'low',
    action: async () => {},
  };
}
