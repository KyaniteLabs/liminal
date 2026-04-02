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
      : new LLMClient(llmOrConfig);
    
    this.tier = detectModelTier(this.llm.getConfig());
    this.promptBuilder = new PromptBuilder(this.llm.getConfig());
  }

  async generate(prompt: string, options?: TierBasedGeneratorOptions): Promise<string> {
    if (!LLMClient.isConfigured()) {
      throw new Error(`${this.constructor.name}: No LLM configured`);
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

    // NEW: Thinking-aware validation and recovery
    if (!response.code || response.code.trim() === '') {
      // Code is empty, but do we have thinking?
      if (response.thinking) {
        console.log(`[${this.constructor.name}] Empty code but has thinking (${response.thinking.length} chars), attempting recovery...`);
        
        // Try to extract code from thinking
        const recoveredCode = this.attemptCodeRecoveryFromThinking(response);
        
        if (recoveredCode) {
          console.log(`[${this.constructor.name}] Successfully recovered ${recoveredCode.length} chars from thinking`);
          response.code = recoveredCode;
          response.recoveredFromThinking = true;
        } else {
          // Log thinking for diagnostics even if recovery failed
          console.log(`[${this.constructor.name}] Could not extract code from thinking`);
        }
        
        // Always feed thinking to compost (even if recovery failed)
        await this.feedThinkingToCompost(prompt, response);
      }
      
      // If still no code after recovery attempt, throw error
      if (!response.code || response.code.trim() === '') {
        throw new Error(`${this.constructor.name}: LLM returned empty code`);
      }
    } else {
      // We have code, but also capture thinking for successful generations
      if (response.thinking) {
        await this.feedThinkingToCompost(prompt, response);
      }
    }

    // 5. Domain-specific validation
    const validated = this.validateOutput(response.code);
    if (!validated.valid) {
      throw new Error(`${this.constructor.name}: ${validated.error}`);
    }

    // 6. Record to memory (includes thinking tags)
    harnessMemory.recordEpisode({
      type: 'generation',
      domain: this.domain,
      prompt,
      code: response.code,
      tags: [
        ...(response.recoveredFromThinking ? ['recovered-from-thinking'] : []),
        ...(response.thinking ? ['has-thinking'] : []),
        `thinking-length:${response.thinking?.length || 0}`,
      ],
    });

    // 7. Record to emergent patterns system for long-term learning
    await this.recordToEmergentPatterns(prompt, response);

    return response.code;
  }

  /**
   * Record observation to emergent patterns system
   */
  private async recordToEmergentPatterns(prompt: string, response: LLMResponse): Promise<void> {
    try {
      // Dynamic import to avoid circular dependencies
      const { modelBehaviorPatterns } = await import('../emergent/ModelBehaviorPatterns.js');
      
      modelBehaviorPatterns.recordObservation({
        model: this.llm.getConfig().model,
        domain: this.domain,
        prompt,
        thinking: response.thinking,
        code: response.code,
        outcome: response.success ? 'success' : 'failure',
        recoveredFromThinking: response.recoveredFromThinking,
      });
    } catch (err) {
      // Don't fail generation if emergent tracking fails
      console.warn(`[${this.constructor.name}] Failed to record emergent pattern:`, (err as Error).message);
    }
  }

  /**
   * Domain-specific validation - override in subclasses
   */
  protected validateOutput(_code: string): { valid: boolean; error?: string } {
    return { valid: true };
  }

  /**
   * Attempt to recover code from thinking content
   * Models like Minimax put code inside <think> tags
   */
  private attemptCodeRecoveryFromThinking(response: LLMResponse): string | null {
    if (!response.thinking) return null;
    
    const thinking = response.thinking;
    
    // Strategy 1: Look for code blocks in thinking
    const codeBlockMatch = thinking.match(/```(?:javascript|js|p5|glsl|html|typescript)?\n([\s\S]*?)```/i);
    if (codeBlockMatch) {
      return codeBlockMatch[1].trim();
    }
    
    // Strategy 2: Look for function setup() or function draw()
    const p5Match = thinking.match(/(function\s+setup\s*\([^)]*\)\s*\{[\s\S]*?(?:function\s+draw\s*\([^)]*\)\s*\{[\s\S]*?\})?)/);
    if (p5Match) {
      return p5Match[1];
    }
    
    // Strategy 3: Look for any function declaration
    const functionMatch = thinking.match(/(function\s+\w+\s*\([^)]*\)\s*\{[\s\S]*?\})/);
    if (functionMatch) {
      return functionMatch[1];
    }
    
    // Strategy 4: Look for HTML/GLSL patterns
    if (thinking.includes('<!DOCTYPE') || thinking.includes('<html')) {
      const htmlMatch = thinking.match(/(<!DOCTYPE[\s\S]*?<\/html>)/i);
      if (htmlMatch) return htmlMatch[1];
    }
    
    // Strategy 5: Look for shader code (void main)
    if (thinking.includes('void main')) {
      const shaderMatch = thinking.match(/(void\s+main\s*\([^)]*\)\s*\{[\s\S]*?\})/);
      if (shaderMatch) return shaderMatch[1];
    }
    
    return null;
  }

  /**
   * Feed thinking content to compost heap
   * All thinking becomes nutrients for future improvements
   */
  private async feedThinkingToCompost(prompt: string, response: LLMResponse): Promise<void> {
    try {
      const fs = await import('node:fs/promises');
      const path = await import('node:path');
      const os = await import('node:os');
      
      // Write thinking to compost directory as JSONL
      const compostDir = path.join(os.homedir(), '.liminal', 'compost-thinking');
      await fs.mkdir(compostDir, { recursive: true });
      
      const entry = {
        type: response.code && response.code.trim() ? 'hybrid' : 'thinking',
        content: response.thinking || '',
        source: {
          model: this.llm.getConfig().model,
          domain: this.domain,
          prompt: prompt.slice(0, 200), // Truncate for storage
        },
        metadata: {
          wasEmptyCode: !response.code || response.code.trim() === '',
          recoveredCode: response.recoveredFromThinking || false,
          thinkingLength: response.thinking?.length || 0,
          thinkingMetrics: response.thinkingMetrics,
          timestamp: new Date().toISOString(),
        },
      };
      
      const filePath = path.join(compostDir, 'thinking-trace.jsonl');
      await fs.appendFile(filePath, JSON.stringify(entry) + '\n');
      
      console.log(`[${this.constructor.name}] Thinking fed to compost (${response.thinking?.length || 0} chars)`);
    } catch (err) {
      // Don't fail generation if compost fails
      console.warn(`[${this.constructor.name}] Failed to feed thinking to compost:`, (err as Error).message);
    }
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
