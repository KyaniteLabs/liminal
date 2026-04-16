/**
 * EmergenceScorecard — Phase 14
 *
 * Aggregates emergence signals into a structured scorecard for display
 * and decision-making. Provides human-readable grades and actionable
 * insights about an artifact's emergence profile.
 */

import type { EmergenceSignals } from '../emergence/types.js';

export interface ScorecardEntry {
  signal: string;
  value: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  label: string;
}

export interface Scorecard {
  entries: ScorecardEntry[];
  overall: {
    score: number;
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
    verdict: string;
  };
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
}

const SIGNAL_LABELS: Record<string, string> = {
  novelty: 'Novelty',
  structure: 'Structure',
  temporalRichness: 'Temporal Richness',
  perturbationResilience: 'Perturbation Resilience',
  fertility: 'Fertility',
  aesthetic: 'Aesthetic',
};

export class EmergenceScorecard {
  /**
   * Generate a structured scorecard from emergence signals.
   */
  score(signals: EmergenceSignals, composite?: number): Scorecard {
    const entries: ScorecardEntry[] = [
      this.makeEntry('novelty', signals.novelty),
      this.makeEntry('structure', signals.structure),
      this.makeEntry('temporalRichness', signals.temporalRichness),
      this.makeEntry('perturbationResilience', signals.perturbationResilience),
      this.makeEntry('fertility', signals.fertility),
      this.makeEntry('aesthetic', signals.aesthetic),
    ];

    const overallScore = composite ?? entries.reduce((s, e) => s + e.value, 0) / entries.length;
    const overallGrade = this.toGrade(overallScore);
    const verdict = this.verdict(overallScore);

    return {
      entries,
      overall: { score: overallScore, grade: overallGrade, verdict },
      strengths: entries.filter(e => e.value >= 0.7).map(e => e.label),
      weaknesses: entries.filter(e => e.value < 0.4).map(e => e.label),
      recommendations: this.recommendations(entries),
    };
  }

  /**
   * Format a scorecard as a human-readable string.
   */
  format(scorecard: Scorecard): string {
    const lines: string[] = ['=== Emergence Scorecard ==='];

    for (const entry of scorecard.entries) {
      const bar = this.bar(entry.value);
      lines.push(`  ${entry.label.padEnd(25)} ${bar} ${entry.value.toFixed(2)} [${entry.grade}]`);
    }

    lines.push('');
    lines.push(`  Overall: ${scorecard.overall.score.toFixed(2)} [${scorecard.overall.grade}] — ${scorecard.overall.verdict}`);

    if (scorecard.strengths.length > 0) {
      lines.push(`  Strengths: ${scorecard.strengths.join(', ')}`);
    }
    if (scorecard.weaknesses.length > 0) {
      lines.push(`  Weaknesses: ${scorecard.weaknesses.join(', ')}`);
    }
    if (scorecard.recommendations.length > 0) {
      lines.push('  Recommendations:');
      for (const rec of scorecard.recommendations) {
        lines.push(`    - ${rec}`);
      }
    }

    return lines.join('\n');
  }

  private makeEntry(signal: string, value: number): ScorecardEntry {
    return {
      signal,
      value,
      grade: this.toGrade(value),
      label: SIGNAL_LABELS[signal] ?? signal,
    };
  }

  private toGrade(value: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (value >= 0.8) return 'A';
    if (value >= 0.6) return 'B';
    if (value >= 0.4) return 'C';
    if (value >= 0.2) return 'D';
    return 'F';
  }

  private verdict(score: number): string {
    if (score >= 0.8) return 'Strong emergence — high-value artifact';
    if (score >= 0.6) return 'Moderate emergence — promising candidate';
    if (score >= 0.4) return 'Weak emergence — needs improvement';
    if (score >= 0.2) return 'Minimal emergence — consider reworking';
    return 'No emergence detected — reject or compost';
  }

  private recommendations(entries: ScorecardEntry[]): string[] {
    const recs: string[] = [];

    const novelty = entries.find(e => e.signal === 'novelty');
    if (novelty && novelty.value < 0.3) {
      recs.push('Low novelty — try perturbation or cross-niche recombination');
    }

    const structure = entries.find(e => e.signal === 'structure');
    if (structure && structure.value < 0.3) {
      recs.push('Flat structure — add hierarchical or multi-scale patterns');
    }

    const temporal = entries.find(e => e.signal === 'temporalRichness');
    if (temporal && temporal.value < 0.3) {
      recs.push('Static output — add temporal evolution or animation');
    }

    const resilience = entries.find(e => e.signal === 'perturbationResilience');
    if (resilience && resilience.value < 0.3) {
      recs.push('Brittle — reduce hard-coded values, add fallbacks');
    }

    const fertility = entries.find(e => e.signal === 'fertility');
    if (fertility && fertility.value < 0.3) {
      recs.push('Low fertility — diversify descriptor profile for remix potential');
    }

    return recs;
  }

  private bar(value: number, width: number = 20): string {
    const filled = Math.round(value * width);
    return '[' + '#'.repeat(filled) + '-'.repeat(width - filled) + ']';
  }
}
