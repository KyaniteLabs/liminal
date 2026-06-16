// ---------------------------------------------------------------------------
// AestheticCritic – orchestrator that runs all sub-critics and aggregates
// Supports dual-path: LIR tokens when available, regex fallback otherwise.
// ---------------------------------------------------------------------------


import type {
  AestheticReport,
  AestheticViolation,
  CriticConfig,
  DesignConstraints,
  LIREvaluationContext,
  LIRAwareAestheticReport,
} from './types.js';
import { DEFAULT_DESIGN_CONSTRAINTS, PRESET_PROFILES } from './types.js';
import { analyzeColorHarmony } from './critics/ColorHarmonyCritic.js';
import { analyzeLayout } from './critics/LayoutCritic.js';
import { analyzeTypography } from './critics/TypographyCritic.js';
import { analyzeSoundHarmony } from './critics/SoundHarmonyCritic.js';
import { analyzeWithLLMJudge, type LLMClientLike, type LLMJudgeResult } from './critics/LLMJudgeCritic.js';


function buildDesignConstraints(config?: Partial<CriticConfig>): DesignConstraints {
  const presetConstraints = config?.preset ? PRESET_PROFILES[config.preset] : undefined;
  const overrides = config?.constraints;

  return {
    ...DEFAULT_DESIGN_CONSTRAINTS,
    ...presetConstraints,
    ...overrides,
    color: {
      ...DEFAULT_DESIGN_CONSTRAINTS.color,
      ...presetConstraints?.color,
      ...overrides?.color,
    },
    layout: {
      ...DEFAULT_DESIGN_CONSTRAINTS.layout,
      ...presetConstraints?.layout,
      ...overrides?.layout,
    },
    typography: {
      ...DEFAULT_DESIGN_CONSTRAINTS.typography,
      ...presetConstraints?.typography,
      ...overrides?.typography,
    },
    sound: {
      ...DEFAULT_DESIGN_CONSTRAINTS.sound,
      ...presetConstraints?.sound,
      ...overrides?.sound,
    },
    general: {
      ...DEFAULT_DESIGN_CONSTRAINTS.general,
      ...presetConstraints?.general,
      ...overrides?.general,
    },
  };
}

// ---------------------------------------------------------------------------
// Critic registry
// ---------------------------------------------------------------------------

interface CriticEntry {
  name: string;
  analyze: (code: string, constraints: DesignConstraints) => AestheticReport;
}

const ALL_CRITICS: CriticEntry[] = [
  { name: 'color', analyze: analyzeColorHarmony },
  { name: 'layout', analyze: analyzeLayout },
  { name: 'typography', analyze: analyzeTypography },
  { name: 'sound', analyze: analyzeSoundHarmony },
];

// ---------------------------------------------------------------------------
// AestheticCritic – public API
// ---------------------------------------------------------------------------

export class AestheticCritic {
  private llmClient?: LLMClientLike;

  /**
   * Set LLM client for LLM-as-Judge evaluation mode.
   * When set, `critiqueWithLLM()` becomes available for higher-quality scoring.
   */
  setLLMClient(llm: LLMClientLike): void {
    this.llmClient = llm;
  }

  /**
   * Evaluate code using LLM-as-Judge (async, higher quality).
   * Falls back to heuristic critics if no LLM is configured.
   *
   * This is the "dual-path" approach: heuristic critics are fast and free,
   * LLM-as-Judge is slower but produces reasoning-aware scores.
   * Use the heuristic path for real-time feedback during generation loops,
   * and the LLM path for final evaluation.
   */
  async critiqueWithLLM(
    code: string,
    domain: string = 'p5',
    config?: Partial<CriticConfig>,
  ): Promise<AestheticReport | LLMJudgeResult> {
    if (!this.llmClient) {
      // No LLM available — fall back to heuristic critics
      return this.critique(code, config);
    }

    const constraints = buildDesignConstraints(config);

    // Run both paths in parallel: heuristic + LLM
    const heuristicReport = this.critique(code, config);
    const llmReport = await analyzeWithLLMJudge(code, domain, this.llmClient, constraints);

    // Blend: weight LLM score more heavily (0.7 LLM + 0.3 heuristic)
    // unless the LLM call failed
    if (llmReport.usedLLM) {
      const blendedScore = (llmReport.score * 0.7) + (heuristicReport.score * 0.3);
      const passed = blendedScore >= constraints.general.minAestheticScore
        && llmReport.violations.filter(v => v.severity === 'error').length === 0;

      return {
        ...llmReport,
        score: Math.round(blendedScore * 1000) / 1000,
        violations: [...heuristicReport.violations, ...llmReport.violations],
        passed,
      };
    }

    return heuristicReport;
  }

