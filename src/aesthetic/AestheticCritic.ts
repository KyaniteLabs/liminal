// ---------------------------------------------------------------------------
// AestheticCritic – orchestrator that runs all sub-critics and aggregates
// Supports dual-path: LIR tokens when available, regex fallback otherwise.
// Now with calibration support for improved correlation with human judgment.
// ---------------------------------------------------------------------------

import { Logger } from '../utils/Logger.js';

import type {
  AestheticReport,
  AestheticViolation,
  CriticConfig,
  DesignConstraints,
  LIREvaluationContext,
  LIRAwareAestheticReport,
} from './types.js';
import { DEFAULT_DESIGN_CONSTRAINTS } from './types.js';
import { analyzeColorHarmony } from './critics/ColorHarmonyCritic.js';
import { analyzeLayout } from './critics/LayoutCritic.js';
import { analyzeTypography } from './critics/TypographyCritic.js';
import { analyzeSoundHarmony } from './critics/SoundHarmonyCritic.js';
import { analyzeWithLLMJudge, type LLMClientLike, type LLMJudgeResult } from './critics/LLMJudgeCritic.js';
import type { CalibrationWeights, CalibrationResult } from '../calibration/CalibrationSuite.js';
import { CorrelationCalculator } from '../calibration/CorrelationCalculator.js';
import type { HarnessMemory } from '../harness/HarnessMemory.js';
import { Logger } from '../utils/Logger.js';

// ---------------------------------------------------------------------------
// Critic registry
// ---------------------------------------------------------------------------

interface CriticEntry {
  name: string;
  analyze: (code: string, constraints: DesignConstraints) => AestheticReport;
}

const ALL_CRITICS: CriticEntry[] = [
  { name: 'color', analyze: analyzeColorHarmony },
  { name: 'layout', analyze: analyzeLayout },
  { name: 'typography', analyze: analyzeTypography },
  { name: 'sound', analyze: analyzeSoundHarmony },
];

// Default calibration weights (equal weighting)
const DEFAULT_CALIBRATION_WEIGHTS: CalibrationWeights = {
  technicalWeight: 0.25,
  creativeWeight: 0.25,
  aestheticWeight: 0.25,
  noveltyWeight: 0.1,
  emergenceWeight: 0.075,
  interestingnessWeight: 0.075,
};

// ---------------------------------------------------------------------------
// AestheticCritic – public API
// ---------------------------------------------------------------------------

export class AestheticCritic {
  private calibrationWeights: Map<string, CalibrationWeights> = new Map();
  private harnessMemory?: HarnessMemory;
  private llmClient?: LLMClientLike;

  /**
   * Set HarnessMemory for persistent calibration storage
   */
  setHarnessMemory(memory: HarnessMemory): void {
    this.harnessMemory = memory;
    this.loadCalibrationData();
  }

  /**
   * Set LLM client for LLM-as-Judge evaluation mode.
   * When set, `critiqueWithLLM()` becomes available for higher-quality scoring.
   */
  setLLMClient(llm: LLMClientLike): void {
    this.llmClient = llm;
  }

