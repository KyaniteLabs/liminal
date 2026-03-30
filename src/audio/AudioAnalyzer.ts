import type { AudioAnalysisResult, VisualMappingParams } from './types.js';
import { extractFeatures } from './AudioExtractor.js';
import { detectPitch } from './PitchExtractor.js';
import { extractTimbre } from './TimbreExtractor.js';
import { mapToVisualParams } from './AudioToVisualMapper.js';

/**
 * Orchestrator that chains the full audio analysis pipeline:
 * extract features → detect pitch → extract timbre → produce a result.
 */
export class AudioAnalyzer {
  /**
   * Run the full audio analysis pipeline on a mono sample buffer.
   *
   * @param buffer     - Mono audio samples (Float32Array, typically >= 2048 samples).
   * @param sampleRate - Sample rate in Hz (default 44100).
   * @returns AudioAnalysisResult with features, pitch, timbre, and timestamp.
   */
  analyze(buffer: Float32Array, sampleRate: number = 44100): AudioAnalysisResult {
    const features = extractFeatures(buffer);
    const pitch = detectPitch(buffer, sampleRate);
    const timbre = extractTimbre(features);
    return { features, pitch, timbre, timestamp: Date.now() };
  }

  /**
   * Map an analysis result to visual parameters.
   *
   * @param result - A completed AudioAnalysisResult.
   * @returns VisualMappingParams ready for the rendering pipeline.
   */
  getVisualMapping(result: AudioAnalysisResult): VisualMappingParams {
    return mapToVisualParams(result.features, result.pitch, result.timbre);
  }
}
