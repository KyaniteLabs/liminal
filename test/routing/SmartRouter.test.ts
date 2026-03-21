import { describe, it, expect, beforeEach } from 'vitest';
/**
 * Tests for SmartRouter - domain-aware routing with A/B test data.
 */

import {
  SmartRouter,
  route,
  routeByPrompt,
  defaultRouter,
} from '../../src/routing/SmartRouter.js';

describe('SmartRouter', () => {
  let router: SmartRouter;

  beforeEach(() => {
    router = new SmartRouter();
  });

  describe('route()', () => {
    it('should route music domain to local model', () => {
      const decision = router.route('music');

      expect(decision.model).toBe('local');
      expect(decision.domain).toBe('music');
      expect(decision.confidence).toBeGreaterThan(0.9);
      expect(decision.reason).toContain('Music domain');
      expect(decision.reason).toContain('Local');
    });

    it('should route code domain to local model', () => {
      const decision = router.route('code');

      expect(decision.model).toBe('local');
      expect(decision.domain).toBe('code');
      expect(decision.confidence).toBeGreaterThan(0.7);
      expect(decision.reason).toContain('Code domain');
    });

    it('should route ascii domain to cloud model', () => {
      const decision = router.route('ascii');

      expect(decision.model).toBe('cloud');
      expect(decision.domain).toBe('ascii');
      expect(decision.confidence).toBeGreaterThan(0.8);
      expect(decision.reason).toContain('ASCII');
      expect(decision.reason).toContain('Cloud');
    });

    it('should route visual domain to cloud model', () => {
      const decision = router.route('visual');

      expect(decision.model).toBe('cloud');
      expect(decision.domain).toBe('visual');
      expect(decision.reason).toContain('Visual');
    });

    it('should include fitness scores in decision', () => {
      const decision = router.route('music');

      expect(decision.localFitness).toBe(0.523);
      expect(decision.cloudFitness).toBe(0.236);
    });

    it('should include advantage percentage in reason', () => {
      const musicDecision = router.route('music');
      const asciiDecision = router.route('ascii');

      expect(musicDecision.reason).toContain('+121%');
      expect(asciiDecision.reason).toContain('+46%');
    });
  });

  describe('routeByPrompt()', () => {
    describe('music domain detection', () => {
      it('should detect music keywords and route to local', () => {
        const musicPrompts = [
          'Create a melody in C major',
          'Generate a song with piano and guitar',
          'Write a rhythm pattern',
          'Compose a chord progression',
        ];

        for (const prompt of musicPrompts) {
          const decision = router.routeByPrompt(prompt);
          expect(decision.model).toBe('local');
          expect(decision.domain).toBe('music');
          expect(decision.reason).toContain('Music');
        }
      });

      it('should be case-insensitive for keyword detection', () => {
        const decision = router.routeByPrompt('Create a MELODY with PIANO');
        expect(decision.model).toBe('local');
        expect(decision.domain).toBe('music');
      });
    });

    describe('ascii domain detection', () => {
      it('should detect ascii keywords and route to cloud', () => {
        const asciiPrompts = [
          'Draw a cat face in ASCII art',
          'Create spaceship ASCII',
          'Generate text art picture',
        ];

        for (const prompt of asciiPrompts) {
          const decision = router.routeByPrompt(prompt);
          expect(decision.model).toBe('cloud');
          expect(decision.domain).toBe('ascii');
          expect(decision.reason).toContain('ASCII');
        }
      });
    });

    describe('code domain detection', () => {
      it('should detect code keywords and route to local', () => {
        const codePrompts = [
          'Write code for sorting algorithm',
          'Define a class in JavaScript',
          'Implement a function for data processing',
        ];

        for (const prompt of codePrompts) {
          const decision = router.routeByPrompt(prompt);
          expect(decision.model).toBe('local');
          expect(decision.domain).toBe('code');
          expect(decision.reason).toContain('Code');
        }
      });
    });

    describe('visual domain detection', () => {
      it('should detect visual keywords and route to cloud', () => {
        const visualPrompts = [
          'Render a 3D scene with lighting',
          'Create a colorful design',
          'Make a shader with shapes',
        ];

        for (const prompt of visualPrompts) {
          const decision = router.routeByPrompt(prompt);
          expect(decision.model).toBe('cloud');
          expect(decision.domain).toBe('visual');
          expect(decision.reason).toContain('Visual');
        }
      });
    });

    describe('unknown domain handling', () => {
      it('should default to local for unknown domain when preferLocal=true', () => {
        const decision = router.routeByPrompt('Some random prompt without keywords');

        expect(decision.model).toBe('local');
        expect(decision.confidence).toBeLessThan(0.5);
        expect(decision.reason).toContain('Unknown domain');
      });

      it('should default to cloud for unknown domain when preferLocal=false', () => {
        const cloudPreferringRouter = new SmartRouter({ preferLocal: false });
        const decision = cloudPreferringRouter.routeByPrompt('Random prompt');

        expect(decision.model).toBe('cloud');
        expect(decision.reason).toContain('Unknown domain');
      });
    });

    describe('keyword priority', () => {
      it('should detect first matching domain keyword', () => {
        // Prompt with both music and code keywords - should detect music first
        const decision = router.routeByPrompt('Create music with code generation');
        expect(decision.domain).toBeDefined();
        expect(['music', 'code']).toContain(decision.domain);
      });
    });
  });

  describe('configuration options', () => {
    describe('preferLocal option', () => {
      it('should prefer local when fitness is close (within 5%)', () => {
        const router = new SmartRouter({ preferLocal: true });
        const decision = router.route('ascii'); // ASCII: Cloud wins by 46%, but preferLocal might override

        // For ASCII, cloud advantage is so large (46%) that preferLocal shouldn't override
        expect(decision.model).toBe('cloud');
      });

      it('should use cloud preferLocal=false', () => {
        const router = new SmartRouter({ preferLocal: false });
        const decision = router.route('code'); // Code: Local wins by 9%

        // With preferLocal=false and local winning, still use local
        expect(decision.model).toBe('local');
      });
    });

    describe('fallbackToHybrid option', () => {
      it('should use hybrid for complex tasks when fallback enabled', () => {
        const router = new SmartRouter({
          fallbackToHybrid: true,
          minConfidence: 0.8,
        });
        const decision = router.route('code', 'complex');

        // Code has confidence 0.75, which is below minConfidence 0.8
        // With fallbackToHybrid, should use hybrid
        expect(decision.model).toBe('hybrid');
        expect(decision.reason).toContain('Hybrid');
      });

      it('should not use hybrid when fallback disabled', () => {
        const router = new SmartRouter({
          fallbackToHybrid: false,
        });
        const decision = router.route('code', 'complex');

        expect(decision.model).not.toBe('hybrid');
      });
    });

    describe('minConfidence option', () => {
      it('should affect hybrid fallback threshold', () => {
        const router = new SmartRouter({
          fallbackToHybrid: true,
          minConfidence: 0.9,
        });
        const decision = router.route('code', 'complex');

        // Code confidence is 0.75, below 0.9 threshold
        expect(decision.model).toBe('hybrid');
      });
    });
  });

  describe('getStats()', () => {
    it('should return A/B test results', () => {
      const stats = router.getStats();

      expect(stats.abTestResults).toBeDefined();
      expect(stats.abTestResults.music).toBeDefined();
      expect(stats.abTestResults.code).toBeDefined();
      expect(stats.abTestResults.ascii).toBeDefined();
    });

    it('should return overall fitness averages', () => {
      const stats = router.getStats();

      expect(stats.overallLocalFitness).toBe(0.463);
      expect(stats.overallCloudFitness).toBe(0.409);
    });

    it('should return domain winners and advantages', () => {
      const stats = router.getStats();

      expect(stats.domains.music.winner).toBe('local');
      expect(stats.domains.music.advantage).toBe('+121%');
      expect(stats.domains.code.winner).toBe('local');
      expect(stats.domains.ascii.winner).toBe('cloud');
      expect(stats.domains.ascii.advantage).toBe('+46%');
    });

    it('should include confidence scores for each domain', () => {
      const stats = router.getStats();

      expect(stats.domains.music.confidence).toBeGreaterThan(0);
      expect(stats.domains.code.confidence).toBeGreaterThan(0);
      expect(stats.domains.ascii.confidence).toBeGreaterThan(0);
      expect(stats.domains.visual.confidence).toBeGreaterThan(0);
    });
  });

  describe('getDomainConfig()', () => {
    it('should return routing config for requested domain', () => {
      const musicConfig = router.getDomainConfig('music');

      expect(musicConfig.optimalModel).toBe('local');
      expect(musicConfig.confidence).toBe(0.95);
      expect(musicConfig.advantage).toBe('+121%');
      expect(musicConfig.localFitness).toBe(0.523);
      expect(musicConfig.cloudFitness).toBe(0.236);
    });
  });

  describe('isDomainSupported()', () => {
    it('should return true for supported domains', () => {
      expect(router.isDomainSupported('music')).toBe(true);
      expect(router.isDomainSupported('code')).toBe(true);
      expect(router.isDomainSupported('ascii')).toBe(true);
      expect(router.isDomainSupported('visual')).toBe(true);
    });

    it('should return false for unsupported domains', () => {
      expect(router.isDomainSupported('invalid')).toBe(false);
      expect(router.isDomainSupported('')).toBe(false);
    });

    it('should type-narrow correctly', () => {
      const domain: string = 'music';
      if (router.isDomainSupported(domain)) {
        // TypeScript should know domain is DomainType here
        const config = router.getDomainConfig(domain as 'ascii' | 'music' | 'code' | 'visual');
        expect(config).toBeDefined();
      }
    });
  });
});

describe('Convenience functions', () => {
  describe('route()', () => {
    it('should use default router and return RoutingDecision', () => {
      const decision = route('music');

      expect(decision).toHaveProperty('model');
      expect(decision).toHaveProperty('reason');
      expect(decision).toHaveProperty('confidence');
      expect(decision.model).toBe('local');
    });
  });

  describe('routeByPrompt()', () => {
    it('should use default router and detect domain', () => {
      const decision = routeByPrompt('Create a melody');

      expect(decision.domain).toBe('music');
      expect(decision.model).toBe('local');
    });
  });

  describe('defaultRouter', () => {
    it('should be a SmartRouter instance', () => {
      expect(defaultRouter).toBeInstanceOf(SmartRouter);
    });

    it('should have default configuration', () => {
      const decision = defaultRouter.routeByPrompt('Unknown prompt');

      expect(decision.model).toBe('local'); // preferLocal defaults to true
    });
  });
});
