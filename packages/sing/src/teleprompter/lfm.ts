import {
  buildLyricPrompt,
  type PhraseGenerator,
  type PhraseSuggestion,
} from './phrases';

export interface LfmOpenAiSidecarConfig {
  endpoint: string;
  model: string;
  source: 'lfm2_5_350m' | 'lfm2_5_1_2b';
  requestTimeoutMs: number;
  maxNewTokens: number;
  temperature?: number;
  topP?: number;
  fetchImpl?: typeof fetch;
}

export function createLfmOpenAiPhraseGenerator(config: LfmOpenAiSidecarConfig): PhraseGenerator {
  return async (input, options) => {
    const fetchImpl = config.fetchImpl ?? globalThis.fetch;
    if (!fetchImpl) return [];
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.requestTimeoutMs);
    try {
      const response = await fetchImpl(config.endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model: config.model,
          messages: [
            {
              role: 'system',
              content: 'Return only newline-separated 1 to 6 word singable phrase fragments.',
            },
            {
              role: 'user',
              content: buildLyricPrompt(input, options.count),
            },
          ],
          max_tokens: config.maxNewTokens,
          temperature: config.temperature ?? 0.9,
          top_p: config.topP ?? 0.9,
          stream: false,
        }),
      });
      if (!response.ok) return [];
      const fragments = parseLfmPhraseFragments(extractOpenAiText(await response.text()));
      return fragments.slice(0, options.count).map((text, index): PhraseSuggestion => ({
        id: `${config.source}-${options.now}-${index}-${slug(text)}`,
        text,
        mode: index % 2 === 0 ? 'image_shards' : 'next_phrase',
        source: config.source,
        confidence: 0.78,
        createdAt: options.now,
        expiresAt: options.now + options.ttlMs,
        tags: [...input.visualTags.slice(0, 4), input.audioMood.intensity],
      }));
    } catch {
      return [];
    } finally {
      clearTimeout(timeout);
    }
  };
}

export function parseLfmPhraseFragments(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-*]|\d+[.)])\s*/, '').trim())
    .filter((line) => {
      const words = line.split(/\s+/).filter(Boolean);
      return words.length >= 1 && words.length <= 6 && !/verse|chorus/i.test(line);
    });
}

function extractOpenAiText(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (isRecord(parsed)) {
      const choices = parsed.choices;
      if (Array.isArray(choices) && choices.length > 0 && isRecord(choices[0])) {
        const message = choices[0].message;
        if (isRecord(message) && typeof message.content === 'string') return message.content;
        if (typeof choices[0].text === 'string') return choices[0].text;
      }
      if (typeof parsed.text === 'string') return parsed.text;
      if (Array.isArray(parsed.phrases)) return parsed.phrases.filter((item) => typeof item === 'string').join('\n');
    }
  } catch {
    return raw;
  }
  return raw;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'phrase';
}
