/**
 * OpenAIProvider - OpenAI, LM Studio, and any /v1/chat/completions endpoint
 *
 * Handles GPT-5, o3, o4-mini, GPT-4o, and compatible endpoints
 * like LM Studio, LocalAI, etc.
 */

import type {
  ProviderRequest,
  ProviderResponse,
  ProviderCapabilities,
  StreamEvent,
} from '../ProviderTypes.js';
import { BaseProvider } from './BaseProvider.js';
import { CapabilityRegistry } from '../CapabilityRegistry.js';
import { TIMEOUT_DEFAULT_MS } from '../../constants/limits.js';
import { normalizeThinking } from '../ThinkingNormalizer.js';
import { parseOpenAIStream } from '../StreamParser.js';

export class OpenAIProvider extends BaseProvider {
  readonly name = 'openai';

  get capabilities(): ProviderCapabilities {
    return CapabilityRegistry.getCapabilities(this.config.model);
  }

  async generate(req: ProviderRequest): Promise<ProviderResponse> {
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

    const body: Record<string, unknown> = {
      model: this.config.model,
      messages: [
        { role: 'system', content: req.systemPrompt },
        { role: 'user', content: req.userPrompt },
      ],
      temperature: req.temperature ?? this.config.temperature,
      max_tokens: req.maxTokens ?? this.config.maxTokens,
    };

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
      const errorText = await response.text().catch(() => response.statusText);
      return {
        content: '',
        model: this.config.model,
        success: false,
        error: `OpenAI API error ${response.status}: ${errorText}`,
      };
    }

    const data = await response.json();
    const thinking = normalizeThinking(data, 'openai');

    const choices = data.choices as Array<{
      message?: {
        content?: string;
        tool_calls?: Array<{
          id: string;
          function: { name: string; arguments: string };
        }>;
      };
      finish_reason?: string;
    }> | undefined;
    const choice = choices?.[0];
    const content = choice?.message?.content || '';

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

    // Some providers (e.g. MiniMax) return code in reasoning_content with empty content
    const hasToolCalls = !!(toolCalls && toolCalls.length > 0);
    const hasContent = content.length > 0 || (thinking.source !== 'none' && thinking.text.length > 0)
      || hasToolCalls;

    return {
      content,
      thinking: thinking.source !== 'none' ? thinking : undefined,
      model: data.model || this.config.model,
      success: hasContent,
      usage: usage ? {
        inputTokens: usage.prompt_tokens || 0,
        outputTokens: usage.completion_tokens || 0,
      } : undefined,
      toolCalls,
      finishReason,
    };
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
