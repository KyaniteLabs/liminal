/**
 * GoogleProvider - Google Gemini API
 *
 * Handles Gemini 2.5 Pro/Flash with thinking mode.
 * Gemini uses a different API format from OpenAI:
 * - Endpoint: /v1beta/models/{model}:generateContent
 * - Auth: API key as query parameter
 * - Thinking: thinkingBudget (token count) or thinkingLevel
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
import { LLMError } from '../errors.js';

export class GoogleProvider extends BaseProvider {
  readonly name = 'google';

  get capabilities(): ProviderCapabilities {
    return CapabilityRegistry.getCapabilities(this.config.model);
  }

  private getBaseUrl(): string {
    // Strip trailing slashes
    let base = this.config.baseUrl.replace(/\/+$/, '');
    // Default to Google's API if not specified
    if (!base.includes('generativelanguage')) {
      base = 'https://generativelanguage.googleapis.com';
    }
    return base;
  }

  async generate(req: ProviderRequest): Promise<Result<ProviderResponse, LLMError>> {
    try {
      const base = this.getBaseUrl();
      const apiKey = this.config.apiKey || '';
      const url = `${base}/v1beta/models/${this.config.model}:generateContent?key=${apiKey}`;

      const generationConfig: Record<string, unknown> = {
        temperature: req.temperature ?? this.config.temperature,
        maxOutputTokens: req.maxTokens ?? this.config.maxTokens,
      };

      const body: Record<string, unknown> = {
        contents: [
          {
            role: 'user',
            parts: [{ text: req.userPrompt }],
          },
        ],
        generationConfig,
      };

      // Add system instruction if provided
      if (req.systemPrompt) {
        body.systemInstruction = {
          parts: [{ text: req.systemPrompt }],
        };
      }

      // Thinking configuration
      if (req.thinking?.enabled && this.capabilities.thinking) {
        if (req.thinking.budgetTokens) {
          generationConfig.thinkingBudget = req.thinking.budgetTokens;
        } else if (req.thinking.effort) {
          generationConfig.thinkingLevel = req.thinking.effort;
        } else {
          generationConfig.thinkingBudget = 8000;
        }
      }

      const signal = req.signal || AbortSignal.timeout(this.config.timeout || TIMEOUT_DEFAULT_MS);

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        const retryable = response.status === 429 || response.status >= 500;
        return err(new LLMError(
          `Google API error ${response.status}: ${errorText}`,
          this.name,
          response.status,
          retryable,
        ));
      }

      const data = await response.json();

      // Extract content from candidates
      const candidates = data.candidates as Array<{
        content?: { parts?: Array<{ text?: string; thought?: boolean }> };
      }> | undefined;

      const parts = candidates?.[0]?.content?.parts || [];
      let content = '';
      let thinkingText = '';

      for (const part of parts) {
        if (part.thought) {
          thinkingText += (part.text || '') + '\n';
        } else {
          content += (part.text || '') + '\n';
        }
      }

      const usageMeta = data.usageMetadata as {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
        thoughtsTokenCount?: number;
      } | undefined;

      return ok({
        content: content.trim(),
        thinking: thinkingText.trim()
          ? { text: thinkingText.trim(), source: 'thinking_blocks', budgetUsed: usageMeta?.thoughtsTokenCount }
          : undefined,
        model: data.modelVersion || this.config.model,
        success: content.trim().length > 0,
        usage: usageMeta ? {
          inputTokens: usageMeta.promptTokenCount || 0,
          outputTokens: usageMeta.candidatesTokenCount || 0,
          thinkingTokens: usageMeta.thoughtsTokenCount,
        } : undefined,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return err(new LLMError(message, this.name, undefined, true));
    }
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async *stream(_req: ProviderRequest): AsyncGenerator<StreamEvent> {
    yield {
      type: 'error',
      error: 'Google Gemini streaming not yet implemented. Use generate() instead.',
    };
  }
}
