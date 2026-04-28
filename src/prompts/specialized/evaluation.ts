/**
 * Specialized evaluation prompt for assessing creative output quality.
 *
 * Inspired by Print-OS's evaluation system with an anti-hallucination
 * protocol and structured scoring. Produces deterministic, evidence-grounded
 * assessments across multiple creative dimensions.
 *
 * @module prompts/specialized/evaluation
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Configuration for a creative evaluation pass.
 *
 * @property dimensions     - Names of the scoring axes to evaluate.
 * @property scaleRange     - Inclusive [min, max] range for each dimension score.
 * @property requiredPassThreshold - Minimum overall score (average across dimensions) to consider the output passing.
 */
export interface EvaluationCriteria {
  dimensions: string[];
  scaleRange: [number, number];
  requiredPassThreshold: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Low temperature for analytical precision — evaluation should be consistent
 * and evidence-driven, not creative or variable.
 */
export const EVALUATION_TEMPERATURE = 0.2;

/**
 * Default evaluation criteria covering the five canonical creative dimensions.
 */
export const DEFAULT_EVALUATION_CRITERIA: EvaluationCriteria = {
  dimensions: [
    'technical_quality',
    'creativity',
    'novelty',
    'aesthetic_coherence',
    'emergence_potential',
  ],
  scaleRange: [1, 10],
  requiredPassThreshold: 6.0,
};

/**
 * System prompt for LLM-based creative evaluation.
 *
 * Enforces an anti-hallucination grounding rule: every score must cite specific
 * code or visual features from the submitted work. Returns structured JSON that
 * can be parsed and aggregated downstream.
 */
export const EVALUATION_SYSTEM_PROMPT = `You are a rigorous creative-output evaluator. Your job is to score generated code/art across multiple dimensions and return a structured JSON assessment.

SCORING DIMENSIONS (each scored on a {{scaleMin}}-{{scaleMax}} integer scale):

1. technical_quality — Correctness, performance, error handling, idiomatic use of the target framework/language.
2. creativity — Originality of concept, imaginative use of the medium, inventive visual or sonic patterns.
3. novelty — How different this output is from common templates and boilerplate; degree of surprise.
4. aesthetic_coherence — Internal consistency of visual/audio language, color harmony, spatial balance, rhythm.
5. emergence_potential — Likelihood that small parameter tweaks or runtime conditions will produce interesting variation beyond the current output.

GROUNDING RULE (anti-hallucination protocol):
- You MUST cite specific code constructs, variable names, function calls, visual features, or structural patterns to justify EVERY score.
- NEVER assign a score without referencing concrete evidence from the submitted work.
- If you cannot find evidence for a dimension, score it no higher than the midpoint of the scale and note the lack of evidence.

OUTPUT FORMAT — respond with ONLY valid JSON matching this schema (no markdown fences, no commentary outside the JSON):
{
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
}

- "overall" is the arithmetic mean of all dimension scores (rounded to one decimal).
- "issues" lists concrete problems that should be addressed, with line references or feature names.
- "strengths" lists notable achievements, also grounded in specific evidence.
- Keep evidence strings concise but precise — reference actual identifiers, color values, algorithm names, etc.`;

// ---------------------------------------------------------------------------
// Prompt Builder
// ---------------------------------------------------------------------------

/**
 * Build the user-facing evaluation prompt containing the code to evaluate
 * and its creative domain context.
 *
 * @param code     - The generated source code to evaluate.
 * @param domain   - The creative domain (e.g. "p5.js", "hydra", "three.js", "glsl", "revideo").
 * @param criteria - Optional partial override of the default evaluation criteria.
 * @returns A fully-formed user prompt string ready to send to the LLM.
 */
export function buildEvaluationPrompt(
  code: string,
  domain: string,
  criteria?: Partial<EvaluationCriteria>,
): string {
  const merged: EvaluationCriteria = {
    ...DEFAULT_EVALUATION_CRITERIA,
    ...criteria,
    dimensions: criteria?.dimensions ?? DEFAULT_EVALUATION_CRITERIA.dimensions,
    scaleRange: criteria?.scaleRange ?? DEFAULT_EVALUATION_CRITERIA.scaleRange,
    requiredPassThreshold:
      criteria?.requiredPassThreshold ??
      DEFAULT_EVALUATION_CRITERIA.requiredPassThreshold,
  };

  const [scaleMin, scaleMax] = merged.scaleRange;

  const systemWithScale = EVALUATION_SYSTEM_PROMPT
    .replace(/\{\{scaleMin\}\}/g, String(scaleMin))
    .replace(/\{\{scaleMax\}\}/g, String(scaleMax));

  const dimensionsList = merged.dimensions
    .map((d) => `  - ${d}`)
    .join('\n');

  return [
    systemWithScale,
    '',
    '<evaluation_context>',
    `DOMAIN: ${domain}`,
    `PASS THRESHOLD: ${merged.requiredPassThreshold} (average across dimensions)`,
    'EVALUATION DIMENSIONS:',
    dimensionsList,
    '</evaluation_context>',
    '',
    '<generated_code>',
    code,
    '</generated_code>',
    '',
    'Evaluate the generated code against every listed dimension.',
    'Remember: every score requires concrete evidence from the submitted work.',
  ].join('\n');
}
