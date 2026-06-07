/**
 * Type declarations for optional dependencies.
 * These modules may not be installed, so we provide minimal type info.
 */

declare module 'sharp' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface _SharpOptions {
    [key: string]: unknown;
  }
  interface CacheOptions {
    [key: unknown]: unknown;
  }
  interface CacheResult {
    [key: unknown]: unknown;
  }
  interface SharpInstance {
    metadata(): Promise<{ width?: number; height?: number }>;
    [key: string]: unknown;
  }
  function sharp(input: string): SharpInstance;
  namespace sharp {
    function cache(options?: boolean | CacheOptions): CacheResult;
    function concurrency(concurrency?: number): number;
  }
  export = sharp;
}

declare module 'music-metadata' {
  interface AudioMetadata {
    format: {
      duration?: number;
      sampleRate?: number;
      bitrate?: number;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  }
  export function parseFile(path: string): Promise<AudioMetadata>;
}

declare module 'meyda' {
  export interface MeydaFeatures {
    amplitudeSpectrum?: Float32Array;
    spectralCentroid?: number;
    rms?: number;
    zcr?: number;
    [key: string]: unknown;
  }
  
  export function extract(
    features: string | string[],
    signal: Float32Array,
    previousSignal?: Float32Array
  ): MeydaFeatures;
  
  export const audioContext: unknown;
  export const bufferSize: number;
}

/**
 * Extensions to the Window object for Puppeteer-injected metrics.
 * Used by AccessibilityGuardrails and RuntimeHealthMonitor.
 */
interface AccessibilityMetrics {
  luminanceSamples: number[];
  flashCount: number;
  lastLuminance: number;
  hasAudio: boolean;
  audioPeakLevel: number;
}

interface SinterMetrics {
  frameCount: number;
  lastFrameTime: number;
  fpsSamples: number[];
  objectCounts: number[];
}

interface Window {
  __accessibilityMetrics?: AccessibilityMetrics;
  __liminalMetrics?: SinterMetrics;
}
