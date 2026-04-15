/**
 * ParticleSystem unit tests.
 * Covers all configuration branches, code generation, and edge cases.
 */
import { describe, it, expect } from 'vitest';
import { ParticleSystem } from '../../../src/generators/p5/ParticleSystem.js';

// ---------------------------------------------------------------------------
// Basic output structure
// ---------------------------------------------------------------------------
describe('ParticleSystem.generate', () => {
  it('returns a non-empty string by default', () => {
    const result = ParticleSystem.generate();
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(100);
  });

  it('returns valid output for null input', () => {
    const result = ParticleSystem.generate(null);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(100);
  });

  it('returns valid output for undefined input', () => {
    const result = ParticleSystem.generate(undefined);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(100);
  });

  it('returns valid output for empty object', () => {
    const result = ParticleSystem.generate({});
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(100);
  });

  it('returns valid output for non-object input (number)', () => {
    const result = ParticleSystem.generate(42);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(100);
  });
});

// ---------------------------------------------------------------------------
// p5.js structural patterns
// ---------------------------------------------------------------------------
describe('ParticleSystem output contains p5.js structure', () => {
  it('contains function setup()', () => {
    const result = ParticleSystem.generate();
    expect(result).toMatch(/function\s+setup\s*\(/);
  });

  it('contains function draw()', () => {
    const result = ParticleSystem.generate();
    expect(result).toMatch(/function\s+draw\s*\(/);
  });

  it('contains createCanvas()', () => {
    const result = ParticleSystem.generate();
    expect(result).toContain('createCanvas');
  });

  it('contains Particle class', () => {
    const result = ParticleSystem.generate();
    expect(result).toMatch(/class\s+Particle/);
  });

  it('contains particles array', () => {
    const result = ParticleSystem.generate();
    expect(result).toContain('let particles = []');
  });
});

// ---------------------------------------------------------------------------
// Default configuration values
// ---------------------------------------------------------------------------
describe('ParticleSystem default config values', () => {
  it('uses 600x400 canvas by default', () => {
    const result = ParticleSystem.generate();
    expect(result).toContain('createCanvas(600, 400)');
  });

  it('uses 100 particles by default', () => {
    const result = ParticleSystem.generate();
    expect(result).toContain('i < 100');
  });

  it('uses RGB color mode by default', () => {
    const result = ParticleSystem.generate();
    expect(result).toContain('RGB color mode');
  });

  it('uses velocity color mapping by default', () => {
    const result = ParticleSystem.generate();
    expect(result).toContain('speed = sqrt');
  });

  it('uses wrap boundary by default', () => {
    const result = ParticleSystem.generate();
    expect(result).toContain('Wrap around edges');
  });
});

// ---------------------------------------------------------------------------
// Custom dimensions
// ---------------------------------------------------------------------------
describe('ParticleSystem custom dimensions', () => {
  it('uses custom width and height', () => {
    const result = ParticleSystem.generate({ width: 800, height: 600 });
    expect(result).toContain('createCanvas(800, 600)');
  });

  it('uses custom particle count', () => {
    const result = ParticleSystem.generate({ particleCount: 200 });
    expect(result).toContain('i < 200');
  });
});

// ---------------------------------------------------------------------------
// Color modes
// ---------------------------------------------------------------------------
describe('ParticleSystem color modes', () => {
  it('HSB color mode is included when colorMode is HSB', () => {
    const result = ParticleSystem.generate({ colorMode: 'HSB' });
    expect(result).toContain('colorMode(HSB)');
  });

  it('RGB color mode includes RGB comment', () => {
    const result = ParticleSystem.generate({ colorMode: 'RGB' });
    expect(result).toContain('RGB color mode');
  });
});

// ---------------------------------------------------------------------------
// Color mappings
// ---------------------------------------------------------------------------
describe('ParticleSystem color mappings', () => {
  it('velocity mapping produces speed-based color code', () => {
    const result = ParticleSystem.generate({ colorMapping: 'velocity' });
    expect(result).toContain('speed = sqrt');
    expect(result).toContain('lerpColor');
  });

  it('position mapping produces position-based color code', () => {
    const result = ParticleSystem.generate({ colorMapping: 'position' });
    expect(result).toContain('posX = this.x / width');
    expect(result).toContain('posY = this.y / height');
  });

  it('age mapping produces age-based color code', () => {
    const result = ParticleSystem.generate({ colorMapping: 'age' });
    expect(result).toContain('this.age++');
    expect(result).toContain('ageRatio = this.age');
  });

  it('none mapping produces no color update code', () => {
    const result = ParticleSystem.generate({ colorMapping: 'none' });
    expect(result).not.toContain('speed = sqrt');
    expect(result).not.toContain('posX = this.x / width');
    expect(result).not.toContain('this.age++');
  });
});

// ---------------------------------------------------------------------------
// Palettes
// ---------------------------------------------------------------------------
describe('ParticleSystem palettes', () => {
  it('warm palette uses warm color comment', () => {
    const result = ParticleSystem.generate({ palette: 'warm' });
    expect(result).toContain('warm colors');
  });

  it('cool palette uses cool color comment', () => {
    const result = ParticleSystem.generate({ palette: 'cool' });
    expect(result).toContain('cool colors');
  });

  it('monochrome palette uses grayscale comment', () => {
    const result = ParticleSystem.generate({ palette: 'monochrome' });
    expect(result).toContain('monochrome grayscale');
  });

  it('default palette uses RGB full spectrum comment', () => {
    const result = ParticleSystem.generate({ palette: 'default' });
    expect(result).toContain('RGB full spectrum');
  });

  it('warm palette generates warm background', () => {
    const result = ParticleSystem.generate({ palette: 'warm' });
    expect(result).toMatch(/background\(30\)/);
  });

  it('cool palette generates cool background', () => {
    const result = ParticleSystem.generate({ palette: 'cool' });
    expect(result).toMatch(/background\(20\)/);
  });

  it('monochrome palette generates gray background', () => {
    const result = ParticleSystem.generate({ palette: 'monochrome' });
    expect(result).toMatch(/background\(128\)/);
  });
});

// ---------------------------------------------------------------------------
// Boundary behaviors
// ---------------------------------------------------------------------------
describe('ParticleSystem boundary behaviors', () => {
  it('wrap boundary uses wrap logic', () => {
    const result = ParticleSystem.generate({ boundary: 'wrap' });
    expect(result).toContain('Wrap around edges');
    expect(result).toContain('this.x = width');
    expect(result).toContain('this.x = 0');
  });

  it('bounce boundary uses bounce logic', () => {
    const result = ParticleSystem.generate({ boundary: 'bounce' });
    expect(result).toContain('Bounce off edges');
    expect(result).toContain('this.vx *= -1');
    expect(result).toContain('constrain');
  });
});

// ---------------------------------------------------------------------------
// Forces
// ---------------------------------------------------------------------------
describe('ParticleSystem forces', () => {
  it('gravity adds downward force on vy', () => {
    const result = ParticleSystem.generate({ gravity: 0.5 });
    expect(result).toContain('Gravity');
    expect(result).toContain('this.vy += 0.5');
  });

  it('no gravity by default produces no gravity code', () => {
    const result = ParticleSystem.generate({ gravity: 0 });
    expect(result).not.toContain('this.vy +=');
  });

  it('friction adds velocity damping', () => {
    const result = ParticleSystem.generate({ friction: 0.95 });
    expect(result).toContain('Friction');
    expect(result).toContain('this.vx *= 0.95');
    expect(result).toContain('this.vy *= 0.95');
  });

  it('attraction adds attraction force code', () => {
    const result = ParticleSystem.generate({ attraction: true, attractionStrength: 0.8 });
    expect(result).toContain('Attraction force');
    expect(result).toContain('0.8 / dist');
  });

  it('repulsion adds repulsion force code', () => {
    const result = ParticleSystem.generate({ repulsion: true, repulsionStrength: 0.6 });
    expect(result).toContain('Repulsion force');
    expect(result).toContain('0.6 / rdist');
  });

  it('mouseAttraction adds mouse interaction code', () => {
    const result = ParticleSystem.generate({ mouseAttraction: true });
    expect(result).toContain('Mouse attraction');
    expect(result).toContain('mouseX');
    expect(result).toContain('mouseY');
  });

  it('attraction and repulsion together add applyForce helper', () => {
    const result = ParticleSystem.generate({ attraction: true, repulsion: true });
    expect(result).toContain('applyForce(fx, fy)');
  });
});

// ---------------------------------------------------------------------------
// Trails
// ---------------------------------------------------------------------------
describe('ParticleSystem trails', () => {
  it('trails enabled uses transparent background', () => {
    const result = ParticleSystem.generate({ trails: true });
    expect(result).toContain('background(0, 0, 0, 20)');
  });

  it('trails disabled uses standard background', () => {
    const result = ParticleSystem.generate({ trails: false });
    expect(result).not.toContain('background(0, 0, 0, 20)');
  });
});

// ---------------------------------------------------------------------------
// Lifespan and emission
// ---------------------------------------------------------------------------
describe('ParticleSystem lifespan and emission', () => {
  it('lifespan > 0 generates death check code', () => {
    const result = ParticleSystem.generate({ lifespan: 200 });
    expect(result).toContain('particles[i].lifespan < 1');
    expect(result).toContain('particles.splice(i, 1)');
  });

  it('lifespan = 0 omits death check code', () => {
    const result = ParticleSystem.generate({ lifespan: 0 });
    expect(result).not.toContain('particles[i].lifespan < 1');
  });

  it('emissionRate > 0 generates particle emission code', () => {
    const result = ParticleSystem.generate({ emissionRate: 5 });
    expect(result).toContain('Emit new particles');
    expect(result).toContain('particles.push(new Particle())');
  });

  it('emissionRate = 0 omits emission code', () => {
    const result = ParticleSystem.generate({ emissionRate: 0 });
    expect(result).not.toContain('Emit new particles');
  });
});

// ---------------------------------------------------------------------------
// Push/pop matrix
// ---------------------------------------------------------------------------
describe('ParticleSystem pushMatrix', () => {
  it('usePushMatrix = true adds push() and pop()', () => {
    const result = ParticleSystem.generate({ usePushMatrix: true });
    expect(result).toContain('push()');
    expect(result).toContain('pop()');
  });

  it('usePushMatrix = false omits push() and pop()', () => {
    const result = ParticleSystem.generate({ usePushMatrix: false });
    expect(result).not.toContain('push()');
    expect(result).not.toContain('pop()');
  });
});

// ---------------------------------------------------------------------------
// Custom colors and effects
// ---------------------------------------------------------------------------
describe('ParticleSystem custom colors and effects', () => {
  it('custom colors array is used when provided', () => {
    // Provide a single color so the random pick always selects it
    const result = ParticleSystem.generate({ colors: ['255,0,0'] });
    expect(result).toContain('255,0,0');
  });

  it('custom effect is included in constructor extras', () => {
    const result = ParticleSystem.generate({ customEffect: 'glow' });
    expect(result).toContain('Custom effect: glow');
  });

  it('physics config adds physics customization comment', () => {
    const result = ParticleSystem.generate({ physics: { drag: 0.1 } });
    expect(result).toContain('Physics customization enabled');
  });

  it('visual config adds visual customization comment', () => {
    const result = ParticleSystem.generate({ visual: { glow: true } });
    expect(result).toContain('Visual customization enabled');
  });
});

// ---------------------------------------------------------------------------
// Description handling
// ---------------------------------------------------------------------------
describe('ParticleSystem description', () => {
  it('includes description in header when provided', () => {
    const result = ParticleSystem.generate({ description: 'Fire particles' });
    expect(result).toContain('Description: Fire particles');
  });

  it('omits description line when empty', () => {
    const result = ParticleSystem.generate({ description: '' });
    expect(result).not.toContain('Description:');
  });

  it('truncates long descriptions to 100 chars', () => {
    const longDesc = 'X'.repeat(200);
    const result = ParticleSystem.generate({ description: longDesc });
    expect(result).toContain('X'.repeat(100));
    expect(result).not.toContain('X'.repeat(101));
  });
});

// ---------------------------------------------------------------------------
// Edge cases with invalid parameters
// ---------------------------------------------------------------------------
describe('ParticleSystem handles edge cases', () => {
  it('clamps negative particle count to 0 (Math.max)', () => {
    const result = ParticleSystem.generate({ particleCount: -10 });
    expect(result).toContain('i < 0');
  });

  it('handles NaN particle count by using default 100', () => {
    const result = ParticleSystem.generate({ particleCount: NaN });
    expect(result).toContain('i < 100');
  });

  it('handles Infinity particle count by using default 100', () => {
    const result = ParticleSystem.generate({ particleCount: Infinity });
    expect(result).toContain('i < 100');
  });

  it('handles string width by using default 600', () => {
    const result = ParticleSystem.generate({ width: 'not-a-number' as unknown });
    expect(result).toContain('createCanvas(600, 400)');
  });

  it('handles non-array colors gracefully', () => {
    const result = ParticleSystem.generate({ colors: 'not-an-array' as unknown });
    // Falls back to palette-based color generation
    expect(result).toContain('random(255), random(255), random(255)');
  });
});
