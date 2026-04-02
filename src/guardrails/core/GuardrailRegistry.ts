/**
 * Guardrail Registry
 * 
 * Central registry for all guardrail rules.
 * Manages evaluation, tier enforcement, and remediation orchestration.
 */

import {
  GuardrailRule,
  GuardrailResult,
  ExecutionContext,
  GuardrailRegistryConfig,
  GuardrailTier,
} from './types.js';
import { TelemetryCollector, getTelemetry } from '../observation/TelemetryCollector.js';

export interface RegistryEvaluationResult {
  /** Whether all guardrails passed */
  passed: boolean;
  
  /** Individual guardrail results */
  results: GuardrailResult[];
  
  /** Results that blocked execution */
  blockingResults: GuardrailResult[];
  
  /** Results that were remediated */
  remediatedResults: GuardrailResult[];
  
  /** Results requiring escalation */
  escalatedResults: GuardrailResult[];
  
  /** Modified context after remediation */
  modifiedContext?: ExecutionContext;
  
  /** Human-readable summary */
  summary: string;
}

/**
 * Central guardrail registry
 */
export class GuardrailRegistry {
  private guardrails: Map<string, GuardrailRule> = new Map();
  private config: GuardrailRegistryConfig;
  private telemetry: TelemetryCollector | null = null;
  private violationCounts: Map<string, number> = new Map();
  
  constructor(config: Partial<GuardrailRegistryConfig> = {}) {
    this.config = {
      defaultTier: GuardrailTier.SHADOW,
      shadowMode: true,
      telemetry: {
        enabled: true,
        sampleRate: 1.0,
        storage: 'memory',
      },
      ...config,
    };
    
    this.telemetry = getTelemetry();
  }
  
  /**
   * Register a guardrail rule
   */
  register(guardrail: GuardrailRule): void {
    this.guardrails.set(guardrail.id, guardrail);
    this.violationCounts.set(guardrail.id, 0);
  }
  
  /**
   * Unregister a guardrail
   */
  unregister(guardrailId: string): void {
    this.guardrails.delete(guardrailId);
    this.violationCounts.delete(guardrailId);
  }
  
  /**
   * Get a registered guardrail
   */
  get(guardrailId: string): GuardrailRule | undefined {
    return this.guardrails.get(guardrailId);
  }
  
  /**
   * Get all registered guardrails
   */
  getAll(): GuardrailRule[] {
    return Array.from(this.guardrails.values());
  }
  
  /**
   * Get guardrails by category
   */
  getByCategory(category: 'catastrophic' | 'correctness' | 'hygiene' | 'evolution'): GuardrailRule[] {
    return this.getAll().filter(g => g.category === category);
  }
  
  /**
   * Evaluate all guardrails against context
   */
  async evaluate(context: ExecutionContext): Promise<RegistryEvaluationResult> {
    const results: GuardrailResult[] = [];
    const blockingResults: GuardrailResult[] = [];
    const remediatedResults: GuardrailResult[] = [];
    const escalatedResults: GuardrailResult[] = [];
    
    let modifiedContext = { ...context };
    
    // Sort guardrails by category priority: catastrophic > correctness > hygiene > compliance > evolution
    const sortedGuardrails = this.getAll().sort((a, b) => {
      const priority = { catastrophic: 0, correctness: 1, hygiene: 2, compliance: 3, evolution: 4 };
      return priority[a.category] - priority[b.category];
    });
    
    for (const guardrail of sortedGuardrails) {
      // Check if guardrail tier allows enforcement
      const effectiveTier = this.getEffectiveTier(guardrail);
      
      // Evaluate the guardrail
      const result = await guardrail.evaluate(modifiedContext);
      
      // Record telemetry
      this.telemetry?.recordGuardrailEvaluation(
        context.taskId,
        guardrail.id,
        result.passed,
        { category: guardrail.category, tier: effectiveTier }
      );
      
      results.push(result);
      
      // Handle violation
      if (!result.passed) {
        
        // Track violation count
        const currentCount = this.violationCounts.get(guardrail.id) || 0;
        this.violationCounts.set(guardrail.id, currentCount + 1);
        
        // Determine action based on tier
        const action = this.determineAction(effectiveTier, result);
        
        switch (action) {
          case 'allow':
            // Shadow mode: log but allow
            break;
            
          case 'warn':
            // Advisory: log warning but continue
            console.warn(`[Guardrail Warning] ${guardrail.id}: ${result.message}`);
            break;
            
          case 'block':
            // Enforcing: block and optionally remediate
            blockingResults.push(result);
            
            // Attempt remediation if available
            if (guardrail.remediate) {
              const remediation = await guardrail.remediate(modifiedContext, result);
              this.telemetry?.recordRemediation(
                context.taskId,
                guardrail.id,
                remediation.success,
                { action: remediation.action }
              );
              
              // Only unblocking remediations are those that actually fix the issue
              // Abort/skip/suggest actions remain blocking
              const isTerminalAction = remediation.action.startsWith('abort') || 
                                      remediation.action.startsWith('timeout') ||
                                      remediation.action.startsWith('suggest') ||
                                      remediation.action === 'fail' ||
                                      remediation.action === 'none';
              
              if (remediation.success && remediation.newContext && !isTerminalAction) {
                modifiedContext = { ...modifiedContext, ...remediation.newContext };
                remediatedResults.push(result);
                blockingResults.pop(); // Remove from blocking since remediated
              }
            }
            break;
            
          case 'selfHeal':
            // Autonomous: attempt auto-remediation
            if (guardrail.remediate) {
              const remediation = await guardrail.remediate(modifiedContext, result);
              this.telemetry?.recordRemediation(
                context.taskId,
                guardrail.id,
                remediation.success,
                { action: remediation.action }
              );
              
              // Same terminal action check as 'block' case
              const isTerminalAction = remediation.action.startsWith('abort') || 
                                      remediation.action.startsWith('timeout') ||
                                      remediation.action.startsWith('suggest') ||
                                      remediation.action === 'fail' ||
                                      remediation.action === 'none';
              
              if (remediation.success && remediation.newContext && !isTerminalAction) {
                modifiedContext = { ...modifiedContext, ...remediation.newContext };
                remediatedResults.push(result);
              } else {
                blockingResults.push(result);
              }
            } else {
              blockingResults.push(result);
            }
            break;
        }
        
        // Check escalation
        if (guardrail.escalation) {
          const violationCount = this.violationCounts.get(guardrail.id) || 0;
          if (violationCount >= guardrail.escalation.afterFailures) {
            escalatedResults.push(result);
            this.telemetry?.recordEscalation(
              context.taskId,
              guardrail.id,
              `Exceeded ${guardrail.escalation.afterFailures} failures`
            );
            
            if (guardrail.escalation.onEscalate) {
              await guardrail.escalation.onEscalate(modifiedContext, violationCount);
            }
          }
        }
      }
    }
    
    // Build summary
    const summary = this.buildSummary(results, blockingResults, remediatedResults);
    
    return {
      passed: blockingResults.length === 0,
      results,
      blockingResults,
      remediatedResults,
      escalatedResults,
      modifiedContext: blockingResults.length === 0 ? modifiedContext : undefined,
      summary,
    };
  }
  
