export type LyricMode =
  | 'word_cloud'
  | 'image_shards'
  | 'next_phrase'
  | 'rhyme_nearby'
  | 'echo'
  | 'counterpoint'
  | 'silence';

export interface LyricSidecarInput {
  presetId: string;
  sceneName?: string;
  visualTags: string[];
  performerTheme?: string;
  recentTranscript?: string;
  recentAcceptedPhrases: string[];
  recentDismissedPhrases: string[];
  audioMood: {
    intensity: 'silent' | 'soft' | 'medium' | 'high';
    pitchMotion: 'flat' | 'rising' | 'falling' | 'wandering' | 'wide';
    brightness: 'dark' | 'balanced' | 'bright';
    onsetDensity: 'sparse' | 'medium' | 'dense';
    vibrato: 'none' | 'subtle' | 'wide';
  };
  movementMood?: {
    stillness: 'still' | 'flowing' | 'active';
    posture?: string;
    gesture?: string;
  };
}

export interface PhraseSuggestion {
  id: string;
  text: string;
  mode: LyricMode;
  source: 'mock' | 'lfm2_5_350m' | 'lfm2_5_1_2b' | 'manual';
  confidence?: number;
  createdAt: number;
  expiresAt: number;
  tags: string[];
}

export type PhraseFeedbackType = 'phrase.pinned' | 'phrase.dismissed' | 'phrase.more_like_this';

export interface PhraseFeedbackEvent {
  type: PhraseFeedbackType;
  phraseId: string;
  text: string;
  createdAt: number;
  reason?: 'too_literal' | 'too_much' | 'not_now';
}

export interface TeleprompterOptions {
  maxVisibleSuggestions: number;
  maxStoredSuggestions?: number;
}

export interface MockPhraseOptions {
  count: number;
  now: number;
  ttlMs: number;
}

export type PhraseGenerator = (
  input: LyricSidecarInput,
  options: MockPhraseOptions,
) => PhraseSuggestion[] | Promise<PhraseSuggestion[]>;

const DEFAULT_MAX_STORED = 24;
const MOCK_BANK = [
  'blue ash',
  'under the glass moon',
  'stay near the water',
  'hollow violet',
  'soft machine',
  'where the light bends',
  'no shore',
  'sing it back',
  'breath in silver',
  'low tide dreaming',
  'a door of rain',
  'hold the quiet',
];

export class PhraseRingBuffer {
  private readonly maxVisibleSuggestions: number;
  private readonly maxStoredSuggestions: number;
  private suggestions: Array<PhraseSuggestion & { pinned?: boolean; dismissed?: boolean }> = [];
  private feedback: PhraseFeedbackEvent[] = [];

  constructor(options: TeleprompterOptions) {
    this.maxVisibleSuggestions = options.maxVisibleSuggestions;
    this.maxStoredSuggestions = options.maxStoredSuggestions ?? DEFAULT_MAX_STORED;
  }

  add(suggestions: PhraseSuggestion[], now: number): void {
    const valid = suggestions.filter(isValidSuggestion);
    this.suggestions = [
      ...this.suggestions.filter((suggestion) => suggestion.pinned || suggestion.expiresAt > now),
      ...valid,
    ].slice(-this.maxStoredSuggestions);
  }

  visible(now: number): PhraseSuggestion[] {
    return this.suggestions
      .filter((suggestion) => !suggestion.dismissed && (suggestion.pinned || suggestion.expiresAt > now))
      .slice(-this.maxVisibleSuggestions);
  }

  pin(phraseId: string, now: number): PhraseFeedbackEvent | null {
    const suggestion = this.suggestions.find((item) => item.id === phraseId);
    if (!suggestion) return null;
    suggestion.pinned = true;
    return this.record({ type: 'phrase.pinned', phraseId, text: suggestion.text, createdAt: now });
  }

  dismiss(phraseId: string, reason: PhraseFeedbackEvent['reason'], now: number): PhraseFeedbackEvent | null {
    const suggestion = this.suggestions.find((item) => item.id === phraseId);
    if (!suggestion) return null;
    suggestion.dismissed = true;
    return this.record({ type: 'phrase.dismissed', phraseId, text: suggestion.text, createdAt: now, reason });
  }

