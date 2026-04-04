/**
 * EmbeddingService - Text-to-vector embedding interface.
 * Supports local embeddings via @xenova/transformers (Sentence-BERT)
 * with OpenAI text-embedding-ada-002 as fallback.
 */

import { pipeline, type FeatureExtractionPipeline } from '@xenova/transformers';
import { Logger } from '../utils/Logger.js';

/** Configuration for embedding service */
export interface EmbeddingConfig {
  /** Model to use for local embeddings */
  localModel?: string;
  /** OpenAI API key for fallback */
  openAIApiKey?: string;
  /** OpenAI embedding model */
  openAIModel?: string;
  /** Maximum text length to embed */
  maxLength?: number;
  /** Whether to use local embeddings (default: true) */
  useLocal?: boolean;
}

/** Embedding result with metadata */
export interface EmbeddingResult {
  /** The embedding vector */
  vector: number[];
  /** Model used for embedding */
  model: string;
  /** Dimension of the embedding */
  dimension: number;
  /** Whether the embedding was cached */
  cached: boolean;
}

/**
 * Service for generating text embeddings.
 * Uses local Sentence-BERT models via @xenova/transformers
 * with optional OpenAI fallback.
 */
export class EmbeddingService {
  private config: Required<EmbeddingConfig>;
  private localPipeline: FeatureExtractionPipeline | null = null;
  private cache: Map<string, EmbeddingResult> = new Map();
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  // Default to all-MiniLM-L6-v2 - good balance of speed and quality
  private static readonly DEFAULT_LOCAL_MODEL =
    'Xenova/all-MiniLM-L6-v2';
  private static readonly DEFAULT_OPENAI_MODEL =
    'text-embedding-ada-002';
  private static readonly DEFAULT_MAX_LENGTH = 512;

  constructor(config: EmbeddingConfig = {}) {
    this.config = {
      localModel:
        config.localModel ?? EmbeddingService.DEFAULT_LOCAL_MODEL,
      openAIApiKey: config.openAIApiKey ?? '',
      openAIModel:
        config.openAIModel ?? EmbeddingService.DEFAULT_OPENAI_MODEL,
      maxLength: config.maxLength ?? EmbeddingService.DEFAULT_MAX_LENGTH,
      useLocal: config.useLocal ?? true,
    };
  }

  /**
   * Initialize the embedding pipeline.
   * Must be called before embed() if lazy initialization is disabled.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Prevent concurrent initialization
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.doInitialize();
    return this.initPromise;
  }

  private async doInitialize(): Promise<void> {
    try {
      if (this.config.useLocal) {
        Logger.info(
          'EmbeddingService',
          `Loading local model: ${this.config.localModel}`
        );
        this.localPipeline = await pipeline(
          'feature-extraction',
          this.config.localModel,
          {
            revision: 'main',
            quantized: true, // Use quantized model for faster inference
          }
        );
        Logger.info(
          'EmbeddingService',
          'Local embedding model loaded successfully'
        );
      }
      this.initialized = true;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error';
      Logger.warn(
        'EmbeddingService',
        `Failed to initialize local model (will retry on next embed call): ${message}`
      );
      // Clear initPromise so initialization can be retried
      this.initPromise = null;
    }
  }

  /**
   * Generate embedding for a text string.
   * @param text - Text to embed
   * @param useCache - Whether to use caching (default: true)
   * @returns Embedding vector
   */
  async embed(
    text: string,
    useCache = true
  ): Promise<EmbeddingResult> {
    // Check cache first
    const cacheKey = this.getCacheKey(text);
    if (useCache) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        return { ...cached, cached: true };
      }
    }

    // Ensure initialization
    if (!this.initialized) {
      await this.initialize();
    }

    // Truncate text if needed
    const truncatedText = this.truncateText(text);

    let result: EmbeddingResult;

    // Try local embeddings first
    if (this.config.useLocal && this.localPipeline) {
      result = await this.embedLocal(truncatedText);
    } else if (this.config.openAIApiKey) {
      result = await this.embedOpenAI(truncatedText);
    } else {
      throw new Error(
        'No embedding provider available. ' +
          'Enable local embeddings or provide OpenAI API key.'
      );
    }

    // Cache the result
    if (useCache) {
      this.cache.set(cacheKey, { ...result, cached: false });
    }

    return result;
  }

  /**
   * Generate embeddings for multiple texts in batch.
   * More efficient than calling embed() multiple times.
   * @param texts - Array of texts to embed
   * @returns Array of embedding results
   */
  async embedBatch(texts: string[]): Promise<EmbeddingResult[]> {
    // Ensure initialization
    if (!this.initialized) {
      await this.initialize();
    }

    // Process sequentially for now (batch support can be added later)
    const results: EmbeddingResult[] = [];
    for (const text of texts) {
      results.push(await this.embed(text));
    }
    return results;
  }

  private async embedLocal(text: string): Promise<EmbeddingResult> {
    if (!this.localPipeline) {
      throw new Error('Local pipeline not initialized');
    }

    const output = await this.localPipeline(text, {
      pooling: 'mean',
      normalize: true,
    });

    // Extract vector from Tensor output
    const vector = Array.from(output.data as Float32Array).map((v) =>
      Number(v)
    );

    return {
      vector,
      model: this.config.localModel,
      dimension: vector.length,
      cached: false,
    };
  }

  private async embedOpenAI(text: string): Promise<EmbeddingResult> {
    const response = await fetch(
      'https://api.openai.com/v1/embeddings',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.openAIApiKey}`,
        },
        body: JSON.stringify({
          input: text,
          model: this.config.openAIModel,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${error}`);
    }

    const data = await response.json();
    const vector = data.data[0].embedding as number[];

    return {
      vector,
      model: this.config.openAIModel,
      dimension: vector.length,
      cached: false,
    };
  }

  private truncateText(text: string): string {
    // Simple truncation by character count
    // More sophisticated truncation could use tokenization
    if (text.length <= this.config.maxLength) {
      return text;
    }
    return text.slice(0, this.config.maxLength);
  }

  private getCacheKey(text: string): string {
    // Simple hash for cache key
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return `${hash}`;
  }

  /**
   * Get the dimension of embeddings produced by this service.
   * Requires initialization first.
   * @returns Embedding dimension
   */
  getDimension(): number {
    // all-MiniLM-L6-v2 produces 384-dim embeddings
    // text-embedding-ada-002 produces 1536-dim embeddings
    if (this.config.useLocal) {
      return 384;
    }
    return 1536;
  }

  /**
   * Clear the embedding cache.
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics.
   * @returns Cache size and hit rate info
   */
  getCacheStats(): { size: number; maxSize: number } {
    return {
      size: this.cache.size,
      maxSize: 10000, // Arbitrary limit, could be configurable
    };
  }
}

/** Singleton instance for global use */
let globalEmbeddingService: EmbeddingService | null = null;

/**
 * Get or create the global embedding service instance.
 * @param config - Optional configuration
 * @returns Global embedding service
 */
export function getGlobalEmbeddingService(
  config?: EmbeddingConfig
): EmbeddingService {
  if (!globalEmbeddingService) {
    globalEmbeddingService = new EmbeddingService(config);
  }
  return globalEmbeddingService;
}

/**
 * Reset the global embedding service instance.
 * Useful for testing.
 */
export function resetGlobalEmbeddingService(): void {
  globalEmbeddingService = null;
}
