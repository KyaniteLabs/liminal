/**
 * Centralized service defaults and constants
 *
 * All hardcoded URLs and ports are defined here for easy configuration.
 */

export const SERVICE_DEFAULTS = {
  /** Preview server port for live sketch viewing */
  PREVIEW_PORT: 3456,
  /** LM Studio / local LLM API base URL */
  LOCAL_LLM_URL: process.env.LOCAL_LLM_URL || 'http://localhost:1234/v1',
  /** Ollama API base URL */
  OLLAMA_URL: process.env.OLLAMA_URL || 'http://localhost:11434',
  /** Reasoning service base URL */
  REASONING_URL: process.env.REASONING_URL || 'http://localhost:8000',
  /** MiniMax M2.7 cloud API base URL (OpenAI-compatible chat completions endpoint) */
  MINIMAX_URL: 'https://api.minimax.io/v1',
  /** p5.js CDN version */
  P5_VERSION: '1.9.0',
  /** Three.js CDN version */
  THREE_VERSION: '0.160.0',
  /** Default LLM model name */
  DEFAULT_MODEL: 'auto',
} as const;

/** p5.js CDN URL */
export const P5_CDN = `https://cdnjs.cloudflare.com/ajax/libs/p5.js/${SERVICE_DEFAULTS.P5_VERSION}/p5.min.js`;
/** p5.sound CDN URL */
export const P5_SOUND_CDN = `https://cdnjs.cloudflare.com/ajax/libs/p5.js/${SERVICE_DEFAULTS.P5_VERSION}/p5.sound.min.js`;
/** Three.js module CDN URL */
export const THREE_CDN = `https://cdn.jsdelivr.net/npm/three@${SERVICE_DEFAULTS.THREE_VERSION}/build/three.module.js`;
/** Three.js examples/addons CDN URL */
export const THREE_ADDONS_CDN = `https://cdn.jsdelivr.net/npm/three@${SERVICE_DEFAULTS.THREE_VERSION}/examples/jsm/`;
