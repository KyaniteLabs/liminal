/**
 * Shared evaluator schema helpers.
 *
 * These helpers keep JSON-oriented evaluator prompt schemas aligned across
 * scoring, specialized evaluation, and collaboration scoring surfaces.
 */

export function getScalarScoringSchema(): string {
  return `{
  "score": <number 0-1>,
  "technical": <number 0-1>,
  "creative": <number 0-1>,
  "novelty": <number 0-1>,
  "reasoning": "<brief explanation>",
  "suggestions": ["<suggestion1>", ...]
}`;
}

export function getCollabScoreSchema(): string {
  return `{"score": <number 0.0-1.0>, "reasoning": "<brief explanation>"}`;
}

export function getDimensionEvaluationSchema(): string {
  return `{
  "scores": {
    "<dimension>": <number>,
    ...
  },
  "evidence": {
    "<dimension>": "<specific code/visual feature justifying the score>",
    ...
  },
  "overall": <number>,
  "issues": ["<string>", ...],
  "strengths": ["<string>", ...]
}`;
}
