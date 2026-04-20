import { describe, it, expect } from 'vitest';
import { TuiSessionStore } from '../../../src/tui-bridge/TuiSessionStore.js';
import type { TuiSessionStatus } from '../../../src/tui-bridge/types.js';

describe('TuiSessionStore', () => {
  const makeStatus = (id = 's1'): TuiSessionStatus =>
    ({ sessionId: id, mode: 'chat', trust: { level: 'untrusted' } } as TuiSessionStatus);

  it('create stores and returns status', () => {
    const store = new TuiSessionStore();
    const status = makeStatus();
    const result = store.create(status);
    expect(result).toBe(status);
    expect(store.get('s1')).toBe(status);
  });

  it('get returns undefined for unknown session', () => {
    const store = new TuiSessionStore();
    expect(store.get('nonexistent')).toBeUndefined();
  });

  it('update patches and returns new status', () => {
    const store = new TuiSessionStore();
    store.create(makeStatus());
    const updated = store.update('s1', { mode: 'action' });
    expect(updated.mode).toBe('action');
    expect(store.get('s1')!.mode).toBe('action');
  });

  it('update throws for unknown session', () => {
    const store = new TuiSessionStore();
    expect(() => store.update('ghost', { mode: 'action' })).toThrow('Unknown TUI session: ghost');
  });

  it('list returns all session IDs', () => {
    const store = new TuiSessionStore();
    store.create(makeStatus('a'));
    store.create(makeStatus('b'));
    expect(store.list()).toEqual(expect.arrayContaining(['a', 'b']));
  });
});
