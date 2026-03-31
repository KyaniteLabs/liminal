/**
 * Model Routing Configuration
 * 
 * Based on AUDIT findings from 48 dogfood examples (8 domains × 6 models).
 * This routing config helps LIMINAL choose the best model for each domain.
 * 
 * Audit Date: 2026-03-31
 * Total Examples: 48
 * Success Rate: 96% (46/48 generations succeeded)
 * 
 * Rankings based on:
 * - Output quality (size, complexity, correctness)
 * - Speed (generation time)
 * - Reliability (failure rate)
 * 
 * @see AUDIT_FINDINGS.md for detailed analysis
 */

export interface ModelRanking {
  /** Model ID */
  id: string;
  /** Quality score 1-10 based on output complexity and correctness */
  quality: number;
  /** Speed score 1-10 (higher = faster) */
  speed: number;
  /** Reliability score 1-10 (higher = fewer failures) */
  reliability: number;
  /** Average generation time in seconds from telemetry */
  avgTimeSeconds: number;
  /** Average output size in bytes from telemetry */
  avgSizeBytes: number;
  /** Known issues with this model */
  issues: string[];
}

export interface DomainRouting {
  /** Best models for this domain (ordered by preference) */
  preferred: string[];
  /** Models to avoid for this domain */
  avoid: string[];
  /** Minimum acceptable output size */
  minSize: number;
  /** Model rankings for this domain */
  rankings: ModelRanking[];
  /** Specific prompt hints for this domain */
  promptHints: string[];
}

// -----------------------------------------------------------------------------
// Model IDs (consistent with LIMINAL's provider system)
// -----------------------------------------------------------------------------
export const MODEL_IDS = {
  MINIMAX_M2_7: 'minimax-m2.7',
  MINIMAX_M2_5: 'minimax-m2.5',
  QWEN_35_9B: 'qwen3.5-9b',
  QWEN_CODER_40B: 'qwen3-coder-40b',
  GEMMA_3_4B: 'gemma3-4b',
  KIMI_K2_5: 'kimi-k2.5',
} as const;

