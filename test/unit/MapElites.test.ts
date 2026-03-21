import { describe, it, expect } from 'vitest';
/**
 * MapElites unit tests
 */

import { MapElites } from '../../src/evolution/MapElites.js';

describe('MapElites', () => {
  describe('insert', () => {
    it('should insert into empty grid', () => {
      const map = new MapElites([5, 5]);
      expect(map.insert('a', [0.5, 0.5], 0.8)).toBe(true);
      expect(map.size()).toBe(1);
    });

    it('should replace lower fitness', () => {
      const map = new MapElites([5, 5]);
      map.insert('a', [0.5, 0.5], 0.5);
      expect(map.insert('b', [0.5, 0.5], 0.9)).toBe(true);
      expect(map.size()).toBe(1);
    });

    it('should not replace higher fitness', () => {
      const map = new MapElites([5, 5]);
      map.insert('a', [0.5, 0.5], 0.9);
      expect(map.insert('b', [0.5, 0.5], 0.3)).toBe(false);
      expect(map.size()).toBe(1);
    });

    it('should insert into different cells', () => {
      const map = new MapElites([5, 5]);
      map.insert('a', [0.0, 0.0], 0.5);
      map.insert('b', [0.5, 0.5], 0.5);
      map.insert('c', [1.0, 1.0], 0.5);
      expect(map.size()).toBe(3);
    });
  });

  describe('get', () => {
    it('should return cell at coordinates', () => {
      const map = new MapElites([5, 5]);
      map.insert('a', [0.5, 0.5], 0.8);
      const cell = map.get(2, 2);
      expect(cell).not.toBeNull();
      expect(cell!.creationId).toBe('a');
      expect(cell!.fitness).toBe(0.8);
    });

    it('should return null for empty cell', () => {
      const map = new MapElites([5, 5]);
      expect(map.get(0, 0)).toBeNull();
    });
  });

  describe('getElites', () => {
    it('should return top N by fitness', () => {
      const map = new MapElites([5, 5]);
      map.insert('low', [0.0, 0.0], 0.2);
      map.insert('mid', [0.5, 0.5], 0.5);
      map.insert('high', [1.0, 1.0], 0.9);
      map.insert('higher', [0.3, 0.7], 0.95);

      const elites = map.getElites(2);
      expect(elites).toHaveLength(2);
      expect(elites[0].creationId).toBe('higher');
      expect(elites[0].fitness).toBe(0.95);
      expect(elites[1].creationId).toBe('high');
    });
  });

  describe('coverage', () => {
    it('should calculate fraction of occupied cells', () => {
      const map = new MapElites([10, 10]);
      expect(map.coverage()).toBe(0);
      map.insert('a', [0.5, 0.5], 0.5);
      expect(map.coverage()).toBe(1 / 100);
      map.insert('b', [0.0, 0.0], 0.5);
      expect(map.coverage()).toBe(2 / 100);
    });
  });

  describe('clear', () => {
    it('should remove all cells', () => {
      const map = new MapElites([5, 5]);
      map.insert('a', [0.5, 0.5], 0.5);
      map.insert('b', [0.0, 0.0], 0.5);
      map.clear();
      expect(map.size()).toBe(0);
      expect(map.coverage()).toBe(0);
    });
  });

  describe('behavior mapping', () => {
    it('should clamp behavior to grid boundaries', () => {
      const map = new MapElites([3, 3]);
      // -1 should map to 0, 2 should map to 2
      map.insert('a', [-1, -1], 0.5);
      map.insert('b', [2, 2], 0.5);
      map.insert('c', [0.5, 0.5], 0.5);
      expect(map.size()).toBe(3);
    });

    it('should map same behavior to same cell', () => {
      const map = new MapElites([10, 10]);
      map.insert('a', [0.123, 0.456], 0.5);
      map.insert('b', [0.123, 0.456], 0.8);
      expect(map.size()).toBe(1); // second replaces first
      expect(map.get(1, 4)!.creationId).toBe('b');
    });
  });
});
