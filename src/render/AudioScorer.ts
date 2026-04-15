/**
 * AudioScorer - Analyze audio output for quality
 *
 * Provides metrics for:
 * - Frequency variety (spectral entropy)
 * - Amplitude dynamics (dynamic range)
 * - Rhythm patterns (onset detection)
 * - Harmonic content
 */

export interface AudioScoreResult {
  /** Overall audio quality score (0-1) */
  score: number;
  /** Frequency variety score (0-1) */
  frequencyVariety: number;
  /** Amplitude dynamics score (0-1) */
  dynamics: number;
  /** Rhythm clarity score (0-1) */
  rhythm: number;
  /** Harmonic content score (0-1) */
  harmonic: number;
  /** Detailed metrics */
  metrics: {
    spectralEntropy: number;
    dynamicRange: number;
    onsetCount: number;
    zeroCrossingRate: number;
  };
  /** Non-fatal warnings explaining degraded or skipped audio scoring */
  warnings?: string[];
}

export interface AudioScorerOptions {
  /** Weight for frequency variety in final score */
  frequencyWeight?: number;
  /** Weight for dynamics in final score */
  dynamicsWeight?: number;
  /** Weight for rhythm in final score */
  rhythmWeight?: number;
  /** Weight for harmonic content in final score */
  harmonicWeight?: number;
}

const DEFAULT_OPTIONS: Required<AudioScorerOptions> = {
  frequencyWeight: 0.25,
  dynamicsWeight: 0.25,
  rhythmWeight: 0.25,
  harmonicWeight: 0.25,
};

/**
 * Audio quality scorer for rendered outputs
 */
export class AudioScorer {
  private options: Required<AudioScorerOptions>;

