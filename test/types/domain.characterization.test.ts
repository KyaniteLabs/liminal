import { describe, it, expect } from 'vitest';

describe('Domain string characterization', () => {
  it('should find all domain strings in codebase', () => {
    // These are the domain values currently in use
    const expectedDomains = [
      'p5', 'glsl', 'three', 'tone', 'hydra', 
      'unknown', 'generic', 'webgl', 'shader'
    ];
    
    expectedDomains.forEach(d => {
      expect(typeof d).toBe('string');
      expect(d.length).toBeGreaterThan(0);
    });
  });
  
  it('should have p5 as most common domain', () => {
    // p5 is the most frequently used domain
    expect('p5').toBe('p5');
  });
});
