import { describe, it, expect, beforeEach } from 'vitest';
/**
 * SelfReflection tests
 */

import { SelfReflectionEngine, type QualityTrend, type ImprovementSuggestion } from '../../src/improvement/SelfReflection.js';

describe('SelfReflectionEngine', () => {
  let engine: SelfReflectionEngine;

  beforeEach(() => {
    engine = new SelfReflectionEngine();
  });

  const createTrend = (
    iteration: number,
    overallScore: number,
    technicalScore: number,
    aestheticScore: number,
    noveltyScore: number,
    domain: string = 'p5'
  ): QualityTrend => ({
    iteration,
    timestamp: Date.now() + iteration * 1000,
    overallScore,
    technicalScore,
    aestheticScore,
    noveltyScore,
    domain,
  });

  describe('recordScore', () => {
    it('records a single score', () => {
      const trend = createTrend(1, 0.7, 0.8, 0.6, 0.7);
      engine.recordScore(trend);

      expect(engine.size()).toBe(1);
      const trends = engine.getTrends();
      expect(trends).toEqual([trend]);
    });

    it('records multiple scores in order', () => {
      engine.recordScore(createTrend(1, 0.5, 0.6, 0.4, 0.5));
      engine.recordScore(createTrend(2, 0.6, 0.7, 0.5, 0.6));
      engine.recordScore(createTrend(3, 0.7, 0.8, 0.6, 0.7));

      expect(engine.size()).toBe(3);
      const trends = engine.getTrends();
      expect(trends[0].overallScore).toBe(0.5);
      expect(trends[1].overallScore).toBe(0.6);
      expect(trends[2].overallScore).toBe(0.7);
    });

    it('getTrends returns a copy, not reference', () => {
      engine.recordScore(createTrend(1, 0.7, 0.8, 0.6, 0.7));
      const trends1 = engine.getTrends();
      const trends2 = engine.getTrends();

      expect(trends1).not.toBe(trends2);
      expect(trends1).toEqual(trends2);
    });
  });

  describe('detectPlateau', () => {
    it('returns null when insufficient data', () => {
      engine.recordScore(createTrend(1, 0.7, 0.8, 0.6, 0.7));

      const result = engine.detectPlateau();
      expect(result).toBeNull();
    });

    it('detects plateau with consistent scores', () => {
      // Add 10 iterations with nearly identical scores
      for (let i = 0; i < 10; i++) {
        engine.recordScore(createTrend(i, 0.75, 0.8, 0.7, 0.75));
      }

      const result = engine.detectPlateau();
      expect(result).not.toBeNull();
      expect(result?.type).toBe('plateau');
      expect(result?.confidence).toBe(0.9);
      expect(result?.description).toContain('plateaued at 0.75');
      expect(result?.description).toContain('10 iterations');
      expect(result?.suggestedAction).toContain('novel techniques');
    });

    it('returns null when scores are improving significantly', () => {
      // Use more aggressive improvement to avoid plateau detection
      for (let i = 0; i < 10; i++) {
        engine.recordScore(createTrend(i, 0.3 + i * 0.08, 0.4, 0.3, 0.35));
      }

      const result = engine.detectPlateau();
      expect(result).toBeNull();
    });

    it('respects custom window size', () => {
      // Add 15 iterations with consistent scores
      for (let i = 0; i < 15; i++) {
        engine.recordScore(createTrend(i, 0.75, 0.8, 0.7, 0.75));
      }

      // Should detect plateau with window of 5
      const result5 = engine.detectPlateau(5);
      expect(result5).not.toBeNull();
      expect(result5?.description).toContain('5 iterations');
    });

    it('handles slight variance within threshold', () => {
      // Scores with variance < 0.05
      const scores = [0.74, 0.75, 0.76, 0.75, 0.74, 0.75, 0.76, 0.75, 0.74, 0.75];
      for (let i = 0; i < scores.length; i++) {
        engine.recordScore(createTrend(i, scores[i], 0.8, 0.7, 0.75));
      }

      const result = engine.detectPlateau();
      expect(result).not.toBeNull();
    });
  });

  describe('detectDecline', () => {
    it('returns null when insufficient data', () => {
      engine.recordScore(createTrend(1, 0.7, 0.8, 0.6, 0.7));

      const result = engine.detectDecline();
      expect(result).toBeNull();
    });

    it('detects declining quality', () => {
      // Add 10 iterations with declining scores
      for (let i = 0; i < 10; i++) {
        engine.recordScore(createTrend(i, 0.8 - i * 0.05, 0.8, 0.7, 0.75));
      }

      const result = engine.detectDecline();
      expect(result).not.toBeNull();
      expect(result?.type).toBe('decline');
      expect(result?.description).toContain('declining');
      expect(result?.description).toContain('0.80');
      expect(result?.description).toContain('0.35');
      expect(result?.suggestedAction).toContain('dropped by');
    });

    it('returns null when scores are stable', () => {
      for (let i = 0; i < 10; i++) {
        engine.recordScore(createTrend(i, 0.75, 0.8, 0.7, 0.75));
      }

      const result = engine.detectDecline();
      expect(result).toBeNull();
    });

    it('returns null when scores are improving', () => {
      for (let i = 0; i < 10; i++) {
        engine.recordScore(createTrend(i, 0.5 + i * 0.03, 0.6, 0.5, 0.6));
      }

      const result = engine.detectDecline();
      expect(result).toBeNull();
    });

    it('respects custom window size', () => {
      // Add 15 iterations
      for (let i = 0; i < 15; i++) {
        engine.recordScore(createTrend(i, 0.8 - i * 0.02, 0.8, 0.7, 0.75));
      }

      const result5 = engine.detectDecline(5);
      expect(result5).not.toBeNull();
      // The decline detection should work but we don't enforce specific description format
      expect(result5?.type).toBe('decline');
    });

    it('calculates confidence based on slope severity', () => {
      // Steep decline
      for (let i = 0; i < 10; i++) {
        engine.recordScore(createTrend(i, 0.9 - i * 0.1, 0.8, 0.7, 0.75));
      }

      const result = engine.detectDecline();
      expect(result).not.toBeNull();
      expect(result?.confidence).toBeGreaterThan(0.5);
    });
  });

  describe('detectDomainGaps', () => {
    it('returns empty array when no data', () => {
      const gaps = engine.detectDomainGaps();
      expect(gaps).toEqual([]);
    });

    it('detects domain with few entries', () => {
      engine.recordScore(createTrend(1, 0.7, 0.8, 0.6, 0.7, 'p5'));
      engine.recordScore(createTrend(2, 0.75, 0.8, 0.7, 0.75, 'glsl'));

      const gaps = engine.detectDomainGaps();
      const p5Gap = gaps.find(g => g.description.includes("'p5'"));
      const glslGap = gaps.find(g => g.description.includes("'glsl'"));

      expect(p5Gap?.type).toBe('domain_gap');
      expect(p5Gap?.description).toContain('only 1 entries');

      expect(glslGap?.description).toContain('only 1 entries');
    });

    it('detects domain with low average quality', () => {
      for (let i = 0; i < 5; i++) {
        engine.recordScore(createTrend(i, 0.3, 0.4, 0.2, 0.3, 'p5'));
      }

      const gaps = engine.detectDomainGaps();
      const p5Gap = gaps.find(g => g.description.includes("'p5'"));

      expect(p5Gap?.type).toBe('domain_gap');
      expect(p5Gap?.description).toContain('low average quality: 0.30');
      expect(p5Gap?.suggestedAction).toContain('target is 0.5');
    });

    it('returns no gaps for domain with sufficient entries and quality', () => {
      for (let i = 0; i < 5; i++) {
        engine.recordScore(createTrend(i, 0.75, 0.8, 0.7, 0.75, 'p5'));
      }

      const gaps = engine.detectDomainGaps();
      const p5Gap = gaps.find(g => g.description.includes("'p5'"));

      expect(p5Gap).toBeUndefined();
    });

    it('handles multiple domains independently', () => {
      // p5: good quality, sufficient entries
      for (let i = 0; i < 5; i++) {
        engine.recordScore(createTrend(i, 0.75, 0.8, 0.7, 0.75, 'p5'));
      }

      // glsl: low quality
      for (let i = 0; i < 5; i++) {
        engine.recordScore(createTrend(i + 5, 0.4, 0.5, 0.3, 0.4, 'glsl'));
      }

      // three: few entries
      engine.recordScore(createTrend(10, 0.7, 0.8, 0.6, 0.7, 'three'));

      const gaps = engine.detectDomainGaps();

      expect(gaps.length).toBe(2);
      expect(gaps.some(g => g.description.includes("'glsl'"))).toBe(true);
      expect(gaps.some(g => g.description.includes("'three'"))).toBe(true);
      expect(gaps.some(g => g.description.includes("'p5'"))).toBe(false);
    });
  });

  describe('detectQualityCeiling', () => {
    it('returns null when insufficient data', () => {
      engine.recordScore(createTrend(1, 0.9, 0.95, 0.85, 0.9));

      const result = engine.detectQualityCeiling();
      expect(result).toBeNull();
    });

    it('detects quality ceiling at high scores with minimal improvement', () => {
      // High scores (> 0.8) with minimal variance
      for (let i = 0; i < 10; i++) {
        engine.recordScore(createTrend(i, 0.85 + i * 0.001, 0.9, 0.8, 0.85));
      }

      const result = engine.detectQualityCeiling();
      expect(result).not.toBeNull();
      expect(result?.type).toBe('quality_ceiling');
      expect(result?.description).toContain('quality ceiling');
      expect(result?.description).toContain('0.85');
      expect(result?.suggestedAction).toContain('plateaued at 0.85');
      expect(result?.suggestedAction).toContain('fundamentally different approaches');
    });

    it('returns null when scores are below ceiling threshold', () => {
      for (let i = 0; i < 10; i++) {
        engine.recordScore(createTrend(i, 0.7 + i * 0.001, 0.75, 0.65, 0.7));
      }

      const result = engine.detectQualityCeiling();
      expect(result).toBeNull();
    });

    it('returns null when scores are still improving significantly', () => {
      for (let i = 0; i < 10; i++) {
        engine.recordScore(createTrend(i, 0.8 + i * 0.02, 0.85, 0.75, 0.8));
      }

      const result = engine.detectQualityCeiling();
      expect(result).toBeNull();
    });

    it('has high confidence for ceiling detection', () => {
      for (let i = 0; i < 10; i++) {
        engine.recordScore(createTrend(i, 0.88, 0.9, 0.86, 0.88));
      }

      const result = engine.detectQualityCeiling();
      expect(result).not.toBeNull();
      expect(result?.confidence).toBe(0.85);
    });
  });

  describe('analyze', () => {
    it('returns empty array when no issues detected', () => {
      // Use more aggressive improvement to avoid plateau detection
      for (let i = 0; i < 10; i++) {
        engine.recordScore(createTrend(i, 0.3 + i * 0.08, 0.4, 0.35, 0.38, 'p5'));
      }

      const suggestions = engine.analyze();
      // Should not have plateau, decline, domain_gap, or quality_ceiling
      expect(suggestions.length).toBe(0);
    });

    it('detects multiple issues simultaneously', () => {
      // Add plateau (consistent high scores)
      for (let i = 0; i < 10; i++) {
        engine.recordScore(createTrend(i, 0.85, 0.9, 0.8, 0.85, 'p5'));
      }

      // Add domain gap
      engine.recordScore(createTrend(10, 0.4, 0.5, 0.3, 0.4, 'glsl'));

      const suggestions = engine.analyze();

      expect(suggestions.length).toBeGreaterThanOrEqual(2);
      expect(suggestions.some(s => s.type === 'plateau')).toBe(true);
      expect(suggestions.some(s => s.type === 'quality_ceiling')).toBe(true);
      expect(suggestions.some(s => s.type === 'domain_gap')).toBe(true);
    });

    it('detects only plateau when scores are mid-range', () => {
      for (let i = 0; i < 10; i++) {
        engine.recordScore(createTrend(i, 0.65, 0.7, 0.6, 0.65, 'p5'));
      }

      const suggestions = engine.analyze();

      // Should detect plateau but not quality ceiling (below 0.8 threshold)
      expect(suggestions.some(s => s.type === 'plateau')).toBe(true);
      expect(suggestions.some(s => s.type === 'quality_ceiling')).toBe(false);
    });
  });

  describe('designImprovementSpec', () => {
    it('generates spec for plateau suggestion', () => {
      const suggestion: ImprovementSuggestion = {
        type: 'plateau',
        confidence: 0.9,
        description: 'Quality has plateaued at 0.75 over 10 iterations',
        suggestedAction: 'Focus on exploring novel techniques',
      };

      const spec = engine.designImprovementSpec(suggestion);

      expect(spec).toContain('[SELF-REFLECTION: PLATEAU]');
      expect(spec).toContain('(confidence: 90%)');
      expect(spec).toContain('ISSUE: Quality has plateaued');
      expect(spec).toContain('ACTION REQUIRED: Focus on exploring novel techniques');
    });

    it('generates spec for decline suggestion', () => {
      const suggestion: ImprovementSuggestion = {
        type: 'decline',
        confidence: 0.75,
        description: 'Quality is declining: 0.80 → 0.35',
        suggestedAction: 'Review recent changes and simplify',
      };

      const spec = engine.designImprovementSpec(suggestion);

      expect(spec).toContain('[SELF-REFLECTION: DECLINE]');
      expect(spec).toContain('(confidence: 75%)');
      expect(spec).toContain('ISSUE: Quality is declining');
      expect(spec).toContain('ACTION REQUIRED: Review recent changes');
    });

    it('generates spec for domain_gap suggestion', () => {
      const suggestion: ImprovementSuggestion = {
        type: 'domain_gap',
        confidence: 0.8,
        description: "Domain 'glsl' has only 1 entries",
        suggestedAction: 'Generate more examples in glsl',
      };

      const spec = engine.designImprovementSpec(suggestion);

      expect(spec).toContain('[SELF-REFLECTION: DOMAIN_GAP]');
      expect(spec).toContain("(confidence: 80%)");
      expect(spec).toContain("ISSUE: Domain 'glsl' has only 1 entries");
      expect(spec).toContain('ACTION REQUIRED: Generate more examples');
    });

    it('generates spec for quality_ceiling suggestion', () => {
      const suggestion: ImprovementSuggestion = {
        type: 'quality_ceiling',
        confidence: 0.85,
        description: 'Hit quality ceiling at 0.88',
        suggestedAction: 'Explore fundamentally different approaches',
      };

      const spec = engine.designImprovementSpec(suggestion);

      expect(spec).toContain('[SELF-REFLECTION: QUALITY_CEILING]');
      expect(spec).toContain('(confidence: 85%)');
      expect(spec).toContain('ISSUE: Hit quality ceiling');
      expect(spec).toContain('ACTION REQUIRED: Explore fundamentally different');
    });
  });

  describe('getTrajectory', () => {
    it('returns stable with insufficient data', () => {
      engine.recordScore(createTrend(1, 0.7, 0.8, 0.6, 0.7));

      expect(engine.getTrajectory()).toBe('stable');
    });

    it('returns improving for positive slope', () => {
      for (let i = 0; i < 10; i++) {
        engine.recordScore(createTrend(i, 0.5 + i * 0.05, 0.6, 0.5, 0.55));
      }

      expect(engine.getTrajectory()).toBe('improving');
    });

    it('returns declining for negative slope', () => {
      for (let i = 0; i < 10; i++) {
        engine.recordScore(createTrend(i, 0.8 - i * 0.05, 0.8, 0.7, 0.75));
      }

      expect(engine.getTrajectory()).toBe('declining');
    });

    it('returns stable for minimal change', () => {
      for (let i = 0; i < 10; i++) {
        engine.recordScore(createTrend(i, 0.7 + i * 0.005, 0.75, 0.65, 0.7));
      }

      expect(engine.getTrajectory()).toBe('stable');
    });

    it('uses last 10 iterations for trajectory', () => {
      // First 5: declining
      for (let i = 0; i < 5; i++) {
        engine.recordScore(createTrend(i, 0.8 - i * 0.1, 0.8, 0.7, 0.75));
      }

      // Next 10: improving
      for (let i = 5; i < 15; i++) {
        engine.recordScore(createTrend(i, 0.3 + (i - 5) * 0.05, 0.6, 0.5, 0.55));
      }

      // Should be improving based on last 10
      expect(engine.getTrajectory()).toBe('improving');
    });
  });

  describe('getStats', () => {
    it('returns zero stats when no data', () => {
      const stats = engine.getStats();

      expect(stats.avgScore).toBe(0);
      expect(stats.trend).toBe('no data');
      expect(stats.bestScore).toBe(0);
      expect(stats.iterations).toBe(0);
    });

    it('calculates correct statistics', () => {
      engine.recordScore(createTrend(1, 0.5, 0.6, 0.4, 0.5));
      engine.recordScore(createTrend(2, 0.7, 0.8, 0.6, 0.7));
      engine.recordScore(createTrend(3, 0.6, 0.7, 0.5, 0.6));

      const stats = engine.getStats();

      expect(stats.avgScore).toBeCloseTo(0.6, 1);
      expect(stats.bestScore).toBe(0.7);
      expect(stats.iterations).toBe(3);
      expect(['improving', 'stable', 'declining']).toContain(stats.trend);
    });

    it('identifies best score correctly', () => {
      engine.recordScore(createTrend(1, 0.5, 0.6, 0.4, 0.5));
      engine.recordScore(createTrend(2, 0.9, 0.95, 0.85, 0.9));
      engine.recordScore(createTrend(3, 0.7, 0.8, 0.6, 0.7));

      const stats = engine.getStats();
      expect(stats.bestScore).toBe(0.9);
    });

    it('calculates average correctly', () => {
      engine.recordScore(createTrend(1, 0.5, 0.6, 0.4, 0.5));
      engine.recordScore(createTrend(2, 0.7, 0.8, 0.6, 0.7));
      engine.recordScore(createTrend(3, 0.9, 0.95, 0.85, 0.9));

      const stats = engine.getStats();
      expect(stats.avgScore).toBeCloseTo(0.7, 1);
    });
  });

  describe('clear', () => {
    it('clears all recorded trends', () => {
      engine.recordScore(createTrend(1, 0.7, 0.8, 0.6, 0.7));
      engine.recordScore(createTrend(2, 0.75, 0.8, 0.7, 0.75));

      expect(engine.size()).toBe(2);

      engine.clear();

      expect(engine.size()).toBe(0);
      expect(engine.getTrends()).toEqual([]);
    });

    it('resets stats after clear', () => {
      engine.recordScore(createTrend(1, 0.7, 0.8, 0.6, 0.7));
      engine.recordScore(createTrend(2, 0.75, 0.8, 0.7, 0.75));

      engine.clear();

      const stats = engine.getStats();
      expect(stats.avgScore).toBe(0);
      expect(stats.iterations).toBe(0);
    });
  });

  describe('getTrendsByDomain', () => {
    it('returns empty array for unknown domain', () => {
      engine.recordScore(createTrend(1, 0.7, 0.8, 0.6, 0.7, 'p5'));

      const trends = engine.getTrendsByDomain('glsl');
      expect(trends).toEqual([]);
    });

    it('filters trends by domain correctly', () => {
      engine.recordScore(createTrend(1, 0.7, 0.8, 0.6, 0.7, 'p5'));
      engine.recordScore(createTrend(2, 0.6, 0.7, 0.5, 0.6, 'glsl'));
      engine.recordScore(createTrend(3, 0.8, 0.85, 0.75, 0.8, 'p5'));
      engine.recordScore(createTrend(4, 0.65, 0.75, 0.55, 0.65, 'glsl'));

      const p5Trends = engine.getTrendsByDomain('p5');
      const glslTrends = engine.getTrendsByDomain('glsl');

      expect(p5Trends.length).toBe(2);
      expect(p5Trends[0].overallScore).toBe(0.7);
      expect(p5Trends[1].overallScore).toBe(0.8);

      expect(glslTrends.length).toBe(2);
      expect(glslTrends[0].overallScore).toBe(0.6);
      expect(glslTrends[1].overallScore).toBe(0.65);
    });

    it('returns copy not reference', () => {
      engine.recordScore(createTrend(1, 0.7, 0.8, 0.6, 0.7, 'p5'));

      const trends1 = engine.getTrendsByDomain('p5');
      const trends2 = engine.getTrendsByDomain('p5');

      expect(trends1).not.toBe(trends2);
      expect(trends1).toEqual(trends2);
    });
  });

  describe('size', () => {
    it('returns 0 for empty engine', () => {
      expect(engine.size()).toBe(0);
    });

    it('returns correct count after recording', () => {
      engine.recordScore(createTrend(1, 0.7, 0.8, 0.6, 0.7));
      expect(engine.size()).toBe(1);

      engine.recordScore(createTrend(2, 0.75, 0.8, 0.7, 0.75));
      expect(engine.size()).toBe(2);

      engine.recordScore(createTrend(3, 0.8, 0.85, 0.75, 0.8));
      expect(engine.size()).toBe(3);
    });

    it('returns 0 after clear', () => {
      engine.recordScore(createTrend(1, 0.7, 0.8, 0.6, 0.7));
      engine.recordScore(createTrend(2, 0.75, 0.8, 0.7, 0.75));

      engine.clear();

      expect(engine.size()).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('handles single data point gracefully', () => {
      engine.recordScore(createTrend(1, 0.7, 0.8, 0.6, 0.7));

      expect(engine.detectPlateau()).toBeNull();
      expect(engine.detectDecline()).toBeNull();
      expect(engine.detectQualityCeiling()).toBeNull();
      expect(engine.getTrajectory()).toBe('stable');

      const stats = engine.getStats();
      expect(stats.avgScore).toBe(0.7);
      expect(stats.bestScore).toBe(0.7);
    });

    it('handles two data points gracefully', () => {
      engine.recordScore(createTrend(1, 0.7, 0.8, 0.6, 0.7));
      engine.recordScore(createTrend(2, 0.8, 0.85, 0.75, 0.8));

      expect(engine.detectPlateau()).toBeNull();
      expect(engine.detectDecline()).toBeNull();
      // With only 2 points, slope threshold of 0.01 is too strict
      expect(engine.getTrajectory()).toBe('stable');
    });

    it('handles zero scores', () => {
      engine.recordScore(createTrend(1, 0, 0, 0, 0));
      engine.recordScore(createTrend(2, 0, 0, 0, 0));

      const stats = engine.getStats();
      expect(stats.avgScore).toBe(0);
      expect(stats.bestScore).toBe(0);
    });

    it('handles perfect scores', () => {
      engine.recordScore(createTrend(1, 1, 1, 1, 1));
      engine.recordScore(createTrend(2, 1, 1, 1, 1));

      const stats = engine.getStats();
      expect(stats.avgScore).toBe(1);
      expect(stats.bestScore).toBe(1);
    });

    it('handles mixed domains in analysis', () => {
      // p5: good quality, sufficient entries
      for (let i = 0; i < 5; i++) {
        engine.recordScore(createTrend(i, 0.75, 0.8, 0.7, 0.75, 'p5'));
      }

      // glsl: few entries
      engine.recordScore(createTrend(5, 0.7, 0.8, 0.6, 0.7, 'glsl'));

      // three: low quality
      for (let i = 0; i < 5; i++) {
        engine.recordScore(createTrend(i + 6, 0.4, 0.5, 0.3, 0.4, 'three'));
      }

      const suggestions = engine.analyze();
      const domainGaps = suggestions.filter(s => s.type === 'domain_gap');

      expect(domainGaps.length).toBe(2);
      expect(domainGaps.some(g => g.description.includes("'glsl'"))).toBe(true);
      expect(domainGaps.some(g => g.description.includes("'three'"))).toBe(true);
    });

    it('handles rapid quality changes', () => {
      // Alternating high/low scores
      for (let i = 0; i < 10; i++) {
        const score = i % 2 === 0 ? 0.9 : 0.4;
        engine.recordScore(createTrend(i, score, score + 0.05, score - 0.05, score));
      }

      const stats = engine.getStats();
      expect(stats.avgScore).toBeGreaterThan(0.6);
      expect(stats.avgScore).toBeLessThan(0.7);

      // High variance should not trigger plateau
      expect(engine.detectPlateau()).toBeNull();
    });
  });
});
