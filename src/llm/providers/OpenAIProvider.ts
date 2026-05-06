/**
 * OpenAIProvider - OpenAI, LM Studio, and any /v1/chat/completions endpoint
 *
 * Handles GPT-5, o3, o4-mini, GPT-4o, and compatible endpoints
 * like LM Studio, LocalAI, etc.
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
import { normalizeThinking } from '../ThinkingNormalizer.js';
import { parseOpenAIStream } from '../StreamParser.js';
import { createLLMHttpError, LLMError } from '../errors.js';

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

function normalizeMessageContent(content: unknown): string {
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

function summarizeOpenAIResponse(data: unknown): string {
  if (!data || typeof data !== 'object') return 'non-object response';
  const record = data as Record<string, unknown>;
  const choices = Array.isArray(record.choices) ? record.choices : [];
  const choice = choices[0] as Record<string, unknown> | undefined;
  const message = choice?.message as Record<string, unknown> | undefined;
  const rawContent = message?.content;
  const contentKind = Array.isArray(rawContent) ? 'array' : typeof rawContent;
  const finishReason = typeof choice?.finish_reason === 'string' ? choice.finish_reason : 'unknown';
  const reasoningContent = typeof message?.reasoning_content === 'string'
    ? message.reasoning_content.slice(0, 120)
    : typeof record.reasoning_content === 'string'
      ? record.reasoning_content.slice(0, 120)
      : '';
  return `choices=${choices.length}, finish_reason=${finishReason}, content_kind=${contentKind}, reasoning_present=${reasoningContent ? 'yes' : 'no'}, snippet=${JSON.stringify(rawContent).slice(0, 200)}`;
}

export class OpenAIProvider extends BaseProvider {
  readonly name = 'openai';

  get capabilities(): ProviderCapabilities {
    return CapabilityRegistry.getCapabilities(this.config.model);
  }

  async generate(req: ProviderRequest): Promise<Result<ProviderResponse, LLMError>> {
    try {
      const url = `${this.config.baseUrl}/chat/completions`;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (this.config.apiKey) {
        headers['Authorization'] = `Bearer ${this.config.apiKey}`;
      }

      // Kimi Code API requires a coding agent User-Agent
      if (this.config.baseUrl.includes('kimi.com')) {
        headers['User-Agent'] = 'claude-code/1.0';
      }

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

      // Add reasoning effort for thinking-capable models
      if (req.thinking?.enabled && this.capabilities.thinking) {
        if (this.capabilities.thinkingStyle === 'effort_level') {
          body.reasoning_effort = req.thinking.effort || 'medium';
        }
      }

      // Native tool calling (OpenAI function calling format)
      if (req.tools && req.tools.length > 0 && this.capabilities.toolUse) {
        body.tools = req.tools.map(t => ({
          type: 'function',
          function: {
            name: t.name,
            description: t.description,
            parameters: t.parameters,
          },
        }));
      }

      // Inject tool results from previous calls
      if (req.toolResults && req.toolResults.length > 0) {
        const messages = body.messages as Array<Record<string, unknown>>;
        for (const tr of req.toolResults) {
          messages.push({
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
          messages.push({
            role: 'tool',
            tool_call_id: tr.toolCallId,
            content: tr.result,
          });
        }
      }

      const signal = req.signal || AbortSignal.timeout(this.config.timeout || TIMEOUT_DEFAULT_MS);

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal,
      });

      if (!response.ok) {
        return err(await createLLMHttpError({
          provider: this.name,
          model: this.config.model,
          endpoint: url,
          response,
          label: 'OpenAI API error',
        }));
      }

      const data = await response.json();
      const thinking = normalizeThinking(data, 'openai');
      const thinkingText = typeof thinking.text === 'string' ? thinking.text : '';

      const choices = data.choices as Array<{
        message?: {
          content?: unknown;
          reasoning_content?: string;
          tool_calls?: Array<{
            id: string;
            function: { name: string; arguments: string };
          }>;
        };
        finish_reason?: string;
      }> | undefined;
      const choice = choices?.[0];
      const content = normalizeMessageContent(choice?.message?.content);

      const usage = data.usage as { prompt_tokens?: number; completion_tokens?: number } | undefined;

      // Parse native tool calls from response
      let toolCalls: import('../ProviderTypes.js').ToolCallResult[] | undefined;
      let finishReason: import('../ProviderTypes.js').ProviderResponse['finishReason'] = 'stop';

      if (choice?.message?.tool_calls && choice.message.tool_calls.length > 0) {
        toolCalls = choice.message.tool_calls.map(tc => ({
          id: tc.id,
          name: tc.function.name,
          arguments: tc.function.arguments,
        }));
        finishReason = 'tool_calls';
      }

      if (choice?.finish_reason === 'tool_calls') {
        finishReason = 'tool_calls';
      } else if (choice?.finish_reason === 'length') {
        finishReason = 'length';
      }

      const hasToolCalls = !!(toolCalls && toolCalls.length > 0);
      const hasContent = content.length > 0 || hasToolCalls;

      if (!hasContent) {
        return ok({
          content,
          thinking: thinking.source !== 'none' ? { ...thinking, text: thinkingText } : undefined,
          model: data.model || this.config.model,
          success: false,
          error: `OpenAI-compatible provider returned no usable content (${summarizeOpenAIResponse(data)})`,
          usage: usage ? {
            inputTokens: usage.prompt_tokens || 0,
            outputTokens: usage.completion_tokens || 0,
          } : undefined,
          toolCalls,
          finishReason,
        });
      }

      return ok({
        content,
        thinking: thinking.source !== 'none' ? { ...thinking, text: thinkingText } : undefined,
        model: data.model || this.config.model,
        success: hasContent,
        usage: usage ? {
          inputTokens: usage.prompt_tokens || 0,
          outputTokens: usage.completion_tokens || 0,
        } : undefined,
        toolCalls,
        finishReason,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return err(new LLMError(message, this.name, undefined, true, {
        model: this.config.model,
        endpoint: `${this.config.baseUrl}/chat/completions`,
      }));
    }
  }

  async *stream(req: ProviderRequest): AsyncGenerator<StreamEvent> {
    const url = `${this.config.baseUrl}/chat/completions`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    // Kimi Code API requires a coding agent User-Agent
    if (this.config.baseUrl.includes('kimi.com')) {
      headers['User-Agent'] = 'claude-code/1.0';
    }

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

    if (req.thinking?.enabled && this.capabilities.thinking) {
      if (this.capabilities.thinkingStyle === 'effort_level') {
        body.reasoning_effort = req.thinking.effort || 'medium';
      }
    }

    const signal = req.signal || AbortSignal.timeout(this.config.timeout || TIMEOUT_DEFAULT_MS);

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      yield { type: 'error', error: `OpenAI API error ${response.status}` };
      return;
    }

    if (!response.body) {
      yield { type: 'error', error: 'No response body' };
      return;
    }

    yield* parseOpenAIStream(response.body);
  }
}
