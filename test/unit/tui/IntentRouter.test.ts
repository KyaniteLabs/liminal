import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockReadFile = vi.hoisted(() =>
  vi.fn<(path: string, encoding: string) => Promise<string>>()
);

vi.mock('node:fs/promises', () => ({
  default: { readFile: mockReadFile },
  readFile: mockReadFile,
}));

vi.mock('../../../src/utils/Logger.js', () => ({
  Logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { loadSoul } from '../../../src/tui/IntentRouter.js';

describe('IntentRouter', () => {
  beforeEach(() => {
    mockReadFile.mockReset();
  });

  describe('loadSoul()', () => {
    it('returns file content when first candidate succeeds', async () => {
      const expected = '# My Soul\nBe creative.';
      mockReadFile.mockResolvedValueOnce(expected);

      const result = await loadSoul();
      expect(result).toBe(expected);
      expect(mockReadFile).toHaveBeenCalledTimes(1);
    });

    it('returns DEFAULT_SOUL when candidate fails', async () => {
      mockReadFile.mockRejectedValueOnce(new Error('ENOENT'));

      const result = await loadSoul();
      // DEFAULT_SOUL is the inline constant from IntentRouter.ts
      expect(result).toContain('Liminal, a creative coding partner');
      expect(result).toContain('TypeScript');
      expect(mockReadFile).toHaveBeenCalledTimes(1);
    });

    it('DEFAULT_SOUL contains expected key phrases', async () => {
      // Force fallback to DEFAULT_SOUL
      mockReadFile
        .mockRejectedValueOnce(new Error('not found'))
        .mockRejectedValueOnce(new Error('not found'));

      const soul = await loadSoul();
      expect(soul).toContain('creative coding partner');
      expect(soul).toContain('TypeScript (.ts)');
      expect(soul).toContain('vitest');
      expect(soul).toContain('NEVER create files in root');
    });
  });
});
