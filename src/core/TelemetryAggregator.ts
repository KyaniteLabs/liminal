/**
 * Telemetry Aggregator
 * 
 * Collects and analyzes telemetry from LIMINAL generations to:
 * 1. Track model performance per domain
 * 2. Identify quality regressions
 * 3. Automatically update model routing recommendations
 * 4. Detect failing patterns early
 * 
 * @see AUDIT_FINDINGS.md for initial telemetry dataset
 */

export interface GenerationTelemetry {
  /** Unique ID for this generation */
  id: string;
  /** Timestamp */
  timestamp: Date;
  /** Domain (p5, glsl, three, hydra, strudel, revideo, etc.) */
  domain: string;
  /** Model ID used */
  modelId: string;
  /** Provider (minimax, qwen, gemma, kimi, etc.) */
  provider: string;
  /** Prompt given to the model */
  prompt: string;
  /** Generation time in milliseconds */
  generationTimeMs: number;
  /** Output size in bytes */
  outputSizeBytes: number;
  /** Whether validation passed */
  validationPassed: boolean;
  /** Validation errors if any */
  validationErrors: string[];
  /** Whether the output was usable */
  success: boolean;
  /** User rating 1-5 (if provided) */
  userRating?: number;
  /** Any error that occurred */
  error?: string;

  // ── Reasoning trace fields ──
  /** ID linking to a ReasoningCapture trace file */
  reasoningTraceId?: string;
  /** Source of thinking extraction (think_tags, narrative, provider_api, none) */
  thinkingSource?: string;
  /** Reasoning quality score 0-1 from ReasoningCapture */
  reasoningQuality?: number;
  /** Character length of extracted reasoning text */
  reasoningLength?: number;
  /** Pattern types detected in reasoning */
  detectedPatterns?: string[];
  /** Whether code was recovered from thinking trace */
  recoveredFromThinking?: boolean;
}

export interface ModelStats {
  modelId: string;
  domain: string;
  /** Total generations */
  totalGenerations: number;
  /** Successful generations */
  successfulGenerations: number;
  /** Failed generations */
  failedGenerations: number;
  /** Success rate 0-1 */
  successRate: number;
  /** Average generation time in seconds */
  avgGenerationTimeSeconds: number;
  /** Average output size in bytes */
  avgOutputSizeBytes: number;
  /** Average user rating */
  avgUserRating?: number;
  /** Most common validation errors */
  commonErrors: string[];
  /** Quality score (composite of size, success rate, speed) */
  qualityScore: number;
}

export interface DomainStats {
  domain: string;
  /** Total generations across all models */
  totalGenerations: number;
  /** Overall success rate */
  overallSuccessRate: number;
  /** Model rankings for this domain */
  modelRankings: ModelStats[];
  /** Best performing model */
  bestModel: string;
  /** Models to avoid */
  avoidModels: string[];
}

export interface TrendBucket {
  date: string;
  total: number;
  successful: number;
  successRate: number;
}

export interface ReasoningTrendBucket {
  date: string;
  total: number;
  avgQuality: number;
  avgReasoningLength: number;
  patternCounts: Record<string, number>;
  recoveryRate: number;
}

export interface TrendResult {
  buckets: TrendBucket[];
  reasoning?: ReasoningTrendBucket[];
}

export interface QualityAlert {
  /** Alert type */
  type: 'size_regression' | 'failure_spike' | 'quality_drop' | 'slow_generation';
  /** Severity */
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** Domain affected */
  domain: string;
  /** Model affected (if specific) */
  modelId?: string;
  /** Alert message */
  message: string;
  /** Suggested action */
  suggestedAction: string;
  /** Timestamp */
  timestamp: Date;
}

/**
 * Telemetry Aggregator class
 * 
 * Usage:
 * ```typescript
 * const telemetry = new TelemetryAggregator();
 * telemetry.record(generationData);
 * const stats = telemetry.getDomainStats('p5');
 * const alerts = telemetry.checkForIssues();
 * ```
 */
