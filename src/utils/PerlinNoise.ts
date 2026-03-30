/**
 * PerlinNoise — seeded permutation-based noise for procedural generation.
 *
 * Supports 2D and 3D noise with configurable octaves, persistence, and lacunarity.
 * Deterministic: same seed always produces the same output.
 */

export class PerlinNoise {
  private perm: Uint8Array;

  constructor(seed: number = 42) {
    this.perm = new Uint8Array(512);
    this.seed(seed);
  }

  /** Seed the permutation table. */
  seed(s: number): void {
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;

    // Fisher-Yates shuffle with seed
    for (let i = 255; i > 0; i--) {
      s = (s * 16807 + 0) % 2147483647; // LCG
      const j = s % (i + 1);
      [p[i], p[j]] = [p[j], p[i]];
    }

    // Double the permutation table for overflow
    for (let i = 0; i < 512; i++) {
      this.perm[i] = p[i & 255];
    }
  }

  /** 2D Perlin noise. Returns value in approximately [-1, 1]. */
  noise2D(x: number, y: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = this.fade(xf);
    const v = this.fade(yf);

    const aa = this.perm[this.perm[X] + Y];
    const ab = this.perm[this.perm[X] + Y + 1];
    const ba = this.perm[this.perm[X + 1] + Y];
    const bb = this.perm[this.perm[X + 1] + Y + 1];

    const x1 = this.lerp(this.grad2D(aa, xf, yf), this.grad2D(ba, xf - 1, yf), u);
    const x2 = this.lerp(this.grad2D(ab, xf, yf - 1), this.grad2D(bb, xf - 1, yf - 1), u);

    return this.lerp(x1, x2, v);
  }

  /** 3D Perlin noise. Returns value in approximately [-1, 1]. */
  noise3D(x: number, y: number, z: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const Z = Math.floor(z) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const zf = z - Math.floor(z);
    const u = this.fade(xf);
    const v = this.fade(yf);
    const w = this.fade(zf);

    const aaa = this.perm[this.perm[this.perm[X] + Y] + Z];
    const aba = this.perm[this.perm[this.perm[X] + Y + 1] + Z];
    const aab = this.perm[this.perm[this.perm[X] + Y] + Z + 1];
    const abb = this.perm[this.perm[this.perm[X] + Y + 1] + Z + 1];
    const baa = this.perm[this.perm[this.perm[X + 1] + Y] + Z];
    const bba = this.perm[this.perm[this.perm[X + 1] + Y + 1] + Z];
    const bab = this.perm[this.perm[this.perm[X + 1] + Y] + Z + 1];
    const bbb = this.perm[this.perm[this.perm[X + 1] + Y + 1] + Z + 1];

    const x1 = this.lerp(this.grad3D(aaa, xf, yf, zf), this.grad3D(baa, xf - 1, yf, zf), u);
    const x2 = this.lerp(this.grad3D(aba, xf, yf - 1, zf), this.grad3D(bba, xf - 1, yf - 1, zf), u);
    const y1 = this.lerp(x1, x2, v);

    const x3 = this.lerp(this.grad3D(aab, xf, yf, zf - 1), this.grad3D(bab, xf - 1, yf, zf - 1), u);
    const x4 = this.lerp(this.grad3D(abb, xf, yf - 1, zf - 1), this.grad3D(bbb, xf - 1, yf - 1, zf - 1), u);
    const y2 = this.lerp(x3, x4, v);

    return this.lerp(y1, y2, w);
  }

  /** Octave noise (fractal Brownian motion) in 2D. Returns value in approximately [-1, 1]. */
  octave2D(x: number, y: number, octaves: number = 4, persistence: number = 0.5, lacunarity: number = 2.0): number {
    let total = 0;
    let frequency = 1;
    let amplitude = 1;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      total += this.noise2D(x * frequency, y * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= lacunarity;
    }

    return total / maxValue;
  }

  /** Octave noise (fractal Brownian motion) in 3D. Returns value in approximately [-1, 1]. */
  octave3D(x: number, y: number, z: number, octaves: number = 4, persistence: number = 0.5, lacunarity: number = 2.0): number {
    let total = 0;
    let frequency = 1;
    let amplitude = 1;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      total += this.noise3D(x * frequency, y * frequency, z * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= lacunarity;
    }

    return total / maxValue;
  }

  private fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  private lerp(a: number, b: number, t: number): number {
    return a + t * (b - a);
  }

  private grad2D(hash: number, x: number, y: number): number {
    const h = hash & 3;
    return ((h & 1) === 0 ? x : -x) + ((h & 2) === 0 ? y : -y);
  }

  private grad3D(hash: number, x: number, y: number, z: number): number {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }
}