  /**
   * Evaluate code using LLM-as-Judge (async, higher quality).
   * Falls back to heuristic critics if no LLM is configured.
   *
   * This is the "dual-path" approach: heuristic critics are fast and free,
   * LLM-as-Judge is slower but produces calibrated, reasoning-aware scores.
   * Use the heuristic path for real-time feedback during generation loops,
   * and the LLM path for final evaluation and calibration.
   */
  async critiqueWithLLM(
    code: string,
    domain: string = 'p5',
    config?: Partial<CriticConfig>,
  ): Promise<AestheticReport | LLMJudgeResult> {
    if (!this.llmClient) {
      // No LLM available — fall back to heuristic critics
      return this.critique(code, config);
    }

    const constraints: DesignConstraints = {
      ...DEFAULT_DESIGN_CONSTRAINTS,
      ...config?.constraints,
      color: { ...DEFAULT_DESIGN_CONSTRAINTS.color, ...config?.constraints?.color },
      layout: { ...DEFAULT_DESIGN_CONSTRAINTS.layout, ...config?.constraints?.layout },
      typography: { ...DEFAULT_DESIGN_CONSTRAINTS.typography, ...config?.constraints?.typography },
      sound: { ...DEFAULT_DESIGN_CONSTRAINTS.sound, ...config?.constraints?.sound },
      general: { ...DEFAULT_DESIGN_CONSTRAINTS.general, ...config?.constraints?.general },
    };

    // Run both paths in parallel: heuristic + LLM
    const heuristicReport = this.critique(code, config);
    const llmReport = await analyzeWithLLMJudge(code, domain, this.llmClient, constraints);

    // Blend: weight LLM score more heavily (0.7 LLM + 0.3 heuristic)
    // unless the LLM call failed
    if (llmReport.usedLLM) {
      const blendedScore = (llmReport.score * 0.7) + (heuristicReport.score * 0.3);
      const passed = blendedScore >= constraints.general.minAestheticScore
        && llmReport.violations.filter(v => v.severity === 'error').length === 0;

      return {
        ...llmReport,
        score: Math.round(blendedScore * 1000) / 1000,
        violations: [...heuristicReport.violations, ...llmReport.violations],
        passed,
      };
    }

    return heuristicReport;
  }

  /**
   * Critique code for aesthetic quality.
   *
   * When `lirContext` is provided with populated `lirTokens`, the method
   * enriches the report with structural metrics and coherence scoring.
   * The regex-based critics still run (LIR-aware critic functions are added
   * in Phase 3), but structural metrics from LIR tokens are layered on top.
   *
   * Cold fallback: when `lirTokens` is empty or absent, runs existing regex path.
   */
  critique(
    code: string,
    config?: Partial<CriticConfig>,
    lirContext?: LIREvaluationContext,
    domain?: string,
  ): AestheticReport {
    if (!code || code.trim().length === 0) {
      return { score: 0, violations: [], passed: false, timestamp: Date.now() };
    }

    const constraints: DesignConstraints = {
      ...DEFAULT_DESIGN_CONSTRAINTS,
      ...config?.constraints,
      color: { ...DEFAULT_DESIGN_CONSTRAINTS.color, ...config?.constraints?.color },
      layout: { ...DEFAULT_DESIGN_CONSTRAINTS.layout, ...config?.constraints?.layout },
      typography: { ...DEFAULT_DESIGN_CONSTRAINTS.typography, ...config?.constraints?.typography },
      sound: { ...DEFAULT_DESIGN_CONSTRAINTS.sound, ...config?.constraints?.sound },
      general: { ...DEFAULT_DESIGN_CONSTRAINTS.general, ...config?.constraints?.general },
    };
    const enabledCritics = config?.enabledCritics ?? ALL_CRITICS.map(c => c.name);

    const critics = ALL_CRITICS.filter(c => enabledCritics.includes(c.name));
    const reports: AestheticReport[] = critics.map(critic => critic.analyze(code, constraints));

    // Aggregate scores (average, excluding neutral 0.5 from non-applicable critics)
    const activeReports = reports.filter(r => r.score !== 0.5);
    let avgScore = activeReports.length > 0
      ? activeReports.reduce((sum, r) => sum + r.score, 0) / activeReports.length
      : (reports.length > 0 ? reports.reduce((sum, r) => sum + r.score, 0) / reports.length : 0.5);

    // Apply calibration weights if domain is calibrated
    if (domain) {
      avgScore = this.applyCalibrationWeights(avgScore, reports, domain);
    }

    const allViolations: AestheticViolation[] = reports.flatMap(r => r.violations);
    const passed = avgScore >= constraints.general.minAestheticScore
      && allViolations.filter(v => v.severity === 'error').length === 0;

    // Build base report
    const baseReport: AestheticReport = {
      score: Math.round(avgScore * 100) / 100,
      violations: allViolations,
      passed,
      timestamp: Date.now(),
    };

    // When LIR context is provided with tokens, enrich the report
    const useLIR = !!(lirContext?.lirTokens && lirContext.lirTokens.length > 0);
    if (useLIR) {
      const tokens = lirContext!.lirTokens;
      const lirReport: LIRAwareAestheticReport = {
        ...baseReport,
        usedLIR: true,
        structuralMetrics: {
          totalSymbols: tokens.length,
          maxComplexity: Math.max(...tokens.map(t => t.metrics.cyclomaticComplexity)),
          avgNesting: Math.round((tokens.reduce((s, t) => s + t.metrics.nestingDepth, 0) / tokens.length) * 100) / 100,
          callGraphSize: tokens.reduce((s, t) => s + t.metrics.callCount, 0),
        },
      };

      // Compute coherence score if visual intent provided
      if (lirContext!.visualIntent) {
        lirReport.coherenceScore = computeCoherence(tokens, lirContext!.visualIntent);
      }

      return lirReport;
    }

    return baseReport;
  }