export class TelemetryAggregator {
  private generations: GenerationTelemetry[] = [];
  private maxHistorySize: number = 10000;
  
  // Thresholds for quality alerts
  private thresholds = {
    minSuccessRate: 0.8,        // Alert if success rate drops below 80%
    minOutputSize: {
      'p5': 500,
      'glsl': 800,
      'three': 800,
      'hydra': 150,
      'strudel': 100,
      'default': 200,
    },
    maxGenerationTimeSeconds: 120,  // Alert if generation takes > 2 minutes
    maxFailureSpike: 0.3,       // Alert if failure rate jumps > 30%
  };

  /**
   * Record a generation telemetry entry
   */
  record(telemetry: GenerationTelemetry): void {
    this.generations.push(telemetry);
    
    // Trim history if too large
    if (this.generations.length > this.maxHistorySize) {
      this.generations = this.generations.slice(-this.maxHistorySize);
    }
  }

  /**
   * Get statistics for a specific model in a domain
   */
  getModelStats(modelId: string, domain: string): ModelStats {
    const relevant = this.generations.filter(
      g => g.modelId === modelId && g.domain === domain
    );
    
    if (relevant.length === 0) {
      return {
        modelId,
        domain,
        totalGenerations: 0,
        successfulGenerations: 0,
        failedGenerations: 0,
        successRate: 0,
        avgGenerationTimeSeconds: 0,
        avgOutputSizeBytes: 0,
        commonErrors: [],
        qualityScore: 0,
      };
    }

    const successful = relevant.filter(g => g.success);
    const failed = relevant.filter(g => !g.success);
    
    // Calculate average generation time
    const avgTimeMs = relevant.reduce((sum, g) => sum + g.generationTimeMs, 0) / relevant.length;
    
    // Calculate average output size
    const avgSize = relevant.reduce((sum, g) => sum + g.outputSizeBytes, 0) / relevant.length;
    
    // Calculate average user rating
    const rated = relevant.filter(g => g.userRating !== undefined);
    const avgRating = rated.length > 0
      ? rated.reduce((sum, g) => sum + (g.userRating || 0), 0) / rated.length
      : undefined;
    
    // Find common errors
    const errorCounts = new Map<string, number>();
    for (const g of relevant) {
      for (const error of g.validationErrors) {
        errorCounts.set(error, (errorCounts.get(error) || 0) + 1);
      }
      if (g.error) {
        errorCounts.set(g.error, (errorCounts.get(g.error) || 0) + 1);
      }
    }
    const commonErrors = Array.from(errorCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([error]) => error);
    
    // Calculate composite quality score
    // Factors: success rate (40%), output size (30%), speed (20%), user rating (10%)
    const successRate = successful.length / relevant.length;
    const minSize = this.thresholds.minOutputSize[domain as keyof typeof this.thresholds.minOutputSize] || 200;
    const sizeScore = Math.min(avgSize / (minSize * 3), 1); // Cap at 3x minimum
    const timeScore = Math.max(0, 1 - (avgTimeMs / 1000) / this.thresholds.maxGenerationTimeSeconds);
    const ratingScore = avgRating !== undefined ? avgRating / 5 : 0.5;
    
    const qualityScore = 
      successRate * 0.4 +
      sizeScore * 0.3 +
      timeScore * 0.2 +
      ratingScore * 0.1;

    return {
      modelId,
      domain,
      totalGenerations: relevant.length,
      successfulGenerations: successful.length,
      failedGenerations: failed.length,
      successRate,
      avgGenerationTimeSeconds: avgTimeMs / 1000,
      avgOutputSizeBytes: avgSize,
      avgUserRating: avgRating,
      commonErrors,
      qualityScore: Math.round(qualityScore * 100) / 100,
    };
  }

