/**
 * CompositionAnalyzer - Analyzes prompts to determine required domains
 *
 * Uses keyword matching for simple prompts and LLM analysis for complex cases.
 * Returns ordered domain recommendations with confidence scores.
 *
 * @example
 * ```typescript
 * const analyzer = new CompositionAnalyzer();
 * const recommendations = await analyzer.analyze('Create a 3D scene with audio');
 * // Returns: [{ domain: 'three', confidence: 0.9, ... }, { domain: 'tone', confidence: 0.85, ... }]
 * ```
 */

import type { DomainType } from './types.js';
import { Logger } from '../utils/Logger.js';
import type { LLMClient } from '../llm/LLMClient.js';

/**
 * A recommendation for a domain based on prompt analysis
 */
export interface DomainRecommendation {
  /** The recommended domain */
  domain: DomainType;
  /** Confidence score (0-1) */
  confidence: number;
  /** Reason for the recommendation */
  reason: string;
  /** Domains this depends on (should be rendered before this one) */
  dependencies: DomainType[];
}

/**
 * Options for the CompositionAnalyzer
 */
export interface AnalyzerOptions {
  /** Confidence threshold for keyword matching (default: 0.5) */
  keywordThreshold?: number;
  /** Whether to use LLM for complex prompts (default: true) */
  useLLM?: boolean;
  /** LLM client configuration */
  llmConfig?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  };
}

/**
 * Keyword mapping for domain detection
 */
export interface KeywordMapping {
  [domain: string]: string[];
}

/**
 * Domain dependency rules
 */
export interface DependencyRule {
  /** Domain that has dependencies */
  domain: DomainType;
  /** Domains it depends on */
  dependsOn: DomainType[];
  /** Reason for the dependency */
  reason: string;
}

/**
 * Default keyword mappings for domain detection
 */
export const DEFAULT_KEYWORD_MAPPINGS: KeywordMapping = {
  p5: ['canvas', '2d', 'sketch', 'circle', 'particle', 'animation', 'drawing', 'p5', 'p5.js', 'processing'],
  three: ['3d', 'three.js', 'three', 'webgl', 'cube', 'sphere', 'model', 'mesh', 'geometry', 'scene'],
  tone: ['audio', 'sound', 'music', 'synth', 'drone', 'tone', 'tone.js', 'oscillator', 'envelope'],
  strudel: ['pattern', 'sequence', 'tidal', 'live coding', 'strudel', 'cycle', 'rhythm pattern'],
  shader: ['glsl', 'fragment', 'vertex', 'raymarch', 'shader', 'shadertoy', 'fragment shader'],
  hydra: ['video', 'feedback', 'webcam', 'hydra', 'video synth', 'live video'],
  ascii: ['ascii', 'text art', 'character', 'ascii art', 'text graphics'],
  html: ['dom', 'css', 'web page', 'ui', 'html', 'website', 'div', 'styled'],
  video: ['video export', 'render', 'composition', 'revideo', 'video production', 'mp4 export'],
  textgen: ['text', 'poem', 'story', 'generate text', 'creative writing'],
};

/**
 * Domain dependency rules - defines which domains depend on others
 */
export const DOMAIN_DEPENDENCIES: DependencyRule[] = [
  {
    domain: 'tone',
    dependsOn: ['p5', 'three'],
    reason: 'Audio often needs visual context for synchronization',
  },
  {
    domain: 'strudel',
    dependsOn: ['p5', 'three'],
    reason: 'Pattern music often syncs with visuals',
  },
  {
    domain: 'hydra',
    dependsOn: ['p5', 'three'],
    reason: 'Video synthesis can overlay on generated visuals',
  },
  {
    domain: 'shader',
    dependsOn: ['p5', 'three'],
    reason: 'Shaders often enhance 3D scenes',
  },
];

/**
 * Domain rendering order (base layers first)
 */
export const DOMAIN_RENDER_ORDER: DomainType[] = [
  'html',      // Base DOM
  'p5',        // 2D canvas base
  'three',     // 3D scenes
  'shader',    // Shader effects
  'hydra',     // Video synthesis
  'ascii',     // ASCII overlays
  'tone',      // Audio (can sync with visuals)
  'strudel',   // Pattern music
  'video',     // Video composition
  'textgen',   // Text content
];

/**
 * Analyzes prompts to determine which domains are needed
 */
export class CompositionAnalyzer {
  private keywordMappings: KeywordMapping;
  private dependencyRules: DependencyRule[];
  private options: Required<AnalyzerOptions>;
  private llmClient?: LLMClient;

