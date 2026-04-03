/**
 * OllamaProvider - Ollama native API and OpenAI-compatible endpoint
 *
 * Two modes based on config.baseUrl:
 * - URLs ending with /v1 → OpenAI-compatible (/chat/completions)
 * - All others → Ollama native API (/api/generate)
 */

import type {
  ProviderRequest,
  ProviderResponse,
  ProviderCapabilities,
  StreamEvent,
} from '../ProviderTypes.js';
import { BaseProvider } from './BaseProvider.js';
import { CapabilityRegistry } from '../CapabilityRegistry.js';
import { normalizeThinking, stripThinkTags } from '../ThinkingNormalizer.js';
import { parseOllamaStream, parseOpenAIStream } from '../StreamParser.js';

export class OllamaProvider extends BaseProvider {
  readonly name = 'ollama';
  private useOpenAICompat: boolean;

  constructor(config: import('../ProviderTypes.js').ProviderConfig) {
    super(config);
    this.useOpenAICompat = config.baseUrl.endsWith('/v1');
  }

  get capabilities(): ProviderCapabilities {
    return CapabilityRegistry.getCapabilities(this.config.model);
  }

  async generate(req: ProviderRequest): Promise<ProviderResponse> {
    if (this.useOpenAICompat) {
      return this.generateOpenAICompat(req);
    }
    return this.generateNative(req);
  }

  private async generateNative(req: ProviderRequest): Promise<ProviderResponse> {
    const baseUrl = this.config.baseUrl;
    const maxTokens = req.maxTokens ?? this.config.maxTokens ?? 8000;
    const numCtx = Math.min(maxTokens * 2, 32768);

    const body: Record<string, unknown> = {
      model: this.config.model,
      system: req.systemPrompt,
      prompt: req.userPrompt,
      stream: false,
      options: {
        num_predict: maxTokens,
        num_ctx: numCtx,
        temperature: req.temperature ?? this.config.temperature,
      },
    };

    const signal = req.signal || AbortSignal.timeout(120000);

    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      return {
        content: '',
        model: this.config.model,
        success: false,
        error: `Ollama API error ${response.status}`,
      };
    }

    const data = await response.json();
    let content = (data as Record<string, unknown>).response as string || '';
    const thinking = normalizeThinking(data, 'ollama');

    // Fallback: check for <think/> tags in response
    if (thinking.source === 'none' && content.includes('<think')) {
      const stripped = stripThinkTags(content);
      content = stripped.content;
      if (stripped.thinking) {
        return {
          content,
          thinking: { text: stripped.thinking, source: 'think_tags' },
          model: this.config.model,
          success: content.length > 0,
          usage: (data as Record<string, unknown>).eval_count ? {
            inputTokens: ((data as Record<string, unknown>).prompt_eval_count as number) || 0,
            outputTokens: ((data as Record<string, unknown>).eval_count as number) || 0,
          } : undefined,
        };
      }
    }

    return {
      content,
      thinking: thinking.source !== 'none' ? thinking : undefined,
      model: this.config.model,
      success: content.length > 0,
      usage: (data as Record<string, unknown>).eval_count ? {
        inputTokens: ((data as Record<string, unknown>).prompt_eval_count as number) || 0,
        outputTokens: ((data as Record<string, unknown>).eval_count as number) || 0,
      } : undefined,
    };
  }

  private async generateOpenAICompat(req: ProviderRequest): Promise<ProviderResponse> {
    const url = `${this.config.baseUrl}/chat/completions`;

    const body: Record<string, unknown> = {
      model: this.config.model,
      messages: [
        { role: 'system', content: req.systemPrompt },
        { role: 'user', content: req.userPrompt },
      ],
      temperature: req.temperature ?? this.config.temperature,
      max_tokens: req.maxTokens ?? this.config.maxTokens,
    };

    const signal = req.signal || AbortSignal.timeout(300000);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      return {
        content: '',
        model: this.config.model,
        success: false,
        error: `Ollama OpenAI-compat error ${response.status}`,
      };
    }

    const data = await response.json();
    const thinking = normalizeThinking(data, 'openai');
    const choices = (data as Record<string, unknown>).choices as Array<{ message?: { content?: string } }> | undefined;
    const content = choices?.[0]?.message?.content || '';

    return {
      content,
      thinking: thinking.source !== 'none' ? thinking : undefined,
      model: this.config.model,
      success: content.length > 0,
    };
  }

  async *stream(req: ProviderRequest): AsyncGenerator<StreamEvent> {
    if (this.useOpenAICompat) {
      yield* this.streamOpenAICompat(req);
      return;
    }
    yield* this.streamNative(req);
  }

  private async *streamNative(req: ProviderRequest): AsyncGenerator<StreamEvent> {
    const baseUrl = this.config.baseUrl;
    const maxTokens = req.maxTokens ?? this.config.maxTokens ?? 8000;
    const numCtx = Math.min(maxTokens * 2, 32768);

    const body: Record<string, unknown> = {
      model: this.config.model,
      system: req.systemPrompt,
      prompt: req.userPrompt,
      stream: true,
      options: {
        num_predict: maxTokens,
        num_ctx: numCtx,
        temperature: req.temperature ?? this.config.temperature,
      },
    };

    const signal = req.signal || AbortSignal.timeout(120000);

    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      yield { type: 'error', error: `Ollama API error ${response.status}` };
      return;
    }

    if (!response.body) {
      yield { type: 'error', error: 'No response body' };
      return;
    }

    yield* parseOllamaStream(response.body);
  }

  private async *streamOpenAICompat(req: ProviderRequest): AsyncGenerator<StreamEvent> {
    const url = `${this.config.baseUrl}/chat/completions`;

    const body: Record<string, unknown> = {
      model: this.config.model,
      messages: [
        { role: 'system', content: req.systemPrompt },
        { role: 'user', content: req.userPrompt },
      ],
      temperature: req.temperature ?? this.config.temperature,
      max_tokens: req.maxTokens ?? this.config.maxTokens,
      stream: true,
    };

    const signal = req.signal || AbortSignal.timeout(300000);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      yield { type: 'error', error: `Ollama OpenAI-compat error ${response.status}` };
      return;
    }

    if (!response.body) {
      yield { type: 'error', error: 'No response body' };
      return;
    }

    yield* parseOpenAIStream(response.body);
  }
}
