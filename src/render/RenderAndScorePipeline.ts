/**
 * RenderAndScorePipeline - Render generated code and score based on actual output quality
 *
 * This pipeline:
 * 1. Renders generated code (p5.js, Three.js, etc.) in a headless browser
 * 2. Captures output (screenshot for visual, audio analysis for sound)
 * 3. Scores based on actual rendered quality
 * 4. Supports multiple domains: p5, three, glsl, hydra, strudel, tone
 *
 * Integrates with RalphLoop to provide render-based scoring in addition to
 * syntactic/structural scoring.
 */

import { HeadlessRenderer, RenderDomain, RenderOptions, RenderResult } from './HeadlessRenderer.js';
import { VisualScorer, VisualScoreResult, VisualScorerOptions } from './VisualScorer.js';
import { AudioScorer, AudioScoreResult, AudioScorerOptions } from './AudioScorer.js';
import { Logger } from '../utils/Logger.js';

export interface PipelineOptions {
  /** Render options for headless browser */
  render?: RenderOptions;
  /** Visual scoring options */
  visual?: VisualScorerOptions;
  /** Audio scoring options */
  audio?: AudioScorerOptions;
  /** Whether to capture and score visual output */
  scoreVisual?: boolean;
  /** Whether to capture and score audio output */
  scoreAudio?: boolean;
  /** Weight for visual score in final blend (0-1) */
  visualWeight?: number;
  /** Weight for audio score in final blend (0-1) */
  audioWeight?: number;
  /** Timeout for the entire pipeline in milliseconds */
  timeout?: number;
}

export interface PipelineResult {
  /** Whether the pipeline completed successfully */
  success: boolean;
  /** Final combined score (0-1) */
  score: number;
  /** Visual score details */
  visual?: VisualScoreResult;
  /** Audio score details */
  audio?: AudioScoreResult;
  /** Raw render result */
  render?: RenderResult;
  /** Domain detected */
  domain: RenderDomain;
  /** Error message if failed */
  error?: string;
  /** Non-fatal degradation warnings propagated from rendering/scoring */
  warnings?: string[];
  /** Processing time in milliseconds */
  duration: number;
}

export interface ScoreBlendOptions {
  /** Base score from syntactic analysis */
  baseScore: number;
  /** Render-based score from pipeline */
  renderScore: number;
  /** Weight for render score (0-1) */
  renderWeight?: number;
  /** Blend mode: 'linear' for simple weighted average, 'adaptive' for context-aware blending */
  mode?: 'linear' | 'adaptive';
}

const DEFAULT_PIPELINE_OPTIONS: Required<PipelineOptions> = {
  render: {},
  visual: {},
  audio: {},
  scoreVisual: true,
  scoreAudio: true,
  visualWeight: 0.5,
  audioWeight: 0.5,
  timeout: 60000,
};

/**
 * Render and score pipeline for creative code evaluation
 */
export class RenderAndScorePipeline {
  private renderer: HeadlessRenderer;
  private visualScorer: VisualScorer;
  private audioScorer: AudioScorer;
  private options: Required<PipelineOptions>;

  constructor(options: PipelineOptions = {}) {
    this.options = { ...DEFAULT_PIPELINE_OPTIONS, ...options };
    this.renderer = HeadlessRenderer.getInstance();
    this.visualScorer = new VisualScorer(this.options.visual);
    this.audioScorer = new AudioScorer(this.options.audio);
  }

