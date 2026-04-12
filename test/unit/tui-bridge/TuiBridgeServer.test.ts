import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createServerMock, setServerMode } = vi.hoisted(() => {
  let mode: 'listening' | 'error' = 'listening';

  class MockServer {
    private listeners = new Map<string, Set<(...args: any[]) => void>>();

    once(event: string, listener: (...args: any[]) => void) {
      const wrapped = (...args: any[]) => {
        this.off(event, wrapped);
        listener(...args);
      };
      this.on(event, wrapped);
      return this;
    }

    on(event: string, listener: (...args: any[]) => void) {
      const bucket = this.listeners.get(event) ?? new Set();
      bucket.add(listener);
      this.listeners.set(event, bucket);
      return this;
    }

    off(event: string, listener: (...args: any[]) => void) {
      this.listeners.get(event)?.delete(listener);
      return this;
    }

    emit(event: string, ...args: any[]) {
      for (const listener of this.listeners.get(event) ?? []) {
        listener(...args);
      }
      return true;
    }

    listen(_port?: number, _host?: string, cb?: () => void) {
      cb?.();
      if (mode === 'error') {
        this.emit('error', new Error('bind failed'));
        return this;
      }
      this.emit('listening');
      return this;
    }

    close(cb?: (err?: Error | null) => void) {
      cb?.(null);
      return this;
    }
  }

  return {
    createServerMock: vi.fn(() => new MockServer()),
    setServerMode: (nextMode: 'listening' | 'error') => { mode = nextMode; },
  };
});

vi.mock('http', () => ({
  createServer: createServerMock,
}));

import { TuiBridgeServer } from '../../../src/tui-bridge/TuiBridgeServer.js';

describe('TuiBridgeServer.start', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setServerMode('listening');
  });

  it('resolves when the server reaches listening state', async () => {
    const server = new TuiBridgeServer({} as any, { port: 3999, host: '127.0.0.1' });

    await expect(server.start()).resolves.toBeUndefined();
    expect(createServerMock).toHaveBeenCalledTimes(1);
  });

  it('rejects when listen emits an error before listening', async () => {
    setServerMode('error');
    const server = new TuiBridgeServer({} as any, { port: 3999, host: '127.0.0.1' });

    await expect(server.start()).rejects.toThrow('bind failed');
  });
});
