import {
  buildLyricSidecarPrompt,
  createMockPhraseGenerator,
  isValidPhraseFragment,
  type LyricSidecarInput,
  type PhraseGenerator,
  type PhraseSuggestion,
} from './Teleprompter';

export type LyricSidecarBackend = 'mock' | 'openai-compatible' | 'off';

export interface LyricSidecarConfig {
  backend: LyricSidecarBackend;
  model: string;
  endpoint: string;
  source: PhraseSuggestion['source'];
  disabled: boolean;
}

const DEFAULT_LOCAL_ENDPOINT = 'http://127.0.0.1:1234/v1';
const DEFAULT_LOCAL_MODEL = 'LFM2.5-350M';

export function readLyricSidecarConfig(search: string): LyricSidecarConfig {
  const params = new URLSearchParams(search);
  const backend = parseBackend(params.get('lyricBackend') ?? params.get('sidecar') ?? 'mock');
  const model = params.get('lyricModel') ?? DEFAULT_LOCAL_MODEL;
  const endpoint = params.get('lyricEndpoint') ?? DEFAULT_LOCAL_ENDPOINT;
  return {
    backend,
    model,
    endpoint,
    source: sourceForBackend(backend, model),
    disabled: backend === 'off',
  };
}

export function createLyricSidecarGenerator(config: LyricSidecarConfig): PhraseGenerator {
  if (config.backend === 'openai-compatible') return createOpenAICompatiblePhraseGenerator(config);
  return createMockPhraseGenerator();
}

export function createOpenAICompatiblePhraseGenerator(config: Pick<LyricSidecarConfig, 'endpoint' | 'model'>): PhraseGenerator {
  return {
    async generate(input: LyricSidecarInput, options: { count: number }) {
      const response = await fetch(new URL('chat/completions', withTrailingSlash(config.endpoint)), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: config.model,
          messages: [
            { role: 'system', content: 'Return only short live-performance phrase fragments.' },
            { role: 'user', content: buildLyricSidecarPrompt(input, options.count) },
          ],
          temperature: 0.8,
          max_tokens: 24,
          stream: false,
        }),
      });
      if (!response.ok) throw new Error(`lyric sidecar failed: ${response.status}`);
      const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
      const content = payload.choices?.[0]?.message?.content ?? '';
      return content
        .split(/\r?\n/)
        .map((line) => line.replace(/^[-*\d.)\s]+/, '').trim())
        .filter(isValidPhraseFragment)
        .slice(0, options.count);
    },
  };
}

function parseBackend(value: string): LyricSidecarBackend {
  if (value === 'openai-compatible' || value === 'mock' || value === 'off') return value;
  return 'mock';
}

function sourceForBackend(backend: LyricSidecarBackend, model: string): PhraseSuggestion['source'] {
  if (backend !== 'openai-compatible') return 'mock';
  if (model.includes('1.2B')) return 'lfm2_5_1_2b';
  if (model.includes('350M')) return 'lfm2_5_350m';
  return 'openai_compatible';
}

function withTrailingSlash(value: string): string {
  return value.endsWith('/') ? value : `${value}/`;
}
