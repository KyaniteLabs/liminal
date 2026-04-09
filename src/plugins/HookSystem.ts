/**
 * HookSystem - Plugin hook registration and execution
 */

import { Logger } from '../utils/Logger.js';

export type HookType =
  | 'preGeneration'
  | 'postGeneration'
  | 'preValidation'
  | 'postValidation'
  | 'onFailure';

export interface HookContext {
  prompt: string;
  domain: string;
  code?: string;
  score?: number;
  errors?: string[];
  error?: Error;
  metadata?: Record<string, unknown>;
}

export type HookHandler = (ctx: HookContext) => Promise<HookContext>;

interface HookRegistration {
  id: string;
  type: HookType;
  handler: HookHandler;
  priority: number;
}

export class HookSystem {
  private hooks = new Map<HookType, HookRegistration[]>();
  private counter = 0;

  register(type: HookType, handler: HookHandler, priority = 0): string {
    this.counter++;
    const id = `hook_${this.counter}`;

    const registration: HookRegistration = {
      id,
      type,
      handler,
      priority,
    };

    const existing = this.hooks.get(type) || [];
    existing.push(registration);
    // Sort by priority descending (higher priority runs first)
    existing.sort((a, b) => b.priority - a.priority);
    this.hooks.set(type, existing);

    return id;
  }

  unregister(id: string): boolean {
    for (const [type, registrations] of this.hooks) {
      const index = registrations.findIndex((r) => r.id === id);
      if (index !== -1) {
        registrations.splice(index, 1);
        if (registrations.length === 0) {
          this.hooks.delete(type);
        }
        return true;
      }
    }
    return false;
  }

  async execute(type: HookType, context: HookContext): Promise<HookContext> {
    const registrations = this.hooks.get(type) || [];
    let currentContext = { ...context };

    for (const reg of registrations) {
      try {
        const result = await reg.handler(currentContext);
        if (result !== undefined) {
          currentContext = result;
        }
      } catch (error) {
        Logger.error('HookSystem', `Handler ${reg.id} failed:`, error);
        // Continue execution with current context
      }
    }

    return currentContext;
  }

  hasHooks(type: HookType): boolean {
    const registrations = this.hooks.get(type);
    return registrations !== undefined && registrations.length > 0;
  }

  getHookCount(type: HookType): number {
    return this.hooks.get(type)?.length || 0;
  }

  getRegisteredTypes(): HookType[] {
    return Array.from(this.hooks.keys());
  }

  clear(): void {
    this.hooks.clear();
    this.counter = 0;
  }

  static createPromptEnhancer(
    enhancer: (prompt: string, domain?: string) => string | Promise<string>
  ): HookHandler {
    return async (ctx) => {
      const enhanced = await enhancer(ctx.prompt, ctx.domain);
      return {
        ...ctx,
        prompt: enhanced,
      };
    };
  }

  static createCodeTransformer(
    transformer: (code: string, domain?: string) => string | Promise<string>
  ): HookHandler {
    return async (ctx) => {
      if (ctx.code === undefined) {
        return ctx;
      }
      const transformed = await transformer(ctx.code, ctx.domain);
      return {
        ...ctx,
        code: transformed,
      };
    };
  }
}
