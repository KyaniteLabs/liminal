/**
 * M16: Fairness & Bias Guardrail
 *
 * Ensures output diversity and measures bias.
 */

import {
  GuardrailRule,
  GuardrailResult,
  ExecutionContext,
  GuardrailTier,
} from '../core/types.js';

interface DiversityMetrics {
  uniqueOutputs: number;
  totalOutputs: number;
  diversityScore: number; // 0-1
}

// Track outputs for diversity analysis
const outputHistory: Map<string, string[]> = new Map();

/**
 * Calculate diversity score for a domain
 */
function calculateDiversity(domain: string, newOutput: string): DiversityMetrics {
  const history = outputHistory.get(domain) || [];
  const allOutputs = [...history, newOutput];
  
  // Simple diversity: ratio of unique to total
  const uniqueOutputs = new Set(allOutputs).size;
  const diversityScore = uniqueOutputs / allOutputs.length;

  return {
    uniqueOutputs,
    totalOutputs: allOutputs.length,
    diversityScore,
  };
}

/**
 * Record output for diversity tracking
 */
function recordOutput(domain: string, output: string): void {
  const history = outputHistory.get(domain) || [];
  history.push(output);
  
  // Keep last 100 outputs
  if (history.length > 100) {
    history.shift();
  }
  
  outputHistory.set(domain, history);
}

/**
 * M16 Fairness & Bias Guardrail
 */
export const FairnessGuardrail: GuardrailRule = {
  id: 'guardrail-m16-fairness',
  description: 'Ensures output diversity and measures bias',
  tier: GuardrailTier.ADVISORY,
  category: 'compliance',

  async evaluate(context: ExecutionContext): Promise<GuardrailResult> {
    const output = typeof context.output === 'string' ? context.output : '';
    const domain = context.schema?.toString() || 'unknown';

    // Calculate diversity
    const metrics = calculateDiversity(domain, output);
    
    // Record this output
    recordOutput(domain, output);

    // Warn if diversity is low (below 0.3)
    if (metrics.diversityScore < 0.3 && metrics.totalOutputs > 10) {
      return {
        passed: false,
        guardrailId: this.id,
        severity: 'warning',
        message: `Low output diversity detected: ${(metrics.diversityScore * 100).toFixed(1)}%`,
        details: {
          diversityScore: metrics.diversityScore,
          uniqueOutputs: metrics.uniqueOutputs,
          totalOutputs: metrics.totalOutputs,
        },
        suggestion: 'Consider varying prompts or using different models',
      };
    }

    return {
      passed: true,
      guardrailId: this.id,
      message: 'Diversity check passed',
      details: {
        diversityScore: metrics.diversityScore,
        uniqueOutputs: metrics.uniqueOutputs,
      },
    };
  },
};

export { calculateDiversity, recordOutput };
export type { DiversityMetrics };
