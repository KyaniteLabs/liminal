/**
 * Vibrato tracker — estimates the rate (Hz) and depth (cents) of pitch
 * modulation from a short history of voiced pitch.
 *
 * Maintains a sliding window of pitch (in cents), de-means it, and finds the
 * dominant modulation period via autocorrelation. Depth is half the
 * peak-to-peak cents deviation.
 */

export interface VibratoEstimate {
  /** Modulation rate in Hz (0 if no vibrato detected). */
  rate: number;
  /** Modulation depth in cents (peak-to-peak / 2). */
  depth: number;
}

const MIN_DEPTH_CENTS = 3; // below this, treat as steady pitch
const MAX_RATE_HZ = 12;
const MIN_RATE_HZ = 2.5;

export class VibratoTracker {
  private readonly historyMs: number;
  private cents: number[] = [];
  private times: number[] = [];

  constructor(historyMs = 800) {
    this.historyMs = historyMs;
  }

  update(pitchHz: number, tMs: number): VibratoEstimate {
    if (!(pitchHz > 0)) return { rate: 0, depth: 0 };

    this.cents.push(1200 * Math.log2(pitchHz / 440));
    this.times.push(tMs);
    // Drop samples older than the window.
    while (this.times.length > 0 && tMs - this.times[0] > this.historyMs) {
      this.times.shift();
      this.cents.shift();
    }

    const n = this.cents.length;
    if (n < 8) return { rate: 0, depth: 0 };

    const mean = this.cents.reduce((a, b) => a + b, 0) / n;
    const dev = this.cents.map((c) => c - mean);
    const depth = (Math.max(...dev) - Math.min(...dev)) / 2;
    if (depth < MIN_DEPTH_CENTS) return { rate: 0, depth };

    const meanDt = (this.times[n - 1] - this.times[0]) / (n - 1) / 1000; // seconds
    if (meanDt <= 0) return { rate: 0, depth };

    const minLag = Math.max(2, Math.round(1 / (MAX_RATE_HZ * meanDt)));
    const maxLag = Math.min(n - 2, Math.round(1 / (MIN_RATE_HZ * meanDt)));
    if (maxLag < minLag) return { rate: 0, depth };

    let bestLag = -1;
    let bestCorr = 0;
    for (let lag = minLag; lag <= maxLag; lag++) {
      let corr = 0;
      for (let i = 0; i < n - lag; i++) corr += dev[i] * dev[i + lag];
      if (corr > bestCorr) {
        bestCorr = corr;
        bestLag = lag;
      }
    }
    if (bestLag < 0 || bestCorr <= 0) return { rate: 0, depth };

    const rate = 1 / (bestLag * meanDt);
    return { rate, depth };
  }

  reset(): void {
    this.cents = [];
    this.times = [];
  }
}
