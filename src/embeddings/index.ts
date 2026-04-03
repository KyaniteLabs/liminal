/**
 * Embeddings module exports.
 * Provides text-to-vector embedding functionality for semantic search.
 */

export {
  EmbeddingService,
  getGlobalEmbeddingService,
  resetGlobalEmbeddingService,
} from './EmbeddingService.js';
export type {
  EmbeddingConfig,
  EmbeddingResult,
} from './EmbeddingService.js';
