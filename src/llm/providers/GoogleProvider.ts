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
import { createLLMHttpError, LLMError } from '../errors.js';

function buildGeminiUserParts(req: ProviderRequest): Array<Record<string, unknown>> {
  const parts: Array<Record<string, unknown>> = [{ text: req.userPrompt }];
  for (const image of req.imageInputs ?? []) {
    parts.push({
      inlineData: {
        mimeType: image.mimeType,
        data: image.dataBase64,
      },
    });
  }
  return parts;
}

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
      const safeUrl = `${base}/v1beta/models/${this.config.model}:generateContent?key=${apiKey ? '[REDACTED]' : ''}`;

      const generationConfig: Record<string, unknown> = {
        temperature: req.temperature ?? this.config.temperature,
        maxOutputTokens: req.maxTokens ?? this.config.maxTokens,
      };

      const body: Record<string, unknown> = {
        contents: [
          {
            role: 'user',
            parts: buildGeminiUserParts(req),
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

      // Tool definitions — Google Gemini format
      if (req.tools && req.tools.length > 0) {
        body.tools = [{
          functionDeclarations: req.tools.map(t => ({
            name: t.name,
            description: t.description,
            parameters: t.parameters as Record<string, unknown>,
          })),
        }];
      }

      // Tool results from previous calls
      if (req.toolResults && req.toolResults.length > 0) {
        const contents = body.contents as Array<Record<string, unknown>>;
        for (const tr of req.toolResults) {
          const name = tr.toolCall?.name || 'tool';
          contents.push({ role: 'model', parts: [{ functionCall: { name, args: this.parseToolArgs(tr.toolCall?.arguments) } }] });
          contents.push({ role: 'user', parts: [{ functionResponse: { name, response: { result: tr.result } } }] });
        }
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
        return err(await createLLMHttpError({
          provider: this.name,
          model: this.config.model,
          endpoint: safeUrl,
          response,
          label: 'Google API error',
        }));
      }

      const data = await response.json();

      // Extract content from candidates
      const candidates = data.candidates as Array<{
        content?: { parts?: Array<{ text?: string; thought?: boolean }> };
      }> | undefined;

      const parts = candidates?.[0]?.content?.parts || [];
      let content = '';
      let thinkingText = '';
      const toolCalls: Array<{ id: string; name: string; arguments: string }> = [];

      for (const part of parts) {
        if (part.thought) {
          thinkingText += (part.text || '') + '\n';
        } else if ((part as Record<string, unknown>).functionCall) {
          const fc = (part as Record<string, unknown>).functionCall as { name?: string; args?: unknown };
          toolCalls.push({ id: `gc_${toolCalls.length}`, name: fc.name || '', arguments: typeof fc.args === 'string' ? fc.args : JSON.stringify(fc.args || {}) });
        } else {
          content += (part.text || '') + '\n';
        }
      }

      const usageMeta = data.usageMetadata as {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
        thoughtsTokenCount?: number;
      } | undefined;

      const finishReason = toolCalls.length > 0 ? 'tool_calls' as const : 'stop' as const;

      return ok({
        content: content.trim(),
        thinking: thinkingText.trim()
          ? { text: thinkingText.trim(), source: 'thinking_blocks', budgetUsed: usageMeta?.thoughtsTokenCount }
          : undefined,
        model: data.modelVersion || this.config.model,
        success: content.trim().length > 0 || toolCalls.length > 0,
        usage: usageMeta ? {
          inputTokens: usageMeta.promptTokenCount || 0,
          outputTokens: usageMeta.candidatesTokenCount || 0,
          thinkingTokens: usageMeta.thoughtsTokenCount,
        } : undefined,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        finishReason,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return err(new LLMError(message, this.name, undefined, true, {
        model: this.config.model,
        endpoint: `${this.getBaseUrl()}/v1beta/models/${this.config.model}:generateContent?key=${this.config.apiKey ? '[REDACTED]' : ''}`,
      }));
    }
  }

  private parseToolArgs(raw?: string): Record<string, unknown> {
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

  // eslint-disable-next-line @typescript-eslint/require-await
  async *stream(_req: ProviderRequest): AsyncGenerator<StreamEvent> {
    yield {
      type: 'error',
      error: 'Google Gemini streaming not yet implemented. Use generate() instead.',
    };
  }
}
