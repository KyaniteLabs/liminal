/**
 * PreviewServer Characterization Tests
 * 
 * These tests capture the current behavior of PreviewServer's promise-based
 * start() and stop() methods before refactoring to async/await.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PreviewServer } from '../../src/render/PreviewServer.js';
import { createServer } from 'http';
import { AddressInfo } from 'net';

// Helper to get a free port
async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(0, () => {
      const port = (server.address() as AddressInfo).port;
      server.close(() => resolve(port));
    });
    server.on('error', reject);
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
      const port = await getFreePort();
      const result = await server.start(port);
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
      const port = await getFreePort();
      await server.start(port);
      await expect(server.start(port)).rejects.toThrow('Server is already running');
    });

    it('should reject with EADDRINUSE when port is already in use', async () => {
      const port = await getFreePort();
      const server1 = new PreviewServer();
      const server2 = new PreviewServer();
      
      await server1.start(port);
      
      try {
        await expect(server2.start(port)).rejects.toThrow(`Port ${port} is already in use`);
      } finally {
        await server1.stop();
      }
    });

    it('should use any available port when specified', async () => {
      const port = await getFreePort();
      const result = await server.start(port);
      expect(result).toBe(true);
    });
  });

  describe('stop()', () => {
    it('should return false when stopping a server that is not running', async () => {
      const result = await server.stop();
      expect(result).toBe(false);
    });

    it('should return true when stopping a running server', async () => {
      const port = await getFreePort();
      await server.start(port);
      const result = await server.stop();
      expect(result).toBe(true);
    });

    it('should allow restarting after stop', async () => {
      const port1 = await getFreePort();
      const port2 = await getFreePort();
      await server.start(port1);
      await server.stop();
      const result = await server.start(port2);
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
