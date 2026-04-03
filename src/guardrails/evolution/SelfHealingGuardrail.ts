/**
 * Self-Healing Guardrail
 * 
 * Uses the Constitution to prevent errors and apply learned remedies.
 * This is the highest tier of guardrail - it learns from past failures.
 */

import { GuardrailRule, GuardrailResult, ExecutionContext, GuardrailTier, RemediationResult } from '../core/types.js';
import { Constitution, FailureRecord } from './Constitution.js';

export interface SelfHealingConfig {
  /** Minimum confidence threshold to apply a learned rule */
  confidenceThreshold: number;
  
  /** Maximum number of healing attempts per task */
  maxHealingAttempts: number;
  
  /** Enable prevention mode (block actions matching known failure patterns) */
  enablePrevention: boolean;
  
  /** Enable suggestion mode (provide remediation hints) */
  enableSuggestions: boolean;
}

/**
 * Self-Healing Guardrail
 * 
 * Leverages the Constitution to:
 * 1. Prevent actions that match known failure patterns
 * 2. Suggest remediation strategies from past successful fixes
 * 3. Learn from every failure and resolution
 */
export class SelfHealingGuardrail implements GuardrailRule {
  id = 'guardrail-self-healing';
  description = 'Learns from failures and prevents recurring errors through pattern matching and remediation suggestions';
  tier = GuardrailTier.AUTONOMOUS;
  category = 'evolution' as const;
  
  private constitution: Constitution;
  private config: SelfHealingConfig;
  private healingAttempts: Map<string, number> = new Map();
  
  constructor(
    constitution: Constitution,
    config: Partial<SelfHealingConfig> = {}
  ) {
    this.constitution = constitution;
    this.config = {
      confidenceThreshold: 0.7,
      maxHealingAttempts: 3,
      enablePrevention: true,
      enableSuggestions: true,
      ...config,
    };
  }
  
  /**
   * Evaluate: Check for prevention rules and provide suggestions
   */
  async evaluate(context: ExecutionContext): Promise<GuardrailResult> {
    const attempts = this.healingAttempts.get(context.taskId) || 0;
    
    // Check if we've exceeded healing attempts
    if (attempts >= this.config.maxHealingAttempts) {
      return {
        passed: false,
        guardrailId: this.id,
        severity: 'error',
        message: `Maximum healing attempts (${this.config.maxHealingAttempts}) exceeded for task ${context.taskId}`,
        details: { attempts, maxAttempts: this.config.maxHealingAttempts },
      };
    }
    
    // Get active prevention rules
    const activeRules = this.constitution.getActiveRules()
      .filter(r => r.confidence >= this.config.confidenceThreshold);
    
    // Check if any rule would prevent current action
    const applicableRules = [];
    
    if (this.config.enablePrevention) {
      const proposedAction = this.getProposedAction(context);
      
      for (const _rule of activeRules) {
        const prevention = await this.constitution.applyPrevention(context, proposedAction);
        if (prevention.prevented) {
          applicableRules.push({
            ruleId: prevention.ruleId,
            reason: prevention.reason,
            confidence: this.constitution.getRule(prevention.ruleId!)?.confidence || 0,
          });
        }
      }
    }
    
    if (applicableRules.length > 0) {
      return {
        passed: false,
        guardrailId: this.id,
        severity: 'warning',
        message: `Prevented ${applicableRules.length} potential failure(s) based on learned patterns`,
        details: {
          applicableRules,
          preventionEnabled: this.config.enablePrevention,
        },
        suggestion: applicableRules.map(r => r.reason).join('; '),
      };
    }
    
    // Record that we're monitoring this task
    return {
      passed: true,
      guardrailId: this.id,
      severity: 'info',
      message: `Self-healing active. Monitoring with ${activeRules.length} learned rules.`,
      details: {
        learnedRules: activeRules.length,
        healingAttempts: attempts,
        maxHealingAttempts: this.config.maxHealingAttempts,
      },
    };
  }
  
