import { describe, it, expect } from 'vitest';
import { ReviewManager } from '../../../src/agent/ReviewManager.js';

describe('ReviewManager', () => {
  describe('addCandidate', () => {
    it('creates a candidate with pending status', () => {
      const rm = new ReviewManager();
      const c = rm.addCandidate('sess-1', 'Shader v1', 'void main() {}', 0.85);
      expect(c.status).toBe('pending');
      expect(c.label).toBe('Shader v1');
      expect(c.score).toBe(0.85);
      expect(c.sessionId).toBe('sess-1');
    });

    it('generates unique IDs for each candidate', () => {
      const rm = new ReviewManager();
      const c1 = rm.addCandidate('s1', 'A', 'content', 0.5);
      const c2 = rm.addCandidate('s1', 'B', 'content', 0.6);
      expect(c1.id).not.toBe(c2.id);
    });

    it('stores the candidate for later retrieval', () => {
      const rm = new ReviewManager();
      const c = rm.addCandidate('sess-1', 'Art', 'glsl code', 0.9);
      expect(rm.get(c.id)).toEqual(c);
    });
  });

  describe('accept', () => {
    it('marks a candidate as accepted', () => {
      const rm = new ReviewManager();
      const c = rm.addCandidate('sess-1', 'A', 'code', 0.8);
      const result = rm.accept(c.id);
      expect(result?.status).toBe('accepted');
      expect(rm.get(c.id)?.status).toBe('accepted');
    });

    it('returns null for nonexistent candidate', () => {
      const rm = new ReviewManager();
      expect(rm.accept('nope')).toBeNull();
    });
  });

  describe('reject', () => {
    it('marks a candidate as rejected', () => {
      const rm = new ReviewManager();
      const c = rm.addCandidate('sess-1', 'A', 'code', 0.7);
      rm.reject(c.id);
      expect(rm.get(c.id)?.status).toBe('rejected');
    });

    it('returns null for nonexistent candidate', () => {
      const rm = new ReviewManager();
      expect(rm.reject('nope')).toBeNull();
    });
  });

  describe('pin / unpin', () => {
    it('pins a candidate to favorites', () => {
      const rm = new ReviewManager();
      const c = rm.addCandidate('sess-1', 'A', 'code', 0.9);
      expect(rm.pin(c.id)).toBe(true);
      expect(rm.listFavorites()).toContain(c.id);
    });

    it('returns false when pinning a nonexistent candidate', () => {
      const rm = new ReviewManager();
      expect(rm.pin('nope')).toBe(false);
    });

    it('unpins a candidate from favorites', () => {
      const rm = new ReviewManager();
      const c = rm.addCandidate('sess-1', 'A', 'code', 0.9);
      rm.pin(c.id);
      rm.unpin(c.id);
      expect(rm.listFavorites()).not.toContain(c.id);
    });

    it('unpin is idempotent for unknown IDs', () => {
      const rm = new ReviewManager();
      expect(() => rm.unpin('nope')).not.toThrow();
    });
  });

  describe('list', () => {
    it('returns all candidates sorted by score descending', () => {
      const rm = new ReviewManager();
      rm.addCandidate('s1', 'Low', 'code', 0.3);
      rm.addCandidate('s1', 'High', 'code', 0.9);
      rm.addCandidate('s1', 'Mid', 'code', 0.6);
      const list = rm.list();
      expect(list.map(c => c.score)).toEqual([0.9, 0.6, 0.3]);
    });

    it('filters by session ID', () => {
      const rm = new ReviewManager();
      rm.addCandidate('s1', 'A', 'code', 0.5);
      rm.addCandidate('s2', 'B', 'code', 0.8);
      const results = rm.list({ sessionId: 's2' });
      expect(results).toHaveLength(1);
      expect(results[0].sessionId).toBe('s2');
    });

    it('filters by status', () => {
      const rm = new ReviewManager();
      const c1 = rm.addCandidate('s1', 'A', 'code', 0.5);
      const c2 = rm.addCandidate('s1', 'B', 'code', 0.8);
      rm.accept(c1.id);
      rm.reject(c2.id);
      const accepted = rm.list({ status: 'accepted' });
      expect(accepted).toHaveLength(1);
      expect(accepted[0].id).toBe(c1.id);
    });

    it('returns empty array when no candidates match', () => {
      const rm = new ReviewManager();
      expect(rm.list({ sessionId: 'none' })).toEqual([]);
    });
  });

  describe('clearSession', () => {
    it('removes all candidates for a session', () => {
      const rm = new ReviewManager();
      rm.addCandidate('s1', 'A', 'code', 0.5);
      rm.addCandidate('s1', 'B', 'code', 0.6);
      rm.addCandidate('s2', 'C', 'code', 0.7);
      rm.clearSession('s1');
      expect(rm.list({ sessionId: 's1' })).toHaveLength(0);
      expect(rm.list({ sessionId: 's2' })).toHaveLength(1);
    });

    it('removes favorites for cleared session candidates', () => {
      const rm = new ReviewManager();
      const c = rm.addCandidate('s1', 'A', 'code', 0.9);
      rm.pin(c.id);
      rm.clearSession('s1');
      expect(rm.listFavorites()).not.toContain(c.id);
    });
  });
});
