/**
 * * DomainPrototype — Running centroid computation for quality embeddings per domain.
 *
 * Implements prototype theory from cognitive science: categorize by comparing
 * to the "average" (centroid) of high-quality examples for each domain.
 *
 * The centroid serves as a fast quality predictor — cosine distance
 * from a new candidate's embedding to the domain's quality centroid predicts
 * quality without LLM calls.
 *
 * @module intuition/DomainPrototype
 */

import { Logger } from '../utils/Logger.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A domain prototype — the centroid of high-quality outputs for a domain. */
export interface DomainCentroid {
  /** Domain name (e.g., 'p5', 'glsl', 'three', 'music') */
  domain: string;
  /** Centroid embedding vector (average of quality embeddings) */
  centroid: number[];
  /** Number of examples used to build this centroid */
  exampleCount: number;
  /** Average quality score of examples */
  avgQuality: number;
  /** Last time centroid was updated */
  updatedAt: string;
}

/** Serializable prototype store. */
export interface PrototypeStore {
  version: number;
  centroids: DomainCentroid[];
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// DomainPrototype
// ---------------------------------------------------------------------------

export class DomainPrototype {
  private centroids = new Map<string, DomainCentroid>();

  /**
   * Add an example to a domain's running centroid.
   * Call this for each high-quality output as it archived.
   */
  addExample(domain: string, embedding: number[], quality: number): void {
    const existing = this.centroids.get(domain);
    if (existing) {
      // Incremental centroid update: weighted average
      const n = existing.exampleCount;
      const newN = n + 1;
      for (let i = 0; i < existing.centroid.length; i++) {
        existing.centroid[i] = (existing.centroid[i] * n + embedding[i]) / newN;
      }
      existing.exampleCount = newN;
      existing.avgQuality = (existing.avgQuality * n + quality) / newN;
      existing.updatedAt = new Date().toISOString();
    } else {
      this.centroids.set(domain, {
        domain,
        centroid: [...embedding],
        exampleCount: 1,
        avgQuality: quality,
        updatedAt: new Date().toISOString(),
      });
    }
  }

  /**
   * Compute cosine distance from an embedding to a domain's centroid.
   * Returns 0 for unknown domains (no prototype).
   * Lower distance = closer to "quality centroid" = higher predicted quality.
   */
  distanceToCentroid(domain: string, embedding: number[]): number {
    const centroid = this.centroids.get(domain);
    if (!centroid || centroid.centroid.length === 0) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < embedding.length; i++) {
      dotProduct += embedding[i] * centroid.centroid[i];
      normA += embedding[i] * embedding[i];
      normB += centroid.centroid[i] * centroid.centroid[i];
    }

    if (normA === 0 || normB === 0) return 0;
    const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    return 1 - similarity; // cosine distance
  }

  /**
   * Predict quality from an embedding.
   * Returns 1 - distance (closer to centroid = higher predicted quality).
   */
  predictQuality(domain: string, embedding: number[]): number {
    const dist = this.distanceToCentroid(domain, embedding);
    // Convert distance to quality: closer = higher quality
    const centroid = this.centroids.get(domain);
    if (!centroid) return 0.5; // No data — neutral prediction

    // Map cosine distance [0,2] → quality [1,0]
    // distance 0 (identical) → quality ~1, distance 1 (orthogonal) → ~0.5, distance 2 (opposite) → ~0
    return Math.max(0, Math.min(1, 1 - dist / 2));
  }

  /** Get all domain prototypes (for reporting). */
  getAllCentroids(): DomainCentroid[] {
    return Array.from(this.centroids.values());
  }

  /** Check if a domain has enough data for predictions. */
  isReady(domain: string, minExamples: number = 3): boolean {
    const centroid = this.centroids.get(domain);
    return !!centroid && centroid.exampleCount >= minExamples;
  }

  /**
   * Get the centroid data for a domain (for external inspection).
   */
  getCentroid(domain: string): DomainCentroid | null {
    return this.centroids.get(domain) ?? null;
  }

  /** Number of domains with prototypes. */
  get domainCount(): number {
    return this.centroids.size;
  }

  /** Serialize for persistence. */
  serialize(): PrototypeStore {
    return {
      version: 1,
      centroids: Array.from(this.centroids.values()),
      updatedAt: new Date().toISOString(),
    };
  }

  /** Load from persisted state. */
  deserialize(state: PrototypeStore): void {
    this.centroids.clear();
    for (const c of state.centroids) {
      this.centroids.set(c.domain, { ...c });
    }
    Logger.info('DomainPrototype', `Loaded ${this.centroids.size} domain prototypes`);
  }

  /** Reset (for testing). */
  reset(): void {
    this.centroids.clear();
  }
}
