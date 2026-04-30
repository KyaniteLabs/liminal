/**
 * MiniMaxProvider - MiniMax API (M2.7, M2.5, Text-01)
 *
 * Dual-mode provider supporting both API compatibility modes:
 *   1. OpenAI-compatible: api.minimax.io/v1 — /chat/completions, reasoning_content
 *   2. Anthropic-compatible: api.minimax.io/anthropic — /v1/messages, native thinking blocks
 *
 * Mode is auto-detected from the baseUrl path:
 *   - Contains "/anthropic" → Anthropic Messages API format
 *   - Otherwise → OpenAI chat completions format
 *
 * Key differences between modes:
 *   - Auth: Both use Bearer token (MiniMax does NOT use x-api-key)
 *   - Thinking: OpenAI mode uses reasoning_content; Anthropic mode uses thinking blocks
 *   - Streaming: OpenAI mode uses SSE; Anthropic mode uses Anthropic SSE format
 *
 * @see https://platform.minimax.io/docs/guides/text-ai-coding-tools
 */

import { Result, ok, err } from 'neverthrow';
import type {
  ProviderRequest,
  ProviderResponse,
  ProviderCapabilities,
  StreamEvent,
} from '../ProviderTypes.js';

type ToolCallResult = import('../ProviderTypes.js').ToolCallResult;
import { BaseProvider, usesMaxCompletionTokens } from './BaseProvider.js';
import { CapabilityRegistry } from '../CapabilityRegistry.js';
import { normalizeThinking, extractAnthropicThinking } from '../ThinkingNormalizer.js';
import { parseOpenAIStream, parseAnthropicStream } from '../StreamParser.js';
import { Logger } from '../../utils/Logger.js';
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

function buildAnthropicUserContent(req: ProviderRequest): unknown {
  if (!req.imageInputs || req.imageInputs.length === 0) return req.userPrompt;
  return [
    { type: 'text', text: req.userPrompt },
    ...req.imageInputs.map(image => ({
      type: 'image',
      source: {
        type: 'base64',
        media_type: image.mimeType,
        data: image.dataBase64,
      },
    })),
  ];
}

export class MiniMaxProvider extends BaseProvider {
  readonly name = 'minimax';

  /** True when baseUrl contains "/anthropic" — use Anthropic Messages API format */
  private get isAnthropicMode(): boolean {
    return this.config.baseUrl.toLowerCase().includes('/anthropic');
  }

  get capabilities(): ProviderCapabilities {
    const caps = CapabilityRegistry.getCapabilities(this.config.model);
    // Anthropic-compatible endpoint supports tool calling
    if (this.isAnthropicMode) {
      return { ...caps, toolUse: true };
    }
    return caps;
  }

  async generate(req: ProviderRequest): Promise<Result<ProviderResponse, LLMError>> {
    if (this.isAnthropicMode) {
      return this.generateAnthropic(req);
    }
    return this.generateOpenAI(req);
  }

  async *stream(req: ProviderRequest): AsyncGenerator<StreamEvent> {
    if (this.isAnthropicMode) {
      yield* this.streamAnthropic(req);
    } else {
      yield* this.streamOpenAI(req);
    }
  }

  // ── OpenAI-compatible mode ──