  /**
   * Apply calibration weights to adjust the score
   */
  private applyCalibrationWeights(
    baseScore: number,
    reports: AestheticReport[],
    domain: string,
  ): number {
    const weights = this.getCalibrationWeights(domain);
    
    // Calculate weighted score based on critic performance
    // If we have individual critic scores, weight them
    if (reports.length > 0) {
      // Apply subtle weighting adjustment
      const weightMultiplier = 
        (weights.aestheticWeight / DEFAULT_CALIBRATION_WEIGHTS.aestheticWeight +
         weights.creativeWeight / DEFAULT_CALIBRATION_WEIGHTS.creativeWeight) / 2;
      
      // Adjust score based on calibration (subtle adjustment to avoid overfitting)
      const adjustment = (weightMultiplier - 1) * 0.1;
      return Math.max(0, Math.min(1, baseScore + adjustment));
    }

    return baseScore;
  }

  /**
   * Get calibration weights for a domain
   */
  getCalibrationWeights(domain: string): CalibrationWeights {
    return this.calibrationWeights.get(domain) ?? { ...DEFAULT_CALIBRATION_WEIGHTS };
  }

  /**
   * Set calibration weights for a domain
   */
  setCalibrationWeights(domain: string, weights: Partial<CalibrationWeights>): void {
    const current = this.getCalibrationWeights(domain);
    const updated = { ...current, ...weights };
    this.calibrationWeights.set(domain, updated);
    this.saveCalibrationData();
  }

  /**
   * Calibrate the critic based on human ratings
   * This method should be called after collecting human ratings for samples
   */
  calibrate(
    domain: string,
    samples: Array<{ systemScore: number; humanRating: number; criticScores?: Record<string, number> }>,
  ): CalibrationResult {
    if (samples.length < 5) {
      throw new Error('Need at least 5 samples with human ratings to calibrate');
    }

    // Use imported CorrelationCalculator

    const systemScores = samples.map(s => s.systemScore);
    const humanRatings = samples.map(s => s.humanRating);

    // Calculate correlations
    const pearson = CorrelationCalculator.pearson(systemScores, humanRatings);
    const spearman = CorrelationCalculator.spearman(systemScores, humanRatings);

    // Perform regression
    const regression = CorrelationCalculator.linearRegression(systemScores, humanRatings);

    // Calculate MSE
    const mse = CorrelationCalculator.meanSquaredError(systemScores, humanRatings);

    // Determine optimal weights based on critic performance
    const weights = this.calculateOptimalWeights(samples);

    const result: CalibrationResult = {
      correlation: {
        pearson,
        spearman,
        sampleSize: samples.length,
      },
      regression,
      optimalWeights: weights,
      mse,
      isCalibrated: Math.abs(pearson) > 0.7,
      sampleCount: samples.length,
      domain,
      timestamp: Date.now(),
    };

    // Store the calibration weights
    this.calibrationWeights.set(domain, weights);
    this.saveCalibrationData();

    return result;
  }