  /**
   * Get statistics for all models in a domain
   */
  getDomainStats(domain: string): DomainStats {
    const allModels = new Set(this.generations.filter(g => g.domain === domain).map(g => g.modelId));
    
    const modelRankings = Array.from(allModels)
      .map(modelId => this.getModelStats(modelId, domain))
      .sort((a, b) => b.qualityScore - a.qualityScore);
    
    const totalGenerations = modelRankings.reduce((sum, m) => sum + m.totalGenerations, 0);
    const totalSuccessful = modelRankings.reduce((sum, m) => sum + m.successfulGenerations, 0);
    
    const bestModel = modelRankings[0]?.modelId || '';
    const avoidModels = modelRankings
      .filter(m => m.successRate < 0.5 || m.qualityScore < 0.3)
      .map(m => m.modelId);

    return {
      domain,
      totalGenerations,
      overallSuccessRate: totalGenerations > 0 ? totalSuccessful / totalGenerations : 0,
      modelRankings,
      bestModel,
      avoidModels,
    };
  }

  /**
   * Check for quality issues and generate alerts
   */
  checkForIssues(): QualityAlert[] {
    const alerts: QualityAlert[] = [];
    const domains = new Set(this.generations.map(g => g.domain));
    
    for (const domain of domains) {
      const stats = this.getDomainStats(domain);
      
      // Check overall success rate
      if (stats.overallSuccessRate < this.thresholds.minSuccessRate) {
        alerts.push({
          type: 'failure_spike',
          severity: 'high',
          domain,
          message: `Domain ${domain} has low success rate: ${(stats.overallSuccessRate * 100).toFixed(1)}%`,
          suggestedAction: 'Review prompts and validation for this domain',
          timestamp: new Date(),
        });
      }
      
      // Check individual models
      for (const modelStats of stats.modelRankings) {
        // Check success rate
        if (modelStats.successRate < 0.5) {
          alerts.push({
            type: 'failure_spike',
            severity: modelStats.successRate < 0.2 ? 'critical' : 'high',
            domain,
            modelId: modelStats.modelId,
            message: `${modelStats.modelId} on ${domain} has low success rate: ${(modelStats.successRate * 100).toFixed(1)}%`,
            suggestedAction: `Consider avoiding ${modelStats.modelId} for ${domain} domain`,
            timestamp: new Date(),
          });
        }
        
        // Check output size
        const minSize = this.thresholds.minOutputSize[domain as keyof typeof this.thresholds.minOutputSize] || 200;
        if (modelStats.avgOutputSizeBytes < minSize && modelStats.totalGenerations >= 3) {
          alerts.push({
            type: 'size_regression',
            severity: 'medium',
            domain,
            modelId: modelStats.modelId,
            message: `${modelStats.modelId} on ${domain} has small outputs: ${modelStats.avgOutputSizeBytes.toFixed(0)}b avg`,
            suggestedAction: 'Add minimum size constraints to prompt',
            timestamp: new Date(),
          });
        }
        
        // Check generation time
        if (modelStats.avgGenerationTimeSeconds > this.thresholds.maxGenerationTimeSeconds) {
          alerts.push({
            type: 'slow_generation',
            severity: 'low',
            domain,
            modelId: modelStats.modelId,
            message: `${modelStats.modelId} on ${domain} is slow: ${modelStats.avgGenerationTimeSeconds.toFixed(1)}s avg`,
            suggestedAction: 'Consider using faster model or optimizing prompt',
            timestamp: new Date(),
          });
        }
      }
    }
    
    return alerts;
  }

  /**
   * Export telemetry data for analysis
   */
  exportData(): {
    generations: GenerationTelemetry[];
    summary: {
      totalGenerations: number;
      totalSuccessful: number;
      overallSuccessRate: number;
      domains: string[];
      models: string[];
    };
  } {
    const totalSuccessful = this.generations.filter(g => g.success).length;
    
    return {
      generations: this.generations,
      summary: {
        totalGenerations: this.generations.length,
        totalSuccessful,
        overallSuccessRate: this.generations.length > 0 ? totalSuccessful / this.generations.length : 0,
        domains: Array.from(new Set(this.generations.map(g => g.domain))),
        models: Array.from(new Set(this.generations.map(g => g.modelId))),
      },
    };
  }

