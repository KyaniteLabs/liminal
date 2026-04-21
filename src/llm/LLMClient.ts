// ── Config & Response ──

import { LLMError, LLMTimeoutError, LLMAuthError, LLMRateLimitError } from './errors.js';
import { LLMGenerationError } from '../errors/LLMGenerationError.js';
export { LLMError, LLMTimeoutError, LLMRateLimitError, LLMAuthError } from './errors.js';

import { CircuitBreaker } from './CircuitBreaker.js';

import { SERVICE_DEFAULTS } from '../constants.js';
import { PromptLibrary } from '../prompts/index.js';
import { CapabilityRegistry } from './CapabilityRegistry.js';
import { RetryManager } from './RetryManager.js';
import { TIMEOUT_OLLAMA_MS, TRUNCATE_SHORT, TRUNCATE_LONG, TOKEN_LIMIT_XL } from '../constants/limits.js';
import { CacheManager } from './CacheManager.js';
import { eventBus, EventTypes } from '../core/EventBus.js';
import { validateUrl, getAllowedHostsFromEnv, SSRFError } from '../security/UrlValidator.js';
import { failureLogger } from '../harness/FailureLogger.js';
import { env } from '../utils/env.js';
import { Logger } from '../utils/Logger.js';
import { Provider } from '../types/providers.js';

