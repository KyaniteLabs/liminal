import { describe, it, expect } from 'vitest';
/**
 * Tests for RoutingData - A/B test results and domain routing data.
 */

import {
  AB_TEST_RESULTS,
  DOMAIN_ROUTING_DATA,
  OVERALL_FITNESS,
  DOMAIN_KEYWORDS,
} from '../../src/routing/RoutingData.js';
import type { DomainType } from '../../src/routing/RoutingData.js';

describe('RoutingData', () => {
  describe('AB_TEST_RESULTS', () => {
    it('should have fitness data for all domains', () => {
      const domains: DomainType[] = ['ascii', 'music', 'code', 'visual'];

      for (const domain of domains) {
        expect(AB_TEST_RESULTS[domain]).not.toBeNull();
        expect(AB_TEST_RESULTS[domain]).toHaveProperty('local');
        expect(AB_TEST_RESULTS[domain]).toHaveProperty('cloud');
        expect(AB_TEST_RESULTS[domain]).toHaveProperty('hybrid');
      }
    });

    it('should have valid fitness scores between 0 and 1', () => {
      for (const domain in AB_TEST_RESULTS) {
        const { local, cloud, hybrid } = AB_TEST_RESULTS[domain as DomainType];

        expect(local).toBeGreaterThanOrEqual(0);
        expect(local).toBeLessThanOrEqual(1);
        expect(cloud).toBeGreaterThanOrEqual(0);
        expect(cloud).toBeLessThanOrEqual(1);
        expect(hybrid).toBeGreaterThanOrEqual(0);
        expect(hybrid).toBeLessThanOrEqual(1);
      }
    });

    it('should have correct A/B test values from March 2026', () => {
      // Music: Local dominates (0.523 vs 0.236)
      expect(AB_TEST_RESULTS.music.local).toBe(0.523);
      expect(AB_TEST_RESULTS.music.cloud).toBe(0.236);

      // Code: Local wins (0.503 vs 0.460)
      expect(AB_TEST_RESULTS.code.local).toBe(0.503);
      expect(AB_TEST_RESULTS.code.cloud).toBe(0.460);

      // ASCII: Cloud superior (0.363 vs 0.531)
      expect(AB_TEST_RESULTS.ascii.local).toBe(0.363);
      expect(AB_TEST_RESULTS.ascii.cloud).toBe(0.531);
    });
  });

  describe('DOMAIN_ROUTING_DATA', () => {
    it('should have routing config for all domains', () => {
      const domains: DomainType[] = ['ascii', 'music', 'code', 'visual'];

      for (const domain of domains) {
        expect(DOMAIN_ROUTING_DATA[domain]).not.toBeNull();
        expect(DOMAIN_ROUTING_DATA[domain]).toHaveProperty('optimalModel');
        expect(DOMAIN_ROUTING_DATA[domain]).toHaveProperty('confidence');
        expect(DOMAIN_ROUTING_DATA[domain]).toHaveProperty('advantage');
      }
    });

    it('should route music to local with high confidence', () => {
      const musicConfig = DOMAIN_ROUTING_DATA.music;

      expect(musicConfig.optimalModel).toBe('local');
      expect(musicConfig.confidence).toBeGreaterThan(0.9);
      expect(musicConfig.advantage).toContain('+121%');
    });

    it('should route code to local', () => {
      const codeConfig = DOMAIN_ROUTING_DATA.code;

      expect(codeConfig.optimalModel).toBe('local');
      expect(codeConfig.advantage).toContain('+9%');
    });

    it('should route ascii to cloud', () => {
      const asciiConfig = DOMAIN_ROUTING_DATA.ascii;

      expect(asciiConfig.optimalModel).toBe('cloud');
      expect(asciiConfig.advantage).toContain('+46%');
    });

    it('should route visual to cloud', () => {
      const visualConfig = DOMAIN_ROUTING_DATA.visual;

      expect(visualConfig.optimalModel).toBe('cloud');
    });
  });

  describe('OVERALL_FITNESS', () => {
    it('should have fitness averages for all models', () => {
      expect(OVERALL_FITNESS).toHaveProperty('local');
      expect(OVERALL_FITNESS).toHaveProperty('cloud');
      expect(OVERALL_FITNESS).toHaveProperty('hybrid');
    });

    it('should have local fitness higher than cloud overall', () => {
      expect(OVERALL_FITNESS.local).toBeGreaterThan(OVERALL_FITNESS.cloud);
    });

    it('should match documented values', () => {
      expect(OVERALL_FITNESS.local).toBe(0.463);
      expect(OVERALL_FITNESS.cloud).toBe(0.409);
    });
  });

  describe('DOMAIN_KEYWORDS', () => {
    it('should have keywords for all domains', () => {
      const domains: DomainType[] = ['ascii', 'music', 'code', 'visual'];

      for (const domain of domains) {

        expect(Array.isArray(DOMAIN_KEYWORDS[domain])).toBe(true);
        expect(DOMAIN_KEYWORDS[domain]?.length).toBeGreaterThan(0);
      }
    });

    it('should have music-related keywords for music domain', () => {
      const musicKeywords = DOMAIN_KEYWORDS.music;

      expect(musicKeywords).toContain('music');
      expect(musicKeywords).toContain('melody');
      expect(musicKeywords).toContain('rhythm');
      expect(musicKeywords).toContain('piano');
    });

    it('should have ascii-related keywords for ascii domain', () => {
      const asciiKeywords = DOMAIN_KEYWORDS.ascii;

      expect(asciiKeywords).toContain('ascii');
      expect(asciiKeywords).toContain('art');
      expect(asciiKeywords).toContain('draw');
    });

    it('should have code-related keywords for code domain', () => {
      const codeKeywords = DOMAIN_KEYWORDS.code;

      expect(codeKeywords).toContain('code');
      expect(codeKeywords).toContain('function');
      expect(codeKeywords).toContain('algorithm');
    });

    it('should have visual-related keywords for visual domain', () => {
      const visualKeywords = DOMAIN_KEYWORDS.visual;

      expect(visualKeywords).toContain('visual');
      expect(visualKeywords).toContain('image');
      expect(visualKeywords).toContain('color');
    });
  });
});