  /**
   * Calculate optimal weights based on sample performance
   */
  private calculateOptimalWeights(
    samples: Array<{ systemScore: number; humanRating: number; criticScores?: Record<string, number> }>,
  ): CalibrationWeights {
    // Simple heuristic: if correlation is low, adjust weights toward human preferences
    const avgHuman = samples.reduce((sum, s) => sum + s.humanRating, 0) / samples.length;
    const avgSystem = samples.reduce((sum, s) => sum + s.systemScore, 0) / samples.length;

    // Adjust weights based on bias direction
    const bias = avgHuman - avgSystem;
    const adjustment = Math.max(-0.2, Math.min(0.2, bias * 0.5));

    return {
      technicalWeight: Math.max(0.1, Math.min(0.5, DEFAULT_CALIBRATION_WEIGHTS.technicalWeight - adjustment * 0.3)),
      creativeWeight: Math.max(0.1, Math.min(0.5, DEFAULT_CALIBRATION_WEIGHTS.creativeWeight + adjustment * 0.3)),
      aestheticWeight: Math.max(0.1, Math.min(0.4, DEFAULT_CALIBRATION_WEIGHTS.aestheticWeight + adjustment * 0.2)),
      noveltyWeight: DEFAULT_CALIBRATION_WEIGHTS.noveltyWeight,
      emergenceWeight: DEFAULT_CALIBRATION_WEIGHTS.emergenceWeight,
      interestingnessWeight: DEFAULT_CALIBRATION_WEIGHTS.interestingnessWeight,
    };
  }

  /**
   * Check if a domain has been calibrated
   */
  isCalibrated(domain: string): boolean {
    return this.calibrationWeights.has(domain);
  }

  /**
   * Get calibration status for a domain
   */
  getCalibrationStatus(domain: string): { isCalibrated: boolean; weights: CalibrationWeights } {
    return {
      isCalibrated: this.isCalibrated(domain),
      weights: this.getCalibrationWeights(domain),
    };
  }

  /**
   * Clear calibration for a domain
   */
  clearCalibration(domain?: string): void {
    if (domain) {
      this.calibrationWeights.delete(domain);
    } else {
      this.calibrationWeights.clear();
    }
    this.saveCalibrationData();
  }

  /**
   * Save calibration data to HarnessMemory
   */
  private saveCalibrationData(): void {
    if (!this.harnessMemory) {
      return;
    }

    const data = {
      version: 1,
      weights: Object.fromEntries(this.calibrationWeights),
      lastUpdated: Date.now(),
    };

    // Store in harness memory as an episode
    this.harnessMemory.recordEpisode({
      type: 'feedback',
      domain: 'calibration',
      comment: JSON.stringify(data),
      tags: ['calibration', 'aesthetic_critic'],
    });
  }

  /**
   * Load calibration data from HarnessMemory
   */
  private loadCalibrationData(): void {
    if (!this.harnessMemory) {
      return;
    }

    // Get recent calibration episodes
    const episodes = this.harnessMemory.getRecentEpisodes(100);
    const calibrationEpisodes = episodes.filter(
      e => e.type === 'feedback' && e.tags?.includes('calibration') && e.tags?.includes('aesthetic_critic'),
    );

    if (calibrationEpisodes.length > 0) {
      try {
        const latest = calibrationEpisodes[0];
        if (latest.comment) {
          const data = JSON.parse(latest.comment);
          if (data.weights) {
            this.calibrationWeights = new Map(Object.entries(data.weights));
          }
        }
      } catch (err) {
        Logger.warn('AestheticCritic', 'Calibration data parse failed, using defaults:', err instanceof Error ? err.message : err);
      }
    }
  }

  /**
   * Get all calibrated domains
   */
  getCalibratedDomains(): string[] {
    return Array.from(this.calibrationWeights.keys());
  }
}

// ---------------------------------------------------------------------------
// Coherence: compare visual intent against actual code structure
// ---------------------------------------------------------------------------

function computeCoherence(
  tokens: import('../core/lir/types.js').LIRCodeToken[],
  visualIntent: import('../audio/types.js').VisualMappingParams,
): number {
  // Count distinct API calls in generated code
  const allCalls = new Set(tokens.flatMap(t => t.relationships.calls));

  // Simple heuristic: more API variety = richer visual output = better coherence
  // Normalized against the palette's hue count (more hues = expected more variety)
  const expectedVariety = Math.max(visualIntent.palette.hues.length, 3);
  const richnessRatio = Math.min(allCalls.size / (expectedVariety * 2), 1);
  return Math.round(richnessRatio * 100) / 100;
}

// Singleton instance
export const aestheticCritic = new AestheticCritic();
