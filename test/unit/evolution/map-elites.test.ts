/**
 * MAP-Elites tests
 */

import { MapElites } from '../../../src/evolution/MapElites.js';

describe('MapElites', () => {
  it('constructor defaults to 10x10', () => {
    const me = new MapElites();
    expect(me.size()).toBe(0);
    // 10x10 grid => coverage denominator is 100
    me.insert('a', [0, 0], 1);
    expect(me.coverage()).toBe(1 / 100);
  });

  it('constructor accepts custom dims', () => {
    const me = new MapElites([5, 5]);
    me.insert('a', [0, 0], 1);
    expect(me.coverage()).toBe(1 / 25);
  });

  it('insert adds to empty cell and returns true', () => {
    const me = new MapElites();
    const result = me.insert('a', [0.5, 0.5], 0.8);
    expect(result).toBe(true);
    expect(me.size()).toBe(1);
  });

  it('insert replaces if higher fitness and returns true', () => {
    const me = new MapElites();
    me.insert('a', [0.3, 0.3], 0.5);
    const result = me.insert('b', [0.3, 0.3], 0.9);
    expect(result).toBe(true);
    expect(me.size()).toBe(1);
    // [0.3, 0.3] -> Math.floor(0.3 * 9) = 2
    const cell = me.get(2, 2);
    expect(cell?.creationId).toBe('b');
    expect(cell?.fitness).toBe(0.9);
  });

  it('insert rejects if lower fitness and returns false', () => {
    const me = new MapElites();
    me.insert('a', [0.3, 0.3], 0.9);
    const result = me.insert('b', [0.3, 0.3], 0.5);
    expect(result).toBe(false);
    expect(me.size()).toBe(1);
    expect(me.get(2, 2)?.creationId).toBe('a');
  });

  it('get returns cell at coordinates', () => {
    const me = new MapElites();
    me.insert('a', [0.0, 0.0], 0.7);
    const cell = me.get(0, 0);
    expect(cell).not.toBeNull();
    expect(cell!.creationId).toBe('a');
    expect(cell!.fitness).toBe(0.7);
  });

  it('get returns null for empty cell', () => {
    const me = new MapElites();
    expect(me.get(5, 5)).toBeNull();
  });

  it('getElites returns top N sorted by fitness desc', () => {
    const me = new MapElites();
    me.insert('low', [0.0, 0.0], 0.1);
    me.insert('mid', [0.5, 0.5], 0.5);
    me.insert('high', [1.0, 1.0], 0.9);
    const elites = me.getElites(2);
    expect(elites).toHaveLength(2);
    expect(elites[0].creationId).toBe('high');
    expect(elites[0].fitness).toBe(0.9);
    expect(elites[1].creationId).toBe('mid');
    expect(elites[1].fitness).toBe(0.5);
  });

  it('coverage calculates correctly (0 when empty, increases with inserts)', () => {
    const me = new MapElites([4, 4]);
    expect(me.coverage()).toBe(0);
    me.insert('a', [0.0, 0.0], 1);
    expect(me.coverage()).toBe(1 / 16);
    me.insert('b', [1.0, 1.0], 1);
    expect(me.coverage()).toBe(2 / 16);
  });

  it('size returns occupied cell count', () => {
    const me = new MapElites();
    expect(me.size()).toBe(0);
    me.insert('a', [0.0, 0.0], 1);
    expect(me.size()).toBe(1);
    me.insert('b', [1.0, 1.0], 1);
    expect(me.size()).toBe(2);
    // Same cell doesn't increase size
    me.insert('c', [0.0, 0.0], 2);
    expect(me.size()).toBe(2);
  });

  it('clear empties the grid', () => {
    const me = new MapElites();
    me.insert('a', [0.5, 0.5], 1);
    expect(me.size()).toBe(1);
    me.clear();
    expect(me.size()).toBe(0);
    expect(me.coverage()).toBe(0);
    expect(me.get(5, 5)).toBeNull();
  });

  it('behaviorToCell clamps behavior values to valid range', () => {
    const me = new MapElites([10, 10]);
    // Values outside [0, 1] should be clamped
    me.insert('neg', [-1, -1], 1);
    expect(me.get(0, 0)?.creationId).toBe('neg');

    me.insert('pos', [2, 2], 1);
    expect(me.get(9, 9)?.creationId).toBe('pos');

    me.insert('mid', [0.5, 0.5], 1);
    expect(me.get(4, 4)?.creationId).toBe('mid');
  });

  it('getAllCells returns all occupied cells', () => {
    const me = new MapElites();
    me.insert('a', [0.0, 0.0], 0.3);
    me.insert('b', [1.0, 1.0], 0.8);
    const cells = me.getAllCells();
    expect(cells).toHaveLength(2);
    const ids = cells.map((c) => c.creationId).sort();
    expect(ids).toEqual(['a', 'b']);
  });
});
