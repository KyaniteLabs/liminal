export type HookName = 'preGeneration' | 'postGeneration' | 'onFailure' | string;

export interface HookContext {
  prompt?: string;
  domain?: string;
  code?: string;
  error?: unknown;
  [key: string]: unknown;
}

type HookHandler<TContext extends HookContext> = (context: TContext) => TContext | Promise<TContext>;

interface RegisteredHook<TContext extends HookContext> {
  id: string;
  name: HookName;
  handler: HookHandler<TContext>;
}

/**
 * Runs extension hooks in registration order.
 * Each hook receives the context returned by the previous hook, so plugins can
 * enrich prompts or generation results without mutating shared state.
 */
export class HookSystem<TContext extends HookContext = HookContext> {
  private sequence = 0;
  private readonly hooks = new Map<HookName, RegisteredHook<TContext>[]>();

  register(name: HookName, handler: HookHandler<TContext>): string {
    const id = `hook-${Date.now().toString(36)}-${(this.sequence++).toString(36)}`;
    const entry: RegisteredHook<TContext> = { id, name, handler };
    const existing = this.hooks.get(name) ?? [];
    this.hooks.set(name, [...existing, entry]);
    return id;
  }

  unregister(id: string): boolean {
    for (const [name, entries] of this.hooks) {
      const next = entries.filter((entry) => entry.id !== id);
      if (next.length !== entries.length) {
        if (next.length === 0) this.hooks.delete(name);
        else this.hooks.set(name, next);
        return true;
      }
    }
    return false;
  }

  async execute(name: HookName, context: TContext): Promise<TContext> {
    let current = context;
    for (const entry of this.hooks.get(name) ?? []) {
      current = await entry.handler(current);
    }
    return current;
  }

  hasHooks(name: HookName): boolean {
    return this.getHookCount(name) > 0;
  }

  getHookCount(name: HookName): number {
    return this.hooks.get(name)?.length ?? 0;
  }

  clear(): void {
    this.hooks.clear();
  }
}