  /**
   * Creates a new CompositionAnalyzer
   * @param options - Configuration options
   * @param keywordMappings - Custom keyword mappings (optional)
   * @param dependencyRules - Custom dependency rules (optional)
   */
  constructor(
    options: AnalyzerOptions = {},
    keywordMappings: KeywordMapping = DEFAULT_KEYWORD_MAPPINGS,
    dependencyRules: DependencyRule[] = DOMAIN_DEPENDENCIES
  ) {
    this.options = {
      keywordThreshold: options.keywordThreshold ?? 0.5,
      useLLM: options.useLLM ?? true,
      llmConfig: options.llmConfig ?? {},
    };
    this.keywordMappings = keywordMappings;
    this.dependencyRules = dependencyRules;
  }

  /**
   * Analyze a prompt to determine required domains
   * Uses keyword matching first, falls back to LLM for complex prompts
   *
   * @param prompt - The user prompt to analyze
   * @returns Ordered list of domain recommendations
   */
  async analyze(prompt: string): Promise<DomainRecommendation[]> {
    // First try keyword matching
    const keywordResults = this.analyzeWithKeywords(prompt);

    // If we have strong matches, use those
    if (keywordResults.length > 0 && keywordResults.every(r => r.confidence >= this.options.keywordThreshold)) {
      return this.sortRecommendations(keywordResults);
    }

    // For complex prompts or low confidence, use LLM
    if (this.options.useLLM) {
      try {
        const llmResults = await this.analyzeWithLLM(prompt);
        // Merge keyword and LLM results, preferring higher confidence
        return this.mergeRecommendations(keywordResults, llmResults);
      } catch (err) {
        // If LLM fails, fall back to keyword results
        Logger.warn('CompositionAnalyzer', 'LLM analysis failed, degrading to keyword results:', err);
        return this.sortRecommendations(keywordResults);
      }
    }

    return this.sortRecommendations(keywordResults);
  }

  /**
   * Analyze prompt using keyword matching
   *
   * @param prompt - The user prompt to analyze
   * @returns Array of domain recommendations
   */
  analyzeWithKeywords(prompt: string): DomainRecommendation[] {
    const promptLower = prompt.toLowerCase();
    const recommendations: DomainRecommendation[] = [];

    for (const [domain, keywords] of Object.entries(this.keywordMappings)) {
      let matchCount = 0;
      const matchedKeywords: string[] = [];

      for (const keyword of keywords) {
        if (promptLower.includes(keyword.toLowerCase())) {
          matchCount++;
          matchedKeywords.push(keyword);
        }
      }

      if (matchCount > 0) {
        // Calculate confidence based on matches
        // More matches = higher confidence, up to 0.9
        const baseConfidence = Math.min(0.5 + matchCount * 0.15, 0.9);
        // Boost confidence for exact domain name match
        const exactMatch = promptLower.includes(domain.toLowerCase());
        const confidence = exactMatch ? Math.min(baseConfidence + 0.1, 1.0) : baseConfidence;

        recommendations.push({
          domain: domain as DomainType,
          confidence,
          reason: `Matched keywords: ${matchedKeywords.join(', ')}`,
          dependencies: this.getDependencies(domain as DomainType),
        });
      }
    }

    return recommendations;
  }

  /**
   * Analyze prompt using LLM for complex cases.
   * When an LLMClient is injected, calls the LLM with a structured prompt to
   * determine domain recommendations. Falls back to keyword-based pattern
   * detection when no client is available or the LLM call fails.
   */
  async analyzeWithLLM(prompt: string): Promise<DomainRecommendation[]> {
    if (!this.llmClient) {
      return this.detectComplexPatterns(prompt);
    }

    try {
      const systemPrompt = [
        'You are a creative coding domain analyzer.',
        'Given a user prompt, determine which creative coding domains are needed.',
        `Available domains: ${Object.keys(DEFAULT_KEYWORD_MAPPINGS).join(', ')}`,
        'Respond with a JSON array of objects, each with:',
        '- "domain": one of the available domain names',
        '- "confidence": number between 0 and 1',
        '- "reason": brief explanation',
        '- "dependencies": array of domain names this domain depends on (empty array if none)',
        'Return ONLY the JSON array, no other text.',
      ].join('\n');

      const userPrompt = `Analyze this creative prompt: "${prompt}"`;
      const response = await this.llmClient.generate(systemPrompt, userPrompt);

      if (!response.success || !response.code) {
        Logger.warn('CompositionAnalyzer', 'LLM response unsuccessful, falling back to patterns');
        return this.detectComplexPatterns(prompt);
      }

      const parsed = JSON.parse(response.code);
      if (!Array.isArray(parsed)) {
        Logger.warn('CompositionAnalyzer', 'LLM did not return an array, falling back to patterns');
        return this.detectComplexPatterns(prompt);
      }

      return parsed
        .filter((item: Record<string, unknown>) =>
          typeof item.domain === 'string' && typeof item.confidence === 'number' && item.domain in DEFAULT_KEYWORD_MAPPINGS
        )
        .map((item: Record<string, unknown>) => ({
          domain: item.domain as DomainType,
          confidence: Math.max(0, Math.min(1, item.confidence as number)),
          reason: (item.reason as string) || 'LLM analysis',
          dependencies: Array.isArray(item.dependencies)
            ? (item.dependencies as string[]).filter((d): d is DomainType => d in DEFAULT_KEYWORD_MAPPINGS)
            : [],
        }));
    } catch (err) {
      Logger.warn('CompositionAnalyzer', 'LLM analysis failed, falling back to patterns:', err);
      return this.detectComplexPatterns(prompt);
    }
  }

