/**
 * Real-input FFT magnitude spectrum via iterative radix-2 Cooley-Tukey.
 *
 * Replaces the previous O(N*bins) naive DFT in VoiceFeatureStream. Input length
 * must be a power of two. Returns the first N/2 magnitude bins (bin k maps to
 * frequency k * sampleRate / N).
 */

function isPowerOfTwo(n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0;
}

/**
 * Compute the magnitude spectrum of a real signal.
 * @param samples real-valued input; length must be a power of two
 * @param _sampleRate retained for API symmetry (bin→Hz is the caller's concern)
 * @returns Float32Array of length N/2 magnitudes (normalized by N)
 */
export function magnitudeSpectrum(samples: Float32Array, _sampleRate: number): Float32Array {
  const n = samples.length;
  if (!isPowerOfTwo(n)) {
    throw new Error(`magnitudeSpectrum: length must be a power of two (got ${n})`);
  }

  // Copy real input into re[], im[] zeroed.
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  for (let i = 0; i < n; i++) re[i] = samples[i];

  // Bit-reversal permutation.
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i];
      re[i] = re[j];
      re[j] = tr;
      const ti = im[i];
      im[i] = im[j];
      im[j] = ti;
    }
  }

  // Iterative Cooley-Tukey butterflies.
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wRe = Math.cos(ang);
    const wIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let curRe = 1;
      let curIm = 0;
      const half = len >> 1;
      for (let k = 0; k < half; k++) {
        const aRe = re[i + k];
        const aIm = im[i + k];
        const bRe = re[i + k + half] * curRe - im[i + k + half] * curIm;
        const bIm = re[i + k + half] * curIm + im[i + k + half] * curRe;
        re[i + k] = aRe + bRe;
        im[i + k] = aIm + bIm;
        re[i + k + half] = aRe - bRe;
        im[i + k + half] = aIm - bIm;
        const nextRe = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = nextRe;
      }
    }
  }

  const half = n >> 1;
  const mag = new Float32Array(half);
  for (let i = 0; i < half; i++) {
    mag[i] = Math.sqrt(re[i] * re[i] + im[i] * im[i]) / n;
  }
  return mag;
}
