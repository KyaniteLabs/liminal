/**
 * GeneratorRegistry - Unified dispatch for code generators and model routing.
 *
 * Each generator declares what it can handle via canHandle(prompt) -> confidence (0-1).
 * The registry picks the highest-confidence generator, with LLM as fallback.
 *
 * Also provides smart model routing (local/cloud/hybrid) based on A/B test data,
 * merged from the former SmartRouter module.
 *
 * Supports dynamic domain registration at runtime.
 */

import type { ProjectDNA } from '../scavenger/types.js';
import {
  AB_TEST_RESULTS,
  DOMAIN_ROUTING_DATA,
  DOMAIN_KEYWORDS,
  OVERALL_FITNESS,
} from '../routing/RoutingData.js';
import type {
  DomainType,
  ModelChoice,
} from '../routing/RoutingData.js';

export interface GeneratorEntry {
  name: string;
  canHandle: (prompt: string) => number; // 0 = can't handle, higher = more confident
  generate: (prompt: string, params?: Record<string, unknown>) => string | Promise<string>;
}

/**
 * Result of a model routing decision.
 */
export interface RoutingDecision {
  model: ModelChoice;
  reason: string;
  confidence: number;
  localFitness: number;
  cloudFitness: number;
  domain?: DomainType;
}

/**
 * Configuration options for smart model routing.
 */
export interface RoutingConfig {
  preferLocal?: boolean;
  fallbackToHybrid?: boolean;
  minConfidence?: number;
}

/**
 * Configuration for dynamic domain registration.
 */
export interface DynamicDomainConfig {
  /** Unique name for this domain (e.g., 'lyrics', 'poetry') */
  name: string;
  /** Keywords that trigger this domain (for domain detection) */
  keywords: string[];
  /** Default confidence score for this domain (0-1) */
  confidence: number;
  /** Generator function that produces output for this domain */
  generate: (prompt: string, context?: Record<string, unknown>) => string | Promise<string>;
  /** Optional: language identifier for output (default: domain name) */
  language?: string;
}

class GeneratorRegistryClass {
  private entries: GeneratorEntry[] = [];
  /** Track dynamically registered domains for lookup/unregister */
  private dynamicDomains: Map<string, GeneratorEntry> = new Map();
  /** Track keywords for each dynamic domain */
  private dynamicKeywords: Map<string, string[]> = new Map();
  /** Global DNA registry: domain -> ProjectDNA */
  private dnaRegistry: Map<string, ProjectDNA> = new Map();
  /** Smart routing configuration */
  private routingConfig: RoutingConfig = { preferLocal: true, fallbackToHybrid: false, minConfidence: 0.5 };

  /**
   * Register DNA from the scavenger module.
   */
  registerDNA(dna: ProjectDNA): void {
    this.dnaRegistry.set(dna.domain, dna);
  }

  /**
   * Get DNA for a specific domain.
   */
  getDNA(domain: string): ProjectDNA | undefined {
    return this.dnaRegistry.get(domain);
  }

  /**
   * Get all registered DNA entries.
   */
  getAllDNA(): Map<string, ProjectDNA> {
    return new Map(this.dnaRegistry);
  }

  register(entry: GeneratorEntry): void {
    this.entries.push(entry);
  }

  /**
   * Register a new creative domain dynamically at runtime.
   *
   * @example
   * ```ts
   * GeneratorRegistry.register({
   *   name: 'lyrics',
   *   keywords: ['lyrics', 'poem', 'song words', 'verse'],
   *   confidence: 0.8,
   *   generate: async (prompt, context) => {
   *     return { code: '...', language: 'lyrics' };
   *   }
   * });
   * ```
   *
   * @param config - Domain configuration
   * @throws Error if domain with same name already exists
   */
  registerDomain(config: DynamicDomainConfig): void {
    if (this.dynamicDomains.has(config.name)) {
      throw new Error(`Domain '${config.name}' is already registered`);
    }

    // Store keywords for this domain
    this.dynamicKeywords.set(config.name, config.keywords);

    // Create a canHandle function that checks for keywords
    const keywordsLower = config.keywords.map(k => k.toLowerCase());
    const canHandle = (prompt: string): number => {
      const promptLower = prompt.toLowerCase();
      for (const keyword of keywordsLower) {
        if (promptLower.includes(keyword)) {
          return config.confidence;
        }
      }
      return 0;
    };

    // Wrap the generate function to return string format
    const generate = async (
      prompt: string,
      params?: Record<string, unknown>,
    ): Promise<string> => {
      const result = await config.generate(prompt, params);
      // If result is object with code property, extract it
      if (typeof result === 'object' && result !== null && 'code' in result) {
        return (result as { code: string }).code;
      }
      // Otherwise return as-is (should be string)
      return result as string;
    };

    const entry: GeneratorEntry = {
      name: config.name,
      canHandle,
      generate,
    };

    this.entries.push(entry);
    this.dynamicDomains.set(config.name, entry);
  }

