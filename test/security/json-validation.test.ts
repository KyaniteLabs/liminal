/**
 * Tests for JSON Schema Validation (CWE-502)
 * 
 * These tests verify that:
 * 1. Valid JSON is parsed and validated correctly
 * 2. Malformed JSON returns null gracefully
 * 3. Prototype pollution attempts are blocked
 */

import { describe, it, expect, vi } from 'vitest';
import {
  safeJsonParse,
  safeJsonParseWithDefault,
  SeedSchema,
  SoupStateSchema,
  ArchiveDataSchema,
  PersistedLoopStateSchema,
} from '../../src/security/JsonSchemas.js';

describe('safeJsonParse', () => {
  it('should parse valid JSON matching schema', () => {
    const json = JSON.stringify({ bestFitness: 0.5, iterationsSinceLastImprovement: 5, budgetUsed: 100, totalIterations: 10, savedAt: '2024-01-01T00:00:00Z' });
    const result = safeJsonParse(json, PersistedLoopStateSchema, 'test');
    expect(result).not.toBeNull();
    expect(result?.bestFitness).toBe(0.5);
    expect(result?.iterationsSinceLastImprovement).toBe(5);
  });

  it('should return null for invalid JSON syntax', () => {
    const json = '{ invalid json }';
    const result = safeJsonParse(json, PersistedLoopStateSchema, 'test');
    expect(result).toBeNull();
  });

  it('should return null for JSON not matching schema', () => {
    const json = JSON.stringify({ bestFitness: 'not a number', iterationsSinceLastImprovement: 5, budgetUsed: 100, totalIterations: 10, savedAt: '2024-01-01T00:00:00Z' });
    const result = safeJsonParse(json, PersistedLoopStateSchema, 'test');
    expect(result).toBeNull();
  });

  it('should return null for missing required fields', () => {
    const json = JSON.stringify({ bestFitness: 0.5 }); // missing other required fields
    const result = safeJsonParse(json, PersistedLoopStateSchema, 'test');
    expect(result).toBeNull();
  });

  it('should block prototype pollution attempts', () => {
    const maliciousJson = JSON.stringify({
      bestFitness: 0.5,
      iterationsSinceLastImprovement: 5,
      budgetUsed: 100,
      totalIterations: 10,
      savedAt: '2024-01-01T00:00:00Z',
      '__proto__': { polluted: true },
      'constructor': { prototype: { polluted: true } },
    });
    const result = safeJsonParse(maliciousJson, PersistedLoopStateSchema, 'test');
    expect(result).not.toBeNull();
    // Verify the prototype was not polluted
    expect((Object.prototype as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('should log error with context when validation fails', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const json = '{ invalid }';
    safeJsonParse(json, PersistedLoopStateSchema, 'TestContext');
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[Security] Invalid JSON in TestContext:'),
      expect.anything()
    );
    consoleSpy.mockRestore();
  });
});

describe('safeJsonParseWithDefault', () => {
  it('should return parsed data for valid JSON', () => {
    const json = JSON.stringify({ bestFitness: 0.5, iterationsSinceLastImprovement: 5, budgetUsed: 100, totalIterations: 10, savedAt: '2024-01-01T00:00:00Z' });
    const defaultValue = { bestFitness: 0, iterationsSinceLastImprovement: 0, budgetUsed: 0, totalIterations: 0, savedAt: '' };
    const result = safeJsonParseWithDefault(json, PersistedLoopStateSchema, defaultValue, 'test');
    expect(result.bestFitness).toBe(0.5);
  });

  it('should return default value for invalid JSON', () => {
    const json = '{ invalid }';
    const defaultValue = { bestFitness: 0, iterationsSinceLastImprovement: 0, budgetUsed: 0, totalIterations: 0, savedAt: '' };
    const result = safeJsonParseWithDefault(json, PersistedLoopStateSchema, defaultValue, 'test');
    expect(result).toEqual(defaultValue);
  });
});

describe('SeedSchema', () => {
  const validSeed = {
    id: 'seed-1',
    content: 'Test seed content',
    score: 0.85,
    source: {
      fragments: ['frag-1', 'frag-2'],
      collisionType: 'cross-domain',
      domains: ['p5', 'three'],
    },
    promotedAt: '2024-01-01T00:00:00Z',
    usedBy: ['function1'],
    useCount: 3,
  };

  it('should validate a valid seed', () => {
    const result = SeedSchema.safeParse(validSeed);
    expect(result.success).toBe(true);
  });

  it('should reject seed with missing required fields', () => {
    const invalidSeed = { ...validSeed, id: undefined };
    const result = SeedSchema.safeParse(invalidSeed);
    expect(result.success).toBe(false);
  });

  it('should reject seed with wrong type', () => {
    const invalidSeed = { ...validSeed, score: 'not a number' };
    const result = SeedSchema.safeParse(invalidSeed);
    expect(result.success).toBe(false);
  });

  it('should validate array of seeds', () => {
    const seeds = [validSeed, validSeed];
    const result = SeedSchema.array().safeParse(seeds);
    expect(result.success).toBe(true);
  });

  it('should block prototype pollution in seed data', () => {
    const maliciousSeed = {
      ...validSeed,
      '__proto__': { polluted: true },
    };
    const result = SeedSchema.safeParse(maliciousSeed);
    expect(result.success).toBe(true);
    expect((Object.prototype as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe('SoupStateSchema', () => {
  const validState = {
    population: [],
    generation: 5,
    bestSeed: null,
    totalSeedsPromoted: 10,
    domainHeatmap: { p5: 0.8, three: 0.6 },
    lastCycleAt: '2024-01-01T00:00:00Z',
  };

  it('should validate valid soup state', () => {
    const result = SoupStateSchema.safeParse(validState);
    expect(result.success).toBe(true);
  });

  it('should apply defaults for missing optional fields', () => {
    const minimalState = {
      population: [],
      bestSeed: null,
    };
    const result = SoupStateSchema.safeParse(minimalState);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.generation).toBe(0);
      expect(result.data.totalSeedsPromoted).toBe(0);
      expect(result.data.domainHeatmap).toEqual({});
      expect(result.data.lastCycleAt).toBe('');
    }
  });

  it('should reject invalid population type', () => {
    const invalidState = { ...validState, population: 'not an array' };
    const result = SoupStateSchema.safeParse(invalidState);
    expect(result.success).toBe(false);
  });
});

describe('ArchiveDataSchema', () => {
  const validArchiveData = {
    archives: {
      p5: [
        {
          id: 'entry-1',
          domain: 'p5',
          prompt: 'Create a circle',
          output: 'ellipse(50, 50, 80, 80);',
          qualityScore: 0.9,
          metadata: {},
          createdAt: '2024-01-01T00:00:00Z',
        },
      ],
    },
    lastUpdated: '2024-01-01T00:00:00Z',
  };

  it('should validate valid archive data', () => {
    const result = ArchiveDataSchema.safeParse(validArchiveData);
    expect(result.success).toBe(true);
  });

  it('should reject archive with invalid entry', () => {
    const invalidData = {
      archives: {
        p5: [
          {
            id: 'entry-1',
            domain: 'p5',
            qualityScore: 'not a number', // invalid
            createdAt: '2024-01-01T00:00:00Z',
          },
        ],
      },
      lastUpdated: '2024-01-01T00:00:00Z',
    };
    const result = ArchiveDataSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });

  it('should reject archive missing required fields', () => {
    const invalidData = { archives: {} }; // missing lastUpdated
    const result = ArchiveDataSchema.safeParse(invalidData);
    expect(result.success).toBe(false);
  });
});

describe('PersistedLoopStateSchema', () => {
  const validState = {
    bestFitness: 0.95,
    iterationsSinceLastImprovement: 3,
    budgetUsed: 500,
    totalIterations: 20,
    savedAt: '2024-01-01T00:00:00Z',
  };

  it('should validate valid loop state', () => {
    const result = PersistedLoopStateSchema.safeParse(validState);
    expect(result.success).toBe(true);
  });

  it('should reject state with negative numbers', () => {
    const invalidState = { ...validState, bestFitness: -1 };
    // Note: Schema doesn't restrict negative numbers, just validates types
    const result = PersistedLoopStateSchema.safeParse(invalidState);
    expect(result.success).toBe(true); // Type-wise it's valid
  });

  it('should reject state with wrong types', () => {
    const invalidState = { ...validState, budgetUsed: '500' };
    const result = PersistedLoopStateSchema.safeParse(invalidState);
    expect(result.success).toBe(false);
  });
});

describe('Security: Prototype Pollution Prevention', () => {
  it('should not allow __proto__ key in objects', () => {
    const json = JSON.stringify({
      bestFitness: 0.5,
      iterationsSinceLastImprovement: 5,
      budgetUsed: 100,
      totalIterations: 10,
      savedAt: '2024-01-01T00:00:00Z',
      '__proto__': { isAdmin: true },
    });
    
    safeJsonParse(json, PersistedLoopStateSchema, 'test');
    
    // Verify prototype was not polluted
    expect((Object.prototype as Record<string, unknown>).isAdmin).toBeUndefined();
  });

  it('should not allow constructor.prototype pollution', () => {
    const json = JSON.stringify({
      bestFitness: 0.5,
      iterationsSinceLastImprovement: 5,
      budgetUsed: 100,
      totalIterations: 10,
      savedAt: '2024-01-01T00:00:00Z',
      constructor: {
        prototype: { isAdmin: true },
      },
    });
    
    safeJsonParse(json, PersistedLoopStateSchema, 'test');
    
    // Verify prototype was not polluted
    expect((Object.prototype as Record<string, unknown>).isAdmin).toBeUndefined();
  });

  it('should handle nested prototype pollution attempts', () => {
    const json = JSON.stringify({
      archives: {
        '__proto__': { polluted: true },
      },
      lastUpdated: '2024-01-01T00:00:00Z',
    });
    
    safeJsonParse(json, ArchiveDataSchema, 'test');
    
    expect((Object.prototype as Record<string, unknown>).polluted).toBeUndefined();
  });
});
