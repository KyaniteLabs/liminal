/**
 * PromptStore - Manages prompt consistency and context injection
 *
 * Key behavior:
 * - load() returns the same prompt every time (identity function)
 * - injectContext() replaces placeholders with actual context
 *
 * Used in Ralph-Wiggum Loop where the prompt stays the same
 * but context (previous iterations, file state, history) changes.
 */
export class PromptStore {
  /**
   * Load a prompt - returns the same prompt every time
   *
   * This is an identity function. The same prompt input always
   * returns the exact same prompt output. In the Ralph-Wiggum Loop,
   * this ensures the prompt never changes between iterations.
   *
   * @param prompt - The prompt string to load
   * @returns The exact same prompt string
   */
  static load(prompt: string): string {
    if (typeof prompt !== 'string') {
      return '';
    }
    return prompt;
  }

  /**
   * Inject context into a prompt template
   *
   * Replaces context placeholders with actual context content.
   * Supports multiple placeholder formats:
   * - {{context}} - double braces (priority)
   * - {context} - single braces
   * - <context> - angle brackets
   *
   * @param prompt - The prompt template with placeholders
   * @param context - The context to inject (can be any type)
   * @returns Prompt with context injected
   */
  static injectContext(prompt: string, context: unknown): string {
    if (typeof prompt !== 'string') {
      return '';
    }

    // Convert context to string (handles null, undefined, objects, etc.)
    const contextString = String(context);

    // Priority order: {{context}} first, then {context}, then <context>
    let result = prompt;

    // Replace {{context}} placeholders
    if (result.includes('{{context}}')) {
      result = result.replaceAll('{{context}}', contextString);
    } else if (result.includes('{context}')) {
      result = result.replaceAll('{context}', contextString);
    } else if (result.includes('<context>')) {
      result = result.replaceAll('<context>', contextString);
    }

    return result;
  }
}