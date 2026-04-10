/**
 * AnthropicProvider - Claude Messages API (/v1/messages)
 *
 * Handles Claude Opus 4, Sonnet 4, Haiku 4 with extended thinking.
 * Key difference: Anthropic is STATELESS — client must store
 * thinking_blocks for multi-turn conversations.
 */

import { Result, ok, err } from 'neverthrow';
import type {
  ProviderRequest,
  ProviderResponse,
  ProviderCapabilities,
  StreamEvent,
  NormalizedThinking,
} from '../ProviderTypes.js';
import { BaseProvider } from './BaseProvider.js';
import { CapabilityRegistry } from '../CapabilityRegistry.js';
import { TIMEOUT_DEFAULT_MS } from '../../constants/limits.js';
import { extractAnthropicThinking } from '../ThinkingNormalizer.js';
import { parseAnthropicStream } from '../StreamParser.js';
import { LLMError } from '../errors.js';

export class AnthropicProvider extends BaseProvider {
  readonly name = 'anthropic';

  get capabilities(): ProviderCapabilities {
    return CapabilityRegistry.getCapabilities(this.config.model);
  }

  async generate(req: ProviderRequest): Promise<Result<ProviderResponse, LLMError>> {
    try {
      const url = `${this.config.baseUrl}/v1/messages`;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
      };
      if (this.config.apiKey) {
        headers['x-api-key'] = this.config.apiKey;
      }

      const body: Record<string, unknown> = {
        model: this.config.model,
        max_tokens: req.maxTokens ?? this.config.maxTokens ?? 4096,
        messages: [
          { role: 'user', content: req.userPrompt },
        ],
      };

      // System prompt goes as top-level field
      if (req.systemPrompt) {
        body.system = req.systemPrompt;
      }

      // Temperature (omit for thinking-enabled requests — Anthropic restriction)
      const thinkingEnabled = req.thinking?.enabled && this.capabilities.thinking;
      if (!thinkingEnabled) {
        body.temperature = req.temperature ?? this.config.temperature;
      }

      // Tool definitions — Anthropic format
      if (req.tools && req.tools.length > 0) {
        body.tools = req.tools.map(t => ({
          name: t.name,
          description: t.description,
          input_schema: t.parameters as Record<string, unknown>,
        }));
      }

      // Tool results from previous calls
      if (req.toolResults && req.toolResults.length > 0) {
        const toolContent: Array<{ type: string; tool_use_id: string; content: string }> = req.toolResults.map(tr => ({
          type: 'tool_result',
          tool_use_id: tr.toolCallId,
          content: tr.result,
        }));
        (body.messages as Array<{ role: string; content: unknown }>).push({
          role: 'assistant',
          content: (req.tools && req.tools.length > 0)
            ? req.toolResults.map(tr => ({ type: 'tool_use' as const, id: tr.toolCallId, name: 'tool', input: {} }))
            : [],
        });
        (body.messages as Array<{ role: string; content: unknown }>).push({
          role: 'user',
          content: toolContent,
        });
      }

      // Extended thinking
      if (thinkingEnabled) {
        body.thinking = {
          type: 'enabled',
          budget_tokens: req.thinking?.budgetTokens || 8000,
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
          `Anthropic API error ${response.status}: ${errorText}`,
          this.name,
          response.status,
          retryable,
        ));
      }

      const data = await response.json();

      // Extract thinking from content blocks
      const thinking: NormalizedThinking | undefined = extractAnthropicThinking(data);
      const contentBlocks = data.content as Array<{ type: string; text?: string; id?: string; name?: string; input?: unknown }> | undefined;
      const textBlocks = contentBlocks?.filter(b => b.type === 'text') || [];
      const content = textBlocks.map(b => b.text || '').join('');

      // Extract tool_use blocks
      const toolUseBlocks = contentBlocks?.filter(b => b.type === 'tool_use') || [];
      const toolCalls = toolUseBlocks.map(b => ({
        id: b.id || '',
        name: b.name || '',
        arguments: typeof b.input === 'string' ? b.input : JSON.stringify(b.input || {}),
      }));
      const finishReason = toolCalls.length > 0 ? 'tool_calls' as const
        : (data.stop_reason === 'end_turn' ? 'stop' as const : 'stop' as const);

      const usage = data.usage as { input_tokens?: number; output_tokens?: number } | undefined;

      return ok({
        content,
        thinking: thinking?.source !== 'none' ? thinking : undefined,
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
      const message = error instanceof Error ? error.message : 'Unknown error';
      return err(new LLMError(message, this.name, undefined, true));
    }
  }

  async *stream(req: ProviderRequest): AsyncGenerator<StreamEvent> {
    const url = `${this.config.baseUrl}/v1/messages`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
    };
    if (this.config.apiKey) {
      headers['x-api-key'] = this.config.apiKey;
    }

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

    const thinkingEnabled = req.thinking?.enabled && this.capabilities.thinking;
    if (!thinkingEnabled) {
      body.temperature = req.temperature ?? this.config.temperature;
    }

    if (thinkingEnabled) {
      body.thinking = {
        type: 'enabled',
        budget_tokens: req.thinking?.budgetTokens || 8000,
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
      yield { type: 'error', error: `Anthropic API error ${response.status}` };
      return;
    }

    if (!response.body) {
      yield { type: 'error', error: 'No response body' };
      return;
    }

    yield* parseAnthropicStream(response.body);
  }
}
