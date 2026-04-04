/**
 * Evolution Layer - The Constitution
 * 
 * Self-learning system that maintains a "constitution" of learned rules
 * from past failures. Enables the system to improve over time.
 */

import { LearnedRule, ErrorPattern, ExecutionContext } from '../core/types.js';

export interface FailureRecord {
  id: string;
  timestamp: number;
  taskId: string;
  guardrailId: string;
  errorType: string;
  errorMessage: string;
  context: ExecutionContext;
  resolution: 'autoFixed' | 'humanResolved' | 'escalated' | 'failed';
  fixDetails?: string;
}

export interface RuleApplication {
  ruleId: string;
  timestamp: number;
  success: boolean;
  context: string;
}

/**
 * The Constitution - Learned rules from experience
 */
export class Constitution {
  private rules: Map<string, LearnedRule> = new Map();
  private failures: FailureRecord[] = [];
  private applications: RuleApplication[] = [];
  private minConfidence = 0.3;
  private maxConfidence = 0.95;
  
  /**
   * Learn from a failure
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async learnFromFailure(failure: FailureRecord): Promise<LearnedRule | null> {
    // Don't learn from unresolved failures
    if (failure.resolution === 'failed') {
      return null;
    }
    
    // Extract pattern from failure
    const pattern = this.extractPattern(failure);
    
    // Check if similar rule already exists
    const existingRule = this.findSimilarRule(pattern);
    
    if (existingRule) {
      // Update existing rule
      this.updateRule(existingRule.id, failure.resolution === 'autoFixed');
      return existingRule;
    }
    
    // Create new rule
    const rule: LearnedRule = {
      id: `rule-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      pattern,
      prevention: this.generatePrevention(pattern, failure),
      remediation: this.generateRemediation(pattern, failure),
      confidence: 0.5, // Start with medium confidence
      active: true,
      successCount: failure.resolution === 'autoFixed' ? 1 : 0,
      failureCount: failure.resolution === 'autoFixed' ? 0 : 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    
    this.rules.set(rule.id, rule);
    this.failures.push(failure);
    
    return rule;
  }
  
  /**
   * Apply learned rules to prevent errors
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async applyPrevention(
    context: ExecutionContext,
    proposedAction: string
  ): Promise<{ prevented: boolean; reason?: string; ruleId?: string }> {
    for (const rule of this.getActiveRules()) {
      if (this.matchesPattern(rule.pattern, context, proposedAction)) {
        this.recordApplication(rule.id, true, 'prevention_check');
        
        return {
          prevented: true,
          reason: rule.prevention,
          ruleId: rule.id,
        };
      }
    }
    
    return { prevented: false };
  }
  
  /**
   * Get remediation suggestion from learned rules
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async getRemediationSuggestion(
    error: Error | string,
    _context: ExecutionContext
  ): Promise<{ suggestion?: string; ruleId?: string; confidence: number }> {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Find matching rules
    const matchingRules = Array.from(this.rules.values())
      .filter(r => r.active && this.errorMatchesPattern(r.pattern, errorMessage))
      .sort((a, b) => b.confidence - a.confidence);
    
    if (matchingRules.length === 0) {
      return { confidence: 0 };
    }
    
    const bestRule = matchingRules[0];
    this.recordApplication(bestRule.id, true, 'remediation_suggestion');
    
    return {
      suggestion: bestRule.remediation,
      ruleId: bestRule.id,
      confidence: bestRule.confidence,
    };
  }
  
  /**
   * Update rule confidence based on outcome
   */
  updateRuleConfidence(ruleId: string, success: boolean): void {
    const rule = this.rules.get(ruleId);
    if (!rule) return;
    
    rule.updatedAt = Date.now();
    
    if (success) {
      rule.successCount++;
      rule.confidence = Math.min(this.maxConfidence, rule.confidence + 0.1);
    } else {
      rule.failureCount++;
      rule.confidence = Math.max(this.minConfidence, rule.confidence - 0.2);
    }
    
    // Deprecate low-confidence rules
    if (rule.confidence < this.minConfidence) {
      rule.active = false;
    }
  }
  
  /**
   * Get all active rules
   */
  getActiveRules(): LearnedRule[] {
    return Array.from(this.rules.values())
      .filter(r => r.active)
      .sort((a, b) => b.confidence - a.confidence);
  }
  
  /**
   * Get all rules (including inactive)
   */
  getAllRules(): LearnedRule[] {
    return Array.from(this.rules.values());
  }
  
  /**
   * Get rule by ID
   */
  getRule(id: string): LearnedRule | undefined {
    return this.rules.get(id);
  }
  