  /**
   * Unregister a dynamically registered domain.
   *
   * @param name - Domain name to unregister
   * @returns true if domain was found and removed, false otherwise
   */
  unregisterDomain(name: string): boolean {
    const entry = this.dynamicDomains.get(name);
    if (!entry) {
      return false;
    }

    // Remove from entries array
    const index = this.entries.indexOf(entry);
    if (index !== -1) {
      this.entries.splice(index, 1);
    }

    this.dynamicDomains.delete(name);
    this.dynamicKeywords.delete(name);
    return true;
  }

  /**
   * Check if a domain is registered (built-in or dynamic).
   *
   * @param name - Domain name to check
   * @returns true if domain exists
   */
  hasDomain(name: string): boolean {
    return this.entries.some(entry => entry.name === name);
  }

  /**
   * Get all keywords from dynamically registered domains.
   * Useful for updating SmartRouter's keyword detection.
   *
   * @returns Map of domain name to keywords
   */
  getDynamicKeywords(): Map<string, string[]> {
    return new Map(this.dynamicKeywords);
  }

  /**
   * Get keywords for a specific dynamic domain.
   *
   * @param name - Domain name
   * @returns Array of keywords or undefined if domain not found
   */
  getKeywordsForDomain(name: string): string[] | undefined {
    return this.dynamicKeywords.get(name);
  }

  /**
   * Get all dynamically registered domain names.
   *
   * @returns Array of domain names
   */
  getDynamicDomains(): string[] {
    return Array.from(this.dynamicDomains.keys());
  }

  /**
   * Find the best generator for a prompt. Returns { entry, confidence }.
   * Returns null if no entry has confidence > 0.
   */
  dispatch(prompt: string): { entry: GeneratorEntry; confidence: number } | null {
    let best: { entry: GeneratorEntry; confidence: number } | null = null;
    for (const entry of this.entries) {
      const confidence = entry.canHandle(prompt);
      if (confidence > 0 && (!best || confidence > best.confidence)) {
        best = { entry, confidence };
      }
    }
    return best;
  }

  // ---------------------------------------------------------------------------
  // Smart model routing (merged from SmartRouter)
  // ---------------------------------------------------------------------------

  /**
   * Configure smart routing behavior.
   */
  setRoutingConfig(config: RoutingConfig): void {
    this.routingConfig = { ...this.routingConfig, ...config };
  }

