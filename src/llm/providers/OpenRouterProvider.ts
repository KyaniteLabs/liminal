/**
 * OpenRouterProvider - OpenRouter API gateway (400+ models)
 *
 * Extends OpenAI provider with OpenRouter-specific features:
 * - Unified reasoning parameter across all models
 * - Extra headers (HTTP-Referer, X-Title)
 * - Reasoning details in responses
 */

import { Result, ok, err } from 'neverthrow';
import type {
  ProviderRequest,
  ProviderResponse,
  ProviderCapabilities,
  StreamEvent,
} from '../ProviderTypes.js';
import { BaseProvider, usesMaxCompletionTokens } from './BaseProvider.js';
import { CapabilityRegistry } from '../CapabilityRegistry.js';
import { TIMEOUT_DEFAULT_MS } from '../../constants/limits.js';
import { extractOpenRouterThinking } from '../ThinkingNormalizer.js';
import { parseOpenAIStream } from '../StreamParser.js';
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

function normalizeOpenRouterContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object') {
          const text = (part as { text?: unknown }).text;
          if (typeof text === 'string') return text;
        }
        return '';
      })
      .filter(Boolean)
      .join('\n');
  }
  if (content && typeof content === 'object') {
    const text = (content as { text?: unknown }).text;
    if (typeof text === 'string') return text;
  }
  return '';
}

function summarizeOpenRouterResponse(data: unknown): string {
  if (!data || typeof data !== 'object') return 'non-object response';
  const record = data as Record<string, unknown>;
  const choices = Array.isArray(record.choices) ? record.choices : [];
  const choice = choices[0] as Record<string, unknown> | undefined;
  const message = choice?.message as Record<string, unknown> | undefined;
  const rawContent = message?.content;
  const contentKind = Array.isArray(rawContent) ? 'array' : typeof rawContent;
  const finishReason = typeof choice?.finish_reason === 'string' ? choice.finish_reason : 'unknown';
  const error = typeof record.error === 'object' ? JSON.stringify(record.error).slice(0, 200) : '';
  return `choices=${choices.length}, finish_reason=${finishReason}, content_kind=${contentKind}, error_field=${error || 'none'}, snippet=${JSON.stringify(rawContent).slice(0, 200)}`;
}

export class OpenRouterProvider extends BaseProvider {
  readonly name = 'openrouter';

  get capabilities(): ProviderCapabilities {
    return CapabilityRegistry.getCapabilities(this.config.model);
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }
    // OpenRouter recommended headers
    headers['HTTP-Referer'] = 'https://liminal.art';
    headers['X-Title'] = 'Liminal';
    return headers;
  }

  async generate(req: ProviderRequest): Promise<Result<ProviderResponse, LLMError>> {
    try {
      const url = `${this.config.baseUrl}/chat/completions`;
      const headers = this.getHeaders();

      const maxTokensValue = req.maxTokens ?? this.config.maxTokens;
      const body: Record<string, unknown> = {
        model: this.config.model,
        messages: [
          { role: 'system', content: req.systemPrompt },
          { role: 'user', content: buildOpenAIUserContent(req) },
        ],
        temperature: req.temperature ?? this.config.temperature,
      };
      if (maxTokensValue !== undefined) {
        body[usesMaxCompletionTokens(this.config.model) ? 'max_completion_tokens' : 'max_tokens'] = maxTokensValue;
      }

      const jsonOnlyPrompt = /respond with json only/i.test(req.userPrompt);
      if (jsonOnlyPrompt && this.capabilities.jsonMode && !(req.tools && req.tools.length > 0)) {
        body.response_format = { type: 'json_object' };
      }

      // Tool definitions — OpenAI-compatible format
      if (req.tools && req.tools.length > 0) {
        body.tools = req.tools.map(t => ({
          type: 'function' as const,
          function: { name: t.name, description: t.description, parameters: t.parameters as Record<string, unknown> },
        }));
      }

      // Tool results from previous calls
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

      // OpenRouter unified reasoning parameter
      if (req.thinking?.enabled) {
        body.reasoning = {
          effort: req.thinking.effort || 'high',
        };
      }

      const signal = req.signal || AbortSignal.timeout(this.config.timeout || TIMEOUT_DEFAULT_MS);

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        const retryable = response.status === 429 || response.status >= 500;
        return err(new LLMError(
          `OpenRouter API error ${response.status}: ${errorText}`,
          this.name,
          response.status,
          retryable,
        ));
      }

      const data = await response.json();
      const thinking = extractOpenRouterThinking(data);
      const choices = data.choices as Array<{ message?: { content?: unknown; tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }> }; finish_reason?: string }> | undefined;
      const message = choices?.[0]?.message;
      const content = normalizeOpenRouterContent(message?.content);

      const rawToolCalls = message?.tool_calls || [];
      const toolCalls = rawToolCalls.map(tc => ({ id: tc.id, name: tc.function.name, arguments: tc.function.arguments }));
      const finishReason = toolCalls.length > 0 ? 'tool_calls' as const : 'stop' as const;

      const usage = data.usage as { prompt_tokens?: number; completion_tokens?: number } | undefined;

      const hasContent = content.length > 0 || toolCalls.length > 0;
      if (!hasContent) {
        return ok({
          content,
          thinking: thinking.source !== 'none' ? thinking : undefined,
          model: data.model || this.config.model,
          success: false,
          error: `OpenRouter provider returned no usable content (${summarizeOpenRouterResponse(data)})`,
          toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
          finishReason,
          usage: usage ? {
            inputTokens: usage.prompt_tokens || 0,
            outputTokens: usage.completion_tokens || 0,
          } : undefined,
        });
      }

      return ok({
        content,
        thinking: thinking.source !== 'none' ? thinking : undefined,
        model: data.model || this.config.model,
        success: true,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        finishReason,
        usage: usage ? {
          inputTokens: usage.prompt_tokens || 0,
          outputTokens: usage.completion_tokens || 0,
        } : undefined,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return err(new LLMError(message, this.name, undefined, true));
    }
  }

  async *stream(req: ProviderRequest): AsyncGenerator<StreamEvent> {
    const url = `${this.config.baseUrl}/chat/completions`;
    const headers = this.getHeaders();

    const maxTokensValueStream = req.maxTokens ?? this.config.maxTokens;
    const body: Record<string, unknown> = {
      model: this.config.model,
      messages: [
        { role: 'system', content: req.systemPrompt },
        { role: 'user', content: req.userPrompt },
      ],
      temperature: req.temperature ?? this.config.temperature,
      stream: true,
    };
    if (maxTokensValueStream !== undefined) {
      body[usesMaxCompletionTokens(this.config.model) ? 'max_completion_tokens' : 'max_tokens'] = maxTokensValueStream;
    }

    if (req.thinking?.enabled) {
      body.reasoning = {
        effort: req.thinking.effort || 'high',
      };
    }

    const signal = req.signal || AbortSignal.timeout(this.config.timeout || TIMEOUT_DEFAULT_MS);

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      yield { type: 'error', error: `OpenRouter API error ${response.status}` };
      return;
    }

    if (!response.body) {
      yield { type: 'error', error: 'No response body' };
      return;
    }

    // OpenRouter uses standard SSE with extra reasoning fields
    yield* parseOpenAIStream(response.body);
  }
}
