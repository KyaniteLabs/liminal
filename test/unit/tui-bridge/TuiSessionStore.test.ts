import { describe, it, expect } from 'vitest';
import { TuiSessionStore } from '../../../src/tui-bridge/TuiSessionStore.js';
import type { TuiSessionStatus } from '../../../src/tui-bridge/types.js';

function makeStatus(overrides: Partial<TuiSessionStatus> = {}): TuiSessionStatus {
  return {
    sessionId: 'sess-1',
    status: 'active',
    startedAt: new Date().toISOString(),
    ...overrides,
  } as TuiSessionStatus;
}

describe('TuiSessionStore', () => {
  it('creates and retrieves a session', () => {
    const store = new TuiSessionStore();
    const status = makeStatus();
    store.create(status);
    expect(store.get('sess-1')).toEqual(status);
  });

  it('returns undefined for unknown session', () => {
    const store = new TuiSessionStore();
    expect(store.get('unknown')).toBeUndefined();
  });

  it('updates a session with partial patch', () => {
    const store = new TuiSessionStore();
    store.create(makeStatus());
    const updated = store.update('sess-1', { status: 'completed' } as Partial<TuiSessionStatus>);
    expect(updated.status).toBe('completed');
    expect(store.get('sess-1')!.status).toBe('completed');
  });

  it('throws when updating unknown session', () => {
    const store = new TuiSessionStore();
    expect(() => store.update('missing', {} as any)).toThrow('Unknown TUI session');
  });

  it('preserves unpatched fields', () => {
    const store = new TuiSessionStore();
    store.create(makeStatus({ sessionId: 'sess-1' }));
    const updated = store.update('sess-1', { status: 'idle' } as Partial<TuiSessionStatus>);
    expect(updated.sessionId).toBe('sess-1');
  });

  it('lists all session IDs', () => {
    const store = new TuiSessionStore();
    store.create(makeStatus({ sessionId: 'a' }));
    store.create(makeStatus({ sessionId: 'b' }));
    store.create(makeStatus({ sessionId: 'c' }));
    expect(store.list().sort()).toEqual(['a', 'b', 'c']);
  });

  it('returns empty list when no sessions', () => {
    const store = new TuiSessionStore();
    expect(store.list()).toEqual([]);
  });

  it('overwrites on create if session ID already exists', () => {
    const store = new TuiSessionStore();
    store.create(makeStatus({ sessionId: 'x', status: 'active' } as any));
    store.create(makeStatus({ sessionId: 'x', status: 'replaced' } as any));
    expect(store.get('x')!.status).toBe('replaced');
  });
});
