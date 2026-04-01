/**
 * SelfEvaluation - Meta-Harness self-monitoring and correction
 * 
 * Implements outer-loop harness engineering from:
 * "Building a Working Meta-Harness for AI Research" (arXiv:2603.28052)
 * 
 * Core capabilities:
 * 1. Task success rate tracking
 * 2. Error pattern detection  
 * 3. Strategy effectiveness scoring
 * 4. Automatic retry with adjusted parameters
 * 5. Performance regression detection
 */

import { harnessMemory } from './HarnessMemory.js';
import { failureLogger } from './FailureLogger.js';

export interface TaskOutcome {
  taskId: string;
  success: boolean;
  duration: number;
  toolsUsed: string[];
  errors: string[];
  strategy: string;
  timestamp: string;
}

export interface StrategyMetrics {
  strategy: string;
  attempts: number;
  successes: number;
  failures: number;
  avgDuration: number;
  errorPatterns: Map<string, number>;
  lastUsed: string;
}

export interface SelfEvaluationReport {
  overallSuccessRate: number;
  recentSuccessRate: number; // Last 10 tasks
  bestStrategy: string;
  worstStrategy: string;
  commonErrors: string[];
  recommendations: string[];
  needsImprovement: boolean;
}

export class SelfEvaluation {
  private taskHistory: TaskOutcome[] = [];
  private strategyMetrics: Map<string, StrategyMetrics> = new Map();
  private readonly MAX_HISTORY = 100;

  /**
   * Record task outcome for analysis
   */
  recordOutcome(outcome: TaskOutcome): void {
    this.taskHistory.push(outcome);
    
    // Trim history
    if (this.taskHistory.length > this.MAX_HISTORY) {
      this.taskHistory.shift();
    }

    // Update strategy metrics
    this.updateStrategyMetrics(outcome);

    // Record to persistent memory
    harnessMemory.recordEpisode({
      type: 'task',
      domain: 'harness',
      prompt: outcome.taskId,
      code: JSON.stringify(outcome),
      metadata: {
        success: outcome.success,
        duration: outcome.duration,
        strategy: outcome.strategy,
      },
    });
  }

  /**
   * Evaluate current performance
   */
  evaluate(): SelfEvaluationReport {
    const recent = this.taskHistory.slice(-10);
    const recentSuccesses = recent.filter(t => t.success).length;
    const recentRate = recent.length > 0 ? recentSuccesses / recent.length : 0;

    const totalSuccesses = this.taskHistory.filter(t => t.success).length;
    const overallRate = this.taskHistory.length > 0 
      ? totalSuccesses / this.taskHistory.length 
      : 0;

    // Find best/worst strategies
    let bestStrategy = '';
    let worstStrategy = '';
    let bestRate = -1;
    let worstRate = 2;

    for (const [strategy, metrics] of this.strategyMetrics) {
      const rate = metrics.attempts > 0 
        ? metrics.successes / metrics.attempts 
        : 0;
      
      if (rate > bestRate) {
        bestRate = rate;
        bestStrategy = strategy;
      }
      if (rate < worstRate) {
        worstRate = rate;
        worstStrategy = strategy;
      }
    }

    // Detect common errors
    const errorCounts = new Map<string, number>();
    for (const task of this.taskHistory) {
      for (const error of task.errors) {
        errorCounts.set(error, (errorCounts.get(error) || 0) + 1);
      }
    }

    const commonErrors = Array.from(errorCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([error, count]) => `${error} (${count}x)`);

    // Generate recommendations
    const recommendations: string[] = [];

    if (recentRate < 0.5) {
      recommendations.push('CRITICAL: Success rate below 50%. Consider fallback strategies.');
    } else if (recentRate < 0.7) {
      recommendations.push('WARNING: Success rate declining. Review recent failures.');
    }

    if (bestStrategy && bestStrategy !== 'default') {
      recommendations.push(`Use '${bestStrategy}' strategy more often (success rate: ${(bestRate * 100).toFixed(1)}%)`);
    }

    if (worstStrategy && worstRate < 0.3) {
      recommendations.push(`Deprecate '${worstStrategy}' strategy (success rate: ${(worstRate * 100).toFixed(1)}%)`);
    }

    // Check for error patterns
    if (commonErrors.some(e => e.includes('timeout'))) {
      recommendations.push('Increase timeout thresholds - multiple timeout failures detected');
    }

    if (commonErrors.some(e => e.includes('validation'))) {
      recommendations.push('Strengthen pre-validation - validation failures common');
    }

    return {
      overallSuccessRate: overallRate,
      recentSuccessRate: recentRate,
      bestStrategy,
      worstStrategy,
      commonErrors,
      recommendations,
      needsImprovement: recentRate < 0.7 || overallRate < 0.8,
    };
  }

