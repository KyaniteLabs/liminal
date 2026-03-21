import { describe, it, expect, beforeEach, afterEach } from 'vitest';
/**
 * Prompt history tests - Track and reuse recent prompts
 */
import { PromptHistory } from '../../src/config/PromptHistory.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const TEST_HISTORY_DIR = path.join(os.tmpdir(), 'atelier-history-test');
const TEST_HISTORY_PATH = path.join(TEST_HISTORY_DIR, 'history.json');

describe('PromptHistory', () => {
  let history: PromptHistory;

  beforeEach(async () => {
    await fs.mkdir(TEST_HISTORY_DIR, { recursive: true });
    history = new PromptHistory(TEST_HISTORY_PATH);
  });

  afterEach(async () => {
    try { await fs.rm(TEST_HISTORY_DIR, { recursive: true, force: true }); } catch {}
  });

  describe('add()', () => {
    it('should add a prompt to history', async () => {
      await history.add('blue particles');
      const recent = await history.getRecent(10);
      expect(recent).toContain('blue particles');
    });

    it('should store timestamp with prompt', async () => {
      await history.add('red circles');
      const entries = await history.getEntries(10);
      expect(entries[0].prompt).toBe('red circles');
      expect(entries[0].timestamp).toBeDefined();
    });

    it('should move duplicate prompts to top', async () => {
      await history.add('first');
      await history.add('second');
      await history.add('first'); // duplicate
      
      const recent = await history.getRecent(10);
      expect(recent[0]).toBe('first'); // now at top
      expect(recent[1]).toBe('second');
    });
  });

  describe('getRecent()', () => {
    it('should return only prompt strings', async () => {
      await history.add('prompt one');
      await history.add('prompt two');
      
      const recent = await history.getRecent(10);
      expect(recent).toEqual(['prompt two', 'prompt one']);
    });

    it('should respect limit parameter', async () => {
      await history.add('one');
      await history.add('two');
      await history.add('three');
      
      const recent = await history.getRecent(2);
      expect(recent).toHaveLength(2);
      expect(recent).toEqual(['three', 'two']);
    });

    it('should return empty array if no history', async () => {
      const recent = await history.getRecent(10);
      expect(recent).toEqual([]);
    });
  });

  describe('favorites', () => {
    it('should add a prompt to favorites', async () => {
      await history.addFavorite('my favorite prompt');
      const favorites = await history.getFavorites();
      expect(favorites).toContain('my favorite prompt');
    });

    it('should not add duplicate favorites', async () => {
      await history.addFavorite('unique');
      await history.addFavorite('unique');
      
      const favorites = await history.getFavorites();
      expect(favorites).toHaveLength(1);
    });

    it('should remove a favorite', async () => {
      await history.addFavorite('to remove');
      await history.removeFavorite('to remove');
      
      const favorites = await history.getFavorites();
      expect(favorites).not.toContain('to remove');
    });
  });
});