  private async generateOpenAI(req: ProviderRequest): Promise<Result<ProviderResponse, LLMError>> {
    const url = `${this.config.baseUrl}/chat/completions`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.apiKey || ''}`,
    };

    const maxTokensValue = req.maxTokens ?? this.config.maxTokens ?? 4096;
    const body: Record<string, unknown> = {
      model: this.config.model,
      messages: [
        { role: 'system', content: req.systemPrompt },
        { role: 'user', content: buildOpenAIUserContent(req) },
      ],
      temperature: req.temperature ?? this.config.temperature ?? 0.7,
    };
    body[usesMaxCompletionTokens(this.config.model) ? 'max_completion_tokens' : 'max_tokens'] = maxTokensValue;

    // Native tool calling (OpenAI-compatible format)
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

    const signal = req.signal || AbortSignal.timeout(this.config.timeout || 300000);

    Logger.debug('MiniMaxProvider', `Request to ${url} with model ${this.config.model}`);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal,
      });

      if (!response.ok) {
        const httpError = await createLLMHttpError({
          provider: this.name,
          model: this.config.model,
          endpoint: url,
          response,
          label: 'MiniMax API error',
        });
        Logger.error('MiniMaxProvider', httpError.message);
        return err(httpError);
      }

      const data = await response.json();

      // Debug logging for troubleshooting
      if (process.env.MINIMAX_DEBUG) {
        Logger.debug('MiniMaxProvider', `Response: ${JSON.stringify(data, null, 2).slice(0, 500)}`);
      }

      // Extract thinking if present (MiniMax uses reasoning_content format)
      const thinking = normalizeThinking(data, 'openai');

      // Extract content from response
      const choices = data.choices as Array<{
        message?: {
          content?: string;
          reasoning_content?: string;
          tool_calls?: Array<{
            id: string;
            function: { name: string; arguments: string };
          }>;
        };
        finish_reason?: string;
      }> | undefined;

      const choice = choices?.[0];
      let content = choice?.message?.content || '';

      // Parse native tool calls from response
      let toolCalls: ToolCallResult[] | undefined;
      let finishReason: ProviderResponse['finishReason'] = 'stop';

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

      // Fallback: try to extract from reasoning_content if content is empty
      if (!content && choice?.message?.reasoning_content) {
        content = choice.message.reasoning_content;
        Logger.debug('MiniMaxProvider', 'Using reasoning_content as fallback');
      }

      // Check for content in alternative locations
      if (!content && data.output) {
        content = typeof data.output === 'string' ? data.output : data.output?.text || '';
      }

      const usage = data.usage as {
        prompt_tokens?: number;
        completion_tokens?: number;
        total_tokens?: number;
      } | undefined;

      const hasToolCalls = !!(toolCalls && toolCalls.length > 0);
      const success = content.length > 0 || hasToolCalls;

      if (!success) {
        Logger.warn('MiniMaxProvider', `Empty response from model ${this.config.model}. Response: ${JSON.stringify(data).slice(0, 200)}`);
      }

      return ok({
        content,
        thinking: thinking.source !== 'none' ? thinking : undefined,
        model: data.model || this.config.model,
        success,
        usage: usage ? {
          inputTokens: usage.prompt_tokens || 0,
          outputTokens: usage.completion_tokens || 0,
        } : undefined,
        toolCalls,
        finishReason,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      Logger.error('MiniMaxProvider', `Request failed: ${errorMsg}`);
      return err(new LLMError(
        `MiniMax request failed: ${errorMsg}`,
        this.name,
        undefined,
        true,
      ));
    }
  }

  // ── Anthropic-compatible mode ──

  private async generateAnthropic(req: ProviderRequest): Promise<Result<ProviderResponse, LLMError>> {
    // MiniMax Anthropic endpoint: baseUrl already contains /anthropic
    const url = `${this.config.baseUrl}/v1/messages`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.apiKey || ''}`,
    };

    const body: Record<string, unknown> = {
      model: this.config.model,
      max_tokens: req.maxTokens ?? this.config.maxTokens ?? 4096,
      messages: [
        { role: 'user', content: buildAnthropicUserContent(req) },
      ],
    };

    // System prompt as top-level field (Anthropic Messages API convention)
    if (req.systemPrompt) {
      body.system = req.systemPrompt;
    }

    // Temperature — omit when thinking is enabled (Anthropic restriction)
    const caps = CapabilityRegistry.getCapabilities(this.config.model);
    const thinkingEnabled = req.thinking?.enabled && caps.thinking;
    if (!thinkingEnabled) {
      body.temperature = req.temperature ?? this.config.temperature ?? 0.7;
    }

    // Extended thinking
    if (thinkingEnabled) {
      body.thinking = {
        type: 'enabled',
        budget_tokens: req.thinking?.budgetTokens || 8000,
      };
    }

    if (req.tools && req.tools.length > 0) {
      body.tools = req.tools.map(t => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters as Record<string, unknown>,
      }));
    }

    if (req.toolResults && req.toolResults.length > 0) {
      const toolContent = req.toolResults.map(tr => ({
        type: 'tool_result',
        tool_use_id: tr.toolCallId,
        content: tr.result,
      }));
      (body.messages as Array<{ role: string; content: unknown }>).push({
        role: 'assistant',
        content: req.toolResults.map(tr => ({
          type: 'tool_use' as const,
          id: tr.toolCallId,
          name: tr.toolCall?.name || 'tool',
          input: this.parseToolInput(tr.toolCall?.arguments),
        })),
      });
      (body.messages as Array<{ role: string; content: unknown }>).push({
        role: 'user',
        content: toolContent,
      });
    }

    const signal = req.signal || AbortSignal.timeout(this.config.timeout || 300000);

    Logger.debug('MiniMaxProvider', `Anthropic-mode request to ${url} with model ${this.config.model}`);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal,
      });

      if (!response.ok) {
        const httpError = await createLLMHttpError({
          provider: this.name,
          model: this.config.model,
          endpoint: url,
          response,
          label: 'MiniMax Anthropic API error',
        });
        Logger.error('MiniMaxProvider', httpError.message);
        return err(httpError);
      }

      const data = await response.json();

      // Extract thinking from content blocks (same as AnthropicProvider)
      const thinking = extractAnthropicThinking(data);
      const contentBlocks = data.content as Array<{ type: string; text?: string; id?: string; name?: string; input?: unknown }> | undefined;
      const textBlocks = contentBlocks?.filter(b => b.type === 'text') || [];
      const content = textBlocks.map(b => b.text || '').join('');
      const toolUseBlocks = contentBlocks?.filter(b => b.type === 'tool_use') || [];
      const toolCalls = toolUseBlocks.map(b => ({
        id: b.id || '',
        name: b.name || '',
        arguments: typeof b.input === 'string' ? b.input : JSON.stringify(b.input || {}),
      }));
      const finishReason = toolCalls.length > 0 ? 'tool_calls' as const : 'stop' as const;

      const usage = data.usage as { input_tokens?: number; output_tokens?: number } | undefined;

      return ok({
        content,
        thinking: thinking.source !== 'none' ? thinking : undefined,
        model: data.model || this.config.model,
        success: content.length > 0 || toolCalls.length > 0,
        usage: usage ? {
          inputTokens: usage.input_tokens || 0,
          outputTokens: usage.output_tokens || 0,
        } : undefined,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        finishReason,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      Logger.error('MiniMaxProvider', `Anthropic-mode request failed: ${errorMsg}`);
      return err(new LLMError(
        `MiniMax Anthropic request failed: ${errorMsg}`,
        this.name,
        undefined,
        true,
      ));
    }
  }

  private parseToolInput(raw?: string): Record<string, unknown> {
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : {};
    } catch {
      return {};
    }
  }

  // ── Streaming ──

  private async *streamOpenAI(req: ProviderRequest): AsyncGenerator<StreamEvent> {
    const url = `${this.config.baseUrl}/chat/completions`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.apiKey || ''}`,
    };

    const maxTokensValueStream = req.maxTokens ?? this.config.maxTokens ?? 4096;
    const body: Record<string, unknown> = {
      model: this.config.model,
      messages: [
        { role: 'system', content: req.systemPrompt },
        { role: 'user', content: req.userPrompt },
      ],
      temperature: req.temperature ?? this.config.temperature ?? 0.7,
      stream: true,
    };
    body[usesMaxCompletionTokens(this.config.model) ? 'max_completion_tokens' : 'max_tokens'] = maxTokensValueStream;

    const signal = req.signal || AbortSignal.timeout(this.config.timeout || 300000);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal,
      });

      if (!response.ok) {
        yield { type: 'error', error: `MiniMax API error ${response.status}` };
        return;
      }

      if (!response.body) {
        yield { type: 'error', error: 'No response body' };
        return;
      }

      // MiniMax uses standard OpenAI-style SSE streaming
      yield* parseOpenAIStream(response.body);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      yield { type: 'error', error: `MiniMax stream failed: ${errorMsg}` };
    }
  }

  private async *streamAnthropic(req: ProviderRequest): AsyncGenerator<StreamEvent> {
    const url = `${this.config.baseUrl}/v1/messages`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.apiKey || ''}`,
    };

    const body: Record<string, unknown> = {
      model: this.config.model,
      max_tokens: req.maxTokens ?? this.config.maxTokens ?? 4096,
      messages: [
        { role: 'user', content: req.userPrompt },
      ],
      stream: true,
    };

    if (req.systemPrompt) {
      body.system = req.systemPrompt;
    }

    const caps = CapabilityRegistry.getCapabilities(this.config.model);
    const thinkingEnabled = req.thinking?.enabled && caps.thinking;
    if (!thinkingEnabled) {
      body.temperature = req.temperature ?? this.config.temperature ?? 0.7;
    }

    if (thinkingEnabled) {
      body.thinking = {
        type: 'enabled',
        budget_tokens: req.thinking?.budgetTokens || 8000,
      };
    }

    const signal = req.signal || AbortSignal.timeout(this.config.timeout || 300000);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal,
      });

      if (!response.ok) {
        yield { type: 'error', error: `MiniMax Anthropic API error ${response.status}` };
        return;
      }

      if (!response.body) {
        yield { type: 'error', error: 'No response body' };
        return;
      }

      // MiniMax Anthropic mode uses Anthropic SSE format
      yield* parseAnthropicStream(response.body);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      yield { type: 'error', error: `MiniMax Anthropic stream failed: ${errorMsg}` };
    }
  }
}