  /**
   * Determine if retry should be attempted with adjusted strategy
   */
  shouldRetry(taskId: string, previousStrategy: string): { 
    shouldRetry: boolean; 
    newStrategy: string;
    reason: string;
  } {
    const previousAttempts = this.taskHistory.filter(t => 
      t.taskId === taskId && !t.success
    ).length;

    // Don't retry more than 3 times
    if (previousAttempts >= 3) {
      return {
        shouldRetry: false,
        newStrategy: '',
        reason: 'Max retry attempts reached (3)',
      };
    }

    // Find better strategy
    const currentMetrics = this.strategyMetrics.get(previousStrategy);
    const currentRate = currentMetrics 
      ? currentMetrics.successes / currentMetrics.attempts 
      : 0;

    let betterStrategy = previousStrategy;
    let betterRate = currentRate;

    for (const [strategy, metrics] of this.strategyMetrics) {
      if (strategy === previousStrategy) continue;
      
      const rate = metrics.attempts > 0 
        ? metrics.successes / metrics.attempts 
        : 0;
      
      if (rate > betterRate) {
        betterRate = rate;
        betterStrategy = strategy;
      }
    }

    if (betterStrategy !== previousStrategy) {
      return {
        shouldRetry: true,
        newStrategy: betterStrategy,
        reason: `Switching from '${previousStrategy}' to '${betterStrategy}' (success rate: ${(betterRate * 100).toFixed(1)}%)`,
      };
    }

    // Same strategy but with modifications
    return {
      shouldRetry: previousAttempts < 2,
      newStrategy: previousStrategy,
      reason: `Retry ${previousAttempts + 1}/3 with same strategy`,
    };
  }

  /**
   * Detect performance regression
   */
  detectRegression(windowSize = 10): {
    hasRegression: boolean;
    severity: 'none' | 'mild' | 'severe';
    details: string;
  } {
    if (this.taskHistory.length < windowSize * 2) {
      return {
        hasRegression: false,
        severity: 'none',
        details: 'Insufficient data for regression detection',
      };
    }

    const recent = this.taskHistory.slice(-windowSize);
    const previous = this.taskHistory.slice(-windowSize * 2, -windowSize);

    const recentSuccesses = recent.filter(t => t.success).length;
    const previousSuccesses = previous.filter(t => t.success).length;

    const recentRate = recentSuccesses / recent.length;
    const previousRate = previousSuccesses / previous.length;

    const decline = previousRate - recentRate;

    if (decline > 0.3) {
      return {
        hasRegression: true,
        severity: 'severe',
        details: `Severe regression: success rate dropped ${(decline * 100).toFixed(1)}% (${(previousRate * 100).toFixed(1)}% → ${(recentRate * 100).toFixed(1)}%)`,
      };
    } else if (decline > 0.15) {
      return {
        hasRegression: true,
        severity: 'mild',
        details: `Mild regression: success rate dropped ${(decline * 100).toFixed(1)}% (${(previousRate * 100).toFixed(1)}% → ${(recentRate * 100).toFixed(1)}%)`,
      };
    }

    return {
      hasRegression: false,
      severity: 'none',
      details: `No regression detected (${(previousRate * 100).toFixed(1)}% → ${(recentRate * 100).toFixed(1)}%)`,
    };
  }

