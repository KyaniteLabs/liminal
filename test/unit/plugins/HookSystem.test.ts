import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HookSystem } from '../../../src/plugins/HookSystem.js';
import type { HookContext, HookType } from '../../../src/plugins/HookSystem.js';

// ---------------------------------------------------------------------------
// Logger mock (required because HookSystem.execute catches and logs errors)
// ---------------------------------------------------------------------------

vi.mock('../../../src/utils/Logger.js', () => ({
  Logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function baseContext(overrides?: Partial<HookContext>): HookContext {
  return {
    prompt: 'draw a circle',
    domain: 'p5',
    ...overrides,
  };
}

// ===========================================================================
// HookSystem — comprehensive tests
// ===========================================================================

describe('HookSystem', () => {
  let hs: HookSystem;

  beforeEach(() => {
    hs = new HookSystem();
  });

  // ─── register ─────────────────────────────────────────────────────────

  describe('register()', () => {
    it('returns a unique subscription id with "hook_" prefix', () => {
      const id1 = hs.register('preGeneration', async (ctx) => ctx);
      const id2 = hs.register('preGeneration', async (ctx) => ctx);

      expect(id1).toMatch(/^hook_\d+$/);
      expect(id2).toMatch(/^hook_\d+$/);
      expect(id1).not.toBe(id2);
    });

    it('increments ids sequentially starting from 1', () => {
      const id1 = hs.register('postGeneration', async (ctx) => ctx);
      const id2 = hs.register('postGeneration', async (ctx) => ctx);

      expect(id1).toBe('hook_1');
      expect(id2).toBe('hook_2');
    });

    it('accepts all five hook types', () => {
      const types: HookType[] = [
        'preGeneration',
        'postGeneration',
        'preValidation',
        'postValidation',
        'onFailure',
      ];
      const ids = types.map((t) => hs.register(t, async (ctx) => ctx));

      expect(ids).toHaveLength(5);
      expect(hs.getRegisteredTypes()).toHaveLength(5);
    });

    it('registers handler with default priority 0', () => {
      hs.register('preGeneration', async (ctx) => ctx);
      expect(hs.getHookCount('preGeneration')).toBe(1);
    });

    it('registers handler with custom priority', () => {
      hs.register('preGeneration', async (ctx) => ctx, 10);
      expect(hs.getHookCount('preGeneration')).toBe(1);
    });
  });

  // ─── unregister ───────────────────────────────────────────────────────

  describe('unregister()', () => {
    it('removes a registered hook and returns true', () => {
      const id = hs.register('preGeneration', async (ctx) => ctx);
      expect(hs.unregister(id)).toBe(true);
      expect(hs.getHookCount('preGeneration')).toBe(0);
    });

    it('returns false for non-existent id', () => {
      expect(hs.unregister('hook_999')).toBe(false);
    });

    it('removes the hook type from registered types when last hook is removed', () => {
      const id = hs.register('onFailure', async (ctx) => ctx);
      expect(hs.getRegisteredTypes()).toContain('onFailure');

      hs.unregister(id);
      expect(hs.getRegisteredTypes()).not.toContain('onFailure');
    });

    it('only removes the targeted hook, leaving others intact', () => {
      const id1 = hs.register('preGeneration', async (ctx) => ctx);
      const id2 = hs.register('preGeneration', async (ctx) => ctx);

      hs.unregister(id1);
      expect(hs.getHookCount('preGeneration')).toBe(1);
    });
  });

  // ─── execute — basic propagation ──────────────────────────────────────

  describe('execute()', () => {
    it('returns the original context unchanged when no hooks are registered', async () => {
      const ctx = baseContext();
      const result = await hs.execute('preGeneration', ctx);

      expect(result).toEqual(ctx);
    });

    it('returns a shallow copy, not the original object', async () => {
      const ctx = baseContext();
      const result = await hs.execute('preGeneration', ctx);

      expect(result).toEqual(ctx);
      expect(result).not.toBe(ctx);
    });

    it('applies a single handler modification to context', async () => {
      hs.register('preGeneration', async (ctx) => ({
        ...ctx,
        prompt: ctx.prompt + ' with color',
      }));

      const result = await hs.execute('preGeneration', baseContext());
      expect(result.prompt).toBe('draw a circle with color');
    });

    it('chains multiple handler modifications in sequence', async () => {
      hs.register('preGeneration', async (ctx) => ({
        ...ctx,
        prompt: ctx.prompt + ' step1',
      }));
      hs.register('preGeneration', async (ctx) => ({
        ...ctx,
        prompt: ctx.prompt + ' step2',
      }));

      const result = await hs.execute('preGeneration', baseContext());
      // Both handlers run; order depends on priority (both 0, so insertion order)
      expect(result.prompt).toContain('step1');
      expect(result.prompt).toContain('step2');
    });

    it('handler returning void does not overwrite context', async () => {
      hs.register('postGeneration', async (_ctx) => {
        // Side-effect only, no return
      });

      const ctx = baseContext({ code: 'function setup() {}' });
      const result = await hs.execute('postGeneration', ctx);
      expect(result.code).toBe('function setup() {}');
    });

    it('handler returning partial context merges into current context', async () => {
      hs.register('postValidation', async () => ({
        score: 0.85,
      } as Partial<HookContext>));

      const ctx = baseContext({ code: 'x' });
      const result = await hs.execute('postValidation', ctx);
      expect(result.score).toBe(0.85);
      expect(result.prompt).toBe('draw a circle');
    });

    it('propagates context through three handlers with successive transforms', async () => {
      hs.register('preGeneration', async (ctx) => ({
        ...ctx,
        prompt: `[A]${ctx.prompt}`,
      }));
      hs.register('preGeneration', async (ctx) => ({
        ...ctx,
        prompt: `${ctx.prompt}[B]`,
      }));
      hs.register('preGeneration', async (ctx) => ({
        ...ctx,
        prompt: `${ctx.prompt}[C]`,
      }));

      const result = await hs.execute('preGeneration', baseContext());
      // All three should be applied in priority order (all 0 → insertion order)
      expect(result.prompt).toContain('[A]');
      expect(result.prompt).toContain('[B]');
      expect(result.prompt).toContain('[C]');
    });
  });

  // ─── execute — priority ordering ──────────────────────────────────────

  describe('execute() — priority ordering', () => {
    it('executes higher priority handlers first', async () => {
      const order: number[] = [];

      hs.register('preGeneration', async (ctx) => {
        order.push(1);
        return ctx;
      }, 0);
      hs.register('preGeneration', async (ctx) => {
        order.push(2);
        return ctx;
      }, 10);
      hs.register('preGeneration', async (ctx) => {
        order.push(3);
        return ctx;
      }, 5);

      await hs.execute('preGeneration', baseContext());

      expect(order).toEqual([2, 3, 1]);
    });

    it('executes same-priority handlers in insertion order', async () => {
      const order: string[] = [];

      hs.register('preGeneration', async (ctx) => {
        order.push('first');
        return ctx;
      }, 0);
      hs.register('preGeneration', async (ctx) => {
        order.push('second');
        return ctx;
      }, 0);

      await hs.execute('preGeneration', baseContext());
      expect(order).toEqual(['first', 'second']);
    });

    it('high priority handler sees original context, low priority sees modified context', async () => {
      hs.register('preGeneration', async (ctx) => ({
        ...ctx,
        prompt: ctx.prompt + ' [HIGH]',
      }), 10);
      hs.register('preGeneration', async (ctx) => ({
        ...ctx,
        prompt: ctx.prompt + ' [LOW]',
      }), 0);

      const result = await hs.execute('preGeneration', baseContext());
      // High runs first: "draw a circle [HIGH]"
      // Low runs second: "draw a circle [HIGH] [LOW]"
      expect(result.prompt).toBe('draw a circle [HIGH] [LOW]');
    });

    it('negative priority runs after default', async () => {
      const order: number[] = [];

      hs.register('preGeneration', async (ctx) => {
        order.push(0);
        return ctx;
      }, 0);
      hs.register('preGeneration', async (ctx) => {
        order.push(-1);
        return ctx;
      }, -5);

      await hs.execute('preGeneration', baseContext());
      expect(order).toEqual([0, -1]);
    });
  });

  // ─── execute — error handling ─────────────────────────────────────────

  describe('execute() — error handling', () => {
    it('continues execution after a handler throws', async () => {
      const order: string[] = [];

      hs.register('preGeneration', async (_ctx) => {
        order.push('before');
        throw new Error('boom');
      }, 5);
      hs.register('preGeneration', async (ctx) => {
        order.push('after');
        return { ...ctx, prompt: ctx.prompt + ' recovered' };
      }, 0);

      const result = await hs.execute('preGeneration', baseContext());

      expect(order).toEqual(['before', 'after']);
      expect(result.prompt).toBe('draw a circle recovered');
    });

    it('returns last good context when final handler throws', async () => {
      hs.register('preGeneration', async (ctx) => ({
        ...ctx,
        prompt: ctx.prompt + ' modified',
      }), 5);
      hs.register('preGeneration', async (_ctx) => {
        throw new Error('final handler error');
      }, 0);

      const result = await hs.execute('preGeneration', baseContext());

      // The first handler's modification should survive
      expect(result.prompt).toBe('draw a circle modified');
    });

    it('returns original context when only handler throws', async () => {
      hs.register('preGeneration', async (_ctx) => {
        throw new Error('sole handler error');
      });

      const result = await hs.execute('preGeneration', baseContext());
      expect(result.prompt).toBe('draw a circle');
    });
  });

  // ─── execute — for different hook types ───────────────────────────────

  describe('execute() — hook type isolation', () => {
    it('preGeneration hooks do not fire for postGeneration', async () => {
      let fired = false;
      hs.register('preGeneration', async (ctx) => {
        fired = true;
        return ctx;
      });

      await hs.execute('postGeneration', baseContext());
      expect(fired).toBe(false);
    });

    it('onFailure hooks receive error context', async () => {
      hs.register('onFailure', async (ctx) => ({
        ...ctx,
        metadata: { handled: true },
      }));

      const ctx = baseContext({ error: new Error('generation failed') });
      const result = await hs.execute('onFailure', ctx);

      expect(result.metadata).toEqual({ handled: true });
    });

    it('postValidation hooks receive score and errors', async () => {
      hs.register('postValidation', async (ctx) => ({
        ...ctx,
        metadata: { reviewed: true },
      }));

      const ctx = baseContext({ code: 'x', score: 0.6, errors: ['low quality'] });
      const result = await hs.execute('postValidation', ctx);

      expect(result.metadata).toEqual({ reviewed: true });
      expect(result.score).toBe(0.6);
    });
  });

  // ─── hasHooks / getHookCount ──────────────────────────────────────────

  describe('hasHooks() / getHookCount()', () => {
    it('hasHooks returns false for unregistered type', () => {
      expect(hs.hasHooks('preGeneration')).toBe(false);
    });

    it('hasHooks returns true after registering', () => {
      hs.register('preGeneration', async (ctx) => ctx);
      expect(hs.hasHooks('preGeneration')).toBe(true);
    });

    it('getHookCount returns 0 for unregistered type', () => {
      expect(hs.getHookCount('preValidation')).toBe(0);
    });

    it('getHookCount returns correct count after multiple registrations', () => {
      hs.register('postGeneration', async (ctx) => ctx);
      hs.register('postGeneration', async (ctx) => ctx);
      hs.register('postGeneration', async (ctx) => ctx);

      expect(hs.getHookCount('postGeneration')).toBe(3);
    });
  });

  // ─── getRegisteredTypes ───────────────────────────────────────────────

  describe('getRegisteredTypes()', () => {
    it('returns empty array when nothing is registered', () => {
      expect(hs.getRegisteredTypes()).toEqual([]);
    });

    it('returns only types that have hooks', () => {
      hs.register('preGeneration', async (ctx) => ctx);
      hs.register('postGeneration', async (ctx) => ctx);

      const types = hs.getRegisteredTypes();
      expect(types).toContain('preGeneration');
      expect(types).toContain('postGeneration');
      expect(types).toHaveLength(2);
    });

    it('does not include types after all hooks are removed', () => {
      const id = hs.register('onFailure', async (ctx) => ctx);
      hs.unregister(id);

      expect(hs.getRegisteredTypes()).toEqual([]);
    });
  });

  // ─── clear ────────────────────────────────────────────────────────────

  describe('clear()', () => {
    it('removes all hooks', () => {
      hs.register('preGeneration', async (ctx) => ctx);
      hs.register('postGeneration', async (ctx) => ctx);
      hs.register('onFailure', async (ctx) => ctx);

      hs.clear();

      expect(hs.getRegisteredTypes()).toEqual([]);
      expect(hs.hasHooks('preGeneration')).toBe(false);
      expect(hs.hasHooks('postGeneration')).toBe(false);
      expect(hs.hasHooks('onFailure')).toBe(false);
    });

    it('resets the id counter to 0', () => {
      hs.register('preGeneration', async (ctx) => ctx);
      hs.clear();

      const id = hs.register('preGeneration', async (ctx) => ctx);
      expect(id).toBe('hook_1');
    });

    it('allows re-registration after clearing', async () => {
      hs.register('preGeneration', async (ctx) => ({
        ...ctx,
        prompt: 'old',
      }));
      hs.clear();

      hs.register('preGeneration', async (ctx) => ({
        ...ctx,
        prompt: ctx.prompt + ' new',
      }));

      const result = await hs.execute('preGeneration', baseContext());
      expect(result.prompt).toBe('draw a circle new');
    });
  });

  // ─── static createPromptEnhancer ──────────────────────────────────────

  describe('static createPromptEnhancer()', () => {
    it('returns a hook handler that modifies the prompt', async () => {
      const handler = HookSystem.createPromptEnhancer(
        (prompt, domain) => `[${domain}] ${prompt}`,
      );

      const ctx = baseContext();
      const result = await handler(ctx);

      expect(result.prompt).toBe('[p5] draw a circle');
    });

    it('passes domain correctly to the enhancer', async () => {
      const enhancer = vi.fn((_prompt: string, domain: string) =>
        `${domain}-enhanced`);

      const handler = HookSystem.createPromptEnhancer(enhancer);
      await handler(baseContext({ domain: 'shader' }));

      expect(enhancer).toHaveBeenCalledWith('draw a circle', 'shader');
    });

    it('supports async enhancer functions', async () => {
      const handler = HookSystem.createPromptEnhancer(
        async (prompt, domain) => {
          await Promise.resolve();
          return `${domain}:${prompt}`;
        },
      );

      const result = await handler(baseContext({ domain: 'three' }));
      expect(result.prompt).toBe('three:draw a circle');
    });

    it('preserves other context fields', async () => {
      const handler = HookSystem.createPromptEnhancer(
        (prompt) => prompt.toUpperCase(),
      );

      const ctx = baseContext({ metadata: { foo: 'bar' } });
      const result = await handler(ctx);

      expect(result.prompt).toBe('DRAW A CIRCLE');
      expect(result.metadata).toEqual({ foo: 'bar' });
    });
  });

  // ─── static createCodeTransformer ─────────────────────────────────────

  describe('static createCodeTransformer()', () => {
    it('returns a handler that transforms the code field', async () => {
      const handler = HookSystem.createCodeTransformer(
        (code, domain) => `// ${domain}\n${code}`,
      );

      const ctx = baseContext({ code: 'function setup() {}' });
      const result = await handler(ctx);

      expect(result.code).toBe('// p5\nfunction setup() {}');
    });

    it('returns context unchanged when code is undefined', async () => {
      const handler = HookSystem.createCodeTransformer(
        (code) => code.toUpperCase(),
      );

      const ctx = baseContext(); // no code
      const result = await handler(ctx);

      expect(result.code).toBeUndefined();
      expect(result.prompt).toBe('draw a circle');
    });

    it('passes domain correctly to the transformer', async () => {
      const transformer = vi.fn((code: string, domain: string) =>
        `/* ${domain} */ ${code}`);

      const handler = HookSystem.createCodeTransformer(transformer);
      await handler(baseContext({ code: 'x = 1', domain: 'glsl' }));

      expect(transformer).toHaveBeenCalledWith('x = 1', 'glsl');
    });

    it('supports async transformer functions', async () => {
      const handler = HookSystem.createCodeTransformer(
        async (code) => {
          await Promise.resolve();
          return code + '// async';
        },
      );

      const result = await handler(baseContext({ code: 'gl_FragColor' }));
      expect(result.code).toBe('gl_FragColor// async');
    });

    it('preserves other context fields', async () => {
      const handler = HookSystem.createCodeTransformer(
        (code) => code.trim(),
      );

      const ctx = baseContext({ code: ' x ', prompt: 'test' });
      const result = await handler(ctx);

      expect(result.code).toBe('x');
      expect(result.prompt).toBe('test');
    });
  });
});
