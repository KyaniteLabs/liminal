/**
 * A/B test results and domain routing data for smart model selection.
 *
 * Based on A/B test results from March 2026:
 *
 * | Domain | Local (Qwen 3.5-4B) | Cloud (Minimax) | Winner |
 * |--------|---------------------|-----------------|--------|
 * | Music  | 0.523               | 0.236           | Local +121% |
 * | Code   | 0.503               | 0.460           | Local +9% |
 * | ASCII  | 0.363               | 0.531           | Cloud +46% |
 *
 * @module routing/RoutingData
 */

import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Record of a generation outcome for dynamic routing.
 */
export interface RoutingRecord {
  domain: DomainType;
  model: ModelChoice;
  qualityScore: number;
  timestamp: string;
}

/**
 * Rolling performance data per domain and model.
 */
export interface RollingPerformance {
  local: { total: number; count: number };
  cloud: { total: number; count: number };
}

const PERFORMANCE_WINDOW = 50; // Keep last 50 records per domain
const PERF_DIR = `${process.env.HOME}/.liminal/routing`;

/**
 * Record a generation outcome for dynamic routing.
 */
export async function recordRoutingOutcome(record: RoutingRecord): Promise<void> {
  try {
    const records = await loadRoutingRecords(record.domain);
    records.push(record);
    // Keep only the last PERFORMANCE_WINDOW records
    if (records.length > PERFORMANCE_WINDOW) {
      records.splice(0, records.length - PERFORMANCE_WINDOW);
    }
    const filePath = path.join(PERF_DIR, `${record.domain}.json`);
    await fs.mkdir(PERF_DIR, { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(records), 'utf-8');
  } catch (err) {
    // Best-effort recording
    console.warn('[RoutingData] Failed to record routing outcome:', err);
  }
}

/**
 * Load routing records for a domain.
 */
async function loadRoutingRecords(domain: DomainType): Promise<RoutingRecord[]> {
  try {
    const filePath = path.join(PERF_DIR, `${domain}.json`);
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.warn('[RoutingData] Failed to load routing records:', err);
    return [];
  }
}

/**
 * Get rolling performance averages for a domain based on actual generation outcomes.
 * Falls back to static AB_TEST_RESULTS if no dynamic data exists.
 */
export async function getRollingPerformance(domain: DomainType): Promise<RollingPerformance | null> {
  const records = await loadRoutingRecords(domain);
  if (records.length < 5) return null; // Not enough data

  const local: { total: number; count: number } = { total: 0, count: 0 };
  const cloud: { total: number; count: number } = { total: 0, count: 0 };

  for (const record of records) {
    if (record.model === 'local' || record.model === 'hybrid') {
      local.total += record.qualityScore;
      local.count++;
    }
    if (record.model === 'cloud' || record.model === 'hybrid') {
      cloud.total += record.qualityScore;
      cloud.count++;
    }
  }

  return { local, cloud };
}

/**
 * Domain types supported by the smart router.
 */
export type DomainType = 'ascii' | 'music' | 'code' | 'visual' | 'remotion';

/**
 * Model choice for routing.
 */
export type ModelChoice = 'local' | 'cloud' | 'hybrid';

/**
 * Fitness scores for a specific domain and model combination.
 */
export interface DomainFitness {
  local: number;
  cloud: number;
  hybrid: number;
}

/**
 * A/B test results mapping domain to fitness scores.
 */
export const AB_TEST_RESULTS: Record<DomainType, DomainFitness> = {
  ascii: { local: 0.363, cloud: 0.531, hybrid: 0.470 },
  music: { local: 0.523, cloud: 0.236, hybrid: 0.481 },
  code: { local: 0.503, cloud: 0.460, hybrid: 0.413 },
  visual: { local: 0.400, cloud: 0.550, hybrid: 0.475 },
  remotion: { local: 0.400, cloud: 0.550, hybrid: 0.475 },
};

/**
 * Domain routing configuration with optimal model and metadata.
 */
export interface DomainRoutingConfig {
  /** Optimal model choice for this domain */
  optimalModel: ModelChoice;
  /** Confidence in this choice (0-1) */
  confidence: number;
  /** Advantage percentage (e.g., "+121%") */
  advantage: string;
  /** Local fitness score */
  localFitness: number;
  /** Cloud fitness score */
  cloudFitness: number;
}

/**
 * Domain routing data mapping domain to routing configuration.
 */
export const DOMAIN_ROUTING_DATA: Record<DomainType, DomainRoutingConfig> = {
  music: {
    optimalModel: 'local',
    confidence: 0.95,
    advantage: '+121%',
    localFitness: 0.523,
    cloudFitness: 0.236,
  },
  code: {
    optimalModel: 'local',
    confidence: 0.75,
    advantage: '+9%',
    localFitness: 0.503,
    cloudFitness: 0.460,
  },
  ascii: {
    optimalModel: 'cloud',
    confidence: 0.85,
    advantage: '+46%',
    localFitness: 0.363,
    cloudFitness: 0.531,
  },
  visual: {
    optimalModel: 'cloud',
    confidence: 0.80,
    advantage: '+38%',
    localFitness: 0.400,
    cloudFitness: 0.550,
  },
  remotion: {
    optimalModel: 'cloud',
    confidence: 0.70,
    advantage: '+38%',
    localFitness: 0.400,
    cloudFitness: 0.550,
  },
};

/**
 * Overall fitness averages across all domains.
 */
export const OVERALL_FITNESS = {
  local: 0.463,
  cloud: 0.409,
  hybrid: 0.447,
} as const;

/**
 * Keyword detection patterns for domain classification.
 */
export const DOMAIN_KEYWORDS: Record<DomainType, string[]> = {
  music: ['music', 'song', 'melody', 'rhythm', 'chord', 'piano', 'guitar', 'beat', 'harmony', 'tempo', 'audio'],
  ascii: ['ascii', 'art', 'draw', 'picture', 'cat face', 'spaceship', 'text art', 'character'],
  code: ['code', 'function', 'class', 'algorithm', 'generate', 'fractal', 'animation', 'script', 'program'],
  visual: ['visual', 'image', 'graphic', 'design', 'color', 'shape', 'pattern', 'render', 'shader', '3d', 'scene'],
  remotion: ['remotion', 'video', 'motion graphics', 'title sequence', 'animation', 'composition'],
};