  moreLikeThis(phraseId: string, now: number): PhraseFeedbackEvent | null {
    const suggestion = this.suggestions.find((item) => item.id === phraseId);
    if (!suggestion) return null;
    return this.record({ type: 'phrase.more_like_this', phraseId, text: suggestion.text, createdAt: now });
  }

  events(): PhraseFeedbackEvent[] {
    return [...this.feedback];
  }

  private record(event: PhraseFeedbackEvent): PhraseFeedbackEvent {
    this.feedback.push(event);
    return event;
  }
}

export function createMockPhraseSuggestions(input: LyricSidecarInput, options: MockPhraseOptions): PhraseSuggestion[] {
  const avoided = new Set(input.recentDismissedPhrases.map((phrase) => phrase.toLowerCase()));
  const sceneWords = splitWords(input.sceneName || input.performerTheme || '').slice(0, 3);
  const seedPhrases = sceneWords.length >= 2 ? [`${sceneWords[0]} ${sceneWords.at(-1)}`] : [];
  const pool = [...seedPhrases, ...MOCK_BANK].filter((phrase) => !avoided.has(phrase.toLowerCase()));

  return pool.slice(0, options.count).map((text, index) => ({
    id: `mock-${options.now}-${index}-${slug(text)}`,
    text,
    mode: index % 2 === 0 ? 'image_shards' : 'next_phrase',
    source: 'mock',
    confidence: 0.72,
    createdAt: options.now,
    expiresAt: options.now + options.ttlMs,
    tags: [...input.visualTags.slice(0, 4), input.audioMood.intensity],
  }));
}

export async function requestPhraseBatch(
  input: LyricSidecarInput,
  options: {
    enabled: boolean;
    count: number;
    now: number;
    requestTimeoutMs: number;
    ttlMs?: number;
    generator?: PhraseGenerator;
  },
): Promise<PhraseSuggestion[]> {
  if (!options.enabled) return [];
  const generator = options.generator ?? createMockPhraseSuggestions;
  const ttlMs = options.ttlMs ?? 15_000;

  return new Promise((resolve) => {
    let settled = false;
    const finish = (suggestions: PhraseSuggestion[]) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve(suggestions.filter(isValidSuggestion));
    };
    const timeout = setTimeout(() => finish([]), options.requestTimeoutMs);
    Promise.resolve(generator(input, { count: options.count, now: options.now, ttlMs }))
      .then(finish)
      .catch(() => finish([]));
  });
}

export function buildLyricPrompt(input: LyricSidecarInput, count: number): string {
  return [
    'You are a live performance phrase oracle.',
    '',
    `Generate ${count} short singable phrase fragments.`,
    'Each fragment must be 1 to 6 words.',
    'Do not write a verse.',
    'Do not write a chorus.',
    'Do not explain.',
    'Do not number the lines.',
    'Do not rhyme too obviously.',
    'Prefer image, texture, mood, breath, and atmosphere.',
    '',
    `Current scene: ${input.sceneName || input.presetId}`,
    `Aesthetic tags: ${input.visualTags.join(', ') || 'none'}`,
    `Recent sung words: ${input.recentTranscript || 'none'}`,
    `Recent accepted phrases: ${input.recentAcceptedPhrases.join(', ') || 'none'}`,
    `Avoid phrases like: ${input.recentDismissedPhrases.join(', ') || 'none'}`,
    '',
    'Audio mood:',
    `- intensity: ${input.audioMood.intensity}`,
    `- pitch motion: ${input.audioMood.pitchMotion}`,
    `- brightness: ${input.audioMood.brightness}`,
    `- onset density: ${input.audioMood.onsetDensity}`,
    `- vibrato: ${input.audioMood.vibrato}`,
    '',
    'Return only newline-separated fragments.',
  ].join('\n');
}

function isValidSuggestion(suggestion: PhraseSuggestion): boolean {
  const words = splitWords(suggestion.text);
  return words.length >= 1
    && words.length <= 6
    && !/^\d+\.|verse|chorus/i.test(suggestion.text);
}

function splitWords(value: string): string[] {
  return value.trim().split(/\s+/).filter(Boolean);
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'phrase';
}
