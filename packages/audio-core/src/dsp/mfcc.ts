/**
 * Mel-frequency cepstral coefficients from a magnitude spectrum.
 *
 * MFCCs summarize the spectral envelope shape, which `FormantAnalyzer` uses as a
 * lightweight formant/vowel proxy. Standard pipeline: mel filterbank → log
 * energies → DCT-II. MFCC[0] ≈ overall energy, MFCC[1] ≈ spectral tilt.
 */

function hzToMel(hz: number): number {
  return 2595 * Math.log10(1 + hz / 700);
}

function melToHz(mel: number): number {
  return 700 * (10 ** (mel / 2595) - 1);
}

/**
 * @param spectrum magnitude spectrum (N/2 bins from `magnitudeSpectrum`)
 * @param sampleRate audio sample rate (Hz)
 * @param melCount number of mel filterbank bands (default 26)
 * @param coeffCount number of cepstral coefficients to return (default 13)
 */
export function computeMfcc(
  spectrum: Float32Array,
  sampleRate: number,
  melCount = 26,
  coeffCount = 13,
): number[] {
  const half = spectrum.length;
  if (half === 0) return new Array(coeffCount).fill(0);
  const n = half * 2;
  const melMin = hzToMel(0);
  const melMax = hzToMel(sampleRate / 2);

  // melCount+2 boundary points (in FFT-bin space) defining triangular filters.
  const binPoints: number[] = [];
  for (let i = 0; i < melCount + 2; i++) {
    const hz = melToHz(melMin + ((melMax - melMin) * i) / (melCount + 1));
    binPoints.push(Math.floor((hz * n) / sampleRate));
  }

  const logEnergies = new Array<number>(melCount);
  for (let m = 1; m <= melCount; m++) {
    const left = binPoints[m - 1];
    const center = binPoints[m];
    const right = binPoints[m + 1];
    let energy = 0;
    for (let k = left; k <= right && k < half; k++) {
      if (k < 0) continue;
      let weight: number;
      if (k <= center) weight = center === left ? 1 : (k - left) / (center - left);
      else weight = right === center ? 1 : (right - k) / (right - center);
      const mag = spectrum[k];
      energy += mag * mag * Math.max(0, weight);
    }
    logEnergies[m - 1] = Math.log(energy + 1e-10);
  }

  // DCT-II of the log filterbank energies.
  const mfcc = new Array<number>(coeffCount);
  for (let c = 0; c < coeffCount; c++) {
    let sum = 0;
    for (let m = 0; m < melCount; m++) {
      sum += logEnergies[m] * Math.cos((Math.PI * c * (m + 0.5)) / melCount);
    }
    mfcc[c] = sum;
  }
  return mfcc;
}
