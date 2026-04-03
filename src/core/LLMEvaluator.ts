/**
 * LLMEvaluator — LLM-based artifact quality scoring.
 *
 * Uses an LLM (via LLMClient with evaluator role) to score artifacts
 * against provided criteria. Returns structured results with score,
 * reasoning, and improvement suggestions.
 *
 * Graceful fallback: never throws, always returns a valid LLMEvaluationResult.
 */

import { LLMClient } from '../llm/LLMClient.js';
import type { NormalizedThinking } from '../llm/ProviderTypes.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LLMEvaluationResult {
  /** Overall score in [0, 1]. */
  score: number;
  /** Why the LLM gave this score. */
  reasoning: string;
  /** Concrete improvement suggestions. */
  suggestions: string[];
  /** Thinking/reasoning from the model (if available). */
  thinking?: NormalizedThinking;
}

// ---------------------------------------------------------------------------
// LLMEvaluator
// ---------------------------------------------------------------------------

export class LLMEvaluator {
  private llm: LLMClient;

  constructor(llm?: LLMClient) {
    this.llm = llm ?? new LLMClient({ role: 'evaluator' });
  }

  /**
   * Evaluate an artifact against the given criteria.
   *
   * Returns a structured result with score, reasoning, and suggestions.
   * On any failure (LLM error, parse error), returns a safe fallback result.
   */
  async evaluate(artifact: string, criteria: string): Promise<LLMEvaluationResult> {
    const systemPrompt = `You are an expert artifact evaluator. Score the artifact against the given criteria.
Return ONLY a JSON object with this exact structure:
{ "score": <0-1>, "reasoning": "<brief explanation>", "suggestions": ["<suggestion1>", ...] }`;

    const userPrompt = `Criteria:\n${criteria}\n\nArtifact:\n${artifact}`;

    const response = await this.llm.generate(systemPrompt, userPrompt);

    if (!response.success || !response.code) {
      return {
        score: 0.5,
        reasoning: 'LLM evaluation failed',
        suggestions: [],
        thinking: response.thinking
          ? { text: response.thinking, source: 'none' }
          : undefined,
      };
    }

    try {
      // Try to parse JSON from response — the LLM may wrap it in prose or fences
      const jsonMatch = response.code.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return {
          score: 0.5,
          reasoning: 'Could not parse evaluation response',
          suggestions: [],
          thinking: response.thinking
            ? { text: response.thinking, source: 'none' }
            : undefined,
        };
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return {
        score: Math.max(0, Math.min(1, typeof parsed.score === 'number' ? parsed.score : 0.5)),
        reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : '',
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
        thinking: response.thinking
          ? { text: response.thinking, source: 'none' }
          : undefined,
      };
    } catch {
      return {
        score: 0.5,
        reasoning: 'Failed to parse evaluation JSON',
        suggestions: [],
        thinking: response.thinking
          ? { text: response.thinking, source: 'none' }
          : undefined,
      };
    }
  }
}
