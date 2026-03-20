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

export interface LLMConfig {
  provider: 'ollama' | 'openai' | 'minimax' | 'lmstudio' | 'hybrid';
  apiKey?: string;
  baseUrl?: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  costPerToken?: { input?: number; output?: number };
  /** When true, call hydra's /reason endpoint to enhance prompts before generation */
  useReasoningTransfer?: boolean;
  /** Base URL for hydra reasoning service (default http://localhost:8000) */
  hydraBaseUrl?: string;
}

export interface LLMResponse {
  code: string;
  explanation?: string;
  reasoning?: string;
  success: boolean;
  error?: string;
}

/** Read env var with ATELIER_* fallback for backward compatibility. */
function env(key: string): string | undefined {
  return process.env[`LIMINAL_${key}`] ?? process.env[`ATELIER_${key}`];
}

export class LLMClient {
  private config: LLMConfig;

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
      model: config?.model || env('LLM_MODEL') || 'local-model',
      temperature: config?.temperature ?? 0.7,
      maxTokens: config?.maxTokens ?? 2000,
      useReasoningTransfer: config?.useReasoningTransfer ?? false,
      hydraBaseUrl: config?.hydraBaseUrl || env('HYDRA_URL') || SERVICE_DEFAULTS.HYDRA_URL,
    };
  }

  /**
   * Generic LLM generation method.
   * Routes to the configured provider (lmstudio, ollama, openai, minimax, hybrid).
   * Used by generateP5Sketch, improveP5Sketch, and domain-specific generators.
   */
  async generate(systemPrompt: string, userPrompt: string, signal?: AbortSignal): Promise<LLMResponse> {
    try {
      // Optionally enhance prompt via hydra reasoning transfer
      let enhancedUserPrompt = userPrompt;
      if (this.config.useReasoningTransfer) {
        enhancedUserPrompt = await this.enhanceWithHydraReasoning(userPrompt, systemPrompt);
      }

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
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      const isRetryable = error instanceof LLMError && error.retryable;
      console.error('LLMClient.generate failed:', errMsg, isRetryable ? '(retryable)' : '');
      return {
        code: `// LLM generation failed: ${errMsg}`,
        success: false,
        error: errMsg,
      };
    }
  }

  async generateP5Sketch(prompt: string, context?: string, signal?: AbortSignal): Promise<LLMResponse> {
    const systemPrompt = `You are an expert creative coding assistant specializing in p5.js.
Generate valid, creative p5.js sketch code based on the user's description.

Rules:
1. Return ONLY valid JavaScript code for p5.js (no markdown, no explanations)
2. Include setup() and draw() functions
3. Use creative colors, animations, and effects that match the prompt
4. Add comments explaining key parts
5. Ensure code is self-contained and runnable
6. Canvas size: use createCanvas(800, 600) or appropriate size
7. Include p5.js library usage (shapes, colors, animation, interaction if relevant)

Example output format:
function setup() {
  createCanvas(800, 600);
  // initialization
}

function draw() {
  // drawing code
}`;

    const userPrompt = `Create a p5.js sketch: ${prompt}
${context ? `\nContext: ${context}` : ''}`;

    return this.generate(systemPrompt, userPrompt, signal);
  }

  /**
   * Ask the LLM to improve existing p5.js sketch code.
   */
  async improveP5Sketch(currentCode: string): Promise<LLMResponse> {
    const systemPrompt = `You are an expert creative coding assistant specializing in p5.js.
Improve the following p5.js sketch. Keep it valid and runnable.

Rules:
1. Return ONLY valid JavaScript code for p5.js (no markdown, no explanations)
2. Preserve or add setup() and draw() as needed
3. Improve aesthetics, performance, or structure without changing the core idea
4. Ensure code is self-contained and runnable
5. Canvas size: use createCanvas(800, 600) or appropriate size`;

    const userPrompt = `Improve this p5.js sketch. Current code:\n\n${currentCode}`;

    return this.generate(systemPrompt, userPrompt);
  }

  private parseChatCompletionResponse(data: { choices?: Array<{ message?: { content?: string; reasoning_content?: string } }> }): LLMResponse {
    const message = data.choices?.[0]?.message;
    const content = message?.content || '';
    const reasoning = message?.reasoning_content || undefined;
    const codeMatch = content.match(/```(?:javascript|js)?\n?([\s\S]*?)```/);
    const cleanCode = codeMatch ? codeMatch[1].trim() : content.trim();
    return {
      code: cleanCode,
      explanation: content,
      reasoning,
      success: true,
    };
  }

  private async callOpenAI(system: string, user: string, signal?: AbortSignal): Promise<LLMResponse> {
    const baseUrl = this.config.baseUrl || 'https://api.openai.com/v1';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    let response: Response;
    try {
      response = await fetch(`${baseUrl}/chat/completions`, {
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
        signal,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new LLMTimeoutError('openai');
      }
      throw new LLMError(`OpenAI API request failed: ${err instanceof Error ? err.message : err}`, 'openai', undefined, false);
    }

    if (!response.ok) {
      throw this.classifyHttpError('openai', response.status, response.statusText);
    }

    const data = await response.json();
    return this.parseChatCompletionResponse(data);
  }

  private async callMinimax(system: string, user: string, signal?: AbortSignal): Promise<LLMResponse> {
    const baseUrl = this.config.baseUrl || SERVICE_DEFAULTS.MINIMAX_URL;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    let response: Response;
    try {
      response = await fetch(`${baseUrl}/chat/completions`, {
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
        signal,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new LLMTimeoutError('minimax');
      }
      throw new LLMError(`Minimax API request failed: ${err instanceof Error ? err.message : err}`, 'minimax', undefined, false);
    }

    if (!response.ok) {
      throw this.classifyHttpError('minimax', response.status, response.statusText);
    }

    const data = await response.json();
    return this.parseChatCompletionResponse(data);
  }

  private async callLMStudio(system: string, user: string, signal?: AbortSignal): Promise<LLMResponse> {
    const baseUrl = this.config.baseUrl || SERVICE_DEFAULTS.LOCAL_LLM_URL;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    let response: Response;
    try {
      response = await fetch(`${baseUrl}/chat/completions`, {
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
        signal,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new LLMTimeoutError('lmstudio');
      }
      throw new LLMError(`LM Studio API request failed: ${err instanceof Error ? err.message : err}`, 'lmstudio', undefined, false);
    }

    if (!response.ok) {
      throw this.classifyHttpError('lmstudio', response.status, response.statusText);
    }

    const data = await response.json();
    return this.parseChatCompletionResponse(data);
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
   * Call hydra's /reason endpoint to enhance a prompt with reasoning transfer.
   * Falls back to the original prompt on any failure (hydra is optional).
   */
  private async enhanceWithHydraReasoning(prompt: string, systemPrompt: string): Promise<string> {
    try {
      const response = await fetch(`${this.config.hydraBaseUrl}/reason`, {
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
        console.warn('Hydra reasoning transfer unavailable:', response.status);
        return prompt;
      }

      const data = await response.json();
      return data.enhanced_prompt || prompt;
    } catch {
      console.warn('Hydra reasoning transfer failed, using original prompt');
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
