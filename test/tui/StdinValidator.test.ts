import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { validateStdin, isStdinTTY, isStdinDevNull } from '../../src/tui/StdinValidator.js';

describe('StdinValidator', () => {
  let originalStdin: typeof process.stdin;
  let originalStderr: typeof process.stderr;

  beforeEach(() => {
    originalStdin = process.stdin;
    originalStderr = process.stderr;
  });

  afterEach(() => {
    Object.defineProperty(process, 'stdin', {
      value: originalStdin,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(process, 'stderr', {
      value: originalStderr,
      writable: true,
      configurable: true,
    });
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  describe('isStdinTTY', () => {
    it('returns true when process.stdin.isTTY is true', () => {
      Object.defineProperty(process, 'stdin', {
        value: { isTTY: true, fd: 0 },
        writable: true,
        configurable: true,
      });
      expect(isStdinTTY()).toBe(true);
    });

    it('returns false when process.stdin.isTTY is undefined', () => {
      Object.defineProperty(process, 'stdin', {
        value: { isTTY: undefined, fd: 0 },
        writable: true,
        configurable: true,
      });
      expect(isStdinTTY()).toBe(false);
    });

    it('returns false when process.stdin.isTTY is false', () => {
      Object.defineProperty(process, 'stdin', {
        value: { isTTY: false, fd: 0 },
        writable: true,
        configurable: true,
      });
      expect(isStdinTTY()).toBe(false);
    });
  });

  describe('validateStdin', () => {
    it('resolves when stdin is a valid TTY', async () => {
      Object.defineProperty(process, 'stdin', {
        value: { isTTY: true, fd: 0 },
        writable: true,
        configurable: true,
      });

      await expect(validateStdin()).resolves.not.toThrow();
    });

    it('throws when stdin is not a TTY', async () => {
      Object.defineProperty(process, 'stdin', {
        value: { isTTY: false, fd: 0 },
        writable: true,
        configurable: true,
      });

      await expect(validateStdin()).rejects.toThrow('stdin is not a TTY');
    });

    it('provides helpful error message for CI/pipe scenarios', async () => {
      Object.defineProperty(process, 'stdin', {
        value: { isTTY: undefined, fd: 0 },
        writable: true,
        configurable: true,
      });

      await expect(validateStdin()).rejects.toThrow(/interactive terminal required/);
    });
  });
});
