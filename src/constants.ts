/**
 * Centralized service defaults and constants
 *
 * All hardcoded URLs and ports are defined here for easy configuration.
 */

export const SERVICE_DEFAULTS = {
  /** Preview server port for live sketch viewing */
  PREVIEW_PORT: 3456,
  /** LM Studio / local LLM API base URL */
  LOCAL_LLM_URL: 'http://localhost:1234/v1',
  /** Ollama API base URL */
  OLLAMA_URL: 'http://localhost:11434',
  /** Reasoning service base URL */
  REASONING_URL: 'http://localhost:8000',
  /** MiniMax M2.7 cloud API base URL */
  MINIMAX_URL: 'https://api.minimax.io/v1',
} as const;
