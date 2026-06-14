/**
 * BaseProvider - Abstract base class for all LLM provider implementations
 *
 * Every provider (OpenAI, Anthropic, Ollama, etc.) extends this class
 * and implements generate() and stream(). The base class provides
 * common configuration and capability checking.
 */

import { Result } from 'neverthrow';
import type {
  ProviderConfig,
  ProviderRequest,
  ProviderResponse,
  ProviderCapabilities,
  StreamEvent,
} from '../ProviderTypes.js';
import { LLMError } from '../errors.js';

export abstract class BaseProvider {
  abstract readonly name: string;

  protected config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
  }

  /**
   * Generate a completion (non-streaming).
   */
  abstract generate(req: ProviderRequest): Promise<Result<ProviderResponse, LLMError>>;

  /**
   * Stream tokens as they arrive.
   */
  abstract stream(req: ProviderRequest): AsyncGenerator<StreamEvent>;

  /**
   * Capabilities for the currently configured model.
   * Implementations should use CapabilityRegistry for lookups.
   */
  abstract get capabilities(): ProviderCapabilities;

  // ── Convenience methods ──

  /**
   * Combine a caller-supplied abort signal with the provider's own timeout so the
   * timeout ALWAYS bounds the request. The previous `req.signal || AbortSignal.timeout(...)`
   * silently dropped the timeout whenever a caller passed any signal — removing the only
   * time bound on long generations (the structural cause of the multi-minute provider stalls).
   *
   * `AbortSignal.any` is Node 20.3+; a manual combiner covers the `engines` floor (Node 18).
   */
  protected withTimeout(reqSignal: AbortSignal | undefined, timeoutMs: number): AbortSignal {
    const timeout = AbortSignal.timeout(timeoutMs);
    if (!reqSignal) return timeout;
    if (typeof AbortSignal.any === 'function') {
      return AbortSignal.any([reqSignal, timeout]);
    }
    const controller = new AbortController();
    if (reqSignal.aborted) {
      controller.abort(reqSignal.reason);
    } else if (timeout.aborted) {
      controller.abort(timeout.reason);
    } else {
      reqSignal.addEventListener('abort', () => controller.abort(reqSignal.reason), { once: true });
      timeout.addEventListener('abort', () => controller.abort(timeout.reason), { once: true });
    }
    return controller.signal;
  }

  supportsThinking(): boolean {
    return this.capabilities.thinking;
  }

  supportsStreaming(): boolean {
    return this.capabilities.streaming;
  }

  supportsJsonMode(): boolean {
    return this.capabilities.jsonMode;
  }

  supportsToolUse(): boolean {
    return this.capabilities.toolUse;
  }

  /**
   * Update the model in the config (e.g., after auto-detection).
   */
  setModel(model: string): void {
    this.config.model = model;
  }

  /**
   * Get the current model name.
   */
  getModel(): string {
    return this.config.model;
  }

  /**
   * Get the provider config (safe copy).
   */
  getConfig(): ProviderConfig {
    return { ...this.config };
  }
}

/**
 * Detect whether a model requires `max_completion_tokens` instead of `max_tokens`.
 * OpenAI reasoning models (o1, o3, o4) and GPT-5 family reject `max_tokens`.
 */
export function usesMaxCompletionTokens(model: string): boolean {
  return /^(gpt-5|o1|o3|o4)/.test(model);
}
