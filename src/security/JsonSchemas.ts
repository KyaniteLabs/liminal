/**
 * JSON Schema Validation for Deserialization Security (CWE-502)
 * 
 * This module provides Zod schemas for validating JSON data during deserialization,
 * preventing prototype pollution and ensuring type safety.
 */

import { z } from 'zod';

// ============================================================================
// Compost / SeedBank Schemas
// ============================================================================

/** Schema for FragmentMetadata */
const FragmentMetadataSchema = z.object({
  fileType: z.string(),
  timestamp: z.string(),
  hash: z.string(),
  size: z.number(),
  extractedAt: z.string(),
  dimensions: z.object({ width: z.number(), height: z.number() }).optional(),
  format: z.string().optional(),
  sampleRate: z.number().optional(),
  duration: z.number().optional(),
  channels: z.number().optional(),
  bpm: z.number().optional(),
  musicalKey: z.string().optional(),
  gps: z.object({ lat: z.number(), lon: z.number() }).optional(),
  aspectRatio: z.string().optional(),
  exposure: z.number().optional(),
  iso: z.number().optional(),
  vertexCount: z.number().optional(),
  loc: z.number().optional(),
  language: z.string().optional(),
});

/** Schema for CompostFragment */
const CompostFragmentSchema = z.object({
  id: z.string(),
  source: z.string(),
  domain: z.string(),
  layer: z.enum(['semantic', 'structured', 'raw']),
  content: z.string(),
  metadata: FragmentMetadataSchema,
  tags: z.array(z.string()),
  score: z.number().optional(),
});

/** Schema for Seed source */
const SeedSourceSchema = z.object({
  fragments: z.array(z.string()),
  collisionType: z.string(),
  domains: z.array(z.string()),
});

/** Schema for Seed (as stored in SeedBank) */
export const SeedSchema = z.object({
  id: z.string(),
  content: z.string(),
  score: z.number(),
  source: SeedSourceSchema,
  promotedAt: z.string(),
  usedBy: z.array(z.string()),
  useCount: z.number(),
  lir: z.any().optional(), // LIRToken is complex, use loose validation
});

// ============================================================================
// SoupState Schema
// ============================================================================

/** Schema for SoupState (as stored in soup-state.json) */
export const SoupStateSchema = z.object({
  population: z.array(CompostFragmentSchema).default([]),
  generation: z.number().default(0),
  bestSeed: CompostFragmentSchema.nullable().default(null),
  totalSeedsPromoted: z.number().default(0),
  domainHeatmap: z.record(z.string(), z.number()).default({}),
  lastCycleAt: z.string().default(''),
});

// ============================================================================
// QualityArchive Schema
// ============================================================================

/** Schema for ArchiveEntry */
const ArchiveEntrySchema = z.object({
  id: z.string(),
  domain: z.string(),
  prompt: z.string(),
  output: z.string(),
  qualityScore: z.number(),
  metadata: z.record(z.string(), z.unknown()).default({}),
  createdAt: z.string(),
  usedCount: z.number().optional(),
  userRating: z.number().optional(),
});

/** Schema for ArchiveData (as stored in quality_archive.json) */
export const ArchiveDataSchema = z.object({
  archives: z.record(z.string(), z.array(ArchiveEntrySchema)),
  lastUpdated: z.string(),
});

// ============================================================================
// PersistedLoopState Schema
// ============================================================================

/** Schema for PersistedLoopState (as stored by ContextAccumulation) */
export const PersistedLoopStateSchema = z.object({
  bestFitness: z.number(),
  iterationsSinceLastImprovement: z.number(),
  budgetUsed: z.number(),
  totalIterations: z.number(),
  savedAt: z.string(),
});

// ============================================================================
// Safe JSON Parsing Utility
// ============================================================================

/**
 * Safely parse JSON with schema validation.
 * 
 * @param json - The JSON string to parse
 * @param schema - The Zod schema to validate against
 * @param context - Optional context string for error logging
 * @returns The parsed and validated data, or null if invalid
 */
export function safeJsonParse<T>(
  json: string,
  schema: z.ZodSchema<T>,
  context?: string
): T | null {
  try {
    const parsed = JSON.parse(json);
    return schema.parse(parsed);
  } catch (err) {
    const contextMsg = context ? ` in ${context}` : '';
    if (err instanceof z.ZodError) {
      console.error(`[Security] Schema validation failed${contextMsg}:`, err.issues);
    } else {
      console.error(`[Security] Invalid JSON${contextMsg}:`, err);
    }
    return null;
  }
}

/**
 * Safely parse JSON with schema validation, returning a default value on failure.
 * 
 * @param json - The JSON string to parse
 * @param schema - The Zod schema to validate against
 * @param defaultValue - The default value to return on failure
 * @param context - Optional context string for error logging
 * @returns The parsed and validated data, or the default value if invalid
 */
export function safeJsonParseWithDefault<T>(
  json: string,
  schema: z.ZodSchema<T>,
  defaultValue: T,
  context?: string
): T {
  const result = safeJsonParse(json, schema, context);
  return result ?? defaultValue;
}
