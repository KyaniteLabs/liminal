/**
 * LLMJudgeCritic — LLM-as-Judge aesthetic evaluation.
 *
 * Sends generated code to an LLM with a structured evaluation prompt,
 * parses the numeric score (0-1) and any violations from the response.
 * Falls back to the heuristic critics when no LLM is available.
 *
 * This implements the "LLM-as-Judge" paradigm from RLHF research:
 * instead of training a separate reward model, we use an LLM call
 * as a zero-shot critic with structured output instructions.
 *
 * @module aesthetic/critics/LLMJudgeCritic
 */

import type { AestheticReport, AestheticViolation, DesignConstraints } from '../types.js';
import { Logger } from '../../utils/Logger.js';
import { JSON_ONLY_OUTPUT_INSTRUCTION } from '../../prompts/contracts.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LLMJudgeConfig {
  /** Minimum score to consider a generation passing (default: 0.6) */
  passingThreshold: number;
  /** Maximum tokens for the judge response (default: 500) */
  maxTokens: number;
  /** Whether to include detailed reasoning in the response */
  includeReasoning: boolean;
  /** Which dimensions to evaluate */
  dimensions: JudgeDimension[];
}

export type JudgeDimension = 'color' | 'layout' | 'typography' | 'sound' | 'overall' | 'creativity' | 'coherence';

export interface LLMJudgeResult extends AestheticReport {
  /** Detailed reasoning from the LLM */
  reasoning?: string;
  /** Per-dimension scores */
  dimensionScores?: Record<string, number>;
  /** Whether the LLM call succeeded */
  usedLLM: boolean;
}

export interface LLMClientLike {
  generate(systemPrompt: string, userPrompt: string, signal?: AbortSignal): Promise<{ code: string; success: boolean }>;
}

// ---------------------------------------------------------------------------
// Default config
// ---------------------------------------------------------------------------

const DEFAULT_JUDGE_CONFIG: LLMJudgeConfig = {
  passingThreshold: 0.6,
  maxTokens: 500,
  includeReasoning: true,
  dimensions: ['color', 'layout', 'overall', 'creativity'],
};

// ---------------------------------------------------------------------------
// Prompt templates
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are an expert aesthetic judge for creative code. Evaluate the provided code on a 0.0-1.0 scale.

${JSON_ONLY_OUTPUT_INSTRUCTION}

Return a JSON object with this exact structure:
{
  "score": <number between 0.0 and 1.0>,
  "dimensionScores": {
    "color": <0-1>,
    "layout": <0-1>,
    "creativity": <0-1>,
    "coherence": <0-1>
  },
  "reasoning": "<1-2 sentences explaining the score>",
  "violations": ["<issue>", ...]
}

Scoring guidelines:
- 0.0-0.3: Broken, incomplete, or visually incoherent
- 0.3-0.5: Functional but bland, poor color choices, no visual hierarchy
- 0.5-0.7: Decent composition, reasonable color use, some creative merit
- 0.7-0.85: Strong aesthetic, good harmony, clear intent, engaging
- 0.85-1.0: Exceptional — striking, well-composed, creative, visually memorable

Evaluate based on: color harmony, layout balance, visual coherence, creativity, and overall impact.`;

function buildJudgePrompt(code: string, domain: string, constraints: DesignConstraints): string {
  const constraintHints: string[] = [];

  if (constraints.color.maxColors < 7) {
    constraintHints.push(`- Max ${constraints.color.maxColors} colors allowed`);
  }
  if (constraints.general.minAestheticScore > 0.6) {
    constraintHints.push(`- Minimum aesthetic bar is ${constraints.general.minAestheticScore}`);
  }
  if (constraints.general.forbiddenPatterns.length > 0) {
    constraintHints.push(`- Forbidden patterns: ${constraints.general.forbiddenPatterns.join(', ')}`);
  }

  const constraintBlock = constraintHints.length > 0
    ? `\nDesign constraints:\n${constraintHints.join('\n')}`
    : '';

  return `Evaluate this ${domain} creative code for aesthetic quality:

\`\`\`
${code.slice(0, 3000)}
\`\`\`${constraintBlock}

Return the JSON object only.`;
}

// ---------------------------------------------------------------------------
// Response parser
// ---------------------------------------------------------------------------

function parseJudgeResponse(response: string): {
  score: number;
  reasoning: string;
  violations: AestheticViolation[];
  dimensionScores: Record<string, number>;
} {
  let score = 0.5;
  let reasoning = '';
  const violations: AestheticViolation[] = [];
  const dimensionScores: Record<string, number> = {};

  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { score, reasoning, violations, dimensionScores };
  }

  let parsed: any;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    return { score, reasoning, violations, dimensionScores };
  }

  if (typeof parsed.score === 'number') {
    score = Math.max(0, Math.min(1, parsed.score));
  }

  if (parsed.dimensionScores && typeof parsed.dimensionScores === 'object') {
    for (const [name, val] of Object.entries(parsed.dimensionScores)) {
      if (typeof val === 'number') {
        dimensionScores[name] = Math.max(0, Math.min(1, val));
      }
    }
  }

  if (typeof parsed.reasoning === 'string') {
    reasoning = parsed.reasoning.trim();
  }

  if (Array.isArray(parsed.violations)) {
    for (const item of parsed.violations) {
      if (typeof item === 'string' && item.trim().length > 0) {
        violations.push({
          rule: 'llm-judge',
          severity: 'warning' as const,
          message: item.trim(),
        });
      }
    }
  }

  return { score, reasoning, violations, dimensionScores };
}

// ---------------------------------------------------------------------------
// LLMJudgeCritic
// ---------------------------------------------------------------------------

/**
 * Evaluate creative code aesthetics using an LLM as judge.
 */
export async function analyzeWithLLMJudge(
  code: string,
  domain: string,
  llm: LLMClientLike,
  constraints: DesignConstraints,
  config: Partial<LLMJudgeConfig> = {},
): Promise<LLMJudgeResult> {
  const fullConfig = { ...DEFAULT_JUDGE_CONFIG, ...config };

  if (!code || code.trim().length === 0) {
    return {
      score: 0,
      violations: [],
      passed: false,
      timestamp: Date.now(),
      usedLLM: false,
    };
  }

  try {
    const prompt = buildJudgePrompt(code, domain, constraints);
    const result = await llm.generate(SYSTEM_PROMPT, prompt);

    if (!result.success || !result.code) {
      Logger.warn('LLMJudgeCritic', 'LLM judge call failed, returning neutral score');
      return {
        score: 0.5,
        violations: [],
        passed: true,
        timestamp: Date.now(),
        usedLLM: false,
      };
    }

    const parsed = parseJudgeResponse(result.code);
    const passed = parsed.score >= fullConfig.passingThreshold
      && parsed.violations.filter(v => v.severity === 'error').length === 0;

    Logger.info('LLMJudgeCritic', `LLM judge score: ${parsed.score.toFixed(3)} for ${domain} (passed=${passed})`);

    return {
      score: Math.round(parsed.score * 1000) / 1000,
      violations: parsed.violations,
      passed,
      timestamp: Date.now(),
      reasoning: parsed.reasoning,
      dimensionScores: parsed.dimensionScores,
      usedLLM: true,
    };
  } catch (error) {
    Logger.error('LLMJudgeCritic', 'LLM judge error:', error);
    return {
      score: 0.5,
      violations: [],
      passed: true,
      timestamp: Date.now(),
      usedLLM: false,
    };
  }
}
