import { describe, it, expect, beforeEach } from 'vitest';
import { generatorRegistry } from '../../../src/generators/GeneratorRegistry.js';
import type { DynamicDomainConfig } from '../../../src/generators/GeneratorRegistry.js';

describe('GeneratorRegistry', () => {
  beforeEach(() => {
    generatorRegistry.clear();
  });

  // ─── register / dispatch / getAll ────────────────────────────────────────

  describe('register + dispatch', () => {
    it('dispatches to highest-confidence generator', () => {
      generatorRegistry.register({
        name: 'low',
        canHandle: () => 0.3,
        generate: () => 'low result',
      });
      generatorRegistry.register({
        name: 'high',
        canHandle: () => 0.9,
        generate: () => 'high result',
      });

      const result = generatorRegistry.dispatch('anything');
      expect(result).not.toBeNull();
      expect(result!.entry.name).toBe('high');
      expect(result!.confidence).toBe(0.9);
    });

    it('returns null when no generator can handle', () => {
      generatorRegistry.register({
        name: 'none',
        canHandle: () => 0,
        generate: () => 'none',
      });

      expect(generatorRegistry.dispatch('test')).toBeNull();
    });

    it('dispatches first entry when multiple have same confidence', () => {
      generatorRegistry.register({ name: 'first', canHandle: () => 0.5, generate: () => 'a' });
      generatorRegistry.register({ name: 'second', canHandle: () => 0.5, generate: () => 'b' });

      const result = generatorRegistry.dispatch('test');
      expect(result!.entry.name).toBe('first');
    });

    it('getAll returns all registered entries', () => {
      generatorRegistry.register({ name: 'a', canHandle: () => 0.5, generate: () => 'a' });
      generatorRegistry.register({ name: 'b', canHandle: () => 0.5, generate: () => 'b' });

      expect(generatorRegistry.getAll()).toHaveLength(2);
    });
  });

  // ─── clear ───────────────────────────────────────────────────────────────

  describe('clear', () => {
    it('removes all entries and dynamic domains', () => {
      generatorRegistry.register({ name: 'a', canHandle: () => 0.5, generate: () => 'a' });
      generatorRegistry.registerDomain({ name: 'lyrics', keywords: ['lyrics'], confidence: 0.8, generate: () => 'lyrics' });

      generatorRegistry.clear();

      expect(generatorRegistry.getAll()).toHaveLength(0);
      expect(generatorRegistry.getDynamicDomains()).toEqual([]);
    });
  });

  // ─── Dynamic domain registration ─────────────────────────────────────────

  describe('registerDomain', () => {
    it('registers a dynamic domain that dispatches by keyword', () => {
      generatorRegistry.registerDomain({
        name: 'lyrics',
        keywords: ['lyrics', 'poem', 'verse'],
        confidence: 0.8,
        generate: () => 'generated lyrics',
      });

      const result = generatorRegistry.dispatch('write me some lyrics');
      expect(result).not.toBeNull();
      expect(result!.entry.name).toBe('lyrics');
      expect(result!.confidence).toBe(0.8);
    });

    it('returns null when no keywords match', () => {
      generatorRegistry.registerDomain({
        name: 'poetry',
        keywords: ['poem', 'haiku'],
        confidence: 0.9,
        generate: () => 'poem',
      });

      const result = generatorRegistry.dispatch('draw a circle');
      expect(result).toBeNull();
    });

    it('throws when registering duplicate domain name', () => {
      generatorRegistry.registerDomain({ name: 'test', keywords: ['test'], confidence: 0.5, generate: () => 't' });

      expect(() => {
        generatorRegistry.registerDomain({ name: 'test', keywords: ['other'], confidence: 0.7, generate: () => 't2' });
      }).toThrow("Domain 'test' is already registered");
    });

    it('case-insensitive keyword matching', () => {
      generatorRegistry.registerDomain({
        name: 'lyrics',
        keywords: ['Lyrics'],
        confidence: 0.8,
        generate: () => 'lyrics',
      });

      const result = generatorRegistry.dispatch('WRITE LYRICS NOW');
      expect(result).not.toBeNull();
      expect(result!.entry.name).toBe('lyrics');
    });

    it('generate wraps object result with code property', async () => {
      generatorRegistry.registerDomain({
        name: 'structured',
        keywords: ['structured'],
        confidence: 0.8,
        generate: () => ({ code: 'structured output' } as any),
      });

      const dispatchResult = generatorRegistry.dispatch('structured request');
      const generated = await dispatchResult!.entry.generate('structured request');
      expect(generated).toBe('structured output');
    });

    it('generate returns string result as-is', async () => {
      generatorRegistry.registerDomain({
        name: 'plain',
        keywords: ['plain'],
        confidence: 0.8,
        generate: () => 'plain string',
      });

      const dispatchResult = generatorRegistry.dispatch('plain request');
      const generated = await dispatchResult!.entry.generate('plain request');
      expect(generated).toBe('plain string');
    });
  });

  // ─── unregisterDomain ────────────────────────────────────────────────────

  describe('unregisterDomain', () => {
    it('removes a dynamic domain', () => {
      generatorRegistry.registerDomain({ name: 'temp', keywords: ['temp'], confidence: 0.5, generate: () => 't' });

      expect(generatorRegistry.unregisterDomain('temp')).toBe(true);
      expect(generatorRegistry.getDynamicDomains()).toEqual([]);
    });

    it('returns false for non-existent domain', () => {
      expect(generatorRegistry.unregisterDomain('nonexistent')).toBe(false);
    });

    it('removed domain no longer dispatches', () => {
      generatorRegistry.registerDomain({ name: 'temp', keywords: ['temp'], confidence: 0.9, generate: () => 't' });
      generatorRegistry.unregisterDomain('temp');

      expect(generatorRegistry.dispatch('temp request')).toBeNull();
    });
  });

  // ─── hasDomain ───────────────────────────────────────────────────────────

  describe('hasDomain', () => {
    it('finds registered entry by name', () => {
      generatorRegistry.register({ name: 'p5', canHandle: () => 0.5, generate: () => 'p5 code' });
      expect(generatorRegistry.hasDomain('p5')).toBe(true);
    });

    it('does not find unregistered domain', () => {
      expect(generatorRegistry.hasDomain('missing')).toBe(false);
    });

    it('finds dynamically registered domain', () => {
      generatorRegistry.registerDomain({ name: 'custom', keywords: ['custom'], confidence: 0.5, generate: () => 'c' });
      expect(generatorRegistry.hasDomain('custom')).toBe(true);
    });
  });

  // ─── getKeywordsForDomain / getDynamicDomains ───────────────────────────

  describe('dynamic keyword management', () => {
    it('getDynamicKeywords returns map of all dynamic domain keywords', () => {
      generatorRegistry.registerDomain({ name: 'a', keywords: ['x', 'y'], confidence: 0.5, generate: () => 'a' });
      generatorRegistry.registerDomain({ name: 'b', keywords: ['z'], confidence: 0.5, generate: () => 'b' });

      const kw = generatorRegistry.getDynamicKeywords();
      expect(kw.get('a')).toEqual(['x', 'y']);
      expect(kw.get('b')).toEqual(['z']);
    });

    it('getKeywordsForDomain returns keywords for specific domain', () => {
      generatorRegistry.registerDomain({ name: 'poetry', keywords: ['haiku', 'sonnet'], confidence: 0.5, generate: () => 'p' });

      expect(generatorRegistry.getKeywordsForDomain('poetry')).toEqual(['haiku', 'sonnet']);
    });

    it('getKeywordsForDomain returns undefined for unknown domain', () => {
      expect(generatorRegistry.getKeywordsForDomain('missing')).toBeUndefined();
    });

    it('getDynamicDomains returns list of dynamic domain names', () => {
      generatorRegistry.registerDomain({ name: 'a', keywords: ['a'], confidence: 0.5, generate: () => 'a' });
      generatorRegistry.registerDomain({ name: 'b', keywords: ['b'], confidence: 0.5, generate: () => 'b' });

      expect(generatorRegistry.getDynamicDomains()).toEqual(['a', 'b']);
    });
  });

  // ─── DNA registry ────────────────────────────────────────────────────────

  describe('DNA registry', () => {
    const mockDNA = { domain: 'p5', patterns: [], colorPalette: [] } as any;

    it('registerDNA stores DNA for a domain', () => {
      generatorRegistry.registerDNA(mockDNA);
      expect(generatorRegistry.getDNA('p5')).toBe(mockDNA);
    });

    it('getDNA returns undefined for unknown domain', () => {
      expect(generatorRegistry.getDNA('unknown')).toBeUndefined();
    });

    it('getAllDNA returns a copy of the registry', () => {
      generatorRegistry.registerDNA(mockDNA);
      const all = generatorRegistry.getAllDNA();
      expect(all.get('p5')).toBe(mockDNA);
      expect(all).not.toBe(generatorRegistry.getAllDNA());
    });
  });

  // ─── Smart routing ──────────────────────────────────────────────────────

  describe('route', () => {
    it('routes music to local (per A/B data)', () => {
      const decision = generatorRegistry.route('music');
      expect(decision.model).toBe('local');
      expect(decision.confidence).toBeGreaterThanOrEqual(0.75);
      expect(decision.domain).toBe('music');
    });

    it('routes ascii to cloud (per A/B data)', () => {
      const decision = generatorRegistry.route('ascii');
      expect(decision.model).toBe('cloud');
      expect(decision.confidence).toBeGreaterThanOrEqual(0.8);
    });

    it('falls back for unknown domain using preferLocal', () => {
      const decision = generatorRegistry.route('unknown' as any);
      expect(decision.model).toBe('local');
      expect(decision.confidence).toBe(0.6);
    });

    it('switches to local when preferLocal and fitness gap < 5%', () => {
      // code domain: local=0.503, cloud=0.460, optimalModel='local'
      const decision = generatorRegistry.route('code');
      expect(decision.model).toBe('local');
    });

    it('uses hybrid for complex task with fallbackToHybrid and low confidence', () => {
      generatorRegistry.setRoutingConfig({ fallbackToHybrid: true, minConfidence: 0.9 });
      const decision = generatorRegistry.route('code', 'complex');
      expect(decision.model).toBe('hybrid');
    });

    it('does not use hybrid for non-complex task', () => {
      generatorRegistry.setRoutingConfig({ fallbackToHybrid: true, minConfidence: 0.9 });
      const decision = generatorRegistry.route('code', 'simple');
      expect(decision.model).not.toBe('hybrid');
    });

    it('includes local and cloud fitness in decision', () => {
      const decision = generatorRegistry.route('music');
      expect(decision.localFitness).toBe(0.523);
      expect(decision.cloudFitness).toBe(0.236);
    });

    it('reason string describes the routing choice', () => {
      const decision = generatorRegistry.route('music');
      expect(decision.reason).toContain('Music');
      expect(decision.reason).toContain('0.523');
    });
  });

  // ─── routeByPrompt ──────────────────────────────────────────────────────

  describe('routeByPrompt', () => {
    it('detects domain and routes accordingly', () => {
      const decision = generatorRegistry.routeByPrompt('create a music beat');
      expect(decision.model).toBeDefined();
      expect(decision.confidence).toBeGreaterThan(0);
    });

    it('falls back when domain is unknown', () => {
      const decision = generatorRegistry.routeByPrompt('make something completely ambiguous xyzzy');
      expect(decision.confidence).toBe(0.3);
      expect(decision.reason).toContain('Unknown domain');
    });
  });

  // ─── detectDomain ───────────────────────────────────────────────────────

  describe('detectDomain', () => {
    it('detects music from keywords', () => {
      expect(generatorRegistry.detectDomain('play a melody')).toBe('music');
    });

    it('detects ascii from keywords', () => {
      expect(generatorRegistry.detectDomain('draw ascii art')).toBe('ascii');
    });

    it('detects code from keywords', () => {
      expect(generatorRegistry.detectDomain('generate a fractal algorithm')).toBe('code');
    });

    it('detects visual from keywords', () => {
      expect(generatorRegistry.detectDomain('create a 3d render')).toBe('visual');
    });

    it('detects html from keywords', () => {
      expect(generatorRegistry.detectDomain('build a web page with css')).toBe('html');
    });

    it('returns undefined for unrecognized prompt', () => {
      expect(generatorRegistry.detectDomain('make a sandwich')).toBeUndefined();
    });

    it('detects dynamic domain keywords', () => {
      generatorRegistry.registerDomain({ name: 'custom', keywords: ['custom-keyword'], confidence: 0.5, generate: () => 'c' });
      expect(generatorRegistry.detectDomain('use custom-keyword now')).toBe('custom');
    });
  });

  // ─── getAllDomainKeywords ────────────────────────────────────────────────

  describe('getAllDomainKeywords', () => {
    it('includes built-in domain keywords', () => {
      const kw = generatorRegistry.getAllDomainKeywords();
      expect(kw.music).toBeDefined();
      expect(kw.music.length).toBeGreaterThan(0);
    });

    it('includes dynamic domain keywords', () => {
      generatorRegistry.registerDomain({ name: 'poetry', keywords: ['haiku', 'verse'], confidence: 0.5, generate: () => 'p' });
      const kw = generatorRegistry.getAllDomainKeywords();
      expect(kw.poetry).toEqual(['haiku', 'verse']);
    });
  });

  // ─── isDomainSupported ──────────────────────────────────────────────────

  describe('isDomainSupported', () => {
    it('returns true for built-in domains', () => {
      expect(generatorRegistry.isDomainSupported('music')).toBe(true);
      expect(generatorRegistry.isDomainSupported('ascii')).toBe(true);
    });

    it('returns true for dynamically registered domains', () => {
      generatorRegistry.registerDomain({ name: 'custom', keywords: ['c'], confidence: 0.5, generate: () => 'c' });
      expect(generatorRegistry.isDomainSupported('custom')).toBe(true);
    });

    it('returns false for unknown domain', () => {
      expect(generatorRegistry.isDomainSupported('nonexistent')).toBe(false);
    });
  });

  // ─── getRoutingStats ────────────────────────────────────────────────────

  describe('getRoutingStats', () => {
    it('returns routing stats with correct structure', () => {
      const stats = generatorRegistry.getRoutingStats();
      expect(stats.overallLocalFitness).toBe(0.463);
      expect(stats.overallCloudFitness).toBe(0.409);
      expect(stats.domains.music.winner).toBe('local');
      expect(stats.domains.ascii.winner).toBe('cloud');
    });
  });

  // ─── setRoutingConfig ───────────────────────────────────────────────────

  describe('setRoutingConfig', () => {
    it('merges config with defaults', () => {
      generatorRegistry.setRoutingConfig({ preferLocal: false });
      const decision = generatorRegistry.route('unknown' as any);
      expect(decision.model).toBe('cloud');
    });

    it('preserves unoverridden config fields', () => {
      generatorRegistry.setRoutingConfig({ preferLocal: true, fallbackToHybrid: true });
      const decision = generatorRegistry.route('unknown' as any);
      expect(decision.model).toBe('local');
    });
  });
});