  /**
   * Process code through the render-and-score pipeline
   */
  async process(code: string, domainHint?: RenderDomain): Promise<PipelineResult> {
    const startTime = Date.now();

    // Set up overall timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeout);

    try {
      // Detect domain
      const domain = domainHint || HeadlessRenderer.detectDomain(code);
      
      // Adjust options based on domain
      const shouldScoreVisual = this.options.scoreVisual && this.isVisualDomain(domain);
      const shouldScoreAudio = this.options.scoreAudio && this.isAudioDomain(domain);

      Logger.info('RenderAndScorePipeline', `Processing ${domain} code (visual: ${shouldScoreVisual}, audio: ${shouldScoreAudio})`);

      // Render the code
      const renderResult = await this.renderer.render(code, {
        ...this.options.render,
        domain,
      });

      if (!renderResult.success) {
        return {
          success: false,
          score: 0,
          domain,
          error: renderResult.error || 'Render failed',
          duration: Date.now() - startTime,
        };
      }

      // Score visual output
      let visualScore: VisualScoreResult | undefined;
      if (shouldScoreVisual && renderResult.screenshot?.success) {
        try {
          visualScore = await this.visualScorer.score(renderResult.screenshot.buffer);
        } catch (error) {
          Logger.warn('RenderAndScorePipeline', 'Visual scoring failed:', error);
        }
      }

      // Score audio output
      let audioScore: AudioScoreResult | undefined;
      if (shouldScoreAudio && renderResult.audio?.success) {
        try {
          audioScore = this.audioScorer.score(
            renderResult.audio.samples,
            renderResult.audio.sampleRate
          );
        } catch (error) {
          Logger.warn('RenderAndScorePipeline', 'Audio scoring failed:', error);
        }
      }

      // Calculate combined score
      const score = this.calculateCombinedScore(visualScore, audioScore, shouldScoreVisual, shouldScoreAudio);

      const duration = Date.now() - startTime;
      const warnings = [...renderResult.errors];

      Logger.info('RenderAndScorePipeline', `Completed in ${duration}ms with score ${score.toFixed(3)}`);

      return {
        success: true,
        score,
        visual: visualScore,
        audio: audioScore,
        render: renderResult,
        domain,
        warnings: warnings.length > 0 ? warnings : undefined,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      Logger.error('RenderAndScorePipeline', 'Pipeline failed:', error);

      return {
        success: false,
        score: 0,
        domain: domainHint || 'unknown',
        error: error instanceof Error ? error.message : 'Pipeline failed',
        duration,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Check if domain produces visual output
   */
  private isVisualDomain(domain: RenderDomain): boolean {
    return ['p5', 'three', 'glsl', 'hydra'].includes(domain);
  }

  /**
   * Check if domain produces audio output
   */
  private isAudioDomain(domain: RenderDomain): boolean {
    return ['tone', 'strudel'].includes(domain);
  }

  /**
   * Calculate combined score from visual and audio scores
   */
  private calculateCombinedScore(
    visualScore?: VisualScoreResult,
    audioScore?: AudioScoreResult,
    hasVisual: boolean = true,
    hasAudio: boolean = true
  ): number {
    if (!hasVisual && !hasAudio) {
      // Unknown domain - return neutral score
      return 0.5;
    }

    if (hasVisual && !hasAudio) {
      // Visual-only domain
      return visualScore?.score ?? 0;
    }

    if (!hasVisual && hasAudio) {
      // Audio-only domain
      return audioScore?.score ?? 0;
    }

    // Both visual and audio
    const visual = visualScore?.score ?? 0;
    const audio = audioScore?.score ?? 0;
    
    // Weight by configured weights
    const totalWeight = this.options.visualWeight + this.options.audioWeight;
    if (totalWeight === 0) return 0;
    
    return (
      visual * this.options.visualWeight +
      audio * this.options.audioWeight
    ) / totalWeight;
  }

  /**
   * Blend render-based score with existing base score
   */
  static blendScores(options: ScoreBlendOptions): number {
    const { baseScore, renderScore, renderWeight = 0.5, mode = 'linear' } = options;

    if (mode === 'linear') {
      // Simple weighted average
      return baseScore * (1 - renderWeight) + renderScore * renderWeight;
    }

    // Adaptive blending: use render score more when base score is high
    // This avoids penalizing promising candidates too heavily for render issues
    const adaptiveWeight = renderWeight * (0.5 + baseScore * 0.5);
    return baseScore * (1 - adaptiveWeight) + renderScore * adaptiveWeight;
  }

  /**
   * Process multiple code candidates and return the best one
   */
  async processBatch(codes: string[], domainHint?: RenderDomain): Promise<{ 
    bestIndex: number; 
    bestResult: PipelineResult; 
    allResults: PipelineResult[];
  }> {
    const results: PipelineResult[] = [];
    
    for (const code of codes) {
      const result = await this.process(code, domainHint);
      results.push(result);
    }

    // Find best result by score
    let bestIndex = 0;
    let bestScore = results[0]?.score ?? 0;

    for (let i = 1; i < results.length; i++) {
      if (results[i].score > bestScore) {
        bestScore = results[i].score;
        bestIndex = i;
      }
    }

    return {
      bestIndex,
      bestResult: results[bestIndex],
      allResults: results,
    };
  }

  /**
   * Clean up resources
   */
  async close(): Promise<void> {
    await this.renderer.close();
  }

  /**
   * Check if renderer is ready
   */
  isReady(): boolean {
    return this.renderer.isInitialized();
  }
}

export default RenderAndScorePipeline;
