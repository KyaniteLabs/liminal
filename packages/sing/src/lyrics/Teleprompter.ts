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
  pinned?: boolean;
  dismissed?: boolean;
}

export interface PhraseEvent {
  type: 'suggested' | 'pinned' | 'dismissed' | 'hidden' | 'shown' | 'request_timeout' | 'request_skipped';
  at: number;
  phraseId?: string;
  text?: string;
  reason?: string;
}

export interface LyricSidecarRuntimeConfig {
  suggestionIntervalMs: number;
  maxVisibleSuggestions: number;
  phraseTtlMs: number;
  requestTimeoutMs: number;
}

export interface PhraseGenerator {
  generate(input: LyricSidecarInput, options: { count: number }): Promise<string[]>;
}

export const DEFAULT_LYRIC_RUNTIME_CONFIG: LyricSidecarRuntimeConfig = {
  suggestionIntervalMs: 4000,
  maxVisibleSuggestions: 5,
  phraseTtlMs: 15000,
  requestTimeoutMs: 2500,
};

const MOCK_PHRASES = [
  'blue ash',
  'under the glass moon',
  'stay near the water',
  'hollow violet',
  'soft machine',
  'where the light bends',
  'no shore',
  'sing it back',
  'bright dust',
  'the room is breathing',
];

export function createMockPhraseGenerator(seedPhrases = MOCK_PHRASES): PhraseGenerator {
  let cursor = 0;
  return {
    async generate(input, options) {
      const cleanAvoid = new Set(input.recentDismissedPhrases.map((phrase) => normalizePhrase(phrase)));
      const suggestions: string[] = [];
      let attempts = 0;
      while (suggestions.length < options.count && attempts < seedPhrases.length) {
        const candidate = seedPhrases[cursor % seedPhrases.length] ?? '';
        cursor += 1;
        attempts += 1;
        if (!isValidPhraseFragment(candidate)) continue;
        if (cleanAvoid.has(normalizePhrase(candidate))) continue;
        suggestions.push(candidate);
      }
      return suggestions;
    },
  };
}

export function buildLyricSidecarPrompt(input: LyricSidecarInput, count: number): string {
  return [
    'You are a live performance phrase oracle.',
    `Generate ${count} short singable phrase fragments.`,
    'Each fragment must be 1 to 6 words.',
    'Do not write a verse.',
    'Do not write a chorus.',
    'Do not explain.',
    'Do not number the lines.',
    'Prefer image, texture, mood, breath, and atmosphere.',
    '',
    `Current scene: ${input.sceneName ?? input.presetId}`,
    `Aesthetic tags: ${input.visualTags.join(', ')}`,
    `Recent sung words: ${input.recentTranscript ?? ''}`,
    `Recent accepted phrases: ${input.recentAcceptedPhrases.join(', ')}`,
    `Avoid phrases like: ${input.recentDismissedPhrases.join(', ')}`,
    `Audio mood: intensity ${input.audioMood.intensity}, pitch ${input.audioMood.pitchMotion}, brightness ${input.audioMood.brightness}`,
    '',
    'Return only newline-separated fragments.',
  ].join('\n');
}

export function isValidPhraseFragment(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (/^(verse|chorus|bridge)\b/i.test(trimmed)) return false;
  if (/^\d+[.)]/.test(trimmed)) return false;
  const words = trimmed.split(/\s+/);
  return words.length >= 1 && words.length <= 6;
}

export class PhraseRingBuffer {
  private readonly suggestions: PhraseSuggestion[] = [];

  constructor(
    private readonly capacity = DEFAULT_LYRIC_RUNTIME_CONFIG.maxVisibleSuggestions,
    private readonly ttlMs = DEFAULT_LYRIC_RUNTIME_CONFIG.phraseTtlMs,
  ) {}

  add(texts: string[], now: number, source: PhraseSuggestion['source'] = 'mock'): PhraseSuggestion[] {
    const added = texts
      .filter(isValidPhraseFragment)
      .map((text, index) => ({
        id: `phrase-${Math.round(now)}-${index}-${hashPhrase(text)}`,
        text: text.trim(),
        mode: 'next_phrase' as const,
        source,
        confidence: source === 'mock' ? 0.6 : undefined,
        createdAt: now,
        expiresAt: now + this.ttlMs,
        tags: ['mock', 'performance'],
      }));
    this.suggestions.push(...added);
    this.trim();
    return added;
  }

  visible(now: number): PhraseSuggestion[] {
    return this.suggestions.filter((phrase) => !phrase.dismissed && (phrase.pinned || phrase.expiresAt > now));
  }

  current(now: number): PhraseSuggestion | null {
    return this.visible(now)[0] ?? null;
  }

