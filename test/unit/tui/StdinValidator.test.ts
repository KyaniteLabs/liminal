import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isStdinTTY, isStdinDevNull, validateStdin } from '../../../src/tui/StdinValidator.js';

const mockRealpath = vi.hoisted(() => vi.fn<(path: string) => Promise<string>>());

vi.mock('fs/promises', () => ({
  realpath: mockRealpath,
}));

describe('StdinValidator', () => {
  let originalIsTTY: boolean | undefined;

  beforeEach(() => {
    originalIsTTY = process.stdin.isTTY;
    mockRealpath.mockReset();
  });

  afterEach(() => {
    // Restore original isTTY value
    if (originalIsTTY === undefined) {
      delete (process.stdin as Record<string, unknown>).isTTY;
    } else {
      Object.defineProperty(process.stdin, 'isTTY', {
        value: originalIsTTY,
        writable: true,
        configurable: true,
      });
    }
  });

  // ---- isStdinTTY ----

  describe('isStdinTTY()', () => {
    it('returns true when process.stdin.isTTY === true', () => {
      Object.defineProperty(process.stdin, 'isTTY', {
        value: true,
        writable: true,
        configurable: true,
      });
      expect(isStdinTTY()).toBe(true);
    });

    it('returns false when process.stdin.isTTY === undefined', () => {
      Object.defineProperty(process.stdin, 'isTTY', {
        value: undefined,
        writable: true,
        configurable: true,
      });
      expect(isStdinTTY()).toBe(false);
    });
  });

  // ---- isStdinDevNull ----

  describe('isStdinDevNull()', () => {
    it('returns true when realpath resolves to /dev/null', async () => {
      mockRealpath.mockResolvedValueOnce('/dev/null');
      const result = await isStdinDevNull();
      expect(result).toBe(true);
    });

    it('returns false when realpath throws', async () => {
      mockRealpath.mockRejectedValueOnce(new Error('ENOENT'));
      const result = await isStdinDevNull();
      expect(result).toBe(false);
    });

    it('returns false when realpath resolves to something else', async () => {
      mockRealpath.mockResolvedValueOnce('/dev/pts/0');
      const result = await isStdinDevNull();
      expect(result).toBe(false);
    });
  });

  // ---- validateStdin ----

  describe('validateStdin()', () => {
    it('does not throw when stdin is TTY', async () => {
      Object.defineProperty(process.stdin, 'isTTY', {
        value: true,
        writable: true,
        configurable: true,
      });
      await expect(validateStdin()).resolves.toBeUndefined();
    });

    it('throws with /dev/null message when not TTY and is /dev/null', async () => {
      Object.defineProperty(process.stdin, 'isTTY', {
        value: false,
        writable: true,
        configurable: true,
      });
      mockRealpath.mockResolvedValueOnce('/dev/null');

      await expect(validateStdin()).rejects.toThrow('stdin is /dev/null');
    });

    it('throws with "not a TTY" message when not TTY and not /dev/null', async () => {
      Object.defineProperty(process.stdin, 'isTTY', {
        value: false,
        writable: true,
        configurable: true,
      });
      mockRealpath.mockResolvedValueOnce('/dev/pts/0');

      await expect(validateStdin()).rejects.toThrow('stdin is not a TTY');
    });
  });
});
