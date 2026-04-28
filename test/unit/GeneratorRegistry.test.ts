import { describe, it, expect, beforeEach } from 'vitest';
/**
 * GeneratorRegistry unit tests
 */

import { generatorRegistry } from '../../src/generators/GeneratorRegistry.js';
import type { ProjectDNA } from '../../src/scavenger/types.js';

describe('GeneratorRegistry', () => {
  beforeEach(() => {
    generatorRegistry.clear();
  });

  describe('register', () => {
    it('should register a generator entry', () => {
      generatorRegistry.register({
        name: 'test',
        canHandle: () => 0.8,
        generate: () => 'test output',
      });
      const result = generatorRegistry.dispatch('anything');
      expect(result).not.toBeNull();
      expect(result!.entry.name).toBe('test');
    });

    it('should pick highest confidence generator', () => {
      generatorRegistry.register({
        name: 'low',
        canHandle: () => 0.3,
        generate: () => 'low',
      });
      generatorRegistry.register({
        name: 'high',
        canHandle: () => 0.9,
        generate: () => 'high',
      });
      const result = generatorRegistry.dispatch('anything');
      expect(result!.entry.name).toBe('high');
    });
  });

  describe('dispatch', () => {
    it('should return null when no generator matches', () => {
      const result = generatorRegistry.dispatch('unmatched prompt');
      expect(result).toBeNull();
    });

    it('should skip zero-confidence generators', () => {
      generatorRegistry.register({
        name: 'never',
        canHandle: () => 0,
        generate: () => 'should not run',
      });
      generatorRegistry.register({
        name: 'sometimes',
        canHandle: () => 0.5,
        generate: () => 'sometimes output',
      });
      const result = generatorRegistry.dispatch('test');
      expect(result!.entry.name).toBe('sometimes');
    });
  });

  describe('registerDomain', () => {
    it('should register a domain with keyword matching', () => {
      generatorRegistry.registerDomain({
        name: 'shader',
        keywords: ['shader', 'glsl', 'fragment'],
        confidence: 0.8,
        generate: () => 'shader code',
      });
      const result = generatorRegistry.dispatch('create a shader effect');
      expect(result).not.toBeNull();
      expect(result!.entry.name).toBe('shader');
    });

    it('should not match when keywords absent', () => {
      generatorRegistry.registerDomain({
        name: 'shader',
        keywords: ['shader', 'glsl', 'fragment'],
        confidence: 0.8,
        generate: () => 'shader code',
      });
      const result = generatorRegistry.dispatch('draw a circle');
      expect(result).toBeNull();
    });

    it('should throw on duplicate domain name', () => {
      generatorRegistry.registerDomain({
        name: 'dupe',
        keywords: ['test'],
        confidence: 0.8,
        generate: () => '',
      });
      expect(() => {
        generatorRegistry.registerDomain({
          name: 'dupe',
          keywords: ['other'],
          confidence: 0.8,
          generate: () => '',
        });
      }).toThrow('already registered');
    });
  });

  describe('unregisterDomain', () => {
    it('should remove a domain', () => {
      generatorRegistry.registerDomain({
        name: 'temp',
        keywords: ['temp'],
        confidence: 0.8,
        generate: () => '',
      });
      expect(generatorRegistry.unregisterDomain('temp')).toBe(true);
      expect(generatorRegistry.hasDomain('temp')).toBe(false);
    });

    it('should return false for non-existent domain', () => {
      expect(generatorRegistry.unregisterDomain('ghost')).toBe(false);
    });
  });

  describe('DNA registry', () => {
    beforeEach(() => {
      // clear() doesn't reset DNA, so clean up manually
      for (const key of generatorRegistry.getAllDNA().keys()) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (generatorRegistry as any).dnaRegistry.delete(key);
      }
    });

    it('should register and retrieve DNA', () => {
      const dna: ProjectDNA = {
        name: 'test',
        domain: 'generative-art',
        coreLogic: 'test logic',
        constraints: [],
        patterns: [],
        prompts: [],
        extractedAt: '2026-01-01',
        sourcePath: '/tmp/test',
      };
      generatorRegistry.registerDNA(dna);
      const retrieved = generatorRegistry.getDNA('generative-art');

      expect(retrieved!.name).toBe('test');
    });

    it('should return undefined for unregistered domain', () => {
      expect(generatorRegistry.getDNA('nonexistent')).toBeUndefined();
    });

    it('should return all registered DNA', () => {
      generatorRegistry.registerDNA({
        name: 'a',
        domain: 'domain-a',
        coreLogic: '',
        constraints: [],
        patterns: [],
        prompts: [],
        extractedAt: '',
        sourcePath: '',
      });
      generatorRegistry.registerDNA({
        name: 'b',
        domain: 'domain-b',
        coreLogic: '',
        constraints: [],
        patterns: [],
        prompts: [],
        extractedAt: '',
        sourcePath: '',
      });
      expect(generatorRegistry.getAllDNA().size).toBe(2);
    });
  });
});
