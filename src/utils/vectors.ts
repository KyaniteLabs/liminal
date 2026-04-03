/**
 * Vector similarity utilities for semantic search.
 * Provides cosine similarity and euclidean distance calculations.
 */

/**
 * Calculate cosine similarity between two vectors.
 * Returns a value in range [-1, 1], where 1 means identical direction.
 * @param vec1 - First vector
 * @param vec2 - Second vector
 * @returns Cosine similarity score
 */
export function cosineSimilarity(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length) {
    throw new Error(
      `Vector length mismatch: ${vec1.length} vs ${vec2.length}`
    );
  }

  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    norm1 += vec1[i] * vec1[i];
    norm2 += vec2[i] * vec2[i];
  }

  if (norm1 === 0 || norm2 === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
}

/**
 * Calculate Euclidean distance between two vectors.
 * Returns the straight-line distance in n-dimensional space.
 * @param vec1 - First vector
 * @param vec2 - Second vector
 * @returns Euclidean distance
 */
export function euclideanDistance(vec1: number[], vec2: number[]): number {
  const maxLen = Math.max(vec1.length, vec2.length);
  let distSq = 0;

  for (let i = 0; i < maxLen; i++) {
    const diff = (vec1[i] ?? 0) - (vec2[i] ?? 0);
    distSq += diff * diff;
  }

  return Math.sqrt(distSq);
}

/**
 * Normalize a vector to unit length (L2 normalization).
 * @param vec - Vector to normalize
 * @returns Normalized vector
 */
export function normalizeVector(vec: number[]): number[] {
  const norm = Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));
  if (norm === 0) return vec;
  return vec.map((val) => val / norm);
}

/**
 * Calculate dot product of two vectors.
 * @param vec1 - First vector
 * @param vec2 - Second vector
 * @returns Dot product
 */
export function dotProduct(vec1: number[], vec2: number[]): number {
  const minLen = Math.min(vec1.length, vec2.length);
  let sum = 0;
  for (let i = 0; i < minLen; i++) {
    sum += vec1[i] * vec2[i];
  }
  return sum;
}

/**
 * Find the k nearest neighbors using cosine similarity.
 * @param query - Query vector
 * @param vectors - Array of vectors to search
 * @param k - Number of nearest neighbors to return
 * @returns Indices of k nearest neighbors
 */
export function findKNearestNeighbors(
  query: number[],
  vectors: number[][],
  k: number
): number[] {
  const similarities = vectors.map((vec, idx) => ({
    idx,
    similarity: cosineSimilarity(query, vec),
  }));

  similarities.sort((a, b) => b.similarity - a.similarity);
  return similarities.slice(0, k).map((s) => s.idx);
}
