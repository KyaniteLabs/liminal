/**
 * Shared mock Ollama caller for swarm tests.
 *
 * Returns predictable responses based on persona ID for deterministic tests.
 */

import type { SwarmPersona } from '../../src/swarm/types.js';

export interface MockOllamaOptions {
  temperature?: number;
  num_predict?: number;
}

export function createMockOllamaCaller(responses?: Record<string, string>): (
  model: string,
  prompt: string,
  options?: MockOllamaOptions
) => Promise<string> {
  return async (_model: string, prompt: string, _options?: MockOllamaOptions): Promise<string> => {
    // If specific responses are configured, use them
    if (responses) {
      for (const [key, response] of Object.entries(responses)) {
        if (prompt.includes(key)) return response;
      }
    }
    // Default: echo back a mock response with the persona's name
    return `[Mock Ollama] Response for: ${prompt.slice(0, 50)}...`;
  };
}

/**
 * Create a mock caller that returns the persona's ID in the response,
 * making it easy to verify which persona was called.
 */
export function createEchoMockCaller(): (
  model: string,
  prompt: string,
  options?: MockOllamaOptions
) => Promise<string> {
  return async (model: string, _prompt: string, _options?: MockOllamaOptions): Promise<string> => {
    return `[Response from ${model}]`;
  };
}
