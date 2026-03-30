// ── LLM Error Hierarchy ──

export class LLMError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly statusCode?: number,
    public readonly retryable: boolean = false,
  ) {
    super(message);
    this.name = 'LLMError';
  }
}

export class LLMTimeoutError extends LLMError {
  constructor(provider: string) {
    super(`Timeout calling ${provider} API`, provider, undefined, true);
    this.name = 'LLMTimeoutError';
  }
}

export class LLMRateLimitError extends LLMError {
  constructor(provider: string, retryAfterSeconds?: number) {
    super(`Rate limited by ${provider} API`, provider, 429, true);
    this.name = 'LLMRateLimitError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
  retryAfterSeconds?: number;
}

export class LLMAuthError extends LLMError {
  constructor(provider: string) {
    super(`Authentication failed for ${provider}`, provider, 401, false);
    this.name = 'LLMAuthError';
  }
}

// ── Config & Response ──

import { SERVICE_DEFAULTS } from '../constants.js';
import { PromptLibrary } from '../prompts/index.js';
import { RetryManager } from './RetryManager.js';
import { CacheManager } from './CacheManager.js';
import { eventBus, EventTypes } from '../core/EventBus.js';

export interface LLMConfig {
  provider: 'ollama' | 'openai' | 'minimax' | 'lmstudio' | 'hybrid';
  apiKey?: string;
  baseUrl?: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  costPerToken?: { input?: number; output?: number };
  /** When true, call the reasoning service /reason endpoint to enhance prompts before generation */
  useReasoningTransfer?: boolean;
  /** Base URL for reasoning service (default http://localhost:8000) */
  reasoningBaseUrl?: string;
}

export interface LLMResponse {
  code: string;
  explanation?: string;
  reasoning?: string;
  success: boolean;
  error?: string;
  fromCache?: boolean;  // Track if response was from cache
}

function env(key: string): string | undefined {
  return process.env[`LIMINAL_${key}`];
}

export class LLMClient {
  private config: LLMConfig;
  private cache = new CacheManager({ enabled: true });

  private static readonly COST_ESTIMATES: Record<string, { input: number; output: number }> = {
    openai: { input: 0.00001, output: 0.00003 },
    ollama: { input: 0, output: 0 },
    minimax: { input: 0.000001, output: 0.000002 },
    lmstudio: { input: 0, output: 0 },
  };

  static estimatedCost(provider: string, inputTokens: number = 1000, outputTokens: number = 500): number {
    const rates = this.COST_ESTIMATES[provider] || { input: 0, output: 0 };
    return rates.input * inputTokens + rates.output * outputTokens;
  }

  constructor(config?: Partial<LLMConfig>) {
    this.config = {
      provider: config?.provider || (env('LLM_PROVIDER') as LLMConfig['provider']) || 'lmstudio',
      apiKey: config?.apiKey ?? process.env.MINIMAX_API_KEY ?? env('LLM_API_KEY') ?? process.env.OPENAI_API_KEY,
      baseUrl: config?.baseUrl || env('LLM_BASE_URL'),
      model: config?.model || env('LLM_MODEL') || 'qwen2.5-coder-7b-instruct',
      temperature: config?.temperature ?? 0.7,
      maxTokens: config?.maxTokens ?? 8000,
      useReasoningTransfer: config?.useReasoningTransfer ?? false,
      reasoningBaseUrl: config?.reasoningBaseUrl || env('REASONING_URL') || SERVICE_DEFAULTS.REASONING_URL,
    };
  }

  /** Enable response caching. Disabled by default for single-shot generation. */
  enableCache(options?: { ttlMs?: number; maxEntries?: number }): void {
    this.cache = new CacheManager({ enabled: true, ...options });
  }

  /**
   * Clear the LLM response cache.
   * Useful for forcing fresh generation in iterative contexts like Ralph Loop.
   */
  clearCache(): void {
    this.cache = new CacheManager({ enabled: false });
    this.enableCache();
  }

  /**
   * Disable caching entirely for this LLMClient instance.
   */
  disableCache(): void {
    this.cache = new CacheManager({ enabled: false });
  }

  /**
   * Get cache statistics for debugging.
   */
  getCacheStats(): { size: number; enabled: boolean } {
    return {
      size: (this.cache as any).cache?.size ?? 0,
      enabled: (this.cache as any).options?.enabled ?? true
    };
  }

