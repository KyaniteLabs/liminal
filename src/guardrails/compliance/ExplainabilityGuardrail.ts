/**
 * M17: Explainability Guardrail
 *
 * Traces decisions and attributes outputs.
 */

import {
  GuardrailRule,
  GuardrailResult,
  ExecutionContext,
  GuardrailTier,
} from '../core/types.js';

interface DecisionTrace {
  timestamp: number;
  decision: string;
  reason: string;
  inputs: string[];
  output: string;
}

// Decision trace storage
const decisionTraces: Map<string, DecisionTrace[]> = new Map();

/**
 * Record a decision
 */
function recordDecision(
  taskId: string,
  decision: string,
  reason: string,
  inputs: string[],
  output: string
): void {
  const traces = decisionTraces.get(taskId) || [];
  traces.push({
    timestamp: Date.now(),
    decision,
    reason,
    inputs,
    output,
  });
  decisionTraces.set(taskId, traces);
}

/**
 * Get decision trace for a task
 */
function getDecisionTrace(taskId: string): DecisionTrace[] {
  return decisionTraces.get(taskId) || [];
}

/**
 * Generate attribution report
 */
function generateAttribution(taskId: string): Record<string, unknown> {
  const traces = decisionTraces.get(taskId) || [];
  
  return {
    taskId,
    totalDecisions: traces.length,
    decisionChain: traces.map(t => ({
      decision: t.decision,
      reason: t.reason,
      timestamp: t.timestamp,
    })),
    inputs: [...new Set(traces.flatMap(t => t.inputs))],
  };
}

/**
 * M17 Explainability Guardrail
 */
export const ExplainabilityGuardrail: GuardrailRule = {
  id: 'guardrail-m17-explainability',
  description: 'Traces decisions and attributes outputs',
  tier: GuardrailTier.SHADOW,
  category: 'compliance',

  async evaluate(context: ExecutionContext): Promise<GuardrailResult> {
    // Record this evaluation
    recordDecision(
      context.taskId,
      'guardrail-evaluation',
      `Evaluated at step ${context.step}`,
      [
        context.prompt || '',
        ...(context.changedFiles || []),
      ],
      typeof context.output === 'string' ? context.output : 'non-string output'
    );

    // Generate attribution report
    const attribution = generateAttribution(context.taskId);

    return {
      passed: true, // This guardrail always passes (shadow mode)
      guardrailId: this.id,
      message: 'Decision traced',
      details: {
        attribution,
        traceCount: attribution.totalDecisions,
      },
    };
  },
};

export { recordDecision, getDecisionTrace, generateAttribution };
export type { DecisionTrace };
