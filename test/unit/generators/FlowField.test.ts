/**
 * FlowField unit tests.
 * Covers all configuration branches, palette options, and edge cases.
 */
import { describe, it, expect } from 'vitest';
import { FlowField } from '../../../src/generators/p5/FlowField.js';

// ---------------------------------------------------------------------------
// Basic output structure
// ---------------------------------------------------------------------------
describe('FlowField.generate', () => {
  it('returns a non-empty string by default', () => {
    const result = FlowField.generate();
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(100);
  });

  it('returns valid output for null input', () => {
    const result = FlowField.generate(null);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(100);
  });

  it('returns valid output for undefined input', () => {
    const result = FlowField.generate(undefined);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(100);
  });

  it('returns valid output for empty object', () => {
    const result = FlowField.generate({});
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(100);
  });

  it('returns valid output for non-object input (string)', () => {
    const result = FlowField.generate('bad input');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(100);
  });

  it('returns valid output for non-object input (number)', () => {
    const result = FlowField.generate(42);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(100);
  });
});

// ---------------------------------------------------------------------------
// p5.js structural patterns
// ---------------------------------------------------------------------------
describe('FlowField output contains p5.js structure', () => {
  it('contains function setup()', () => {
    const result = FlowField.generate();
    expect(result).toMatch(/function\s+setup\s*\(/);
  });

  it('contains function draw()', () => {
    const result = FlowField.generate();
    expect(result).toMatch(/function\s+draw\s*\(/);
  });

  it('contains createCanvas()', () => {
    const result = FlowField.generate();
    expect(result).toContain('createCanvas');
  });

  it('contains FlowParticle class', () => {
    const result = FlowField.generate();
    expect(result).toMatch(/class\s+FlowParticle/);
  });

  it('contains particles array', () => {
    const result = FlowField.generate();
    expect(result).toContain('let particles = []');
  });

  it('contains noise() call for angle computation', () => {
    const result = FlowField.generate();
    expect(result).toContain('noise(');
  });

  it('contains TWO_PI reference', () => {
    const result = FlowField.generate();
    expect(result).toContain('TWO_PI');
  });
});

// ---------------------------------------------------------------------------
// Default configuration values
// ---------------------------------------------------------------------------
describe('FlowField default config values', () => {
  it('uses 800x600 canvas by default', () => {
    const result = FlowField.generate();
    expect(result).toContain('createCanvas(800, 600)');
  });

  it('uses 500 particles by default', () => {
    const result = FlowField.generate();
    expect(result).toContain('i < 500');
  });

  it('uses scale 0.005 by default', () => {
    const result = FlowField.generate();
    expect(result).toContain('0.005');
  });

  it('uses speed 2 by default', () => {
    const result = FlowField.generate();
    expect(result).toContain('setMag(2)');
  });

  it('uses trailAlpha 10 by default', () => {
    const result = FlowField.generate();
    expect(result).toContain('background(0, 0, 0, 10)');
  });

  it('uses noiseZOffset 0 by default', () => {
    const result = FlowField.generate();
    expect(result).toContain('let zoff = 0');
  });

  it('uses cool palette by default', () => {
    const result = FlowField.generate();
    expect(result).toContain('random(50, 150), random(100, 200), 255, 200');
  });
});

// ---------------------------------------------------------------------------
// Custom dimensions and parameters
// ---------------------------------------------------------------------------
describe('FlowField custom parameters', () => {
  it('uses custom width and height', () => {
    const result = FlowField.generate({ width: 1024, height: 768 });
    expect(result).toContain('createCanvas(1024, 768)');
  });

  it('uses custom particle count', () => {
    const result = FlowField.generate({ particleCount: 1000 });
    expect(result).toContain('i < 1000');
  });

  it('uses custom scale', () => {
    const result = FlowField.generate({ scale: 0.01 });
    expect(result).toContain('0.01');
  });

  it('uses custom speed', () => {
    const result = FlowField.generate({ speed: 4 });
    expect(result).toContain('setMag(4)');
  });

  it('uses custom trailAlpha', () => {
    const result = FlowField.generate({ trailAlpha: 30 });
    expect(result).toContain('background(0, 0, 0, 30)');
  });

  it('uses custom noiseZOffset', () => {
    const result = FlowField.generate({ noiseZOffset: 0.5 });
    expect(result).toContain('let zoff = 0.5');
  });
});

// ---------------------------------------------------------------------------
// Palette options
// ---------------------------------------------------------------------------
describe('FlowField palette options', () => {
  it('warm palette produces warm color expression', () => {
    const result = FlowField.generate({ palette: 'warm' });
    expect(result).toContain('255, random(100, 200), random(50, 100), 200');
  });

  it('cool palette produces cool color expression', () => {
    const result = FlowField.generate({ palette: 'cool' });
    expect(result).toContain('random(50, 150), random(100, 200), 255, 200');
  });

  it('monochrome palette produces grayscale expression', () => {
    const result = FlowField.generate({ palette: 'monochrome' });
    expect(result).toContain('color(255, 200)');
  });

  it('rainbow palette produces hue-rotating expression', () => {
    const result = FlowField.generate({ palette: 'rainbow' });
    expect(result).toContain('frameCount + random(360)');
  });

  it('unknown palette falls back to monochrome-style', () => {
    const result = FlowField.generate({ palette: 'unknown_palette' });
    expect(result).toContain('color(255, 200)');
  });
});

// ---------------------------------------------------------------------------
// Description handling
// ---------------------------------------------------------------------------
describe('FlowField description', () => {
  it('includes description in header when provided', () => {
    const result = FlowField.generate({ description: 'Ocean currents' });
    expect(result).toContain('Description: Ocean currents');
  });

  it('omits description line when empty', () => {
    const result = FlowField.generate({ description: '' });
    expect(result).not.toContain('Description:');
  });

  it('truncates long descriptions to 100 chars', () => {
    const longDesc = 'Y'.repeat(200);
    const result = FlowField.generate({ description: longDesc });
    expect(result).toContain('Y'.repeat(100));
    expect(result).not.toContain('Y'.repeat(101));
  });
});

// ---------------------------------------------------------------------------
// FlowParticle class structure
// ---------------------------------------------------------------------------
describe('FlowField FlowParticle class', () => {
  it('Particle maxSpeed is speed + 1', () => {
    const result = FlowField.generate({ speed: 5 });
    expect(result).toContain('this.maxSpeed = 6');
  });

  it('Particle has update, edges, show methods', () => {
    const result = FlowField.generate();
    expect(result).toMatch(/update\s*\(\)/);
    expect(result).toMatch(/edges\s*\(\)/);
    expect(result).toMatch(/show\(col\)/);
  });

  it('Particle has applyForce method', () => {
    const result = FlowField.generate();
    expect(result).toMatch(/applyForce\(force\)/);
  });
});

// ---------------------------------------------------------------------------
// Edge cases with invalid parameters
// ---------------------------------------------------------------------------
describe('FlowField handles edge cases', () => {
  it('clamps negative particle count to 0', () => {
    const result = FlowField.generate({ particleCount: -10 });
    expect(result).toContain('i < 0');
  });

  it('handles NaN particle count by using default 500', () => {
    const result = FlowField.generate({ particleCount: NaN });
    expect(result).toContain('i < 500');
  });

  it('handles Infinity particle count by using default 500', () => {
    const result = FlowField.generate({ particleCount: Infinity });
    expect(result).toContain('i < 500');
  });

  it('handles string scale by using default 0.005', () => {
    const result = FlowField.generate({ scale: 'big' as unknown });
    // Default scale is used
    expect(result).toContain('0.005');
  });

  it('handles non-string palette by using default cool', () => {
    const result = FlowField.generate({ palette: 123 as unknown });
    expect(result).toContain('random(50, 150), random(100, 200), 255, 200');
  });

  it('header comment includes particle count and scale', () => {
    const result = FlowField.generate({ particleCount: 300, scale: 0.02 });
    expect(result).toContain('Particles: 300');
    expect(result).toContain('Scale: 0.02');
  });
});
