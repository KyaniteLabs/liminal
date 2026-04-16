/**
 * ReviewManager tests — candidate lifecycle, favorites, filtering
 */
import { describe, it, expect } from 'vitest';
import { ReviewManager } from '../../../src/agent/ReviewManager.js';

describe('ReviewManager', () => {
  describe('addCandidate()', () => {
    it('creates a candidate with pending status', () => {
      const rm = new ReviewManager();
      const c = rm.addCandidate('sess-1', 'gen-v1', 'const x = 1;', 0.85);
      expect(c.id).toMatch(/^candidate-/);
      expect(c.label).toBe('gen-v1');
      expect(c.content).toBe('const x = 1;');
      expect(c.score).toBe(0.85);
      expect(c.status).toBe('pending');
      expect(c.sessionId).toBe('sess-1');
      expect(c.createdAt).toBeTruthy();
    });

    it('generates unique IDs for each candidate', () => {
      const rm = new ReviewManager();
      const c1 = rm.addCandidate('s', 'a', 'code1', 0.5);
      const c2 = rm.addCandidate('s', 'b', 'code2', 0.6);
      expect(c1.id).not.toBe(c2.id);
    });
  });

  describe('accept()', () => {
    it('marks a candidate as accepted', () => {
      const rm = new ReviewManager();
      const c = rm.addCandidate('sess-1', 'gen-v1', 'code', 0.9);
      const result = rm.accept(c.id);
      expect(result).not.toBeNull();
      expect(result!.status).toBe('accepted');
      expect(rm.get(c.id)!.status).toBe('accepted');
    });

    it('returns null for unknown candidate', () => {
      const rm = new ReviewManager();
      expect(rm.accept('nonexistent')).toBeNull();
    });
  });

  describe('reject()', () => {
    it('marks a candidate as rejected', () => {
      const rm = new ReviewManager();
      const c = rm.addCandidate('sess-1', 'gen-v1', 'code', 0.3);
      const result = rm.reject(c.id);
      expect(result!.status).toBe('rejected');
    });

    it('returns null for unknown candidate', () => {
      const rm = new ReviewManager();
      expect(rm.reject('nonexistent')).toBeNull();
    });
  });

  describe('pin() / unpin()', () => {
    it('pins a candidate as favorite', () => {
      const rm = new ReviewManager();
      const c = rm.addCandidate('sess-1', 'fav', 'code', 0.95);
      expect(rm.pin(c.id)).toBe(true);
      expect(rm.listFavorites()).toContain(c.id);
    });

    it('returns false for pinning unknown candidate', () => {
      const rm = new ReviewManager();
      expect(rm.pin('nonexistent')).toBe(false);
    });

    it('unpins a candidate', () => {
      const rm = new ReviewManager();
      const c = rm.addCandidate('sess-1', 'fav', 'code', 0.9);
      rm.pin(c.id);
      rm.unpin(c.id);
      expect(rm.listFavorites()).not.toContain(c.id);
    });
  });

  describe('list()', () => {
    it('returns all candidates sorted by score descending', () => {
      const rm = new ReviewManager();
      rm.addCandidate('s', 'low', 'code', 0.3);
      rm.addCandidate('s', 'high', 'code', 0.9);
      rm.addCandidate('s', 'mid', 'code', 0.6);
      const list = rm.list();
      expect(list).toHaveLength(3);
      expect(list[0].label).toBe('high');
      expect(list[1].label).toBe('mid');
      expect(list[2].label).toBe('low');
    });

    it('filters by session', () => {
      const rm = new ReviewManager();
      rm.addCandidate('s1', 'a', 'code', 0.5);
      rm.addCandidate('s2', 'b', 'code', 0.7);
      const list = rm.list({ sessionId: 's1' });
      expect(list).toHaveLength(1);
      expect(list[0].label).toBe('a');
    });

    it('filters by status', () => {
      const rm = new ReviewManager();
      const c1 = rm.addCandidate('s', 'a', 'code', 0.5);
      rm.addCandidate('s', 'b', 'code', 0.7);
      rm.accept(c1.id);
      const list = rm.list({ status: 'accepted' });
      expect(list).toHaveLength(1);
      expect(list[0].label).toBe('a');
    });

    it('returns empty when no candidates match filter', () => {
      const rm = new ReviewManager();
      rm.addCandidate('s1', 'a', 'code', 0.5);
      expect(rm.list({ sessionId: 's2' })).toHaveLength(0);
    });
  });

  describe('clearSession()', () => {
    it('removes all candidates and favorites for a session', () => {
      const rm = new ReviewManager();
      const c1 = rm.addCandidate('s1', 'a', 'code', 0.8);
      rm.addCandidate('s1', 'b', 'code', 0.7);
      rm.addCandidate('s2', 'c', 'code', 0.9);
      rm.pin(c1.id);
      rm.clearSession('s1');
      expect(rm.list({ sessionId: 's1' })).toHaveLength(0);
      expect(rm.listFavorites()).toHaveLength(0);
      expect(rm.list({ sessionId: 's2' })).toHaveLength(1);
    });
  });

  describe('get()', () => {
    it('returns undefined for unknown id', () => {
      const rm = new ReviewManager();
      expect(rm.get('nonexistent')).toBeUndefined();
    });
  });
});
