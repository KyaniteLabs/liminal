import { describe, it, expect } from 'vitest';
import {
  sphericalToCartesian,
  cartesianToSpherical,
  radialToCartesian,
  radialToSpherical,
  vec3ToSpherical,
} from '../../../src/nodeprompt/layout/coordinates.js';

// ── sphericalToCartesian ──

describe('sphericalToCartesian', () => {
  it('maps theta=0 to north pole (x=0, z=0, y=radius)', () => {
    const result = sphericalToCartesian(0, 0, 5);
    expect(result.x).toBeCloseTo(0, 10);
    expect(result.y).toBeCloseTo(5, 10);
    expect(result.z).toBeCloseTo(0, 10);
  });

  it('maps theta=PI to south pole (x=0, z=0, y=-radius)', () => {
    const result = sphericalToCartesian(Math.PI, 0, 5);
    expect(result.x).toBeCloseTo(0, 10);
    expect(result.y).toBeCloseTo(-5, 10);
    expect(result.z).toBeCloseTo(0, 10);
  });

  it('maps theta=PI/2, phi=0 to +X axis', () => {
    const result = sphericalToCartesian(Math.PI / 2, 0, 3);
    expect(result.x).toBeCloseTo(3, 10);
    expect(result.y).toBeCloseTo(0, 10);
    expect(result.z).toBeCloseTo(0, 10);
  });

  it('maps theta=PI/2, phi=PI/2 to +Z axis', () => {
    const result = sphericalToCartesian(Math.PI / 2, Math.PI / 2, 3);
    expect(result.x).toBeCloseTo(0, 10);
    expect(result.y).toBeCloseTo(0, 10);
    expect(result.z).toBeCloseTo(3, 10);
  });

  it('returns zero vector for zero radius', () => {
    const result = sphericalToCartesian(1.5, 2.0, 0);
    expect(result.x).toBeCloseTo(0, 10);
    expect(result.y).toBeCloseTo(0, 10);
    expect(result.z).toBeCloseTo(0, 10);
  });

  it('roundtrips through cartesianToSpherical', () => {
    const theta = 1.23;
    const phi = 4.56;
    const radius = 7.89;
    const cart = sphericalToCartesian(theta, phi, radius);
    const sph = cartesianToSpherical(cart.x, cart.y, cart.z);
    expect(sph.theta).toBeCloseTo(theta, 10);
    expect(sph.phi).toBeCloseTo(phi, 10);
    expect(sph.r).toBeCloseTo(radius, 10);
  });
});

// ── cartesianToSpherical ──

describe('cartesianToSpherical', () => {
  it('returns {theta:0, phi:0, r:0} for zero vector', () => {
    const result = cartesianToSpherical(0, 0, 0);
    expect(result).toEqual({ theta: 0, phi: 0, r: 0 });
  });

  it('returns r=1 for unit vectors', () => {
    const result = cartesianToSpherical(1, 0, 0);
    expect(result.r).toBeCloseTo(1, 10);
  });

  it('roundtrips through sphericalToCartesian', () => {
    const x = 1.5, y = 2.3, z = -0.7;
    const sph = cartesianToSpherical(x, y, z);
    const cart = sphericalToCartesian(sph.theta, sph.phi, sph.r);
    expect(cart.x).toBeCloseTo(x, 10);
    expect(cart.y).toBeCloseTo(y, 10);
    expect(cart.z).toBeCloseTo(z, 10);
  });

  it('computes correct radius', () => {
    const result = cartesianToSpherical(3, 4, 0);
    // sqrt(9 + 16) = 5
    expect(result.r).toBeCloseTo(5, 10);
  });

  it('computes correct theta for +Y axis', () => {
    const result = cartesianToSpherical(0, 5, 0);
    expect(result.theta).toBeCloseTo(0, 10);
  });

  it('computes correct theta for -Y axis', () => {
    const result = cartesianToSpherical(0, -5, 0);
    expect(result.theta).toBeCloseTo(Math.PI, 10);
  });

  it('handles negative coordinates', () => {
    const result = cartesianToSpherical(-3, -4, -5);
    expect(result.r).toBeCloseTo(Math.sqrt(9 + 16 + 25), 10);
    expect(result.theta).toBeGreaterThan(Math.PI / 2);
  });
});

