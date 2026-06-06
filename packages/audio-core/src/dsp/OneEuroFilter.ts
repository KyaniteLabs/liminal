/**
 * One-Euro filter (Casiez, Roussel & Vogel, 2012).
 *
 * An adaptive low-pass filter for noisy interactive signals: it smooths heavily
 * when the value is steady and opens up (low lag) when the value moves fast.
 * Replaces the fixed-coefficient EMA in the Sing pipeline, which forced a
 * jitter-vs-lag tradeoff.
 */

export interface OneEuroOptions {
  /** Minimum cutoff frequency (Hz). Lower = smoother at rest. Default 1.0. */
  minCutoff?: number;
  /** Speed coefficient. Higher = less lag on fast motion. Default 0.01. */
  beta?: number;
  /** Cutoff for the derivative low-pass (Hz). Default 1.0. */
  dCutoff?: number;
}

export class OneEuroFilter {
  private xPrev: number | null = null;
  private dxPrev = 0;
  private tPrev: number | null = null;
  private readonly minCutoff: number;
  private readonly beta: number;
  private readonly dCutoff: number;

  constructor(options: OneEuroOptions = {}) {
    this.minCutoff = options.minCutoff ?? 1.0;
    this.beta = options.beta ?? 0.01;
    this.dCutoff = options.dCutoff ?? 1.0;
  }

  private alpha(cutoff: number, dt: number): number {
    const tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / dt);
  }

  /**
   * Filter one sample observed at `tMs` (milliseconds, monotonically increasing).
   * The first call (or first after reset) returns the input unchanged.
   */
  filter(x: number, tMs: number): number {
    if (this.tPrev === null || this.xPrev === null) {
      this.tPrev = tMs;
      this.xPrev = x;
      return x;
    }

    const dt = Math.max(1e-3, (tMs - this.tPrev) / 1000);
    this.tPrev = tMs;

    const dx = (x - this.xPrev) / dt;
    const aD = this.alpha(this.dCutoff, dt);
    const dxHat = this.dxPrev + aD * (dx - this.dxPrev);
    this.dxPrev = dxHat;

    const cutoff = this.minCutoff + this.beta * Math.abs(dxHat);
    const a = this.alpha(cutoff, dt);
    const xHat = this.xPrev + a * (x - this.xPrev);
    this.xPrev = xHat;
    return xHat;
  }

  reset(): void {
    this.xPrev = null;
    this.dxPrev = 0;
    this.tPrev = null;
  }
}
