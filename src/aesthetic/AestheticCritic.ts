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
import { DEFAULT_DESIGN_CONSTRAINTS } from './types.js';
import { analyzeColorHarmony } from './critics/ColorHarmonyCritic.js';
import { analyzeLayout } from './critics/LayoutCritic.js';
import { analyzeTypography } from './critics/TypographyCritic.js';
import { analyzeSoundHarmony } from './critics/SoundHarmonyCritic.js';

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
  ): AestheticReport {
    if (!code || code.trim().length === 0) {
      return { score: 0, violations: [], passed: false, timestamp: Date.now() };
    }

    const constraints: DesignConstraints = {
      ...DEFAULT_DESIGN_CONSTRAINTS,
      ...config?.constraints,
      color: { ...DEFAULT_DESIGN_CONSTRAINTS.color, ...config?.constraints?.color },
      layout: { ...DEFAULT_DESIGN_CONSTRAINTS.layout, ...config?.constraints?.layout },
      typography: { ...DEFAULT_DESIGN_CONSTRAINTS.typography, ...config?.constraints?.typography },
      sound: { ...DEFAULT_DESIGN_CONSTRAINTS.sound, ...config?.constraints?.sound },
      general: { ...DEFAULT_DESIGN_CONSTRAINTS.general, ...config?.constraints?.general },
    };
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
