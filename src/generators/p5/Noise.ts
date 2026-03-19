/**
 * Noise - Self-contained OpenSimplex 2D/3D noise implementation
 *
 * Provides smooth, coherent noise functions for generative art.
 * No external dependencies. Deterministic with seed.
 */

// Permutation table
const PERM = new Uint8Array(512);
const GRAD3: [number, number, number][] = [
  [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
  [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
  [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1],
];

/**
 * Initialize permutation table from a seed.
 */
function initPerm(seed: number): void {
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;

  // Fisher-Yates shuffle with seeded random
  let s = seed;
  for (let i = 255; i > 0; i--) {
    s = (s * 16807 + 0) % 2147483647;
    const j = s % (i + 1);
    const tmp = p[i];
    p[i] = p[j];
    p[j] = tmp;
  }

  for (let i = 0; i < 512; i++) {
    PERM[i] = p[i & 255];
  }
}

// Initialize with default seed
initPerm(0);

/**
 * Set the noise seed. Call before using noise functions for reproducibility.
 */
export function noiseSeed(seed: number): void {
  initPerm(seed);
}

/**
 * 2D Simplex-like noise. Returns value in approximately [-1, 1].
 */
export function noise2D(x: number, y: number): number {
  // Skew input space
  const F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
  const s = (x + y) * F2;
  const i = Math.floor(x + s);
  const j = Math.floor(y + s);

  const G2 = (3.0 - Math.sqrt(3.0)) / 6.0;
  const t = (i + j) * G2;
  const X0 = i - t;
  const Y0 = j - t;
  const x0 = x - X0;
  const y0 = y - Y0;

  let i1: number, j1: number;
  if (x0 > y0) { i1 = 1; j1 = 0; }
  else { i1 = 0; j1 = 1; }

  const x1 = x0 - i1 + G2;
  const y1 = y0 - j1 + G2;
  const x2 = x0 - 1.0 + 2.0 * G2;
  const y2 = y0 - 1.0 + 2.0 * G2;

  const ii = i & 255;
  const jj = j & 255;

  let n0 = 0, n1 = 0, n2 = 0;

  let t0 = 0.5 - x0 * x0 - y0 * y0;
  if (t0 > 0) {
    t0 *= t0;
    const gi0 = PERM[ii + PERM[jj]] % 12;
    n0 = t0 * t0 * (GRAD3[gi0][0] * x0 + GRAD3[gi0][1] * y0);
  }

  let t1 = 0.5 - x1 * x1 - y1 * y1;
  if (t1 > 0) {
    t1 *= t1;
    const gi1 = PERM[ii + i1 + PERM[jj + j1]] % 12;
    n1 = t1 * t1 * (GRAD3[gi1][0] * x1 + GRAD3[gi1][1] * y1);
  }

  let t2 = 0.5 - x2 * x2 - y2 * y2;
  if (t2 > 0) {
    t2 *= t2;
    const gi2 = PERM[ii + 1 + PERM[jj + 1]] % 12;
    n2 = t2 * t2 * (GRAD3[gi2][0] * x2 + GRAD3[gi2][1] * y2);
  }

  return 70.0 * (n0 + n1 + n2);
}

/**
 * 3D noise. Returns value in approximately [-1, 1].
 */
export function noise3D(x: number, y: number, z: number): number {
  // Simple hash-based 3D noise
  const F3 = 1.0 / 3.0;
  const s = (x + y + z) * F3;
  const i = Math.floor(x + s);
  const j = Math.floor(y + s);
  const k = Math.floor(z + s);

  const G3 = 1.0 / 6.0;
  const t = (i + j + k) * G3;
  const X0 = i - t;
  const Y0 = j - t;
  const Z0 = k - t;
  const x0 = x - X0;
  const y0 = y - Y0;
  const z0 = z - Z0;

  let i1: number, j1: number, k1: number;
  let i2: number, j2: number, k2: number;

  if (x0 >= y0) {
    if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
    else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; }
    else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; }
  } else {
    if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; }
    else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; }
    else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
  }

  const x1 = x0 - i1 + G3;
  const y1 = y0 - j1 + G3;
  const z1 = z0 - k1 + G3;
  const x2 = x0 - i2 + 2.0 * G3;
  const y2 = y0 - j2 + 2.0 * G3;
  const z2 = z0 - k2 + 2.0 * G3;
  const x3 = x0 - 1.0 + 3.0 * G3;
  const y3 = y0 - 1.0 + 3.0 * G3;
  const z3 = z0 - 1.0 + 3.0 * G3;

  const ii = i & 255;
  const jj = j & 255;
  const kk = k & 255;

  let n0 = 0, n1 = 0, n2 = 0, n3 = 0;

  let t0 = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
  if (t0 > 0) {
    t0 *= t0;
    const gi0 = PERM[ii + PERM[jj + PERM[kk]]] % 12;
    n0 = t0 * t0 * (GRAD3[gi0][0] * x0 + GRAD3[gi0][1] * y0 + GRAD3[gi0][2] * z0);
  }

  let t1 = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
  if (t1 > 0) {
    t1 *= t1;
    const gi1 = PERM[ii + i1 + PERM[jj + j1 + PERM[kk + k1]]] % 12;
    n1 = t1 * t1 * (GRAD3[gi1][0] * x1 + GRAD3[gi1][1] * y1 + GRAD3[gi1][2] * z1);
  }

  let t2 = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
  if (t2 > 0) {
    t2 *= t2;
    const gi2 = PERM[ii + i2 + PERM[jj + j2 + PERM[kk + k2]]] % 12;
    n2 = t2 * t2 * (GRAD3[gi2][0] * x2 + GRAD3[gi2][1] * y2 + GRAD3[gi2][2] * z2);
  }

  let t3 = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
  if (t3 > 0) {
    t3 *= t3;
    const gi3 = PERM[ii + 1 + PERM[jj + 1 + PERM[kk + 1]]] % 12;
    n3 = t3 * t3 * (GRAD3[gi3][0] * x3 + GRAD3[gi3][1] * y3 + GRAD3[gi3][2] * z3);
  }

  return 32.0 * (n0 + n1 + n2 + n3);
}

/**
 * Compute a flow field vector at position (x, y).
 * Uses noise to generate a smooth angle and magnitude.
 *
 * @param x - X position
 * @param y - Y position
 * @param scale - Noise scale (lower = smoother field, default 0.01)
 * @param seed - Optional seed override
 * @returns { angle, magnitude } where angle is in radians
 */
export function flowField(
  x: number,
  y: number,
  scale: number = 0.01,
  seed?: number
): { angle: number; magnitude: number } {
  if (seed !== undefined) {
    noiseSeed(seed);
  }
  const angle = noise2D(x * scale, y * scale) * Math.PI * 4;
  const magnitude = (noise2D(x * scale + 1000, y * scale + 1000) + 1) * 0.5;
  return { angle, magnitude };
}
