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
import { BaseProvider } from './BaseProvider.js';
import { CapabilityRegistry } from '../CapabilityRegistry.js';
import { TIMEOUT_DEFAULT_MS } from '../../constants/limits.js';
import { extractOpenRouterThinking } from '../ThinkingNormalizer.js';
import { parseOpenAIStream } from '../StreamParser.js';
import { LLMError } from '../errors.js';

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

      const body: Record<string, unknown> = {
        model: this.config.model,
        messages: [
          { role: 'system', content: req.systemPrompt },
          { role: 'user', content: req.userPrompt },
        ],
        temperature: req.temperature ?? this.config.temperature,
        max_tokens: req.maxTokens ?? this.config.maxTokens,
      };

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
      const choices = data.choices as Array<{ message?: { content?: string } }> | undefined;
      const content = choices?.[0]?.message?.content || '';

      const usage = data.usage as { prompt_tokens?: number; completion_tokens?: number } | undefined;

      return ok({
        content,
        thinking: thinking.source !== 'none' ? thinking : undefined,
        model: data.model || this.config.model,
        success: content.length > 0,
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