  pin(id: string): PhraseSuggestion | null {
    const phrase = this.suggestions.find((candidate) => candidate.id === id && !candidate.dismissed);
    if (!phrase) return null;
    phrase.pinned = true;
    phrase.expiresAt = Number.POSITIVE_INFINITY;
    return phrase;
  }

  dismiss(id: string): PhraseSuggestion | null {
    const phrase = this.suggestions.find((candidate) => candidate.id === id);
    if (!phrase) return null;
    phrase.dismissed = true;
    return phrase;
  }

  dismissedTexts(): string[] {
    return this.suggestions.filter((phrase) => phrase.dismissed).map((phrase) => phrase.text);
  }

  acceptedTexts(): string[] {
    return this.suggestions.filter((phrase) => phrase.pinned && !phrase.dismissed).map((phrase) => phrase.text);
  }

  private trim(): void {
    const pinned = this.suggestions.filter((phrase) => phrase.pinned && !phrase.dismissed);
    const active = this.suggestions.filter((phrase) => !phrase.pinned && !phrase.dismissed).slice(-this.capacity);
    this.suggestions.splice(0, this.suggestions.length, ...pinned, ...active);
  }
}

export class PhraseSessionLog {
  private readonly events: PhraseEvent[] = [];

  append(event: PhraseEvent): void {
    this.events.push(event);
  }

  all(): PhraseEvent[] {
    return [...this.events];
  }

  toJsonl(): string {
    return this.events.map((event) => JSON.stringify(event)).join('\n') + (this.events.length ? '\n' : '');
  }

  toBlob(): Blob {
    return new Blob([this.toJsonl()], { type: 'application/x-ndjson' });
  }
}

export class TeleprompterController {
  private hidden = false;
  private requestInFlight = false;

  constructor(
    private readonly generator: PhraseGenerator,
    private readonly buffer: PhraseRingBuffer,
    private readonly log: PhraseSessionLog,
    private readonly config = DEFAULT_LYRIC_RUNTIME_CONFIG,
  ) {}

  isHidden(): boolean {
    return this.hidden;
  }

  hide(now: number): void {
    this.hidden = true;
    this.log.append({ type: 'hidden', at: now });
  }

  show(now: number): void {
    this.hidden = false;
    this.log.append({ type: 'shown', at: now });
  }

  async request(input: LyricSidecarInput, now: number): Promise<PhraseSuggestion[]> {
    if (this.hidden) {
      this.log.append({ type: 'request_skipped', at: now, reason: 'hidden' });
      return [];
    }
    if (this.requestInFlight) {
      this.log.append({ type: 'request_skipped', at: now, reason: 'in-flight' });
      return [];
    }
    this.requestInFlight = true;
    try {
      const result = await requestPhrasesWithTimeout(this.generator, input, this.config);
      if (result.timedOut) {
        this.log.append({ type: 'request_timeout', at: now, reason: `>${this.config.requestTimeoutMs}ms` });
        return [];
      }
      const added = this.buffer.add(result.fragments, now, 'mock');
      for (const phrase of added) {
        this.log.append({ type: 'suggested', at: now, phraseId: phrase.id, text: phrase.text });
      }
      return added;
    } finally {
      this.requestInFlight = false;
    }
  }

  pin(id: string, now: number): PhraseSuggestion | null {
    const phrase = this.buffer.pin(id);
    if (phrase) this.log.append({ type: 'pinned', at: now, phraseId: phrase.id, text: phrase.text });
    return phrase;
  }

  dismiss(id: string, now: number): PhraseSuggestion | null {
    const phrase = this.buffer.dismiss(id);
    if (phrase) this.log.append({ type: 'dismissed', at: now, phraseId: phrase.id, text: phrase.text });
    return phrase;
  }
}

export async function requestPhrasesWithTimeout(
  generator: PhraseGenerator,
  input: LyricSidecarInput,
  config: LyricSidecarRuntimeConfig,
): Promise<{ timedOut: boolean; fragments: string[] }> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<{ timedOut: true; fragments: string[] }>((resolve) => {
    timeoutId = setTimeout(() => resolve({ timedOut: true, fragments: [] }), config.requestTimeoutMs);
  });
  const generated = generator.generate(input, { count: config.maxVisibleSuggestions })
    .then((fragments) => ({ timedOut: false as const, fragments: fragments.filter(isValidPhraseFragment) }));
  const result = await Promise.race([generated, timeout]);
  if (timeoutId) clearTimeout(timeoutId);
  return result;
}

function normalizePhrase(phrase: string): string {
  return phrase.trim().toLowerCase();
}

function hashPhrase(phrase: string): string {
  let hash = 0;
  for (let i = 0; i < phrase.length; i += 1) {
    hash = ((hash << 5) - hash + phrase.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}
