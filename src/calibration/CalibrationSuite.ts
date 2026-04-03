/**
 * CalibrationSuite - System for calibrating scoring to human judgment
 *
 * Workflow:
 * 1. Generate N outputs
 * 2. Collect human ratings (or use simulated ratings)
 * 3. Calculate correlation between system scores and human ratings
 * 4. Adjust weights to maximize correlation
 * 5. Store calibration data in HarnessMemory
 */

import { CorrelationCalculator, type CorrelationResult, type RegressionResult } from './CorrelationCalculator.js';
import type { AssessmentResult } from '../core/CreativeEvaluator.js';
import type { AestheticReport } from '../aesthetic/types.js';

export interface CalibrationSample {
  id: string;
  code: string;
  domain: string;
  systemScore: number;
  humanRating?: number;
  technicalScore: number;
  creativeScore: number;
  aestheticScore?: number;
  noveltyScore?: number;
  emergenceScore?: number;
  interestingnessScore?: number;
  timestamp: number;
}

export interface CalibrationWeights {
  technicalWeight: number;
  creativeWeight: number;
  aestheticWeight: number;
  noveltyWeight: number;
  emergenceWeight: number;
  interestingnessWeight: number;
}

export interface CalibrationResult {
  correlation: CorrelationResult;
  regression: RegressionResult;
  optimalWeights: CalibrationWeights;
  mse: number;
  isCalibrated: boolean;
  sampleCount: number;
  domain: string;
  timestamp: number;
}

export interface CalibrationSession {
  id: string;
  domain: string;
  samples: CalibrationSample[];
  result?: CalibrationResult;
  status: 'collecting' | 'calculating' | 'completed' | 'failed';
  startedAt: number;
  completedAt?: number;
}

export interface CalibrationData {
  version: number;
  sessions: CalibrationSession[];
  currentWeights: Record<string, CalibrationWeights>;
  lastCalibrated: Record<string, number>;
}

const CALIBRATION_VERSION = 1;

export class CalibrationSuite {
  private sessions: Map<string, CalibrationSession> = new Map();
  private currentWeights: Map<string, CalibrationWeights> = new Map();
  private defaultWeights: CalibrationWeights = {
    technicalWeight: 0.3,
    creativeWeight: 0.3,
    aestheticWeight: 0.2,
    noveltyWeight: 0.1,
    emergenceWeight: 0.05,
    interestingnessWeight: 0.05,
  };

  /**
   * Start a new calibration session for a domain
   */
  startSession(domain: string, sessionId?: string): CalibrationSession {
    const id = sessionId || `cal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const session: CalibrationSession = {
      id,
      domain,
      samples: [],
      status: 'collecting',
      startedAt: Date.now(),
    };
    this.sessions.set(id, session);
    return session;
  }

  /**
   * Add a sample to the calibration session
   */
  addSample(
    sessionId: string,
    code: string,
    evaluation: AssessmentResult | AestheticReport,
    domain: string,
  ): CalibrationSample {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const sample: CalibrationSample = {
      id: `sample_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      code,
      domain,
      systemScore: evaluation.score,
      technicalScore: 'technicalScore' in evaluation ? evaluation.technicalScore : evaluation.score,
      creativeScore: 'creativeScore' in evaluation ? evaluation.creativeScore : evaluation.score,
      aestheticScore: 'aestheticScore' in evaluation ? evaluation.aestheticScore : undefined,
      noveltyScore: 'noveltyScore' in evaluation ? evaluation.noveltyScore : undefined,
      emergenceScore: 'emergenceScore' in evaluation ? evaluation.emergenceScore : undefined,
      interestingnessScore: 'interestingnessScore' in evaluation ? evaluation.interestingnessScore : undefined,
      timestamp: Date.now(),
    };