// -----------------------------------------------------------------------------
// DOMAIN ROUTING - Based on 48-example audit
// -----------------------------------------------------------------------------
export const DOMAIN_ROUTING: Record<string, DomainRouting> = {
  'p5': {
    preferred: [
      MODEL_IDS.MINIMAX_M2_5,   // Fastest, good quality
      MODEL_IDS.MINIMAX_M2_7,   // Most complex outputs
      MODEL_IDS.KIMI_K2_5,      // Largest outputs
      MODEL_IDS.QWEN_CODER_40B, // Good balance
      MODEL_IDS.GEMMA_3_4B,     // Fast but simpler
      MODEL_IDS.QWEN_35_9B,     // Slow but works
    ],
    avoid: [],
    minSize: 1000,
    rankings: [
      { id: MODEL_IDS.MINIMAX_M2_5, quality: 9, speed: 10, reliability: 10, avgTimeSeconds: 18, avgSizeBytes: 4175, issues: [] },
      { id: MODEL_IDS.MINIMAX_M2_7, quality: 9, speed: 8, reliability: 10, avgTimeSeconds: 35, avgSizeBytes: 3388, issues: [] },
      { id: MODEL_IDS.KIMI_K2_5, quality: 10, speed: 6, reliability: 10, avgTimeSeconds: 42, avgSizeBytes: 5114, issues: ['Slower but most complex'] },
      { id: MODEL_IDS.QWEN_CODER_40B, quality: 7, speed: 9, reliability: 10, avgTimeSeconds: 28, avgSizeBytes: 2070, issues: ['More compact'] },
      { id: MODEL_IDS.GEMMA_3_4B, quality: 6, speed: 10, reliability: 10, avgTimeSeconds: 25, avgSizeBytes: 1929, issues: ['Simpler outputs'] },
      { id: MODEL_IDS.QWEN_35_9B, quality: 7, speed: 2, reliability: 8, avgTimeSeconds: 90, avgSizeBytes: 3075, issues: ['Very slow'] },
    ],
    promptHints: [
      'p5.js has excellent model support across all providers',
      'Use M2.5 for speed, Kimi for complexity',
    ],
  },
  
  'glsl': {
    preferred: [
      MODEL_IDS.KIMI_K2_5,      // Most complex shaders
      MODEL_IDS.MINIMAX_M2_7,   // Good noise functions
      MODEL_IDS.QWEN_CODER_40B, // Solid output
      MODEL_IDS.GEMMA_3_4B,     // Fast but basic
      MODEL_IDS.MINIMAX_M2_5,   // Fast but TOO SIMPLE - needs complexity constraint
    ],
    avoid: [],
    minSize: 800,
    rankings: [
      { id: MODEL_IDS.KIMI_K2_5, quality: 9, speed: 6, reliability: 10, avgTimeSeconds: 55, avgSizeBytes: 1785, issues: [] },
      { id: MODEL_IDS.MINIMAX_M2_7, quality: 9, speed: 7, reliability: 10, avgTimeSeconds: 30, avgSizeBytes: 2282, issues: [] },
      { id: MODEL_IDS.QWEN_CODER_40B, quality: 8, speed: 8, reliability: 10, avgTimeSeconds: 30, avgSizeBytes: 1999, issues: [] },
      { id: MODEL_IDS.GEMMA_3_4B, quality: 6, speed: 9, reliability: 10, avgTimeSeconds: 14, avgSizeBytes: 880, issues: ['Basic shaders'] },
      { id: MODEL_IDS.MINIMAX_M2_5, quality: 5, speed: 10, reliability: 10, avgTimeSeconds: 10, avgSizeBytes: 715, issues: ['TAKES SHORTCUTS - too simple'] },
    ],
    promptHints: [
      'GLSL quality varies - M2.5 needs "minimum 1000 chars" constraint',
      'Require at least 2 noise functions for complexity',
    ],
  },
  
  'three': {
    preferred: [
      MODEL_IDS.MINIMAX_M2_7,   // Excellent 3D scenes
      MODEL_IDS.MINIMAX_M2_5,   // Excellent 3D scenes
      MODEL_IDS.KIMI_K2_5,      // Good complex scenes
      MODEL_IDS.GEMMA_3_4B,     // Good basic scenes
      MODEL_IDS.QWEN_CODER_40B, // Decent
    ],
    avoid: [
      MODEL_IDS.QWEN_35_9B,     // ❌ FAILED - produced 66b empty output
    ],
    minSize: 1000,
    rankings: [
      { id: MODEL_IDS.MINIMAX_M2_7, quality: 10, speed: 8, reliability: 10, avgTimeSeconds: 37, avgSizeBytes: 6753, issues: [] },
      { id: MODEL_IDS.MINIMAX_M2_5, quality: 10, speed: 8, reliability: 10, avgTimeSeconds: 34, avgSizeBytes: 6959, issues: [] },
      { id: MODEL_IDS.KIMI_K2_5, quality: 8, speed: 7, reliability: 10, avgTimeSeconds: 54, avgSizeBytes: 3822, issues: [] },
      { id: MODEL_IDS.GEMMA_3_4B, quality: 7, speed: 9, reliability: 10, avgTimeSeconds: 25, avgSizeBytes: 2361, issues: [] },
      { id: MODEL_IDS.QWEN_CODER_40B, quality: 8, speed: 8, reliability: 10, avgTimeSeconds: 34, avgSizeBytes: 3635, issues: [] },
      { id: MODEL_IDS.QWEN_35_9B, quality: 1, speed: 3, reliability: 3, avgTimeSeconds: 90, avgSizeBytes: 66, issues: ['❌ FAILED - 66b empty output'] },
    ],
    promptHints: [
      'AVOID Qwen3.5-9B for Three.js - produces empty output',
      'M2.7 and M2.5 are excellent for 3D',
      'Use global THREE (not ES modules) for CDN compatibility',
    ],
  },
  
  'hydra': {
    preferred: [
      MODEL_IDS.MINIMAX_M2_7,   // Most reliable
      MODEL_IDS.GEMMA_3_4B,     // Second most reliable
    ],
    avoid: [
      MODEL_IDS.QWEN_35_9B,     // ❌ FAILED - 74b output
      MODEL_IDS.QWEN_CODER_40B, // ❌ Too small (169b)
      MODEL_IDS.MINIMAX_M2_5,   // ❌ Too small (139b)
      MODEL_IDS.KIMI_K2_5,      // ❌ Too small (181b)
    ],
    minSize: 200,
    rankings: [
      { id: MODEL_IDS.MINIMAX_M2_7, quality: 7, speed: 9, reliability: 7, avgTimeSeconds: 9, avgSizeBytes: 415, issues: ['Some API confusion'] },
      { id: MODEL_IDS.GEMMA_3_4B, quality: 6, speed: 8, reliability: 6, avgTimeSeconds: 10, avgSizeBytes: 307, issues: [] },
      { id: MODEL_IDS.MINIMAX_M2_5, quality: 3, speed: 8, reliability: 3, avgTimeSeconds: 13, avgSizeBytes: 139, issues: ['TOO SMALL - 139b'] },
      { id: MODEL_IDS.QWEN_CODER_40B, quality: 3, speed: 9, reliability: 3, avgTimeSeconds: 4, avgSizeBytes: 169, issues: ['TOO SMALL - 169b'] },
      { id: MODEL_IDS.KIMI_K2_5, quality: 3, speed: 5, reliability: 3, avgTimeSeconds: 39, avgSizeBytes: 181, issues: ['TOO SMALL - 181b'] },
      { id: MODEL_IDS.QWEN_35_9B, quality: 1, speed: 10, reliability: 1, avgTimeSeconds: 3, avgSizeBytes: 74, issues: ['❌ FAILED - 74b output'] },
    ],
    promptHints: [
      'Hydra has 50% failure rate - needs major prompt work',
      'Models struggle with Hydra API - add explicit valid/invalid examples',
      'Require .out() at end of every chain',
      'MOST MODELS produce invalid code - stick to M2.7 and Gemma',
    ],
  },
  
  'strudel': {
    preferred: [
      MODEL_IDS.QWEN_CODER_40B, // Best patterns
      MODEL_IDS.GEMMA_3_4B,     // Good
      MODEL_IDS.KIMI_K2_5,      // Good
      MODEL_IDS.MINIMAX_M2_7,   // Decent
      MODEL_IDS.MINIMAX_M2_5,   // Decent
      MODEL_IDS.QWEN_35_9B,     // Slow but works
    ],
    avoid: [],
    minSize: 100,
    rankings: [
      { id: MODEL_IDS.QWEN_CODER_40B, quality: 7, speed: 9, reliability: 10, avgTimeSeconds: 7, avgSizeBytes: 313, issues: [] },
      { id: MODEL_IDS.GEMMA_3_4B, quality: 8, speed: 8, reliability: 10, avgTimeSeconds: 11, avgSizeBytes: 531, issues: [] },
      { id: MODEL_IDS.KIMI_K2_5, quality: 7, speed: 5, reliability: 10, avgTimeSeconds: 58, avgSizeBytes: 381, issues: [] },
      { id: MODEL_IDS.MINIMAX_M2_7, quality: 6, speed: 7, reliability: 10, avgTimeSeconds: 26, avgSizeBytes: 245, issues: [] },
      { id: MODEL_IDS.MINIMAX_M2_5, quality: 6, speed: 9, reliability: 10, avgTimeSeconds: 8, avgSizeBytes: 312, issues: [] },
      { id: MODEL_IDS.QWEN_35_9B, quality: 8, speed: 2, reliability: 8, avgTimeSeconds: 60, avgSizeBytes: 1337, issues: ['Very slow'] },
    ],
    promptHints: [
      'Strudel code generates successfully but audio requires user interaction',
      'Link to Strudel REPL for playback instead of auto-playing in iframe',
      'Watch for Chinese character contamination in some outputs',
    ],
  },
  
  'remotion': {
    preferred: [
      MODEL_IDS.MINIMAX_M2_7,   // Best components
      MODEL_IDS.QWEN_35_9B,     // Good (rare Qwen35 success)
      MODEL_IDS.QWEN_CODER_40B, // Good
      MODEL_IDS.GEMMA_3_4B,     // Good
      MODEL_IDS.KIMI_K2_5,      // Good
      MODEL_IDS.MINIMAX_M2_5,   // Good
    ],
    avoid: [],
    minSize: 800,
    rankings: [
      { id: MODEL_IDS.MINIMAX_M2_7, quality: 9, speed: 8, reliability: 10, avgTimeSeconds: 31, avgSizeBytes: 2234, issues: [] },
      { id: MODEL_IDS.QWEN_35_9B, quality: 8, speed: 4, reliability: 9, avgTimeSeconds: 53, avgSizeBytes: 2507, issues: ['Slow'] },
      { id: MODEL_IDS.QWEN_CODER_40B, quality: 8, speed: 7, reliability: 10, avgTimeSeconds: 21, avgSizeBytes: 2307, issues: [] },
      { id: MODEL_IDS.GEMMA_3_4B, quality: 7, speed: 7, reliability: 10, avgTimeSeconds: 25, avgSizeBytes: 1483, issues: [] },
      { id: MODEL_IDS.KIMI_K2_5, quality: 7, speed: 7, reliability: 10, avgTimeSeconds: 21, avgSizeBytes: 1654, issues: [] },
      { id: MODEL_IDS.MINIMAX_M2_5, quality: 7, speed: 8, reliability: 10, avgTimeSeconds: 13, avgSizeBytes: 1698, issues: [] },
    ],
    promptHints: [
      'Remotion requires build step - cannot preview in browser',
      'Code generation works well across all models',
    ],
  },
  
  'html': {
    preferred: [
      MODEL_IDS.MINIMAX_M2_5,   // Fast
      MODEL_IDS.MINIMAX_M2_7,   // Fast
      MODEL_IDS.QWEN_CODER_40B, // Fast
      MODEL_IDS.GEMMA_3_4B,     // Fast
      MODEL_IDS.KIMI_K2_5,      // Fast
      MODEL_IDS.QWEN_35_9B,     // Fast
    ],
    avoid: [],
    minSize: 600, // HTML uses templates, all produce same size
    rankings: [
      // HTML uses template fallback - all models produce identical output
      { id: MODEL_IDS.MINIMAX_M2_5, quality: 8, speed: 10, reliability: 10, avgTimeSeconds: 0.04, avgSizeBytes: 645, issues: [] },
      { id: MODEL_IDS.MINIMAX_M2_7, quality: 8, speed: 10, reliability: 10, avgTimeSeconds: 0.04, avgSizeBytes: 645, issues: [] },
      { id: MODEL_IDS.GEMMA_3_4B, quality: 8, speed: 10, reliability: 10, avgTimeSeconds: 0.04, avgSizeBytes: 645, issues: [] },
      { id: MODEL_IDS.QWEN_CODER_40B, quality: 8, speed: 10, reliability: 10, avgTimeSeconds: 0.04, avgSizeBytes: 645, issues: [] },
      { id: MODEL_IDS.KIMI_K2_5, quality: 8, speed: 10, reliability: 10, avgTimeSeconds: 0.04, avgSizeBytes: 645, issues: [] },
      { id: MODEL_IDS.QWEN_35_9B, quality: 8, speed: 10, reliability: 10, avgTimeSeconds: 0.04, avgSizeBytes: 645, issues: [] },
    ],
    promptHints: [
      'HTML uses template fallback - not LLM generated',
      'All models produce identical output',
    ],
  },
  
  'ascii': {
    preferred: [
      MODEL_IDS.MINIMAX_M2_5,   // Fast
      MODEL_IDS.MINIMAX_M2_7,   // Fast
      MODEL_IDS.QWEN_CODER_40B, // Fast
      MODEL_IDS.GEMMA_3_4B,     // Fast
      MODEL_IDS.KIMI_K2_5,      // Fast
      MODEL_IDS.QWEN_35_9B,     // Fast
    ],
    avoid: [],
    minSize: 1500, // ASCII uses templates
    rankings: [
      // ASCII uses template fallback - all models produce identical output
      { id: MODEL_IDS.MINIMAX_M2_5, quality: 8, speed: 10, reliability: 10, avgTimeSeconds: 0.04, avgSizeBytes: 1829, issues: [] },
      { id: MODEL_IDS.MINIMAX_M2_7, quality: 8, speed: 10, reliability: 10, avgTimeSeconds: 0.04, avgSizeBytes: 1829, issues: [] },
      { id: MODEL_IDS.GEMMA_3_4B, quality: 8, speed: 10, reliability: 10, avgTimeSeconds: 0.04, avgSizeBytes: 1829, issues: [] },
      { id: MODEL_IDS.QWEN_CODER_40B, quality: 8, speed: 10, reliability: 10, avgTimeSeconds: 0.04, avgSizeBytes: 1829, issues: [] },
      { id: MODEL_IDS.KIMI_K2_5, quality: 8, speed: 10, reliability: 10, avgTimeSeconds: 0.04, avgSizeBytes: 1829, issues: [] },
      { id: MODEL_IDS.QWEN_35_9B, quality: 8, speed: 10, reliability: 10, avgTimeSeconds: 0.04, avgSizeBytes: 1829, issues: [] },
    ],
    promptHints: [
      'ASCII uses template fallback - not LLM generated',
      'All models produce identical output',
    ],
  },
};

