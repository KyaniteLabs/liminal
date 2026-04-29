import { CinematicLanguageEngine } from './CinematicLanguageEngine.js';
import { ColorVocabularyEngine } from './ColorVocabularyEngine.js';
import { CreativeWritingEngine } from './CreativeWritingEngine.js';
import { MotionVocabularyEngine } from './MotionVocabularyEngine.js';
import { MusicVocabularyEngine } from './MusicVocabularyEngine.js';
import type {
  CreativeContext,
  CreativeQuestion,
  CreativeVocabularyDomain,
  CreativeVocabularyEngine,
  DomainPreferenceMap,
} from './types.js';

const DEFAULT_ENGINES: CreativeVocabularyEngine[] = [
  new ColorVocabularyEngine(),
  new MusicVocabularyEngine(),
  new MotionVocabularyEngine(),
  new CinematicLanguageEngine(),
  new CreativeWritingEngine(),
];

export function listCreativeVocabularyEngines(): CreativeVocabularyEngine[] {
  return [...DEFAULT_ENGINES];
}

export function getCreativeVocabularyEngine(domain: CreativeVocabularyDomain): CreativeVocabularyEngine | undefined {
  return DEFAULT_ENGINES.find(engine => engine.domain === domain);
}

export function collectCreativeQuestions(context?: CreativeContext): CreativeQuestion[] {
  const engine = context?.domain
    ? getCreativeVocabularyEngine(context.domain as CreativeVocabularyDomain)
    : undefined;
  const engines = engine ? [engine] : DEFAULT_ENGINES;
  return engines.flatMap(item => item.suggestQuestions(context));
}

export function buildCreativePromptHints(preferences: DomainPreferenceMap): string[] {
  return DEFAULT_ENGINES.flatMap(engine => engine.buildPromptHints(preferences[engine.domain] ?? {}));
}

export function inferCreativePreferences(text: string): DomainPreferenceMap {
  return Object.fromEntries(
    DEFAULT_ENGINES.map(engine => [engine.domain, engine.inferPreferences(text)]),
  ) as DomainPreferenceMap;
}