  /**
   * Get suggestions for improving specific error type
   */
  getErrorRemediation(error: string): string[] {
    const errorLower = error.toLowerCase();
    
    if (errorLower.includes('timeout')) {
      return [
        'Increase timeout threshold',
        'Break task into smaller subtasks',
        'Use streaming for long operations',
      ];
    }

    if (errorLower.includes('syntax')) {
      return [
        'Add pre-generation syntax validation',
        'Use AST validator on output',
        'Provide more explicit syntax examples',
      ];
    }

    if (errorLower.includes('validation')) {
      return [
        'Strengthen post-generation validation',
        'Add more guardrails',
        'Check output against schema',
      ];
    }

    if (errorLower.includes('permission') || errorLower.includes('access')) {
      return [
        'Check file permissions',
        'Validate paths before access',
        'Use sandboxed operations',
      ];
    }

    return [
      'Review error logs for patterns',
      'Add specific handling for this error type',
      'Consider fallback strategies',
    ];
  }

  /**
   * Generate self-improvement task for harness
   */
  generateImprovementTask(): {
    shouldCreate: boolean;
    title?: string;
    description?: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
  } {
    const evaluation = this.evaluate();
    const regression = this.detectRegression();

    if (regression.hasRegression && regression.severity === 'severe') {
      return {
        shouldCreate: true,
        title: 'URGENT: Fix performance regression',
        description: regression.details + '\n\nRecommendations:\n' + evaluation.recommendations.join('\n'),
        priority: 'critical',
      };
    }

    if (evaluation.needsImprovement) {
      return {
        shouldCreate: true,
        title: `Improve ${evaluation.worstStrategy} strategy`,
        description: `Current success rate: ${(this.strategyMetrics.get(evaluation.worstStrategy)?.successes || 0) / (this.strategyMetrics.get(evaluation.worstStrategy)?.attempts || 1) * 100}%\n\nCommon errors:\n${evaluation.commonErrors.slice(0, 3).join('\n')}`,
        priority: 'high',
      };
    }

    if (regression.hasRegression) {
      return {
        shouldCreate: true,
        title: 'Address mild performance regression',
        description: regression.details,
        priority: 'medium',
      };
    }

    return {
      shouldCreate: false,
      priority: 'low',
    };
  }

  private updateStrategyMetrics(outcome: TaskOutcome): void {
    const existing = this.strategyMetrics.get(outcome.strategy);
    
    if (existing) {
      existing.attempts++;
      if (outcome.success) {
        existing.successes++;
      } else {
        existing.failures++;
      }
      
      // Update average duration
      existing.avgDuration = 
        (existing.avgDuration * (existing.attempts - 1) + outcome.duration) / existing.attempts;
      
      // Update error patterns
      for (const error of outcome.errors) {
        existing.errorPatterns.set(error, (existing.errorPatterns.get(error) || 0) + 1);
      }
      
      existing.lastUsed = outcome.timestamp;
    } else {
      const errorPatterns = new Map<string, number>();
      for (const error of outcome.errors) {
        errorPatterns.set(error, 1);
      }

      this.strategyMetrics.set(outcome.strategy, {
        strategy: outcome.strategy,
        attempts: 1,
        successes: outcome.success ? 1 : 0,
        failures: outcome.success ? 0 : 1,
        avgDuration: outcome.duration,
        errorPatterns,
        lastUsed: outcome.timestamp,
      });
    }
  }

  /**
   * Get summary for display
   */
  getSummary(): string {
    const eval_ = this.evaluate();
    
    return [
      '📊 Harness Self-Evaluation',
      '',
      `Overall Success Rate: ${(eval_.overallSuccessRate * 100).toFixed(1)}%`,
      `Recent Success Rate: ${(eval_.recentSuccessRate * 100).toFixed(1)}%`,
      `Best Strategy: ${eval_.bestStrategy || 'N/A'}`,
      `Active Strategies: ${this.strategyMetrics.size}`,
      '',
      'Recommendations:',
      ...eval_.recommendations.map(r => `  • ${r}`),
    ].join('\n');
  }
}

export const selfEvaluation = new SelfEvaluation();
