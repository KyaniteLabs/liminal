/**
 * SmartRouter — Re-exported from GeneratorRegistry for backward compatibility.
 *
 * Smart model routing has been merged into GeneratorRegistry.
 * This module provides a backward-compatible wrapper that stores its own config.
 *
 * @module routing/SmartRouter
 * @deprecated Use GeneratorRegistry.route() and GeneratorRegistry.routeByPrompt() directly.
 */

import {
  generatorRegistry,
  type RoutingDecision,
  type RoutingConfig,
} from '../generators/GeneratorRegistry.js';

// Re-export types
export type { RoutingDecision, RoutingConfig };

/**
 * Smart model router — backward-compatible wrapper around GeneratorRegistry routing.
 * @deprecated Use generatorRegistry.route() and generatorRegistry.routeByPrompt() instead.
 */
export class SmartRouter {
  private config: RoutingConfig;

  constructor(config?: RoutingConfig) {
    this.config = {
      preferLocal: true,
      fallbackToHybrid: false,
      minConfidence: 0.5,
      ...config,
    };
  }

  route(domain: 'ascii' | 'music' | 'code' | 'visual', complexity?: 'simple' | 'medium' | 'complex'): RoutingDecision {
    generatorRegistry.setRoutingConfig(this.config);
    return generatorRegistry.route(domain, complexity);
  }

  routeByPrompt(prompt: string): RoutingDecision {
    generatorRegistry.setRoutingConfig(this.config);
    return generatorRegistry.routeByPrompt(prompt);
  }

  getStats() {
    return generatorRegistry.getRoutingStats();
  }

  isDomainSupported(domain: string): boolean {
    return generatorRegistry.isDomainSupported(domain);
  }

  getAllDomainKeywords(): Record<string, string[]> {
    return generatorRegistry.getAllDomainKeywords();
  }

  getDomainConfig(domain: 'ascii' | 'music' | 'code' | 'visual') {
    const stats = generatorRegistry.getRoutingStats();
    const domainInfo = stats.domains[domain];
    if (domainInfo) {
      return {
        optimalModel: domainInfo.winner,
        confidence: domainInfo.confidence,
        advantage: domainInfo.advantage,
        localFitness: stats.abTestResults[domain].local,
        cloudFitness: stats.abTestResults[domain].cloud,
      };
    }
    return {
      optimalModel: this.config.preferLocal ? 'local' : 'cloud',
      confidence: 0.6,
      advantage: 'N/A (dynamic domain)',
      localFitness: stats.overallLocalFitness,
      cloudFitness: stats.overallCloudFitness,
    };
  }
}

export const defaultRouter = new SmartRouter();

export function route(
  domain: 'ascii' | 'music' | 'code' | 'visual',
  complexity?: 'simple' | 'medium' | 'complex',
): RoutingDecision {
  return generatorRegistry.route(domain, complexity);
}

export function routeByPrompt(prompt: string): RoutingDecision {
  return generatorRegistry.routeByPrompt(prompt);
}