// ── Provider system imports ──
import { createProvider } from './ProviderFactory.js';
import { BaseProvider } from './providers/BaseProvider.js';
import type { ProviderImageInput, ProviderRequest, ProviderResponse } from './ProviderTypes.js';
import type { ModelRole, ResolvedRoleConfig, RoleConfigFile } from '../config/RoleConfig.js';
import { loadRoleConfig, getFallbacks } from '../config/RoleConfig.js';
import { selectApiKeyForEndpoint } from '../config/ProviderKeyResolver.js';

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
   * Optional role — when set, resolves config from RoleConfig system
   * (generator/evaluator/harness). Overrides baseUrl/model/apiKey from
   * role-based configuration if available.
   */
  role?: ModelRole;
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
  /** Trace ID linking to a ReasoningCapture file */
  reasoningTraceId?: string;
  /** Source of thinking extraction (think_tags, narrative, provider_api, none) */
  thinkingSource?: string;
  /** Reasoning quality score 0-1 from ReasoningCapture */
  reasoningQuality?: number;
  /** Pattern types detected in reasoning */
  detectedPatterns?: string[];
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
  private role: ModelRole | undefined;
  /** Cached role config — populated lazily when role is used */
  private static roleConfigs: Record<ModelRole, ResolvedRoleConfig> | null = null;
  /** Cached raw config file — needed for fallback resolution */
  private static roleConfigFile: RoleConfigFile | null = null;
  /** Resolved fallback providers — lazily populated */
  private fallbackProviders: BaseProvider[] | null = null;
  /** Circuit breakers per provider for fault isolation */
  private breakers = new Map<string, CircuitBreaker>();

  private formatFallbackFailure(model: string, error: unknown): string {
    const reason = error instanceof Error ? error.message : String(error);
    return `${model}: ${reason}`;
  }

  private withFallbackDiagnostics(primaryError: unknown, failures: string[]): Error {
    const suffix = failures.length > 0
      ? ` Fallbacks exhausted (${failures.join(' | ')})`
      : '';

    if (primaryError instanceof LLMError) {
      return new LLMError(
        `${primaryError.message}${suffix}`,
        primaryError.provider,
        primaryError.statusCode,
        primaryError.retryable,
      );
    }

    if (primaryError instanceof Error) {
      return new Error(`${primaryError.message}${suffix}`, { cause: primaryError });
    }

    return new Error(`Unknown error${suffix}`);
  }

  private parseToolArguments(raw: string, toolName: string): Record<string, unknown> {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      throw new Error('arguments must be a JSON object');
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`Tool ${toolName} arguments invalid: ${reason}`);
    }
  }

  private extractToolCodeCandidate(args: Record<string, unknown>, toolResult: string): string | null {
    if (typeof args.code !== 'string' || args.code.trim().length === 0) return null;
    try {
      const parsed = JSON.parse(toolResult);
      if (
        parsed &&
        typeof parsed === 'object' &&
        ((parsed as { valid?: unknown }).valid === false ||
          (parsed as { success?: unknown }).success === false ||
          (parsed as { ok?: unknown }).ok === false)
      ) {
        return null;
      }
    } catch {
      if (/\b(error|invalid|failed|failure)\b/i.test(toolResult)) return null;
    }
    return args.code;
  }

  private contentOrToolCodeCandidate(content: string, fallbackCode: string | null): string {
    return content && content.trim().length > 0 ? content : fallbackCode || '';
  }

  constructor(config?: Partial<LLMConfig>) {
    this.role = config?.role;

    // If a role is specified, try to resolve from RoleConfig system
    let roleBaseUrl: string | undefined;
    let roleApiKey: string | undefined;
    let roleModel: string | undefined;
    let roleTemperature: number | undefined;
    let roleMaxTokens: number | undefined;

    if (this.role) {
      const roleCfg = LLMClient.getRoleConfigSync(this.role);
      if (roleCfg) {
        roleBaseUrl = roleCfg.baseUrl;
        roleApiKey = roleCfg.apiKey;
        roleModel = roleCfg.model;
        roleTemperature = roleCfg.temperature;
        roleMaxTokens = roleCfg.maxTokens;
      }
    }

    const baseUrl = config?.baseUrl || roleBaseUrl || env('LLM_BASE_URL') || SERVICE_DEFAULTS.LOCAL_LLM_URL;

    const model = config?.model || roleModel || env('LLM_MODEL') || SERVICE_DEFAULTS.DEFAULT_MODEL;

    this.config = {
      baseUrl,
      apiKey: config?.apiKey ?? roleApiKey ?? selectApiKeyForEndpoint(baseUrl, model, ['LLM_API_KEY']),
      model,
      temperature: config?.temperature ?? roleTemperature ?? 0.7,
      maxTokens: config?.maxTokens ?? roleMaxTokens ?? 4096,
      role: this.role,
      // apiStyle is deprecated — silently accepted but ignored
      apiStyle: config?.apiStyle,
      endpointPath: config?.endpointPath,
      headers: config?.headers,
      transformRequest: config?.transformRequest,
      parseResponse: config?.parseResponse,
    };

    // Dev-mode guard: detect if config has keys this constructor silently drops
    if (process.env.NODE_ENV !== 'production' && config) {
      const knownKeys = new Set(Object.keys(this.config));
      const providedKeys = Object.keys(config) as (keyof LLMConfig)[];
      const dropped = providedKeys.filter(k => !knownKeys.has(k as string));
      if (dropped.length > 0) {
        Logger.warn('LLMClient', `Config properties silently dropped: ${dropped.join(', ')}. Add to LLMConfig or constructor.`);
      }
    }
  }

  /**
   * Resolve role config synchronously (uses cached or env-var-only fallback).
   * Full RoleConfig loading is async, but constructors can't be async.
   * Call `LLMClient.loadRoles()` once at startup to populate the cache.
   */
  private static getRoleConfigSync(role: ModelRole): ResolvedRoleConfig | null {
    if (LLMClient.roleConfigs) {
      return LLMClient.roleConfigs[role] || null;
    }
    // Synchronous env-var fallback for each role
    const envMap: Record<ModelRole, { baseUrl: string[]; model: string[]; apiKey: string[] }> = {
      generator: {
        baseUrl: ['LLM_BASE_URL'],
        model: ['LLM_MODEL'],
        apiKey: ['LLM_API_KEY'],
      },
      evaluator: {
        baseUrl: ['EVALUATOR_BASE_URL', 'LLM_BASE_URL'],
        model: ['EVALUATOR_MODEL', 'LLM_MODEL'],
        apiKey: ['EVALUATOR_API_KEY', 'LLM_API_KEY'],
      },
      harness: {
        baseUrl: ['HARNESS_BASE_URL', 'LLM_BASE_URL'],
        model: ['HARNESS_MODEL', 'LLM_MODEL'],
        apiKey: ['HARNESS_API_KEY', 'LLM_API_KEY'],
      },
      studio: {
        baseUrl: ['STUDIO_BASE_URL', 'HARNESS_BASE_URL', 'LLM_BASE_URL'],
        model: ['STUDIO_MODEL', 'HARNESS_MODEL', 'LLM_MODEL'],
        apiKey: ['STUDIO_API_KEY', 'HARNESS_API_KEY', 'LLM_API_KEY'],
      },
    };
    const sources = envMap[role];
    const baseUrl = sources.baseUrl.map(k => env(k)).find(Boolean);
    const model = sources.model.map(k => env(k)).find(Boolean);
    const apiKey = selectApiKeyForEndpoint(baseUrl || '', model, sources.apiKey);

    if (baseUrl || model) {
      return {
        baseUrl: baseUrl || SERVICE_DEFAULTS.LOCAL_LLM_URL,
        model: model || SERVICE_DEFAULTS.DEFAULT_MODEL,
        apiKey,
        temperature: role === 'generator' ? 0.7 : role === 'evaluator' ? 0.2 : 0.5,
        maxTokens: 4096,
        timeout: TIMEOUT_OLLAMA_MS,
        thinking: { enabled: false },
        streaming: role === 'harness',
      };
    }
    return null;
  }

  /**
   * Load role configs from file (async). Call once at startup.
   * After this, constructors with `role` will use cached file config.
   */
  static async loadRoles(projectDir?: string): Promise<void> {
    try {
      const { configs, rawFile } = await LLMClient.loadRoleConfigWithFile(projectDir);
      // eslint-disable-next-line require-atomic-updates
      LLMClient.roleConfigs = configs;
      // eslint-disable-next-line require-atomic-updates
      LLMClient.roleConfigFile = rawFile;
    } catch (err) {
      Logger.warn('LLMClient', 'Role config loading failed:', err);
      // Role config loading failure is non-fatal — env vars still work
      // eslint-disable-next-line require-atomic-updates
      LLMClient.roleConfigs = null;
      // eslint-disable-next-line require-atomic-updates
      LLMClient.roleConfigFile = null;
    }
  }

  /**
   * Clear global static caches to enable environment isolation.
   * This is essential when running tests with different model configurations
   * to prevent configuration leakage between runs.
   */
  static clearGlobalCache(): void {
    LLMClient.roleConfigs = null;
    LLMClient.roleConfigFile = null;
  }

  /** Get the role this client was configured for */
  getRole(): ModelRole | undefined {
    return this.role;
  }

  // ── Fallback provider chain ──

  /**
   * Load role config and also return the raw file for fallback resolution.
   */
  private static async loadRoleConfigWithFile(
    projectDir?: string,
  ): Promise<{ configs: Record<ModelRole, ResolvedRoleConfig>; rawFile: RoleConfigFile | null }> {
    // Re-use the existing loadRoleConfig for resolved configs.
    // For the raw file, we load it separately here to avoid changing the
    // public API of loadRoleConfig.
    const configs = await loadRoleConfig(projectDir);

    // Load raw file for fallbacks
    let rawFile: RoleConfigFile | null = null;
    try {
      const { readFile } = await import('fs/promises');
      const { join } = await import('path');
      const { homedir } = await import('os');
      const userPath = join(homedir(), '.liminal', 'config.json');
      const content = await readFile(userPath, 'utf-8');
      rawFile = JSON.parse(content) as RoleConfigFile;
    } catch (err) {
      Logger.debug('LLMClient', 'No config file found, fallbacks come from env or are empty:', err);
      // No config file — fallbacks come from env or are empty
    }

    return { configs, rawFile };
  }

  /**
   * Resolve fallback providers for this client's role.
   * Returns cached instances if already resolved.
   */
  private getFallbackProviders(): BaseProvider[] {
    if (this.fallbackProviders) {
      return this.fallbackProviders;
    }

    if (!this.role) {
      this.fallbackProviders = [];
      return this.fallbackProviders;
    }

    const rawFile = LLMClient.roleConfigFile;
    const fallbackConfigs = getFallbacks(this.role, rawFile);

    if (fallbackConfigs.length === 0) {
      this.fallbackProviders = [];
      return this.fallbackProviders;
    }

    this.fallbackProviders = fallbackConfigs.map((cfg) => {
      const providerCfg: import('../llm/ProviderTypes.js').ProviderConfig = {
        baseUrl: cfg.baseUrl,
        apiKey: cfg.apiKey,
        model: cfg.model,
        temperature: cfg.temperature,
        maxTokens: cfg.maxTokens,
        timeout: cfg.timeout,
      };
      Logger.info('LLMClient.fallback', `Registered fallback provider: ${cfg.model} @ ${cfg.baseUrl}`);
      return createProvider(providerCfg);
    });

    return this.fallbackProviders;
  }

  /**
   * Determine if an error is a network/auth issue that warrants fallback.
   * Do NOT fallback on malformed responses — those are prompt/model issues.
   */
  private isFallbackableError(error: unknown): boolean {
    if (error instanceof LLMTimeoutError) return true;
    if (error instanceof LLMAuthError) return true;
    if (error instanceof LLMRateLimitError) return true;
    if (error instanceof LLMError) {
      // Network-level errors (connection refused, DNS failure, etc.)
      const msg = error.message.toLowerCase();
      if (msg.includes('econnrefused') || msg.includes('enotfound') ||
          msg.includes('econnreset') || msg.includes('fetch failed') ||
          msg.includes('network') || msg.includes('socket hang up')) {
        return true;
      }
      // Server errors (5xx)
      if (error.statusCode && error.statusCode >= 500) return true;
    }
    if (error instanceof Error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('econnrefused') || msg.includes('enotfound') ||
          msg.includes('econnreset') || msg.includes('fetch failed') ||
          msg.includes('network') || msg.includes('socket hang up')) {
        return true;
      }
    }
    return false;
  }

  // ── Circuit Breaker integration ──

  /**
   * Get or create circuit breaker for a provider
   */
  private getBreaker(provider: string): CircuitBreaker {
    if (!this.breakers.has(provider)) {
      this.breakers.set(provider, new CircuitBreaker({
        failureThreshold: 5,
        resetTimeoutMs: 30000,
        halfOpenMaxAttempts: 1,
      }));
    }
    return this.breakers.get(provider)!;
  }

  /**
   * Execute LLM call with circuit breaker protection
   * Prevents cascading failures when a provider is down
   */
  private async generateWithBreaker<T>(provider: string, fn: () => Promise<T>): Promise<T> {
    const breaker = this.getBreaker(provider);
    
    if (!breaker.canExecute()) {
      throw new LLMError(
        `Circuit breaker open for provider: ${provider}. Too many recent failures.`,
        provider,
        undefined,
        false
      );
    }

    try {
      const result = await fn();
      breaker.recordSuccess();
      return result;
    } catch (error) {
      breaker.recordFailure();
      throw error;
    }
  }

  // ── Provider delegation ──

  /** Get or create the provider instance (async for DNS-based SSRF validation) */
  private async getProvider(): Promise<BaseProvider> {
    if (!this.provider) {
      // SSRF validation on base URL before creating provider
      // Default: localhost NOT allowed. Set LIMINAL_ALLOW_LOCALHOST_LLM=true to enable.
      const allowLocalhost = process.env.LIMINAL_ALLOW_LOCALHOST_LLM === 'true';
      const allowPrivateIPs = process.env.LIMINAL_ALLOW_PRIVATE_IP_LLM === 'true';
      const allowedHosts = getAllowedHostsFromEnv();

      try {
        await validateUrl(this.config.baseUrl, { allowedHosts, allowPrivateIPs, allowLocalhost });
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
        timeout: TIMEOUT_OLLAMA_MS,
        headers: this.config.headers,
      });
    }
    return this.provider;
  }

  /** Detect provider name from baseUrl or model for logging */
  private detectProvider(): string {
    const baseUrl = this.config.baseUrl.toLowerCase();
    const model = this.config.model.toLowerCase();

    if (baseUrl.includes('minimax')) return Provider.MINIMAX; // Matches both api.minimaxi.com and api.minimax.io
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
  private resolveModelPromise: Promise<string> | null = null;

  /** Auto-detect model from LM Studio /v1/models endpoint */
  private async resolveModel(): Promise<string> {
    if (this.resolvedModel) return this.resolvedModel;
    
    // Race-safe lazy initialization: only first caller creates the promise
    if (!this.resolveModelPromise) {
      this.resolveModelPromise = this.doResolveModel();
    }
    
    return this.resolveModelPromise;
  }
  
  private async doResolveModel(): Promise<string> {
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
  async generate(
    systemPrompt: string,
    userPrompt: string,
    signal?: AbortSignal,
    bypassCache?: boolean,
    imageInputs?: ProviderImageInput[],
  ): Promise<LLMResponse> {
    const llmStartTime = Date.now();

    // Auto-detect model on first use (for local endpoints like LM Studio)
    const resolvedModel = await this.resolveModel();
    this.syncResolvedModel(resolvedModel);

    try {
      // Check cache
      const hasImages = !!(imageInputs && imageInputs.length > 0);
      const cached = bypassCache || hasImages ? null : this.cache.get(systemPrompt, userPrompt);
      if (cached) {
        return { code: cached, success: true, fromCache: true };
      }

      eventBus.emit(EventTypes.LLM_REQUEST, 'LLMClient', {
        provider: this.detectProvider(),
        model: this.config.model,
        promptPreview: userPrompt.slice(0, TRUNCATE_SHORT)
      });

      const providerName = this.detectProvider();
      
      const result = await RetryManager.executeWithRetry(async () => {
        return this.generateWithBreaker(providerName, async () => {
          const provider = await this.getProvider();
          const req: ProviderRequest = {
            systemPrompt,
            userPrompt,
            temperature: this.config.temperature,
            maxTokens: this.config.maxTokens,
            signal,
            imageInputs,
          };

        const genResult = await provider.generate(req);
        if (genResult.isErr()) {
          throw genResult.error;
        }
        const response = genResult.value;
        return this.mapProviderResponse(response);
      });
      }).catch(async (primaryError: unknown) => {
        // Only attempt fallbacks on network/auth errors
        if (!this.isFallbackableError(primaryError)) {
          throw primaryError;
        }

        const fallbacks = this.getFallbackProviders();
        if (fallbacks.length === 0) {
          throw primaryError;
        }

        Logger.info('LLMClient.fallback',
          `Primary provider failed (${primaryError instanceof Error ? primaryError.message : 'unknown'}), trying ${fallbacks.length} fallback(s)`);

        const req: ProviderRequest = {
          systemPrompt,
          userPrompt,
          temperature: this.config.temperature,
          maxTokens: this.config.maxTokens,
          signal,
          imageInputs,
        };

        const fallbackFailures: string[] = [];
        for (const fallback of fallbacks) {
          try {
            Logger.info('LLMClient.fallback', `Trying fallback: ${fallback.getModel()}`);
            const fbResult = await fallback.generate(req);
            if (fbResult.isErr()) {
              throw fbResult.error;
            }
            const mapped = this.mapProviderResponse(fbResult.value);
            Logger.info('LLMClient.fallback', `Fallback succeeded: ${fallback.getModel()}`);
            return mapped;
          } catch (fallbackErr) {
            fallbackFailures.push(this.formatFallbackFailure(fallback.getModel(), fallbackErr));
            Logger.info('LLMClient.fallback',
              `Fallback ${fallback.getModel()} failed: ${fallbackErr instanceof Error ? fallbackErr.message : 'unknown'}`);
            continue;
          }
        }

        // All fallbacks exhausted — preserve the primary error and add fallback provenance.
        throw this.withFallbackDiagnostics(primaryError, fallbackFailures);
      });

      // Write to cache on success
      if (result.success && result.code && !bypassCache && !hasImages) {
        this.cache.set(systemPrompt, userPrompt, result.code);
      }

      eventBus.emit(EventTypes.LLM_RESPONSE, 'LLMClient', {
        provider: this.detectProvider(),
        model: this.config.model,
        success: true,
        latencyMs: Date.now() - llmStartTime,
        reasoningTraceId: result.reasoningTraceId,
        thinkingSource: result.thinkingSource,
        reasoningQuality: result.reasoningQuality,
        reasoningLength: result.reasoning?.length ?? result.thinking?.length,
        detectedPatterns: result.detectedPatterns,
        recoveredFromThinking: result.recoveredFromThinking,
      });

      return result;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      const isRetryable = error instanceof LLMError && error.retryable;
      Logger.error('LLMClient', 'LLMClient.generate failed:', errMsg, isRetryable ? '(retryable, retries exhausted)' : '');
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
        prompt: userPrompt.slice(0, TRUNCATE_LONG), // Truncate for privacy/size
        error: errMsg,
        errorType: error instanceof LLMTimeoutError ? 'timeout' :
                   error instanceof LLMAuthError ? 'validation' : 'generation',
        duration: Date.now() - llmStartTime,
      });

      throw new LLMGenerationError(`LLM generation failed: ${errMsg}`, {
        cause: error instanceof Error ? error : undefined,
        model: this.config.model,
        duration: Date.now() - llmStartTime,
      });
    }
  }

  async generateWithImages(
    systemPrompt: string,
    userPrompt: string,
    imageInputs: ProviderImageInput[],
    signal?: AbortSignal,
    bypassCache = true,
  ): Promise<LLMResponse> {
    return this.generate(systemPrompt, userPrompt, signal, bypassCache, imageInputs);
  }

  async generateP5Sketch(prompt: string, context?: string, signal?: AbortSignal, bypassCache?: boolean): Promise<LLMResponse> {
    // Capability-based prompt adaptation (replaces model-name-based Qwen hack)
    const capabilities = CapabilityRegistry.getCapabilities(this.config.model);

    // Small/local models that lack strong instruction following get simplified prompts
    if (!capabilities.jsonMode || capabilities.maxContextTokens < 8192) {
      const simplifiedSystem = `You are a creative coder specializing in p5.js.

<rules>
- Output raw JavaScript only
- Use function setup() and function draw()
- Include createCanvas()
- No markdown fences or explanations
</rules>`;

      const simplifiedUser = [
        '<request>',
        `Create a p5.js sketch: ${prompt}`,
        '</request>',
        context ? `<context>\n${context}\n</context>` : '',
      ].filter(Boolean).join('\n');

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
    const hasExplicitConfig = !!(env('LLM_BASE_URL') || process.env.OPENAI_API_KEY || env('LLM_API_KEY') || process.env.MINIMAX_API_KEY);
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
      maxTokens = TOKEN_LIMIT_XL,
      temperature = 0.7,
      signal,
    } = options;

    // Auto-detect model on first use (for local endpoints like LM Studio)
    const resolvedModel = await this.resolveModel();
    this.syncResolvedModel(resolvedModel);

    const startTime = Date.now();

    try {
      eventBus.emit(EventTypes.LLM_REQUEST, 'LLMClient', {
        provider: this.detectProvider(),
        model: this.config.model,
        method: 'complete',
        promptPreview: systemPrompt?.slice(0, 100),
      });

      const result = await RetryManager.executeWithRetry(async () => {
        const provider = await this.getProvider();
        const req: ProviderRequest = {
          systemPrompt,
          userPrompt: prompt,
          temperature,
          maxTokens,
          signal,
        };

        const genResult = await provider.generate(req);
        if (genResult.isErr()) {
          throw genResult.error;
        }
        const response = genResult.value;

        if (!response.success) {
          throw new LLMError(
            response.error || 'Provider returned unsuccessful response',
            provider.name,
            undefined,
            false,
          );
        }

        return { text: response.content, success: true as const };
      }).catch(async (primaryError: unknown) => {
        if (!this.isFallbackableError(primaryError)) {
          throw primaryError;
        }

        const fallbacks = this.getFallbackProviders();
        if (fallbacks.length === 0) {
          throw primaryError;
        }

        Logger.info('LLMClient.fallback',
          `complete(): primary failed, trying ${fallbacks.length} fallback(s)`);

        const req: ProviderRequest = {
          systemPrompt,
          userPrompt: prompt,
          temperature,
          maxTokens,
          signal,
        };

        const fallbackFailures: string[] = [];
        for (const fallback of fallbacks) {
          try {
            Logger.info('LLMClient.fallback', `complete() trying fallback: ${fallback.getModel()}`);
            const fbResult = await fallback.generate(req);
            if (fbResult.isErr()) {
              throw fbResult.error;
            }
            if (fbResult.value.success) {
              Logger.info('LLMClient.fallback', `complete() fallback succeeded: ${fallback.getModel()}`);
              return { text: fbResult.value.content, success: true as const };
            }
          } catch (err) {
            fallbackFailures.push(this.formatFallbackFailure(fallback.getModel(), err));
            Logger.debug('LLMClient', 'Fallback provider failed in complete():', err);
            continue;
          }
        }

        throw this.withFallbackDiagnostics(primaryError, fallbackFailures);
      });

      eventBus.emit(EventTypes.LLM_RESPONSE, 'LLMClient', {
        provider: this.detectProvider(),
        model: this.config.model,
        method: 'complete',
        success: true,
        duration: Date.now() - startTime,
      });

      return result;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      eventBus.emit(EventTypes.LLM_RESPONSE, 'LLMClient', {
        provider: this.detectProvider(),
        model: this.config.model,
        method: 'complete',
        success: false,
        duration: Date.now() - startTime,
        error: errMsg,
      });
      return {
        text: '',
        success: false,
        error: errMsg,
      };
    }
  }

  /**
   * Generate with native tool calling support.
   * Returns structured tool calls instead of JSON-in-text parsing.
   */
  async generateWithTools(options: {
    systemPrompt: string;
    userPrompt: string;
    tools: import('./ProviderTypes.js').ToolDefinition[];
    toolResults?: import('./ProviderTypes.js').ToolResultMessage[];
    maxTokens?: number;
    temperature?: number;
    signal?: AbortSignal;
  }): Promise<{
    content: string;
    toolCalls?: import('./ProviderTypes.js').ToolCallResult[];
    finishReason?: string;
    success: boolean;
    error?: string;
  }> {
    const resolvedModel = await this.resolveModel();
    this.syncResolvedModel(resolvedModel);

    try {
      const provider = await this.getProvider();

      // Only use native tools if the provider supports them
      if (!provider.supportsToolUse()) {
        // Fall back to text-based tool calling
        const result = await this.complete({
          prompt: options.userPrompt,
          systemPrompt: options.systemPrompt,
          maxTokens: options.maxTokens,
          temperature: options.temperature,
          signal: options.signal,
        });
        return {
          content: result.text,
          success: result.success,
          error: result.error,
          finishReason: 'stop',
        };
      }

      const req: ProviderRequest = {
        systemPrompt: options.systemPrompt,
        userPrompt: options.userPrompt,
        tools: options.tools,
        toolResults: options.toolResults,
        temperature: options.temperature ?? this.config.temperature,
        maxTokens: options.maxTokens ?? this.config.maxTokens,
        signal: options.signal,
      };

      const genResult = await provider.generate(req);
      if (genResult.isErr()) {
        throw genResult.error;
      }
      const response = genResult.value;

      return {
        content: response.content,
        toolCalls: response.toolCalls,
        finishReason: response.finishReason,
        success: response.success,
        error: response.error,
      };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      return {
        content: '',
        success: false,
        error: errMsg,
        finishReason: 'error',
      };
    }
  }

  /**
   * Agentic tool-calling loop. Calls generateWithTools() in a cycle:
   * generate -> if tool calls, execute them -> feed results back -> repeat.
   * Stops when the model returns content (no tool calls) or max iterations reached.
   */
  async generateWithToolLoop(options: {
    systemPrompt: string;
    userPrompt: string;
    tools: import('./ProviderTypes.js').ToolDefinition[];
    toolExecutor: (name: string, args: Record<string, unknown>) => Promise<string>;
    maxIterations?: number;
    maxTokens?: number;
    temperature?: number;
    signal?: AbortSignal;
  }): Promise<{
    content: string;
    iterations: number;
    toolCallsMade: number;
    success: boolean;
    error?: string;
  }> {
    const maxIterations = options.maxIterations ?? 5;
    let toolResults: import('./ProviderTypes.js').ToolResultMessage[] | undefined;
    let iterations = 0;
    let toolCallsMade = 0;
    let lastToolCodeCandidate: string | null = null;

    for (let i = 0; i < maxIterations; i++) {
      iterations++;
      const result = await this.generateWithTools({
        systemPrompt: options.systemPrompt,
        userPrompt: i === 0 ? options.userPrompt : `Tool results received. Continue generating the artifact for: ${options.userPrompt}`,
        tools: options.tools,
        toolResults,
        maxTokens: options.maxTokens,
        temperature: options.temperature,
        signal: options.signal,
      });

      if (!result.success) {
        return {
          content: this.contentOrToolCodeCandidate(result.content || '', lastToolCodeCandidate),
          iterations,
          toolCallsMade,
          success: false,
          error: result.error,
        };
      }
      if (!result.toolCalls || result.toolCalls.length === 0 || result.finishReason === 'stop') {
        return {
          content: this.contentOrToolCodeCandidate(result.content, lastToolCodeCandidate),
          iterations,
          toolCallsMade,
          success: true,
        };
      }

      toolResults = [];
      for (const tc of result.toolCalls) {
        toolCallsMade++;

        // Coding-agent convention: models like Kimi K2-Plus return generated code
        // via a 'submit_code' tool call instead of message content. Extract directly.
        if (tc.name === 'submit_code') {
          try {
            const args = JSON.parse(tc.arguments);
            if (typeof args.code === 'string' && args.code.length > 0) {
              return { content: args.code, iterations, toolCallsMade, success: true };
            }
          } catch { /* fall through to normal tool execution */ }
        }

        try {
          const args = this.parseToolArguments(tc.arguments, tc.name);
          const toolResult = await options.toolExecutor(tc.name, args);
          lastToolCodeCandidate = this.extractToolCodeCandidate(args, toolResult) ?? lastToolCodeCandidate;
          toolResults.push({ toolCallId: tc.id, result: toolResult, toolCall: tc });
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          toolResults.push({ toolCallId: tc.id, result: errMsg, isError: true, toolCall: tc });
        }
      }
    }

    const lastResult = await this.generateWithTools({
      systemPrompt: options.systemPrompt,
      userPrompt: `Tool calls completed. Now output the final artifact for: ${options.userPrompt}`,
      tools: [],
      maxTokens: options.maxTokens,
      temperature: options.temperature,
      signal: options.signal,
    });
    return {
      content: this.contentOrToolCodeCandidate(lastResult.content || '', lastToolCodeCandidate),
      iterations,
      toolCallsMade,
      success: lastResult.success || !!lastToolCodeCandidate,
      error: lastToolCodeCandidate ? undefined : 'Max iterations reached',
    };
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

    const provider = await this.getProvider();
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
    } catch (primaryError: unknown) {
      if (!this.isFallbackableError(primaryError)) {
        throw primaryError;
      }

      const fallbacks = this.getFallbackProviders();
      if (fallbacks.length === 0) {
        throw primaryError;
      }

      Logger.info('LLMClient.fallback',
        `stream(): primary failed, trying ${fallbacks.length} fallback(s)`);

      for (const fallback of fallbacks) {
        try {
          Logger.info('LLMClient.fallback', `stream() trying fallback: ${fallback.getModel()}`);
          const fallbackGen = fallback.stream(req);
          for await (const event of fallbackGen) {
            if (event.type === 'content') {
              yield event.content;
            } else if (event.type === 'error') {
              break; // Try next fallback
            }
          }
          Logger.info('LLMClient.fallback', `stream() fallback succeeded: ${fallback.getModel()}`);
          return;
        } catch (err) {
          Logger.debug('LLMClient', 'Fallback provider failed in stream():', err);
          continue;
        }
      }

      // All fallbacks exhausted
      throw primaryError;
    }
  }

  /**
   * Stream tokens with thinking events included
   * Yields tagged events so callers can distinguish thinking from content
   */
  async *streamWithThinking(
    systemPrompt: string,
    userPrompt: string,
    signal?: AbortSignal,
    maxTokens?: number,
  ): AsyncGenerator<{ type: 'thinking' | 'content'; content: string }> {
    // Auto-detect model on first use
    const resolvedModel = await this.resolveModel();
    this.syncResolvedModel(resolvedModel);

    const startTime = Date.now();

    eventBus.emit(EventTypes.LLM_REQUEST, 'LLMClient', {
      provider: this.detectProvider(),
      model: this.config.model,
      method: 'streamWithThinking',
      promptPreview: userPrompt.slice(0, 100),
    });

    const provider = await this.getProvider();
    const req: ProviderRequest = {
      systemPrompt,
      userPrompt,
      temperature: this.config.temperature,
      maxTokens: maxTokens ?? this.config.maxTokens,
      signal,
    };

    const streamGen = provider.stream(req);

    try {
      for await (const event of streamGen) {
        if (event.type === 'thinking') {
          yield { type: 'thinking' as const, content: event.content };
        } else if (event.type === 'content') {
          yield { type: 'content' as const, content: event.content };
        } else if (event.type === 'error') {
          throw new LLMError(event.error, provider.name, undefined, false);
        }
        // 'done' events are silently consumed
      }

      eventBus.emit(EventTypes.LLM_RESPONSE, 'LLMClient', {
        provider: this.detectProvider(),
        model: this.config.model,
        method: 'streamWithThinking',
        success: true,
        duration: Date.now() - startTime,
      });
    } catch (primaryError: unknown) {
      if (!this.isFallbackableError(primaryError)) {
        throw primaryError;
      }

      const fallbacks = this.getFallbackProviders();
      if (fallbacks.length === 0) {
        throw primaryError;
      }

      Logger.info('LLMClient.fallback',
        `streamWithThinking(): primary failed, trying ${fallbacks.length} fallback(s)`);

      for (const fallback of fallbacks) {
        try {
          Logger.info('LLMClient.fallback', `streamWithThinking() trying fallback: ${fallback.getModel()}`);
          const fallbackGen = fallback.stream(req);
          for await (const event of fallbackGen) {
            if (event.type === 'thinking') {
              yield { type: 'thinking' as const, content: event.content };
            } else if (event.type === 'content') {
              yield { type: 'content' as const, content: event.content };
            } else if (event.type === 'error') {
              break; // Try next fallback
            }
          }
          Logger.info('LLMClient.fallback', `streamWithThinking() fallback succeeded: ${fallback.getModel()}`);
          return;
        } catch (err) {
          Logger.debug('LLMClient', 'Fallback provider failed in streamWithThinking():', err);
          continue;
        }
      }

      // All fallbacks exhausted
      eventBus.emit(EventTypes.LLM_RESPONSE, 'LLMClient', {
        provider: this.detectProvider(),
        model: this.config.model,
        method: 'streamWithThinking',
        success: false,
        duration: Date.now() - startTime,
        error: primaryError instanceof Error ? primaryError.message : 'Unknown error',
      });
      throw primaryError;
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
    const { sanitized, extractedReasoning } = sanitizeOutputWithReasoning(response.content);

    // Prefer explicit thinking field (Ollama, Anthropic), fall back to extracted narrative
    const thinking = response.thinking?.text || extractedReasoning || undefined;

    // If main content is empty but thinking/reasoning contains code, recover from it.
    // This handles providers like MiniMax that may return code in reasoning_content
    // or wrap the entire response in <think> tags.
    let code = sanitized.code;
    let recoveredFromThinking = false;
    let isComplete = sanitized.isComplete;
    if (!code && thinking) {
      const recovered = sanitizeOutputWithReasoning(thinking);
      if (recovered.sanitized.code) {
        code = recovered.sanitized.code;
        recoveredFromThinking = true;
        isComplete = recovered.sanitized.isComplete;
      }
    }

    return {
      code,
      explanation: response.content,
      reasoning: thinking,
      thinking,
      recoveredFromThinking,
      success: code.length > 0,
      isComplete,
    };
  }
}

