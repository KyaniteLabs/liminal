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
import { validateUrl, getAllowedHostsFromEnv, SSRFError } from '../security/UrlValidator.js';

export interface LLMConfig {
  /** Base URL for the LLM API (OpenAI-compatible) */
  baseUrl: string;
  /** API key (optional for local endpoints) */
  apiKey?: string;
  /** Model name to use */
  model: string;
  /** Temperature for generation (0-2) */
  temperature?: number;
  /** Maximum tokens to generate */
  maxTokens?: number;
  /** 
   * API style - affects request/response format
   * - 'openai': Standard OpenAI chat completions (/chat/completions)
   * - 'ollama': Ollama native API (/api/generate)
   * - 'anthropic': Anthropic Claude API (/v1/messages)
   * Auto-detected from baseUrl if not specified
   */
  apiStyle?: 'openai' | 'ollama' | 'anthropic';
  /** 
   * Custom endpoint path (overrides defaults)
   * e.g., '/v1/chat/completions', '/api/generate'
   */
  endpointPath?: string;
  /** Custom headers to add to requests */
  headers?: Record<string, string>;
  /** 
   * Custom request body transformation
   * Allows adapting to any provider's specific requirements
   */
  transformRequest?: (body: unknown) => unknown;
  /** 
   * Custom response parsing
   * Allows extracting content from any provider's response format
   */
  parseResponse?: (data: unknown) => { content: string; reasoning?: string } | null;
}

export interface LLMResponse {
  code: string;
  explanation?: string;
  reasoning?: string;
  success: boolean;
  error?: string;
  fromCache?: boolean;
  isComplete?: boolean;
}

function env(key: string): string | undefined {
  return process.env[`LIMINAL_${key}`];
}

/**
 * Universal LLM Client - model agnostic, provider agnostic
 * 
 * Works with any OpenAI-compatible endpoint:
 * - Ollama (http://localhost:11434/v1)
 * - LM Studio (http://localhost:1234/v1)
 * - OpenAI (https://api.openai.com/v1)
 * - OpenRouter (https://openrouter.ai/api/v1)
 * - Any other compatible API
 * 
 * Philosophy: Clean the output, don't choose the model.
 */
export class LLMClient {
  private config: LLMConfig;
  private cache = new CacheManager({ enabled: true });

  constructor(config?: Partial<LLMConfig>) {
    const baseUrl = config?.baseUrl || env('LLM_BASE_URL') || SERVICE_DEFAULTS.LOCAL_LLM_URL;
    
    this.config = {
      baseUrl,
      apiKey: config?.apiKey ?? env('LLM_API_KEY') ?? process.env.OPENAI_API_KEY,
      model: config?.model || env('LLM_MODEL') || 'qwen2.5-coder-7b-instruct',
      temperature: config?.temperature ?? 0.7,
      maxTokens: config?.maxTokens ?? 4096,  // Default 4K for local models (prevents OOM on 8GB GPUs)
      apiStyle: config?.apiStyle || this.detectApiStyle(baseUrl),
      endpointPath: config?.endpointPath,
      headers: config?.headers,
      transformRequest: config?.transformRequest,
      parseResponse: config?.parseResponse,
    };
  }

  /** Detect API style from baseUrl */
  private detectApiStyle(baseUrl: string): 'openai' | 'ollama' {
    // Ollama's native API is at /api/generate, not /v1/chat/completions
    // But Ollama also has OpenAI-compatible mode at /v1
    // If URL ends with /v1, use OpenAI style
    if (baseUrl.endsWith('/v1')) {
      return 'openai';
    }
    // Otherwise assume Ollama native
    return 'ollama';
  }

  /** Enable response caching */
  enableCache(options?: { ttlMs?: number; maxEntries?: number }): void {
    this.cache = new CacheManager({ enabled: true, ...options });
  }

  /** Clear the LLM response cache */
  clearCache(): void {
    this.cache = new CacheManager({ enabled: false });
    this.enableCache();
  }

  /** Disable caching entirely */
  disableCache(): void {
    this.cache = new CacheManager({ enabled: false });
  }

  /** Get cache statistics */
  getCacheStats(): { size: number; enabled: boolean } {
    return {
      size: (this.cache as any).cache?.size ?? 0,
      enabled: (this.cache as any).options?.enabled ?? true
    };
  }