  /**
   * Critique code for aesthetic quality.
   *
   * When `lirContext` is provided with populated `lirTokens`, the method
   * enriches the report with structural metrics and coherence scoring.
   * The regex-based critics still run (LIR-aware critic functions are added
   * in Phase 3), but structural metrics from LIR tokens are layered on top.
   *
   * Cold fallback: when `lirTokens` is empty or absent, runs existing regex path.
   */
  critique(
    code: string,
    config?: Partial<CriticConfig>,
    lirContext?: LIREvaluationContext,
    _domain?: string,
  ): AestheticReport {
    if (!code || code.trim().length === 0) {
      return { score: 0, violations: [], passed: false, timestamp: Date.now() };
    }

    const constraints = buildDesignConstraints(config);
    const enabledCritics = config?.enabledCritics ?? ALL_CRITICS.map(c => c.name);

    const critics = ALL_CRITICS.filter(c => enabledCritics.includes(c.name));
    const reports: AestheticReport[] = critics.map(critic => critic.analyze(code, constraints));

    // Aggregate scores (average, excluding neutral 0.5 from non-applicable critics)
    const activeReports = reports.filter(r => r.score !== 0.5);
    const avgScore = activeReports.length > 0
      ? activeReports.reduce((sum, r) => sum + r.score, 0) / activeReports.length
      : (reports.length > 0 ? reports.reduce((sum, r) => sum + r.score, 0) / reports.length : 0.5);

    const allViolations: AestheticViolation[] = reports.flatMap(r => r.violations);
    const passed = avgScore >= constraints.general.minAestheticScore
      && allViolations.filter(v => v.severity === 'error').length === 0;

    // Build base report
    const baseReport: AestheticReport = {
      score: Math.round(avgScore * 100) / 100,
      violations: allViolations,
      passed,
      timestamp: Date.now(),
    };

    // When LIR context is provided with tokens, enrich the report
    const useLIR = !!(lirContext?.lirTokens && lirContext.lirTokens.length > 0);
    if (useLIR) {
      const tokens = lirContext!.lirTokens;
      const lirReport: LIRAwareAestheticReport = {
        ...baseReport,
        usedLIR: true,
        structuralMetrics: {
          totalSymbols: tokens.length,
          maxComplexity: Math.max(...tokens.map(t => t.metrics.cyclomaticComplexity)),
          avgNesting: Math.round((tokens.reduce((s, t) => s + t.metrics.nestingDepth, 0) / tokens.length) * 100) / 100,
          callGraphSize: tokens.reduce((s, t) => s + t.metrics.callCount, 0),
        },
      };

      // Compute coherence score if visual intent provided
      if (lirContext!.visualIntent) {
        lirReport.coherenceScore = computeCoherence(tokens, lirContext!.visualIntent);
      }

      return lirReport;
    }

    return baseReport;
  }
}

// ---------------------------------------------------------------------------
// Coherence: compare visual intent against actual code structure
// ---------------------------------------------------------------------------

function computeCoherence(
  tokens: import('../core/lir/types.js').LIRCodeToken[],
  visualIntent: import('../audio/types.js').VisualMappingParams,
): number {
  // Count distinct API calls in generated code
  const allCalls = new Set(tokens.flatMap(t => t.relationships.calls));

  // Simple heuristic: more API variety = richer visual output = better coherence
  // Normalized against the palette's hue count (more hues = expected more variety)
  const expectedVariety = Math.max(visualIntent.palette.hues.length, 3);
  const richnessRatio = Math.min(allCalls.size / (expectedVariety * 2), 1);
  return Math.round(richnessRatio * 100) / 100;
}

// Singleton instance
export const aestheticCritic = new AestheticCritic();