  /**
   * Get failure statistics
   */
  getFailureStats(): {
    totalFailures: number;
    autoFixed: number;
    humanResolved: number;
    escalated: number;
    failed: number;
    uniqueErrorTypes: number;
  } {
    const stats: {
      totalFailures: number;
      autoFixed: number;
      humanResolved: number;
      escalated: number;
      failed: number;
      uniqueErrorTypes: number;
    } = {
      totalFailures: this.failures.length,
      autoFixed: this.failures.filter(f => f.resolution === 'autoFixed').length,
      humanResolved: this.failures.filter(f => f.resolution === 'humanResolved').length,
      escalated: this.failures.filter(f => f.resolution === 'escalated').length,
      failed: this.failures.filter(f => f.resolution === 'failed').length,
      uniqueErrorTypes: new Set(this.failures.map(f => f.errorType)).size,
    };
    
    return stats;
  }
  
  /**
   * Get rule effectiveness report
   */
  getEffectivenessReport(): {
    totalRules: number;
    activeRules: number;
    avgConfidence: number;
    totalApplications: number;
    successRate: number;
  } {
    const allRules = this.getAllRules();
    const activeRules = this.getActiveRules();
    
    if (allRules.length === 0) {
      return {
        totalRules: 0,
        activeRules: 0,
        avgConfidence: 0,
        totalApplications: 0,
        successRate: 0,
      };
    }
    
    const totalApplications = this.applications.length;
    const successfulApplications = this.applications.filter(a => a.success).length;
    
    return {
      totalRules: allRules.length,
      activeRules: activeRules.length,
      avgConfidence: allRules.reduce((sum, r) => sum + r.confidence, 0) / allRules.length,
      totalApplications,
      successRate: totalApplications > 0 ? successfulApplications / totalApplications : 0,
    };
  }
  
  /**
   * Export constitution to JSON
   */
  export(): { rules: LearnedRule[]; stats: ReturnType<Constitution['getEffectivenessReport']> } {
    return {
      rules: this.getAllRules(),
      stats: this.getEffectivenessReport(),
    };
  }
  
  /**
   * Import constitution from JSON
   */
  import(data: { rules: LearnedRule[] }): void {
    for (const rule of data.rules) {
      this.rules.set(rule.id, rule);
    }
  }
  
  /**
   * Extract pattern from failure
   */
  private extractPattern(failure: FailureRecord): ErrorPattern {
    // Extract key tokens from error message
    const errorTokens = failure.errorMessage
      .split(/\s+/)
      .filter(t => t.length > 3 && !['error', 'failed', 'cannot'].includes(t.toLowerCase()))
      .slice(0, 5);
    
    return {
      messagePattern: new RegExp(errorTokens.join('.*'), 'i'),
      errorType: failure.errorType,
      contextConditions: {
        guardrailId: failure.guardrailId,
        hasFixDetails: !!failure.fixDetails,
      },
    };
  }
  
  /**
   * Find similar existing rule
   */
  private findSimilarRule(pattern: ErrorPattern): LearnedRule | null {
    for (const rule of this.rules.values()) {
      if (rule.pattern.errorType === pattern.errorType) {
        // Check if patterns are similar enough
        return rule;
      }
    }
    return null;
  }
  
  /**
   * Check if context matches pattern
   */
  private matchesPattern(
    pattern: ErrorPattern,
    _context: ExecutionContext,
    proposedAction: string
  ): boolean {
    // Check error type match
    if (pattern.contextConditions?.guardrailId) {
      // Could check specific conditions
    }
    
    // Check proposed action against pattern
    if (pattern.messagePattern && !pattern.messagePattern.test(proposedAction)) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Check if error matches pattern
   */
  private errorMatchesPattern(pattern: ErrorPattern, errorMessage: string): boolean {
    if (pattern.messagePattern) {
      return pattern.messagePattern.test(errorMessage);
    }
    return false;
  }
  
  /**
   * Generate prevention strategy
   */
  private generatePrevention(_pattern: ErrorPattern, failure: FailureRecord): string {
    // Pattern could be used for more sophisticated prevention strategies
    void _pattern;
    return `Before ${failure.errorType}: Ensure proper validation and error handling`;
  }
  
  /**
   * Generate remediation strategy
   */
  private generateRemediation(_pattern: ErrorPattern, failure: FailureRecord): string {
    // Pattern could be used for more sophisticated remediation strategies
    void _pattern;
    if (failure.fixDetails) {
      return failure.fixDetails;
    }
    return `Fix ${failure.errorType}: Review error message and apply appropriate fix`;
  }
  
  /**
   * Update existing rule with new information
   */
  private updateRule(ruleId: string, wasSuccessful: boolean): void {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.updatedAt = Date.now();
      if (wasSuccessful) {
        rule.successCount++;
        rule.confidence = Math.min(this.maxConfidence, rule.confidence + 0.05);
      } else {
        rule.failureCount++;
      }
    }
  }
  
  /**
   * Record rule application
   */
  private recordApplication(ruleId: string, success: boolean, context: string): void {
    this.applications.push({
      ruleId,
      timestamp: Date.now(),
      success,
      context,
    });
  }
}

// Global constitution
let globalConstitution: Constitution | null = null;

export function initializeConstitution(): Constitution {
  globalConstitution = new Constitution();
  return globalConstitution;
}

export function getConstitution(): Constitution | null {
  return globalConstitution;
}