// ── radialToCartesian ──

describe('radialToCartesian', () => {
  it('returns y=0 (flat disc output)', () => {
    const result = radialToCartesian(1.0, 0.5, 10);
    expect(result.y).toBe(0);
  });

  it('returns origin for depth=0', () => {
    const result = radialToCartesian(1.0, 0, 10);
    expect(result.x).toBeCloseTo(0, 10);
    expect(result.y).toBe(0);
    expect(result.z).toBeCloseTo(0, 10);
  });

  it('returns maxRadius distance for depth=1', () => {
    const result = radialToCartesian(0, 1, 7);
    expect(result.x).toBeCloseTo(7, 10);
    expect(result.y).toBe(0);
    expect(result.z).toBeCloseTo(0, 10);
  });

  it('wraps angle correctly at PI/2', () => {
    const result = radialToCartesian(Math.PI / 2, 1, 5);
    expect(result.x).toBeCloseTo(0, 10);
    expect(result.y).toBe(0);
    expect(result.z).toBeCloseTo(5, 10);
  });

  it('handles angle=PI (negative x)', () => {
    const result = radialToCartesian(Math.PI, 1, 5);
    expect(result.x).toBeCloseTo(-5, 10);
    expect(result.z).toBeCloseTo(0, 10);
  });

  it('zero maxRadius returns origin', () => {
    const result = radialToCartesian(2.0, 0.5, 0);
    // Math.cos/sin can return -0; use toBeCloseTo for 0/-0 tolerance
    expect(result.x).toBeCloseTo(0, 10);
    expect(result.y).toBeCloseTo(0, 10);
    expect(result.z).toBeCloseTo(0, 10);
  });
});

// ── radialToSpherical ──

describe('radialToSpherical', () => {
  it('returns theta=0 for depth=0', () => {
    const result = radialToSpherical(1.0, 0, 5);
    expect(result.theta).toBeCloseTo(0, 10);
  });

  it('returns theta=PI for depth=maxDepth', () => {
    const result = radialToSpherical(1.0, 5, 5);
    expect(result.theta).toBeCloseTo(Math.PI, 10);
  });

  it('preserves angle as phi', () => {
    const result = radialToSpherical(2.5, 2, 4);
    expect(result.phi).toBeCloseTo(2.5, 10);
  });

  it('returns zero values for maxDepth=0', () => {
    const result = radialToSpherical(1.0, 3, 0);
    expect(result.theta).toBeCloseTo(0, 10);
    expect(result.phi).toBeCloseTo(1.0, 10);
  });

  it('scales theta linearly with depth', () => {
    const r1 = radialToSpherical(0, 1, 4);
    const r2 = radialToSpherical(0, 2, 4);
    expect(r2.theta).toBeCloseTo(r1.theta * 2, 10);
  });
});

// ── vec3ToSpherical ──

describe('vec3ToSpherical', () => {
  it('delegates to cartesianToSpherical correctly', () => {
    const v = { x: 1, y: 2, z: 3 };
    const direct = cartesianToSpherical(v.x, v.y, v.z);
    const viaVec3 = vec3ToSpherical(v);
    expect(viaVec3.theta).toBeCloseTo(direct.theta, 10);
    expect(viaVec3.phi).toBeCloseTo(direct.phi, 10);
    expect(viaVec3.r).toBeCloseTo(direct.r, 10);
  });

  it('returns zero for zero vector', () => {
    const result = vec3ToSpherical({ x: 0, y: 0, z: 0 });
    expect(result).toEqual({ theta: 0, phi: 0, r: 0 });
  });
});