  /**
   * Evaluate only a specific category of guardrails
   */
  async evaluateCategory(
    category: 'catastrophic' | 'correctness' | 'hygiene' | 'evolution',
    context: ExecutionContext
  ): Promise<RegistryEvaluationResult> {
    const categoryGuardrails = this.getByCategory(category);
    
    // Temporarily filter registry to only these guardrails
    const originalGuardrails = new Map(this.guardrails);
    this.guardrails.clear();
    categoryGuardrails.forEach(g => this.guardrails.set(g.id, g));
    
    const result = await this.evaluate(context);
    
    // Restore original guardrails
    this.guardrails = originalGuardrails;
    
    return result;
  }
  
  /**
   * Check if a specific guardrail would pass
   */
  async checkGuardrail(
    guardrailId: string,
    context: ExecutionContext
  ): Promise<GuardrailResult | undefined> {
    const guardrail = this.guardrails.get(guardrailId);
    if (!guardrail) return undefined;
    
    return await guardrail.evaluate(context);
  }
  
  /**
   * Reset violation counts
   */
  resetViolationCounts(): void {
    this.violationCounts.clear();
    this.guardrails.forEach((_, id) => {
      this.violationCounts.set(id, 0);
    });
  }
  
  /**
   * Get violation statistics
   */
  getViolationStats(): Record<string, number> {
    return Object.fromEntries(this.violationCounts);
  }
  
  /**
   * Set global shadow mode
   */
  setShadowMode(enabled: boolean): void {
    this.config.shadowMode = enabled;
  }
  
  /**
   * Set default tier
   */
  setDefaultTier(tier: GuardrailTier): void {
    this.config.defaultTier = tier;
  }
  
  /**
   * Get effective tier for a guardrail
   */
  private getEffectiveTier(guardrail: GuardrailRule): GuardrailTier {
    // In shadow mode, all guardrails operate as shadow
    if (this.config.shadowMode) {
      return GuardrailTier.SHADOW;
    }
    
    // Otherwise use guardrail's configured tier or default
    return guardrail.tier ?? this.config.defaultTier;
  }
  
  /**
   * Determine action based on tier and result
   */
  private determineAction(tier: GuardrailTier, _result: GuardrailResult): 'allow' | 'warn' | 'block' | 'selfHeal' {
    switch (tier) {
      case GuardrailTier.SHADOW:
        return 'allow';
      case GuardrailTier.ADVISORY:
        return 'warn';
      case GuardrailTier.ENFORCING:
        return 'block';
      case GuardrailTier.AUTONOMOUS:
        return 'selfHeal';
      default:
        return 'allow';
    }
  }
  
  /**
   * Build human-readable summary
   */
  private buildSummary(
    results: GuardrailResult[],
    blocking: GuardrailResult[],
    remediated: GuardrailResult[]
  ): string {
    const total = results.length;
    const passed = results.filter(r => r.passed).length;
    const failed = total - passed;
    
    let summary = `Guardrail Evaluation: ${passed}/${total} passed`;
    
    if (failed > 0) {
      summary += `, ${failed} failed`;
    }
    
    if (remediated.length > 0) {
      summary += `, ${remediated.length} auto-remediated`;
    }
    
    if (blocking.length > 0) {
      summary += `, ${blocking.length} blocking`;
    }
    
    return summary;
  }
}

// Global registry instance
let globalRegistry: GuardrailRegistry | null = null;

export function initializeGuardrails(config?: Partial<GuardrailRegistryConfig>): GuardrailRegistry {
  globalRegistry = new GuardrailRegistry(config);
  return globalRegistry;
}

export function getGuardrailRegistry(): GuardrailRegistry | null {
  return globalRegistry;
}
