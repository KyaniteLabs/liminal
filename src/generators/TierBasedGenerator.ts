/**
 * TierBasedGenerator - Base class for model-aware generators
 * 
 * Uses ModelTier detection to adapt prompts based on capability:
 * - FLAGSHIP: Concise prompts, XML tags, lots of context
 * - MEDIUM: Detailed instructions
 * - LOCAL: Explicit, few-shot examples
 * - TINY: Minimal, direct
 */

import { LLMClient, LLMConfig } from '../llm/LLMClient.js';
import { PromptBuilder } from '../llm/PromptBuilder.js';
import { detectModelTier, trimContext, type ModelTier } from '../llm/ModelTier.js';
import { harnessMemory } from '../harness/HarnessMemory.js';
import { GenerationError } from '../errors/GenerationError.js';

export interface TierBasedGeneratorOptions {
  signal?: AbortSignal;
  bypassCache?: boolean;
  contextBudget?: number;
}

export abstract class TierBasedGenerator {
  protected llm: LLMClient;
  protected promptBuilder: PromptBuilder;
  protected tier: ModelTier;
  protected domain: string;

  constructor(
    domain: string,
    llmOrConfig?: LLMClient | Partial<LLMConfig>
  ) {
    this.domain = domain;
    this.llm = llmOrConfig instanceof LLMClient
      ? llmOrConfig
      : new LLMClient({ ...llmOrConfig, role: 'generator' });
    
    this.tier = detectModelTier(this.llm.getConfig());
    this.promptBuilder = new PromptBuilder(this.llm.getConfig());
  }

  async generate(prompt: string, options?: TierBasedGeneratorOptions): Promise<string> {
    if (!LLMClient.isConfigured()) {
      throw new GenerationError(`${this.constructor.name}: No LLM configured`, this.domain);
    }

    // 1. Load context from markdown files and memory
    const context = await PromptBuilder.loadContext(this.domain, prompt, {
      recentAdaptations: this.getRecentAdaptations(),
      userPreferences: this.getUserPreferences(),
    });

    // 2. Apply token budget
    const budget = options?.contextBudget || this.getDefaultBudget();
    if (context.domainDocs) {
      context.domainDocs = trimContext(context.domainDocs, Math.floor(budget * 0.3));
    }

    // 3. Build tier-appropriate prompt
    const builtPrompt = this.promptBuilder.build(context);

    console.log(`[${this.constructor.name}] Using ${this.tier} tier (${budget} token budget)`);

    // 4. Generate based on tier capabilities
    let response;
    if (this.tier === 'tiny') {
      response = await this.llm.generate(
        '',
        builtPrompt.combined || builtPrompt.user,
        options?.signal,
        options?.bypassCache
      );
    } else {
      response = await this.llm.generate(
        builtPrompt.system,
        builtPrompt.user,
        options?.signal,
        options?.bypassCache
      );
    }

    if (!response.code || response.code.trim() === '') {
      throw new GenerationError(`${this.constructor.name}: LLM returned empty code`, this.domain);
    }

    // 5. Domain-specific validation
    const validated = this.validateOutput(response.code);
    if (!validated.valid) {
      throw new GenerationError(`${this.constructor.name}: ${validated.error}`, this.domain, {
        validationError: validated.error
      });
    }

    // 6. Record to memory
    harnessMemory.recordEpisode({
      type: 'generation',
      domain: this.domain,
      prompt,
      code: response.code,
    });

    return response.code;
  }

  /**
   * Domain-specific validation - override in subclasses
   */
  protected validateOutput(_code: string): { valid: boolean; error?: string } {
    return { valid: true };
  }

  /**
   * Get default token budget based on tier
   */
  private getDefaultBudget(): number {
    switch (this.tier) {
      case 'flagship': return 8000;
      case 'medium': return 4000;
      case 'local': return 2000;
      case 'tiny': return 1000;
    }
  }

  /**
   * Get recent successful adaptations from memory
   */
  private getRecentAdaptations(): string[] {
    return harnessMemory.getSuccessfulAdaptations()
      .slice(-3)
      .map(a => a.description);
  }

  /**
   * Get user preferences from memory
   */
  private getUserPreferences(): string | undefined {
    const recent = harnessMemory.getRecentEpisodes(5);
    const domains = recent.map(e => e.domain).filter(Boolean);
    const uniqueDomains = [...new Set(domains)];
    
    if (uniqueDomains.length > 0) {
      return `User frequently works with: ${uniqueDomains.join(', ')}`;
    }
    return undefined;
  }

  /**
   * Get current tier info
   */
  getTierInfo(): { tier: ModelTier; budget: number; domain: string } {
    return {
      tier: this.tier,
      budget: this.getDefaultBudget(),
      domain: this.domain,
    };
  }
}