  /**
   * Generate code from prompts
   * Universal interface - works with any OpenAI-compatible endpoint
   */
  async generate(systemPrompt: string, userPrompt: string, signal?: AbortSignal, bypassCache?: boolean): Promise<LLMResponse> {
    const llmStartTime = Date.now();
    try {
      // Check cache
      const cached = bypassCache ? null : this.cache.get(systemPrompt, userPrompt);
      if (cached) {
        return { code: cached, success: true, fromCache: true };
      }

      eventBus.emit(EventTypes.LLM_REQUEST, 'LLMClient', { 
        model: this.config.model, 
        promptPreview: userPrompt.slice(0, 100) 
      });

      const result = await RetryManager.executeWithRetry(async () => {
        if (this.config.apiStyle === 'ollama') {
          return await this.callOllama(systemPrompt, userPrompt, signal);
        }
        return await this.callOpenAICompatible(systemPrompt, userPrompt, signal);
      });

      // Write to cache on success
      if (result.success && result.code && !bypassCache) {
        this.cache.set(systemPrompt, userPrompt, result.code);
      }

      eventBus.emit(EventTypes.LLM_RESPONSE, 'LLMClient', { 
        model: this.config.model, 
        success: true, 
        latencyMs: Date.now() - llmStartTime 
      });

      return result;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      const isRetryable = error instanceof LLMError && error.retryable;
      console.error('LLMClient.generate failed:', errMsg, isRetryable ? '(retryable, retries exhausted)' : '');
      eventBus.emit(EventTypes.LLM_RESPONSE, 'LLMClient', { 
        model: this.config.model, 
        success: false, 
        latencyMs: Date.now() - llmStartTime, 
        error: errMsg 
      });
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

  async improveP5Sketch(currentCode: string): Promise<LLMResponse> {
    const rendered = PromptLibrary.render('p5.improve', { code: currentCode });
    return this.generate(rendered.system, rendered.user);
  }

  /** Universal response parser - handles any model's quirks */
  private parseResponse(data: unknown): LLMResponse {
    // Handle different response shapes
    const response = data as Record<string, unknown>;
    
    // OpenAI-compatible format
    const choices = response.choices as Array<{ message?: { content?: string; reasoning_content?: string } }> | undefined;
    if (choices && choices[0]?.message) {
      const message = choices[0].message;
      return this.sanitizeOutput(message.content || '', message.reasoning_content);
    }
    
    // Ollama format
    const ollamaResponse = response.response as string | undefined;
    if (ollamaResponse !== undefined) {
      return this.sanitizeOutput(ollamaResponse);
    }
    
    // Fallback: try to find content anywhere in response
    const anyContent = JSON.stringify(response).match(/"content"\s*:\s*"([^"]*)"/)?.[1];
    if (anyContent) {
      return this.sanitizeOutput(anyContent);
    }
    
    return {
      code: '',
      success: false,
      error: 'Unable to parse LLM response',
    };
  }

  /**
   * Universal output sanitizer
   * Handles contamination from ANY model: <think> tags, markdown fences, reasoning text
   */
  private sanitizeOutput(content: string, reasoning?: string): LLMResponse {
    // Step 1: Strip <think> tags (Qwen, DeepSeek, etc.)
    let cleanCode = content.replace(/<think>[\s\S]*?<\/think>/gi, '');
    
    // Step 2: Extract code from markdown fences
    const markdownMatch = cleanCode.match(/```(?:\w+)?\n([\s\S]*?)```/);
    if (markdownMatch) {
      cleanCode = markdownMatch[1].trim();
    }
    
    // Step 3: Strip leading narrative text
    const lines = cleanCode.split('\n');
    const codeStartPatterns = [
      /^(let|const|var|function|class|if|for|while|import|export|return|precision|void|vec|uniform)\b/,
      /^<!DOCTYPE/i,
      /^<html/i,
      /^<script/i,
      /^\$/,
      /^osc\(|^src\(|^render\(/,
    ];
    
    let codeStartIndex = 0;
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (!trimmed) continue;
      
      if (codeStartPatterns.some(p => p.test(trimmed))) {
        codeStartIndex = i;
        break;
      }
      
      // Skip narrative lines
      if (/^(Here|I'll|Let me|This|The user)/i.test(trimmed)) {
        codeStartIndex = i + 1;
      }
    }
    
    cleanCode = lines.slice(codeStartIndex).join('\n').trim();
    
    // Step 4: Validate code completeness
    const isComplete = this.isCodeComplete(cleanCode);
    
    return {
      code: cleanCode,
      explanation: content,
      reasoning,
      success: cleanCode.length > 0,
      isComplete,
    };
  }

  /** Check if code is structurally complete */
  private isCodeComplete(code: string): boolean {
    const openBraces = (code.match(/\{/g) || []).length;
    const closeBraces = (code.match(/\}/g) || []).length;
    const openParens = (code.match(/\(/g) || []).length;
    const closeParens = (code.match(/\)/g) || []).length;
    
    return openBraces === closeBraces && openParens === closeParens;
  }

  /** Call OpenAI-compatible endpoint */
  private async callOpenAICompatible(system: string, user: string, signal?: AbortSignal): Promise<LLMResponse> {
    const baseUrl = this.config.baseUrl;
    
    // SSRF Protection
    const allowLocalhost = process.env.LIMINAL_ALLOW_LOCALHOST_LLM !== 'false';
    const allowPrivateIPs = process.env.LIMINAL_ALLOW_PRIVATE_IP_LLM === 'true';
    const allowedHosts = getAllowedHostsFromEnv();
    
    try {
      validateUrl(baseUrl, { allowedHosts, allowPrivateIPs, allowLocalhost });
    } catch (err) {
      if (err instanceof SSRFError) {
        throw new LLMError(`SSRF Protection: ${err.message}`, 'llm', undefined, false);
      }
      throw err;
    }
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }
    
    // Create timeout signal if none provided (300 second default for Ollama)
    // Local models need more time than cloud APIs
    const timeoutMs = 300000;
    const timeoutSignal = signal || AbortSignal.timeout(timeoutMs);
    
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: this.config.model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens,
      }),
      signal: timeoutSignal,
    });
    
