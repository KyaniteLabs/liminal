import { describe, it, expect } from 'vitest';
import { generateFiveVariations } from '../../src/evolution/IGA.js';

describe('generateFiveVariations', () => {
  const validP5 = `function setup() { createCanvas(400, 400); }
function draw() { background(220); circle(200, 200, 50); }`;

  it('returns array of length 5', async () => {
    const generator = async () => validP5;
    const result = await generateFiveVariations('draw a circle', generator);
    expect(result).toHaveLength(5);
  });

  it('returns { code, fitness } for each item', async () => {
    const generator = async () => validP5;
    const result = await generateFiveVariations('draw a circle', generator);
    for (const item of result) {
      expect(item).toHaveProperty('code');
      expect(item).toHaveProperty('fitness');
      expect(typeof item.code).toBe('string');
      expect(typeof item.fitness).toBe('number');
      expect(item.fitness).toBeGreaterThanOrEqual(0);
      expect(item.fitness).toBeLessThanOrEqual(1);
    }
  });
});
