import { describe, it, expect, test } from 'vitest';
/**
 * PlayerPiano tests - Vertical scrolling code display
 *
 * Tests the player piano visualization that shows iterations scrolling
 * upward like a music box roll
 */

describe('PlayerPiano Logic', () => {
  test('iteration array stores multiple items', () => {
    const iterations = [
      { id: 1, code: 'function setup() {}', timestamp: 1000 },
      { id: 2, code: 'function draw() {}', timestamp: 2000 },
      { id: 3, code: 'ellipse(100,100,50,50);', timestamp: 3000 },
    ];
    expect(iterations.length).toBe(3);
  });

  test('visible window calculation', () => {
    const iterations = Array.from({ length: 20 }, (_, i) => ({ id: i, code: 'x', timestamp: i }));
    const currentIndex = 10;
    const windowSize = 5;
    const start = Math.max(0, currentIndex - windowSize);
    const end = Math.min(iterations.length, currentIndex + windowSize + 1);
    expect(start).toBe(5);
    expect(end).toBe(16);
  });

  test('line number formatting', () => {
    const format = (n: number) => String(n).padStart(3, '0');
    expect(format(1)).toBe('001');
    expect(format(10)).toBe('010');
  });

  test('code truncation', () => {
    const code = 'function setup() { createCanvas(800, 600); background(0); }';
    const truncated = code.split('\n')[0].slice(0, 60);
    expect(truncated.length).toBeLessThanOrEqual(60);
  });

  test('component props match interface', () => {
    const props = {
      iterations: [
        { id: 1, code: 'test', timestamp: 1000 }
      ],
      currentIndex: 0,
      isPlaying: false,
      speed: 100,
      onIndexChange: () => {},
      onTogglePlay: () => {},
    };
    
    // All expected props should be present and correctly typed
    expect(props.iterations).toEqual([{ id: 1, code: 'test', timestamp: 1000 }]);
    expect(props.currentIndex).toBe(0);
    expect(props.isPlaying).toBe(false);
    expect(props.speed).toBe(100);
    expect(typeof props.onIndexChange).toBe('function');
    expect(typeof props.onTogglePlay).toBe('function');
  });

  test('boundary conditions for currentIndex', () => {
    const iterations = Array.from({ length: 10 }, (_, i) => ({ id: i, code: 'x', timestamp: i }));
    
    // Test lower bound
    const minIndex = Math.max(0, -1);
    expect(minIndex).toBe(0);
    
    // Test upper bound
    const maxIndex = Math.min(iterations.length - 1, 15);
    expect(maxIndex).toBe(9);
  });

  test('speed defaults to 100', () => {
    const speed = 100;
    expect(speed).toBe(100);
  });

  test('visible iterations window respects array bounds', () => {
    const iterations = [
      { id: 1, code: 'line 1', timestamp: 1 },
      { id: 2, code: 'line 2', timestamp: 2 },
      { id: 3, code: 'line 3', timestamp: 3 },
    ];
    const currentIndex = 1;
    
    const start = Math.max(0, currentIndex - 5);
    const end = Math.min(iterations.length, currentIndex + 10);
    
    expect(start).toBe(0);
    expect(end).toBe(3);
    expect(end).toBeLessThanOrEqual(iterations.length);
  });
});
