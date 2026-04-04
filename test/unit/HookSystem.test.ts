import { describe, it, expect } from 'vitest';
import { HookSystem } from '../../src/plugins/HookSystem.js';

describe('HookSystem', () => {
  it('registers and executes a hook', async () => {
    const hs = new HookSystem();
    const id = hs.register('preGeneration', async (ctx) => ({ ...ctx, prompt: ctx.prompt + '!' }));
    expect(id).toBeTruthy();
    const result = await hs.execute('preGeneration', { prompt: 'hello', domain: 'p5' });
    expect(result.prompt).toBe('hello!');
  });

  it('unregisters a hook by id', () => {
    const hs = new HookSystem();
    const id = hs.register('postGeneration', async (ctx) => ctx);
    expect(hs.unregister(id)).toBe(true);
    expect(hs.getHookCount('postGeneration')).toBe(0);
  });

  it('reports hasHooks correctly', () => {
    const hs = new HookSystem();
    expect(hs.hasHooks('onFailure')).toBe(false);
    hs.register('onFailure', async (ctx) => ctx);
    expect(hs.hasHooks('onFailure')).toBe(true);
    hs.clear();
    expect(hs.hasHooks('onFailure')).toBe(false);
  });
});
