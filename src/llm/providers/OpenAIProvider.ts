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

    const signal = req.signal || AbortSignal.timeout(this.config.timeout || 300000);

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

    const choices = data.choices as Array<{ message?: { content?: string } }> | undefined;
    const content = choices?.[0]?.message?.content || '';

    const usage = data.usage as { prompt_tokens?: number; completion_tokens?: number } | undefined;

    return {
      content,
      thinking: thinking.source !== 'none' ? thinking : undefined,
      model: data.model || this.config.model,
      success: content.length > 0,
      usage: usage ? {
        inputTokens: usage.prompt_tokens || 0,
        outputTokens: usage.completion_tokens || 0,
      } : undefined,
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

    const signal = req.signal || AbortSignal.timeout(this.config.timeout || 300000);

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
