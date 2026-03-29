// ---------------------------------------------------------------------------
// AestheticCritic – orchestrator that runs all sub-critics and aggregates
// ---------------------------------------------------------------------------

import type { AestheticReport, AestheticViolation, CriticConfig, DesignConstraints } from './types.js';
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
  critique(code: string, config?: Partial<CriticConfig>): AestheticReport {
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
    const passed = avgScore >= constraints.general.minAestheticScore && allViolations.filter(v => v.severity === 'error').length === 0;

    return {
      score: Math.round(avgScore * 100) / 100,
      violations: allViolations,
      passed,
      timestamp: Date.now()
    };
  }
}
