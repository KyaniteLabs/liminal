// ---------------------------------------------------------------------------
// AestheticStrategy — ScoringStrategy plugin that delegates to AestheticCritic
// ---------------------------------------------------------------------------

import type { ScoringInput, ScoringResult, ScoringStrategy } from '../core/ScoringEngine.js';
import { AestheticCritic } from './AestheticCritic.js';
import { Logger } from '../utils/Logger.js';

export class AestheticStrategy implements ScoringStrategy {
  readonly name = 'aesthetic';
  private critic = new AestheticCritic();
  private llmWired = false;

  /** Wire LLM for dual-path evaluation (lazy, fire-and-forget). */
  private async wireLLM(): Promise<void> {
    if (this.llmWired) return;
    try {
      const { LLMClient } = await import('../llm/LLMClient.js');
      const llm = new LLMClient({ role: 'evaluator' });
      this.critic.setLLMClient(llm as unknown as import('./critics/LLMJudgeCritic.js').LLMClientLike);
      this.llmWired = true;
    } catch (err) {
      Logger.warn('AestheticStrategy', 'LLM wiring failed, using heuristic-only:', err instanceof Error ? err.message : err);
    }
  }

  score(input: ScoringInput): ScoringResult {
    void this.wireLLM();
    // Thread LIR context through if available on the input
    const report = this.critic.critique(
      input.output,
      undefined,
      input.lirContext,
    );

    return {
      score: report.score,
      dimensions: { aesthetic: report.score },
      issues: report.violations.map(v => `[${v.severity}] ${v.rule}: ${v.message}`),
      strategy: this.name,
    };
  }
}
