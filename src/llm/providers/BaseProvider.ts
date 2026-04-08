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
