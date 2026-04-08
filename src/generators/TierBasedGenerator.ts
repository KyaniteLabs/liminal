/**
 * TierBasedGenerator - Base class for model-aware generators
 * 
 * Uses ModelTier detection to adapt prompts based on capability:
 * - FLAGSHIP: Concise prompts, XML tags, lots of context
 * - MEDIUM: Detailed instructions
 * - LOCAL: Explicit, few-shot examples
 * - TINY: Minimal, direct
 */

import { LLMClient, LLMConfig, LLMResponse } from '../llm/LLMClient.js';
import { PromptBuilder } from '../llm/PromptBuilder.js';
import { detectModelTier, trimContext, type ModelTier } from '../llm/ModelTier.js';
import { harnessMemory } from '../harness/HarnessMemory.js';
import { metaHarness } from '../harness/MetaHarnessIntegration.js';
import { GenerationError } from '../errors/GenerationError.js';
import { Layer, createLayer, DomainType } from '../composition/types.js';
import { Logger } from '../utils/Logger.js';
import { getEffectiveConfig } from '../config/ConfigLoader.js';

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
  private _configNeedsResolution: boolean;
  private _configResolutionPromise: Promise<void> | null = null;

  constructor(
    domain: string,
    llmOrConfig?: LLMClient | Partial<LLMConfig>
  ) {
    this.domain = domain;
    this._configNeedsResolution = false;

    if (llmOrConfig instanceof LLMClient) {
      this.llm = llmOrConfig;
    } else if (llmOrConfig && (llmOrConfig.baseUrl || llmOrConfig.apiKey || llmOrConfig.model)) {
      // Caller provided partial config with meaningful values
      this.llm = new LLMClient({ ...llmOrConfig, role: 'generator' });
    } else {
      // No config provided -- create placeholder and resolve lazily on first generate
      this.llm = new LLMClient({ role: 'generator' });
      this._configNeedsResolution = true;
    }

    this.tier = detectModelTier(this.llm.getConfig());
    this.promptBuilder = new PromptBuilder(this.llm.getConfig());
  }

  /**
   * Resolve LLM config from getEffectiveConfig() if no explicit config was provided.
   * Called lazily on first generation to ensure providers like MiniMax (from
   * ~/.liminal/config.json) are properly wired without requiring env vars.
   * Uses a promise to prevent race conditions during concurrent calls.
   */
  private async resolveConfigIfNeeded(): Promise<void> {
    if (!this._configNeedsResolution) return;
    
    // Race-safe lazy initialization: only first caller creates the promise
    if (!this._configResolutionPromise) {
      this._configResolutionPromise = this.doResolveConfig();
    }
    
    return this._configResolutionPromise;
  }
  
  private async doResolveConfig(): Promise<void> {
    const config = await getEffectiveConfig(undefined, process.cwd());
    if (!config) {
      Logger.warn('TierBasedGenerator', 'Failed to resolve config');
      return;
    }
    if (config.baseUrl || config.apiKey) {
      this.llm = new LLMClient({
        baseUrl: config.baseUrl,
        model: config.model,
        apiKey: config.apiKey,
        role: 'generator',
      });
      this.tier = detectModelTier(this.llm.getConfig());
      this.promptBuilder = new PromptBuilder(this.llm.getConfig());
    }
    this._configNeedsResolution = false;
  }

  async generate(prompt: string, options?: TierBasedGeneratorOptions): Promise<string> {
    const response = await this.generateInternal(prompt, options);
    return response.code;
  }

  /**
   * Generate with full telemetry — returns the complete LLMResponse
   * including reasoning traces, thinking source, quality scores, and
   * detected patterns. Use this for campaign/telemetry flows that need
   * more than just the generated code.
   */
  async generateFull(prompt: string, options?: TierBasedGeneratorOptions): Promise<LLMResponse> {
    return this.generateInternal(prompt, options);
  }

  /**
   * Generate a Layer with full metadata.
   * This is the preferred method for layer-based composition.
   */
  async generateLayer(prompt: string, options?: TierBasedGeneratorOptions): Promise<Layer> {
    const response = await this.generateInternal(prompt, options);
    
    return createLayer(
      this.domain as DomainType,
      response.code,
      prompt,
      {
        generator: this.constructor.name,
        model: this.llm.getConfig().model || 'unknown',
        generatedAt: new Date().toISOString(),
        thinking: response.thinking,
        recoveredFromThinking: response.recoveredFromThinking,
        validation: { passed: true },
      }
    );
  }

  /**
   * Internal generation method that returns full LLMResponse.
   */
  private async generateInternal(
    prompt: string,
    options?: TierBasedGeneratorOptions
  ): Promise<LLMResponse> {
    // Resolve LLM config lazily on first generation call
    await this.resolveConfigIfNeeded();

    // Ensure LLM is properly initialized
    if (!this.llm) {
      throw new GenerationError(`${this.constructor.name}: LLM not initialized`, this.domain);
    }

    // Ensure promptBuilder is properly initialized
    if (!this.promptBuilder) {
      throw new GenerationError(`${this.constructor.name}: PromptBuilder not initialized`, this.domain);
    }

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

    Logger.info('TierBasedGenerator', `Using ${this.tier} tier (${budget} token budget)`);

    // 4. Generate based on tier capabilities
    let response: LLMResponse;
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

    // Try to extract code from thinking if code is empty but thinking has content
    if (!response.code || response.code.trim() === '') {
      if (response.thinking) {
        const extractedCode = this.extractCodeFromThinking(response.thinking);
        if (extractedCode) {
          response.code = extractedCode;
          response.recoveredFromThinking = true;
        }
      }
      
      // Still empty after extraction attempt
      if (!response.code || response.code.trim() === '') {
        throw new GenerationError(`${this.constructor.name}: LLM returned empty code`, this.domain);
      }
    }
    
    // Post-generation validation: check for minimum viable code
    const strippedCode = response.code.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').trim();
    if (strippedCode.length < 10) {
      throw new GenerationError(
        `${this.constructor.name}: Generated code is too short (${strippedCode.length} chars)`,
        this.domain,
        { codeLength: strippedCode.length }
      );
    }

    // 5. Domain-specific validation
    const validated = this.validateOutput(response.code);
    if (!validated.valid) {
      throw new GenerationError(`${this.constructor.name}: ${validated.error}`, this.domain, {
        validationError: validated.error
      });
    }

    // 6. Report to meta-harness with thinking trace for analysis
    if (process.env.NODE_ENV !== 'test') {
      await metaHarness.onGenerationComplete({
        success: true,
        model: this.llm.getConfig().model || 'unknown',
        domain: this.domain,
        prompt,
        code: response.code,
        duration: 0,
        thinking: response.thinking,
        recoveredFromThinking: response.recoveredFromThinking,
      });
    }

    // 7. Record to memory
    harnessMemory.recordEpisode({
      type: 'generation',
      domain: this.domain,
      prompt,
      code: response.code,
    });

    return response;
  }

  /**
   * Domain-specific validation - override in subclasses
   */
  protected validateOutput(_code: string): { valid: boolean; error?: string } {
    return { valid: true };
  }

  /**
   * Extract code from thinking/reasoning text when LLM puts code in fences
   * but not in the main response. Common with models like Qwen that output
   * reasoning tags containing the actual code.
   */
  private extractCodeFromThinking(thinking: string): string | null {
    if (!thinking || thinking.trim().length === 0) {
      return null;
    }
    
    // Look for code blocks in thinking
    const codeBlockMatch = thinking.match(/```(?:\w+)?\n([\s\S]*?)```/);
    if (codeBlockMatch && codeBlockMatch[1]) {
      const extracted = codeBlockMatch[1].trim();
      if (extracted.length > 0) {
        return extracted;
      }
    }
    
    // Look for code-like content (lines with parentheses, semicolons, etc.)
    const lines = thinking.split('\n');
    const codeLines: string[] = [];
    let inCodeSection = false;
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip markdown fences
      if (trimmed.startsWith('```')) {
        inCodeSection = !inCodeSection;
        continue;
      }
      
      // If we're inside a code block, keep the line
      if (inCodeSection) {
        codeLines.push(line);
        continue;
      }
      
      // Otherwise, look for lines that look like code
      // Has code patterns: function calls, assignments, etc.
      const hasCodePattern = /[(){};=]|\b(function|const|let|var|class|if|for|while|return)\b/.test(trimmed);
      const isComment = trimmed.startsWith('//');
      
      if (hasCodePattern || isComment) {
        codeLines.push(line);
      }
    }
    
    const result = codeLines.join('\n').trim();
    return result.length > 0 ? result : null;
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
  private getUserPreferences(): string {
    const recent = harnessMemory.getRecentEpisodes(5);
    const domains = recent.map(e => e.domain).filter(Boolean);
    const uniqueDomains = [...new Set(domains)];
    
    if (uniqueDomains.length > 0) {
      return `User frequently works with: ${uniqueDomains.join(', ')}`;
    }
    return '';
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

  /**
   * Wrap generated code for gallery iframe display.
   * Base class returns code unchanged — subclasses override with domain-specific harnesses.
   */
  wrapForGallery(_code: string): string {
    return _code;
  }
}