// -----------------------------------------------------------------------------
// Helper functions
// -----------------------------------------------------------------------------

/**
 * Get the best model for a given domain
 */
export function getBestModel(domain: string): string {
  const routing = DOMAIN_ROUTING[domain.toLowerCase()];
  if (!routing) return MODEL_IDS.MINIMAX_M2_5; // Default fallback
  return routing.preferred[0] || MODEL_IDS.MINIMAX_M2_5;
}

/**
 * Get all preferred models for a domain (ordered by preference)
 */
export function getPreferredModels(domain: string): string[] {
  const routing = DOMAIN_ROUTING[domain.toLowerCase()];
  if (!routing) return Object.values(MODEL_IDS);
  return routing.preferred;
}

/**
 * Check if a model should be avoided for a domain
 */
export function shouldAvoidModel(domain: string, modelId: string): boolean {
  const routing = DOMAIN_ROUTING[domain.toLowerCase()];
  if (!routing) return false;
  return routing.avoid.includes(modelId);
}

/**
 * Get minimum size requirement for a domain
 */
export function getMinSizeForDomain(domain: string): number {
  const routing = DOMAIN_ROUTING[domain.toLowerCase()];
  if (!routing) return 500;
  return routing.minSize;
}

/**
 * Get model ranking for a domain
 */
export function getModelRanking(domain: string, modelId: string): ModelRanking | undefined {
  const routing = DOMAIN_ROUTING[domain.toLowerCase()];
  if (!routing) return undefined;
  return routing.rankings.find(r => r.id === modelId);
}

/**
 * Get all prompt hints for a domain
 */
export function getPromptHints(domain: string): string[] {
  const routing = DOMAIN_ROUTING[domain.toLowerCase()];
  if (!routing) return [];
  return routing.promptHints;
}
