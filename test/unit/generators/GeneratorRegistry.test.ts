import { describe, it, expect, vi, beforeEach } from 'vitest';

// GeneratorRegistry imports RoutingData at module level, so we must mock it first
vi.mock('../../../src/routing/RoutingData.js', () => {
  const AB_TEST_RESULTS = {
    ascii: { local: 0.363, cloud: 0.531, hybrid: 0.470 },
    music: { local: 0.523, cloud: 0.236, hybrid: 0.481 },
    code: { local: 0.503, cloud: 0.460, hybrid: 0.413 },
    visual: { local: 0.400, cloud: 0.550, hybrid: 0.475 },
    remotion: { local: 0.400, cloud: 0.550, hybrid: 0.475 },
    html: { local: 0.450, cloud: 0.520, hybrid: 0.485 },
    webdev: { local: 0.450, cloud: 0.520, hybrid: 0.485 },
  };

  const DOMAIN_ROUTING_DATA = {
    html: { optimalModel: 'cloud', confidence: 0.80, advantage: '+16%', localFitness: 0.450, cloudFitness: 0.520 },
    webdev: { optimalModel: 'cloud', confidence: 0.80, advantage: '+16%', localFitness: 0.450, cloudFitness: 0.520 },
    music: { optimalModel: 'local', confidence: 0.95, advantage: '+121%', localFitness: 0.523, cloudFitness: 0.236 },
    code: { optimalModel: 'local', confidence: 0.75, advantage: '+9%', localFitness: 0.503, cloudFitness: 0.460 },
    ascii: { optimalModel: 'cloud', confidence: 0.85, advantage: '+46%', localFitness: 0.363, cloudFitness: 0.531 },
    visual: { optimalModel: 'cloud', confidence: 0.80, advantage: '+38%', localFitness: 0.400, cloudFitness: 0.550 },
    remotion: { optimalModel: 'cloud', confidence: 0.70, advantage: '+38%', localFitness: 0.400, cloudFitness: 0.550 },
  };

  const OVERALL_FITNESS = { local: 0.463, cloud: 0.409, hybrid: 0.447 };

  const DOMAIN_KEYWORDS = {
    music: ['music', 'song', 'melody'],
    ascii: ['ascii', 'art', 'draw'],
    code: ['code', 'function', 'algorithm'],
    visual: ['visual', 'image', 'graphic'],
    remotion: ['remotion', 'video', 'motion graphics'],
    html: ['html', 'web page', 'css'],
    webdev: ['web app', 'dashboard', 'portfolio'],
  };

  return {
    AB_TEST_RESULTS,
    DOMAIN_ROUTING_DATA,
    OVERALL_FITNESS,
    DOMAIN_KEYWORDS,
    recordRoutingOutcome: vi.fn(),
    getOptimalModelBandit: vi.fn().mockReturnValue(null),
    getBanditStats: vi.fn().mockReturnValue(null),
  };
});

import { generatorRegistry } from '../../../src/generators/GeneratorRegistry.js';
import type { GeneratorEntry, DynamicDomainConfig } from '../../../src/generators/GeneratorRegistry.js';

