/**
 * Window functions for short-time spectral analysis.
 *
 * A Hann window tapers the edges of an analysis frame to zero, reducing
 * spectral leakage before an FFT.
 */

/**
 * Build a Hann window of length `n`.
 *
 * `w[i] = 0.5 - 0.5 * cos(2*pi*i/(n-1))` — 0 at both edges, 1 at the center.
 * For `n <= 1` returns a window of all-ones of that length (no taper, and
 * avoids a divide-by-zero when `n === 1`).
 */
export function hannWindow(n: number): Float32Array {
  const length = Math.max(0, Math.floor(n));
  const window = new Float32Array(length);
  if (length <= 1) {
    window.fill(1);
    return window;
  }
  for (let i = 0; i < length; i++) {
    window[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (length - 1));
  }
  return window;
}

/**
 * Multiply `samples` by `window` elementwise, returning a new Float32Array.
 * Throws if the lengths differ.
 */
export function applyWindow(samples: Float32Array, window: Float32Array): Float32Array {
  if (samples.length !== window.length) {
    throw new Error(
      `applyWindow: length mismatch (samples=${samples.length}, window=${window.length})`,
    );
  }
  const out = new Float32Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    out[i] = samples[i] * window[i];
  }
  return out;
}
