// ── Config & Response ──

import { LLMError, LLMTimeoutError, LLMAuthError } from './errors.js';
export { LLMError, LLMTimeoutError, LLMRateLimitError, LLMAuthError } from './errors.js';

import { SERVICE_DEFAULTS } from '../constants.js';
import { PromptLibrary } from '../prompts/index.js';
import { RetryManager } from './RetryManager.js';
import { CacheManager } from './CacheManager.js';
import { eventBus, EventTypes } from '../core/EventBus.js';
import { validateUrl, getAllowedHostsFromEnv, SSRFError } from '../security/UrlValidator.js';
import { failureLogger } from '../harness/FailureLogger.js';
import { env } from '../utils/env.js';
import { Logger } from '../utils/Logger.js';
import { Provider } from '../types/providers.js';

// ── Provider system imports ──
import { createProvider } from './ProviderFactory.js';
import { CapabilityRegistry } from './CapabilityRegistry.js';
import { BaseProvider } from './providers/BaseProvider.js';
import type { ProviderRequest, ProviderResponse } from './ProviderTypes.js';

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
   * API style - DEPRECATED, silently ignored.
   * Provider detection is now handled by ProviderFactory.
   * Kept for backward compatibility.
   * @deprecated
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
  /** Raw thinking text from models that output reasoning tags */
  thinking?: string;
  /** True if code was recovered from thinking/reasoning tags */
  recoveredFromThinking?: boolean;
  success: boolean;
  error?: string;
  fromCache?: boolean;
  isComplete?: boolean;
}

/**
 * Universal LLM Client - model agnostic, provider agnostic
 *
 * Works with any OpenAI-compatible endpoint:
 * - Ollama (http://localhost:11434/v1)
 * - LM Studio (http://localhost:1234/v1)
 * - OpenAI (https://api.openai.com/v1)
 * - OpenRouter (https://openrouter.ai/api/v1)
 * - Anthropic (https://api.anthropic.com)
 * - Google Gemini (https://generativelanguage.googleapis.com)
 * - Any other compatible API
 *
 * Delegates to provider instances via ProviderFactory.
 * Philosophy: Clean the output, don't choose the model.
 */
export class LLMClient {
  private config: LLMConfig;
  private cache = new CacheManager({ enabled: true });
  private provider: BaseProvider | null = null;

  constructor(config?: Partial<LLMConfig>) {
    const baseUrl = config?.baseUrl || env('LLM_BASE_URL') || SERVICE_DEFAULTS.LOCAL_LLM_URL;

    this.config = {
      baseUrl,
      apiKey: config?.apiKey ?? env('LLM_API_KEY') ?? process.env.OPENAI_API_KEY,
      model: config?.model || env('LLM_MODEL') || 'qwen2.5-coder-7b-instruct',
      temperature: config?.temperature ?? 0.7,
      maxTokens: config?.maxTokens ?? 4096,
      // apiStyle is deprecated — silently accepted but ignored
      apiStyle: config?.apiStyle,
      endpointPath: config?.endpointPath,
      headers: config?.headers,
      transformRequest: config?.transformRequest,
      parseResponse: config?.parseResponse,
    };
  }

  // ── Provider delegation ──

  /** Get or create the provider instance */
  private getProvider(): BaseProvider {
    if (!this.provider) {
      // SSRF validation on base URL before creating provider
      const allowLocalhost = process.env.LIMINAL_ALLOW_LOCALHOST_LLM !== 'false';
      const allowPrivateIPs = process.env.LIMINAL_ALLOW_PRIVATE_IP_LLM === 'true';
      const allowedHosts = getAllowedHostsFromEnv();

      try {
        validateUrl(this.config.baseUrl, { allowedHosts, allowPrivateIPs, allowLocalhost });
      } catch (err) {
        if (err instanceof SSRFError) {
          throw new LLMError(`SSRF Protection: ${err.message}`, 'llm', undefined, false);
        }
        throw err;
      }

      this.provider = createProvider({
        baseUrl: this.config.baseUrl,
        apiKey: this.config.apiKey,
        model: this.config.model,
        temperature: this.config.temperature,
        maxTokens: this.config.maxTokens,
        timeout: 120000,
        headers: this.config.headers,
      });
    }
    return this.provider;
  }

  /** Detect provider name from baseUrl or model for logging */
  private detectProvider(): string {
    const baseUrl = this.config.baseUrl.toLowerCase();
    const model = this.config.model.toLowerCase();

    if (baseUrl.includes('minimax')) return Provider.MINIMAX;
    if (baseUrl.includes('openai')) return Provider.OPENAI;
    if (baseUrl.includes('anthropic')) return 'anthropic';
    if (baseUrl.includes('localhost:11434')) return Provider.OLLAMA;
    if (baseUrl.includes('localhost:1234') || baseUrl.includes('lmstudio')) return Provider.LMSTUDIO;
    if (model.includes('qwen')) return Provider.LMSTUDIO;
    if (model.includes('llama')) return Provider.OLLAMA;
    if (model.includes('gemma') || model.includes('mistral')) return 'local';

    return 'local';
  }