describe('GeneratorRegistry', () => {
  beforeEach(() => {
    generatorRegistry.clear();
  });

  // --- register / dispatch ---

  describe('register and dispatch', () => {
    it('dispatches to the highest-confidence generator', () => {
      const lowEntry: GeneratorEntry = {
        name: 'low',
        canHandle: () => 0.3,
        generate: async () => 'low result',
      };
      const highEntry: GeneratorEntry = {
        name: 'high',
        canHandle: () => 0.8,
        generate: async () => 'high result',
      };
      generatorRegistry.register(lowEntry);
      generatorRegistry.register(highEntry);

      const result = generatorRegistry.dispatch('test prompt');
      expect(result).not.toBeNull();
      expect(result!.entry.name).toBe('high');
      expect(result!.confidence).toBe(0.8);
    });

    it('returns null when no generator can handle the prompt', () => {
      const entry: GeneratorEntry = {
        name: 'never',
        canHandle: () => 0,
        generate: async () => 'never called',
      };
      generatorRegistry.register(entry);

      const result = generatorRegistry.dispatch('anything');
      expect(result).toBeNull();
    });

    it('dispatches using prompt-based canHandle logic', () => {
      const shaderEntry: GeneratorEntry = {
        name: 'shader',
        canHandle: (prompt: string) => /glsl|shader/.test(prompt.toLowerCase()) ? 0.7 : 0,
        generate: async () => 'shader code',
      };
      generatorRegistry.register(shaderEntry);

      const match = generatorRegistry.dispatch('create a GLSL shader');
      expect(match).not.toBeNull();
      expect(match!.entry.name).toBe('shader');

      const noMatch = generatorRegistry.dispatch('draw a circle');
      expect(noMatch).toBeNull();
    });
  });

  // --- registerDomain / unregisterDomain ---

  describe('registerDomain', () => {
    it('registers a new domain with keyword-based canHandle', () => {
      const config: DynamicDomainConfig = {
        name: 'lyrics',
        keywords: ['lyrics', 'poem', 'verse'],
        confidence: 0.8,
        generate: async (prompt) => `generated lyrics for: ${prompt}`,
      };
      generatorRegistry.registerDomain(config);

      const result = generatorRegistry.dispatch('write me some lyrics');
      expect(result).not.toBeNull();
      expect(result!.entry.name).toBe('lyrics');
      expect(result!.confidence).toBe(0.8);
    });

    it('throws when registering a duplicate domain name', () => {
      const config: DynamicDomainConfig = {
        name: 'poetry',
        keywords: ['poem'],
        confidence: 0.7,
        generate: async () => 'poem output',
      };
      generatorRegistry.registerDomain(config);

      expect(() => generatorRegistry.registerDomain(config)).toThrow(
        "Domain 'poetry' is already registered"
      );
    });

    it('generate returns string for string-returning generators', async () => {
      const config: DynamicDomainConfig = {
        name: 'custom',
        keywords: ['custom keyword'],
        confidence: 0.9,
        generate: async () => 'custom output',
      };
      generatorRegistry.registerDomain(config);

      const dispatched = generatorRegistry.dispatch('custom keyword test');
      const result = await dispatched!.entry.generate('test');
      expect(result).toBe('custom output');
    });

    it('generate extracts code property from object-returning generators', async () => {
      const config: DynamicDomainConfig = {
        name: 'code-gen',
        keywords: ['code-gen keyword'],
        confidence: 0.9,
        generate: async () => ({ code: 'const x = 1;', language: 'js' }) as any,
      };
      generatorRegistry.registerDomain(config);

      const dispatched = generatorRegistry.dispatch('code-gen keyword test');
      const result = await dispatched!.entry.generate('test');
      expect(result).toBe('const x = 1;');
    });
  });

  describe('unregisterDomain', () => {
    it('removes a dynamically registered domain', () => {
      const config: DynamicDomainConfig = {
        name: 'temp',
        keywords: ['temp keyword'],
        confidence: 0.6,
        generate: async () => 'temp output',
      };
      generatorRegistry.registerDomain(config);
      expect(generatorRegistry.hasDomain('temp')).toBe(true);

      const removed = generatorRegistry.unregisterDomain('temp');
      expect(removed).toBe(true);
      expect(generatorRegistry.hasDomain('temp')).toBe(false);
    });

    it('returns false for non-existent domain', () => {
      const removed = generatorRegistry.unregisterDomain('nonexistent');
      expect(removed).toBe(false);
    });

    it('removes domain from dispatch after unregister', () => {
      const config: DynamicDomainConfig = {
        name: 'ephemeral',
        keywords: ['ephemeral keyword'],
        confidence: 0.9,
        generate: async () => 'ephemeral output',
      };
      generatorRegistry.registerDomain(config);

      expect(generatorRegistry.dispatch('ephemeral keyword test')).not.toBeNull();
      generatorRegistry.unregisterDomain('ephemeral');
      expect(generatorRegistry.dispatch('ephemeral keyword test')).toBeNull();
    });
  });

  // --- hasDomain / getDynamicKeywords / getDynamicDomains ---

  describe('hasDomain', () => {
    it('returns true for a registered entry', () => {
      generatorRegistry.register({
        name: 'test-domain',
        canHandle: () => 0.5,
        generate: async () => 'test',
      });
      expect(generatorRegistry.hasDomain('test-domain')).toBe(true);
    });

    it('returns false for unregistered domain', () => {
      expect(generatorRegistry.hasDomain('no-such-domain')).toBe(false);
    });
  });

  describe('getDynamicKeywords', () => {
    it('returns keywords for dynamically registered domains', () => {
      generatorRegistry.registerDomain({
        name: 'haiku',
        keywords: ['haiku', '5-7-5'],
        confidence: 0.7,
        generate: async () => 'haiku output',
      });

      const keywords = generatorRegistry.getDynamicKeywords();
      expect(keywords.get('haiku')).toEqual(['haiku', '5-7-5']);
    });

    it('returns empty map when no dynamic domains registered', () => {
      const keywords = generatorRegistry.getDynamicKeywords();
      expect(keywords.size).toBe(0);
    });
  });

  describe('getKeywordsForDomain', () => {
    it('returns keywords for a specific dynamic domain', () => {
      generatorRegistry.registerDomain({
        name: 'sonnet',
        keywords: ['sonnet', '14 lines'],
        confidence: 0.75,
        generate: async () => 'sonnet output',
      });
      expect(generatorRegistry.getKeywordsForDomain('sonnet')).toEqual(['sonnet', '14 lines']);
    });

    it('returns undefined for unknown domain', () => {
      expect(generatorRegistry.getKeywordsForDomain('unknown')).toBeUndefined();
    });
  });

  describe('getDynamicDomains', () => {
    it('lists names of dynamically registered domains', () => {
      generatorRegistry.registerDomain({
        name: 'domain-a',
        keywords: ['a'],
        confidence: 0.5,
        generate: async () => 'a',
      });
      generatorRegistry.registerDomain({
        name: 'domain-b',
        keywords: ['b'],
        confidence: 0.5,
        generate: async () => 'b',
      });

      const domains = generatorRegistry.getDynamicDomains();
      expect(domains).toContain('domain-a');
      expect(domains).toContain('domain-b');
    });
  });

  // --- DNA registry ---

  describe('registerDNA / getDNA / getAllDNA', () => {
    it('stores and retrieves DNA by domain', () => {
      const dna = { domain: 'test-dna', features: [] } as any;
      generatorRegistry.registerDNA(dna);
      expect(generatorRegistry.getDNA('test-dna')).toBe(dna);
    });

    it('returns undefined for unregistered DNA domain', () => {
      expect(generatorRegistry.getDNA('no-such-dna')).toBeUndefined();
    });

    it('getAllDNA returns a copy of the DNA registry', () => {
      const dna = { domain: 'my-dna', features: [] } as any;
      generatorRegistry.registerDNA(dna);
      const allDna = generatorRegistry.getAllDNA();
      expect(allDna.get('my-dna')).toBe(dna);
      // Mutations to the returned map should not affect the registry
      allDna.delete('my-dna');
      expect(generatorRegistry.getDNA('my-dna')).toBe(dna);
    });
  });

  // --- clear ---

  describe('clear', () => {
    it('removes all entries and dynamic domains', () => {
      generatorRegistry.register({
        name: 'static-entry',
        canHandle: () => 0.5,
        generate: async () => 'result',
      });
      generatorRegistry.registerDomain({
        name: 'dynamic-entry',
        keywords: ['dynamic'],
        confidence: 0.6,
        generate: async () => 'dynamic result',
      });

      generatorRegistry.clear();
      expect(generatorRegistry.getAll().length).toBe(0);
      expect(generatorRegistry.getDynamicDomains().length).toBe(0);
      expect(generatorRegistry.dispatch('dynamic')).toBeNull();
    });
  });

  // --- Smart routing ---

  describe('route', () => {
    it('routes music domain to local model (A/B test winner)', () => {
      const decision = generatorRegistry.route('music');
      expect(decision.model).toBe('local');
      expect(decision.confidence).toBe(0.95);
      expect(decision.domain).toBe('music');
      expect(decision.localFitness).toBe(0.523);
      expect(decision.cloudFitness).toBe(0.236);
    });

    it('routes ascii domain to cloud model (A/B test winner)', () => {
      const decision = generatorRegistry.route('ascii');
      expect(decision.model).toBe('cloud');
      expect(decision.confidence).toBe(0.85);
    });

    it('falls back for unknown domain using preferLocal=true', () => {
      generatorRegistry.setRoutingConfig({ preferLocal: true });
      const decision = generatorRegistry.route('unknown-domain' as any);
      expect(decision.model).toBe('local');
      expect(decision.confidence).toBe(0.6);
    });

    it('falls back for unknown domain using preferLocal=false', () => {
      generatorRegistry.setRoutingConfig({ preferLocal: false });
      const decision = generatorRegistry.route('unknown-domain' as any);
      expect(decision.model).toBe('cloud');
    });

    it('prefers local when cloud/local difference is small and preferLocal is set', () => {
      // code domain: local 0.503, cloud 0.460 — small difference, cloud wins raw
      // but with preferLocal=true and small pctDiff, should flip to local
      generatorRegistry.setRoutingConfig({ preferLocal: true });
      const decision = generatorRegistry.route('code');
      // The raw data has code: optimalModel='local', so this should stay local
      expect(decision.model).toBe('local');
    });

    it('switches to hybrid for complex tasks with low confidence when fallbackToHybrid=true', () => {
      generatorRegistry.setRoutingConfig({
        preferLocal: false,
        fallbackToHybrid: true,
        minConfidence: 0.8,
      });
      // remotion has confidence 0.70, which is below 0.8
      const decision = generatorRegistry.route('remotion', 'complex');
      expect(decision.model).toBe('hybrid');
      expect(decision.confidence).toBe(0.65);
    });

    it('does not switch to hybrid for non-complex tasks', () => {
      generatorRegistry.setRoutingConfig({
        preferLocal: false,
        fallbackToHybrid: true,
        minConfidence: 0.8,
      });
      const decision = generatorRegistry.route('remotion', 'simple');
      expect(decision.model).toBe('cloud');
    });
  });

  describe('routeByPrompt', () => {
    it('detects domain from prompt and routes accordingly', () => {
      const decision = generatorRegistry.routeByPrompt('create a music beat');
      expect(decision.domain).toBe('music');
      expect(decision.model).toBe('local');
    });

    it('detects HTML domain from prompt', () => {
      const decision = generatorRegistry.routeByPrompt('build an html landing page');
      expect(decision.domain).toBe('html');
    });

    it('returns default for unrecognized prompt with preferLocal=true', () => {
      generatorRegistry.setRoutingConfig({ preferLocal: true });
      const decision = generatorRegistry.routeByPrompt('random gibberish xyz');
      expect(decision.model).toBe('local');
      expect(decision.confidence).toBe(0.3);
    });

    it('returns cloud default for unrecognized prompt with preferLocal=false', () => {
      generatorRegistry.setRoutingConfig({ preferLocal: false });
      const decision = generatorRegistry.routeByPrompt('random gibberish xyz');
      expect(decision.model).toBe('cloud');
    });
  });

  describe('detectDomain', () => {
    it('detects music domain from keywords', () => {
      expect(generatorRegistry.detectDomain('play a melody')).toBe('music');
    });

    it('detects ascii domain from keywords', () => {
      expect(generatorRegistry.detectDomain('draw ascii art')).toBe('ascii');
    });

    it('returns undefined for unrecognized prompts', () => {
      expect(generatorRegistry.detectDomain('gibberish xyz plugh')).toBeUndefined();
    });

    it('detects dynamic domain keywords', () => {
      generatorRegistry.registerDomain({
        name: 'lyrics',
        keywords: ['lyrics', 'verse'],
        confidence: 0.7,
        generate: async () => 'lyrics',
      });
      expect(generatorRegistry.detectDomain('write some lyrics')).toBe('lyrics');
    });
  });

  describe('isDomainSupported', () => {
    it('returns true for built-in domains', () => {
      expect(generatorRegistry.isDomainSupported('music')).toBe(true);
      expect(generatorRegistry.isDomainSupported('ascii')).toBe(true);
    });

    it('returns true for dynamic domains', () => {
      generatorRegistry.registerDomain({
        name: 'custom-domain',
        keywords: ['custom'],
        confidence: 0.5,
        generate: async () => 'custom',
      });
      expect(generatorRegistry.isDomainSupported('custom-domain')).toBe(true);
    });

    it('returns false for unsupported domains', () => {
      expect(generatorRegistry.isDomainSupported('nonexistent')).toBe(false);
    });
  });

  describe('getAllDomainKeywords', () => {
    it('merges built-in and dynamic keywords', () => {
      generatorRegistry.registerDomain({
        name: 'limerick',
        keywords: ['limerick', 'nantucket'],
        confidence: 0.5,
        generate: async () => 'limerick',
      });

      const all = generatorRegistry.getAllDomainKeywords();
      expect(all.music).toBeDefined();
      expect(all.limerick).toEqual(['limerick', 'nantucket']);
    });
  });

  describe('getRoutingStats', () => {
    it('returns complete routing statistics', () => {
      const stats = generatorRegistry.getRoutingStats();
      expect(stats.overallLocalFitness).toBe(0.463);
      expect(stats.overallCloudFitness).toBe(0.409);
      expect(stats.abTestResults.music.local).toBe(0.523);
      expect(stats.domains.music.winner).toBe('local');
      expect(stats.domains.music.advantage).toBe('+121%');
    });
  });

  describe('getAll', () => {
    it('returns all registered entries', () => {
      generatorRegistry.register({
        name: 'entry-1',
        canHandle: () => 0.5,
        generate: async () => 'result',
      });
      generatorRegistry.register({
        name: 'entry-2',
        canHandle: () => 0.7,
        generate: async () => 'result',
      });

      const all = generatorRegistry.getAll();
      expect(all.length).toBe(2);
      expect(all[0].name).toBe('entry-1');
      expect(all[1].name).toBe('entry-2');
    });
  });
});