    if (!response.ok) {
      throw this.classifyHttpError(response.status, response.statusText);
    }
    
    const data = await response.json();
    return this.parseResponse(data);
  }

  /** Call Ollama native API */
  private async callOllama(system: string, user: string, signal?: AbortSignal): Promise<LLMResponse> {
    const baseUrl = this.config.baseUrl;
    
    // SSRF Protection
    const allowLocalhost = process.env.LIMINAL_ALLOW_LOCALHOST_LLM !== 'false';
    const allowPrivateIPs = process.env.LIMINAL_ALLOW_PRIVATE_IP_LLM === 'true';
    const allowedHosts = getAllowedHostsFromEnv();
    
    try {
      validateUrl(baseUrl, { allowedHosts, allowPrivateIPs, allowLocalhost });
    } catch (err) {
      if (err instanceof SSRFError) {
        throw new LLMError(`SSRF Protection: ${err.message}`, 'ollama', undefined, false);
      }
      throw err;
    }
    
    // Create timeout signal if none provided (120 second default)
    const timeoutMs = 120000;
    const timeoutSignal = signal || AbortSignal.timeout(timeoutMs);
    
    // Determine context window based on maxTokens
    // num_ctx must be >= maxTokens + prompt length, so we add buffer
    const maxTokens = this.config.maxTokens ?? 8000;
    const numCtx = Math.min(maxTokens * 2, 32768); // Cap at 32K to avoid OOM on small GPUs
    
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.config.model,
        prompt: `${system}\n\nUser: ${user}\n\nAssistant:`,
        stream: false,
        options: {
          num_predict: maxTokens,     // Max tokens to generate (prevents truncation)
          num_ctx: numCtx,            // Context window size (prevents context overflow)
          temperature: this.config.temperature,
        },
      }),
      signal: timeoutSignal,
    });
    
    if (!response.ok) {
      throw new LLMError(`Ollama API error: ${response.status}`, 'ollama', response.status, response.status >= 500);
    }
    
    const data = await response.json();
    return this.parseResponse(data);
  }

  /** Classify HTTP errors */
  private classifyHttpError(status: number, statusText: string): LLMError {
    if (status === 429) {
      return new LLMRateLimitError('llm', undefined);
    }
    if (status === 401 || status === 403) {
      return new LLMAuthError('llm');
    }
    return new LLMError(`LLM API error: ${status} ${statusText}`, 'llm', status, status >= 500);
  }

  /** Check if LLM is configured */
  static isConfigured(): boolean {
    return !!(env('LLM_BASE_URL') || process.env.OPENAI_API_KEY || env('LLM_API_KEY'));
  }
}
