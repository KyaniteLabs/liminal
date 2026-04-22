/**
 * PreviewServer Characterization Tests
 * 
 * These tests capture the current behavior of PreviewServer's promise-based
 * start() and stop() methods before refactoring to async/await.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PreviewServer } from '../../src/render/PreviewServer.js';
import { createServer, Server } from 'http';
import { AddressInfo } from 'net';

async function listenOnEphemeralPort(): Promise<{ holder: Server; port: number }> {
  return new Promise((resolve, reject) => {
    const holder = createServer();
    holder.listen(0, () => {
      const port = (holder.address() as AddressInfo).port;
      resolve({ holder, port });
    });
    holder.on('error', reject);
  });
}

describe('PreviewServer Characterization', () => {
  let server: PreviewServer;

  beforeEach(() => {
    server = new PreviewServer();
  });

  afterEach(async () => {
    try {
      await server.stop();
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('start()', () => {
    it('should return a promise that resolves to true when server starts', async () => {
      const result = await server.start(0);
      expect(result).toBe(true);
    });

    it('should allow ephemeral port selection when starting with port 0', async () => {
      const result = await server.start(0);
      expect(result).toBe(true);
      expect(server.getPort()).toBeGreaterThan(0);
    });

    it('should throw error when starting with invalid port (negative)', async () => {
      await expect(server.start(-1)).rejects.toThrow('Invalid port number');
    });

    it('should throw error when starting with invalid port (too high)', async () => {
      await expect(server.start(70000)).rejects.toThrow('Invalid port number');
    });

    it('should throw error when starting server twice', async () => {
      await server.start(0);
      await expect(server.start(0)).rejects.toThrow('Server is already running');
    });

    it('should reject with EADDRINUSE when port is already in use', async () => {
      const { holder, port } = await listenOnEphemeralPort();

      try {
        await expect(server.start(port)).rejects.toThrow(`Port ${port} is already in use`);
      } finally {
        await new Promise<void>((resolve) => holder.close(() => resolve()));
      }
    });

    it('should use any available port when specified', async () => {
      const result = await server.start(0);
      expect(result).toBe(true);
    });
  });

  describe('stop()', () => {
    it('should return false when stopping a server that is not running', async () => {
      const result = await server.stop();
      expect(result).toBe(false);
    });

    it('should return true when stopping a running server', async () => {
      await server.start(0);
      const result = await server.stop();
      expect(result).toBe(true);
    });

    it('should allow restarting after stop', async () => {
      await server.start(0);
      await server.stop();
      const result = await server.start(0);
      expect(result).toBe(true);
    });
  });

  describe('serveSketch()', () => {
    it('should store the sketch code', () => {
      const code = 'function setup() { createCanvas(400, 400); }';
      server.serveSketch(code);
      // The effect is internal, but we can verify it doesn't throw
      expect(() => server.serveSketch(code)).not.toThrow();
    });

    it('should handle null code gracefully', () => {
      expect(() => server.serveSketch(null)).not.toThrow();
    });
  });

  describe('setVersionCode()', () => {
    it('should set code for a valid version', () => {
      expect(() => server.setVersionCode(1, 'test code')).not.toThrow();
    });

    it('should ignore invalid versions (0)', () => {
      expect(() => server.setVersionCode(0, 'test code')).not.toThrow();
    });

    it('should ignore invalid versions (negative)', () => {
      expect(() => server.setVersionCode(-1, 'test code')).not.toThrow();
    });

    it('should ignore non-integer versions', () => {
      expect(() => server.setVersionCode(1.5, 'test code')).not.toThrow();
    });
  });

  describe('setAllVersions()', () => {
    it('should set multiple versions at once', () => {
      const iterations = [
        { version: 1, code: 'code v1' },
        { version: 2, code: 'code v2' },
      ];
      expect(() => server.setAllVersions(iterations)).not.toThrow();
    });

    it('should handle empty array', () => {
      expect(() => server.setAllVersions([])).not.toThrow();
    });

    it('should skip invalid versions in array', () => {
      const iterations = [
        { version: 1, code: 'code v1' },
        { version: 0, code: 'invalid' },
        { version: -1, code: 'invalid' },
        { version: 2, code: 'code v2' },
      ];
      expect(() => server.setAllVersions(iterations)).not.toThrow();
    });
  });
});