  // ── Cache management ──

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

  /** Get current config */
  getConfig(): LLMConfig {
    return { ...this.config };
  }

  /**
   * Get config with sensitive fields redacted
   * Safe for logging
   */
  getSafeConfig(): LLMConfig {
    const config = this.getConfig();
    return {
      ...config,
      apiKey: config.apiKey ? '[REDACTED]' : undefined,
    };
  }

  private resolvedModel: string | null = null;

  /** Auto-detect model from LM Studio /v1/models endpoint */
  private async resolveModel(): Promise<string> {
    if (this.resolvedModel) return this.resolvedModel;

    // Only auto-detect for local endpoints (LM Studio, etc.)
    const baseUrl = this.config.baseUrl;
    const isLocal = baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1');

    if (!isLocal) {
      this.resolvedModel = this.config.model;
      return this.resolvedModel;
    }

    try {
      const response = await fetch(`${baseUrl}/models`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json() as { data?: Array<{ id: string }> };
      const models = data.data || [];

      if (models.length > 0) {
        // Use first available model (LM Studio typically has one loaded)
        this.resolvedModel = models[0].id;
        Logger.info('LLMClient', `Auto-detected model: ${this.resolvedModel}`);
        return this.resolvedModel;
      }
    } catch (err) {
      Logger.info('LLMClient', `Auto-detect failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    this.resolvedModel = this.config.model;
    Logger.info('LLMClient', `Using fallback model: ${this.resolvedModel}`);
    return this.resolvedModel;
  }

  /** Sync resolved model back to config and provider */
  private syncResolvedModel(resolvedModel: string): void {
    if (resolvedModel !== this.config.model) {
      this.config.model = resolvedModel;
      // Update provider if already created
      if (this.provider) {
        this.provider.setModel(resolvedModel);
      }
    }
  }

  // ── Core generation ──

  /**
   * Generate code from prompts
   * Universal interface - works with any provider via ProviderFactory
   */
  async generate(systemPrompt: string, userPrompt: string, signal?: AbortSignal, bypassCache?: boolean): Promise<LLMResponse> {
    const llmStartTime = Date.now();

    // Auto-detect model on first use (for local endpoints like LM Studio)
    const resolvedModel = await this.resolveModel();
    this.syncResolvedModel(resolvedModel);

    try {
      // Check cache
      const cached = bypassCache ? null : this.cache.get(systemPrompt, userPrompt);
      if (cached) {
        return { code: cached, success: true, fromCache: true };
      }

      eventBus.emit(EventTypes.LLM_REQUEST, 'LLMClient', {
        provider: this.detectProvider(),
        model: this.config.model,
        promptPreview: userPrompt.slice(0, 100)
      });

      const result = await RetryManager.executeWithRetry(async () => {
        const provider = this.getProvider();
        const req: ProviderRequest = {
          systemPrompt,
          userPrompt,
          temperature: this.config.temperature,
          maxTokens: this.config.maxTokens,
          signal,
        };

        const response = await provider.generate(req);
        return this.mapProviderResponse(response);
      });

      // Write to cache on success
      if (result.success && result.code && !bypassCache) {
        this.cache.set(systemPrompt, userPrompt, result.code);
      }

      eventBus.emit(EventTypes.LLM_RESPONSE, 'LLMClient', {
        provider: this.detectProvider(),
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
        provider: this.detectProvider(),
        model: this.config.model,
        success: false,
        latencyMs: Date.now() - llmStartTime,
        error: errMsg
      });

      // Log failure to Meta-Harness for pattern detection
      failureLogger.log({
        model: this.config.model,
        domain: 'unknown', // Will be determined by caller context
        prompt: userPrompt.slice(0, 500), // Truncate for privacy/size
        error: errMsg,
        errorType: error instanceof LLMTimeoutError ? 'timeout' :
                   error instanceof LLMAuthError ? 'validation' : 'generation',
        duration: Date.now() - llmStartTime,
      });

      return {
        code: `// LLM generation failed: ${errMsg}`,
        success: false,
        error: errMsg,
      };
    }
  }

  async generateP5Sketch(prompt: string, context?: string, signal?: AbortSignal, bypassCache?: boolean): Promise<LLMResponse> {
    // Capability-based prompt adaptation (replaces model-name-based Qwen hack)
    const capabilities = CapabilityRegistry.getCapabilities(this.config.model);

    // Small/local models that lack strong instruction following get simplified prompts
    if (!capabilities.jsonMode || capabilities.maxContextTokens < 8192) {
      const simplifiedSystem = `You are a creative coder. Generate p5.js code.
Rules:
- Output ONLY JavaScript code
- Use function setup() and function draw()
- Include createCanvas()
- NO explanations, NO markdown`;

      const simplifiedUser = `Create a p5.js sketch: ${prompt}${context ? '\nContext: ' + context : ''}`;

      return this.generate(simplifiedSystem, simplifiedUser, signal, bypassCache);
    }

    const rendered = PromptLibrary.render('p5.generate', { prompt, context: context || '' });
    return this.generate(rendered.system, rendered.user, signal, bypassCache);
  }

  async improveP5Sketch(currentCode: string): Promise<LLMResponse> {
    const rendered = PromptLibrary.render('p5.improve', { code: currentCode });
    return this.generate(rendered.system, rendered.user);
  }

  /** Check if LLM is configured */
  static isConfigured(): boolean {
    const hasExplicitConfig = !!(env('LLM_BASE_URL') || process.env.OPENAI_API_KEY || env('LLM_API_KEY'));
    if (hasExplicitConfig) return true;
    // In test environments, don't treat the hardcoded default local URL as configured,
    // otherwise E2E tests try to call a non-existent localhost endpoint and timeout.
    return process.env.NODE_ENV !== 'test' && !!SERVICE_DEFAULTS.LOCAL_LLM_URL;
  }

  /**
   * Raw completion interface for agent/conversation mode
   * Returns raw text response for multi-turn conversations
   */
  async complete(options: {
    prompt: string;
    systemPrompt?: string;
    maxTokens?: number;
    temperature?: number;
    signal?: AbortSignal;
  }): Promise<{ text: string; success: boolean; error?: string }> {
    const {
      prompt,
      systemPrompt = 'You are a helpful assistant.',
      maxTokens = 2000,
      temperature = 0.7,
      signal,
    } = options;

    // Auto-detect model on first use (for local endpoints like LM Studio)
    const resolvedModel = await this.resolveModel();
    this.syncResolvedModel(resolvedModel);

    try {
      const result = await RetryManager.executeWithRetry(async () => {
        const provider = this.getProvider();
        const req: ProviderRequest = {
          systemPrompt,
          userPrompt: prompt,
          temperature,
          maxTokens,
          signal,
        };

        const response = await provider.generate(req);

        if (!response.success) {
          throw new LLMError(
            response.error || 'Provider returned unsuccessful response',
            provider.name,
            undefined,
            false,
          );
        }

        return { text: response.content, success: true as const };
      });

      return result;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      return {
        text: '',
        success: false,
        error: errMsg,
      };
    }
  }

  /**
   * Stream tokens in real-time for chat interfaces
   * Yields partial content as it arrives from the LLM
   */
  async *stream(
    systemPrompt: string,
    userPrompt: string,
    signal?: AbortSignal,
  ): AsyncGenerator<string> {
    // Auto-detect model on first use
    const resolvedModel = await this.resolveModel();
    this.syncResolvedModel(resolvedModel);

    const provider = this.getProvider();
    const req: ProviderRequest = {
      systemPrompt,
      userPrompt,
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens,
      signal,
    };

    const streamGen = provider.stream(req);

    try {
      for await (const event of streamGen) {
        if (event.type === 'content') {
          yield event.content;
        } else if (event.type === 'error') {
          throw new LLMError(event.error, provider.name, undefined, false);
        }
        // 'thinking' and 'done' events are silently consumed
      }
    } finally {
      // AsyncGenerator cleanup is automatic when the loop ends or breaks
    }
  }

  // ── Response mapping ──

  /** Map a ProviderResponse to an LLMResponse with sanitization */
  private mapProviderResponse(response: ProviderResponse): LLMResponse {
    if (!response.success) {
      return {
        code: '',
        success: false,
        error: response.error || 'Provider returned unsuccessful response',
      };
    }

    // Sanitize the content (strip markdown fences, narrative text, think tags)
    const sanitized = sanitizeOutput(response.content);

    return {
      code: sanitized.code,
      explanation: response.content,
      reasoning: response.thinking?.text || undefined,
      thinking: response.thinking?.text || undefined,
      recoveredFromThinking: false,
      success: sanitized.success,
      isComplete: sanitized.isComplete,
    };
  }
}

// ── Shared sanitization utility ──

/**
 * Universal output sanitizer
 * Handles contamination from ANY model: <think/> tags, markdown fences, reasoning text
 * Exported as a standalone function for reuse across the codebase.
 */
export function sanitizeOutput(content: string): { code: string; success: boolean; isComplete: boolean } {
  // Step 1: Strip <think/> tags (Qwen, DeepSeek, etc.)
  let cleanCode = content.replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi, '');

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
  const isComplete = isCodeComplete(cleanCode);

  return {
    code: cleanCode,
    success: cleanCode.length > 0,
    isComplete,
  };
}

/** Check if code is structurally complete */
export function isCodeComplete(code: string): boolean {
  const openBraces = (code.match(/\{/g) || []).length;
  const closeBraces = (code.match(/\}/g) || []).length;
  const openParens = (code.match(/\(/g) || []).length;
  const closeParens = (code.match(/\)/g) || []).length;

  return openBraces === closeBraces && openParens === closeParens;
}