// ── Shared sanitization utility ──

/**
 * sanitizeOutputWithReasoning — like sanitizeOutput but also extracts
 * the narrative/reasoning text that gets stripped before code.
 * For providers (LM Studio, etc.) that don't expose reasoning_content
 * separately but mix reasoning into the content body.
 */
export function sanitizeOutputWithReasoning(content: string): {
  sanitized: { code: string; success: boolean; isComplete: boolean };
  extractedReasoning: string;
} {
  // Step 1: Extract <think/> tags first (some models do emit them)
  const thinkPattern = /<think\b[^>]*>([\s\S]*?)<\/think>/gi;
  let tagReasoning = '';
  let cleanCode = content;
  const thinkMatches = content.matchAll(thinkPattern);
  for (const m of thinkMatches) {
    tagReasoning += m[1] + '\n';
  }
  cleanCode = content.replace(thinkPattern, '');

  // Step 2: Extract code from markdown fences
  const markdownMatch = cleanCode.match(/```(?:\w+)?\n([\s\S]*?)```/);
  if (markdownMatch) {
    // Everything before the first ``` is narrative/reasoning
    const beforeFence = cleanCode.substring(0, cleanCode.indexOf('```')).trim();
    const narrativeReasoning = beforeFence
      .split('\n')
      .filter(line => line.trim().length > 0)
      .join('\n');

    cleanCode = markdownMatch[1].trim();

    // Combine: explicit think tags + narrative before code
    const extractedReasoning = [tagReasoning.trim(), narrativeReasoning]
      .filter(Boolean)
      .join('\n\n');

    return {
      sanitized: { code: cleanCode, success: cleanCode.length > 0, isComplete: isCodeComplete(cleanCode) },
      extractedReasoning,
    };
  }

  // No markdown fences — extract leading narrative before code starts
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

    if (/^(Here|I'll|Let me|This|The user)/i.test(trimmed)) {
      codeStartIndex = i + 1;
    }
  }

  const narrativeLines = lines.slice(0, codeStartIndex).filter(l => l.trim().length > 0);
  const narrativeReasoning = narrativeLines.join('\n');
  cleanCode = lines.slice(codeStartIndex).join('\n').trim();

  const extractedReasoning = [tagReasoning.trim(), narrativeReasoning]
    .filter(Boolean)
    .join('\n\n');

  return {
    sanitized: { code: cleanCode, success: cleanCode.length > 0, isComplete: isCodeComplete(cleanCode) },
    extractedReasoning,
  };
}

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
