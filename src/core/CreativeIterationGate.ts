import { Domain } from '../types/domains.js';

export interface CreativeIterationGateInput {
  iteration: number;
  prompt: string;
  score: number;
  evaluationConfidence?: number;
  evaluationFailureClass?: string;
  isComplete: boolean;
  maxIterations: number;
  minQualityScore: number;
  domainQualityThresholds: Record<string, number>;
  collabDomain?: Domain;
  disableIterationExtension?: boolean;
}

export interface CreativeIterationGateDecision {
  shouldBreak: boolean;
  completed: boolean;
  reason: string;
  domain: string;
  qualityThreshold: number;
  maxIterations: number;
  logMessage?: string;
  thought?: string;
}

/**
 * Owns the creative loop's quality and continuation gate.
 *
 * RalphLoop still orchestrates persistence, evolution, and progress events;
 * this seam decides whether the current creative iteration should stop,
 * continue, or extend the loop budget based on observable iteration facts.
 */
export class CreativeIterationGate {
  decide(input: CreativeIterationGateInput): CreativeIterationGateDecision {
    const domain = this.detectDomain(input.prompt, input.collabDomain);
    const qualityThreshold = input.domainQualityThresholds[domain] ?? input.minQualityScore;
    const evaluationFailureClass = input.evaluationFailureClass ?? 'none';
    const evaluationConfidence = input.evaluationConfidence ?? 1;

    if (evaluationFailureClass !== 'none' && evaluationConfidence <= 0) {
      return {
        shouldBreak: true,
        completed: false,
        reason: `evaluation evidence degraded (${evaluationFailureClass}, confidence ${evaluationConfidence.toFixed(2)})`,
        domain,
        qualityThreshold,
        maxIterations: input.maxIterations,
      };
    }

    if (input.iteration >= 2 && input.score < qualityThreshold) {
      return {
        shouldBreak: true,
        completed: false,
        reason: `quality threshold not met (score ${input.score.toFixed(2)} < ${qualityThreshold} for domain: ${domain})`,
        domain,
        qualityThreshold,
        maxIterations: input.maxIterations,
      };
    }

    if (input.score >= 0.90 && input.isComplete) {
      return {
        shouldBreak: true,
        completed: true,
        reason: `excellent quality achieved (score ${input.score.toFixed(2)} >= 0.90, code complete)`,
        domain,
        qualityThreshold,
        maxIterations: input.maxIterations,
      };
    }

    const incompleteLog = !input.isComplete && input.iteration < input.maxIterations
      ? `Code incomplete after iteration ${input.iteration}, forcing another iteration`
      : undefined;

    if (input.iteration === 3 && !input.disableIterationExtension) {
      const isWorkingWell = input.score >= 0.70 && input.isComplete;
      if (!isWorkingWell) {
        const newMax = Math.min(input.maxIterations + 3, 20);
        if (newMax > input.maxIterations) {
          return {
            shouldBreak: false,
            completed: false,
            reason: '',
            domain,
            qualityThreshold,
            maxIterations: newMax,
            logMessage: `Extending max iterations to ${newMax} (score: ${input.score.toFixed(2)}, complete: ${input.isComplete})`,
            thought: `Extending to ${newMax} iterations to improve quality...`,
          };
        }
      }
    }

    return {
      shouldBreak: false,
      completed: false,
      reason: '',
      domain,
      qualityThreshold,
      maxIterations: input.maxIterations,
      logMessage: incompleteLog,
    };
  }

  private detectDomain(prompt: string, collabDomain?: Domain): string {
    const domain = collabDomain || Domain.P5;
    if (domain !== Domain.P5) return domain;

    const promptLower = prompt.toLowerCase();
    if (promptLower.includes('ascii') || promptLower.includes('text art')) return 'ascii';
    if (promptLower.includes('music') || promptLower.includes('strudel') || promptLower.includes('hydra')) return 'music';
    if (
      promptLower.includes('revideo') ||
      promptLower.includes('video') ||
      promptLower.includes('motion graphics') ||
      promptLower.includes('title sequence')
    ) {
      return 'revideo';
    }

    return domain;
  }
}