  /**
   * Generic LLM generation method.
   * Routes to the configured provider (lmstudio, ollama, openai, minimax, hybrid).
   * Used by generateP5Sketch, improveP5Sketch, and domain-specific generators.
   */
  async generate(systemPrompt: string, userPrompt: string, signal?: AbortSignal, bypassCache?: boolean): Promise<LLMResponse> {
    const llmStartTime = Date.now();
    try {

      // Optionally enhance prompt via reasoning transfer
      let enhancedUserPrompt = userPrompt;
      if (this.config.useReasoningTransfer) {
        enhancedUserPrompt = await this.enhanceWithReasoning(userPrompt, systemPrompt);
      }

      // Check cache (only if not bypassing)
      const cached = bypassCache ? null : this.cache.get(systemPrompt, enhancedUserPrompt);
      if (cached) {
        return { code: cached, success: true, fromCache: true };
      }

      eventBus.emit(EventTypes.LLM_REQUEST, 'LLMClient', { provider: this.config.provider, model: this.config.model, promptPreview: enhancedUserPrompt.slice(0, 100) });

      const result = await RetryManager.executeWithRetry(async () => {
        if (this.config.provider === 'ollama') {
          return await this.callOllama(systemPrompt, enhancedUserPrompt, signal);
        } else if (this.config.provider === 'openai') {
          return await this.callOpenAI(systemPrompt, enhancedUserPrompt, signal);
        } else if (this.config.provider === 'minimax') {
          return await this.callMinimax(systemPrompt, enhancedUserPrompt, signal);
        } else if (this.config.provider === 'lmstudio') {
          return await this.callLMStudio(systemPrompt, enhancedUserPrompt, signal);
        } else if (this.config.provider === 'hybrid') {
          return await this.callHybrid(systemPrompt, enhancedUserPrompt, signal);
        } else {
          return { code: '', success: false, error: 'Unknown provider: ' + this.config.provider };
        }
      });

      // Write to cache on success (only if not bypassed)
      if (result.success && result.code && !bypassCache) {
        this.cache.set(systemPrompt, enhancedUserPrompt, result.code);
      }

      eventBus.emit(EventTypes.LLM_RESPONSE, 'LLMClient', { provider: this.config.provider, model: this.config.model, success: true, latencyMs: Date.now() - llmStartTime });

      return result;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      const isRetryable = error instanceof LLMError && error.retryable;
      console.error('LLMClient.generate failed:', errMsg, isRetryable ? '(retryable, retries exhausted)' : '');
      eventBus.emit(EventTypes.LLM_RESPONSE, 'LLMClient', { provider: this.config.provider, model: this.config.model, success: false, latencyMs: Date.now() - llmStartTime, error: errMsg });
      return {
        code: `// LLM generation failed: ${errMsg}`,
        success: false,
        error: errMsg,
      };
    }
  }

  async generateP5Sketch(prompt: string, context?: string, signal?: AbortSignal, bypassCache?: boolean): Promise<LLMResponse> {
    const rendered = PromptLibrary.render('p5.generate', { prompt, context: context || '' });
    return this.generate(rendered.system, rendered.user, signal, bypassCache);
  }

  /**
   * Ask the LLM to improve existing p5.js sketch code.
   */
  async improveP5Sketch(currentCode: string): Promise<LLMResponse> {
    const rendered = PromptLibrary.render('p5.improve', { code: currentCode });
    return this.generate(rendered.system, rendered.user);
  }