  /**
   * Route a request to the optimal model (local/cloud/hybrid) based on domain.
   */
  route(
    domain: DomainType,
    complexity?: 'simple' | 'medium' | 'complex',
  ): RoutingDecision {
    const { preferLocal, fallbackToHybrid, minConfidence } = this.routingConfig;
    const routingData = DOMAIN_ROUTING_DATA[domain];
    const abResults = AB_TEST_RESULTS[domain];

    if (!routingData || !abResults) {
      return {
        model: preferLocal ? 'local' : 'cloud',
        reason: `Dynamic domain '${domain}' - using ${preferLocal ? 'local' : 'cloud'} model (no A/B test data)`,
        confidence: 0.6,
        localFitness: OVERALL_FITNESS.local,
        cloudFitness: OVERALL_FITNESS.cloud,
        domain,
      };
    }

    const { local, cloud } = abResults;
    const maxFitness = Math.max(local, cloud);
    const pctDiff = maxFitness > 0 ? Math.abs(local - cloud) / maxFitness : 0;

    let optimalModel: ModelChoice = routingData.optimalModel;
    let confidence = routingData.confidence;

    if (preferLocal && pctDiff < 0.05 && optimalModel === 'cloud') {
      optimalModel = 'local';
      confidence = Math.max(0.6, confidence - 0.15);
    }

    if (fallbackToHybrid && complexity === 'complex' && confidence < (minConfidence ?? 0.5)) {
      optimalModel = 'hybrid';
      confidence = 0.65;
    }

    const modelNames: Record<ModelChoice, string> = {
      local: 'Local Qwen 3.5-4B',
      cloud: 'Cloud Minimax',
      hybrid: 'Hybrid (Local + Cloud)',
    };

    const domainDisplayName = domain === 'ascii' ? 'ASCII' : domain.charAt(0).toUpperCase() + domain.slice(1);
    const domainName = `${domainDisplayName} domain`;
    let reason: string;
    if (optimalModel === 'local') {
      reason = `${domainName} - ${modelNames.local} wins (${local.toFixed(3)} vs ${cloud.toFixed(3)}, ${routingData.advantage})`;
    } else if (optimalModel === 'cloud') {
      reason = `${domainName} - ${modelNames.cloud} superior (${cloud.toFixed(3)} vs ${local.toFixed(3)}, ${routingData.advantage})`;
    } else {
      reason = `${domainName} - ${modelNames.hybrid} for complex task`;
    }

    return { model: optimalModel, reason, confidence, localFitness: local, cloudFitness: cloud, domain };
  }

  /**
   * Route a request based on prompt content analysis.
   * Detects domain from keywords and routes accordingly.
   */
  routeByPrompt(prompt: string): RoutingDecision {
    const detectedDomain = this.detectDomain(prompt);
    if (detectedDomain) {
      return this.route(detectedDomain);
    }

    const { preferLocal } = this.routingConfig;
    return {
      model: preferLocal ? 'local' : 'cloud',
      reason: `Unknown domain - defaulting to ${preferLocal ? 'local' : 'cloud'} (preferLocal=${preferLocal})`,
      confidence: 0.3,
      localFitness: OVERALL_FITNESS.local,
      cloudFitness: OVERALL_FITNESS.cloud,
    };
  }

  /**
   * Detect domain from prompt keywords.
   */
  detectDomain(prompt: string): DomainType | undefined {
    const promptLower = prompt.toLowerCase();

    for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
      for (const keyword of keywords) {
        if (promptLower.includes(keyword)) {
          return domain as DomainType;
        }
      }
    }

    for (const [domain, keywords] of this.dynamicKeywords) {
      for (const keyword of keywords) {
        if (promptLower.includes(keyword)) {
          return domain as DomainType;
        }
      }
    }

    return undefined;
  }

  /**
   * Get all domain keywords (built-in + dynamic).
   */
  getAllDomainKeywords(): Record<string, string[]> {
    return { ...DOMAIN_KEYWORDS, ...Object.fromEntries(this.dynamicKeywords) };
  }

  /**
   * Check if a domain is supported (built-in or dynamic).
   */
  isDomainSupported(domain: string): boolean {
    return domain in DOMAIN_ROUTING_DATA || this.dynamicKeywords.has(domain);
  }

  /**
   * Get routing statistics.
   */
  getRoutingStats(): {
    abTestResults: typeof AB_TEST_RESULTS;
    overallLocalFitness: number;
    overallCloudFitness: number;
    domains: Record<string, { winner: ModelChoice; advantage: string; confidence: number }>;
  } {
    return {
      abTestResults: AB_TEST_RESULTS,
      overallLocalFitness: OVERALL_FITNESS.local,
      overallCloudFitness: OVERALL_FITNESS.cloud,
      domains: Object.fromEntries(
        Object.entries(DOMAIN_ROUTING_DATA).map(([domain, config]) => [
          domain,
          { winner: config.optimalModel, advantage: config.advantage, confidence: config.confidence },
        ]),
      ),
    };
  }

  getAll(): readonly GeneratorEntry[] {
    return this.entries;
  }

  /**
   * Reset the registry (useful for testing).
   */
  clear(): void {
    this.entries = [];
    this.dynamicDomains.clear();
    this.dynamicKeywords.clear();
  }
}

// Singleton registry
export const generatorRegistry = new GeneratorRegistryClass();
