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
import { failureLogger } from '../harness/FailureLogger.js';
import { loadModelConfig } from './ModelConfig.js';

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
  // Thinking trace feedback loop fields
  thinking?: string;           // Raw <think> content from model
  thinkingMetrics?: {
    length: number;
    hasCodeBlocks: boolean;
    hasFunctionDefinitions: boolean;
    attemptedDomain?: string;
  };
  recoveredFromThinking?: boolean;  // True if code was extracted from thinking
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

  /** Detect provider name from baseUrl or model for logging */
  private detectProvider(): string {
    const baseUrl = this.config.baseUrl.toLowerCase();
    const model = this.config.model.toLowerCase();
    
    if (baseUrl.includes('minimax')) return 'minimax';
    if (baseUrl.includes('openai')) return 'openai';
    if (baseUrl.includes('anthropic')) return 'anthropic';
    if (baseUrl.includes('localhost:11434')) return 'ollama';
    if (baseUrl.includes('localhost:1234') || baseUrl.includes('lmstudio')) return 'lmstudio';
    if (model.includes('qwen')) return 'lmstudio';
    if (model.includes('llama')) return 'ollama';
    if (model.includes('gemma') || model.includes('mistral')) return 'local';
    
    return 'local';
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

  /** Get current config */
  getConfig(): LLMConfig {
    return { ...this.config };
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
    
    // If model is explicitly configured (not the default), use it
    const defaultModel = 'qwen2.5-coder-7b-instruct';
    if (this.config.model && this.config.model !== defaultModel) {
      this.resolvedModel = this.config.model;
      console.log(`[LLMClient] Using configured model: ${this.resolvedModel}`);
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
        console.log(`[LLMClient] Auto-detected model: ${this.resolvedModel}`);
        return this.resolvedModel;
      }
    } catch (err) {
      console.log(`[LLMClient] Auto-detect failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    
    this.resolvedModel = this.config.model;
    console.log(`[LLMClient] Using fallback model: ${this.resolvedModel}`);
    return this.resolvedModel;
  }

  /**
   * Generate code from prompts
   * Universal interface - works with any OpenAI-compatible endpoint
   */
  async generate(systemPrompt: string, userPrompt: string, signal?: AbortSignal, bypassCache?: boolean): Promise<LLMResponse> {
    const llmStartTime = Date.now();
    
    // Auto-detect model on first use (for local endpoints like LM Studio)
    const resolvedModel = await this.resolveModel();
    if (resolvedModel !== this.config.model) {
      this.config.model = resolvedModel;
    }
    
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
    // Model-specific prompt adaptation
    // Qwen models get stuck in "thinking mode" with complex prompts
    // Use simplified prompt for Qwen to avoid the thinking trap
    if (this.isQwenModel()) {
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
  
  /** Check if current model is a Qwen model (has thinking mode issues) */
  private isQwenModel(): boolean {
    const model = this.config.model.toLowerCase();
    return model.includes('qwen') || model.includes('qwen3.5');
  }

  async improveP5Sketch(currentCode: string): Promise<LLMResponse> {
    const rendered = PromptLibrary.render('p5.improve', { code: currentCode });
    return this.generate(rendered.system, rendered.user);
  }

  /** Universal response parser - handles any model's quirks */
  private parseResponse(data: unknown): LLMResponse {
    // Handle different response shapes
    const response = data as Record<string, unknown>;
    
    // Extract raw thinking FIRST (before any processing)
    const rawThinking = this.extractRawThinking(data);
    
    // OpenAI-compatible format
    const choices = response.choices as Array<{ message?: { content?: string; reasoning_content?: string } }> | undefined;
    if (choices && choices[0]?.message) {
      const message = choices[0].message;
      return this.sanitizeOutput(message.content || '', message.reasoning_content, rawThinking);
    }
    
    // Ollama format
    const ollamaResponse = response.response as string | undefined;
    const ollamaThinking = response.thinking as string | undefined;
    
    // Qwen models: may have empty response but thinking field contains content
    // Capture thinking as reasoning, try to extract code from it if response is empty
    if (ollamaResponse !== undefined) {
      // If response is empty but thinking has content, try to extract code from thinking
      if ((!ollamaResponse || ollamaResponse.trim() === '') && ollamaThinking) {
        const extractedFromThinking = this.extractCodeFromThinking(ollamaThinking);
        return this.sanitizeOutput(extractedFromThinking || '', ollamaThinking, rawThinking || ollamaThinking);
      }
      return this.sanitizeOutput(ollamaResponse, ollamaThinking, rawThinking || ollamaThinking);
    }
    
    // Fallback: try to find content anywhere in response
    const anyContent = JSON.stringify(response).match(/"content"\s*:\s*"([^"]*)"/)?.[1];
    if (anyContent) {
      return this.sanitizeOutput(anyContent, undefined, rawThinking);
    }
    
    return {
      code: '',
      success: false,
      error: 'Unable to parse LLM response',
      thinking: rawThinking,
      thinkingMetrics: rawThinking ? this.analyzeThinking(rawThinking) : undefined,
    };
  }
  
  /**
   * Extract raw thinking content from any response format
   * Captures <think> tags, reasoning_content fields, etc.
   */
  private extractRawThinking(data: unknown): string | undefined {
    const response = data as Record<string, unknown>;
    
    // Check for reasoning_content (OpenAI format)
    const choices = response.choices as Array<{ message?: { reasoning_content?: string } }> | undefined;
    if (choices?.[0]?.message?.reasoning_content) {
      return choices[0].message.reasoning_content;
    }
    
    // Check for thinking field (Ollama format)
    if (response.thinking && typeof response.thinking === 'string') {
      return response.thinking;
    }
    
    // Check for <think> tags in content
    const messageContent = choices?.[0]?.message && 'content' in choices[0].message 
      ? (choices[0].message as { content?: string }).content 
      : undefined;
    const content = response.content || messageContent || (response.response as string);
    if (typeof content === 'string') {
      const thinkMatch = content.match(/<think>([\s\S]*?)<\/think>/i);
      if (thinkMatch) {
        return thinkMatch[1].trim();
      }
    }
    
    return undefined;
  }
  
  /**
   * Analyze thinking content for metrics and patterns
   */
  private analyzeThinking(thinking: string): NonNullable<LLMResponse['thinkingMetrics']> {
    return {
      length: thinking.length,
      hasCodeBlocks: /```[\s\S]*?```/.test(thinking),
      hasFunctionDefinitions: /function\s+\w+\s*\(/.test(thinking),
      attemptedDomain: this.detectDomainInThinking(thinking),
    };
  }
  
  /**
   * Detect which domain the model was trying to generate
   */
  private detectDomainInThinking(thinking: string): string | undefined {
    const lower = thinking.toLowerCase();
    if (lower.includes('p5') || lower.includes('particle') || lower.includes('canvas')) return 'p5';
    if (lower.includes('three') || lower.includes('3d') || lower.includes('scene')) return 'three';
    if (lower.includes('glsl') || lower.includes('shader') || lower.includes('fragment')) return 'glsl';
    if (lower.includes('strudel') || lower.includes('pattern') || lower.includes('beat')) return 'strudel';
    if (lower.includes('hydra') || lower.includes('osc') || lower.includes('src(')) return 'hydra';
    if (lower.includes('tone') || lower.includes('synth') || lower.includes('audio')) return 'tone';
    if (lower.includes('remotion') || lower.includes('video') || lower.includes('composition')) return 'remotion';
    if (lower.includes('html') || lower.includes('css') || lower.includes('web')) return 'html';
    if (lower.includes('ascii') || lower.includes('art') || lower.includes('characters')) return 'ascii';
    return undefined;
  }
  
  /**
   * Extract code from thinking field (for models like Qwen that output code in thinking)
   */
  private extractCodeFromThinking(thinking: string): string | null {
    // Look for code blocks in thinking
    const codeBlockMatch = thinking.match(/```(?:javascript|js|p5|glsl|html)?\n([\s\S]*?)```/i);
    if (codeBlockMatch) {
      return codeBlockMatch[1].trim();
    }
    
    // Look for code-like content (function declarations, etc.)
    const functionMatch = thinking.match(/(function\s+\w+\s*\([^)]*\)\s*\{[\s\S]*\})/);
    if (functionMatch) {
      return functionMatch[1];
    }
    
    return null;
  }

  /**
   * Universal output sanitizer
   * Handles contamination from ANY model: <think> tags, markdown fences, reasoning text
   * Now includes thinking trace capture for feedback loop
   */
  private sanitizeOutput(content: string, reasoning?: string, thinking?: string): LLMResponse {
    // PRESERVE thinking BEFORE stripping tags
    const preservedThinking = thinking || this.extractThinkingFromContent(content);
    
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
    
    // Step 4: Recovery - if code is empty but thinking has code blocks, extract from thinking
    let recoveredFromThinking = false;
    if ((!cleanCode || cleanCode.trim() === '') && preservedThinking) {
      const codeFromThinking = this.extractCodeFromThinking(preservedThinking);
      if (codeFromThinking) {
        cleanCode = codeFromThinking;
        recoveredFromThinking = true;
        console.log(`[LLMClient] Recovered ${codeFromThinking.length} chars of code from thinking`);
      }
    }
    
    // Step 5: Validate code completeness
    const isComplete = this.isCodeComplete(cleanCode);
    
    // Step 6: Analyze thinking for metrics
    const thinkingMetrics = preservedThinking ? this.analyzeThinking(preservedThinking) : undefined;
    
    return {
      code: cleanCode,
      explanation: content,
      reasoning,
      thinking: preservedThinking,      // NEW: thinking trace
      thinkingMetrics,                  // NEW: thinking analysis
      recoveredFromThinking,            // NEW: recovery flag
      success: cleanCode.length > 0,
      isComplete,
    };
  }
  
  /**
   * Extract thinking content embedded in main content
   */
  private extractThinkingFromContent(content: string): string | undefined {
    const thinkMatch = content.match(/<think>([\s\S]*?)<\/think>/i);
    return thinkMatch ? thinkMatch[1].trim() : undefined;
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
    
    console.log(`[LLMClient] Sending request with model: ${this.config.model}`);
    
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
    if (resolvedModel !== this.config.model) {
      this.config.model = resolvedModel;
    }

    try {
      const result = await RetryManager.executeWithRetry(async () => {
        if (this.config.apiStyle === 'ollama') {
          return await this.callOllamaRaw(systemPrompt, prompt, maxTokens, temperature, signal);
        }
        return await this.callOpenAIRaw(systemPrompt, prompt, maxTokens, temperature, signal);
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

  /** Raw OpenAI-compatible call returning text */
  private async callOpenAIRaw(
    system: string,
    user: string,
    maxTokens: number,
    temperature: number,
    signal?: AbortSignal,
  ): Promise<{ text: string; success: boolean }> {
    const baseUrl = this.config.baseUrl;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    const timeoutSignal = signal || AbortSignal.timeout(300000);

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: this.config.model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature,
        max_tokens: maxTokens,
      }),
      signal: timeoutSignal,
    });

    if (!response.ok) {
      throw this.classifyHttpError(response.status, response.statusText);
    }

    const data = await response.json() as Record<string, unknown>;
    const choices = data.choices as Array<{ message?: { content?: string } }> | undefined;
    const content = choices?.[0]?.message?.content;
    return { text: content || '', success: true };
  }

  /** Raw Ollama call returning text */
  private async callOllamaRaw(
    system: string,
    user: string,
    maxTokens: number,
    temperature: number,
    signal?: AbortSignal,
  ): Promise<{ text: string; success: boolean }> {
    const baseUrl = this.config.baseUrl;
    const timeoutSignal = signal || AbortSignal.timeout(120000);
    const numCtx = Math.min(maxTokens * 2, 32768);

    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.config.model,
        system,
        prompt: user,
        stream: false,
        options: {
          num_predict: maxTokens,
          num_ctx: numCtx,
          temperature,
        },
      }),
      signal: timeoutSignal,
    });

    if (!response.ok) {
      throw new LLMError(`Ollama API error: ${response.status}`, 'ollama', response.status, response.status >= 500);
    }

    const data = await response.json();
    return { text: (data as Record<string, unknown>).response as string || '', success: true };
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
    if (resolvedModel !== this.config.model) {
      this.config.model = resolvedModel;
    }

    const baseUrl = this.config.baseUrl;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: this.config.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens,
        stream: true,
      }),
      signal: signal || AbortSignal.timeout(300000),
    });

    if (!response.ok) {
      throw this.classifyHttpError(response.status, response.statusText);
    }

    // Parse SSE stream
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') return;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                yield content;
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Create LLMClient for harness tasks (self-improvement, code fixes)
   * Uses harness-specific configuration with lower temperature for precision
   */
  static forHarness(): LLMClient {
    const config = loadModelConfig();
    const harness = config.harness;
    
    return new LLMClient({
      baseUrl: harness.baseUrl,
      apiKey: harness.apiKey,
      model: harness.model,
      temperature: harness.temperature,
      maxTokens: harness.maxTokens,
    });
  }

  /**
   * Create LLMClient for generation tasks (creative coding)
   * Uses generation configuration with higher temperature for creativity
   */
  static forGeneration(): LLMClient {
    const config = loadModelConfig();
    const generation = config.generation;
    
    return new LLMClient({
      baseUrl: generation.baseUrl,
      apiKey: generation.apiKey,
      model: generation.model,
      temperature: generation.temperature,
      maxTokens: generation.maxTokens,
    });
  }

  /**
   * Create both harness and generation clients
   */
  static createSplit(): { harness: LLMClient; generation: LLMClient } {
    return {
      harness: LLMClient.forHarness(),
      generation: LLMClient.forGeneration(),
    };
  }

  /**
   * Validate model configuration
   */
  static validateConfig(): { valid: boolean; errors: string[]; warnings: string[] } {
    return { 
      valid: true, 
      errors: [], 
      warnings: [] 
    };
  }
}