  constructor(options: AudioScorerOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Score audio samples for quality
   */
  score(samples: Float32Array, sampleRate: number = 44100): AudioScoreResult {
    try {
      if (samples.length === 0) {
        return this.getEmptyResult('Audio scoring skipped: no samples provided');
      }

      // Calculate metrics
      const frequencyVariety = this.calculateFrequencyVariety(samples, sampleRate);
      const dynamics = this.calculateDynamics(samples);
      const rhythm = this.calculateRhythm(samples, sampleRate);
      const harmonic = this.calculateHarmonicContent(samples, sampleRate);

      // Calculate weighted final score
      const score = 
        this.options.frequencyWeight * frequencyVariety +
        this.options.dynamicsWeight * dynamics +
        this.options.rhythmWeight * rhythm +
        this.options.harmonicWeight * harmonic;

      return {
        score: Math.max(0, Math.min(1, score)),
        frequencyVariety,
        dynamics,
        rhythm,
        harmonic,
        metrics: {
          spectralEntropy: frequencyVariety,
          dynamicRange: this.calculateDynamicRange(samples),
          onsetCount: this.detectOnsets(samples, sampleRate).length,
          zeroCrossingRate: this.calculateZeroCrossingRate(samples),
        },
      };
    } catch (error) {
      return this.getEmptyResult(`Audio scoring failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }

  /**
   * Get empty result (for silent or invalid audio)
   */
  private getEmptyResult(warning?: string): AudioScoreResult {
    return {
      score: 0,
      frequencyVariety: 0,
      dynamics: 0,
      rhythm: 0,
      harmonic: 0,
      metrics: {
        spectralEntropy: 0,
        dynamicRange: 0,
        onsetCount: 0,
        zeroCrossingRate: 0,
      },
      warnings: warning ? [warning] : undefined,
    };
  }

  /**
   * Calculate frequency variety using spectral entropy
   * Higher entropy = more frequency variety = better
   */
  private calculateFrequencyVariety(samples: Float32Array, _sampleRate: number): number {
    // Perform a simplified FFT using DFT
    const fftSize = Math.min(2048, samples.length);
    const magnitudes = this.performDFT(samples, fftSize);
    
    // Calculate spectral entropy
    const totalEnergy = magnitudes.reduce((sum, m) => sum + m, 0);
    
    if (totalEnergy === 0) return 0;
    
    let entropy = 0;
    for (const mag of magnitudes) {
      const prob = mag / totalEnergy;
      if (prob > 0) {
        entropy -= prob * Math.log2(prob);
      }
    }
    
    // Normalize entropy (max entropy is log2(fftSize/2))
    const maxEntropy = Math.log2(fftSize / 2);
    const normalizedEntropy = entropy / maxEntropy;
    
    return Math.max(0, Math.min(1, normalizedEntropy));
  }

  /**
   * Perform simplified Discrete Fourier Transform
   */
  private performDFT(samples: Float32Array, size: number): Float32Array {
    const magnitudes = new Float32Array(size / 2);
    
    // Use a window function to reduce spectral leakage
    const windowed = this.applyHannWindow(samples.slice(0, size));
    
    // Calculate DFT for each frequency bin
    for (let k = 0; k < size / 2; k++) {
      let real = 0;
      let imag = 0;
      
      for (let n = 0; n < size; n++) {
        const angle = -2 * Math.PI * k * n / size;
        real += windowed[n] * Math.cos(angle);
        imag += windowed[n] * Math.sin(angle);
      }
      
      magnitudes[k] = Math.sqrt(real * real + imag * imag);
    }
    
    return magnitudes;
  }

  /**
   * Apply Hann window to samples
   */
  private applyHannWindow(samples: Float32Array): Float32Array {
    const windowed = new Float32Array(samples.length);
    for (let i = 0; i < samples.length; i++) {
      const hann = 0.5 * (1 - Math.cos(2 * Math.PI * i / (samples.length - 1)));
      windowed[i] = samples[i] * hann;
    }
    return windowed;
  }

  /**
   * Calculate amplitude dynamics (variation in amplitude over time)
   */
  private calculateDynamics(samples: Float32Array): number {
    // Divide into frames and calculate RMS for each
    const frameSize = 1024;
    const hopSize = 512;
    const rmsValues: number[] = [];
    
    for (let i = 0; i < samples.length - frameSize; i += hopSize) {
      const frame = samples.subarray(i, i + frameSize);
      const rms = Math.sqrt(frame.reduce((sum, s) => sum + s * s, 0) / frameSize);
      rmsValues.push(rms);
    }
    
    if (rmsValues.length === 0) return 0;
    
    // Calculate coefficient of variation (std / mean)
    const mean = rmsValues.reduce((sum, r) => sum + r, 0) / rmsValues.length;
    
    if (mean === 0) return 0;
    
    const variance = rmsValues.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / rmsValues.length;
    const std = Math.sqrt(variance);
    const cv = std / mean;
    
    // Normalize: good dynamics have CV between 0.5 and 2
    if (cv < 0.1) return cv * 5; // Too static
    if (cv > 3) return Math.max(0, 1 - (cv - 3) / 3); // Too erratic
    return 0.5 + cv / 6; // Good dynamics range
  }

  /**
   * Calculate dynamic range (ratio of max to min significant amplitude)
   */
  private calculateDynamicRange(samples: Float32Array): number {
    const max = Math.max(...samples.map(Math.abs));
    
    // Find minimum above noise floor
    const noiseFloor = 0.001;
    const significantSamples = samples.filter(s => Math.abs(s) > noiseFloor);
    
    if (significantSamples.length === 0) return 0;
    
    const min = Math.min(...significantSamples.map(Math.abs));
    
    if (min === 0 || max === 0) return 0;
    
    // Calculate in dB
    const rangeDb = 20 * Math.log10(max / min);
    
    // Normalize: good dynamic range is 20-60 dB
    return Math.min(rangeDb / 60, 1);
  }

  /**
   * Calculate rhythm score based on onset detection
   */
  private calculateRhythm(samples: Float32Array, sampleRate: number): number {
    const onsets = this.detectOnsets(samples, sampleRate);
    
    if (onsets.length < 2) {
      // Too few onsets - either static or completely arrhythmic
      return onsets.length === 0 ? 0 : 0.3;
    }
    
    // Calculate inter-onset intervals
    const iois: number[] = [];
    for (let i = 1; i < onsets.length; i++) {
      iois.push(onsets[i] - onsets[i - 1]);
    }
    
    // Calculate rhythmic regularity (lower variance = more regular)
    const meanIOI = iois.reduce((sum, ioi) => sum + ioi, 0) / iois.length;
    
    if (meanIOI === 0) return 0;
    
    const variance = iois.reduce((sum, ioi) => sum + Math.pow(ioi - meanIOI, 2), 0) / iois.length;
    const regularity = 1 / (1 + variance / (meanIOI * meanIOI));
    
    // More onsets generally indicate more rhythmic content (up to a point)
    const onsetDensity = Math.min(onsets.length / (samples.length / sampleRate * 4), 1);
    
    // Combine regularity and density
    return regularity * 0.7 + onsetDensity * 0.3;
  }

  /**
   * Detect onsets (transients) in the audio
   */
  private detectOnsets(samples: Float32Array, sampleRate: number): number[] {
    const onsets: number[] = [];
    const frameSize = 512;
    const hopSize = 256;
    
    let prevEnergy = 0;
    const threshold = 0.1;
    
    for (let i = 0; i < samples.length - frameSize; i += hopSize) {
      const frame = samples.subarray(i, i + frameSize);
      const energy = frame.reduce((sum, s) => sum + s * s, 0) / frameSize;
      
      // Detect sudden energy increase
      if (prevEnergy > 0 && energy / prevEnergy > 2 && energy > threshold) {
        const time = i / sampleRate;
        // Avoid duplicate onsets
        if (onsets.length === 0 || time - onsets[onsets.length - 1] > 0.1) {
          onsets.push(time);
        }
      }
      
      prevEnergy = energy * 0.9 + prevEnergy * 0.1; // Smooth energy
    }
    
    return onsets;
  }

  /**
   * Calculate harmonic content using zero crossing rate and spectral centroid
   */
  private calculateHarmonicContent(samples: Float32Array, sampleRate: number): number {
    // Zero crossing rate (lower = more harmonic/tonal)
    const zcr = this.calculateZeroCrossingRate(samples);
    
    // Spectral centroid (brightness indicator)
    const centroid = this.calculateSpectralCentroid(samples, sampleRate);
    
    // Normalize ZCR: good harmonic content typically has ZCR < 0.1
    const zcrScore = Math.max(0, 1 - zcr / 0.2);
    
    // Normalize centroid: good range is 500-5000 Hz
    const normalizedCentroid = centroid / (sampleRate / 2);
    const centroidScore = normalizedCentroid > 0.02 && normalizedCentroid < 0.3 ? 1 : 0.5;
    
    return zcrScore * 0.6 + centroidScore * 0.4;
  }

  /**
   * Calculate zero crossing rate
   */
  private calculateZeroCrossingRate(samples: Float32Array): number {
    let crossings = 0;
    
    for (let i = 1; i < samples.length; i++) {
      if ((samples[i] >= 0) !== (samples[i - 1] >= 0)) {
        crossings++;
      }
    }
    
    return crossings / samples.length;
  }

  /**
   * Calculate spectral centroid (brightness)
   */
  private calculateSpectralCentroid(samples: Float32Array, sampleRate: number): number {
    const fftSize = Math.min(2048, samples.length);
    const magnitudes = this.performDFT(samples, fftSize);
    
    let sumWeighted = 0;
    let sumMag = 0;
    const binFreq = sampleRate / 2 / magnitudes.length;
    
    for (let i = 0; i < magnitudes.length; i++) {
      const freq = i * binFreq;
      sumWeighted += freq * magnitudes[i];
      sumMag += magnitudes[i];
    }
    
    return sumMag > 0 ? sumWeighted / sumMag : 0;
  }
}

export default AudioScorer;
