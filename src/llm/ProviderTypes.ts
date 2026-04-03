/**
 * ProviderTypes - Shared types for the model-agnostic provider system
 *
 * These types define the universal contract between LLMClient and
 * individual provider implementations. Every provider adheres to
 * ProviderRequest → ProviderResponse, regardless of the underlying API.
 */

// ── Request ──

export interface ThinkingConfig {
  enabled: boolean;
  /** Anthropic: exact token count */
  budgetTokens?: number;
  /** OpenAI/Gemini/Anthropic adaptive: effort level */
  effort?: 'low' | 'medium' | 'high';
}

export interface ProviderRequest {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  thinking?: ThinkingConfig;
  signal?: AbortSignal;
}

// ── Response ──

export interface NormalizedThinking {
  text: string;
  source:
    | 'thinking_blocks'    // Anthropic native
    | 'reasoning_content'  // DeepSeek/OpenAI/LiteLLM
    | 'think_tags'         // Local DeepSeek-R1 via Ollama
    | 'reasoning_details'  // OpenRouter
    | 'none';              // Model doesn't support thinking
  budgetUsed?: number;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  thinkingTokens?: number;
}

export interface ProviderResponse {
  content: string;
  thinking?: NormalizedThinking;
  usage?: TokenUsage;
  model: string;
  success: boolean;
  error?: string;
}

// ── Streaming ──

export type StreamEvent =
  | { type: 'thinking'; content: string }
  | { type: 'content'; content: string }
  | { type: 'done'; usage?: TokenUsage }
  | { type: 'error'; error: string };

// ── Provider Config ──

export interface ProviderConfig {
  baseUrl: string;
  apiKey?: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
  headers?: Record<string, string>;
}

// ── Capabilities ──

export interface ProviderCapabilities {
  thinking: boolean;
  streaming: boolean;
  jsonMode: boolean;
  toolUse: boolean;
  maxContextTokens: number;
  thinkingStyle: 'budget_tokens' | 'effort_level' | 'think_tags' | 'reasoning_content' | 'none';
  streamingStyle: 'sse' | 'json_lines' | 'tag_based';
}
