/**
 * OllamaProvider - Ollama native API and OpenAI-compatible endpoint
 *
 * Two modes based on config.baseUrl:
 * - URLs ending with /v1 → OpenAI-compatible (/chat/completions)
 * - All others → Ollama native API (/api/generate)
 */

import { Result, ok, err } from 'neverthrow';
import type {
  ProviderRequest,
  ProviderResponse,
  ProviderCapabilities,
  StreamEvent,
} from '../ProviderTypes.js';
import { BaseProvider } from './BaseProvider.js';
import { CapabilityRegistry } from '../CapabilityRegistry.js';
import { TIMEOUT_DEFAULT_MS, TIMEOUT_OLLAMA_MS } from '../../constants/limits.js';
import { normalizeThinking, stripThinkTags } from '../ThinkingNormalizer.js';
import { parseOllamaStream, parseOpenAIStream } from '../StreamParser.js';
import { LLMError } from '../errors.js';

function buildOpenAIUserContent(req: ProviderRequest): unknown {
  if (!req.imageInputs || req.imageInputs.length === 0) return req.userPrompt;
  return [
    { type: 'text', text: req.userPrompt },
    ...req.imageInputs.map(image => ({
      type: 'image_url',
      image_url: {
        url: `data:${image.mimeType};base64,${image.dataBase64}`,
      },
    })),
  ];
}

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

  async generate(req: ProviderRequest): Promise<Result<ProviderResponse, LLMError>> {
    if (this.useOpenAICompat) {
      return this.generateOpenAICompat(req);
    }
    return this.generateNative(req);
  }

  private async generateNative(req: ProviderRequest): Promise<Result<ProviderResponse, LLMError>> {
    try {
      const baseUrl = this.config.baseUrl;
      const maxTokens = req.maxTokens ?? this.config.maxTokens ?? 8000;
      const numCtx = Math.min(maxTokens * 2, 32768);

      const body: Record<string, unknown> = {
        model: this.config.model,
        system: req.systemPrompt,
        prompt: req.userPrompt,
        stream: false,
        images: req.imageInputs?.map(image => image.dataBase64),
        options: {
          num_predict: maxTokens,
          num_ctx: numCtx,
          temperature: req.temperature ?? this.config.temperature,
        },
      };

      // Tool definitions — Ollama native format
      if (req.tools && req.tools.length > 0) {
        body.tools = req.tools.map(t => ({
          type: 'function' as const,
          function: { name: t.name, description: t.description, parameters: t.parameters as Record<string, unknown> },
        }));
      }

      const signal = req.signal || AbortSignal.timeout(TIMEOUT_OLLAMA_MS);

      const response = await fetch(`${baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal,
      });

      if (!response.ok) {
        const retryable = response.status >= 500;
        return err(new LLMError(
          `Ollama API error ${response.status}`,
          this.name,
          response.status,
          retryable,
        ));
      }

      const data = await response.json();
      let content = (data as Record<string, unknown>).response as string || '';
      const thinking = normalizeThinking(data, 'ollama');

      // Extract tool_calls from Ollama response
      const msgData = (data as Record<string, unknown>).message as { tool_calls?: Array<{ function: { name: string; arguments: string } }> } | undefined;
      const ollamaToolCalls = (msgData?.tool_calls || []).map(tc => ({
        id: `ollama_${Math.random().toString(36).slice(2, 8)}`,
        name: tc.function.name,
        arguments: typeof tc.function.arguments === 'string' ? tc.function.arguments : JSON.stringify(tc.function.arguments),
      }));
      const nativeFinish = ollamaToolCalls.length > 0 ? 'tool_calls' as const : 'stop' as const;

      // Fallback: check for <think/> tags in response
      if (thinking.source === 'none' && content.includes('<think')) {
        const stripped = stripThinkTags(content);
        content = stripped.content;
        if (stripped.thinking) {
          return ok({
            content,
            thinking: { text: stripped.thinking, source: 'think_tags' },
            model: this.config.model,
            success: content.length > 0 || ollamaToolCalls.length > 0,
            usage: (data as Record<string, unknown>).eval_count ? {
              inputTokens: ((data as Record<string, unknown>).prompt_eval_count as number) || 0,
              outputTokens: ((data as Record<string, unknown>).eval_count as number) || 0,
            } : undefined,
            toolCalls: ollamaToolCalls.length > 0 ? ollamaToolCalls : undefined,
            finishReason: nativeFinish,
          });
        }
      }

      return ok({
        content,
        thinking: thinking.source !== 'none' ? thinking : undefined,
        model: this.config.model,
        success: content.length > 0 || ollamaToolCalls.length > 0,
        usage: (data as Record<string, unknown>).eval_count ? {
          inputTokens: ((data as Record<string, unknown>).prompt_eval_count as number) || 0,
          outputTokens: ((data as Record<string, unknown>).eval_count as number) || 0,
        } : undefined,
        toolCalls: ollamaToolCalls.length > 0 ? ollamaToolCalls : undefined,
        finishReason: nativeFinish,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return err(new LLMError(message, this.name, undefined, true));
    }
  }

  private async generateOpenAICompat(req: ProviderRequest): Promise<Result<ProviderResponse, LLMError>> {
    try {
      const url = `${this.config.baseUrl}/chat/completions`;

      const body: Record<string, unknown> = {
        model: this.config.model,
        messages: [
          { role: 'system', content: req.systemPrompt },
          { role: 'user', content: buildOpenAIUserContent(req) },
        ],
        temperature: req.temperature ?? this.config.temperature,
        max_tokens: req.maxTokens ?? this.config.maxTokens,
      };

      // Tool definitions — OpenAI-compatible format
      if (req.tools && req.tools.length > 0) {
        body.tools = req.tools.map(t => ({
          type: 'function' as const,
          function: { name: t.name, description: t.description, parameters: t.parameters as Record<string, unknown> },
        }));
      }
      if (req.toolResults && req.toolResults.length > 0) {
        for (const tr of req.toolResults) {
          (body.messages as Array<Record<string, unknown>>).push({
            role: 'assistant',
            content: '',
            tool_calls: [{
              id: tr.toolCallId,
              type: 'function',
              function: {
                name: tr.toolCall?.name || 'tool',
                arguments: tr.toolCall?.arguments || '{}',
              },
            }],
          });
          (body.messages as Array<Record<string, unknown>>).push({ role: 'tool', content: tr.result, tool_call_id: tr.toolCallId });
        }
      }

      const signal = req.signal || AbortSignal.timeout(TIMEOUT_DEFAULT_MS);

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal,
      });

      if (!response.ok) {
        const retryable = response.status >= 500;
        return err(new LLMError(
          `Ollama OpenAI-compat error ${response.status}`,
          this.name,
          response.status,
          retryable,
        ));
      }

      const data = await response.json();
      const thinking = normalizeThinking(data, 'openai');
      const choices = (data as Record<string, unknown>).choices as Array<{ message?: { content?: string; tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }> }; finish_reason?: string }> | undefined;
      const message = choices?.[0]?.message;
      const content = message?.content || '';

      const compatToolCalls = (message?.tool_calls || []).map(tc => ({ id: tc.id, name: tc.function.name, arguments: tc.function.arguments }));
      const compatFinish = compatToolCalls.length > 0 ? 'tool_calls' as const : 'stop' as const;

      return ok({
        content,
        thinking: thinking.source !== 'none' ? thinking : undefined,
        model: this.config.model,
        success: content.length > 0 || compatToolCalls.length > 0,
        toolCalls: compatToolCalls.length > 0 ? compatToolCalls : undefined,
        finishReason: compatFinish,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return err(new LLMError(message, this.name, undefined, true));
    }
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

    const signal = req.signal || AbortSignal.timeout(TIMEOUT_OLLAMA_MS);

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
