// ---------------------------------------------------------------------------
// AestheticStrategy — ScoringStrategy plugin that delegates to AestheticCritic
// ---------------------------------------------------------------------------

import type { ScoringInput, ScoringResult, ScoringStrategy } from '../core/ScoringEngine.js';
import { AestheticCritic } from './AestheticCritic.js';

export class AestheticStrategy implements ScoringStrategy {
  readonly name = 'aesthetic';
  private critic = new AestheticCritic();

  score(input: ScoringInput): ScoringResult {
    const report = this.critic.critique(input.output);

    return {
      score: report.score,
      dimensions: { aesthetic: report.score },
      issues: report.violations.map(v => `[${v.severity}] ${v.rule}: ${v.message}`),
      strategy: this.name,
    };
  }
}
