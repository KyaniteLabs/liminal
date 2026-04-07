/**
 * NODEPROMPT — Spatial Prompt Engineering through Interactive Concept Graphs
 * Copyright (c) 2025-2026 Taewoo Park
 * Licensed under the MIT License — see THIRD_PARTY_NOTICES.md
 *
 * Fibonacci lattice for uniform point distribution on a sphere.
 * Uses the Roberts (2020) epsilon offset (0.36) to prevent pole clustering.
 */

import type { Vec3 } from '../types/index.js';

const GOLDEN_RATIO = (1 + Math.sqrt(5)) / 2;

/**
 * Generate n approximately uniformly distributed points on a sphere
 * using the Fibonacci spiral method.
 *
 * Reference: Roberts, M. (2020). "Evenly Distributing Points on a Sphere."
 * Uses epsilon offset of 0.36 to shift points away from poles.
 *
 * @param n - Number of points to generate
 * @param radius - Sphere radius
 * @returns Array of Vec3 positions on the sphere surface
 */
export function fibonacciSphere(n: number, radius: number): Vec3[] {
  if (n <= 0) return [];

  const points: Vec3[] = [];
  const epsilon = 0.36;

  for (let i = 0; i < n; i++) {
    // Distribute theta evenly in [-1, 1] with epsilon offset
    const theta = 1 - (2 * (i + epsilon)) / (n - 1 + 2 * epsilon);

    // Golden ratio spiral for azimuthal angle
    const phi = (2 * Math.PI * i) / GOLDEN_RATIO;

    const sqrtFactor = Math.sqrt(Math.max(0, 1 - theta * theta));
    points.push({
      x: radius * sqrtFactor * Math.cos(phi),
      y: radius * theta,
      z: radius * sqrtFactor * Math.sin(phi),
    });
  }

  return points;
}
