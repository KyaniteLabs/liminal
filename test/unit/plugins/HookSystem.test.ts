import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HookSystem } from '../../../src/plugins/HookSystem.js';
import type { HookType, HookContext } from '../../../src/plugins/HookSystem.js';

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------
const mockLoggerError = vi.hoisted(() => vi.fn());

vi.mock('../../../src/utils/Logger.js', () => ({
  Logger: {
    error: mockLoggerError,
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

// ===========================================================================
// HookSystem
// ===========================================================================

describe('HookSystem', () => {
  let system: HookSystem;

  beforeEach(() => {
    system = new HookSystem();
    mockLoggerError.mockClear();
  });

  // ─── register ────────────────────────────────────────────────────────

  describe('register()', () => {
    it('returns a unique subscription ID starting with hook_', () => {
      const id1 = system.register('preGeneration', async (ctx) => ctx);
      const id2 = system.register('preGeneration', async (ctx) => ctx);

      expect(id1).toBe('hook_1');
      expect(id2).toBe('hook_2');
    });

    it('increments counter across different hook types', () => {
      const id1 = system.register('preGeneration', async (ctx) => ctx);
      const id2 = system.register('postGeneration', async (ctx) => ctx);
      const id3 = system.register('onFailure', async (ctx) => ctx);

      expect(id1).toBe('hook_1');
      expect(id2).toBe('hook_2');
      expect(id3).toBe('hook_3');
    });

    it('accepts all five hook types', () => {
      const types: HookType[] = [
        'preGeneration',
        'postGeneration',
        'preValidation',
        'postValidation',
        'onFailure',
      ];
      const ids = types.map((t) => system.register(t, async (ctx) => ctx));

      expect(ids).toEqual([
        'hook_1',
        'hook_2',
        'hook_3',
        'hook_4',
        'hook_5',
      ]);
      expect(system.getRegisteredTypes()).toEqual(types);
    });

    it('sorts hooks by priority descending (higher runs first)', async () => {
      const order: string[] = [];

      system.register('preGeneration', async (ctx) => {
        order.push('low');
        return ctx;
      }, 1);

      system.register('preGeneration', async (ctx) => {
        order.push('high');
        return ctx;
      }, 10);

      system.register('preGeneration', async (ctx) => {
        order.push('mid');
        return ctx;
      }, 5);

      await system.execute('preGeneration', {
        prompt: 'test',
        domain: 'p5',
      });

      expect(order).toEqual(['high', 'mid', 'low']);
    });

    it('uses default priority 0 when not specified', async () => {
      const order: string[] = [];

      system.register('preGeneration', async (ctx) => {
        order.push('first-registered');
        return ctx;
      });

      system.register('preGeneration', async (ctx) => {
        order.push('priority-0');
        return ctx;
      }, 0);

      await system.execute('preGeneration', {
        prompt: 'test',
        domain: 'p5',
      });

      // Both at priority 0 — insertion order preserved by stable sort
      expect(order).toEqual(['first-registered', 'priority-0']);
    });
  });

  // ─── unregister ──────────────────────────────────────────────────────

  describe('unregister()', () => {
    it('returns true and removes a registered hook', () => {
      const id = system.register('preGeneration', async (ctx) => ctx);
      expect(system.getHookCount('preGeneration')).toBe(1);

      const result = system.unregister(id);
      expect(result).toBe(true);
      expect(system.getHookCount('preGeneration')).toBe(0);
    });

    it('returns false for non-existent hook ID', () => {
      const result = system.unregister('hook_999');
      expect(result).toBe(false);
    });

    it('cleans up the hook type from the Map when last hook is removed', () => {
      const id = system.register('preGeneration', async (ctx) => ctx);
      system.unregister(id);

      expect(system.hasHooks('preGeneration')).toBe(false);
      expect(system.getRegisteredTypes()).toEqual([]);
    });

    it('does not remove other hooks when unregistering one', () => {
      const id1 = system.register('preGeneration', async (ctx) => ctx);
      const id2 = system.register('preGeneration', async (ctx) => ctx);
      const id3 = system.register('postGeneration', async (ctx) => ctx);

      system.unregister(id1);

      expect(system.getHookCount('preGeneration')).toBe(1);
      expect(system.getHookCount('postGeneration')).toBe(1);
      expect(system.getRegisteredTypes()).toContain('preGeneration');
      expect(system.getRegisteredTypes()).toContain('postGeneration');
    });
  });

  // ─── execute ─────────────────────────────────────────────────────────

  describe('execute()', () => {
    it('returns a shallow copy of the original context when no hooks exist', async () => {
      const input: HookContext = { prompt: 'hello', domain: 'shader' };
      const result = await system.execute('preGeneration', input);

      expect(result).toEqual({ prompt: 'hello', domain: 'shader' });
      expect(result).not.toBe(input); // shallow copy
    });

    it('passes context through a single handler', async () => {
      system.register('preGeneration', async (ctx) => ({
        ...ctx,
        prompt: ctx.prompt.toUpperCase(),
      }));

      const result = await system.execute('preGeneration', {
        prompt: 'hello',
        domain: 'p5',
      });

      expect(result.prompt).toBe('HELLO');
    });

    it('chains multiple handlers sequentially, propagating mutations', async () => {
      system.register('preGeneration', async (ctx) => ({
        ...ctx,
        prompt: ctx.prompt + ' world',
      }));

      system.register('preGeneration', async (ctx) => ({
        ...ctx,
        prompt: ctx.prompt + '!',
      }));

      const result = await system.execute('preGeneration', {
        prompt: 'hello',
        domain: 'p5',
      });

      expect(result.prompt).toBe('hello world!');
    });

    it('preserves fields from previous handlers when later ones return partial updates', async () => {
      system.register('preGeneration', async (ctx) => ({
        ...ctx,
        prompt: 'enhanced',
        metadata: { step: 1 },
      }));

      system.register('preGeneration', async (ctx) => ({
        ...ctx,
        domain: 'three',
      }));

      const result = await system.execute('preGeneration', {
        prompt: 'original',
        domain: 'p5',
      });

      // First handler set prompt + metadata, second changed domain only
      expect(result.prompt).toBe('enhanced');
      expect(result.domain).toBe('three');
      expect(result.metadata).toEqual({ step: 1 });
    });

    it('continues execution when a handler throws, logging the error', async () => {
      const handlerError = new Error('boom');
      const order: string[] = [];

      system.register('preGeneration', async (ctx) => {
        order.push('before');
        return ctx;
      });

      system.register('preGeneration', async () => {
        order.push('failing');
        throw handlerError;
      });

      system.register('preGeneration', async (ctx) => {
        order.push('after');
        return ctx;
      });

      const result = await system.execute('preGeneration', {
        prompt: 'test',
        domain: 'p5',
      });

      expect(order).toEqual(['before', 'failing', 'after']);
      expect(mockLoggerError).toHaveBeenCalledWith(
        'HookSystem',
        expect.stringContaining('hook_2'),
        handlerError,
      );
      // Context still returned (last successful handler's result)
      expect(result.prompt).toBe('test');
    });

    it('does not mutate the original input context', async () => {
      const input: HookContext = { prompt: 'original', domain: 'p5' };

      system.register('preGeneration', async (ctx) => ({
        ...ctx,
        prompt: 'modified',
      }));

      await system.execute('preGeneration', input);

      expect(input.prompt).toBe('original');
    });

    it('returns original context copy when handler returns void/undefined', async () => {
      system.register('preGeneration', async () => {
        // Returns undefined (void)
      });

      const result = await system.execute('preGeneration', {
        prompt: 'test',
        domain: 'shader',
      });

      expect(result).toEqual({ prompt: 'test', domain: 'shader' });
    });
  });

  // ─── hasHooks / getHookCount ────────────────────────────────────────

  describe('hasHooks()', () => {
    it('returns false when no hooks registered for a type', () => {
      expect(system.hasHooks('preGeneration')).toBe(false);
    });

    it('returns true after registering a hook', () => {
      system.register('preGeneration', async (ctx) => ctx);
      expect(system.hasHooks('preGeneration')).toBe(true);
    });
  });

  describe('getHookCount()', () => {
    it('returns 0 when no hooks registered', () => {
      expect(system.getHookCount('postGeneration')).toBe(0);
    });

    it('returns the number of registered hooks for a type', () => {
      system.register('postGeneration', async (ctx) => ctx);
      system.register('postGeneration', async (ctx) => ctx);
      system.register('postGeneration', async (ctx) => ctx);

      expect(system.getHookCount('postGeneration')).toBe(3);
    });
  });

  // ─── getRegisteredTypes ────────────────────────────────────────────

  describe('getRegisteredTypes()', () => {
    it('returns empty array when no hooks registered', () => {
      expect(system.getRegisteredTypes()).toEqual([]);
    });

    it('returns all types that have at least one hook', () => {
      system.register('preGeneration', async (ctx) => ctx);
      system.register('onFailure', async (ctx) => ctx);

      const types = system.getRegisteredTypes();
      expect(types).toContain('preGeneration');
      expect(types).toContain('onFailure');
      expect(types).toHaveLength(2);
    });

    it('does not duplicate types with multiple hooks', () => {
      system.register('preGeneration', async (ctx) => ctx);
      system.register('preGeneration', async (ctx) => ctx);

      expect(system.getRegisteredTypes()).toEqual(['preGeneration']);
    });
  });

  // ─── clear ──────────────────────────────────────────────────────────

  describe('clear()', () => {
    it('removes all hooks and resets the ID counter', () => {
      system.register('preGeneration', async (ctx) => ctx);
      system.register('postGeneration', async (ctx) => ctx);

      system.clear();

      expect(system.getRegisteredTypes()).toEqual([]);
      expect(system.getHookCount('preGeneration')).toBe(0);

      // Counter reset: next ID should be hook_1
      const newId = system.register('preGeneration', async (ctx) => ctx);
      expect(newId).toBe('hook_1');
    });
  });

  // ─── createPromptEnhancer ───────────────────────────────────────────

  describe('static createPromptEnhancer()', () => {
    it('wraps a simple enhancer function into a HookHandler', async () => {
      const enhancer = (prompt: string, domain: string) =>
        `[${domain}] ${prompt}`;

      const handler = HookSystem.createPromptEnhancer(enhancer);
      const result = await handler({
        prompt: 'draw circles',
        domain: 'p5',
      });

      expect(result).toEqual({
        prompt: '[p5] draw circles',
        domain: 'p5',
        code: undefined,
        score: undefined,
        errors: undefined,
        error: undefined,
        metadata: undefined,
      });
    });

    it('handles async enhancer functions', async () => {
      const asyncEnhancer = async (prompt: string) =>
        Promise.resolve(`enhanced: ${prompt}`);

      const handler = HookSystem.createPromptEnhancer(asyncEnhancer);
      const result = await handler({
        prompt: 'test',
        domain: 'shader',
      });

      expect(result.prompt).toBe('enhanced: test');
    });
  });

  // ─── createCodeTransformer ──────────────────────────────────────────

  describe('static createCodeTransformer()', () => {
    it('wraps a simple transformer function into a HookHandler', async () => {
      const transformer = (code: string, domain: string) =>
        `/* ${domain} */\n${code}`;

      const handler = HookSystem.createCodeTransformer(transformer);
      const result = await handler({
        prompt: 'test',
        domain: 'p5',
        code: 'function setup() {}',
      });

      expect(result.code).toBe('/* p5 */\nfunction setup() {}');
    });

    it('returns context unchanged when code field is missing', async () => {
      const transformer = vi.fn((code: string) => code.toUpperCase());

      const handler = HookSystem.createCodeTransformer(transformer);
      const result = await handler({
        prompt: 'test',
        domain: 'p5',
      });

      // Transformer should NOT be called when no code is present
      expect(transformer).not.toHaveBeenCalled();
      expect(result.code).toBeUndefined();
    });

    it('returns context unchanged when code is undefined', async () => {
      const handler = HookSystem.createCodeTransformer(
        (code: string) => code,
      );
      const result = await handler({
        prompt: 'test',
        domain: 'p5',
        code: undefined,
      });

      expect(result.code).toBeUndefined();
    });

    it('handles async transformer functions', async () => {
      const asyncTransformer = async (code: string) =>
        Promise.resolve(code.replace(/var /g, 'const '));

      const handler = HookSystem.createCodeTransformer(asyncTransformer);
      const result = await handler({
        prompt: 'test',
        domain: 'three',
        code: 'var x = 1; var y = 2;',
      });

      expect(result.code).toBe('const x = 1; const y = 2;');
    });
  });

  // ─── integration: full pipeline ─────────────────────────────────────

  describe('integration: pre → post pipeline', () => {
    it('enhances prompt, then transforms code in sequence', async () => {
      // Step 1: Enhance prompt before generation
      system.register(
        'preGeneration',
        HookSystem.createPromptEnhancer((prompt) => `make it pretty: ${prompt}`),
      );

      // Step 2: Transform code after generation
      system.register(
        'postGeneration',
        HookSystem.createCodeTransformer((code) => `// enhanced\n${code}`),
      );

      // Execute pre-generation
      const preResult = await system.execute('preGeneration', {
        prompt: 'circles',
        domain: 'p5',
      });
      expect(preResult.prompt).toBe('make it pretty: circles');

      // Simulate generation producing code
      const code = 'function setup() { createCanvas(400, 400); }';

      // Execute post-generation with the code
      const postResult = await system.execute('postGeneration', {
        ...preResult,
        code,
      });
      expect(postResult.code).toBe('// enhanced\n' + code);
    });
  });

  // ─── error paths ────────────────────────────────────────────────────

  describe('error handling', () => {
    it('logs all handler errors with correct hook ID', async () => {
      const err1 = new Error('fail-1');
      const err2 = new Error('fail-2');

      system.register('onFailure', async () => { throw err1; });
      system.register('onFailure', async () => { throw err2; });

      await system.execute('onFailure', {
        prompt: 'test',
        domain: 'p5',
        error: new Error('original'),
      });

      expect(mockLoggerError).toHaveBeenCalledTimes(2);
      expect(mockLoggerError).toHaveBeenCalledWith(
        'HookSystem',
        'Handler hook_1 failed:',
        err1,
      );
      expect(mockLoggerError).toHaveBeenCalledWith(
        'HookSystem',
        'Handler hook_2 failed:',
        err2,
      );
    });

    it('returns last successfully modified context even when later handlers fail', async () => {
      system.register('preValidation', async (ctx) => ({
        ...ctx,
        score: 0.9,
      }));

      system.register('preValidation', async () => {
        throw new Error('validation crash');
      });

      const result = await system.execute('preValidation', {
        prompt: 'test',
        domain: 'shader',
        code: 'shader code',
      });

      expect(result.score).toBe(0.9);
    });
  });
});