  /**
   * Inject an LLMClient for LLM-powered domain analysis.
   * Allows post-construction injection — the analyzer degrades gracefully
   * to keyword matching when no client is set.
   */
  setLLMClient(client: LLMClient): void {
    this.llmClient = client;
  }

  private detectComplexPatterns(prompt: string): DomainRecommendation[] {
    const promptLower = prompt.toLowerCase();
    const recommendations: DomainRecommendation[] = [];

    // Pattern: 3D scene with audio
    if ((promptLower.includes('3d') || promptLower.includes('three')) &&
        (promptLower.includes('audio') || promptLower.includes('sound') || promptLower.includes('music'))) {
      recommendations.push(
        {
          domain: 'three',
          confidence: 0.9,
          reason: 'Detected 3D scene requirement',
          dependencies: [],
        },
        {
          domain: 'tone',
          confidence: 0.85,
          reason: 'Detected audio synchronization with 3D visuals',
          dependencies: ['three'],
        }
      );
    }

    // Pattern: Shader effects on canvas
    if ((promptLower.includes('shader') || promptLower.includes('glsl')) &&
        (promptLower.includes('canvas') || promptLower.includes('2d'))) {
      recommendations.push(
        {
          domain: 'p5',
          confidence: 0.9,
          reason: 'Detected 2D canvas base',
          dependencies: [],
        },
        {
          domain: 'shader',
          confidence: 0.85,
          reason: 'Detected shader overlay on canvas',
          dependencies: ['p5'],
        }
      );
    }

    // Pattern: Video synthesis with music
    if ((promptLower.includes('video') || promptLower.includes('hydra')) &&
        (promptLower.includes('music') || promptLower.includes('beat') || promptLower.includes('pattern'))) {
      recommendations.push(
        {
          domain: 'hydra',
          confidence: 0.85,
          reason: 'Detected video synthesis requirement',
          dependencies: [],
        },
        {
          domain: 'strudel',
          confidence: 0.8,
          reason: 'Detected pattern music for video sync',
          dependencies: ['hydra'],
        }
      );
    }

    return recommendations;
  }

  /**
   * Get dependencies for a domain
   *
   * @param domain - The domain to check
   * @returns Array of domains this domain depends on
   */
  private getDependencies(domain: DomainType): DomainType[] {
    const rule = this.dependencyRules.find(r => r.domain === domain);
    return rule?.dependsOn ?? [];
  }

  /**
   * Sort recommendations by render order and confidence
   *
   * @param recommendations - Array of recommendations to sort
   * @returns Sorted recommendations
   */
  private sortRecommendations(recommendations: DomainRecommendation[]): DomainRecommendation[] {
    return recommendations.sort((a, b) => {
      // First sort by render order
      const orderA = DOMAIN_RENDER_ORDER.indexOf(a.domain);
      const orderB = DOMAIN_RENDER_ORDER.indexOf(b.domain);
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      // Then by confidence (higher first)
      return b.confidence - a.confidence;
    });
  }

  /**
   * Merge keyword and LLM recommendations, keeping highest confidence
   *
   * @param keywordResults - Results from keyword matching
   * @param llmResults - Results from LLM analysis
   * @returns Merged recommendations
   */
  private mergeRecommendations(
    keywordResults: DomainRecommendation[],
    llmResults: DomainRecommendation[]
  ): DomainRecommendation[] {
    const merged = new Map<DomainType, DomainRecommendation>();

    // Add keyword results first
    for (const result of keywordResults) {
      merged.set(result.domain, result);
    }

    // Merge or add LLM results
    for (const result of llmResults) {
      const existing = merged.get(result.domain);
      if (existing) {
        // Keep the higher confidence one
        if (result.confidence > existing.confidence) {
          merged.set(result.domain, result);
        }
      } else {
        merged.set(result.domain, result);
      }
    }

    return this.sortRecommendations(Array.from(merged.values()));
  }

  /**
   * Get the keyword mappings being used
   */
  getKeywordMappings(): KeywordMapping {
    return { ...this.keywordMappings };
  }

  /**
   * Get the dependency rules being used
   */
  getDependencyRules(): DependencyRule[] {
    return [...this.dependencyRules];
  }
}