  private parseChatCompletionResponse(data: { choices?: Array<{ message?: { content?: string; reasoning_content?: string } }> }): LLMResponse {
    const message = data.choices?.[0]?.message;
    const content = message?.content || '';
    const reasoning = message?.reasoning_content || undefined;

    // Multi-pass code extraction strategy
    let cleanCode = '';

    // Pass 1: Try to extract code from markdown fences (javascript, js, or no language tag)
    const markdownCodeMatch = content.match(/```(?:javascript|js)?\n([\s\S]*?)```/);
    if (markdownCodeMatch) {
      cleanCode = markdownCodeMatch[1].trim();
    } else {
      // Pass 2: Look for code between any markdown fences
      const anyFenceMatch = content.match(/```\n?([\s\S]*?)```/);
      if (anyFenceMatch) {
        cleanCode = anyFenceMatch[1].trim();
      } else {
        // Pass 3: Find first actual code line by looking for code keywords
        const lines = content.split('\n');
        let codeStartIndex = -1;

        // Patterns that indicate actual code (not reasoning)
        const codePatterns = [
          /^(let|const|var|function|class|if|for|while|setup|draw|import|export|return)\b/,
          /^(precision|void|vec[234]|float|int|bool|uniform|attribute|varying)\b/,
          /^<!DOCTYPE html>/i,
          /^<html/i,
          /^<head/i,
          /^<body/i,
          /^<script/i,
        ];

        // Patterns that indicate reasoning/commentary to skip
        const skipPatterns = [
          /^(\/\/\s*)?(The user wants?|I need to|I'll create|I will create|Let me create|Based on|Here's a|This sketch|Creating a|Generating a|I'm going to|The previous|Looking at|To improve|For this|Key elements|I'll write)/i,
          /^[\d.\-\s]+/, // Numbered list items like "1. ", "2. ", "- ", etc.
          /^(Has|Uses|Responds|I'll|I'll create|Maybe|Let me|I should|The code|This will)/i, // Common reasoning phrases
          /^(Sure!|Here is|Below is|This will|I've created|I have created)/i,
          /^As an AI/i,
          /^(Note:|Disclaimer:|Important:)/i,
          /^(This code|This generates?|This creates?)/i,
          /^(\*\*|__).*?(\*\*|__)\s*[:-]/, // bold headings like "**Approach:**"
          /^#{1,3}\s/, // markdown headings
        ];

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          // Check if this line matches code patterns
          const isCode = codePatterns.some(pattern => pattern.test(line));
          if (isCode) {
            codeStartIndex = i;
            break;
          }

          // Skip lines that match reasoning patterns
          const isSkip = skipPatterns.some(pattern => pattern.test(line));
          if (!isSkip) {
            // This might be code - include it
            codeStartIndex = i;
            break;
          }
        }

        if (codeStartIndex >= 0) {
          cleanCode = lines.slice(codeStartIndex).join('\n').trim();
        } else {
          // Fallback: use entire content
          cleanCode = content.trim();
        }
      }
    }

    // Final cleanup: Remove any remaining leading non-code lines
    const finalLines = cleanCode.split('\n');
    let finalCodeStart = 0;
    const finalCodePatterns = [
      /^(let|const|var|function|class|if|for|while|setup|draw|import|export|return)\b/,
      /^(precision|void|vec[234]|float|int|bool|uniform|attribute|varying)\b/,
      /^<!DOCTYPE html>/i,
      /^<html/i,
      /^<head/i,
      /^<body/i,
      /^<script/i,
    ];

    for (let i = 0; i < Math.min(20, finalLines.length); i++) {
      const line = finalLines[i].trim();
      if (finalCodePatterns.some(pattern => pattern.test(line))) {
        finalCodeStart = i;
        break;
      }
    }
    const finalCode = finalCodeStart > 0
      ? finalLines.slice(finalCodeStart).join('\n')
      : cleanCode;

    // Validate code completeness
    if (finalCode && !this.isCodeComplete(finalCode)) {
      console.warn('[LLMClient] Generated code appears incomplete (cutoff mid-function)');
    }

    return {
      code: finalCode,
      explanation: content,
      reasoning,
      success: true,
    };
  }

  /**
   * Validate that code is complete (not cut off mid-function)
   */
  private isCodeComplete(code: string): boolean {
    // Count opening and closing braces
    const openBraces = (code.match(/\{/g) || []).length;
    const closeBraces = (code.match(/\}/g) || []).length;

    // Count opening and closing parentheses
    const openParens = (code.match(/\(/g) || []).length;
    const closeParens = (code.match(/\)/g) || []).length;

    // Count opening and closing brackets
    const openBrackets = (code.match(/\[/g) || []).length;
    const closeBrackets = (code.match(/\]/g) || []).length;

    // Check for common cutoff patterns
    const hasCutoffPattern = /\n\s{0,4}$/m.test(code.slice(-100)); // Ends with whitespace only
    const endsMidFunction = /function\s+\w+\s*\([^)]*\)\s*\{[^}]*$/.test(code.slice(-200));
    const endsMidClass = /class\s+\w+.*\{[^}]*$/.test(code.slice(-200));

    return openBraces === closeBraces &&
           openParens === closeParens &&
           openBrackets === closeBrackets &&
           !hasCutoffPattern &&
           !endsMidFunction &&
           !endsMidClass;
  }