  /**
   * Load historical telemetry data
   */
  loadData(data: { generations: GenerationTelemetry[] }): void {
    this.generations = data.generations.map(g => ({
      ...g,
      timestamp: new Date(g.timestamp),
    }));
  }

  /**
   * Get historical trending data grouped by time buckets
   */
  getTrends(options: {
    granularity?: 'day' | 'week';
    model?: string;
    domain?: string;
    startDate?: string;
    endDate?: string;
  } = {}): TrendResult {
    const { granularity = 'day', model, domain, startDate, endDate } = options;
    const start = startDate ? new Date(startDate + 'T00:00:00Z') : undefined;
    const end = endDate ? new Date(endDate + 'T00:00:00Z') : undefined;

    const bucketMap = new Map<string, { total: number; successful: number }>();
    const reasoningMap = new Map<string, {
      total: number;
      qualitySum: number;
      lengthSum: number;
      patternCounts: Record<string, number>;
      recoveredCount: number;
    }>();

    for (const g of this.generations) {
      if (model && g.modelId !== model) continue;
      if (domain && g.domain !== domain) continue;

      const gDayStart = Date.UTC(
        g.timestamp.getUTCFullYear(),
        g.timestamp.getUTCMonth(),
        g.timestamp.getUTCDate()
      );

      if (start && gDayStart < start.getTime()) continue;
      if (end && gDayStart > end.getTime()) continue;

      const bucketKey = granularity === 'week'
        ? this.formatISOWeek(g.timestamp)
        : this.formatISODate(g.timestamp);

      const current = bucketMap.get(bucketKey) || { total: 0, successful: 0 };
      current.total++;
      if (g.success) current.successful++;
      bucketMap.set(bucketKey, current);

      // Accumulate reasoning data if present
      if (g.reasoningQuality !== undefined || g.reasoningLength !== undefined) {
        const rc = reasoningMap.get(bucketKey) || {
          total: 0,
          qualitySum: 0,
          lengthSum: 0,
          patternCounts: {} as Record<string, number>,
          recoveredCount: 0,
        };
        rc.total++;
        if (g.reasoningQuality !== undefined) rc.qualitySum += g.reasoningQuality;
        if (g.reasoningLength !== undefined) rc.lengthSum += g.reasoningLength;
        if (g.recoveredFromThinking) rc.recoveredCount++;
        for (const p of g.detectedPatterns ?? []) {
          rc.patternCounts[p] = (rc.patternCounts[p] || 0) + 1;
        }
        reasoningMap.set(bucketKey, rc);
      }
    }

    const buckets = Array.from(bucketMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, stats]) => ({
        date,
        total: stats.total,
        successful: stats.successful,
        successRate: stats.total > 0 ? stats.successful / stats.total : 0,
      }));

    // Build reasoning trends if any reasoning data exists
    let reasoning: ReasoningTrendBucket[] | undefined;
    if (reasoningMap.size > 0) {
      reasoning = Array.from(reasoningMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, rc]) => ({
          date,
          total: rc.total,
          avgQuality: rc.total > 0 ? Math.round((rc.qualitySum / rc.total) * 100) / 100 : 0,
          avgReasoningLength: rc.total > 0 ? Math.round(rc.lengthSum / rc.total) : 0,
          patternCounts: rc.patternCounts,
          recoveryRate: rc.total > 0 ? rc.recoveredCount / rc.total : 0,
        }));
    }

    return { buckets, reasoning };
  }

  private formatISODate(date: Date): string {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private formatISOWeek(date: Date): string {
    const tmp = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const dayNum = (tmp.getUTCDay() + 6) % 7;
    tmp.setUTCDate(tmp.getUTCDate() - dayNum + 3);
    const firstThursday = tmp.getTime();
    const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
    const weekNum = Math.ceil((((firstThursday - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${tmp.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
  }

  /**
   * Clear all telemetry data
   */
  clear(): void {
    this.generations = [];
  }
}

/**
 * Global telemetry instance
 */
export const globalTelemetry = new TelemetryAggregator();
