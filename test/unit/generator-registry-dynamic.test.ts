import { describe, it, expect, beforeEach } from 'vitest';
/**
 * Tests for dynamic domain registration in GeneratorRegistry
 */

import { generatorRegistry, GeneratorEntry, DynamicDomainConfig } from '../../src/generators/GeneratorRegistry.js';

describe('GeneratorRegistry - Dynamic Domain Registration', () => {
  beforeEach(() => {
    // Clear registry before each test
    generatorRegistry.clear();
  });

  describe('registerDomain()', () => {
    it('should register a new domain with keywords', () => {
      const config: DynamicDomainConfig = {
        name: 'lyrics',
        keywords: ['lyrics', 'poem', 'song words', 'verse'],
        confidence: 0.8,
        generate: async (prompt: string) => {
          return `Generated lyrics for: ${prompt}`;
        },
      };

      generatorRegistry.registerDomain(config);

      expect(generatorRegistry.hasDomain('lyrics')).toBe(true);
      expect(generatorRegistry.getDynamicDomains()).toContain('lyrics');
    });

    it('should create a canHandle function that matches keywords', () => {
      const config: DynamicDomainConfig = {
        name: 'poetry',
        keywords: ['poem', 'haiku', 'sonnet', 'verse'],
        confidence: 0.7,
        generate: async (prompt: string) => `Poetry: ${prompt}`,
      };

      generatorRegistry.registerDomain(config);

      const allEntries = generatorRegistry.getAll();
      const poetryEntry = allEntries.find(e => e.name === 'poetry');

      expect(poetryEntry).not.toBeNull();
      expect(poetryEntry!.canHandle('write a haiku')).toBe(0.7);
      expect(poetryEntry!.canHandle('create a sonnet')).toBe(0.7);
      expect(poetryEntry!.canHandle('draw a picture')).toBe(0);
    });

    it('should dispatch to the dynamically registered domain', async () => {
      const config: DynamicDomainConfig = {
        name: 'joke',
        keywords: ['joke', 'funny', 'humor'],
        confidence: 0.9,
        generate: async (_prompt: string) => `Why did the chicken cross the road?`,
      };

      generatorRegistry.registerDomain(config);

      const dispatch = generatorRegistry.dispatch('tell me a joke');
      expect(dispatch).not.toBeNull();
      expect(dispatch!.entry.name).toBe('joke');
      expect(dispatch!.confidence).toBe(0.9);

      const result = await dispatch!.entry.generate('tell me a joke');
      expect(result).toContain('chicken');
    });

    it('should throw error when registering duplicate domain', () => {
      const config: DynamicDomainConfig = {
        name: 'test',
        keywords: ['test'],
        confidence: 0.5,
        generate: async (_prompt: string) => 'test',
      };

      generatorRegistry.registerDomain(config);

      expect(() => {
        generatorRegistry.registerDomain(config);
      }).toThrow("Domain 'test' is already registered");
    });

    it('should handle case-insensitive keyword matching', () => {
      const config: DynamicDomainConfig = {
        name: 'test',
        keywords: ['LyRiCs', 'PoEm'], // Mixed case
        confidence: 0.8,
        generate: async (_prompt: string) => 'result',
      };

      generatorRegistry.registerDomain(config);

      const entry = generatorRegistry.getAll().find(e => e.name === 'test');
      expect(entry!.canHandle('write lyrics')).toBe(0.8);
      expect(entry!.canHandle('WRITE A POEM')).toBe(0.8);
      expect(entry!.canHandle('something else')).toBe(0);
    });
  });

  describe('unregisterDomain()', () => {
    it('should remove a dynamically registered domain', () => {
      const config: DynamicDomainConfig = {
        name: 'temp',
        keywords: ['temp'],
        confidence: 0.5,
        generate: async (_prompt: string) => 'temp',
      };

      generatorRegistry.registerDomain(config);
      expect(generatorRegistry.hasDomain('temp')).toBe(true);

      const removed = generatorRegistry.unregisterDomain('temp');
      expect(removed).toBe(true);
      expect(generatorRegistry.hasDomain('temp')).toBe(false);
      expect(generatorRegistry.getDynamicDomains()).not.toContain('temp');
    });

    it('should return false when unregistering non-existent domain', () => {
      const result = generatorRegistry.unregisterDomain('nonexistent');
      expect(result).toBe(false);
    });

    it('should remove domain from dispatch', () => {
      const config: DynamicDomainConfig = {
        name: 'test',
        keywords: ['test'],
        confidence: 0.9,
        generate: async (_prompt: string) => 'test output',
      };

      generatorRegistry.registerDomain(config);

      let dispatch = generatorRegistry.dispatch('test prompt');
      expect(dispatch).not.toBeNull();

      generatorRegistry.unregisterDomain('test');

      dispatch = generatorRegistry.dispatch('test prompt');
      expect(dispatch).toBeNull();
    });
  });

  describe('hasDomain()', () => {
    it('should return true for dynamically registered domains', () => {
      const config: DynamicDomainConfig = {
        name: 'custom',
        keywords: ['custom'],
        confidence: 0.5,
        generate: async (_prompt: string) => 'custom',
      };

      expect(generatorRegistry.hasDomain('custom')).toBe(false);
      generatorRegistry.registerDomain(config);
      expect(generatorRegistry.hasDomain('custom')).toBe(true);
    });

    it('should work alongside built-in domains', () => {
      // Register a built-in style entry
      const builtInEntry: GeneratorEntry = {
        name: 'builtin',
        canHandle: () => 0.5,
        generate: async (_prompt: string) => 'builtin',
      };
      generatorRegistry.register(builtInEntry);

      const dynamicConfig: DynamicDomainConfig = {
        name: 'dynamic',
        keywords: ['dynamic'],
        confidence: 0.5,
        generate: async (_prompt: string) => 'dynamic',
      };
      generatorRegistry.registerDomain(dynamicConfig);

      expect(generatorRegistry.hasDomain('builtin')).toBe(true);
      expect(generatorRegistry.hasDomain('dynamic')).toBe(true);
    });
  });

  describe('getDynamicDomains()', () => {
    it('should return empty array when no dynamic domains', () => {
      expect(generatorRegistry.getDynamicDomains()).toEqual([]);
    });

    it('should return all dynamically registered domain names', () => {
      generatorRegistry.registerDomain({
        name: 'domain1',
        keywords: ['d1'],
        confidence: 0.5,
        generate: async (_prompt: string) => 'd1',
      });

      generatorRegistry.registerDomain({
        name: 'domain2',
        keywords: ['d2'],
        confidence: 0.5,
        generate: async (_prompt: string) => 'd2',
      });

      const domains = generatorRegistry.getDynamicDomains();
      expect(domains).toHaveLength(2);
      expect(domains).toContain('domain1');
      expect(domains).toContain('domain2');
    });

    it('should not include built-in domains', () => {
      const builtInEntry: GeneratorEntry = {
        name: 'builtin',
        canHandle: () => 0.5,
        generate: async (_prompt: string) => 'builtin',
      };
      generatorRegistry.register(builtInEntry);

      generatorRegistry.registerDomain({
        name: 'dynamic',
        keywords: ['dyn'],
        confidence: 0.5,
        generate: async (_prompt: string) => 'dyn',
      });

      const dynamicDomains = generatorRegistry.getDynamicDomains();
      expect(dynamicDomains).toContain('dynamic');
      expect(dynamicDomains).not.toContain('builtin');
    });
  });

  describe('clear()', () => {
    it('should clear both built-in and dynamic entries', () => {
      const builtInEntry: GeneratorEntry = {
        name: 'builtin',
        canHandle: () => 0.5,
        generate: async (_prompt: string) => 'builtin',
      };
      generatorRegistry.register(builtInEntry);

      generatorRegistry.registerDomain({
        name: 'dynamic',
        keywords: ['dyn'],
        confidence: 0.5,
        generate: async (_prompt: string) => 'dyn',
      });

      expect(generatorRegistry.getAll()).toHaveLength(2);
      expect(generatorRegistry.getDynamicDomains()).toHaveLength(1);

      generatorRegistry.clear();

      expect(generatorRegistry.getAll()).toHaveLength(0);
      expect(generatorRegistry.getDynamicDomains()).toHaveLength(0);
    });
  });

  describe('Smart routing integration', () => {
    it('should route to dynamic domain based on keywords', () => {
      generatorRegistry.registerDomain({
        name: 'lyrics',
        keywords: ['lyrics', 'poem', 'verse'],
        confidence: 0.8,
        generate: async (_prompt: string) => 'lyrics output',
      });

      const decision = generatorRegistry.routeByPrompt('write some lyrics');
      expect(decision.domain).toBe('lyrics');
    });

    it('should detect dynamic domains in routeByPrompt()', () => {
      generatorRegistry.registerDomain({
        name: 'jokes',
        keywords: ['joke', 'funny', 'humor'],
        confidence: 0.7,
        generate: async (_prompt: string) => 'joke output',
      });

      const decision1 = generatorRegistry.routeByPrompt('tell me a joke');
      expect(decision1.domain).toBe('jokes');

      const decision2 = generatorRegistry.routeByPrompt('something funny');
      expect(decision2.domain).toBe('jokes');
    });

    it('should unregister dynamic domain', () => {
      generatorRegistry.registerDomain({
        name: 'temp',
        keywords: ['temp'],
        confidence: 0.5,
        generate: async (_prompt: string) => 'temp output',
      });

      let decision = generatorRegistry.routeByPrompt('temp keyword');
      expect(decision.domain).toBe('temp');

      generatorRegistry.unregisterDomain('temp');

      decision = generatorRegistry.routeByPrompt('temp keyword');
      expect(decision.domain).toBeUndefined();
    });

    it('should return all domain keywords including dynamic', () => {
      generatorRegistry.registerDomain({
        name: 'custom1',
        keywords: ['kw1', 'kw2'],
        confidence: 0.5,
        generate: async (_prompt: string) => 'custom1',
      });
      generatorRegistry.registerDomain({
        name: 'custom2',
        keywords: ['kw3'],
        confidence: 0.5,
        generate: async (_prompt: string) => 'custom2',
      });

      const allKeywords = generatorRegistry.getAllDomainKeywords();

      expect(allKeywords.custom1).toEqual(['kw1', 'kw2']);
      expect(allKeywords.custom2).toEqual(['kw3']);
      expect(allKeywords.music).not.toBeNull(); // Built-in should still be there
    });

    it('should recognize dynamic domains in isDomainSupported()', () => {
      expect(generatorRegistry.isDomainSupported('music')).toBe(true); // Built-in
      expect(generatorRegistry.isDomainSupported('custom')).toBe(false); // Not registered yet

      generatorRegistry.registerDomain({
        name: 'custom',
        keywords: ['custom'],
        confidence: 0.5,
        generate: async (_prompt: string) => 'custom',
      });

      expect(generatorRegistry.isDomainSupported('custom')).toBe(true);
    });
  });

  describe('dispatch() with multiple domains', () => {
    it('should pick highest confidence domain when keywords overlap', () => {
      generatorRegistry.registerDomain({
        name: 'low',
        keywords: ['shared'],
        confidence: 0.5,
        generate: async (_prompt: string) => 'low',
      });

      generatorRegistry.registerDomain({
        name: 'high',
        keywords: ['shared'],
        confidence: 0.9,
        generate: async (_prompt: string) => 'high',
      });

      const dispatch = generatorRegistry.dispatch('shared keyword');
      expect(dispatch).not.toBeNull();
      expect(dispatch!.entry.name).toBe('high');
      expect(dispatch!.confidence).toBe(0.9);
    });

    it('should prioritize more specific keywords', () => {
      generatorRegistry.registerDomain({
        name: 'general',
        keywords: ['code', 'script'],
        confidence: 0.5,
        generate: async (_prompt: string) => 'general',
      });

      generatorRegistry.registerDomain({
        name: 'specific',
        keywords: ['python code', 'javascript script'],
        confidence: 0.8,
        generate: async (_prompt: string) => 'specific',
      });

      // "python code" should match specific with higher confidence
      const dispatch1 = generatorRegistry.dispatch('write python code');
      expect(dispatch1!.entry.name).toBe('specific');

      // Just "code" should match general
      const dispatch2 = generatorRegistry.dispatch('write some code');
      expect(dispatch2!.entry.name).toBe('general');
    });
  });
});
