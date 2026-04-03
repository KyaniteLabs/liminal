/**
 * HookSystem - Plugin hooks for pre/post generation customization
 * 
 * Allows plugins to:
 * - Modify prompts before generation (preGeneration)
 * - Post-process generated code (postGeneration)
 * - Intercept validation results (preValidation/postValidation)
 * - Handle failures (onFailure)
 */

export type HookType =
  | 'preGeneration'      // Modify prompt/context before generation
  | 'postGeneration'     // Modify generated code
  | 'preValidation'      // Intercept before validation
  | 'postValidation'     // React to validation results
  | 'onFailure';         // Handle generation failures

export interface HookContext {
  /** Original user prompt */
  prompt: string;
  
  /** Domain (p5, shader, three, etc.) */
  domain: string;
  
  /** Generated code (available in postGeneration, postValidation) */
  code?: string;
  
  /** Validation score (available in postValidation) */
  score?: number;
  
  /** Validation errors (available in postValidation, onFailure) */
  errors?: string[];
  
  /** Error object (available in onFailure) */
  error?: Error;
  
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

import { Logger } from '../utils/Logger.js';

export type HookHandler = (context: HookContext) => Promise<HookContext | void>;

export interface HookSubscription {
  id: string;
  type: HookType;
  handler: HookHandler;
  priority: number; // Higher = executed first
}

export class HookSystem {
  private hooks: Map<HookType, HookSubscription[]> = new Map();
  private hookIdCounter = 0;

  /**
   * Register a hook handler
   * @param type Hook type to subscribe to
   * @param handler Function to call when hook fires
   * @param priority Execution priority (default: 0, higher = first)
   * @returns Subscription ID for unregistering
   */
  register(type: HookType, handler: HookHandler, priority = 0): string {
    const id = `hook_${++this.hookIdCounter}`;
    
    const subscription: HookSubscription = {
      id,
      type,
      handler,
      priority,
    };

    const hooks = this.hooks.get(type) || [];
    hooks.push(subscription);
    
    // Sort by priority (descending)
    hooks.sort((a, b) => b.priority - a.priority);
    
    this.hooks.set(type, hooks);
    
    return id;
  }

  /**
   * Unregister a hook by ID
   */
  unregister(id: string): boolean {
    for (const [type, hooks] of this.hooks.entries()) {
      const index = hooks.findIndex(h => h.id === id);
      if (index >= 0) {
        hooks.splice(index, 1);
        if (hooks.length === 0) {
          this.hooks.delete(type);
        }
        return true;
      }
    }
    return false;
  }

  /**
   * Execute all handlers for a hook type
   * Handlers can modify context - modifications propagate to next handler
   */
  async execute(type: HookType, context: HookContext): Promise<HookContext> {
    const hooks = this.hooks.get(type) || [];
    let currentContext = { ...context };

    for (const hook of hooks) {
      try {
        const result = await hook.handler(currentContext);
        if (result) {
          // Merge result into context
          currentContext = { ...currentContext, ...result };
        }
      } catch (error) {
        Logger.error('HookSystem', `Handler ${hook.id} failed:`, error);
        // Continue with other handlers
      }
    }

    return currentContext;
  }

  /**
   * Check if any hooks are registered for a type
   */
  hasHooks(type: HookType): boolean {
    const hooks = this.hooks.get(type);
    return !!hooks && hooks.length > 0;
  }

  /**
   * Get count of registered hooks for a type
   */
  getHookCount(type: HookType): number {
    return this.hooks.get(type)?.length || 0;
  }

  /**
   * Get all registered hook types
   */
  getRegisteredTypes(): HookType[] {
    return Array.from(this.hooks.keys());
  }

  /**
   * Clear all hooks (useful for testing)
   */
  clear(): void {
    this.hooks.clear();
    this.hookIdCounter = 0;
  }

  /**
   * Create a pre-configured hook for common patterns
   */
  static createPromptEnhancer(enhancer: (prompt: string, domain: string) => string | Promise<string>): HookHandler {
    return async (context) => {
      const enhanced = await enhancer(context.prompt, context.domain);
      return { ...context, prompt: enhanced };
    };
  }

  /**
   * Create a post-generation code transformer
   */
  static createCodeTransformer(transformer: (code: string, domain: string) => string | Promise<string>): HookHandler {
    return async (context) => {
      if (!context.code) return context;
      const transformed = await transformer(context.code, context.domain);
      return { ...context, code: transformed };
    };
  }
}

// Global hook system instance
export const hookSystem = new HookSystem();

// Re-export for convenience
export { HookSystem as default };
