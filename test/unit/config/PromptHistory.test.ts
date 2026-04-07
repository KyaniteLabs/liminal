import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { PromptHistory } from '../../../src/config/PromptHistory.js';

const TMP_DIR = path.join(os.tmpdir(), 'liminal-prompt-history-test-' + process.pid);
const HISTORY_FILE = path.join(TMP_DIR, 'history.json');

describe('PromptHistory', () => {
  let history: PromptHistory;

  beforeEach(async () => {
    await fs.mkdir(TMP_DIR, { recursive: true });
    // Start with a clean file
    try { await fs.unlink(HISTORY_FILE); } catch {}
    history = new PromptHistory(HISTORY_FILE);
  });

  afterEach(async () => {
    try { await fs.rm(TMP_DIR, { recursive: true, force: true }); } catch {}
  });

  // ---------------------------------------------------------------------------
  // add + getRecent
  // ---------------------------------------------------------------------------
  describe('add + getRecent', () => {
    it('stores and retrieves a prompt', async () => {
      await history.add('test prompt');
      const recent = await history.getRecent();
      expect(recent).toEqual(['test prompt']);
    });

    it('stores multiple prompts in reverse order (newest first)', async () => {
      await history.add('first prompt');
      await history.add('second prompt');
      await history.add('third prompt');

      const recent = await history.getRecent();

      expect(recent).toEqual(['third prompt', 'second prompt', 'first prompt']);
    });

    it('respects the limit parameter', async () => {
      for (let i = 0; i < 10; i++) {
        await history.add(`prompt ${i}`);
      }

      const recent = await history.getRecent(3);

      expect(recent.length).toBe(3);
      expect(recent).toEqual(['prompt 9', 'prompt 8', 'prompt 7']);
    });

    it('removes duplicate prompts and re-adds at top', async () => {
      await history.add('alpha');
      await history.add('beta');
      await history.add('alpha'); // duplicate — should move to top

      const recent = await history.getRecent();

      expect(recent).toEqual(['alpha', 'beta']);
      expect(recent.length).toBe(2);
    });

    it('trims to 50 entries max', async () => {
      for (let i = 0; i < 60; i++) {
        await history.add(`prompt ${i}`);
      }

      const recent = await history.getRecent(100);

      expect(recent.length).toBe(50);
      expect(recent[0]).toBe('prompt 59');
      expect(recent[49]).toBe('prompt 10');
    });
  });

  // ---------------------------------------------------------------------------
  // getEntries
  // ---------------------------------------------------------------------------
  describe('getEntries', () => {
    it('returns entries with timestamps', async () => {
      await history.add('timestamped prompt');

      const entries = await history.getEntries();

      expect(entries.length).toBe(1);
      expect(entries[0].prompt).toBe('timestamped prompt');
      expect(typeof entries[0].timestamp).toBe('number');
      // Timestamp should be close to Date.now()
      expect(entries[0].timestamp).toBeGreaterThan(Date.now() - 5000);
    });

    it('respects the limit parameter', async () => {
      for (let i = 0; i < 5; i++) {
        await history.add(`entry ${i}`);
      }

      const entries = await history.getEntries(2);

      expect(entries.length).toBe(2);
      expect(entries[0].prompt).toBe('entry 4');
      expect(entries[1].prompt).toBe('entry 3');
    });

    it('returns empty array when no history exists', async () => {
      const entries = await history.getEntries();
      expect(entries).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // Favorites
  // ---------------------------------------------------------------------------
  describe('favorites', () => {
    it('adds and retrieves favorites', async () => {
      await history.addFavorite('fav prompt 1');
      await history.addFavorite('fav prompt 2');

      const favorites = await history.getFavorites();

      expect(favorites).toEqual(['fav prompt 1', 'fav prompt 2']);
    });

    it('does not add duplicate favorites', async () => {
      await history.addFavorite('unique fav');
      await history.addFavorite('unique fav');

      const favorites = await history.getFavorites();

      expect(favorites).toEqual(['unique fav']);
    });

    it('removes a favorite', async () => {
      await history.addFavorite('keep this');
      await history.addFavorite('remove this');

      await history.removeFavorite('remove this');

      const favorites = await history.getFavorites();
      expect(favorites).toEqual(['keep this']);
    });

    it('removeFavorite is a no-op for non-existent favorite', async () => {
      await history.addFavorite('only fav');

      await history.removeFavorite('does not exist');

      const favorites = await history.getFavorites();
      expect(favorites).toEqual(['only fav']);
    });

    it('getFavorites returns empty array when no file exists', async () => {
      const favorites = await history.getFavorites();
      expect(favorites).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // Error paths / edge cases
  // ---------------------------------------------------------------------------
  describe('error paths', () => {
    it('handles corrupted JSON file gracefully (returns defaults)', async () => {
      await fs.writeFile(HISTORY_FILE, '{ bad json');

      const recent = await history.getRecent();
      expect(recent).toEqual([]);
    });

    it('handles empty file gracefully', async () => {
      await fs.writeFile(HISTORY_FILE, '');

      const recent = await history.getRecent();
      expect(recent).toEqual([]);
    });

    it('handles missing file gracefully', async () => {
      const noFileHistory = new PromptHistory('/tmp/nonexistent-' + process.pid + '/history.json');

      const recent = await noFileHistory.getRecent();
      expect(recent).toEqual([]);
    });

    it('throws descriptive error when save fails', async () => {
      // Point to a path where the parent directory cannot be created
      const badHistory = new PromptHistory('/dev/null/impossible/path/history.json');

      await expect(badHistory.add('test')).rejects.toThrow('Failed to save prompt history');
    });
  });

  // ---------------------------------------------------------------------------
  // Integration: add + favorites coexist
  // ---------------------------------------------------------------------------
  describe('recent and favorites coexist', () => {
    it('recent list and favorites are stored in the same file without conflict', async () => {
      await history.add('recent prompt');
      await history.addFavorite('favorite prompt');

      const recent = await history.getRecent();
      const favorites = await history.getFavorites();

      expect(recent).toEqual(['recent prompt']);
      expect(favorites).toEqual(['favorite prompt']);
    });
  });
});
