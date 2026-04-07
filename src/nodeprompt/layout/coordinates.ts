/**
 * NODEPROMPT — Spatial Prompt Engineering through Interactive Concept Graphs
 * Copyright (c) 2025-2026 Taewoo Park
 * Licensed under the MIT License — see THIRD_PARTY_NOTICES.md
 *
 * Coordinate transform functions for spherical ↔ Cartesian ↔ radial mappings.
 */

import type { Vec3, SphericalCoord } from '../types/index.js';

/**
 * Convert spherical coordinates (theta, phi, radius) to Cartesian (x, y, z).
 * theta: polar angle from +Y axis [0, PI]
 * phi: azimuthal angle in XZ plane [0, 2*PI)
 */
export function sphericalToCartesian(
  theta: number,
  phi: number,
  radius: number,
): Vec3 {
  const sinTheta = Math.sin(theta);
  return {
    x: radius * sinTheta * Math.cos(phi),
    y: radius * Math.cos(theta),
    z: radius * sinTheta * Math.sin(phi),
  };
}

/**
 * Convert Cartesian (x, y, z) to spherical coordinates.
 * Returns theta (polar), phi (azimuthal), and r (radius).
 */
export function cartesianToSpherical(
  x: number,
  y: number,
  z: number,
): SphericalCoord & { r: number } {
  const r = Math.sqrt(x * x + y * y + z * z);
  if (r === 0) {
    return { theta: 0, phi: 0, r: 0 };
  }
  const theta = Math.acos(Math.max(-1, Math.min(1, y / r)));
  let phi = Math.atan2(z, x);
  if (phi < 0) phi += 2 * Math.PI;
  return { theta, phi, r };
}

/**
 * Convert radial coordinates (angle, depth) to Cartesian position.
 * Maps to a flat disc in the XZ plane at height proportional to depth.
 * angle: rotation around Y axis [0, 2*PI)
 * depth: radial distance factor [0, 1]
 * maxRadius: disc radius cap
 */
export function radialToCartesian(
  angle: number,
  depth: number,
  maxRadius: number,
): Vec3 {
  const r = depth * maxRadius;
  return {
    x: r * Math.cos(angle),
    y: 0,
    z: r * Math.sin(angle),
  };
}

/**
 * Convert radial coordinates (angle, depth) to spherical coordinates.
 * angle: rotation around Y axis [0, 2*PI)
 * depth: normalized depth [0, 1]
 * maxDepth: maximum depth value for scaling
 */
export function radialToSpherical(
  angle: number,
  depth: number,
  maxDepth: number,
): SphericalCoord {
  const normalized = maxDepth > 0 ? depth / maxDepth : 0;
  const theta = normalized * Math.PI;
  return {
    theta,
    phi: angle,
  };
}

/**
 * Convert a Vec3 position to spherical coordinates.
 */
export function vec3ToSpherical(v: Vec3): SphericalCoord & { r: number } {
  return cartesianToSpherical(v.x, v.y, v.z);
}