  /**
   * Remediate: Apply learned remediation strategy
   */
  async remediate(
    context: ExecutionContext,
    violation: GuardrailResult
  ): Promise<RemediationResult> {
    const attempts = this.healingAttempts.get(context.taskId) || 0;
    this.healingAttempts.set(context.taskId, attempts + 1);
    
    // Get remediation suggestion from Constitution
    if (!this.config.enableSuggestions) {
      return {
        success: false,
        action: 'suggest_manual_review',
        message: 'Self-healing suggestions disabled',
      };
    }
    
    const errorMessage = violation.message;
    const suggestion = await this.constitution.getRemediationSuggestion(
      errorMessage,
      context
    );
    
    if (!suggestion.suggestion || suggestion.confidence < this.config.confidenceThreshold) {
      return {
        success: false,
        action: 'escalate_to_human',
        message: `No learned remediation available (confidence: ${(suggestion.confidence * 100).toFixed(1)}%)`,
        details: {
          confidence: suggestion.confidence,
          threshold: this.config.confidenceThreshold,
        },
      };
    }
    
    return {
      success: true,
      action: 'apply_learned_remediation',
      message: `Applying learned fix (confidence: ${(suggestion.confidence * 100).toFixed(1)}%)`,
      newContext: {
        ...context,
        // Add suggestion to trace
        trace: {
          steps: [
            ...context.trace.steps,
            {
              timestamp: Date.now(),
              action: 'self_healing_suggestion',
              details: {
                suggestion: suggestion.suggestion,
                confidence: suggestion.confidence,
                ruleId: suggestion.ruleId,
              },
            },
          ],
        },
      },
      details: {
        suggestion: suggestion.suggestion,
        ruleId: suggestion.ruleId,
        confidence: suggestion.confidence,
      },
    };
  }
  
  /**
   * Record a failure for learning
   */
  async recordFailure(
    context: ExecutionContext,
    guardrailId: string,
    error: Error | string,
    resolution: FailureRecord['resolution'],
    fixDetails?: string
  ): Promise<void> {
    const failure: FailureRecord = {
      id: `failure-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      timestamp: Date.now(),
      taskId: context.taskId,
      guardrailId,
      errorType: this.classifyError(error),
      errorMessage: error instanceof Error ? error.message : String(error),
      context,
      resolution,
      fixDetails,
    };
    
    const rule = await this.constitution.learnFromFailure(failure);
    
    if (rule) {
      // Update rule confidence based on resolution
      this.constitution.updateRuleConfidence(rule.id, resolution === 'autoFixed');
    }
  }
  
  /**
   * Get statistics for monitoring
   */
  getStats(): {
    learnedRules: number;
    activeRules: number;
    healingAttempts: number;
    effectiveness: ReturnType<Constitution['getEffectivenessReport']>;
    failures: ReturnType<Constitution['getFailureStats']>;
  } {
    return {
      learnedRules: this.constitution.getAllRules().length,
      activeRules: this.constitution.getActiveRules().length,
      healingAttempts: Array.from(this.healingAttempts.values()).reduce((a, b) => a + b, 0),
      effectiveness: this.constitution.getEffectivenessReport(),
      failures: this.constitution.getFailureStats(),
    };
  }
  
  /**
   * Reset healing attempts for a task
   */
  resetHealingAttempts(taskId: string): void {
    this.healingAttempts.delete(taskId);
  }
  
  /**
   * Export constitution state
   */
  exportConstitution(): ReturnType<Constitution['export']> {
    return this.constitution.export();
  }
  
  /**
   * Import constitution state
   */
  importConstitution(data: Parameters<Constitution['import']>[0]): void {
    this.constitution.import(data);
  }
  
  /**
   * Extract proposed action from context
   */
  private getProposedAction(context: ExecutionContext): string {
    // Try to infer action from context
    if (context.proposedTool) {
      return context.proposedTool;
    }
    
    if (context.changedFiles && context.changedFiles.length > 0) {
      return `modify:${context.changedFiles.join(',')}`;
    }
    
    return 'unknown';
  }
  
  /**
   * Classify error type
   */
  private classifyError(error: Error | string): string {
    const message = error instanceof Error ? error.message : String(error);
    
    // Simple classification
    if (message.includes('timeout')) return 'TIMEOUT';
    if (message.includes('syntax')) return 'SYNTAX_ERROR';
    if (message.includes('type')) return 'TYPE_ERROR';
    if (message.includes('permission')) return 'PERMISSION_ERROR';
    if (message.includes('rate limit')) return 'RATE_LIMIT';
    if (message.includes('schema')) return 'SCHEMA_VIOLATION';
    if (message.includes('test')) return 'TEST_FAILURE';
    
    return 'UNKNOWN_ERROR';
  }
}
