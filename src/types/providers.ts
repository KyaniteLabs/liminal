/**
 * Supported LLM providers
 * 
 * Use these enum values instead of magic strings throughout the codebase.
 * This ensures type safety, prevents typos, and makes refactoring easier.
 * 
 * @example
 * ```typescript
 * import { Provider, isValidProvider } from './providers.js';
 * 
 * const config = getProviderConfig(Provider.LMSTUDIO);
 * 
 * if (isValidProvider(userInput)) {
 *   // userInput is typed as Provider here
 * }
 * ```
 */
export enum Provider {
  /** LM Studio - Local OpenAI-compatible server (default) */
  LMSTUDIO = 'lmstudio',
  
  /** Ollama - Local model server with native API */
  OLLAMA = 'ollama',
  
  /** MiniMax - Cloud provider (Global Token Plan) */
  MINIMAX = 'minimax',
  
  /** OpenAI - Cloud provider (GPT models) */
  OPENAI = 'openai',
  
  /** OpenRouter - Cloud provider (access to many models) */
  OPENROUTER = 'openrouter',
  
  /** GLM - Cloud provider (International Coding Plan API) */
  GLM = 'glm',
  
  /** Custom - User-defined OpenAI-compatible endpoint */
  CUSTOM = 'custom'
}

/**
 * Type guard for Provider enum
 * 
 * Checks if a string value is a valid Provider enum value.
 * Useful for validating user input or environment variables.
 * 
 * @param value - The string to check
 * @returns True if the value is a valid Provider
 * 
 * @example
 * ```typescript
 * const userInput = process.env.LLM_PROVIDER;
 * if (isValidProvider(userInput)) {
 *   const config = getProviderConfig(userInput);
 * }
 * ```
 */
export function isValidProvider(value: string): value is Provider {
  return Object.values(Provider).includes(value as Provider);
}

/**
 * Get the default provider for fallback scenarios
 * 
 * @returns Provider.LMSTUDIO - The default local provider
 * 
 * @example
 * ```typescript
 * const provider = process.env.LLM_PROVIDER || getDefaultProvider();
 * ```
 */
export function getDefaultProvider(): Provider {
  return Provider.LMSTUDIO;
}

/**
 * Get all provider values as an array
 * 
 * @returns Array of all provider string values
 * 
 * @example
 * ```typescript
 * const allProviders = getAllProviders();
 * // ['lmstudio', 'ollama', 'minimax', 'openai', 'openrouter', 'glm', 'custom']
 * ```
 */
export function getAllProviders(): Provider[] {
  return Object.values(Provider);
}
