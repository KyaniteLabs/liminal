/**
 * MiniMaxProvider - MiniMax API (M2.7, M2.5, Text-01)
 *
 * MiniMax provides OpenAI-compatible endpoints but has some specific requirements:
 * - Correct base URL: https://api.minimax.io/v1 (International Token Plan) or https://api.minimaxi.com/v1 (Chinese domestic)
 * - Model names: MiniMax-M2.7, MiniMax-M2.5, MiniMax-Text-01
 * - Returns reasoning_content for thinking models
 * - May return empty content if prompt format is incorrect
 *
 * @see https://www.minimaxi.com/document
 */

import type {
  ProviderRequest,
  ProviderResponse,
  ProviderCapabilities,
  StreamEvent,
} from '../ProviderTypes.js';

type ToolCallResult = import('../ProviderTypes.js').ToolCallResult;
import { BaseProvider } from './BaseProvider.js';
import { CapabilityRegistry } from '../CapabilityRegistry.js';
import { normalizeThinking } from '../ThinkingNormalizer.js';
import { parseOpenAIStream } from '../StreamParser.js';
import { Logger } from '../../utils/Logger.js';

export class MiniMaxProvider extends BaseProvider {
  readonly name = 'minimax';

  get capabilities(): ProviderCapabilities {
    return CapabilityRegistry.getCapabilities(this.config.model);
  }

  async generate(req: ProviderRequest): Promise<ProviderResponse> {
    const url = `${this.config.baseUrl}/chat/completions`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.apiKey || ''}`,
    };

    const body: Record<string, unknown> = {
      model: this.config.model,
      messages: [
        { role: 'system', content: req.systemPrompt },
        { role: 'user', content: req.userPrompt },
      ],
      temperature: req.temperature ?? this.config.temperature ?? 0.7,
      max_tokens: req.maxTokens ?? this.config.maxTokens ?? 4096,
    };

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
        const errorText = await response.text().catch(() => response.statusText);
        Logger.error('MiniMaxProvider', `API error ${response.status}: ${errorText}`);
        return {
          content: '',
          model: this.config.model,
          success: false,
          error: `MiniMax API error ${response.status}: ${errorText}`,
        };
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

      return {
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
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      Logger.error('MiniMaxProvider', `Request failed: ${errorMsg}`);
      return {
        content: '',
        model: this.config.model,
        success: false,
        error: `MiniMax request failed: ${errorMsg}`,
        finishReason: 'error',
      };
    }
  }

  async *stream(req: ProviderRequest): AsyncGenerator<StreamEvent> {
    const url = `${this.config.baseUrl}/chat/completions`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.apiKey || ''}`,
    };

    const body: Record<string, unknown> = {
      model: this.config.model,
      messages: [
        { role: 'system', content: req.systemPrompt },
        { role: 'user', content: req.userPrompt },
      ],
      temperature: req.temperature ?? this.config.temperature ?? 0.7,
      max_tokens: req.maxTokens ?? this.config.maxTokens ?? 4096,
      stream: true,
    };

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
}