  private async callProvider(
    provider: string,
    defaultBaseUrl: string,
    system: string,
    user: string,
    signal?: AbortSignal
  ): Promise<LLMResponse> {
    const baseUrl = this.config.baseUrl || defaultBaseUrl;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    let response: Response;
    try {
      const requestBody = {
        model: this.config.model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens,
      };

      // Debug: Log request details for LM Studio
      if (provider === 'lmstudio') {
        console.error('[LM Studio Debug] Request URL:', `${baseUrl}/chat/completions`);
        console.error('[LM Studio Debug] Model:', this.config.model);
        console.error('[LM Studio Debug] System prompt length:', system.length);
        console.error('[LM Studio Debug] User prompt length:', user.length);
      }

      response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        signal,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new LLMTimeoutError(provider);
      }
      throw new LLMError(
        `${provider} API request failed: ${err instanceof Error ? err.message : err}`,
        provider,
        undefined,
        false
      );
    }

    if (!response.ok) {
      // Try to get error details from response body
      let errorBody = '';
      try {
        const errorData = await response.json();
        errorBody = JSON.stringify(errorData);
      } catch {
        // If response isn't JSON, try text
        try {
          errorBody = await response.text();
        } catch {
          errorBody = response.statusText;
        }
      }
      console.error(`${provider} API error details:`, errorBody);
      throw this.classifyHttpError(provider, response.status, response.statusText);
    }

    const data = await response.json();
    return this.parseChatCompletionResponse(data);
  }

  private async callOpenAI(system: string, user: string, signal?: AbortSignal): Promise<LLMResponse> {
    return this.callProvider('openai', 'https://api.openai.com/v1', system, user, signal);
  }

  private async callMinimax(system: string, user: string, signal?: AbortSignal): Promise<LLMResponse> {
    return this.callProvider('minimax', SERVICE_DEFAULTS.MINIMAX_URL, system, user, signal);
  }

  private async callLMStudio(system: string, user: string, signal?: AbortSignal): Promise<LLMResponse> {
    return this.callProvider('lmstudio', SERVICE_DEFAULTS.LOCAL_LLM_URL, system, user, signal);
  }

  private async callHybrid(system: string, user: string, signal?: AbortSignal): Promise<LLMResponse> {
    // Try cloud provider (minimax) first, fall back to local (lmstudio)
    try {
      return await this.callMinimax(system, user, signal);
    } catch (cloudError) {
      console.warn('Hybrid: cloud provider failed, falling back to local:', cloudError instanceof Error ? cloudError.message : cloudError);
      return await this.callLMStudio(system, user, signal);
    }
  }

  private async callOllama(system: string, user: string, signal?: AbortSignal): Promise<LLMResponse> {
    const baseUrl = this.config.baseUrl || SERVICE_DEFAULTS.OLLAMA_URL;

    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.config.model,
        prompt: `${system}\n\nUser: ${user}\n\nAssistant:`,
        stream: false,
      }),
      signal,
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`);
    }

    const data = await response.json();
    const code = data.response || '';

    return {
      code: code.trim(),
      success: true,
    };
  }

  /**
   * Call the reasoning service /reason endpoint to enhance a prompt with reasoning transfer.
   * Falls back to the original prompt on any failure (reasoning service is optional).
   */
  private async enhanceWithReasoning(prompt: string, systemPrompt: string): Promise<string> {
    try {
      const response = await fetch(`${this.config.reasoningBaseUrl}/reason`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          domain: 'visual',
          system_prompt: systemPrompt,
        }),
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        console.warn('Reasoning service unavailable:', response.status);
        return prompt;
      }

      const data = await response.json();
      return data.enhanced_prompt || prompt;
    } catch (err) {
      console.warn('[LLMClient] Reasoning transfer failed, using original prompt:', err);
      return prompt;
    }
  }

  /** Classify HTTP errors into specific LLM error types. */
  private classifyHttpError(provider: string, status: number, statusText: string): LLMError {
    if (status === 429) {
      const retryAfter = undefined; // Could parse Retry-After header if available
      return new LLMRateLimitError(provider, retryAfter);
    }
    if (status === 401 || status === 403) {
      return new LLMAuthError(provider);
    }
    return new LLMError(`${provider} API error: ${status} ${statusText}`, provider, status, status >= 500);
  }

  static isConfigured(): boolean {
    const provider = (env('LLM_PROVIDER') || '').toLowerCase();
    // Ollama and LM Studio don't require API keys — they're local
    if (provider === 'ollama' || provider === 'lmstudio') return true;
    return !!(
      process.env.OPENAI_API_KEY ||
      env('LLM_API_KEY') ||
      process.env.MINIMAX_API_KEY ||
      env('LLM_BASE_URL')
    );
  }
}