    session.samples.push(sample);
    return sample;
  }

  /**
   * Add human rating to a sample
   */
  addHumanRating(sessionId: string, sampleId: string, rating: number): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const sample = session.samples.find(s => s.id === sampleId);
    if (!sample) {
      throw new Error(`Sample ${sampleId} not found`);
    }

    sample.humanRating = Math.max(0, Math.min(1, rating));
  }

  /**
   * Simulate human ratings based on code complexity (for testing)
   */
  simulateHumanRatings(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    for (const sample of session.samples) {
      // Simulate human judgment based on multiple factors with some noise
      const baseScore = sample.systemScore;
      const complexityBonus = (sample.code.length > 200 ? 0.1 : 0) + (sample.code.length > 500 ? 0.1 : 0);
      const noise = (Math.random() - 0.5) * 0.2; // ±10% noise
      
      sample.humanRating = Math.max(0, Math.min(1, baseScore + complexityBonus + noise));
    }
  }

  /**
   * Calculate calibration from collected samples
   */
  calculateCalibration(sessionId: string): CalibrationResult {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    session.status = 'calculating';

    const samplesWithRatings = session.samples.filter(s => s.humanRating !== undefined);
    if (samplesWithRatings.length < 5) {
      throw new Error('Need at least 5 samples with human ratings to calibrate');
    }

    const systemScores = samplesWithRatings.map(s => s.systemScore);
    const humanRatings = samplesWithRatings.map(s => s.humanRating!);

    // Calculate correlations
    const correlation = CorrelationCalculator.calculateBoth(systemScores, humanRatings);

    // Perform regression
    const regression = CorrelationCalculator.linearRegression(systemScores, humanRatings);

    // Calculate MSE
    const mse = CorrelationCalculator.meanSquaredError(systemScores, humanRatings);

    // Find optimal weights using feature data
    const features = samplesWithRatings.map(s => [
      s.technicalScore,
      s.creativeScore,
      s.aestheticScore ?? s.creativeScore,
      s.noveltyScore ?? s.creativeScore * 0.8,
      s.emergenceScore ?? s.creativeScore * 0.6,
      s.interestingnessScore ?? s.creativeScore * 0.7,
    ]);

    const optimalRawWeights = CorrelationCalculator.findOptimalWeights(features, humanRatings);

    // Normalize to ensure weights sum to 1
    const totalWeight = optimalRawWeights.reduce((a, b) => a + b, 0);
    const normalizedWeights = optimalRawWeights.map(w => w / totalWeight);

    const optimalWeights: CalibrationWeights = {
      technicalWeight: normalizedWeights[0] ?? this.defaultWeights.technicalWeight,
      creativeWeight: normalizedWeights[1] ?? this.defaultWeights.creativeWeight,
      aestheticWeight: normalizedWeights[2] ?? this.defaultWeights.aestheticWeight,
      noveltyWeight: normalizedWeights[3] ?? this.defaultWeights.noveltyWeight,
      emergenceWeight: normalizedWeights[4] ?? this.defaultWeights.emergenceWeight,
      interestingnessWeight: normalizedWeights[5] ?? this.defaultWeights.interestingnessWeight,
    };

    const result: CalibrationResult = {
      correlation,
      regression,
      optimalWeights,
      mse,
      isCalibrated: CorrelationCalculator.isGoodCalibration(correlation.pearson),
      sampleCount: samplesWithRatings.length,
      domain: session.domain,
      timestamp: Date.now(),
    };

    session.result = result;
    session.status = 'completed';
    session.completedAt = Date.now();

    // Store the weights for this domain
    this.currentWeights.set(session.domain, optimalWeights);

    return result;
  }

  /**
   * Get current weights for a domain (or default if not calibrated)
   */
  getWeights(domain: string): CalibrationWeights {
    return this.currentWeights.get(domain) ?? { ...this.defaultWeights };
  }

  /**
   * Set weights for a domain manually
   */
  setWeights(domain: string, weights: Partial<CalibrationWeights>): void {
    const current = this.getWeights(domain);
    this.currentWeights.set(domain, { ...current, ...weights });
  }

  /**
   * Apply calibrated weights to calculate adjusted score
   */
  calculateAdjustedScore(
    scores: Partial<CalibrationWeights> & { systemScore?: number },
    domain: string,
  ): number {
    const weights = this.getWeights(domain);
    
    // If we have individual component scores, use weighted sum
    if (scores.technicalWeight !== undefined || scores.creativeWeight !== undefined) {
      let weightedSum = 0;
      let totalWeight = 0;

      if (scores.technicalWeight !== undefined) {
        weightedSum += scores.technicalWeight * weights.technicalWeight;
        totalWeight += weights.technicalWeight;
      }
      if (scores.creativeWeight !== undefined) {
        weightedSum += scores.creativeWeight * weights.creativeWeight;
        totalWeight += weights.creativeWeight;
      }
      if (scores.aestheticWeight !== undefined) {
        weightedSum += scores.aestheticWeight * weights.aestheticWeight;
        totalWeight += weights.aestheticWeight;
      }
      if (scores.noveltyWeight !== undefined) {
        weightedSum += scores.noveltyWeight * weights.noveltyWeight;
        totalWeight += weights.noveltyWeight;
      }
      if (scores.emergenceWeight !== undefined) {
        weightedSum += scores.emergenceWeight * weights.emergenceWeight;
        totalWeight += weights.emergenceWeight;
      }
      if (scores.interestingnessWeight !== undefined) {
        weightedSum += scores.interestingnessWeight * weights.interestingnessWeight;
        totalWeight += weights.interestingnessWeight;
      }

      return totalWeight > 0 ? weightedSum / totalWeight : scores.systemScore ?? 0.5;
    }

    // Otherwise return original system score
    return scores.systemScore ?? 0.5;
  }

  /**
   * Get calibration session
   */
  getSession(sessionId: string): CalibrationSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get all sessions
   */
  getAllSessions(): CalibrationSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Get sessions for a domain
   */
  getSessionsForDomain(domain: string): CalibrationSession[] {
    return Array.from(this.sessions.values()).filter(s => s.domain === domain);
  }

  /**
   * Serialize calibration data for storage
   */
  serialize(): CalibrationData {
    const sessions: CalibrationSession[] = [];
    for (const session of this.sessions.values()) {
      sessions.push(session);
    }

    const currentWeights: Record<string, CalibrationWeights> = {};
    for (const [domain, weights] of this.currentWeights.entries()) {
      currentWeights[domain] = weights;
    }

    const lastCalibrated: Record<string, number> = {};
    for (const [domain, _weights] of this.currentWeights.entries()) {
      const completedSession = this.getSessionsForDomain(domain).find(s => s.status === 'completed');
      if (completedSession?.completedAt) {
        lastCalibrated[domain] = completedSession.completedAt;
      }
    }

    return {
      version: CALIBRATION_VERSION,
      sessions,
      currentWeights,
      lastCalibrated,
    };
  }

  /**
   * Deserialize calibration data from storage
   */
  deserialize(data: CalibrationData): void {
    if (data.version !== CALIBRATION_VERSION) {
      console.warn(`[CalibrationSuite] Version mismatch: ${data.version} vs ${CALIBRATION_VERSION}`);
    }

    this.sessions.clear();
    for (const session of data.sessions) {
      this.sessions.set(session.id, session);
    }

    this.currentWeights.clear();
    for (const [domain, weights] of Object.entries(data.currentWeights)) {
      this.currentWeights.set(domain, weights);
    }
  }

  /**
   * Clear all calibration data
   */
  clear(): void {
    this.sessions.clear();
    this.currentWeights.clear();
  }

  /**
   * Check if a domain has been calibrated
   */
  isCalibrated(domain: string): boolean {
    const sessions = this.getSessionsForDomain(domain);
    return sessions.some(s => s.status === 'completed' && s.result?.isCalibrated);
  }

  /**
   * Get calibration quality for a domain
   */
  getCalibrationQuality(domain: string): { pearson: number; spearman: number; sampleCount: number } | null {
    const sessions = this.getSessionsForDomain(domain);
    const completed = sessions.find(s => s.status === 'completed' && s.result);
    if (!completed?.result) {
      return null;
    }
    return {
      pearson: completed.result.correlation.pearson,
      spearman: completed.result.correlation.spearman,
      sampleCount: completed.result.sampleCount,
    };
  }
}

// Singleton instance
export const calibrationSuite = new CalibrationSuite();
